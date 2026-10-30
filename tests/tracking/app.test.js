const assert = require('assert');
const fs = require('fs');
const { M, load, test, run, setRealConfig, SRC } = require('./harness');

const QK = '@PFSLive:locationQueue', QCK = '@PFSLive:locationQueueCount', OK_ = '@PFSLive:orphanQueue';
const PARAMS = '@PFSLive:trackingParams', SENT = '@PFSLive:bgSentCount', LASTQ = '@PFSLive:lastQueuedAt';
const fix = (p, e, minsAgo, extra = {}) => ({ participantId: String(p), eventId: String(e), latitude: 50 + minsAgo / 1000, longitude: 4,
  timestamp: new Date(M.clock - minsAgo * 60000).toISOString(), queuedAt: '', retryCount: 0, ...extra });
const setQ = (a) => { M.store.set(QK, JSON.stringify(a)); M.store.set(QCK, String(a.length)); };
const getQ = () => JSON.parse(M.store.get(QK) || '[]');
const getO = () => JSON.parse(M.store.get(OK_) || '[]');
const Q = () => load('services/locationQueueService');
const L = () => load('services/locationService').locationService;

(async () => {
  const results = [];

  // ════════════ 1. hasNetwork (issue 3) ════════════
  test('online + reachable → true', async () => {
    assert.strictEqual(await Q().locationQueueService.hasNetwork(), true);
  });
  test('reachable null (Android still probing) → true', async () => {
    M.net = { isConnected: true, isInternetReachable: null };
    assert.strictEqual(await Q().locationQueueService.hasNetwork(), true);
  });
  // 2026-10-20 re-check: "no radio" is probed like "unreachable" (p4789 had
  // isConnected=false the whole of event 19, all 177 fixes arrived after the finish).
  test('no radio (isConnected=false) → a probe every 30s, logged with the type; false in between', async () => {
    M.net = { isConnected: false, isInternetReachable: false, type: 'cellular' };
    const { locationQueueService: q } = Q();
    assert.strictEqual(await q.hasNetwork(), true, 'first call opens a probe');
    M.clock += 14000; assert.strictEqual(await q.hasNetwork(), true, 'inside the 15s window');
    M.clock += 2000; assert.strictEqual(await q.hasNetwork(), false, 'window over');
    M.clock += 14500; assert.strictEqual(await q.hasNetwork(), true, 'next probe after 30s');
    const log = await load('services/gpsService').getFullTrackingLog();
    assert.ok(log.some((e) => /NetInfo says no connection \(type:cellular\) — trying the API anyway \(probe\)/.test(e.msg)), 'probe logged');
  });
  test('unreachable → 1st call opens a probe (true) and logs it', async () => {
    M.net = { isConnected: true, isInternetReachable: false };
    const { locationQueueService: q } = Q();
    assert.strictEqual(await q.hasNetwork(), true);
    const log = await load('services/gpsService').getFullTrackingLog();
    assert.ok(log.some((e) => /NetInfo says unreachable — trying the API anyway \(probe\)/.test(e.msg)), 'probe logged on device log');
  });
  test('unreachable → still true inside the 15s probe window', async () => {
    M.net = { isConnected: true, isInternetReachable: false };
    const { locationQueueService: q } = Q();
    await q.hasNetwork(); M.clock += 14000;
    assert.strictEqual(await q.hasNetwork(), true);
  });
  test('unreachable → false after window, until 30s since probe', async () => {
    M.net = { isConnected: true, isInternetReachable: false };
    const { locationQueueService: q } = Q();
    await q.hasNetwork(); M.clock += 16000;
    assert.strictEqual(await q.hasNetwork(), false);
    M.clock += 13000; // 29s
    assert.strictEqual(await q.hasNetwork(), false);
  });
  test('unreachable → new probe allowed after 30s', async () => {
    M.net = { isConnected: true, isInternetReachable: false };
    const { locationQueueService: q } = Q();
    await q.hasNetwork(); M.clock += 30000;
    assert.strictEqual(await q.hasNetwork(), true);
  });
  test('real success → trusted 60s even if NetInfo says unreachable', async () => {
    const { locationQueueService: q } = Q();
    M.net = { isConnected: true, isInternetReachable: false };
    await q.hasNetwork(); M.clock += 20000;          // probe window spent
    q.markSendSucceeded(); M.clock += 59000;
    assert.strictEqual(await q.hasNetwork(), true);
    M.clock += 2000;                                 // 61s → trust expired, probe not due (<30s? no: 81s since probe → due)
    assert.strictEqual(await q.hasNetwork(), true, 'next probe due');
  });
  test('a send that just went through overrides "no radio" too (it proves a link)', async () => {
    const { locationQueueService: q } = Q();
    q.markSendSucceeded();
    M.net = { isConnected: false, isInternetReachable: false };
    assert.strictEqual(await q.hasNetwork(), true);
    M.clock += 61000; await q.hasNetwork();                  // trust over → probe opens…
    M.clock += 16000; assert.strictEqual(await q.hasNetwork(), false, '…and closes again');
  });
  test('NetInfo hangs → optimistic true after 3s timeout', async () => {
    M.netHang = true;
    const { locationQueueService: q } = Q();
    const t0 = process.hrtime.bigint();
    // real timer is used for the 3s race — keep it honest
    assert.strictEqual(await q.hasNetwork(), true);
    assert.ok(Number(process.hrtime.bigint() - t0) / 1e6 >= 2900);
  });
  test('sendLocation success marks network trusted', async () => {
    const { locationQueueService: q } = Q();
    await L().sendLocation('1', '12', { latitude: 50, longitude: 4, timestamp: new Date(M.clock).toISOString() });
    M.net = { isConnected: true, isInternetReachable: false };
    await q.hasNetwork(); // would open a probe anyway; check trust path explicitly:
    M.clock += 40000;     // probe window closed, probe not yet due (40s since first? due) -> use trust check
    assert.strictEqual(await q.hasNetwork(), true);
  });
  test('sendLocation failure does NOT mark trusted', async () => {
    M.api.mode = 'down';
    const { locationQueueService: q } = Q();
    await L().sendLocation('1', '12', { latitude: 50, longitude: 4, timestamp: new Date(M.clock).toISOString() });
    M.net = { isConnected: true, isInternetReachable: false };
    await q.hasNetwork(); M.clock += 16000;
    assert.strictEqual(await q.hasNetwork(), false);
  });
  results.push(await run('1. hasNetwork / offline probe (issue 3)'));

  // ════════════ 2. parkOtherSessions / parkQueueAsOrphans (issue 2) ════════════
  test('fresh start, empty queue → clearQueue (throttle key reset)', async () => {
    M.store.set(LASTQ, '123');
    const n = await Q().locationQueueService.parkOtherSessions('2', '12');
    assert.strictEqual(n, 0); assert.ok(!M.store.has(LASTQ)); assert.strictEqual(M.store.get(QCK), '0');
  });
  test('only this session in queue → kept untouched, nothing parked', async () => {
    setQ([fix(2, 12, 20), fix(2, 12, 10)]);
    const n = await Q().locationQueueService.parkOtherSessions('2', '12');
    assert.strictEqual(n, 0); assert.strictEqual(getQ().length, 2); assert.strictEqual(getO().length, 0);
  });
  test('mixed queue → other sessions parked, mine kept', async () => {
    setQ([fix(1, 9, 30), fix(2, 12, 20), fix(3, 5, 15), fix(2, 12, 10)]);
    const n = await Q().locationQueueService.parkOtherSessions('2', '12');
    assert.strictEqual(n, 2);
    assert.deepStrictEqual(getQ().map((f) => f.participantId), ['2', '2']);
    assert.deepStrictEqual(getO().map((f) => f.participantId).sort(), ['1', '3']);
    assert.strictEqual(M.store.get(QCK), '2');
  });
  test('same participant, different event → treated as other session', async () => {
    setQ([fix(2, 11, 20), fix(2, 12, 10)]);
    await Q().locationQueueService.parkOtherSessions('2', '12');
    assert.strictEqual(getQ().length, 1); assert.strictEqual(getO()[0].eventId, '11');
  });
  test('ids compared as strings (number vs string)', async () => {
    setQ([fix(2, 12, 10)]);
    await Q().locationQueueService.parkOtherSessions(2, 12);
    assert.strictEqual(getQ().length, 1);
  });
  test('restart same race → my orphans pulled back, sorted oldest first', async () => {
    setQ([fix(2, 12, 5)]);
    M.store.set(OK_, JSON.stringify([fix(2, 12, 60), fix(9, 9, 40), fix(2, 12, 30)]));
    await Q().locationQueueService.parkOtherSessions('2', '12');
    const q = getQ();
    assert.strictEqual(q.length, 3);
    const ts = q.map((f) => new Date(f.timestamp).getTime());
    assert.ok(ts[0] < ts[1] && ts[1] < ts[2], 'ascending');
    assert.deepStrictEqual(getO().map((f) => f.participantId), ['9']);
    assert.strictEqual(M.store.get(QCK), '3');
  });
  test('parkQueueAsOrphans → appends, clears queue, logs', async () => {
    M.store.set(OK_, JSON.stringify([fix(9, 9, 99)]));
    setQ([fix(1, 1, 3), fix(1, 1, 2)]);
    const n = await Q().locationQueueService.parkQueueAsOrphans();
    assert.strictEqual(n, 2); assert.strictEqual(getQ().length, 0); assert.strictEqual(getO().length, 3);
    assert.strictEqual(getO()[0].participantId, '9', 'existing orphans stay first');
  });
  test('orphan list capped at 2000 (oldest dropped)', async () => {
    M.store.set(OK_, JSON.stringify(Array.from({ length: 1990 }, (_, i) => fix(9, 9, 2000 - i))));
    setQ(Array.from({ length: 20 }, (_, i) => fix(1, 1, 20 - i)));
    await Q().locationQueueService.parkQueueAsOrphans();
    const o = getO();
    assert.strictEqual(o.length, 2000); assert.strictEqual(o[o.length - 1].participantId, '1');
  });
  results.push(await run('2. queue parking on Start/Stop (issue 2)'));

  // ════════════ 3. drainOrphans (issue 2) ════════════
  test('nothing parked, no session → 0, no requests', async () => {
    assert.strictEqual(await L().drainOrphans(), 0); assert.strictEqual(M.api.posted.length, 0);
  });
  test('no session → leftover live queue is parked and uploaded in order', async () => {
    setQ([fix(2, 12, 30), fix(2, 12, 20), fix(2, 12, 10)]);
    assert.strictEqual(await L().drainOrphans(), 3);
    const ts = M.api.posted.map((p) => new Date(p.body.timestamp).getTime());
    assert.ok(ts[0] < ts[1] && ts[1] < ts[2]);
    assert.strictEqual(getQ().length, 0); assert.strictEqual(getO().length, 0);
  });
  test('each fix sent with its OWN ids and is_queued=1', async () => {
    M.store.set(OK_, JSON.stringify([fix(7, 70, 5), fix(8, 80, 4)]));
    await L().drainOrphans();
    assert.deepStrictEqual(M.api.posted.map((p) => [p.body.participantId, p.body.eventId, p.body.is_queued]), [['7', '70', 1], ['8', '80', 1]]);
  });
  test('live session → its own queue untouched, other orphans sent', async () => {
    M.store.set(PARAMS, JSON.stringify({ participantId: '2', eventId: '12' }));
    setQ([fix(2, 12, 3)]);
    M.store.set(OK_, JSON.stringify([fix(1, 1, 50), fix(3, 3, 40)]));
    assert.strictEqual(await L().drainOrphans(), 2);
    assert.strictEqual(getQ().length, 1, 'live queue not parked');
  });
  test('live session → stops at an orphan of the live session (no interleave)', async () => {
    M.store.set(PARAMS, JSON.stringify({ participantId: '2', eventId: '12' }));
    M.store.set(OK_, JSON.stringify([fix(1, 1, 50), fix(2, 12, 40), fix(3, 3, 30)]));
    assert.strictEqual(await L().drainOrphans(), 1);
    assert.deepStrictEqual(getO().map((f) => f.participantId), ['2', '3']);
  });
  test('transient failure → nothing lost, retried successfully later', async () => {
    M.store.set(OK_, JSON.stringify([fix(1, 1, 3), fix(1, 1, 2)]));
    M.api.mode = 'down';
    assert.strictEqual(await L().drainOrphans(), 0); assert.strictEqual(getO().length, 2);
    M.api.mode = 'ok';
    assert.strictEqual(await L().drainOrphans(), 2); assert.strictEqual(getO().length, 0);
  });
  test('server soft-fail (success:false) → stops, keeps the rest', async () => {
    M.store.set(OK_, JSON.stringify([fix(1, 1, 3), fix(1, 1, 2)]));
    M.api.mode = 'softfail';
    assert.strictEqual(await L().drainOrphans(), 0); assert.strictEqual(getO().length, 2);
  });
  test('partial success then failure → only sent prefix removed', async () => {
    M.store.set(OK_, JSON.stringify([fix(1, 1, 5), fix(1, 1, 4), fix(1, 1, 3)]));
    let n = 0; M.api.handler = (u, b) => (++n <= 2 ? Promise.resolve({ success: true, data: {} }) : Promise.reject(Object.assign(new Error('x'), { type: 'network' })));
    assert.strictEqual(await L().drainOrphans(), 2);
    assert.strictEqual(getO().length, 1); assert.strictEqual(getO()[0].latitude, fix(1, 1, 3).latitude);
  });
  test('permanent reject → poison fix dropped, rest continue', async () => {
    M.store.set(OK_, JSON.stringify([fix(1, 1, 5), fix(1, 1, 4)]));
    let n = 0; M.api.handler = () => (++n === 1 ? Promise.reject(Object.assign(new Error('x'), { type: 'empty', code: 'participant_not_found' })) : Promise.resolve({ success: true, data: {} }));
    assert.strictEqual(await L().drainOrphans(), 1); assert.strictEqual(getO().length, 0);
  });
  test('non-permanent 4xx (e.g. unauthorized) → kept', async () => {
    M.store.set(OK_, JSON.stringify([fix(1, 1, 5)]));
    M.api.mode = 'reject'; M.api.rejectCode = 'unauthorized';
    assert.strictEqual(await L().drainOrphans(), 0); assert.strictEqual(getO().length, 1);
  });
  test('older than 47h → dropped without sending', async () => {
    M.store.set(OK_, JSON.stringify([fix(1, 1, 48 * 60), fix(1, 1, 46 * 60)]));
    assert.strictEqual(await L().drainOrphans(), 1); assert.strictEqual(M.api.posted.length, 1);
    assert.strictEqual(getO().length, 0);
  });
  test('offline (no radio) → nothing sent, nothing lost', async () => {
    M.store.set(OK_, JSON.stringify([fix(1, 1, 5)])); M.net = { isConnected: false, isInternetReachable: false }; M.api.mode = 'down';
    assert.strictEqual(await L().drainOrphans(), 0); assert.strictEqual(getO().length, 1);
  });
  test('concurrent call is a no-op (mutex) and no double send', async () => {
    M.store.set(OK_, JSON.stringify([fix(1, 1, 5), fix(1, 1, 4)]));
    const svc = L();
    const [a, b] = await Promise.all([svc.drainOrphans(), svc.drainOrphans()]);
    assert.strictEqual(a + b, 2); assert.strictEqual(M.api.posted.length, 2);
  });
  test('orphans appended DURING a drain are preserved', async () => {
    M.store.set(OK_, JSON.stringify([fix(1, 1, 5), fix(1, 1, 4)]));
    let n = 0; M.api.handler = async () => {
      if (++n === 1) { const o = getO(); o.push(fix(5, 5, 1)); M.store.set(OK_, JSON.stringify(o)); }
      return { success: true, data: {} };
    };
    await L().drainOrphans();
    assert.deepStrictEqual(getO().map((f) => f.participantId), ['5']);
  });
  test('time budget respected (stops, keeps rest)', async () => {
    M.store.set(OK_, JSON.stringify([fix(1, 1, 5), fix(1, 1, 4), fix(1, 1, 3)]));
    M.api.handler = async () => { M.clock += 20000; return { success: true, data: {} }; };
    const n = await L().drainOrphans(30000);
    assert.strictEqual(n, 2); assert.strictEqual(getO().length, 1);
  });
  // 2026-10-25: a POST whose body broke off on the way up now answers
  // request_incomplete (it used to answer participant_id_invalid, a PERMANENT
  // code). The fix itself is fine, so it must survive and go out next time.
  test('request_incomplete (upload broke off) → kept, sent on the next pass', async () => {
    M.store.set(OK_, JSON.stringify([fix(1, 1, 5)]));
    M.api.mode = 'reject'; M.api.rejectCode = 'request_incomplete';
    assert.strictEqual(await L().drainOrphans(), 0); assert.strictEqual(getO().length, 1);
    M.api.mode = 'ok';
    assert.strictEqual(await L().drainOrphans(), 1); assert.strictEqual(getO().length, 0);
  });
  test('participant_id_invalid is still permanent (why the server stopped using it for a broken upload)', async () => {
    M.store.set(OK_, JSON.stringify([fix(1, 1, 5)]));
    M.api.mode = 'reject'; M.api.rejectCode = 'participant_id_invalid';
    assert.strictEqual(await L().drainOrphans(), 0); assert.strictEqual(getO().length, 0);
  });
  results.push(await run('3. drainOrphans — leftover upload (issue 2)'));

  // ════════════ 4. processQueue regression (live drain unchanged) ════════════
  test('processQueue drains up to 50 and keeps the rest', async () => {
    setQ(Array.from({ length: 60 }, (_, i) => fix(2, 12, 60 - i)));
    assert.strictEqual(await L().processQueue('2', '12'), 50); assert.strictEqual(getQ().length, 10);
  });
  test('processQueue stops at first failure, nothing lost', async () => {
    setQ([fix(2, 12, 3), fix(2, 12, 2)]); M.api.mode = 'down';
    assert.strictEqual(await L().processQueue('2', '12'), 0); assert.strictEqual(getQ().length, 2);
  });
  test('processQueue tries the API while NetInfo says unreachable (probe) and drains', async () => {
    setQ([fix(2, 12, 3), fix(2, 12, 2)]); M.net = { isConnected: true, isInternetReachable: false };
    assert.strictEqual(await L().processQueue('2', '12'), 2);
  });
  test('stop-path loop pattern drains >50 (simulated 173 like p1652)', async () => {
    setQ(Array.from({ length: 173 }, (_, i) => fix(2, 12, 200 - i)));
    let total = 0;
    for (let i = 0; i < 10; i++) { const d = await L().processQueue('2', '12'); if (d <= 0) break; total += d; if (getQ().length === 0) break; }
    assert.strictEqual(total, 173); assert.strictEqual(getQ().length, 0);
  });
  test('request_incomplete on every pass (more than MAX_FIX_ATTEMPTS) → the fix is never discarded', async () => {
    setQ([fix(2, 12, 3), fix(2, 12, 2)]);
    M.api.mode = 'reject'; M.api.rejectCode = 'request_incomplete';
    for (let i = 0; i < 8; i++) assert.strictEqual(await L().processQueue('2', '12'), 0);
    assert.strictEqual(getQ().length, 2, 'both fixes kept');
    M.api.mode = 'ok';
    assert.strictEqual(await L().processQueue('2', '12'), 2); assert.strictEqual(getQ().length, 0);
  });
  test('participant_id_invalid on every pass → head fix discarded after MAX_FIX_ATTEMPTS (unchanged)', async () => {
    setQ([fix(2, 12, 3), fix(2, 12, 2)]);
    M.api.mode = 'reject'; M.api.rejectCode = 'participant_id_invalid';
    for (let i = 0; i < 8; i++) await L().processQueue('2', '12');
    assert.ok(getQ().length < 2, 'the permanent code still unblocks the queue');
  });
  results.push(await run('4. live queue drain regression'));

  // ════════════ 5. start ping (issue 6) ════════════
  const sleeps = [];
  const fakeSleep = async (ms) => { sleeps.push(ms); M.clock += ms; };
  const ping = (over = {}) => load('services/trackingStartService').sendTrackingStartPing({
    participantId: 2443, eventId: 12, startedAfterGun: true, isStillTracking: () => true, sleep: fakeSleep, ...over });
  test('sent on first attempt, no sleeps', async () => {
    sleeps.length = 0; assert.strictEqual(await ping(), 'sent');
    assert.strictEqual(M.axios.calls.length, 1); assert.deepStrictEqual(sleeps, []);
  });
  test('network errors → retries at 3s/10s/30s then succeeds', async () => {
    sleeps.length = 0; M.axios.script = ['network', 'network', 'network', 'ok'];
    assert.strictEqual(await ping(), 'sent'); assert.deepStrictEqual(sleeps, [3000, 10000, 30000]);
    const t = M.axios.calls.map((c) => c.at - M.axios.calls[0].at);
    assert.ok(t[3] <= 60000, 'all attempts inside the 60s server dedupe window');
  });
  test('all attempts fail → gave_up after 4', async () => {
    M.axios.script = ['network', 500, 'network', 503];
    assert.strictEqual(await ping(), 'gave_up'); assert.strictEqual(M.axios.calls.length, 4);
  });
  test('4xx (e.g. 401) → no retry', async () => {
    M.axios.script = [401];
    assert.strictEqual(await ping(), 'rejected'); assert.strictEqual(M.axios.calls.length, 1);
  });
  test('429 → retried', async () => {
    M.axios.script = [429, 'ok'];
    assert.strictEqual(await ping(), 'sent'); assert.strictEqual(M.axios.calls.length, 2);
  });
  test('runner pressed Stop before retry → no further attempts', async () => {
    let active = true; M.axios.script = ['network'];
    const p = ping({ isStillTracking: () => active, sleep: async (ms) => { active = false; } });
    assert.strictEqual(await p, 'stopped'); assert.strictEqual(M.axios.calls.length, 1);
  });
  test('missing ids → skipped, no request', async () => {
    assert.strictEqual(await ping({ participantId: null }), 'skipped'); assert.strictEqual(M.axios.calls.length, 0);
  });
  test('payload carries ids + diag (platform, app, update, perm, precise, after-gun)', async () => {
    M.perm.bg = 'denied';
    await ping();
    const b = M.axios.calls[0].body;
    assert.strictEqual(b.participantId, 2443); assert.strictEqual(b.eventId, 12);
    assert.deepStrictEqual(b.diag, { platform: 'ios', os: '26.6', app: '1.0.9', update: 'abcdef1234567890', perm: 'when_in_use', bg_perm: false, precise: 'full', started_after_gun: true });
    assert.ok(M.axios.calls[0].url.endsWith('/save_tracking_start_api.php'));
  });
  test('permission denied → diag perm:denied', async () => {
    M.perm.fg = 'denied'; await ping();
    assert.strictEqual(M.axios.calls[0].body.diag.perm, 'denied');
  });
  results.push(await run('5. start ping retry + diagnostics (issues 6, 7)'));

  // ════════════ 6. interim log upload (issue 4) ════════════
  const G = () => load('services/gpsService');
  const arm = (o = {}) => {
    const now = M.clock;
    M.store.set(PARAMS, JSON.stringify({ participantId: '2443', eventId: '12', raceStartTime: new Date(o.gun ?? now - 10 * 60000).toISOString(), manualStart: o.manual ?? 0 }));
    M.store.set('@PFSLive:sessionStartedAt', String(o.started ?? now - 20 * 60000));
    if (o.sent !== undefined) M.store.set(SENT, String(o.sent));
  };
  const logUploads = () => M.api.posted.filter((p) => p.url.includes('save_tracking_log'));
  test('0 sent, 10 min after gun → uploads once with 🩺 diagnostic line', async () => {
    arm(); await G().maybeUploadInterimLog();
    const ups = logUploads(); assert.strictEqual(ups.length, 1);
    const b = ups[0].body;
    assert.strictEqual(b.participantId, '2443'); assert.strictEqual(b.totalSent, 0);
    assert.ok(b.logs.some((e) => /No fix sent 10min after start — perm:always enabled:true/.test(e.msg)), 'diag line present');
    assert.ok(/app:1\.0\.9 upd:abcdef12/.test(b.deviceInfo), 'deviceInfo has version + update');
    assert.ok(!M.store.has('@PFSLive:logUploaded'), 'does not block the normal Stop upload');
  });
  test('second call → no second upload (one-shot)', async () => {
    arm(); await G().maybeUploadInterimLog(); await G().maybeUploadInterimLog();
    assert.strictEqual(logUploads().length, 1);
  });
  test('only 4 min after gun → nothing yet', async () => {
    arm({ gun: M.clock - 4 * 60000 }); await G().maybeUploadInterimLog();
    assert.strictEqual(logUploads().length, 0);
  });
  test('started AFTER gun → 5 min measured from session start', async () => {
    arm({ gun: M.clock - 60 * 60000, started: M.clock - 3 * 60000 }); await G().maybeUploadInterimLog();
    assert.strictEqual(logUploads().length, 0);
    M.clock += 3 * 60000; await G().maybeUploadInterimLog();
    assert.strictEqual(logUploads().length, 1);
  });
  test('before the gun → nothing', async () => {
    arm({ gun: M.clock + 10 * 60000 }); await G().maybeUploadInterimLog();
    assert.strictEqual(logUploads().length, 0);
  });
  test('healthy session (sent > 0) → no upload, never re-checked', async () => {
    arm({ sent: 5 }); await G().maybeUploadInterimLog();
    assert.strictEqual(logUploads().length, 0); assert.strictEqual(M.store.get('@PFSLive:interimLogUploaded'), '1');
  });
  test('race finished → nothing', async () => {
    arm(); M.store.set('@PFSLive:raceFinished', '1'); await G().maybeUploadInterimLog();
    assert.strictEqual(logUploads().length, 0);
  });
  test('no session → nothing', async () => {
    await G().maybeUploadInterimLog(); assert.strictEqual(logUploads().length, 0);
  });
  test('manual_start → measured from session start', async () => {
    arm({ manual: 1, gun: M.clock + 99 * 60000, started: M.clock - 6 * 60000 }); await G().maybeUploadInterimLog();
    assert.strictEqual(logUploads().length, 1);
  });
  test('upload fails → key released, succeeds on a later call', async () => {
    arm();
    M.api.handler = () => Promise.reject(Object.assign(new Error('x'), { type: 'network' }));
    await G().maybeUploadInterimLog();
    assert.ok(!M.store.has('@PFSLive:interimLogUploaded'));
    M.api.handler = null; await G().maybeUploadInterimLog();
    assert.strictEqual(logUploads().length, 0, 'no retry inside the 5-min spacing');
    M.clock += 5 * 60000; await G().maybeUploadInterimLog();
    assert.strictEqual(logUploads().length, 1);
  });
  // ── Grizzly100 pre-race (2026-10-23): offline phones over an 18 h race ──
  const interimAttempts = () => { const a = { n: 0 }; M.api.handler = (url) => { if (url.includes('save_tracking_log')) a.n++; return Promise.reject(Object.assign(new Error('Network Error'), { type: 'network' })); }; return a; };
  test('Grizzly100: dead network for 1 h (heartbeat 60 s + Home 10 s timer) → ≤ 1 attempt per 5 min, not one per call', async () => {
    arm();
    M.net = { isConnected: false, isInternetReachable: false };
    const a = interimAttempts();
    for (let s = 0; s < 3600; s += 10) { await G().maybeUploadInterimLog(); M.clock += 10000; }   // 360 calls
    assert.ok(a.n >= 1 && a.n <= 13, `bounded attempts: ${a.n} in 1 h (was one per call)`);
    const log = await G().getFullTrackingLog();
    assert.strictEqual(log.filter((e) => e.icon === '🩺').length, a.n, 'one 🩺 line per real attempt, no more');
    assert.ok(!M.store.has('@PFSLive:interimLogUploaded'), 'never claimed for good while it fails');
  });
  test('Grizzly100: network back after the outage → the interim log goes out within the 5-min spacing', async () => {
    arm();
    M.net = { isConnected: false, isInternetReachable: false };
    interimAttempts();
    await G().maybeUploadInterimLog();                  // fails, spacing starts
    M.net = { isConnected: true, isInternetReachable: true }; M.api.handler = null;
    await G().maybeUploadInterimLog();
    assert.strictEqual(logUploads().length, 0, 'still inside the spacing');
    M.clock += 5 * 60000; await G().maybeUploadInterimLog();
    assert.strictEqual(logUploads().length, 1);
    M.clock += 5 * 60000; await G().maybeUploadInterimLog();
    assert.strictEqual(logUploads().length, 1, 'once only');
  });
  test('p2595 pattern: NetInfo stuck "unreachable" in background on a WORKING network → a silent session still uploads its interim log', async () => {
    arm();
    M.net = { isConnected: true, isInternetReachable: false };
    await G().maybeUploadInterimLog();
    assert.strictEqual(logUploads().length, 1, 'the probe lets the diagnostic through');
  });
  test('healthy session (sent > 0) offline → no network check, no attempt, marked done (unchanged)', async () => {
    arm({ sent: 5 });
    M.net = { isConnected: false, isInternetReachable: false };
    const a = interimAttempts();
    await G().maybeUploadInterimLog();
    assert.strictEqual(a.n, 0);
    assert.strictEqual(M.store.get('@PFSLive:interimLogUploaded'), '1');
  });
  results.push(await run('6. interim log upload for silent sessions (issue 4)'));

  // ════════════ 7. version + i18n + static checks (issues 5, 7) ════════════
  test('APP_CONFIG.VERSION = installed binary version (not "1.0.2")', async () => {
    setRealConfig(true);
    try { M.appVersion = '1.0.9'; assert.strictEqual(load('constants/config').APP_CONFIG.VERSION, '1.0.9'); }
    finally { setRealConfig(false); }
  });
  test('APP_CONFIG.VERSION falls back to "unknown" when native value missing', async () => {
    setRealConfig(true);
    try { M.appVersion = null; assert.strictEqual(load('constants/config').APP_CONFIG.VERSION, 'unknown'); }
    finally { setRealConfig(false); M.appVersion = '1.0.9'; }
  });
  test('pre-gun Stop strings exist and are non-empty in en/fr/nl', async () => {
    for (const l of ['en', 'fr', 'nl']) {
      const j = JSON.parse(fs.readFileSync(`${SRC}/i18n/HomeScreen/${l}.json`, 'utf8'));
      for (const k of ['stopBeforeStartTitle', 'stopBeforeStartMessage', 'keepTracking', 'stopAnyway']) {
        assert.ok(typeof j.alerts[k] === 'string' && j.alerts[k].length > 2, `${l}.alerts.${k}`);
      }
    }
  });
  test('HomeScreen wiring: Stop button → confirmStopTracking; ping via service; orphan drain on foreground', async () => {
    const s = fs.readFileSync(`${SRC}/screens/HomeScreen.tsx`, 'utf8');
    assert.ok(/onPress=\{isGPSActive \? confirmStopTracking : confirmStartTracking\}/.test(s));
    // 2026-10-18 (M4): Stop is confirmed after the gun too — no one-tap path left.
    assert.ok(!/if \(hasRaceStarted\(\)\) \{\s*void stopGPSTracking\(\);/.test(s), 'no immediate post-gun stop');
    assert.ok(/sendTrackingStartPing\(\{/.test(s));
    // 2026-10-18 (L8): the foreground orphan drain goes through drainIfIdle (skipped while a session is live).
    assert.ok(/s === 'active'\) void drainIfIdle\(\)/.test(s));
    assert.ok(/const drainIfIdle = async \(\) => \{\s*try \{ if \(await isTracking\(\)\) return;/.test(s));
    assert.ok(/void maybeUploadInterimLog\(\)/.test(s));
    assert.ok(s.indexOf('const confirmStopTracking') > s.indexOf('const stopGPSTracking'), 'declared after stopGPSTracking (no TDZ)');
    // 2026-10-18 (M2): Stop drains under the RUNNING session's ids, not home's.
    assert.ok(/await locationService\.drainForStop\(stopParticipantId, stopEventId\)/.test(s), 'Stop uses the looping drainForStop');
  });
  test('gpsService no longer wipes the queue on a fresh start', async () => {
    const s = fs.readFileSync(`${SRC}/services/gpsService.ts`, 'utf8');
    assert.ok(/parkOtherSessions\(String\(participantId\), String\(eventId\)\)/.test(s));
    assert.ok(!/if \(!_hadPriorSession\) \{\s*try \{\s*const \{ locationQueueService \}[^}]*clearQueue/.test(s));
  });
  results.push(await run('7. version, translations, wiring (issues 5, 7)'));

  // ════════════ 8. drainForStop — the Stop button's drain (issue 2) ════════════
  const FAST = 5; // busy-wait ms in tests
  test('173 queued (p1652) → all sent on Stop, queue empty', async () => {
    setQ(Array.from({ length: 173 }, (_, i) => fix(2, 12, 200 - i)));
    assert.strictEqual(await L().drainForStop('2', '12', 30000, FAST), 173);
    assert.strictEqual(getQ().length, 0); assert.strictEqual(M.api.posted.length, 173);
  });
  test('sent strictly oldest → newest', async () => {
    setQ(Array.from({ length: 120 }, (_, i) => fix(2, 12, 200 - i)));
    await L().drainForStop('2', '12', 30000, FAST);
    const ts = M.api.posted.map((p) => new Date(p.body.timestamp).getTime());
    assert.ok(ts.every((t, i) => i === 0 || ts[i - 1] < t));
  });
  test('network fails mid-way → stops, rest kept (not lost)', async () => {
    setQ(Array.from({ length: 120 }, (_, i) => fix(2, 12, 200 - i)));
    let n = 0; M.api.handler = (u, b) => (++n <= 70 ? (M.api.posted.push({ u, body: b }), Promise.resolve({ success: true, data: {} })) : Promise.reject(Object.assign(new Error('x'), { type: 'network' })));
    assert.strictEqual(await L().drainForStop('2', '12', 30000, FAST), 70);
    assert.strictEqual(getQ().length, 50);
  });
  test('offline at Stop → 0 sent, all kept', async () => {
    setQ([fix(2, 12, 3), fix(2, 12, 2)]); M.net = { isConnected: false, isInternetReachable: false }; M.api.mode = 'down';
    assert.strictEqual(await L().drainForStop('2', '12', 30000, FAST), 0); assert.strictEqual(getQ().length, 2);
  });
  test('time budget respected', async () => {
    setQ(Array.from({ length: 150 }, (_, i) => fix(2, 12, 200 - i)));
    M.api.handler = async (u, b) => { M.clock += 400; M.api.posted.push({ u, body: b }); return { success: true, data: {} }; };
    const n = await L().drainForStop('2', '12', 30000, FAST);
    assert.ok(n >= 50 && n < 150, `stopped by budget (sent ${n})`); assert.strictEqual(getQ().length, 150 - n);
  });
  test('mutex busy (-1) → waits and retries, then drains', async () => {
    setQ([fix(2, 12, 3), fix(2, 12, 2)]);
    const svc = L(); const real = svc.processQueue.bind(svc); let calls = 0;
    svc.processQueue = async (...a) => (++calls === 1 ? -1 : real(...a));
    assert.strictEqual(await svc.drainForStop('2', '12', 30000, FAST), 2); assert.ok(calls >= 2);
  });
  test('empty queue → returns 0 immediately', async () => {
    assert.strictEqual(await L().drainForStop('2', '12', 30000, FAST), 0); assert.strictEqual(M.api.posted.length, 0);
  });
  results.push(await run('8. drainForStop — Stop drains everything (issue 2)'));

  // ════════════ 9. gpsService wiring, exercised for real (issues 2, 4) ════════════
  const startSession = async (pid = '2', eid = '12', raceStartIso = new Date(M.clock - 60 * 60000).toISOString()) => {
    const { gpsService } = load('services/gpsService');
    return gpsService.startWatchingPosition(() => {}, () => {}, 30, pid, eid, 't', 'b', 59, raceStartIso, 0, 'Test race');
  };
  test('fresh Start keeps THIS race\'s queued fixes, parks other races\' (no wipe)', async () => {
    setQ([fix(1, 9, 90), fix(2, 12, 30), fix(3, 5, 20)]);
    await startSession('2', '12');
    assert.deepStrictEqual(getQ().map((f) => f.participantId), ['2']);
    assert.deepStrictEqual(getO().map((f) => f.participantId).sort(), ['1', '3']);
  });
  test('fresh Start pulls this race\'s parked fixes back into the queue', async () => {
    M.store.set(OK_, JSON.stringify([fix(2, 12, 50), fix(2, 12, 40)]));
    await startSession('2', '12');
    assert.strictEqual(getQ().length, 2); assert.strictEqual(getO().length, 0);
  });
  test('fresh Start arms the interim-log check (session start stamped, flag cleared)', async () => {
    M.store.set('@PFSLive:interimLogUploaded', '1');
    await startSession();
    assert.ok(!M.store.has('@PFSLive:interimLogUploaded'));
    assert.strictEqual(M.store.get('@PFSLive:sessionStartedAt'), String(M.clock));
  });
  test('heartbeat after the gun with 0 sent → interim log uploaded', async () => {
    await startSession();
    assert.ok(typeof M.bg.heartbeat === 'function', 'heartbeat listener registered');
    M.clock += 6 * 60000;
    await M.bg.heartbeat({});
    assert.strictEqual(M.api.posted.filter((p) => p.url.includes('save_tracking_log')).length, 1);
  });
  test('heartbeat BEFORE the gun → no interim upload', async () => {
    await startSession('2', '12', new Date(M.clock + 60 * 60000).toISOString());
    M.clock += 6 * 60000;
    await M.bg.heartbeat({});
    assert.strictEqual(M.api.posted.filter((p) => p.url.includes('save_tracking_log')).length, 0);
  });
  results.push(await run('9. gpsService wiring — real start + heartbeat (issues 2, 4)'));

  // ════════════ 10. incident replays (from the 2026-10-07 audit) ════════════
  test('p2699 (Dinant): 173 queued, Stop while offline → nothing lost; uploaded on next app open', async () => {
    setQ(Array.from({ length: 173 }, (_, i) => fix(2699, 12, 120 - i * 0.5)));
    M.net = { isConnected: false, isInternetReachable: false }; M.api.mode = 'down';
    assert.strictEqual(await L().drainForStop('2699', '12', 30000, FAST), 0);
    // session ends (params cleared by the real stop) → leftovers parked, still offline
    assert.strictEqual(await L().drainOrphans(), 0); assert.strictEqual(getO().length + getQ().length, 173);
    // later: app opened with network
    M.net = { isConnected: true, isInternetReachable: true }; M.api.mode = 'ok'; M.clock += 3600000;
    let sent = 0; for (let i = 0; i < 10 && (getO().length || getQ().length); i++) sent += await L().drainOrphans(45000);
    assert.strictEqual(sent, 173); assert.strictEqual(M.api.posted.length, 173);
    assert.ok(M.api.posted.every((p) => p.body.participantId === '2699' && p.body.is_queued === 1));
  });
  test('p1652 (Kemmelberg): Stop with 173 queued, then Start again same race → leftovers sent FIRST', async () => {
    setQ(Array.from({ length: 173 }, (_, i) => fix(2, 9, 200 - i)));
    M.net = { isConnected: false, isInternetReachable: false }; M.api.mode = 'down';
    await L().drainForStop('2', '9', 30000, FAST);
    await L().drainOrphans();                     // parks them (no session)
    M.net = { isConnected: true, isInternetReachable: true }; M.api.mode = 'ok';
    await startSession('2', '9');                 // runner restarts the same race
    assert.strictEqual(getQ().length, 173, 'back in the live queue, ahead of new fixes');
    assert.strictEqual(await L().drainForStop('2', '9', 30000, FAST), 173);
  });
  test('p2595 (Dinant): NetInfo stuck "unreachable" 2.5h while API works → fixes still go out ≤30s', async () => {
    M.net = { isConnected: true, isInternetReachable: false };
    const svc = L(); let maxLagMs = 0;
    for (let t = 0; t < 20 * 60; t += 10) {            // 20 minutes, 10s queue-processor ticks
      setQ(getQ().concat([fix(2595, 12, 0)]));          // one new fix per tick
      await svc.processQueue('2595', '12');
      const oldest = getQ()[0]; if (oldest) maxLagMs = Math.max(maxLagMs, M.clock - new Date(oldest.timestamp).getTime());
      M.clock += 10000;
    }
    assert.ok(M.api.posted.length >= 100, `sent ${M.api.posted.length} of 120`);
    assert.ok(maxLagMs <= 30000, `oldest unsent fix never older than 30s (was ${maxLagMs / 1000}s)`);
  });
  test('p4789 (event 19): NetInfo stuck "no connection" all race while the API works → fixes still go out ≤30s', async () => {
    M.net = { isConnected: false, isInternetReachable: false, type: 'none' };
    const svc = L(); let maxLagMs = 0;
    for (let t = 0; t < 20 * 60; t += 10) {
      setQ(getQ().concat([fix(4789, 19, 0)]));
      await svc.processQueue('4789', '19');
      const oldest = getQ()[0]; if (oldest) maxLagMs = Math.max(maxLagMs, M.clock - new Date(oldest.timestamp).getTime());
      M.clock += 10000;
    }
    assert.ok(M.api.posted.length >= 100, `sent ${M.api.posted.length} of 120`);
    assert.ok(maxLagMs <= 30000, `oldest unsent fix never older than 30s (was ${maxLagMs / 1000}s)`);
  });
  test('Dinant DB outage: API down 47s mid-race → fixes held, all delivered after, none lost', async () => {
    const svc = L(); const outageFrom = 6, outageTo = 11; // ticks (10s) → ~50s
    for (let tick = 0; tick < 20; tick++) {
      M.api.mode = (tick >= outageFrom && tick < outageTo) ? 'down' : 'ok';
      setQ(getQ().concat([fix(2600, 12, 0)]));
      await svc.processQueue('2600', '12');
      M.clock += 10000;
    }
    assert.strictEqual(getQ().length, 0); assert.strictEqual(M.api.posted.length, 20);
  });
  test('Silent session (start ping, nothing else): device log reaches the server 5 min after the gun', async () => {
    await startSession('2142', '13', new Date(M.clock - 1 * 60000).toISOString()); // started 1 min after gun
    for (let m = 0; m < 10; m++) { M.clock += 60000; await M.bg.heartbeat({}); }
    const ups = M.api.posted.filter((p) => p.url.includes('save_tracking_log'));
    assert.strictEqual(ups.length, 1); assert.strictEqual(ups[0].body.participantId, '2142');
    assert.ok(ups[0].body.logs.some((e) => /No fix sent \d+min after start — perm:/.test(e.msg)));
  });
  results.push(await run('10. incident replays (p2699, p1652, p2595, Dinant outage, silent session)'));

  // ════════════ 11. the device test plan, automated ════════════
  // The demo-server checklist (2026-10-08), one row each, against the REAL code.
  // Rows already covered above: #3 → p2699 replay + group 8, #4 → p1652 replay +
  // group 9, #5 → group 5, #6 → group 6 + silent replay. Rows 7 and 9 are
  // server-side (tests/tracking_api sections 3 and 7), row 8 is
  // activationCard.test.ts + server section 9.
  test('#1 normal Stop log upload → deviceInfo "ios 26.6 app:1.0.9 upd:abcdef12"', async () => {
    const ok = await L().saveTrackingLog('2443', '12', [{ ts: M.clock, icon: '🛑', msg: 'Stop' }], 42, 0);
    assert.strictEqual(ok, true);
    const b = M.api.posted.find((p) => p.url.includes('save_tracking_log')).body;
    assert.strictEqual(b.deviceInfo, 'ios 26.6 app:1.0.9 upd:abcdef12');
    assert.strictEqual(b.totalSent, 42);
  });
  test('#1 build with no OTA update yet → "upd:embedded", never undefined', async () => {
    M.updateId = null;
    try {
      await L().saveTrackingLog('2443', '12', [], 0, 0);
      assert.strictEqual(M.api.posted[0].body.deviceInfo, 'ios 26.6 app:1.0.9 upd:embedded');
    } finally { M.updateId = 'abcdef1234567890'; }
  });
  test('#1 log upload failure → returns false (caller retries), never throws', async () => {
    M.api.mode = 'down';
    assert.strictEqual(await L().saveTrackingLog('2443', '12', [], 0, 0), false);
  });

  // #2 runs HomeScreen's own confirmStopTracking / hasRaceStarted bodies, lifted
  // out of the source, so a change to the real code is what gets tested.
  const home = fs.readFileSync(`${SRC}/screens/HomeScreen.tsx`, 'utf8');
  const bodyOf = (re) => { const m = home.match(re); assert.ok(m, 'function found in HomeScreen.tsx: ' + re); return m[1]; };
  // Looked up inside each test (not here), so code without the function fails
  // those tests instead of crashing the whole run.
  const confirmBody = () => bodyOf(/const confirmStopTracking = useCallback\(\(\) => \{([\s\S]*?)\n  \}, \[hasRaceStarted\]\);/);
  const yesBody = () => bodyOf(/const handleStopConfirmYes = useCallback\(\(\) => \{([\s\S]*?)\n  \}, \[stopGPSTracking\]\);/);
  const noBody = () => bodyOf(/const handleStopConfirmNo = useCallback\(\(\) => \{([\s\S]*?)\n  \}, \[\]\);/);
  const startedBody = () => bodyOf(/const hasRaceStarted = useCallback\(\(\): boolean => \{([\s\S]*?)\n  \}, \[homeData\?\.manual_start\]\);/);
  // Runs the real bodies: Stop opens the popup (mode), the two buttons close it.
  const confirmStop = (started) => {
    const calls = { stop: 0, modes: [] };
    const setMode = (m) => calls.modes.push(m);
    const stopFn = () => { calls.stop++; return Promise.resolve(); };
    new Function('hasRaceStarted', 'setStopConfirmMode', confirmBody())(() => started, setMode);
    calls.yes = () => new Function('setStopConfirmMode', 'stopGPSTracking', yesBody())(setMode, stopFn);
    calls.no = () => new Function('setStopConfirmMode', noBody())(setMode);
    return calls;
  };
  const raceStarted = (homeData, start) =>
    new Function('homeData', 'raceStartTimeRef', startedBody())(homeData, { current: start });

  test('#2 Stop BEFORE the gun → confirmation popup (pre-gun copy), tracking keeps running', async () => {
    const c = confirmStop(false);
    assert.strictEqual(c.stop, 0, 'not stopped yet');
    assert.deepStrictEqual(c.modes, ['before']);
  });
  test('#2 "Keep tracking" → popup closes, nothing stopped; "Stop anyway" → closes and stops once', async () => {
    const c = confirmStop(false);
    c.no();
    assert.deepStrictEqual(c.modes, ['before', null]); assert.strictEqual(c.stop, 0);
    c.yes();
    assert.deepStrictEqual(c.modes, ['before', null, null]); assert.strictEqual(c.stop, 1);
  });
  // Changed 2026-10-18 (M4): post-gun Stop used to be one tap and irreversible.
  test('#2 Stop AFTER the gun → confirmation popup with post-gun copy, not stopped until confirmed', async () => {
    const c = confirmStop(true);
    assert.strictEqual(c.stop, 0, 'not stopped yet'); assert.deepStrictEqual(c.modes, ['after']);
    c.yes();
    assert.strictEqual(c.stop, 1);
  });
  // 2026-10-19: the confirm was a native Alert.alert, unlike every other popup.
  test('#2 Stop popup is the app\'s own notif modal (not Alert), copy + buttons wired', async () => {
    assert.ok(!/confirmStopTracking[\s\S]{0,200}Alert\.alert/.test(home), 'no Alert.alert in the stop confirm');
    const m = home.match(/<Modal[^>]*?visible=\{stopConfirmMode !== null\}[\s\S]*?<\/Modal>/);
    assert.ok(m, 'Modal bound to stopConfirmMode');
    const jsx = m[0];
    for (const k of ['homeStyles.notifCard', 'home:alerts.stopAfterStartTitle', 'home:alerts.stopBeforeStartTitle',
      'home:alerts.stopAfterStartMessage', 'home:alerts.stopBeforeStartMessage', 'home:alerts.keepTracking', 'home:alerts.stopAnyway',
      'onRequestClose={handleStopConfirmNo}']) assert.ok(jsx.includes(k), 'modal has ' + k);
    assert.ok(/onPress=\{handleStopConfirmNo\}[\s\S]*?home:alerts\.keepTracking/.test(jsx), 'Keep tracking → No handler');
    assert.ok(/onPress=\{handleStopConfirmYes\}[\s\S]*?home:alerts\.stopAnyway/.test(jsx), 'Stop anyway → Yes handler');
    const styles = fs.readFileSync(`${SRC}/styles/home.styles.ts`, 'utf8');
    for (const k of ['notifIconWrapperDanger', 'notifDangerButton', 'notifDangerText']) assert.ok(styles.includes(k + ':'), 'style ' + k);
  });
  // Bodies lifted from HomeScreen.tsx (CR-stripped) and run with stand-ins.
  const homeLF = home.replace(/\r/g, '');
  const cb = (name, deps) => {
    const re = new RegExp('const ' + name + ' = useCallback\\(\\(([^)]*)\\) => \\{([\\s\\S]*?)\\n  \\}, \\[' + deps + '\\]\\);');
    const m = homeLF.match(re); assert.ok(m, name + ' found'); return { params: m[1], body: m[2] };
  };
  const modalJsx = (visible) => {
    const esc = visible.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const m = homeLF.match(new RegExp('<Modal[^>]*?visible=\\{' + esc + '\\}[\\s\\S]*?</Modal>'));
    assert.ok(m, 'Modal bound to ' + visible); return m[0];
  };
  test('#2 popups close by themselves when tracking ends while open (Stop: no second stop; override: no late Start Now)', async () => {
    const m = homeLF.match(/useEffect\(\(\) => \{\n    if \(!isGPSActive\) \{([\s\S]*?)\n    \}\n  \}, \[isGPSActive\]\);/);
    assert.ok(m, 'auto-close effect present');
    const run = (active) => {
      const calls = [];
      new Function('isGPSActive', 'setStopConfirmMode', 'setShowOverrideModal', 'if (!isGPSActive) {' + m[1] + '}')(
        active, (x) => calls.push(['stop', x]), (x) => calls.push(['override', x]));
      return calls;
    };
    assert.deepStrictEqual(run(false), [['stop', null], ['override', false]]);
    assert.deepStrictEqual(run(true), [], 'nothing closed while tracking runs');
  });

  // ── 2026-10-19: the last three Home popups moved off Alert.alert ──
  test('Home has no native Alert left (every popup is the notif modal)', async () => {
    assert.ok(!/Alert\.alert\(/.test(homeLF), 'no Alert.alert');
    assert.ok(!/^\s*Alert,$/m.test(homeLF), 'Alert no longer imported');
    for (const v of ['showStartConfirmModal', 'stopConfirmMode !== null', 'startErrorMessage !== null', 'showOverrideModal', 'showEarlyTrackingModal'])
      assert.ok(modalJsx(v).includes('homeStyles.notifCard'), v + ' uses notifCard');
  });
  test('start failure: error text shown in the popup with one OK button; OK closes it', async () => {
    assert.ok(/setStartErrorMessage\(error instanceof Error \? error\.message : t\('home:errors\.trackingFailed'\)\);/.test(homeLF), 'error → popup');
    const jsx = modalJsx('startErrorMessage !== null');
    assert.ok(jsx.includes("t('common:errors.generic')") && jsx.includes('{startErrorMessage}'), 'title + message');
    assert.strictEqual((jsx.match(/<TouchableOpacity/g) || []).length, 1, 'one button');
    assert.ok(/onPress=\{handleStartErrorClose\}[\s\S]*?t\('common:ok'\)/.test(jsx), 'OK closes');
    assert.ok(jsx.includes('onRequestClose={handleStartErrorClose}'), 'back closes');
    const c = cb('handleStartErrorClose', ''); const set = [];
    new Function('setStartErrorMessage', c.body)((x) => set.push(x));
    assert.deepStrictEqual(set, [null]);
    for (const l of ['en', 'fr', 'nl']) {
      const j = JSON.parse(fs.readFileSync(`${SRC}/i18n/common/${l}.json`, 'utf8'));
      assert.ok(j.ok && j.errors && j.errors.generic, `${l}: common ok + errors.generic`);
    }
  });
  // The real catch of the start flow, run with stand-ins.
  const runStartCatch = (error, notifyFails = false) => {
    // growth_v0.1: the catch also logs the start step; its finally also releases startingRef
    const m = homeLF.match(/\n    \} catch \(error\) \{\n      void analyticsService\.logStartStep\('failed', 'exception', raceReadyKey\);\n      setIsGPSActive\(false\);([\s\S]*?)\n    \} finally \{\n      void gpsService\.endStartWindow\(startWindow\);\n      \/\/[^\n]*\n      if \(startingAtRef\.current === startedAt\) startingRef\.current = false;\n    \}\n  \}, \[\n    hasPermission,/);
    assert.ok(m, 'start catch found');
    const out = { pending: { current: false }, pendingAt: { current: 0 }, toasts: [], notes: [], errorMsg: undefined, active: [], stored: {} };
    const Notifications = { scheduleNotificationAsync: (req) => { out.notes.push(req); return notifyFails ? Promise.reject(new Error('x')) : Promise.resolve('id'); } };
    const AsyncStorageStub = { setItem: async (k, v) => { out.stored[k] = v; } };
    new Function('error', 'setIsGPSActive', 'isGPSActiveRef', 'START_BACKGROUNDED_CODE', 'pendingStartRef', 'toastError', 't', 'Notifications', 'setStartErrorMessage',
      'AsyncStorage', 'PENDING_BG_START_KEY', 'homeData', 'participantId', 'eventId', 'pendingStartAtRef',
      'setIsGPSActive(false);' + m[1].replace(/\(error as any\)/g, 'error'))(
      error, (x) => out.active.push(x), { current: true }, 'start_backgrounded', out.pending,
      (a, b) => out.toasts.push([a, b]), (k) => k, Notifications, (x) => { out.errorMsg = x; },
      AsyncStorageStub, '@PFSLive:pendingBgStart', { next_race_participant_app_id: '4807', next_race_id: '19' }, 'x', 'y', out.pendingAt);
    return out;
  };
  test('start in a pocket (Android backgrounded): re-armed, toast AND a notification, never the error popup', async () => {
    const o = runStartCatch(Object.assign(new Error('App did not return to foreground in time'), { code: 'start_backgrounded' }));
    assert.strictEqual(o.pending.current, true, 'start re-armed for the next foreground');
    assert.ok(o.pendingAt.current > 0, 'growth: the re-arm is stamped (15-min limit)');
    assert.deepStrictEqual(o.toasts, [['home:errors.trackingFailed', 'home:tracking.reopenToStart']]);
    assert.strictEqual(o.notes.length, 1, 'one notification');
    assert.deepStrictEqual(o.notes[0], { content: { title: 'home:tracking.notStartedTitle', body: 'home:tracking.notStartedBody', data: { type: 'start_backgrounded' } }, trigger: null });
    assert.strictEqual(o.errorMsg, undefined, 'no error popup');
    assert.deepStrictEqual(o.active, [false]);
    const saved = JSON.parse(o.stored['@PFSLive:pendingBgStart'] || 'null');
    assert.ok(saved && saved.participantId === '4807' && saved.eventId === '19' && typeof saved.at === 'number', 're-arm persisted for a killed process');
  });
  test('backgrounded start: a failing notification is swallowed (no unhandled rejection, start still armed)', async () => {
    let unhandled = null; const h = (e) => { unhandled = e; };
    process.on('unhandledRejection', h);
    const o = runStartCatch(Object.assign(new Error('bg'), { code: 'start_backgrounded' }), true);
    await new Promise((r) => setTimeout(r, 20));
    process.off('unhandledRejection', h);
    assert.strictEqual(unhandled, null); assert.strictEqual(o.pending.current, true);
  });
  test('any other start error: error popup, no notification, not re-armed', async () => {
    const o = runStartCatch(new Error('boom'));
    assert.strictEqual(o.errorMsg, 'boom'); assert.strictEqual(o.notes.length, 0); assert.strictEqual(o.pending.current, false);
    assert.deepStrictEqual(o.stored, {}, 'nothing persisted');
    assert.strictEqual(runStartCatch('weird').errorMsg, 'home:errors.trackingFailed');
  });
  test('Start popup tells the runner to keep Livio on screen 5 s, in the amber box, before the buttons', async () => {
    const jsx = modalJsx('showStartConfirmModal');
    const iBody = jsx.indexOf("t('home:startConfirm.message')");
    const iKeep = jsx.indexOf("<Text style={homeStyles.notifKeepOpenText}>{t('home:startConfirm.keepOpen')}</Text>");
    const iBox = jsx.indexOf('<View style={[homeStyles.notifKeepOpenBox');   // + compact variant in landscape
    const iButtons = jsx.indexOf('homeStyles.notifButtonContainer');
    assert.ok(iBody > 0 && iBox > iBody && iKeep > iBox && iButtons > iKeep, 'message → amber box → buttons');
    // The keep-open line itself is unconditional; only the 2026-10-24 extra line
    // under it (do not swipe away / do not let it sleep) differs per platform.
    const withoutPlatformLine = jsx.replace(/\{t\(Platform\.OS === 'ios' \? 'home:startConfirm\.dontCloseIos' : 'home:startConfirm\.dontCloseAndroid'\)\}/, '');
    assert.ok(!/Platform\.OS/.test(withoutPlatformLine), 'shown on both platforms');
    const st = fs.readFileSync(`${SRC}/styles/home.styles.ts`, 'utf8').replace(/\r/g, '');
    // growth_v0.1: the branch's amber note tokens, not master's hex values
    assert.ok(/notifKeepOpenBox: \{\s*backgroundColor: palette\.warningBg,\s*borderWidth: 1,\s*borderColor: palette\.warningBorder,/.test(st), 'amber note background + border');
    assert.ok(/notifKeepOpenText: \{[^}]*color: palette\.warningText,/.test(st), 'readable amber copy');
    const gps = { en: 'GPS activated', fr: 'GPS Activé', nl: 'GPS Geactiveerd' };
    for (const l of ['en', 'fr', 'nl']) {
      const j = JSON.parse(fs.readFileSync(`${SRC}/i18n/HomeScreen/${l}.json`, 'utf8'));
      const k = j.startConfirm.keepOpen;
      assert.ok(typeof k === 'string' && /\b5\b/.test(k), l + ': keepOpen says 5 seconds');
      assert.strictEqual(j.tracking.gpsActivated, gps[l], l + ': toast label');
      assert.ok(k.includes(gps[l]), l + ': keepOpen quotes the real toast title "' + gps[l] + '"');
      for (const n of ['notStartedTitle', 'notStartedBody']) assert.ok(typeof j.tracking[n] === 'string' && j.tracking[n].length > 10, l + ': ' + n);
    }
  });
  test('manual override: button opens popup; "Start Now" → sending on + toast; "Cancel" → nothing', async () => {
    const open = cb('manualStartSending', ''); const shown = [];
    new Function('setShowOverrideModal', open.body)((x) => shown.push(x));
    assert.deepStrictEqual(shown, [true]);
    const yes = cb('handleOverrideConfirm', 't');
    const st = { shown: [], sending: [], toasts: 0 }; const ref = { current: false };
    new Function('setShowOverrideModal', 'isSendingDataRef', 'setIsSendingData', 'toastSuccess', 't', yes.body)(
      (x) => st.shown.push(x), ref, (x) => st.sending.push(x), () => st.toasts++, (k) => k);
    assert.deepStrictEqual([st.shown, ref.current, st.sending, st.toasts], [[false], true, [true], 1]);
    const no = cb('handleOverrideCancel', ''); const n = [];
    new Function('setShowOverrideModal', no.body)((x) => n.push(x));
    assert.deepStrictEqual(n, [false]);
    const jsx = modalJsx('showOverrideModal');
    assert.ok(/onPress=\{handleOverrideConfirm\}[\s\S]*?home:alerts\.startNow/.test(jsx), 'Start Now wired');
    assert.ok(/onPress=\{handleOverrideCancel\}[\s\S]*?home:alerts\.cancel/.test(jsx), 'Cancel wired');
    assert.ok(jsx.includes('home:alerts.overrideTitle') && jsx.includes('home:alerts.overrideMessage') && jsx.includes('onRequestClose={handleOverrideCancel}'));
    for (const l of ['en', 'fr', 'nl']) {
      const j = JSON.parse(fs.readFileSync(`${SRC}/i18n/HomeScreen/${l}.json`, 'utf8'));
      for (const k of ['overrideTitle', 'overrideMessage', 'startNow', 'cancel']) assert.ok(j.alerts[k], `${l}.alerts.${k}`);
    }
  });
  test('#2 "has the race started": before/after gun, unknown start, manual start', async () => {
    const now = Date.now();
    assert.strictEqual(raceStarted({ manual_start: 0 }, new Date(now + 10 * 60000)), false, '10 min before gun');
    assert.strictEqual(raceStarted({ manual_start: 0 }, new Date(now - 1000)), true, 'after gun');
    assert.strictEqual(raceStarted({ manual_start: 0 }, null), false, 'start time unknown → ask');
    assert.strictEqual(raceStarted({ manual_start: 1 }, new Date(now + 10 * 60000)), true, 'manual start → no dialog');
  });

  test('#6 location OFF + permission denied → 🩺 line carries both, uploaded without Stop', async () => {
    M.perm = { fg: 'denied', bg: 'denied', iosAccuracy: 'full' };
    M.provider = { enabled: false, gps: false, network: false, status: 0 };
    arm(); await G().maybeUploadInterimLog();
    const ups = logUploads(); assert.strictEqual(ups.length, 1);
    const line = ups[0].body.logs.find((e) => e.icon === '🩺');
    assert.ok(line, '🩺 line present');
    assert.ok(/perm:denied/.test(line.msg), line.msg);
    assert.ok(/enabled:false gps:false/.test(line.msg), line.msg);
    assert.ok(!M.store.has('@PFSLive:logUploaded'), 'the normal Stop upload still happens later');
  });
  test('#6 "when in use" only (no background permission) → perm:when_in_use reported', async () => {
    M.perm = { fg: 'granted', bg: 'denied', iosAccuracy: 'full' };
    arm(); await G().maybeUploadInterimLog();
    assert.ok(/perm:when_in_use/.test(logUploads()[0].body.logs.find((e) => e.icon === '🩺').msg));
  });
  results.push(await run('11. the device test plan, automated (rows 1, 2, 6)'));

  // ════════════ 12. 2026-10-18 audit ════════════
  // The parts of the 2026-10-18 audit the harness can reach (HomeScreen itself
  // cannot be loaded here — its wiring is checked against the source). A
  // RaceResult finish stays authoritative: one finished=1/'rr' answer stops.
  const R = () => load('services/trackingSessionRules');
  const RACE_FIN = '@PFSLive:raceFinished';
  const HOUR = 3600000;

  test('isStaleSession: gun 25h ago → stale; gun 2h ago → not', async () => {
    const { isStaleSession } = R();
    assert.strictEqual(isStaleSession({ participantId: '2', eventId: '12', raceStartTime: new Date(M.clock - 25 * HOUR).toISOString() }, M.clock), true);
    assert.strictEqual(isStaleSession({ participantId: '2', eventId: '12', raceStartTime: new Date(M.clock - 2 * HOUR).toISOString() }, M.clock), false);
  });
  test('isStaleSession: overnight ultra 20h after the gun → still resumes; no session → false', async () => {
    const { isStaleSession } = R();
    assert.strictEqual(isStaleSession({ raceStartTime: new Date(M.clock - 20 * HOUR).toISOString() }, M.clock), false);
    assert.strictEqual(isStaleSession(null, M.clock), false);
  });
  test('isStaleSession: manual start without a stored gun → never stale; with an old stored gun → stale', async () => {
    const { isStaleSession } = R();
    assert.strictEqual(isStaleSession({ raceStartTime: null }, M.clock), false);
    assert.strictEqual(isStaleSession({ raceStartTime: new Date(M.clock - 30 * HOUR).toISOString() }, M.clock), true);
  });

  test('computeRaceStartTime: offset captured at receipt → real gun however old the data (old formula late by the data age)', async () => {
    const { computeRaceStartTime } = R();
    // Event in Brussels summer time (UTC+2), gun 10:00 local = 08:00Z.
    const realGun = Date.parse('2026-10-17T08:00:00Z');
    const tz = 2 * HOUR;
    const fakeLocal = (ms) => new Date(ms + tz).toISOString().slice(0, 19).replace('T', ' ');
    // Home data received at 07:00Z (09:00 local) — offset captured then, as fetchHomeData does.
    const receivedAt = Date.parse('2026-10-17T07:00:00Z');
    const serverDatetime = fakeLocal(receivedAt);
    const offset = Date.parse(serverDatetime.replace(' ', 'T') + 'Z') - receivedAt;
    for (const ageH of [0, 0.5, 3, 7]) {
      const now = receivedAt + ageH * HOUR;              // Start pressed now; fresh fetch failed → old data
      const gun = computeRaceStartTime('2026-10-17', '10:00:00', offset);
      assert.strictEqual(gun.getTime(), realGun, `new: data ${ageH}h old`);
      // Pre-fix formula: Date.now() + (race − server_datetime), re-reading the OLD server_datetime.
      const oldGun = now + (Date.parse('2026-10-17T10:00:00Z') - Date.parse(serverDatetime.replace(' ', 'T') + 'Z'));
      assert.strictEqual(oldGun - realGun, ageH * HOUR, `old formula late by exactly the data age (${ageH}h)`);
    }
    assert.strictEqual(computeRaceStartTime(null, '10:00:00', offset), null);
    assert.strictEqual(computeRaceStartTime('2026-10-17', 'garbage', offset), null);
  });

  // Live path: real startWatchingPosition + Transistor onLocation → processLocationForSend.
  const liveAnswers = [];
  const answerLocation = () => {
    M.api.handler = (url, body) => {
      M.api.posted.push({ url, body });
      if (url.includes('insert_participant_location')) {
        const a = liveAnswers.shift() || { finished: 0 };
        return Promise.resolve({ success: true, data: { coordinate_id: M.api.posted.length, distance_to_finish_km: 3.2, ...a }, error: null });
      }
      return Promise.resolve({ success: true, data: {}, error: null });
    };
  };
  const settle = () => new Promise((r) => setTimeout(r, 40));
  let lat = 50;
  const fire = async () => {
    lat += 0.001;                                         // ~111 m — clears the movement gate
    M.bg.location({ coords: { latitude: lat, longitude: 4, speed: 3, accuracy: 5, altitude: 10, heading: 0 }, timestamp: new Date(M.clock).toISOString(), is_moving: true });
    await settle();
  };
  const locPosts = () => M.api.posted.filter((p) => p.url.includes('insert_participant_location')).length;
  const liveStart = async () => {
    liveAnswers.length = 0; lat = 50; answerLocation();
    await startSession('2', '12');
    assert.ok(typeof M.bg.location === 'function', 'onLocation registered');
    M.clock += 1000; await fire();                        // first fix: position recorded, not sent
  };
  const liveSend = async (answer) => {
    liveAnswers.push(answer); M.clock += 31000; const n = locPosts(); await fire();
    assert.strictEqual(locPosts(), n + 1, 'a live fix was sent');
  };
  const RR = { finished: 1, finish_source: 'rr' }, NOT = { finished: 0 };

  test('live: one RaceResult finished answer stops tracking (RR is authoritative)', async () => {
    await liveStart();
    await liveSend(RR);
    assert.strictEqual(M.store.get(RACE_FIN), '1'); assert.ok(!M.store.has(PARAMS), 'params cleared');
  });
  test('live: not finished keeps tracking', async () => {
    await liveStart();
    await liveSend(NOT);
    assert.ok(M.store.has(PARAMS)); assert.notStrictEqual(M.store.get(RACE_FIN), '1');
  });

  // ── GPS drift while standing still (developer test 2026-10-29, p4656) ──
  // iPhone, app 1.0.5, a WALKING session (3m threshold), phone lying still: the
  // stored points wandered 3-18m inside their own ~14-22m accuracy and counted as
  // movement. Real positions / accuracies from that session (coordinates
  // 372184-372191), in order, after the start position.
  const P4656_START = [19.42375, 72.8076333];
  const P4656_DRIFT = [
    [19.4238896, 72.8077194, 21.77], [19.4239244, 72.8077208, 14.25], [19.4238751, 72.8077558, 14.25],
    [19.4238783, 72.8076817, 14.25], [19.4238874, 72.8077409, 14.25], [19.4237780, 72.8076333, 7.69],
  ];
  const walkStart = async () => {
    liveAnswers.length = 0; answerLocation();
    const { gpsService } = load('services/gpsService');
    // category 64 = walking (MOVEMENT_THRESHOLD 3m), as p4656's session
    await gpsService.startWatchingPosition(() => {}, () => {}, 30, '2', '12', 't', 'b', 64, new Date(M.clock - HOUR).toISOString(), 0, 'Walk');
    M.clock += 1000; await fireAt(P4656_START[0], P4656_START[1], 7.69);   // start position: recorded, not sent
  };
  const fireAt = async (la, lo, acc, spd = -1) => {
    M.bg.location({ coords: { latitude: la, longitude: lo, speed: spd, accuracy: acc, altitude: 8, heading: -1 }, timestamp: new Date(M.clock).toISOString(), is_moving: true });
    await settle();
  };
  test('drift: p4656\'s still phone (walking, 6 fixes 3-21m from the start, accuracy 8-22m) sends NOTHING online — each "move" is inside the two accuracy circles', async () => {
    await walkStart();
    const n = locPosts();
    for (const [la, lo, acc] of P4656_DRIFT) { M.clock += 31000; await fireAt(la, lo, acc); }
    assert.strictEqual(locPosts() - n, 0, 'drift sent');
    const log = await load('services/gpsService').getFullTrackingLog();
    assert.ok(log.some((e) => /Skipped — moved only 18\.\dm \(need 25m\)/.test(e.msg)), 'the bar shown: 7.7 + 21.8 capped at 25');
    assert.ok(log.some((e) => /Skipped — moved only 21\.\dm \(need 21\.9m\)/.test(e.msg)), '21m from the start at 7.7 + 14.3');
  });
  test('…a real walk with the SAME accuracy still sends every window (~40m per 31s at 14m accuracy)', async () => {
    await walkStart();
    const n = locPosts();
    let la = P4656_START[0];
    for (let i = 0; i < 4; i++) { M.clock += 31000; la += 0.00036; await fireAt(la, P4656_START[1], 14.25, 1.3); }   // ~40m north each
    assert.strictEqual(locPosts() - n, 4);
  });
  test('…a very poor fix (60m) does not hold real progress back beyond 25m: 30m sent, 20m skipped', async () => {
    await walkStart();
    let n = locPosts();
    M.clock += 31000; await fireAt(P4656_START[0] + 0.00018, P4656_START[1], 60);   // ~20m
    assert.strictEqual(locPosts() - n, 0, '20m at 60m accuracy');
    n = locPosts();
    M.clock += 31000; await fireAt(P4656_START[0] + 0.00027, P4656_START[1], 60);   // ~30m from the start
    assert.strictEqual(locPosts() - n, 1, '30m at 60m accuracy (cap 25m)');
  });
  test('…OFFLINE with a backlog (p4656\'s case): the drift fixes are not queued; a real move is', async () => {
    await walkStart();
    setQ([fix(2, 12, 5)]);                                   // the first fix is already waiting
    // No radio: NetInfo says so and every request fails (the probe included).
    M.net = { isConnected: false, isInternetReachable: false, type: 'none' };
    M.api.handler = () => Promise.reject(Object.assign(new Error('Network Error'), { type: 'network' }));
    for (const [la, lo, acc] of P4656_DRIFT) { M.clock += 31000; await fireAt(la, lo, acc); }
    assert.strictEqual(getQ().length, 1, 'no drift queued behind it');
    M.clock += 31000; await fireAt(P4656_START[0] + 0.00045, P4656_START[1], 14.25, 1.3);   // ~50m: real
    assert.strictEqual(getQ().length, 2, 'the real move is queued');
  });
  test('accuracyFloorMetres: both fixes\' accuracy together, capped at 25m; no / bad accuracy → no floor (the category threshold alone, as before)', () => {
    const { accuracyFloorMetres } = load('services/gpsService');
    assert.strictEqual(accuracyFloorMetres(14.25, 7.69), 21.94);
    assert.strictEqual(accuracyFloorMetres(14.25), 14.25, 'anchor saved by an older version (no acc)');
    assert.strictEqual(accuracyFloorMetres(60, 5), 25);
    for (const bad of [null, undefined, 0, -1, NaN]) assert.strictEqual(accuracyFloorMetres(bad, bad), 0, String(bad));
  });

  // Drain path: locationService.processQueue (offline backlog flushed on reconnect).
  const drainAnswers = (answers) => {
    let i = 0;
    M.api.handler = (url, body) => {
      M.api.posted.push({ url, body });
      if (url.includes('insert_participant_location')) return Promise.resolve({ success: true, data: { coordinate_id: ++i, distance_to_finish_km: 2, ...(answers[i - 1] || NOT) }, error: null });
      return Promise.resolve({ success: true, data: {}, error: null });
    };
  };
  const armSession = () => M.store.set(PARAMS, JSON.stringify({ participantId: '2', eventId: '12', intervalSeconds: 30, raceStartTime: new Date(M.clock - HOUR).toISOString(), manualStart: 0 }));
  test('drain: a RaceResult finished answer in the backlog finishes the session once it drains', async () => {
    armSession(); setQ([fix(2, 12, 5)]); drainAnswers([RR]);
    await L().processQueue('2', '12');
    assert.strictEqual(getQ().length, 0, 'fix delivered');
    assert.strictEqual(M.store.get(RACE_FIN), '1');
  });

  test('cold boot with a session whose gun is >24h old → params removed, nothing resumed', async () => {
    M.store.set(PARAMS, JSON.stringify({ participantId: '2', eventId: '12', intervalSeconds: 30, raceStartTime: new Date(M.clock - 26 * HOUR).toISOString(), manualStart: 0 }));
    const g = load('services/gpsService');                // module load runs the cold-boot rehydrate
    await settle();
    assert.ok(!M.store.has(PARAMS), 'old session stopped');
    const log = await g.getFullTrackingLog();
    assert.ok(log.some((e) => e.icon === '🧹'), 'stop logged');
    assert.ok(!log.some((e) => e.icon === '🔁'), 'engine not resumed');
  });
  test('cold boot with a session from 2h ago → still resumed (control)', async () => {
    M.store.set(PARAMS, JSON.stringify({ participantId: '2', eventId: '12', intervalSeconds: 30, raceStartTime: new Date(M.clock - 2 * HOUR).toISOString(), manualStart: 0 }));
    const g = load('services/gpsService'); await settle();
    assert.ok(M.store.has(PARAMS));
    assert.ok((await g.getFullTrackingLog()).some((e) => e.icon === '🔁'));
  });
  test('session start clears last race\'s GPS health / fault / drain / offline state', async () => {
    M.store.set('@PFSLive:gpsHealth', 'no_fix'); M.store.set('@PFSLive:gpsFaultStreak', '4');
    M.store.set('@PFSLive:drainFailStreak', '3'); M.store.set('@PFSLive:offlineCooldownUntil', String(M.clock + 60000));
    await startSession();
    for (const k of ['@PFSLive:gpsHealth', '@PFSLive:gpsFaultStreak', '@PFSLive:drainFailStreak', '@PFSLive:offlineCooldownUntil']) {
      assert.ok(!M.store.has(k), `${k} cleared`);
    }
  });
  test('watchdog restart keeps the STORED session ids (home showing another race cannot re-point it)', async () => {
    armSession();
    const g = load('services/gpsService'); await settle();
    // Engine found dead → the watchdog re-stores params from what HomeScreen passed.
    const BG = require('react-native-background-geolocation').default;
    const realGetState = BG.getState; BG.getState = async () => ({ enabled: false, isMoving: false });
    try { await g.ensureBackgroundTaskAlive('777', '99', 30, 59, null, 0, 't', 'b', 'Other race'); }
    finally { BG.getState = realGetState; }
    const p = JSON.parse(M.store.get(PARAMS));
    assert.strictEqual(p.participantId, '2'); assert.strictEqual(p.eventId, '12');
    assert.ok(p.raceStartTime, 'gun kept');
  });
  test('approximate location (iOS reduced accuracy) → isApproximateLocation true; precise → false', async () => {
    const { gpsService } = load('services/gpsService');
    assert.strictEqual(typeof gpsService.isApproximateLocation, 'function', 'isApproximateLocation exists');
    M.provider = { ...M.provider, accuracyAuthorization: 1 };
    assert.strictEqual(await gpsService.isApproximateLocation(), true);
    M.provider = { ...M.provider, accuracyAuthorization: 0 };
    assert.strictEqual(await gpsService.isApproximateLocation(), false);
  });
  test('approximate location (Android "Approximate" = coarse) → true; fine → false; probe throws → false', async () => {
    const RN = require('react-native'); const Loc = require('expo-location');
    const realOS = RN.Platform.OS; const realFg = Loc.getForegroundPermissionsAsync;
    RN.Platform.OS = 'android';
    try {
      const { gpsService } = load('services/gpsService');
      Loc.getForegroundPermissionsAsync = async () => ({ status: 'granted', android: { accuracy: 'coarse' } });
      assert.strictEqual(await gpsService.isApproximateLocation(), true, 'coarse');
      Loc.getForegroundPermissionsAsync = async () => ({ status: 'granted', android: { accuracy: 'fine' } });
      assert.strictEqual(await gpsService.isApproximateLocation(), false, 'fine');
      Loc.getForegroundPermissionsAsync = async () => { throw new Error('probe failed'); };
      assert.strictEqual(await gpsService.isApproximateLocation(), false, 'failed probe never warns');
    } finally { RN.Platform.OS = realOS; Loc.getForegroundPermissionsAsync = realFg; }
  });
  test('cold boot: a session 20h after the gun (overnight ultra) is resumed, not stopped', async () => {
    M.store.set(PARAMS, JSON.stringify({ participantId: '2', eventId: '12', intervalSeconds: 30, raceStartTime: new Date(M.clock - 20 * HOUR).toISOString(), manualStart: 0 }));
    load('services/gpsService'); await settle(); await settle();
    assert.ok(M.store.has(PARAMS), 'live session kept');
  });
  test('new HomeScreen strings exist in en/fr/nl (post-gun Stop, approximate location)', async () => {
    for (const l of ['en', 'fr', 'nl']) {
      const j = JSON.parse(fs.readFileSync(`${SRC}/i18n/HomeScreen/${l}.json`, 'utf8'));
      for (const k of ['stopAfterStartTitle', 'stopAfterStartMessage', 'approximateLocationTitle', 'approximateLocationMessage', 'openSettings', 'continueAnyway']) {
        assert.ok(typeof j.alerts[k] === 'string' && j.alerts[k].length > 2, `${l}.alerts.${k}`);
      }
    }
  });
  test('HomeScreen wiring (2026-10-18): stale restore, offset gun, no pre-start fix, no home-mismatch stop, card while tracking, no-race abort', async () => {
    const s = fs.readFileSync(`${SRC}/screens/HomeScreen.tsx`, 'utf8').replace(/\r/g, '');
    assert.ok(/if \(isStaleSession\(params, Date\.now\(\)\)\) \{[\s\S]{0,200}await stopWatching\(\);/.test(s), 'restore stops a >24h session');
    assert.ok(/computeRaceStartTime\(raceData\.next_race_date, raceData\.next_race_time, serverTimeOffsetRef\.current\)/.test(s), 'gun from captured offset');
    assert.ok(!/new Date\(Date\.now\(\) \+ msUntilRace\)/.test(s), 'old formula gone');
    assert.ok(!/gpsService\.getCurrentPosition\(\)/.test(s), 'no expo-location first fix racing Transistor at start');
    assert.ok(!/stopGPSTrackingRef|participantId: homePid/.test(s), 'no silent "home offers another race" mid-race stop');
    assert.ok(/homeData\?\.show_start_track === 1 \|\| isGPSActive \?/.test(s), 'card rendered while tracking');
    assert.ok(/if \(fresh && \(!fresh\.next_race_participant_app_id \|\| !fresh\.next_race_id\)\)/.test(s), 'no-race home aborts start');
  });
  test('HomeScreen wiring (2026-10-18): session ids for queue + Stop, approximate-location warning, gun only with a captured offset', async () => {
    const s = fs.readFileSync(`${SRC}/screens/HomeScreen.tsx`, 'utf8').replace(/\r/g, '');
    // Queue processor: no longer needs home's ids (restore runs before home loads).
    assert.ok(/if \(queueProcessorRef\.current\) return;/.test(s), 'processor starts without home ids');
    assert.ok(/const sp = await getTrackingParams\(\);\s*const qPid = sp\?\.participantId \?\? participantId;/.test(s), 'processor drains the SESSION\'s ids');
    // Stop drains / uploads under the running session's ids.
    assert.ok(/stopParticipantId = String\(sp\.participantId\);/.test(s) && /drainForStop\(stopParticipantId, stopEventId\)/.test(s), 'Stop uses session ids');
    // Approximate location (growth_v0.1): warned by the precise gate ("Start anyway"
    // continues), never blocked — and not prompted twice by a second alert.
    assert.ok(/if \(!allowApproximate && \(await readPrecise\(\)\) === false\)/.test(s), 'precise gate at Start');
    assert.ok(!/if \(await gpsService\.isApproximateLocation\(\)\)/.test(s), 'no second approximate alert');
    // No captured offset → no gun (session waits), as before when server_datetime was missing.
    assert.ok(/const raceTime = serverTimeOffsetKnownRef\.current\s*\?\s*computeRaceStartTime\(/.test(s), 'gun only from a captured offset');
    assert.ok(/serverTimeOffsetKnownRef\.current = true;/.test(s), 'flag set where the offset is captured');
  });
  test('HomeScreen merge (growth_v0.1, 2026-10-18): design card follows the session in the session-only state', async () => {
    const s = fs.readFileSync(`${SRC}/screens/HomeScreen.tsx`, 'utf8').replace(/\r/g, '');
    // Card title: the running session's race while tracking, home's race otherwise.
    assert.ok(/<Text style=\{homeStyles\.eventName\}[^>]*>\s*\{\(isGPSActive && sessionRaceName\) \|\| \(homeData\?\.show_start_track === 1 \? homeData\?\.next_race_name : ''\) \|\| ''\}/.test(s), 'card title from the session');
    // Date / start time line only while home offers this race.
    assert.ok(/\{homeData\?\.show_start_track === 1 && !!homeData\?\.next_race_date && \(\s*<View style=\{homeStyles\.eventMetaRow\}>/.test(s), 'date line guarded');
    assert.ok(!/<Text style=\{homeStyles\.eventName\}[^>]*>\s*\{homeData\.next_race_name\}/.test(s), 'no unguarded homeData.next_race_name title');
    // "Tracking active" card: the session's race first.
    assert.ok(/\{sessionRaceName \|\| homeData\?\.next_race_name\}/.test(s), 'active card names the session race');
    // Stop stays pressable while tracking even if home lost the ids.
    assert.ok(/disabled=\{!isGPSActive && \(!participantId \|\| !eventId\)\}/.test(s), 'Stop never disabled by missing home ids');
    // Share link: home's race only — in the session-only state homeData may be absent / another race.
    assert.ok(/\{homeData\?\.show_start_track === 1 && \(\s*<ShareTrackingLink/.test(s), 'share link only while home offers the race');
    // Approximate location: growth's precise gate only — no second alert after it.
    assert.ok(!/if \(await gpsService\.isApproximateLocation\(\)\)/.test(s), 'no duplicate approximate alert');
  });
  results.push(await run('12. 2026-10-18 audit (rr finish authoritative, stale sessions, gun offset, watchdog ids)'));

  // ════════════ 13. event 19 post-race review (2026-10-19) ════════════
  // Evidence: prod DB + api_logs_2026-10-18, running code 06ffa9a (OTA 01a138e5).
  const RN = require('react-native');
  const PENDING_PING = '@PFSLive:pendingStartPing';
  const withRN = async (os, appState, fn) => {
    const o = RN.Platform.OS, a = RN.AppState.currentState;
    RN.Platform.OS = os; RN.AppState.currentState = appState;
    try { return await fn(); } finally { RN.Platform.OS = o; RN.AppState.currentState = a; }
  };
  const startPosts = () => M.axios.calls.filter((c) => c.url.endsWith('/save_tracking_start_api.php'));

  test('p4537/p4807/p4826: iOS Start with the phone already pocketed → session starts (no 3s foreground wait)', async () => {
    await withRN('ios', 'background', async () => { await startSession('4807', '19'); });
    assert.ok(M.store.has(PARAMS), 'session params stored');
    assert.strictEqual(JSON.parse(M.store.get(PARAMS)).participantId, '4807');
  });
  test('Android Start while backgrounded → throws code start_backgrounded (HomeScreen re-arms it), no session', async () => {
    const { START_BACKGROUNDED_CODE } = load('services/gpsService');
    let err = null;
    await withRN('android', 'background', async () => { try { await startSession('2', '12'); } catch (e) { err = e; } });
    assert.ok(err, 'start threw'); assert.strictEqual(START_BACKGROUNDED_CODE, 'start_backgrounded'); assert.strictEqual(err.code, 'start_backgrounded');
    assert.ok(!M.store.has(PARAMS), 'no half-started session');
  });
  // iOS start window (2026-10-20): background time from the home refetch to start().
  const withBgTask = async (impl, fn) => {
    const BG = require('react-native-background-geolocation').default;
    const calls = [];
    BG.startBackgroundTask = async () => { calls.push(['start']); return impl.start(); };
    BG.stopBackgroundTask = async (id) => { calls.push(['stop', id]); return impl.stop ? impl.stop(id) : undefined; };
    try { return await fn(calls); } finally { delete BG.startBackgroundTask; delete BG.stopBackgroundTask; }
  };
  test('iOS start window: beginStartWindow takes a background task on iOS, endStartWindow releases that id', async () => {
    const { gpsService } = load('services/gpsService');
    await withBgTask({ start: () => 42 }, async (calls) => {
      const id = await withRN('ios', 'active', () => gpsService.beginStartWindow());
      assert.strictEqual(id, 42);
      await gpsService.endStartWindow(id);
      assert.deepStrictEqual(calls, [['start'], ['stop', 42]]);
    });
  });
  test('iOS start window: Android takes none; a failing start/stop never throws; null is not released', async () => {
    const { gpsService } = load('services/gpsService');
    await withBgTask({ start: () => 1 }, async (calls) => {
      assert.strictEqual(await withRN('android', 'active', () => gpsService.beginStartWindow()), null);
      await gpsService.endStartWindow(null);
      assert.deepStrictEqual(calls, [], 'no native call on Android or for null');
    });
    await withBgTask({ start: () => { throw new Error('no task'); }, stop: () => { throw new Error('gone'); } }, async (calls) => {
      assert.strictEqual(await withRN('ios', 'active', () => gpsService.beginStartWindow()), null, 'failed start → null');
      await gpsService.endStartWindow(5);   // must not throw
      assert.deepStrictEqual(calls, [['start'], ['stop', 5]]);
    });
  });
  test('iOS start window wiring: taken after the last popup, before the home refetch; released in finally on every exit', async () => {
    const s = fs.readFileSync(`${SRC}/screens/HomeScreen.tsx`, 'utf8').replace(/\r/g, '');
    const fnAt = s.indexOf('const doStartGPSTracking = useCallback(async () => {');
    const fnEnd = s.indexOf('\n  }, [\n    hasPermission,', fnAt);
    const fn = s.slice(fnAt, fnEnd);
    assert.ok(fnAt > 0 && fnEnd > fnAt, 'doStartGPSTracking found');
    const iDecl = fn.indexOf('let startWindow: number | null = null;');
    const iTry = fn.indexOf('\n    try {');
    // growth_v0.1: the last thing that waits for the runner is the precise gate
    // (this branch has no approximate-location popup)
    const iApprox = fn.indexOf('if (!allowApproximate && (await readPrecise()) === false) {');
    const iTake = fn.indexOf('startWindow = await gpsService.beginStartWindow();');
    const iFetch = fn.indexOf('fetchHomeData(true)');
    const iEngine = fn.indexOf('await gpsService.startWatchingPosition(');
    assert.ok(iDecl > 0 && iDecl < iTry, 'declared before the try');
    assert.ok(iApprox > 0 && iTake > iApprox, 'after the precise gate (nothing waits for the runner after it)');
    assert.ok(iFetch > iTake && iEngine > iFetch, 'before the home refetch and the engine start');
    assert.strictEqual((fn.match(/beginStartWindow\(/g) || []).length, 1, 'taken once');
    // the finally also releases startingRef on this branch
    assert.ok(/\n    \} finally \{\n      void gpsService\.endStartWindow\(startWindow\);\n[\s\S]*?\n    \}$/.test(fn), 'the function-level finally releases it');
  });
  test('HomeScreen wiring: start ping only AFTER the engine started; backgrounded start re-armed; pending ping flushed by the queue timer', async () => {
    const s = fs.readFileSync(`${SRC}/screens/HomeScreen.tsx`, 'utf8');
    const iStart = s.indexOf('await gpsService.startWatchingPosition(');
    const iPing = s.indexOf('void sendTrackingStartPing({');
    assert.ok(iStart > 0 && iPing > iStart, 'ping after startWatchingPosition');
    assert.ok(/\(error as any\)\?\.code === START_BACKGROUNDED_CODE\) \{\s*pendingStartRef\.current = true;/.test(s), 'backgrounded start re-armed');
    assert.ok(/void maybeUploadInterimLog\(\);\s*\/\/[^\n]*\n\s*void flushPendingStartPing\(\);/.test(s), 'queue timer flushes the pending ping');
  });
  test('reopenToStart string exists in en/fr/nl', async () => {
    for (const l of ['en', 'fr', 'nl']) {
      const j = JSON.parse(fs.readFileSync(`${SRC}/i18n/HomeScreen/${l}.json`, 'utf8'));
      assert.ok(typeof j.tracking.reopenToStart === 'string' && j.tracking.reopenToStart.length > 10, l);
    }
  });

  const TS = () => load('services/trackingStartService');
  const armPing = (pid = '4566', eid = '19') => M.store.set(PARAMS, JSON.stringify({ participantId: pid, eventId: eid, raceStartTime: new Date(M.clock - HOUR).toISOString(), manualStart: 0 }));
  test('p4566: all in-line retries fail → ping stays pending; later flush delivers it (late_ping) and clears it', async () => {
    armPing(); M.axios.script = ['network', 'network', 'network', 'network'];
    assert.strictEqual(await TS().sendTrackingStartPing({ participantId: '4566', eventId: '19', startedAfterGun: false, isStillTracking: () => true, sleep: async () => {} }), 'gave_up');
    assert.ok(M.store.has(PENDING_PING), 'pending kept');
    assert.strictEqual(await TS().flushPendingStartPing(), 'sent');
    const last = startPosts().pop();
    assert.strictEqual(last.body.participantId, '4566'); assert.strictEqual(last.body.diag.late_ping, true);
    assert.ok(!M.store.has(PENDING_PING), 'cleared after delivery');
  });
  test('pending ping cleared on sent / 4xx / Stop-before-retry', async () => {
    armPing();
    await TS().sendTrackingStartPing({ participantId: '4566', eventId: '19', startedAfterGun: false, isStillTracking: () => true, sleep: async () => {} });
    assert.ok(!M.store.has(PENDING_PING), 'sent');
    M.axios.script = [401];
    await TS().sendTrackingStartPing({ participantId: '4566', eventId: '19', startedAfterGun: false, isStillTracking: () => true, sleep: async () => {} });
    assert.ok(!M.store.has(PENDING_PING), 'rejected');
    let active = true; M.axios.script = ['network'];
    await TS().sendTrackingStartPing({ participantId: '4566', eventId: '19', startedAfterGun: false, isStillTracking: () => active, sleep: async () => { active = false; } });
    assert.ok(!M.store.has(PENDING_PING), 'stopped');
  });
  test('pending ping for an ended / different session → dropped, never sent late', async () => {
    M.store.set(PENDING_PING, JSON.stringify({ participantId: '4566', eventId: '19', diag: {} }));
    assert.strictEqual(await TS().flushPendingStartPing(), 'stopped');       // no session at all
    assert.strictEqual(startPosts().length, 0); assert.ok(!M.store.has(PENDING_PING));
    armPing('9999', '20');
    M.store.set(PENDING_PING, JSON.stringify({ participantId: '4566', eventId: '19', diag: {} }));
    assert.strictEqual(await TS().flushPendingStartPing(), 'stopped');       // another session is live
    assert.strictEqual(startPosts().length, 0);
  });
  test('flush still failing (network) → stays pending for the next wake; no pending → no request', async () => {
    assert.strictEqual(await TS().flushPendingStartPing(), 'none'); assert.strictEqual(startPosts().length, 0);
    armPing(); M.store.set(PENDING_PING, JSON.stringify({ participantId: '4566', eventId: '19', diag: {} }));
    M.axios.script = ['network'];
    assert.strictEqual(await TS().flushPendingStartPing(), 'gave_up'); assert.ok(M.store.has(PENDING_PING));
  });
  test('heartbeat delivers a pending start ping; Stop (stopWatching) discards it', async () => {
    await startSession('4566', '19');
    M.store.set(PENDING_PING, JSON.stringify({ participantId: '4566', eventId: '19', diag: {} }));
    await M.bg.heartbeat({}); await settle();
    assert.ok(startPosts().some((c) => c.body.diag && c.body.diag.late_ping === true), 'sent from the heartbeat');
    M.store.set(PENDING_PING, JSON.stringify({ participantId: '4566', eventId: '19', diag: {} }));
    await load('services/gpsService').stopWatching();
    assert.ok(!M.store.has(PENDING_PING), 'cleared by the stop');
  });

  test('p4823: pre-race heartbeat 20 min before the gun → engine kept MOVING (⏰), nothing sent', async () => {
    await startSession('4823', '19', new Date(M.clock + 20 * 60000).toISOString());
    M.bg.pace = [];
    await M.bg.heartbeat({});
    const log = await load('services/gpsService').getFullTrackingLog();
    assert.ok(log.some((e) => e.icon === '⏰' && /gun in 20min, engine kept moving/.test(e.msg)), '⏰ logged');
    assert.deepStrictEqual(M.bg.pace, [true], 'changePace(true)');
    assert.strictEqual(locPosts(), 0, 'no fix sent before the gun');
  });
  // Window widened 30 → 60 min on 2026-10-20 (see PRE_GUN_WAKE_MS).
  test('pre-race heartbeat 61 min before the gun → still low-power (🔋), engine left idle', async () => {
    await startSession('4823', '19', new Date(M.clock + 61 * 60000).toISOString());
    M.bg.pace = [];
    await M.bg.heartbeat({});
    const log = await load('services/gpsService').getFullTrackingLog();
    // by message: the Start's battery line carries the same 🔋 icon
    assert.ok(log.some((e) => e.msg === 'Heartbeat — pre-race low-power (engine idle until start)')); assert.ok(!log.some((e) => e.icon === '⏰'));
    assert.deepStrictEqual(M.bg.pace, []);
  });

  test('isStaleSession: no gun → judged by session start (25h stale, 2h not, unknown never)', async () => {
    const { isStaleSession } = load('services/trackingSessionRules');
    assert.strictEqual(isStaleSession({ raceStartTime: null }, M.clock, M.clock - 25 * HOUR), true);
    assert.strictEqual(isStaleSession({ raceStartTime: null }, M.clock, M.clock - 2 * HOUR), false);
    assert.strictEqual(isStaleSession({ raceStartTime: null }, M.clock, 0), false);
    assert.strictEqual(isStaleSession({ raceStartTime: new Date(M.clock - 2 * HOUR).toISOString() }, M.clock, M.clock - 99 * HOUR), false, 'a stored gun wins');
  });
  test('p2525 (race of 10-03, 16 days later): heartbeat in a never-restarted process → session stopped', async () => {
    await startSession('2525', '15', new Date(M.clock - 16 * 24 * HOUR).toISOString());
    assert.ok(M.store.has(PARAMS));
    await M.bg.heartbeat({});
    assert.ok(!M.store.has(PARAMS), 'stopped');
    assert.ok((await load('services/gpsService').getFullTrackingLog()).some((e) => e.icon === '🧹' && /^Heartbeat/.test(e.msg)));
  });
  test('stale session: a live fix is NOT sent, the session stops', async () => {
    liveAnswers.length = 0; lat = 50; answerLocation();
    await startSession('2525', '15', new Date(M.clock - 26 * HOUR).toISOString());
    M.clock += 1000; await fire(); M.clock += 31000; await fire();
    assert.strictEqual(locPosts(), 0, 'nothing posted');
    assert.ok(!M.store.has(PARAMS), 'stopped');
  });
  test('control: 20h after the gun (overnight ultra) the heartbeat and sends carry on', async () => {
    liveAnswers.length = 0; lat = 50; answerLocation();
    await startSession('2', '12', new Date(M.clock - 20 * HOUR).toISOString());
    await M.bg.heartbeat({});
    assert.ok(M.store.has(PARAMS));
    M.clock += 1000; await fire(); M.clock += 31000; await fire();
    assert.strictEqual(locPosts(), 1);
  });
  test('p1601 (custom event, no stored gun, Start pressed 6 weeks ago) → stopped on the heartbeat', async () => {
    await startSession('1601', '100040', null);
    M.store.set('@PFSLive:sessionStartedAt', String(M.clock - 42 * 24 * HOUR));
    await M.bg.heartbeat({});
    assert.ok(!M.store.has(PARAMS));
  });

  test('p4536: 7 concurrent interim checks → ONE upload', async () => {
    arm();
    const g = G();
    await Promise.all(Array.from({ length: 7 }, () => g.maybeUploadInterimLog()));
    assert.strictEqual(logUploads().length, 1);
  });
  test('p4848: a log whose segments repeat a whole block uploads each entry once, in order', async () => {
    const e = (i) => ({ ts: 1000 + i, icon: '🛰️', msg: 'loc ' + i });
    const block = Array.from({ length: 220 }, (_, i) => e(i));
    M.store.set('@PFSLive:trackingLogSeg:0', JSON.stringify(block.concat(block)));
    M.store.set('@PFSLive:trackingLogSeg:1', JSON.stringify(block.concat([e(300), e(301)])));
    M.store.set('@PFSLive:trackingLogSegCount', '2');
    M.store.set('@PFSLive:trackingLog', JSON.stringify([e(300), e(302)]));
    const log = await G().getFullTrackingLog();
    assert.strictEqual(log.length, 223);
    assert.deepStrictEqual(log.slice(-3).map((x) => x.msg), ['loc 300', 'loc 301', 'loc 302']);
  });
  // Guard only: the exact interleaving that tripled p4848's block was not
  // reproducible in this harness; this pins the de-dup on the rehydrate path.
  test('rehydrate never doubles entries the buffer already holds (guard)', async () => {
    const g = G();
    await g.addLog('🛰️', 'a');                        // hydrates (empty disk), buffer [a]
    await g.flushTrackingLog();
    const disk = JSON.parse(M.store.get('@PFSLive:trackingLog'));
    assert.strictEqual(disk.length, 1);
    // a second context: disk holds [a]; that context had already pushed the same entry
    delete require.cache[require.resolve(`${SRC}/services/gpsService.ts`)];
    const g2 = G();
    await g2.addLog('🛰️', 'b');
    const all = await g2.getFullTrackingLog();
    assert.deepStrictEqual(all.map((x) => x.msg), ['a', 'b']);
  });
  // ── 2026-10-19 re-check: edge cases ──
  test('Android Start in the FOREGROUND → starts normally (control for the Android-only wait)', async () => {
    await withRN('android', 'active', async () => { await startSession('2', '12'); });
    assert.ok(M.store.has(PARAMS));
  });
  test('two flushes at the same moment (heartbeat + queue timer) → ONE start request', async () => {
    armPing(); M.store.set(PENDING_PING, JSON.stringify({ participantId: '4566', eventId: '19', diag: {} }));
    const ts = TS();
    const r = await Promise.all([ts.flushPendingStartPing(), ts.flushPendingStartPing()]);
    assert.strictEqual(startPosts().length, 1); assert.ok(r.includes('sent') && r.includes('none'), JSON.stringify(r));
  });
  test('finish already detected (finishBackgroundStop uploading, params still there) → pending ping dropped, NOT sent', async () => {
    armPing(); M.store.set(PENDING_PING, JSON.stringify({ participantId: '4566', eventId: '19', diag: {} }));
    M.store.set('@PFSLive:raceFinished', '1');
    assert.strictEqual(await TS().flushPendingStartPing(), 'stopped');
    assert.strictEqual(startPosts().length, 0); assert.ok(!M.store.has(PENDING_PING));
  });
  test('a NEW Start clears the previous finish flag, so its own pending ping is still delivered', async () => {
    M.store.set('@PFSLive:raceFinished', '1');
    await startSession('4566', '19');
    M.store.set(PENDING_PING, JSON.stringify({ participantId: '4566', eventId: '19', diag: {} }));
    assert.strictEqual(await TS().flushPendingStartPing(), 'sent');
  });
  test('flush answered 429 (rate limited) → kept pending; next flush delivers it', async () => {
    armPing(); M.store.set(PENDING_PING, JSON.stringify({ participantId: '4566', eventId: '19', diag: {} }));
    M.axios.script = [429];
    assert.strictEqual(await TS().flushPendingStartPing(), 'gave_up'); assert.ok(M.store.has(PENDING_PING));
    assert.strictEqual(await TS().flushPendingStartPing(), 'sent'); assert.ok(!M.store.has(PENDING_PING));
  });
  test('cold boot: session with NO stored gun but Start pressed 3 days ago → stopped, not resumed', async () => {
    M.store.set(PARAMS, JSON.stringify({ participantId: '1601', eventId: '100040', intervalSeconds: 30, raceStartTime: null, manualStart: 1 }));
    M.store.set('@PFSLive:sessionStartedAt', String(M.clock - 72 * HOUR));
    const g = load('services/gpsService'); await settle();
    assert.ok(!M.store.has(PARAMS));
    assert.ok((await g.getFullTrackingLog()).some((e) => e.icon === '🧹' && /^Cold boot/.test(e.msg)));
  });
  test('cold boot: manual-start session started 2h ago (no gun) → resumed (control)', async () => {
    M.store.set(PARAMS, JSON.stringify({ participantId: '1601', eventId: '100040', intervalSeconds: 30, raceStartTime: null, manualStart: 1 }));
    M.store.set('@PFSLive:sessionStartedAt', String(M.clock - 2 * HOUR));
    load('services/gpsService'); await settle();
    assert.ok(M.store.has(PARAMS));
  });
  test('pre-gun wake boundary: exactly 60 min before → ⏰; 61 min before → 🔋', async () => {
    await startSession('4823', '19', new Date(M.clock + 60 * 60000).toISOString());
    M.bg.pace = []; await M.bg.heartbeat({});
    assert.deepStrictEqual(M.bg.pace, [true]);
    await load('services/gpsService').stopWatching();
    await startSession('4823', '19', new Date(M.clock + 61 * 60000).toISOString());
    M.bg.pace = []; await M.bg.heartbeat({});
    assert.deepStrictEqual(M.bg.pace, []);
  });
  test('heartbeat never stops a session whose gun is in the future or a manual start of today', async () => {
    await startSession('2', '12', new Date(M.clock + 5 * HOUR).toISOString());
    await M.bg.heartbeat({}); assert.ok(M.store.has(PARAMS), 'future gun kept');
    await load('services/gpsService').stopWatching();
    const { gpsService } = load('services/gpsService');
    await gpsService.startWatchingPosition(() => {}, () => {}, 30, '7', '100050', 't', 'b', 59, null, 1, 'Custom');
    await M.bg.heartbeat({}); assert.ok(M.store.has(PARAMS), 'manual start kept');
  });
  test('log de-dup keeps the SAME message at DIFFERENT times (only exact repeats go)', async () => {
    M.store.set('@PFSLive:trackingLogSeg:0', JSON.stringify([{ ts: 1, icon: '⏭️', msg: 'Throttled' }, { ts: 2, icon: '⏭️', msg: 'Throttled' }, { ts: 1, icon: '⏭️', msg: 'Throttled' }]));
    M.store.set('@PFSLive:trackingLogSegCount', '1');
    const log = await G().getFullTrackingLog();
    assert.deepStrictEqual(log.map((e) => e.ts), [1, 2]);
  });
  test('interim single-flight releases: a failed upload is retried by the NEXT call', async () => {
    arm();
    M.api.handler = () => Promise.reject(Object.assign(new Error('x'), { type: 'network' }));
    await Promise.all([G().maybeUploadInterimLog(), G().maybeUploadInterimLog()]);
    M.api.handler = null;
    M.clock += 5 * 60000;   // past the failed-upload retry spacing (2026-10-23)
    await G().maybeUploadInterimLog();
    assert.strictEqual(logUploads().length, 1);
  });
  // ── merge of master into growth_v0.1 (2026-10-19) ──
  // This branch has no `colors` palette and folds the session-start key into
  // SESSION_START_KEY; the merge mapped master's code onto both.
  test('growth_v0.1 merge (2026-10-19): merged popups use this branch\'s palette, not the old colors', async () => {
    const s = fs.readFileSync(`${SRC}/screens/HomeScreen.tsx`, 'utf8').replace(/\r/g, '');
    const st = fs.readFileSync(`${SRC}/styles/home.styles.ts`, 'utf8').replace(/\r/g, '');
    assert.ok(!/\bcolors\./.test(s), 'no colors.* in HomeScreen');
    assert.ok(!/\bcolors\./.test(st), 'no colors.* in home.styles');
    for (const [visible, colour] of [['stopConfirmMode !== null', 'palette.danger'], ['startErrorMessage !== null', 'palette.danger'], ['showOverrideModal', 'palette.navy'], ['showBatteryStartModal', 'palette.navy']]) {
      const esc = visible.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const m = s.match(new RegExp('<Modal[^>]*?visible=\\{' + esc + '\\}[\\s\\S]*?</Modal>'));
      assert.ok(m, 'modal ' + visible);
      assert.ok(m[0].includes('<Ionicons') && m[0].includes('color={' + colour + '}'), visible + ' icon is ' + colour);
    }
    assert.ok(/notifIconWrapperDanger: \{\s*backgroundColor: palette\.dangerBg,\s*\}/.test(st), 'danger circle = dangerBg');
    assert.ok(/notifDangerButton: \{\s*borderColor: palette\.danger,\s*\}/.test(st), 'danger button border');
    assert.ok(/notifDangerText: \{\s*color: palette\.danger,\s*\}/.test(st), 'danger button text');
  });
  test('growth_v0.1 merge (2026-10-19): the stale-session stop reads the one session-start key', async () => {
    const g = fs.readFileSync(`${SRC}/services/gpsService.ts`, 'utf8').replace(/\r/g, '');
    assert.ok(/const SESSION_START_KEY = '@PFSLive:sessionStartedAt';/.test(g), 'one constant, same storage key');
    assert.ok(!/SESSION_STARTED_AT_KEY/.test(g), "master's duplicate constant not carried over");
    assert.ok(/const _stopIfStale = async[\s\S]{0,400}AsyncStorage\.getItem\(SESSION_START_KEY\)/.test(g), '_stopIfStale reads it');
    assert.ok(/const bootStartedAt = parseInt\(\(await AsyncStorage\.getItem\(SESSION_START_KEY\)\)/.test(g), 'cold boot reads it');
  });
  // ── 2026-10-20 re-check: logs + DB of races since 09-04, every fix re-traced ──
  const AS = require('@react-native-async-storage/async-storage').default;
  test('re-check 10-20: log seal is single-flight — two writers on a slow disk: every entry kept, in order, no skipped segment', async () => {
    await startSession('2', '12');
    const g = load('services/gpsService');
    const real = AS.setItem;
    // a seal's disk write takes a moment, as on a phone — the other writer keeps logging meanwhile
    AS.setItem = async (k, v) => { if (k.startsWith('@PFSLive:trackingLogSeg:')) await new Promise((r) => setTimeout(r, 3)); return real(k, v); };
    try {
      const writer = async (tag) => { for (let i = 0; i < 800; i++) await g.addLog('🧪', `${tag}-${i}`); };
      await Promise.all([writer('a'), writer('b')]);
    } finally { AS.setItem = real; }
    const msgs = (await g.getFullTrackingLog()).map((e) => e.msg);
    for (const tag of ['a', 'b']) {
      const mine = msgs.filter((m) => m.startsWith(tag + '-'));
      assert.deepStrictEqual(mine, Array.from({ length: 800 }, (_, i) => `${tag}-${i}`), tag + ': all 800, in order');
    }
    const cnt = parseInt(M.store.get('@PFSLive:trackingLogSegCount'), 10);
    assert.ok(cnt >= 2 && cnt <= 4, 'segment count matches ~1600 entries: ' + cnt);
    for (let i = 0; i < cnt; i++) {
      const seg = JSON.parse(M.store.get('@PFSLive:trackingLogSeg:' + i) || '[]');
      assert.ok(seg.length > 0, 'segment ' + i + ' written, not skipped');
    }
  });
  test('re-check 10-20: a failed seal puts its entries back in front; the next seal writes them; a log read during a seal sees them', async () => {
    await startSession('2', '12');
    const g = load('services/gpsService');
    const real = AS.setItem; let fail = true, midSealRead = null, midSealExpected = null, logged = 0;
    AS.setItem = async (k, v) => {
      if (k.startsWith('@PFSLive:trackingLogSeg:')) {
        if (fail) { fail = false; throw new Error('disk full'); }
        if (midSealRead === null) {
          midSealExpected = logged;   // every f- entry logged so far, the ones being sealed included
          midSealRead = (await g.getFullTrackingLog()).map((e) => e.msg).filter((m) => m.startsWith('f-')).length;
        }
      }
      return real(k, v);
    };
    try {
      for (let i = 0; i < 1100; i++) { logged++; await g.addLog('🧪', 'f-' + i); }
    } finally { AS.setItem = real; }
    const msgs = (await g.getFullTrackingLog()).map((e) => e.msg).filter((m) => m.startsWith('f-'));
    assert.deepStrictEqual(msgs, Array.from({ length: 1100 }, (_, i) => 'f-' + i), 'nothing lost or reordered');
    assert.ok(midSealExpected >= 400 && midSealRead === midSealExpected, `entries being sealed are visible to a concurrent read (${midSealRead} of ${midSealExpected})`);
  });
  test('re-check 10-20: re-attaching listeners leaves exactly one of each, even with SDK 5.1.1\'s every-other removeListeners()', async () => {
    const BG = require('react-native-background-geolocation').default;
    const subs = []; const saved = {};
    const names = ['onLocation', 'onHeartbeat', 'onMotionChange', 'onProviderChange', 'removeListeners'];
    for (const n of names) saved[n] = BG[n];
    const mk = (ev) => (cb) => {
      const sub = { ev, cb, remove() { const i = subs.indexOf(sub); if (i >= 0) subs.splice(i, 1); } };
      subs.push(sub); return sub;
    };
    BG.onLocation = mk('location'); BG.onHeartbeat = mk('heartbeat'); BG.onMotionChange = mk('motion'); BG.onProviderChange = mk('provider');
    // SDK 5.1.1 NativeModule.removeListeners: forEach over the list while remove() splices it.
    BG.removeListeners = () => { subs.forEach((x) => x.remove()); return Promise.resolve(); };
    try {
      // the model really is broken: 4 subscriptions, one sweep leaves 2
      BG.onLocation(() => {}); BG.onLocation(() => {}); BG.onLocation(() => {}); BG.onLocation(() => {});
      BG.removeListeners(); assert.strictEqual(subs.length, 2, 'SDK model removes every other one'); subs.length = 0;
      M.store.set(PARAMS, JSON.stringify({ participantId: '2', eventId: '12', intervalSeconds: 30 }));
      const g = load('services/gpsService');
      for (let i = 0; i < 6; i++) await g.headlessTask({ name: 'boot', params: {} });
      const per = {}; for (const x of subs) per[x.ev] = (per[x.ev] || 0) + 1;
      assert.deepStrictEqual(per, { provider: 1, location: 1, motion: 1, heartbeat: 1 });
    } finally { for (const n of names) BG[n] = saved[n]; }
  });
  test('re-check 10-20: engine start failure is a failed start — throws engine_start_failed, no half session, prior session restored', async () => {
    const BG = require('react-native-background-geolocation').default;
    const savedStart = BG.start;
    BG.start = async () => { throw new Error('start refused'); };
    try {
      let err = null;
      await withRN('ios', 'active', async () => { try { await startSession('4807', '19'); } catch (e) { err = e; } });
      const { ENGINE_START_FAILED_CODE } = load('services/gpsService');
      assert.ok(err && err.code === ENGINE_START_FAILED_CODE && ENGINE_START_FAILED_CODE === 'engine_start_failed', 'threw ' + (err && err.code));
      assert.ok(!M.store.has(PARAMS), 'fresh start leaves no session params');
      assert.notStrictEqual(M.store.get('@PFSLive:transistorActive'), '1');
      const prior = JSON.stringify({ participantId: '4807', eventId: '19', intervalSeconds: 30, raceStartTime: null });
      M.store.set(PARAMS, prior); err = null;
      await withRN('ios', 'active', async () => { try { await startSession('4807', '19'); } catch (e) { err = e; } });
      assert.ok(err, 'threw again'); assert.strictEqual(M.store.get(PARAMS), prior, 'prior session params put back');
      const log = await load('services/gpsService').getFullTrackingLog();
      assert.ok(log.some((e) => /Transistor start failed: start refused/.test(e.msg)), 'logged');
    } finally { BG.start = savedStart; }
  });
  test('re-check 10-20: Android engine start that fails after the app went to background → start_backgrounded (HomeScreen re-arms)', async () => {
    const BG = require('react-native-background-geolocation').default;
    const savedStart = BG.start;
    BG.start = async () => { RN.AppState.currentState = 'background'; throw new Error('bg start not allowed'); };
    try {
      let err = null;
      await withRN('android', 'active', async () => { try { await startSession('2', '12'); } catch (e) { err = e; } });
      assert.ok(err && err.code === 'start_backgrounded', 'code ' + (err && err.code));
      assert.ok(!M.store.has(PARAMS));
    } finally { BG.start = savedStart; }
  });
  test('re-check 10-20: start ping retries stand down when a flush already delivered it, or the race finished', async () => {
    const { sendTrackingStartPing, PENDING_START_PING_KEY } = TS();
    M.axios.script = ['network', 'ok', 'ok'];
    let r = await sendTrackingStartPing({ participantId: '2', eventId: '12', startedAfterGun: false, isStillTracking: () => true,
      sleep: async () => { M.store.delete(PENDING_START_PING_KEY); } });       // heartbeat flush delivered + cleared it
    assert.strictEqual(r, 'sent'); assert.strictEqual(startPosts().length, 1, 'no duplicate row');
    M.axios.calls = []; M.axios.script = ['network', 'ok'];
    r = await sendTrackingStartPing({ participantId: '2', eventId: '12', startedAfterGun: false, isStillTracking: () => true,
      sleep: async () => { M.store.set('@PFSLive:raceFinished', '1'); } });
    assert.strictEqual(r, 'stopped'); assert.strictEqual(startPosts().length, 1, 'no row after the finish');
    assert.ok(!M.store.has(PENDING_START_PING_KEY), 'pending cleared');
  });
  test('re-check 10-20: a delivered queue pass ends the drain-failure streak; so does a live Sent OK', async () => {
    setQ([fix(2, 12, 3), fix(2, 12, 2)]); M.store.set('@PFSLive:drainFailStreak', '4');
    assert.strictEqual(await L().processQueue('2', '12'), 2);
    assert.ok(!M.store.has('@PFSLive:drainFailStreak'), 'streak cleared by the queue pass');
    const g = fs.readFileSync(`${SRC}/services/gpsService.ts`, 'utf8').replace(/\r/g, '');
    assert.ok(/addLog\('✅', `Sent OK[^\n]*\n(?:\s*\/\/[^\n]*\n)*\s*try \{ await AsyncStorage\.removeItem\(DRAIN_FAILS_KEY\); \}/.test(g), 'live Sent OK clears it');
  });
  test('re-check 10-20: a busy (-1) or empty queue pass does not touch the streak', async () => {
    M.store.set('@PFSLive:drainFailStreak', '2');
    assert.strictEqual(await L().processQueue('2', '12'), 0);
    assert.strictEqual(M.store.get('@PFSLive:drainFailStreak'), '2');
  });
  test('re-check 10-20: Start refetch capped at 4 s with the loaded homeData as fallback; analytics cannot fail a running start', async () => {
    const s = homeLF;
    assert.ok(/const START_HOME_REFETCH_MS = 4000;/.test(s));
    assert.ok(/const fresh = await Promise\.race\(\[\n\s*fetchHomeData\(true\),\n\s*new Promise<null>\(\(resolve\) => setTimeout\(\(\) => resolve\(null\), START_HOME_REFETCH_MS\)\),\n\s*\]\);\n\s*const raceData = fresh \?\? homeData;/.test(s), 'raced, falls back');
    assert.ok(/void analyticsService\.markAsParticipant\('start_tracking'\)\.catch\(/.test(s), 'markAsParticipant not awaited into the catch');
    assert.ok(!/await analyticsService\.markAsParticipant/.test(s));
    for (const l of ['en', 'fr', 'nl']) {
      const j = JSON.parse(fs.readFileSync(`${SRC}/i18n/HomeScreen/${l}.json`, 'utf8'));
      assert.ok(!/Tap here|Appuyez ici|Tik hier/.test(j.tracking.notStartedBody), l + ': no "tap here" promise (a killed process does not resume the start)');
    }
  });
  test('re-check 10-20: the 4 s race really resolves to the fallback when home hangs', async () => {
    const START_HOME_REFETCH_MS = 40;
    const fetchHomeData = () => new Promise(() => {});        // half-open socket
    const homeData = { next_race_id: 19 };
    const t0 = Date.now();
    const fresh = await Promise.race([
      fetchHomeData(true),
      new Promise((resolve) => setTimeout(() => resolve(null), START_HOME_REFETCH_MS)),
    ]);
    assert.strictEqual(fresh ?? homeData, homeData); assert.ok(Date.now() - t0 < 1000);
  });
  // ── 2026-10-20 round 2: what the first re-check left open ──
  const SR = () => load('services/startReminderService');
  test('reminders: plan = 10 min before + 2 min after the gun, only future ones, none when not eligible or gun unknown', async () => {
    const { planStartReminders, START_REMINDER_PRE_ID, START_REMINDER_POST_ID } = SR();
    const gun = new Date(M.clock + 60 * 60000);
    const plan = planStartReminders(gun, M.clock, true);
    assert.deepStrictEqual(plan.map((x) => [x.id, x.at.getTime() - gun.getTime()]),
      [[START_REMINDER_PRE_ID, -10 * 60000], [START_REMINDER_POST_ID, 2 * 60000]]);
    assert.deepStrictEqual(planStartReminders(new Date(M.clock + 5 * 60000), M.clock, true).map((x) => x.kind), ['post'], 'inside T-10: only the post one');
    assert.deepStrictEqual(planStartReminders(new Date(M.clock - 3 * 60000), M.clock, true), [], 'gun +3 min: none left');
    assert.deepStrictEqual(planStartReminders(gun, M.clock, false), [], 'not eligible');
    assert.deepStrictEqual(planStartReminders(null, M.clock, true), [], 'gun unknown');
    assert.deepStrictEqual(planStartReminders(new Date('x'), M.clock, true), [], 'invalid gun');
  });
  const TEXTS = { preTitle: 'PT', preBody: 'PB', postTitle: 'QT', postBody: 'QB' };
  test('reminders: sync schedules both with fixed ids at the planned dates; a second sync replaces, never stacks', async () => {
    const { startReminderService, START_REMINDER_PRE_ID, START_REMINDER_POST_ID } = SR();
    const gun = new Date(M.clock + 60 * 60000);
    await startReminderService.sync({ gun, eligible: true, texts: TEXTS });
    await startReminderService.sync({ gun: new Date(gun.getTime() + 15 * 60000), eligible: true, texts: TEXTS });   // organiser moved the gun
    assert.deepStrictEqual(M.notif.pending.map((r) => r.identifier).sort(), [START_REMINDER_POST_ID, START_REMINDER_PRE_ID].sort(), 'exactly two pending');
    const pre = M.notif.pending.find((r) => r.identifier === START_REMINDER_PRE_ID);
    assert.strictEqual(pre.trigger.type, 'date');
    assert.strictEqual(pre.trigger.date.getTime(), gun.getTime() + 15 * 60000 - 10 * 60000, 'follows the moved gun');
    assert.deepStrictEqual([pre.content.title, pre.content.body, pre.content.data.type], ['PT', 'PB', 'start_reminder']);
  });
  test('reminders: tracking running (screen says so, OR a stored session after a cold start) → both cancelled, none scheduled', async () => {
    const { startReminderService } = SR();
    const gun = new Date(M.clock + 60 * 60000);
    await startReminderService.sync({ gun, eligible: true, texts: TEXTS });
    assert.strictEqual(M.notif.pending.length, 2);
    await startReminderService.sync({ gun, eligible: false, texts: TEXTS });
    assert.strictEqual(M.notif.pending.length, 0, 'screen not eligible → cancelled');
    M.store.set(PARAMS, JSON.stringify({ participantId: '2', eventId: '12' }));   // engine running, isGPSActive not restored yet
    await startReminderService.sync({ gun, eligible: true, texts: TEXTS });
    assert.strictEqual(M.notif.pending.length, 0, 'stored live session wins over the screen');
  });
  test('reminders: notifications unavailable → sync returns [] and never throws', async () => {
    const { startReminderService } = SR();
    M.notif.fail = true;
    assert.deepStrictEqual(await startReminderService.sync({ gun: new Date(M.clock + 3600000), eligible: true, texts: TEXTS }), []);
  });
  test('reminders: HomeScreen re-plans on every home answer + tracking change; eligible = Start offered and not tracking; texts in en/fr/nl', async () => {
    const m = homeLF.match(/useEffect\(\(\) => \{\n    const gun = homeData\?\.next_race_date[\s\S]*?\n  \}, \[homeData, isGPSActive, t\]\);/);
    assert.ok(m, 'reminder effect with deps [homeData, isGPSActive, t]');
    assert.ok(m[0].includes('computeRaceStartTime(homeData.next_race_date, homeData.next_race_time, serverTimeOffsetRef.current)'), 'same gun as the session');
    assert.ok(m[0].includes("eligible: homeData?.show_start_track === 1 && !!homeData?.next_race_participant_app_id && !isGPSActive,"));
    for (const l of ['en', 'fr', 'nl']) {
      const j = JSON.parse(fs.readFileSync(`${SRC}/i18n/HomeScreen/${l}.json`, 'utf8'));
      for (const k of ['preTitle', 'preBody', 'postTitle', 'postBody']) assert.ok(typeof j.reminders[k] === 'string' && j.reminders[k].length > 10, l + ' ' + k);
      assert.ok(/10/.test(j.reminders.preTitle), l + ': says 10 minutes');
    }
  });
  // The reminder effect's own gun expression, run with stand-ins (2026-10-21).
  const reminderGun = (homeData, offsetKnown = true, offsetMs = 2 * 3600000) => {
    const at = homeLF.indexOf('// ✅ Start reminders — see startReminderService.');
    assert.ok(at > 0, 'reminder effect found');
    const m = homeLF.slice(at).match(/\n    const gun = ([\s\S]*?);\n    void startReminderService\.sync\(/);
    assert.ok(m, 'gun expression found');
    return new Function('homeData', 'serverTimeOffsetKnownRef', 'serverTimeOffsetRef', 'computeRaceStartTime', 'return (' + m[1] + ');')(
      homeData, { current: offsetKnown }, { current: offsetMs }, R().computeRaceStartTime);
  };
  test('reminders: a placeholder start time (00:00 / 00:01, gun not set yet) schedules nothing — no 23:50 reminder the night before', async () => {
    for (const t of ['00:00', '00:01', '00:00:00', '00:01:00', ' 00:00:00 ']) {
      assert.strictEqual(reminderGun({ next_race_date: '2026-10-25', next_race_time: t }), null, JSON.stringify(t));
    }
  });
  test('reminders: a real start time still gives the session\'s gun (event offset applied); unknown offset / no date → none', async () => {
    for (const t of ['09:30:00', '00:02:00', '00:30', '12:00:00']) {
      const gun = reminderGun({ next_race_date: '2026-10-25', next_race_time: t });
      assert.ok(gun instanceof Date, t);
      assert.strictEqual(gun.getTime(), R().computeRaceStartTime('2026-10-25', t, 2 * 3600000).getTime(), t);
    }
    assert.strictEqual(reminderGun({ next_race_date: '2026-10-25', next_race_time: '09:30:00' }, false), null, 'offset unknown');
    assert.strictEqual(reminderGun({ next_race_date: '', next_race_time: '09:30:00' }) || null, null, 'no date');
    assert.strictEqual(reminderGun(undefined) || null, null, 'no home data');
  });
  test('persisted backgrounded start: resumes only within 10 min, only for the race home still offers with Start shown', async () => {
    const { shouldResumePendingStart, PENDING_BG_START_MAX_AGE_MS } = R();
    const home = { show_start_track: 1, next_race_participant_app_id: '4807', next_race_id: '19' };
    const p = { participantId: '4807', eventId: '19', at: M.clock - 60000 };
    assert.strictEqual(PENDING_BG_START_MAX_AGE_MS, 600000);
    assert.strictEqual(shouldResumePendingStart(p, home, M.clock), true);
    assert.strictEqual(shouldResumePendingStart({ ...p, at: M.clock - 601000 }, home, M.clock), false, 'too old');
    assert.strictEqual(shouldResumePendingStart({ ...p, at: M.clock + 5000 }, home, M.clock), false, 'from the future');
    assert.strictEqual(shouldResumePendingStart(p, { ...home, show_start_track: 0 }, M.clock), false, 'Start no longer offered');
    assert.strictEqual(shouldResumePendingStart(p, { ...home, next_race_id: '20' }, M.clock), false, 'another race');
    assert.strictEqual(shouldResumePendingStart({ eventId: '19', at: M.clock }, home, M.clock), false, 'no participant');
    assert.strictEqual(shouldResumePendingStart(null, home, M.clock), false);
    assert.strictEqual(shouldResumePendingStart(p, null, M.clock), false);
  });
  test('persisted backgrounded start: HomeScreen consumes it once on the first home answer, and only then starts; success clears it', async () => {
    const m = homeLF.match(/const coldPendingCheckedRef = useRef\(false\);\n  useEffect\(\(\) => \{([\s\S]*?)\n  \}, \[homeData\]\);/);
    assert.ok(m, 'cold-start effect');
    const b = m[1];
    const iGet = b.indexOf('AsyncStorage.getItem(PENDING_BG_START_KEY)');
    const iDel = b.indexOf('AsyncStorage.removeItem(PENDING_BG_START_KEY)');
    const iRule = b.indexOf('shouldResumePendingStart(pending, homeData, Date.now())');
    const iStart = b.indexOf('await doStartGPSTrackingRef.current();');
    assert.ok(iGet > 0 && iDel > iGet && iRule > iDel && iStart > iRule, 'read → consume → decide → start');
    assert.ok(b.includes('if (coldPendingCheckedRef.current || !homeData) return;') && b.includes('coldPendingCheckedRef.current = true;'), 'once');
    assert.ok(b.includes('isGPSActiveRef.current ||'), 'never while tracking');
    assert.ok(/toastSuccess\(t\('home:tracking\.gpsActivated'\), message\);\n\s*void AsyncStorage\.removeItem\(PENDING_BG_START_KEY\)/.test(homeLF), 'a successful start clears it');
  });
  test('queue: addToQueue says whether it stored the fix (throttle drop → false); offline send reports "not queued" for a dropped fix', async () => {
    M.store.set(PARAMS, JSON.stringify({ participantId: '2', eventId: '12', intervalSeconds: 60 }));
    const { locationQueueService: q } = Q();
    assert.strictEqual(await q.addToQueue(fix(2, 12, 1), true), true, 'stored');
    assert.strictEqual(await q.addToQueue(fix(2, 12, 0), true), false, 'throttled within the interval');
    assert.strictEqual(await q.addToQueue(fix(2, 12, 0), false), true, 'unthrottled insert stored');
    M.net = { isConnected: false, isInternetReachable: false }; M.api.mode = 'down';
    const r = await L().sendLocation('2', '12', { latitude: 50, longitude: 4, timestamp: new Date(M.clock).toISOString() });
    assert.ok(/^Location not queued — queue throttle/.test(r.message), r.message);
    const g = fs.readFileSync(`${SRC}/services/gpsService.ts`, 'utf8').replace(/\r/g, '');
    assert.ok(/const stored = await locationQueueService\.addToQueue\(/.test(g) && /if \(stored\) await addLog\('📥', `Backlog present/.test(g), 'backlog line only when stored');
  });
  test('send-gap label: a restart or a queue period in the gap is named, not "movement filter"', async () => {
    const g = fs.readFileSync(`${SRC}/services/gpsService.ts`, 'utf8').replace(/\r/g, '');
    assert.ok(/const _jsContextStartedAt = Date\.now\(\);/.test(g));
    const m = g.match(/const suffix = gapSec <= \(expectedSec \+ 10\) \? ''\n\s*: restartedInGap \? [^\n]*\n\s*: queuedInGap \? [^\n]*\n\s*: isFreeze \? [^\n]*\n\s*: \(longPause \? [^\n]*/);
    assert.ok(m, 'restart → queue → freeze → pause, in that order');
    assert.ok(/const restartedInGap = _jsContextStartedAt > lastSentAt;/.test(g) && /const queuedInGap = lastQueuedAt > lastSentAt;/.test(g));
  });
  // ── 2026-10-20 battery: check at every Android Start, state in the log ──
  const { reset } = require('./harness');
  const battLines = async () => (await load('services/gpsService').getFullTrackingLog()).map((e) => e.msg).filter((m) => /Battery|Saver/.test(m));
  test('battery: Start logs level, saver, optimisation and charging (Android, optimisation ON)', async () => {
    M.battery.power = { batteryLevel: 0.42, lowPowerMode: false, batteryState: 1 }; M.battery.optimized = true;
    await withRN('android', 'active', () => startSession('2', '12'));
    assert.deepStrictEqual(await battLines(), ['Battery (start) — level:42% saver:off optimisation:ON (Android may pause Livio) charging:no']);
    assert.strictEqual(M.store.get('@PFSLive:lastPowerSaver'), '0');
  });
  test('battery: iOS logs optimisation n/a; charging phone says yes; unreadable battery → "?" and the start still works', async () => {
    M.battery.power = { batteryLevel: 0.9, lowPowerMode: true, batteryState: 2 };
    await withRN('ios', 'active', () => startSession('2', '12'));
    assert.deepStrictEqual(await battLines(), ['Battery (start) — level:90% saver:ON optimisation:n/a charging:yes']);
    reset(); M.battery.fail = true;
    await withRN('android', 'active', () => startSession('2', '12'));
    assert.ok(M.store.has(PARAMS), 'started');
    assert.deepStrictEqual(await battLines(), ['Battery (start) — level:?% saver:? optimisation:? charging:?']);
  });
  test('battery: heartbeat logs a Battery Saver CHANGE once (on, then off), never every beat', async () => {
    M.battery.power = { batteryLevel: 0.2, lowPowerMode: false, batteryState: 1 }; M.battery.optimized = false;
    await withRN('android', 'active', () => startSession('2', '12'));
    await M.bg.heartbeat(); await M.bg.heartbeat();
    M.battery.power = { batteryLevel: 0.15, lowPowerMode: true, batteryState: 1 };
    await M.bg.heartbeat(); await M.bg.heartbeat();
    M.battery.power = { batteryLevel: 0.15, lowPowerMode: false, batteryState: 1 };
    await M.bg.heartbeat();
    assert.deepStrictEqual(await battLines(), [
      'Battery (start) — level:20% saver:off optimisation:off (exempt) charging:no',
      'Battery Saver turned ON during the session (level:15%) — Android/iOS may throttle tracking',
      'Battery Saver turned off (level:15%)',
    ]);
  });
  test('battery: isBatteryOptimized — Android reads the OS, iOS never asks, errors → false', async () => {
    const { gpsService } = load('services/gpsService');
    M.battery.optimized = true;
    assert.strictEqual(await withRN('android', 'active', () => gpsService.isBatteryOptimized()), true);
    M.battery.optimized = false;
    assert.strictEqual(await withRN('android', 'active', () => gpsService.isBatteryOptimized()), false);
    M.battery.optimized = true;
    assert.strictEqual(await withRN('ios', 'active', () => gpsService.isBatteryOptimized()), false);
    M.battery.fail = true;
    assert.strictEqual(await withRN('android', 'active', () => gpsService.isBatteryOptimized()), false);
  });
  // The real block from startGPSTracking, run with stand-ins.
  const runBatteryGate = async ({ os = 'android', optimized = true, choice = null }) => {
    const m = homeLF.match(/\n    if \(Platform\.OS === 'android' && \(await gpsService\.isBatteryOptimized\(\)\)\) \{([\s\S]*?)\n    \}\n/);
    assert.ok(m, 'battery gate found in startGPSTracking');
    const calls = { asked: 0, shown: [], exempt: 0, steps: [] };
    const ref = { current: null };
    // growth_v0.1: the gate also logs the start funnel (analyticsService, raceReadyKey)
    const fn = new Function('Platform', 'gpsService', 'batteryStartResolveRef', 'setShowBatteryStartModal', 'requestBatteryOptimizationExemption', 'analyticsService', 'raceReadyKey',
      'return (async () => { if (Platform.OS === \'android\' && (await gpsService.isBatteryOptimized())) {' + m[1].replace(/new Promise<[^>]*>\(/g, 'new Promise(') + '\n} return \'continued\'; })();');
    const p = fn({ OS: os }, { isBatteryOptimized: async () => { calls.asked++; return optimized; } }, ref,
      (v) => calls.shown.push(v), async () => { calls.exempt++; },
      { logStartStep: async (...a) => { calls.steps.push(a); } }, '19');
    await new Promise((r) => setTimeout(r, 5));
    if (choice) { assert.ok(typeof ref.current === 'function', 'popup waiting for an answer'); ref.current(choice); }
    return { result: await p, calls };
  };
  test('battery gate at Start: Android + optimisation ON → popup; Allow opens the exemption then continues; Start anyway continues; Back cancels', async () => {
    let r = await runBatteryGate({ choice: 'allow' });
    assert.deepStrictEqual([r.result, r.calls.shown, r.calls.exempt], ['continued', [true], 1]);
    r = await runBatteryGate({ choice: 'anyway' });
    assert.deepStrictEqual([r.result, r.calls.exempt], ['continued', 0]);
    r = await runBatteryGate({ choice: 'cancel' });
    assert.deepStrictEqual([r.result, r.calls.exempt], [undefined, 0], 'start abandoned');
    assert.deepStrictEqual(r.calls.steps, [['blocked', 'battery_optimization', '19']], 'growth_v0.1: the abandoned start is a funnel step');
    for (const choice of ['allow', 'anyway']) assert.deepStrictEqual((await runBatteryGate({ choice })).calls.steps, [], choice + ': no blocked step');
    r = await runBatteryGate({ optimized: false });
    assert.deepStrictEqual([r.result, r.calls.shown], ['continued', []], 'exempt → no popup');
    r = await runBatteryGate({ os: 'ios' });
    assert.deepStrictEqual([r.result, r.calls.asked, r.calls.shown], ['continued', 0, []], 'iOS never asks');
  });
  test('battery gate at Start: after Battery Saver, before the early-start warning; popup wired (Allow / Start anyway / Back = cancel); texts in en/fr/nl', async () => {
    const fnAt = homeLF.indexOf('const startGPSTracking = useCallback(async () => {');
    const iSaver = homeLF.indexOf('const isPowerSaving = await checkPowerSavingMode();', fnAt);
    const iGate = homeLF.indexOf("if (Platform.OS === 'android' && (await gpsService.isBatteryOptimized())) {", fnAt);
    const iWarn = homeLF.indexOf('// Warn for ANY start before the gun', fnAt);
    assert.ok(fnAt > 0 && iSaver > fnAt && iGate > iSaver && iWarn > iGate, 'order');
    const jsx = modalJsx('showBatteryStartModal');
    for (const k of ['onPress={handleBatteryStartAllow}', 'onPress={handleBatteryStartAnyway}', 'onRequestClose={handleBatteryStartCancel}',
      "t('home:battery.allow')", "t('home:battery.startAnyway')"]) assert.ok(jsx.includes(k), k);
    const c = cb('resolveBatteryStart', ''); const shown = []; const got = [];
    const ref = { current: (x) => got.push(x) };
    const run = new Function('setShowBatteryStartModal', 'batteryStartResolveRef', 'return (' + c.params.replace(/:[^)]*$/, '') + ') => {' + c.body + '\n};')((v) => shown.push(v), ref);
    run('anyway'); run('allow');
    assert.deepStrictEqual([shown, got, ref.current], [[false, false], ['anyway'], null], 'settles exactly once');
    for (const l of ['en', 'fr', 'nl']) {
      const j = JSON.parse(fs.readFileSync(`${SRC}/i18n/HomeScreen/${l}.json`, 'utf8'));
      assert.ok(j.battery.startAnyway && j.battery.allow && j.battery.title && j.battery.message, l);
    }
  });
  const paceAfter = async (fn) => { const before = (M.bg.pace || []).length; await fn(); await new Promise((r) => setTimeout(r, 20)); return (M.bg.pace || []).slice(before); };
  test('stationary transition while the race is on → engine re-asserted moving (and logged)', async () => {
    await startSession('2', '12');                                   // gun 1h ago
    assert.deepStrictEqual(await paceAfter(() => M.bg.motion({ isMoving: false })), [true]);
    const log = (await load('services/gpsService').getFullTrackingLog()).map((e) => e.msg);
    assert.ok(log.includes('Went stationary while the race is on / gun is close — re-asserted moving'));
    assert.deepStrictEqual(await paceAfter(() => M.bg.motion({ isMoving: true })), [], 'moving → nothing to do');
  });
  test('stationary transition: gun in 20 / 50 min → moving; gun in 2 h → left idle; after the finish → left idle', async () => {
    await startSession('2', '12', new Date(M.clock + 20 * 60000).toISOString());
    assert.deepStrictEqual(await paceAfter(() => M.bg.motion({ isMoving: false })), [true], 'inside the window');
    reset();
    await startSession('2', '12', new Date(M.clock + 50 * 60000).toISOString());
    assert.deepStrictEqual(await paceAfter(() => M.bg.motion({ isMoving: false })), [true], '50 min: inside the 60-min window');
    reset();
    await startSession('2', '12', new Date(M.clock + 120 * 60000).toISOString());
    assert.deepStrictEqual(await paceAfter(() => M.bg.motion({ isMoving: false })), [], 'long before the gun: battery saved');
    reset();
    await startSession('2', '12');
    M.store.set('@PFSLive:raceFinished', '1');
    assert.deepStrictEqual(await paceAfter(() => M.bg.motion({ isMoving: false })), [], 'finished');
  });
  test('PRE_GUN_WAKE_MS is 60 min; a heartbeat 45 min before the gun keeps the engine moving (the p4823 gap)', async () => {
    assert.strictEqual(load('services/gpsService').PRE_GUN_WAKE_MS, 60 * 60000);
    await startSession('4823', '19', new Date(M.clock + 45 * 60000).toISOString());
    M.bg.pace = []; await M.bg.heartbeat({});
    assert.deepStrictEqual(M.bg.pace, [true]);
    const log = await load('services/gpsService').getFullTrackingLog();
    assert.ok(log.some((e) => /Heartbeat — gun in 45min, engine kept moving/.test(e.msg)));
  });
  test('Battery Saver gate runs on EVERY start path: first thing in doStartGPSTracking, before the permission gate', async () => {
    const at = homeLF.indexOf('const doStartGPSTracking = useCallback(async () => {');
    const iTry = homeLF.indexOf('\n    try {', at);
    // growth_v0.1: the gate logs the blocked start step before the popup
    const iSaver = homeLF.indexOf("if (await checkPowerSavingMode()) {\n        // growth_v0.1: every gate that stops a start is a funnel step\n        void analyticsService.logStartStep('blocked', 'power_saving', raceReadyKey);\n        setShowPowerSavingModal(true);\n        return;\n      }", at);
    const iPerm = homeLF.indexOf('const perms = await gpsService.getPermissionState();', at);
    assert.ok(iTry > at && iSaver > iTry && iPerm > iSaver, 'saver gate before permissions, inside doStartGPSTracking');
    const end = homeLF.indexOf('\n  }, [\n    hasPermission,', at);
    assert.ok(homeLF.slice(end, homeLF.indexOf(']);', end)).includes('checkPowerSavingMode'), 'in the deps');
    // the resumed paths all go through doStartGPSTracking
    for (const re of [/pendingStartRef\.current = false;\n\s*setShowLocationPermissionModal\(false\);\n\s*await doStartGPSTrackingRef\.current\(\);/,
      /shouldResumePendingStart\(pending, homeData, Date\.now\(\)\)\) return;\n\s*await doStartGPSTrackingRef\.current\(\);/,
      /pendingStartRef\.current = false;\n\s*await doStartGPSTracking\(\);/]) assert.ok(re.test(homeLF), String(re));
    // and the power-saving popup offers no way to start: settings or close only
    const jsx = modalJsx('showPowerSavingModal');
    assert.ok(!/doStartGPSTracking|startGPSTracking/.test(jsx), 'no start from the Battery Saver popup');
  });
  test('Battery Saver switched ON mid-race → one notification to the runner (and none when it goes off)', async () => {
    M.battery.power = { batteryLevel: 0.3, lowPowerMode: false, batteryState: 1 };
    await startSession('2', '12');
    M.battery.power = { batteryLevel: 0.18, lowPowerMode: true, batteryState: 1 };
    await M.bg.heartbeat({}); await M.bg.heartbeat({});
    M.battery.power = { batteryLevel: 0.18, lowPowerMode: false, batteryState: 1 };
    await M.bg.heartbeat({});
    // Not counting the tracking safety net's own notifications (section 15).
    const notes = M.notif.log.filter((x) => x[0] === 'schedule' && !String(x[1]).startsWith('livio-'));
    assert.strictEqual(notes.length, 1, 'once');
    const n = M.notif.pending.find((r) => r.content && r.content.data && r.content.data.type === 'battery_saver');
    assert.ok(n && n.trigger === null && n.content.title === 'home:powerSaving.midRaceTitle', 'immediate, translated');
    for (const l of ['en', 'fr', 'nl']) {
      const j = JSON.parse(fs.readFileSync(`${SRC}/i18n/HomeScreen/${l}.json`, 'utf8'));
      assert.ok(j.powerSaving.midRaceTitle && j.powerSaving.midRaceBody, l);
    }
  });
  // ── final confirmation pass (2026-10-20) ──
  test('hasNetwork({ allowProbe:false }): a probe window is not "online" (dead zone keeps the queue throttled); a real send or NetInfo online is', async () => {
    const { locationQueueService: q } = Q();
    M.net = { isConnected: false, isInternetReachable: false };
    assert.strictEqual(await q.hasNetwork(), true, 'probe opens for the send path');
    assert.strictEqual(await q.hasNetwork({ allowProbe: false }), false, '…but it is no drain');
    M.net = { isConnected: true, isInternetReachable: false };
    assert.strictEqual(await q.hasNetwork({ allowProbe: false }), false, 'unreachable, no real send yet');
    q.markSendSucceeded();
    assert.strictEqual(await q.hasNetwork({ allowProbe: false }), true, 'a real send = drain');
    M.net = { isConnected: true, isInternetReachable: true };
    M.clock += 61000;
    assert.strictEqual(await q.hasNetwork({ allowProbe: false }), true, 'NetInfo online');
    const g = fs.readFileSync(`${SRC}/services/gpsService.ts`, 'utf8');
    assert.ok(/const online = await locationQueueService\.hasNetwork\(\{ allowProbe: false \}\);/.test(g), 'backlog guard asks without the probe');
  });
  test('hasNetwork({ allowProbe:false }) never opens a probe window (the send path still gets its probe)', async () => {
    const { locationQueueService: q } = Q();
    M.net = { isConnected: false, isInternetReachable: false };
    assert.strictEqual(await q.hasNetwork({ allowProbe: false }), false);
    assert.strictEqual(await q.hasNetwork(), true, 'first real probe still available');
  });
  test('every home:/common: text the changed screens and services use exists in en, fr and nl', async () => {
    const files = ['screens/HomeScreen.tsx', 'services/gpsService.ts', 'services/trackingStartService.ts', 'services/startReminderService.ts'];
    const keys = new Set();
    for (const f of files) {
      // code only: comments may name keys on purpose (e.g. the retired powerSaving.message)
      const src = fs.readFileSync(`${SRC}/${f}`, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      for (const m of src.matchAll(/\bt\(\s*'((?:home|common):[A-Za-z0-9_.]+)'/g)) keys.add(m[1]);
    }
    assert.ok(keys.size > 40, 'found the keys: ' + keys.size);
    const ns = { home: 'HomeScreen', common: 'common' };
    const missing = [];
    for (const l of ['en', 'fr', 'nl']) {
      const j = {};
      for (const [n, dir] of Object.entries(ns)) j[n] = JSON.parse(fs.readFileSync(`${SRC}/i18n/${dir}/${l}.json`, 'utf8'));
      for (const k of keys) {
        const [n, path] = k.split(':');
        const v = path.split('.').reduce((o, p) => (o && typeof o === 'object' ? o[p] : undefined), j[n]);
        // a string, or a list read with returnObjects (e.g. common:monthsShort)
        const ok = (typeof v === 'string' && v.trim()) || (Array.isArray(v) && v.length && v.every((x) => typeof x === 'string' && x.trim()));
        if (!ok) missing.push(`${l} ${k}`);
      }
    }
    assert.deepStrictEqual(missing, []);
  });
  test('BackgroundGeolocation.removeListeners() is called only from _removeTransistorListeners (SDK 5.1.1 removes every other one)', async () => {
    const g = fs.readFileSync(`${SRC}/services/gpsService.ts`, 'utf8').replace(/\r/g, '');
    const code = g.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
    const calls = [...code.matchAll(/BackgroundGeolocation\.removeListeners\(\)/g)].length;
    assert.strictEqual(calls, 1, 'one call: the sweep inside the helper');
    assert.ok(/const _removeTransistorListeners = \(\): void => \{[\s\S]{0,300}BackgroundGeolocation\.removeListeners\(\)/.test(code));
    assert.strictEqual([...code.matchAll(/BackgroundGeolocation\.on(Location|Heartbeat|MotionChange|ProviderChange)\(/g)].length, 4);
    assert.strictEqual([...code.matchAll(/_trackTransistorSub\(BackgroundGeolocation\.on(Location|Heartbeat|MotionChange|ProviderChange)\(/g)].length, 4, 'every listener tracked');
  });
  results.push(await run('13. event 19 review (silent iOS starts, persisted start ping, pre-gun wake, zombie sessions, interim race, log dup)'));

  // ════════════ 14. Grizzly100 pre-race (2026-10-24): 18 h sessions ════════════
  test('Grizzly100: 18 h offline at 45 s spacing (1440 fixes) keeps every fix, the first one included', async () => {
    const { locationQueueService: q } = Q();
    for (let i = 0; i < 1440; i++) await q.addToQueue(fix(2, 20, 1440 - i), false);
    const kept = getQ();
    assert.strictEqual(kept.length, 1440, 'nothing discarded');
    assert.strictEqual(kept[0].timestamp, fix(2, 20, 1440).timestamp, 'the race start is still there');
    assert.strictEqual(M.store.get(QCK), '1440');
  });
  test('Grizzly100: past 1500 the OLDEST fix still makes room (cap kept, newest last)', async () => {
    setQ(Array.from({ length: 1500 }, (_, i) => fix(2, 20, 2000 - i)));
    const { locationQueueService: q } = Q();
    await q.addToQueue(fix(2, 20, 0), false);
    const kept = getQ();
    assert.strictEqual(kept.length, 1500);
    assert.strictEqual(kept[0].timestamp, fix(2, 20, 1999).timestamp);
    assert.strictEqual(kept[kept.length - 1].timestamp, fix(2, 20, 0).timestamp);
  });
  test('Grizzly100: once the 40 log segments are full, a backgrounded app writes the log at most once per 15 s (was: every entry)', async () => {
    const RN = require('react-native');
    const AS = require('@react-native-async-storage/async-storage').default;
    const g = load('services/gpsService');
    const saved = RN.AppState.currentState; RN.AppState.currentState = 'background';
    try {
      for (let i = 0; i < 40 * 500 + 10; i++) await g.addLog('🧪', 'fill-' + i);   // 40 segments sealed, ceiling reached
      assert.strictEqual(M.store.get('@PFSLive:trackingLogSegCount'), '40');
      const real = AS.setItem; let writes = 0;
      AS.setItem = async (k, v) => { if (k === '@PFSLive:trackingLog') writes++; return real(k, v); };
      try {
        for (let i = 0; i < 800; i++) { await g.addLog('🧪', 'late-' + i); M.clock += 1000; }   // 800 entries over ~13 min: the last ~300 hit the rolling window
      } finally { AS.setItem = real; }
      assert.ok(writes <= 56, `background writes throttled: ${writes} for 800 entries`);
      await g.flushTrackingLog();
      const cur = JSON.parse(M.store.get('@PFSLive:trackingLog'));
      assert.strictEqual(cur[cur.length - 1].msg, 'late-799', 'the newest entry is persisted by the next flush');
      assert.ok(cur.length <= 500, 'rolling window stays one segment');
    } finally { RN.AppState.currentState = saved; }
  });
  // The bigger queue through every other flow that reads it (Stop, orphans, restart, drain).
  const full = () => Array.from({ length: 1500 }, (_, i) => fix(2, 20, 1125 - i * 0.75));   // 18.75 h at 45 s, oldest first
  test('Grizzly100: Stop while offline with 1500 queued → nothing lost; all uploaded later, oldest first, is_queued=1', async () => {
    setQ(full());
    M.net = { isConnected: false, isInternetReachable: false }; M.api.mode = 'down';
    assert.strictEqual(await L().drainForStop('2', '20', 30000, FAST), 0);
    assert.strictEqual(await L().drainOrphans(), 0);
    assert.strictEqual(getO().length + getQ().length, 1500, 'all parked (orphan cap is 2000)');
    M.net = { isConnected: true, isInternetReachable: true }; M.api.mode = 'ok'; M.clock += 3600000;
    let sent = 0; for (let i = 0; i < 40 && (getO().length || getQ().length); i++) sent += await L().drainOrphans(45000);
    assert.strictEqual(sent, 1500); assert.strictEqual(M.api.posted.length, 1500);
    const ts = M.api.posted.map((p) => new Date(p.body.timestamp).getTime());
    assert.ok(ts.every((t) => t > 0), 'every body carries its timestamp');
    assert.ok(ts.every((t, i) => i === 0 || t > ts[i - 1]), 'strictly ascending — oldest first');
    assert.ok(M.api.posted.every((p) => p.body.is_queued === 1));
  });
  test('Grizzly100: Start again on the same race with 1500 parked → all 1500 back in the queue, none trimmed', async () => {
    M.store.set(OK_, JSON.stringify(full()));
    await startSession('2', '20');
    assert.strictEqual(getQ().length, 1500); assert.strictEqual(getO().length, 0);
  });
  test('Grizzly100: back online with 1500 queued → drained 50 a pass, every fix once, in order, queue empty', async () => {
    setQ(full());
    const svc = L(); let passes = 0;
    while (getQ().length && passes < 60) { const n = await svc.processQueue('2', '20'); assert.ok(n > 0, 'progress each pass'); passes++; }
    assert.strictEqual(getQ().length, 0); assert.strictEqual(M.store.get(QCK), '0');
    assert.strictEqual(passes, 30, '1500 / 50');
    assert.strictEqual(M.api.posted.length, 1500, 'no duplicates');
    const sentTs = M.api.posted.map((p) => JSON.stringify(p.body));
    assert.strictEqual(new Set(sentTs).size, 1500);
  });
  test('Grizzly100: a full queue of realistic fixes stays well under the 2 MB AsyncStorage read limit', async () => {
    const real = { latitude: 50.7712345678901, longitude: 5.7623456789012, altitude: 187.4000015258789, accuracy: 4.743000030517578,
      altitudeAccuracy: 3.0999999046325684, timestamp: new Date(M.clock).toISOString(), speed: 2.6100001335144043, heading: 184.3800048828125,
      isMock: false, isMoving: true, elevationGain: 1234.5678, batteryLevel: 57, batteryCharging: false, participantId: '4789', eventId: '20',
      queuedAt: new Date(M.clock).toISOString(), retryCount: 0 };
    const { locationQueueService: q } = Q();
    for (let i = 0; i < 1500; i++) await q.addToQueue({ ...real, timestamp: new Date(M.clock + i).toISOString() }, false);
    const bytes = M.store.get(QK).length;
    assert.ok(bytes < 1024 * 1024, `queue value ${(bytes / 1048576).toFixed(2)} MB`);
    assert.strictEqual((await q.getQueue()).length, 1500, 'reads back whole');
  });
  results.push(await run('14. Grizzly100 pre-race: 18 h offline queue, full-log write throttle'));

  // ════════════ 15. Tracking safety net (2026-10-24: 5 silent starts, phones killed Livio) ════════════
  const SAF = () => load('services/trackingSafetyService');
  const pending = (id) => M.notif.pending.find((r) => r.identifier === id);
  const at = (id) => { const p = pending(id); return p ? new Date(p.trigger.date).getTime() : null; };
  const schedules = (id) => M.notif.log.filter(([k, i]) => k === 'schedule' && i === id).length;
  const settleS = () => new Promise((r) => setTimeout(r, 40));
  let latS = 50.75;
  const fireFix = async () => {
    latS += 0.001;   // ~111 m — clears the movement gate
    M.bg.location({ coords: { latitude: latS, longitude: 5.75, speed: 3, accuracy: 5, altitude: 200, heading: 0 }, timestamp: new Date(M.clock).toISOString(), is_moving: true });
    await settleS();
  };
  test('plan: Start 50 min before the gun → check at gun + 4 min, "open Livio" reminder at gun - 10 min', async () => {
    const { planSafetyArm } = SAF(); const now = 1_000_000_000_000, gun = now + 50 * 60000;
    assert.deepStrictEqual(planSafetyArm(gun, now, false), { checkAt: gun + 4 * 60000, earlyAt: gun - 10 * 60000 });
  });
  test('plan: Start 20 min before → check only (no early reminder); Start after the gun → now + 4 min; manual → now + 4 min; no gun → nothing', async () => {
    const { planSafetyArm } = SAF(); const now = 1_000_000_000_000;
    assert.deepStrictEqual(planSafetyArm(now + 20 * 60000, now, false), { checkAt: now + 24 * 60000, earlyAt: null });
    assert.deepStrictEqual(planSafetyArm(now - 30 * 60000, now, false), { checkAt: now + 4 * 60000, earlyAt: null });
    assert.deepStrictEqual(planSafetyArm(null, now, true), { checkAt: now + 4 * 60000, earlyAt: null });
    assert.deepStrictEqual(planSafetyArm(null, now, false), { checkAt: null, earlyAt: null });
  });
  test('watchdog reschedule: at most once a minute; a stamp in the future re-arms', async () => {
    const { shouldRescheduleWatchdog } = SAF(); const now = 1_000_000_000_000;
    assert.strictEqual(shouldRescheduleWatchdog(null, now), true);
    assert.strictEqual(shouldRescheduleWatchdog(now - 30000, now), false);
    assert.strictEqual(shouldRescheduleWatchdog(now - 60000, now), true);
    assert.strictEqual(shouldRescheduleWatchdog(now + 5000, now), true);
  });
  test('real Start 50 min before the gun → "not tracking" check at gun + 4 and early reminder at gun - 10 are scheduled', async () => {
    const gun = M.clock + 50 * 60000;
    await startSession('2', '20', new Date(gun).toISOString());
    assert.strictEqual(at('livio-tracking-check'), gun + 4 * 60000);
    assert.strictEqual(at('livio-early-start-reminder'), gun - 10 * 60000);
    assert.ok(!pending('livio-tracking-watchdog'), 'no watchdog before the race');
  });
  test('the phone is killed after Start (no heartbeat, no fix) → the check stays scheduled, so the OS still delivers it', async () => {
    await startSession('2', '20', new Date(M.clock + 20 * 60000).toISOString());
    M.clock += 30 * 60000;   // past the gun, the app never woke again
    assert.ok(pending('livio-tracking-check'), 'still pending — nothing alive cancelled it');
  });
  test('heartbeat BEFORE the gun (engine alive) → the check is NOT cancelled (alive before the race is not the race)', async () => {
    await startSession('2', '20', new Date(M.clock + 20 * 60000).toISOString());
    await M.bg.heartbeat({});
    assert.ok(pending('livio-tracking-check'));
  });
  test('start crowd: heartbeat after the gun with no GPS fix yet → check cancelled, watchdog at now + 15 min (no false alarm)', async () => {
    await startSession('2', '20', new Date(M.clock - 2 * 60000).toISOString());
    M.clock += 60000;
    await M.bg.heartbeat({});
    assert.ok(!pending('livio-tracking-check'), 'check cancelled');
    assert.strictEqual(at('livio-tracking-watchdog'), M.clock + 15 * 60000);
  });
  test('a GPS fix after the gun → check cancelled and watchdog armed (send path)', async () => {
    await startSession('2', '20', new Date(M.clock - 5 * 60000).toISOString());
    await fireFix();
    assert.ok(!pending('livio-tracking-check'));
    assert.ok(pending('livio-tracking-watchdog'));
  });
  test('watchdog moves on with every sign of life, but at most once a minute (no notification churn on 1 Hz fixes)', async () => {
    await startSession('2', '20', new Date(M.clock - 5 * 60000).toISOString());
    await fireFix();
    const first = schedules('livio-tracking-watchdog');
    for (let i = 0; i < 5; i++) { M.clock += 5000; await fireFix(); }   // 25 s of fixes
    assert.strictEqual(schedules('livio-tracking-watchdog'), first, 'not rescheduled within the minute');
    M.clock += 40000; await fireFix();
    assert.strictEqual(schedules('livio-tracking-watchdog'), first + 1);
    assert.strictEqual(at('livio-tracking-watchdog'), M.clock + 15 * 60000, 'pushed to 15 min after the latest sign of life');
  });
  test('the app dies mid-race → the last watchdog (15 min after the last sign of life) stays scheduled for the OS', async () => {
    await startSession('2', '20', new Date(M.clock - 5 * 60000).toISOString());
    await fireFix(); const lastAlive = M.clock;
    M.clock += 20 * 60000;   // no more fixes or heartbeats
    assert.strictEqual(at('livio-tracking-watchdog'), lastAlive + 15 * 60000);
  });
  test('Stop → check, watchdog and early reminder all cancelled', async () => {
    await startSession('2', '20', new Date(M.clock + 50 * 60000).toISOString());
    await load('services/gpsService').stopWatching();
    for (const id of ['livio-tracking-check', 'livio-tracking-watchdog', 'livio-early-start-reminder']) assert.ok(!pending(id), id);
  });
  test('stopWatching (finish / stale / any full stop) disarms too', async () => {
    await startSession('2', '20', new Date(M.clock - 5 * 60000).toISOString());
    await fireFix();
    await load('services/gpsService').stopWatching();
    assert.ok(!pending('livio-tracking-watchdog') && !pending('livio-tracking-check'));
  });
  test('notifications denied / unavailable → Start still works and tracking is unaffected', async () => {
    M.notif.fail = true;
    const h = await startSession('2', '20', new Date(M.clock - 5 * 60000).toISOString());
    assert.ok(h && typeof h.remove === 'function', 'session started');
    await fireFix(); M.clock += 60000; await fireFix();   // the second fix, after moving, is sent
    assert.ok(M.api.posted.some((p) => p.url.includes('insert_participant_location')), 'the fix was still sent');
  });
  test('a tap only opens Livio: the notifications carry no race_id / event_name (no result-detail navigation)', async () => {
    await startSession('2', '20', new Date(M.clock + 50 * 60000).toISOString());
    for (const id of ['livio-tracking-check', 'livio-early-start-reminder']) {
      const d = pending(id).content.data;
      assert.deepStrictEqual(d, { type: 'tracking_check' }, id);
    }
  });
  test('start ping diag: battery level, Battery Saver, Android optimisation, charging and Android brand.model', async () => {
    const RN = require('react-native'); const o = RN.Platform.OS, c = RN.Platform.constants;
    RN.Platform.OS = 'android'; RN.Platform.constants = { Brand: 'samsung', Model: 'SM-S918B' };
    M.battery = { ...M.battery, power: { batteryLevel: 0.87, lowPowerMode: false, batteryState: 1 }, optimized: true };
    try {
      const d = await load('services/trackingStartService').buildStartDiag(false);
      assert.strictEqual(d.batt, '87'); assert.strictEqual(d.saver, false); assert.strictEqual(d.opt, true);
      assert.strictEqual(d.chg, false); assert.strictEqual(d.dev, 'samsung.SM-S918B');
      assert.strictEqual(d.platform, 'android'); assert.ok('perm' in d, 'existing keys kept');
    } finally { RN.Platform.OS = o; RN.Platform.constants = c; }
  });
  test('start ping diag on iOS / battery unreadable → only the existing keys, never an error', async () => {
    M.battery = { ...M.battery, fail: true };
    const d = await load('services/trackingStartService').buildStartDiag(false);
    assert.ok(!('batt' in d) && !('dev' in d) && !('opt' in d));
    assert.strictEqual(d.platform, 'ios');
  });
  test('texts: safety notifications and the Start popup lines exist in en / fr / nl', async () => {
    for (const l of ['en', 'fr', 'nl']) {
      const j = JSON.parse(fs.readFileSync(`${SRC}/i18n/HomeScreen/${l}.json`, 'utf8'));
      for (const k of ['checkTitle', 'checkBody', 'watchdogTitle', 'watchdogBody', 'earlyTitle', 'earlyBody']) assert.ok(j.safety && j.safety[k], `${l} safety.${k}`);
      for (const k of ['dontCloseIos', 'dontCloseAndroid']) assert.ok(j.startConfirm[k], `${l} startConfirm.${k}`);
    }
  });
  test('Start popup shows the platform line (iOS: do not swipe away; Android: do not let it sleep)', async () => {
    const h = fs.readFileSync(`${SRC}/screens/HomeScreen.tsx`, 'utf8');
    assert.ok(/Platform\.OS === 'ios' \? 'home:startConfirm\.dontCloseIos' : 'home:startConfirm\.dontCloseAndroid'/.test(h));
  });
  // growth_v0.1 has its own Start-popup scroll (ModalScroll, device-tested
  // 2026-10-22, plus compactPopups on short screens): master's ScrollView /
  // startPopupScrollMax (0cc711b, 1b72ead) is NOT carried over — same guarantee.
  test('Start popup can never push Start off-screen: the card, buttons included, sits in ModalScroll (capped in points)', async () => {
    const h = fs.readFileSync(`${SRC}/screens/HomeScreen.tsx`, 'utf8').replace(/\r/g, '');
    const a = h.indexOf('visible={showStartConfirmModal}');
    const modal = h.slice(a, h.indexOf('</Modal>', a));
    assert.ok(a > 0 && modal.length > 0);
    const inScroll = modal.slice(modal.indexOf('<ModalScroll'), modal.indexOf('</ModalScroll>'));
    assert.ok(inScroll.length > 0, 'ModalScroll wraps the Start popup');
    assert.ok(/<ModalScroll[^>]*>\s*<View style=\{\[homeStyles\.notifCard/.test(modal), 'the card is its child');
    for (const k of ['startConfirm.title', 'startConfirm.message', 'startConfirm.keepOpen', 'dontCloseIos', 'startConfirm.yes', 'startConfirm.no', 'handleStartConfirmYes', 'handleStartConfirmNo'])
      assert.ok(inScroll.includes(k), `${k} inside ModalScroll`);
    assert.ok(!/startPopupScrollMax/.test(h), "master's separate cap is not carried over");
    const ms = fs.readFileSync(`${SRC}/components/ui/ModalScroll.tsx`, 'utf8');
    assert.ok(/maxHeight: maxBoxHeight/.test(ms) && /useWindowDimensions/.test(ms), 'ModalScroll caps in points from the window');
    const st = fs.readFileSync(`${SRC}/styles/home.styles.ts`, 'utf8');
    assert.strictEqual((st.match(/\bnotifScroll: \{/g) || []).length, 1, 'one notifScroll style (no duplicate key from a merge)');
  });
  // A finish on the LIVE path (processLocationForSend auto-stop) never runs _doFullStop,
  // and a runner who finishes with the phone in a pocket never reaches HomeScreen's
  // stop either: the watchdog must not survive the finish ("Livio stopped tracking"
  // 15 min after a healthy race).
  test('live finish (RaceResult finished) → watchdog, check and not-sending all cancelled', async () => {
    liveAnswers.length = 0; answerLocation();
    await startSession('2', '20', new Date(M.clock - 5 * 60000).toISOString());
    await fireFix();
    M.clock += 31000; await fireFix();
    assert.ok(pending('livio-tracking-watchdog'), 'watchdog armed while racing');
    liveAnswers.push(RR); M.clock += 31000; await fireFix();
    assert.strictEqual(M.store.get(RACE_FIN), '1', 'finished');
    for (const id of ['livio-tracking-watchdog', 'livio-tracking-check', 'livio-early-start-reminder', 'livio-not-sending']) assert.ok(!pending(id), id);
    M.clock += 20 * 60000;
    assert.ok(!pending('livio-tracking-watchdog'), 'still nothing 20 min later');
  });
  // 2026-10-30: this path never runs _doFullStop, so it must drop the clock itself,
  // or the next race's Start shows this race's elapsed time (Livio closed at the finish).
  test('live finish → the session clock is cleared too (next Start begins at 00:00:00)', async () => {
    liveAnswers.length = 0; answerLocation();
    await startSession('2', '20', new Date(M.clock - 5 * 60000).toISOString());
    await fireFix();
    assert.ok(M.store.has('@PFSLive:sessionStartedAt'), 'clock running');
    liveAnswers.push(RR); M.clock += 31000; await fireFix();
    assert.strictEqual(M.store.get(RACE_FIN), '1', 'finished');
    assert.ok(!M.store.has('@PFSLive:sessionStartedAt'), 'clock cleared at the finish');
    assert.strictEqual((await load('services/gpsService').gpsService.getSessionStats()).startedAt, null);
  });
  test('finish found during a queue drain → disarmed too (finishBackgroundStop)', async () => {
    await startSession('2', '20', new Date(M.clock - 5 * 60000).toISOString());
    await fireFix();
    assert.ok(pending('livio-tracking-watchdog'), 'watchdog armed while racing');
    setQ([fix(2, 20, 5)]); drainAnswers([RR]);
    await L().processQueue('2', '20');
    assert.strictEqual(M.store.get(RACE_FIN), '1', 'finished');
    assert.ok(!pending('livio-tracking-watchdog') && !pending('livio-tracking-check'));
  });
  // 2026-10-28 second review: a sign of life that lands after the finish must not re-arm.
  test('heartbeat after a live finish → the watchdog stays off', async () => {
    liveAnswers.length = 0; answerLocation();
    await startSession('2', '20', new Date(M.clock - 5 * 60000).toISOString());
    await fireFix(); M.clock += 31000; await fireFix();
    liveAnswers.push(RR); M.clock += 31000; await fireFix();
    assert.strictEqual(M.store.get(RACE_FIN), '1');
    M.clock += 2 * 60000;
    if (typeof M.bg.heartbeat === 'function') await M.bg.heartbeat({});
    await SAF().trackingSafetyService.onAlive(M.clock);   // a late fix / heartbeat from another context
    assert.ok(!pending('livio-tracking-watchdog'), 'watchdog not re-armed');
  });
  test('onAlive with the race finished, or with no session → nothing scheduled', async () => {
    const s = SAF().trackingSafetyService;
    M.store.set(PARAMS, JSON.stringify({ participantId: '2', eventId: '20' })); M.store.set(RACE_FIN, '1');
    await s.onAlive(M.clock);
    assert.ok(!pending('livio-tracking-watchdog'), 'finished');
    M.store.delete(RACE_FIN); M.store.delete(PARAMS);
    await s.onAlive(M.clock);
    assert.ok(!pending('livio-tracking-watchdog'), 'no session');
    M.store.set(PARAMS, JSON.stringify({ participantId: '2', eventId: '20' }));
    await s.onAlive(M.clock);
    assert.ok(pending('livio-tracking-watchdog'), 'control: a running session still arms');
  });
  test('the finish lands while onAlive is scheduling → the watchdog is taken back', async () => {
    const s = SAF().trackingSafetyService;
    M.store.set(PARAMS, JSON.stringify({ participantId: '2', eventId: '20' }));
    const sched = require('expo-notifications').scheduleNotificationAsync;
    const N = require('expo-notifications');
    N.scheduleNotificationAsync = async (req) => { const r = await sched(req); if (req.identifier === 'livio-tracking-watchdog') M.store.set(RACE_FIN, '1'); return r; };
    try { await s.onAlive(M.clock); } finally { N.scheduleNotificationAsync = sched; }
    assert.ok(!pending('livio-tracking-watchdog'));
  });
  test('cold boot with the race already finished → a watchdog left by the killed app is cancelled', async () => {
    M.notif.pending.push({ identifier: 'livio-tracking-watchdog', trigger: { date: new Date(M.clock + 5 * 60000) }, content: { data: { type: 'tracking_check' } } });
    M.store.set(RACE_FIN, '1');
    M.store.set(PARAMS, JSON.stringify({ participantId: '2', eventId: '20', intervalSeconds: 30, raceStartTime: new Date(M.clock - 2 * HOUR).toISOString(), manualStart: 0 }));
    load('services/gpsService'); await settleS();
    assert.ok(!pending('livio-tracking-watchdog'));
  });
  // 2026-10-28 third review.
  test('Stop with a fix landing while the engine stops → no watchdog left (a Stop never sets raceFinished)', async () => {
    await startSession('2', '20', new Date(M.clock - 5 * 60000).toISOString());
    await fireFix();
    const BG = require('react-native-background-geolocation').default;
    BG.stop = async () => { M.clock += 70000; await SAF().trackingSafetyService.onAlive(M.clock); return {}; };
    try { await load('services/gpsService').stopWatching(); } finally { delete BG.stop; }
    assert.ok(!pending('livio-tracking-watchdog'), 'watchdog');
    assert.ok(!pending('livio-tracking-check'), 'check');
  });
  test('a fix reaching onAlive while Start is still scheduling → the "not tracking yet" check is taken back', async () => {
    const s = SAF().trackingSafetyService;
    const gunIso = new Date(M.clock - 2 * 60000).toISOString();
    M.store.set(PARAMS, JSON.stringify({ participantId: '2', eventId: '20', intervalSeconds: 30, raceStartTime: gunIso, manualStart: 0 }));
    const N = require('expo-notifications'); const orig = N.cancelScheduledNotificationAsync; let fired = false;
    N.cancelScheduledNotificationAsync = async (id) => { const r = await orig(id); if (!fired) { fired = true; await s.onAlive(M.clock); } return r; };
    try { await s.arm({ raceStartTime: gunIso, manualStart: false }); } finally { N.cancelScheduledNotificationAsync = orig; }
    assert.ok(!pending('livio-tracking-check'), 'check cancelled');
    assert.ok(pending('livio-tracking-watchdog'), 'watchdog armed by the sign of life');
  });
  test('control: Start with no sign of life yet → the check stays scheduled', async () => {
    const gunIso = new Date(M.clock - 2 * 60000).toISOString();
    M.store.set(PARAMS, JSON.stringify({ participantId: '2', eventId: '20', intervalSeconds: 30, raceStartTime: gunIso, manualStart: 0 }));
    await SAF().trackingSafetyService.arm({ raceStartTime: gunIso, manualStart: false });
    assert.ok(pending('livio-tracking-check'));
  });
  test('Android headless heartbeat with no GPS fix (Livio killed, standing indoors) → counts as alive', async () => {
    M.store.set(PARAMS, JSON.stringify({ participantId: '2', eventId: '20', intervalSeconds: 30, raceStartTime: new Date(M.clock - 30 * 60000).toISOString(), manualStart: 0 }));
    const BG = require('react-native-background-geolocation').default;
    BG.getCurrentPosition = async () => { throw new Error('timeout'); };
    try { await load('services/gpsService').headlessTask({ name: 'heartbeat', params: {} }); } finally { delete BG.getCurrentPosition; }
    assert.strictEqual(at('livio-tracking-watchdog'), M.clock + 15 * 60000);
  });
  test('control: headless heartbeat BEFORE the gun → no watchdog (alive before the race is not the race)', async () => {
    M.store.set(PARAMS, JSON.stringify({ participantId: '2', eventId: '20', intervalSeconds: 30, raceStartTime: new Date(M.clock + 30 * 60000).toISOString(), manualStart: 0 }));
    const BG = require('react-native-background-geolocation').default;
    BG.getCurrentPosition = async () => { throw new Error('timeout'); };
    try { await load('services/gpsService').headlessTask({ name: 'heartbeat', params: {} }); } finally { delete BG.getCurrentPosition; }
    assert.ok(!pending('livio-tracking-watchdog'));
  });
  test("live finish: the finishing fix's own onAlive schedules the watchdog AFTER the first disarm → still cleared", async () => {
    liveAnswers.length = 0; answerLocation();
    await startSession('2', '20', new Date(M.clock - 5 * 60000).toISOString());
    await fireFix(); M.clock += 31000; await fireFix();
    const N = require('expo-notifications');
    const origS = N.scheduleNotificationAsync, origC = N.cancelScheduledNotificationAsync;
    let release = null, held = false;
    N.scheduleNotificationAsync = async (req) => {
      if (req.identifier === 'livio-tracking-watchdog' && !held) { held = true; await new Promise((r) => { release = r; }); }
      return origS(req);
    };
    N.cancelScheduledNotificationAsync = async (id) => {
      const r = await origC(id);
      if (id === 'livio-tracking-watchdog' && release) { const go = release; release = null; go(); }
      return r;
    };
    try {
      liveAnswers.push(RR); M.clock += 70000; await fireFix();   // > 1 min: this fix reschedules the watchdog
      await settleS();
    } finally { N.scheduleNotificationAsync = origS; N.cancelScheduledNotificationAsync = origC; }
    assert.ok(held, 'the watchdog schedule was held past the first disarm');
    assert.strictEqual(M.store.get(RACE_FIN), '1');
    assert.ok(!pending('livio-tracking-watchdog'), 'watchdog cleared');
  });
  test('plan boundaries: Start exactly 30 min before the gun → no early reminder; 1 ms more → reminder at gun - 10', async () => {
    const { planSafetyArm } = SAF(); const now = 1_000_000_000_000;
    assert.strictEqual(planSafetyArm(now + 30 * 60000, now, false).earlyAt, null);
    assert.strictEqual(planSafetyArm(now + 30 * 60000 + 1, now, false).earlyAt, now + 20 * 60000 + 1);
    assert.deepStrictEqual(planSafetyArm(NaN, now, false), { checkAt: null, earlyAt: null }, 'unparsable gun, not manual');
  });
  test('arm with an unparsable gun (not manual) → nothing scheduled, Start unaffected', async () => {
    await SAF().trackingSafetyService.arm({ raceStartTime: 'garbage', manualStart: false });
    for (const id of ['livio-tracking-check', 'livio-early-start-reminder', 'livio-tracking-watchdog']) assert.ok(!pending(id), id);
  });
  test('cold boot of a stale session (gun > 24 h) → a watchdog left by the dead app is cancelled', async () => {
    M.notif.pending.push({ identifier: 'livio-tracking-watchdog', trigger: { date: new Date(M.clock + 5 * 60000) }, content: { data: { type: 'tracking_check' } } });
    M.store.set(PARAMS, JSON.stringify({ participantId: '2', eventId: '20', intervalSeconds: 30, raceStartTime: new Date(M.clock - 26 * HOUR).toISOString(), manualStart: 0 }));
    load('services/gpsService'); await settleS();
    assert.ok(!M.store.has(PARAMS), 'stale session stopped');
    assert.ok(!pending('livio-tracking-watchdog'), 'watchdog cancelled');
  });
  results.push(await run('15. tracking safety net: not-tracking check, watchdog, early reminder, start diag, start popup'));

  // ════════════ 16. "Recording but not sending" (2026-10-24 08:20 review) ════════════
  // Timelines from the prod copy: bib 1269 (iOS) recorded from the gun and sent
  // nothing until 08:45 (190 fixes in one burst); bib 410 sent normally, then
  // nothing 06:47-07:49 (68 fixes delivered at 07:49); 50 runners lost 5-15 min in
  // the km 5-8 dead zone, bibs 392 / 825 / 964 16-18 min — those must stay silent.
  const NS = 'livio-not-sending';
  const LAST_SENT = '@PFSLive:safetyLastSentAt', WARNED = '@PFSLive:safetyNotSendingWarnedFor';
  const shows = () => schedules(NS);
  const offline = () => { M.api.mode = 'down'; M.net = { isConnected: true, isInternetReachable: false }; };
  const online = () => { M.api.mode = 'ok'; M.net = { isConnected: true, isInternetReachable: true }; };
  const minutes = async (n) => { for (let i = 0; i < n; i++) { M.clock += 60000; await fireFix(); } };
  const qCount = () => parseInt(M.store.get('@PFSLive:locationQueueCount') || '0', 10);
  test('rule: needs fixes waiting; 20 min from the last send (or first sign of life); once per outage', async () => {
    const { shouldWarnNotSending: w, NOT_SENDING_MS } = SAF(); const now = 1_000_000_000_000;
    assert.strictEqual(NOT_SENDING_MS, 20 * 60000);
    assert.strictEqual(w(0, now - 60 * 60000, null, null, now), false, 'nothing queued (standing still) → never');
    assert.strictEqual(w(5, now - 19 * 60000, null, null, now), false, '19 min since the last send');
    assert.strictEqual(w(5, now - 20 * 60000, null, null, now), true, '20 min since the last send');
    assert.strictEqual(w(5, null, now - 20 * 60000, null, now), true, 'never sent: from the first sign of life (bib 1269)');
    assert.strictEqual(w(5, null, now - 19 * 60000, null, now), false);
    assert.strictEqual(w(5, null, null, null, now), false, 'no sign of life recorded → no clock');
    assert.strictEqual(w(5, now - 30 * 60000, null, String(now - 30 * 60000), now), false, 'already warned for this outage');
    assert.strictEqual(w(5, null, now - 30 * 60000, '0', now), false, 'already warned (nothing ever sent)');
    assert.strictEqual(w(5, now - 25 * 60000, null, String(now - 90 * 60000), now), true, 'a send since the last warning = a new outage');
  });
  test('bib 1269: no data from the gun → one notification ~20 min after the first sign of life, not repeated for an hour', async () => {
    await startSession('2', '20', new Date(M.clock - 60000).toISOString());
    offline();
    await minutes(18);
    assert.ok(qCount() > 0, 'fixes are queued');
    assert.strictEqual(shows(), 0, 'not yet at 18 min');
    await minutes(3);
    assert.strictEqual(shows(), 1, 'shown once by 21 min');
    const n = pending(NS);
    assert.strictEqual(n.trigger, null, 'shown now (a local notification needs no network)');
    assert.deepStrictEqual(n.content.data, { type: 'tracking_check' }, 'a tap only opens Livio');
    assert.ok(/send/i.test(n.content.title), 'en title: ' + n.content.title);
    await minutes(40);
    assert.strictEqual(shows(), 1, 'still once after an hour offline');
    assert.ok(!M.api.posted.some((p) => p.url.includes('insert_participant_location')), 'nothing reached the server');
  });
  test('bib 1269 continued: the connection comes back → the backlog drains, the warning is withdrawn; a second outage warns again', async () => {
    await startSession('2', '20', new Date(M.clock - 60000).toISOString());
    offline(); await minutes(22);
    assert.strictEqual(shows(), 1);
    online(); await minutes(3); await settleS();
    assert.ok(M.api.posted.some((p) => p.url.includes('insert_participant_location')), 'fixes reached the server');
    assert.ok(!pending(NS), 'withdrawn');
    assert.ok(M.notif.log.some(([k, i]) => k === 'dismiss' && i === NS), 'dismissed from the notification centre');
    assert.ok(!M.store.has(WARNED));
    offline(); await minutes(19);
    assert.strictEqual(shows(), 1, 'second outage: not yet at 19 min');
    await minutes(3);
    assert.strictEqual(shows(), 2, 'second outage warned once');
  });
  test('bib 410: sends normally, then 62 min without data → warned 20 min after the last accepted send, once', async () => {
    await startSession('2', '20', new Date(M.clock - 60000).toISOString());
    online(); await minutes(5); await settleS();
    const lastSent = parseInt(M.store.get(LAST_SENT), 10);
    assert.ok(lastSent > 0, 'accepted sends are stamped');
    offline();
    while (M.clock < lastSent + 19 * 60000) await minutes(1);
    assert.strictEqual(shows(), 0, 'not before 20 min');
    await minutes(2);
    assert.strictEqual(shows(), 1);
    await minutes(41);
    assert.strictEqual(shows(), 1, 'once for the whole 62 min');
  });
  test('the km 5-8 dead zone: 15 min without data, then back → no notification', async () => {
    await startSession('2', '20', new Date(M.clock - 60000).toISOString());
    online(); await minutes(5); offline(); await minutes(15); online(); await minutes(5);
    assert.strictEqual(shows(), 0);
  });
  test('bibs 392 / 825 / 964: 16-18 min outages → no notification (15 min would have flagged them)', async () => {
    await startSession('2', '20', new Date(M.clock - 60000).toISOString());
    online(); await minutes(3); await settleS();
    const lastSent = parseInt(M.store.get(LAST_SENT), 10);
    offline();
    while (M.clock < lastSent + 18 * 60000) await minutes(1);
    online(); await minutes(3);
    assert.strictEqual(shows(), 0);
  });
  test('standing still at an aid station, online, nothing queued, no send for 30 min → no notification', async () => {
    await startSession('2', '20', new Date(M.clock - 60000).toISOString());
    online(); await minutes(3); await settleS();
    for (let i = 0; i < 30; i++) { M.clock += 60000; await M.bg.heartbeat({}); }
    assert.strictEqual(qCount(), 0);
    assert.strictEqual(shows(), 0);
  });
  test('standing still IN a dead zone with fixes waiting → the heartbeat alone raises it at 20 min', async () => {
    await startSession('2', '20', new Date(M.clock - 60000).toISOString());
    online(); await minutes(2); await settleS();
    offline(); await minutes(3);
    assert.ok(qCount() > 0);
    for (let i = 0; i < 20; i++) { M.clock += 60000; await M.bg.heartbeat({}); }
    assert.strictEqual(shows(), 1);
  });
  test('before the gun nothing is sent, by design → no notification however long', async () => {
    await startSession('2', '20', new Date(M.clock + 60 * 60000).toISOString());
    offline(); await minutes(40);
    for (let i = 0; i < 5; i++) { M.clock += 60000; await M.bg.heartbeat({}); }
    assert.strictEqual(shows(), 0);
  });
  test('a rejected send (server error) does not count as sent', async () => {
    await startSession('2', '20', new Date(M.clock - 60000).toISOString());
    M.api.mode = 'softfail'; await minutes(3); await settleS();
    assert.ok(!M.store.has(LAST_SENT));
  });
  test('Stop while warned → withdrawn and the state cleared', async () => {
    await startSession('2', '20', new Date(M.clock - 60000).toISOString());
    offline(); await minutes(22);
    assert.ok(pending(NS));
    await load('services/gpsService').stopWatching();
    assert.ok(!pending(NS));
    assert.ok(!M.store.has(WARNED) && !M.store.has(LAST_SENT));
  });
  test('a new Start clears the last session\'s warning and clock', async () => {
    await startSession('2', '20', new Date(M.clock - 60000).toISOString());
    offline(); await minutes(22);
    assert.ok(pending(NS));
    online();
    await startSession('2', '20', new Date(M.clock - 60000).toISOString());
    assert.ok(!pending(NS) && !M.store.has(WARNED));
  });
  test('notifications denied → nothing shown, tracking unaffected', async () => {
    await startSession('2', '20', new Date(M.clock - 60000).toISOString());
    M.notif.fail = true;
    offline(); await minutes(25);
    assert.ok(qCount() > 0, 'still recording into the queue');
    assert.strictEqual(shows(), 0);
    online(); await minutes(3); await settleS();
    assert.ok(M.api.posted.some((p) => p.url.includes('insert_participant_location')), 'and sends resume');
  });
  test('only the not-sending notification failing → marked once, not retried every minute', async () => {
    await startSession('2', '20', new Date(M.clock - 60000).toISOString());
    offline(); await minutes(18);
    const N = require('expo-notifications'); const orig = N.scheduleNotificationAsync; let tries = 0;
    N.scheduleNotificationAsync = async (req) => { if (req.identifier === NS) { tries++; throw new Error('unsupported'); } return orig(req); };
    try { await minutes(10); } finally { N.scheduleNotificationAsync = orig; }
    assert.strictEqual(tries, 1, 'attempted once for this outage');
    assert.strictEqual(M.store.get(WARNED), '0');
  });
  test('send stamp: written at most every 30 s (5 s fixes near the finish)', async () => {
    const { trackingSafetyService: s } = SAF(); const t = 1_800_000_000_000;
    await s.disarm();
    await s.onSent(t);
    for (let k = 5; k <= 25; k += 5) await s.onSent(t + k * 1000);
    assert.strictEqual(M.store.get(LAST_SENT), String(t));
    await s.onSent(t + 31000);
    assert.strictEqual(M.store.get(LAST_SENT), String(t + 31000));
  });
  test('texts: notSending title + body in en / fr / nl', async () => {
    for (const l of ['en', 'fr', 'nl']) {
      const j = JSON.parse(fs.readFileSync(`${SRC}/i18n/HomeScreen/${l}.json`, 'utf8'));
      for (const k of ['notSendingTitle', 'notSendingBody']) assert.ok(j.safety[k], `${l} safety.${k}`);
      assert.ok(/20/.test(j.safety.notSendingBody), `${l}: the body names the 20 minutes`);
    }
  });
  results.push(await run('16. recording but not sending: no-data warning (bib 1269 / 410), dead zones stay silent'));

  // ════════════ 17. The safety net does not change other flows ════════════
  test('start ping: a hung battery read cannot lose the ping — sent within the 1.5 s bound, without battery keys', async () => {
    M.battery = { ...M.battery, hang: true };
    const ts = load('services/trackingStartService');
    const real0 = process.hrtime.bigint();
    const d = await ts.buildStartDiag(false);
    const ms = Number(process.hrtime.bigint() - real0) / 1e6;
    assert.ok(ms >= ts.START_DIAG_BATTERY_TIMEOUT_MS - 50 && ms < ts.START_DIAG_BATTERY_TIMEOUT_MS + 1000, `took ${Math.round(ms)} ms`);
    assert.ok(!('batt' in d) && !('saver' in d), 'battery keys left out');
    assert.ok('perm' in d && 'platform' in d, 'the existing diag is intact');
  });
  test('heartbeat liveness ping and orphan drain never count as "sent" (only accepted fixes do)', async () => {
    const src = fs.readFileSync(`${SRC}/services/locationService.ts`, 'utf8');
    assert.strictEqual((src.match(/trackingSafetyService\.onSent\(/g) || []).length, 1, 'one call site');
    const at = src.indexOf('trackingSafetyService.onSent(');
    const fnStart = src.lastIndexOf('async sendLocation(', at);
    const nextFn = src.indexOf('async processQueue(', fnStart);
    assert.ok(fnStart > 0 && at < nextFn, 'inside sendLocation, after the accepted response');
    assert.ok(/if \(normalizedResponse\.success\) \{\s*locationQueueService\.markSendSucceeded\(\);\s*void trackingSafetyService\.onSent\(\);/.test(src));
  });
  test('Start / Stop leave the start reminders (livio-start-reminder-pre/post) alone', async () => {
    M.notif.pending.push({ identifier: 'livio-start-reminder-post', content: {}, trigger: { date: new Date(M.clock + 3600e3) } });
    await startSession('2', '20', new Date(M.clock - 60000).toISOString());
    await load('services/gpsService').stopWatching();
    assert.ok(pending('livio-start-reminder-post'), 'still scheduled');
    assert.ok(!M.notif.log.some(([k, i]) => i && i.startsWith('livio-start-reminder')), 'never cancelled by the safety net');
  });
  test('every safety notification opens Livio only: data is exactly { type: tracking_check } (no result popup, no navigation)', async () => {
    await startSession('2', '20', new Date(M.clock - 60000).toISOString());
    offline(); await minutes(22);
    for (const id of ['livio-tracking-watchdog', NS]) assert.deepStrictEqual(pending(id).content.data, { type: 'tracking_check' }, id);
    const h = fs.readFileSync(`${SRC}/screens/HomeScreen.tsx`, 'utf8');
    assert.ok(/if \(data\?\.race_id && data\?\.event_name\) \{\s*setNotificationPopup/.test(h), 'foreground popup still needs race_id AND event_name');
    const u = fs.readFileSync(`${SRC}/hooks/useNotifications.ts`, 'utf8');
    assert.ok(/if \(data\?\.race_id && data\?\.event_name && onNotificationTapRef\.current\)/.test(u), 'tap navigation still needs both');
  });
  test('a send outside a session (e.g. a parked fix) leaves no clock behind for the next race', async () => {
    const { trackingSafetyService: s } = SAF();
    await s.disarm(); await s.onSent(M.clock - 3 * 3600e3);
    assert.ok(M.store.has(LAST_SENT));
    await startSession('2', '20', new Date(M.clock - 60000).toISOString());
    assert.ok(!M.store.has(LAST_SENT), 'Start cleared it');
    offline(); await minutes(5);
    assert.strictEqual(shows(), 0, 'no instant warning from the old stamp');
  });
  test('normal race online end to end: no safety notification is ever shown, every fix reaches the server', async () => {
    await startSession('2', '20', new Date(M.clock - 60000).toISOString());
    online(); await minutes(90);
    assert.strictEqual(shows(), 0);
    assert.ok(pending('livio-tracking-watchdog') && at('livio-tracking-watchdog') > M.clock, 'only the (future) watchdog is pending');
    assert.ok(!pending('livio-tracking-check'), 'check cancelled by the first fix');
    assert.ok(M.api.posted.filter((p) => p.url.includes('insert_participant_location')).length >= 80, 'fixes sent');
  });
  results.push(await run('17. no side effects: start ping bound, send stamp only on fixes, reminders untouched, taps open Livio only'));

  // ── 18. Android headless relaunch: ready() waits until Livio is opened ─────
  // Race day 2026-10-24: 4 of 12 Android phones opened after a headless phase got
  // no engine event for 2.5-4 h (bibs 151, 353, 2, 459). The harness SDK models
  // tslocationmanager's gate (harness.js, BG.ready): ready() is forwarded once per
  // JS context and ignored while headless; leaving headless needs a fresh ready().
  {
    const H18 = 3600000;
    const settle18 = () => new Promise((r) => setTimeout(r, 40));
    const live = () => M.store.set(PARAMS, JSON.stringify({ participantId: '5441', eventId: '20', intervalSeconds: 30, raceStartTime: new Date(M.clock - 2 * H18).toISOString(), manualStart: 0 }));
    const headlessBoot = () => { M.os = 'android'; M.appState = 'background'; M.sdk.headless = true; };
    const logOf = async (g) => (await g.getFullTrackingLog()).map((e) => e.icon + ' ' + e.msg);

    test('Android, OS relaunched Livio headless mid-race: no ready() while headless; opening Livio makes events reach JS', async () => {
      live(); headlessBoot();
      const g = load('services/gpsService'); await settle18();
      assert.strictEqual((M.bg.readyCalls || []).length, 0, 'ready() not called while headless');
      assert.ok(M.sdkDelivers(), 'headless events still go to the headless task');
      assert.ok((await logOf(g)).some((l) => /^🌙 Cold boot in the background/.test(l)));
      M.openApp(); await settle18();
      assert.deepStrictEqual(M.bg.readyCalls, [{ headless: false }], 'one ready(), after headless ended');
      assert.ok(M.sdkDelivers(), 'events reach the JS listeners after the open (deaf on race day)');
      assert.ok((await logOf(g)).some((l) => /^🔁 Cold boot — engine alive/.test(l)));
    });
    test('…HomeScreen restore (rehydrateTracking) running before the AppState event: delivering, listener gone', async () => {
      live(); headlessBoot();
      const g = load('services/gpsService'); await settle18();
      M.sdk.headless = false; M.sdk.headlessEpoch++; M.appState = 'active';
      await g.rehydrateTracking();                       // HomeScreen restore runs first
      for (const h of [...M.appCbs]) h.cb('active');      // then the AppState event
      await settle18();
      assert.ok(M.sdkDelivers());
      assert.strictEqual(M.appCbs.length, 0, 'the one-shot listener removed itself');
    });
    test('Android normal launch (app on screen): ready() at boot as before', async () => {
      live(); M.os = 'android'; M.appState = 'active';
      load('services/gpsService'); await settle18();
      assert.deepStrictEqual(M.bg.readyCalls, [{ headless: false }]);
      assert.ok(M.sdkDelivers());
    });
    test('iOS background relaunch: ready() at boot as before (iOS has no headless task)', async () => {
      live(); M.os = 'ios'; M.appState = 'background';
      load('services/gpsService'); await settle18();
      assert.strictEqual((M.bg.readyCalls || []).length, 1);
    });
    test('Android background boot with no live session: nothing armed, no listener left behind', async () => {
      headlessBoot();
      load('services/gpsService'); await settle18();
      assert.strictEqual((M.bg.readyCalls || []).length, 0);
      assert.strictEqual(M.appCbs.length, 0);
    });
    test('Android background boot after the finish: engine still stopped at boot (unchanged), no deferral', async () => {
      live(); M.store.set('@PFSLive:raceFinished', '1'); headlessBoot();
      const g = load('services/gpsService'); await settle18();
      assert.ok((await logOf(g)).some((l) => /race already finished, engine stopped/.test(l)));
      assert.strictEqual(M.appCbs.length, 0);
    });
    test('Android background boot of a >24h-old session: stopped at boot (unchanged), no deferral', async () => {
      M.store.set(PARAMS, JSON.stringify({ participantId: '2', eventId: '12', intervalSeconds: 30, raceStartTime: new Date(M.clock - 26 * H18).toISOString(), manualStart: 0 }));
      headlessBoot();
      load('services/gpsService'); await settle18();
      assert.ok(!M.store.has(PARAMS), 'old session stopped');
      assert.strictEqual(M.appCbs.length, 0);
    });
    test('headless wake on Android without ready(): the fix in the wake is still sent (headless task path)', async () => {
      live(); headlessBoot();
      const g = load('services/gpsService'); await settle18();
      for (let i = 0; i < 2; i++) {                       // the first fix is the anchor, the moved one is sent
        await g.headlessTask({ name: 'location', params: { coords: { latitude: 50.74 + i * 0.002, longitude: 5.84, accuracy: 5, speed: 2, altitude: 200 }, timestamp: new Date(M.clock).toISOString(), is_moving: true } });
        M.clock += 60000;
      }
      await settle18();
      assert.strictEqual((M.bg.readyCalls || []).length, 0, 'still no ready() in the headless context');
      assert.ok(M.api.posted.some((p) => p.url.includes('insert_participant_location')), 'fix posted from the headless task');
    });
    test('restore runs first on the open: exactly ONE rehydrate (the pending listener is dropped, no second ready/log)', async () => {
      live(); headlessBoot();
      const g = load('services/gpsService'); await settle18();
      M.sdk.headless = false; M.sdk.headlessEpoch++; M.appState = 'active';
      await g.rehydrateTracking();
      assert.strictEqual(M.appCbs.length, 0, 'listener dropped by the foreground run');
      for (const h of [...M.appCbs]) h.cb('active');
      await settle18();
      assert.strictEqual((await logOf(g)).filter((l) => /^🔁 Cold boot/.test(l)).length, 1);
      assert.strictEqual(M.bg.readyCalls.length, 1);
    });
    test('engine found OFF at a background boot: not started in the background, started once Livio is opened', async () => {
      live(); headlessBoot(); M.sdk.enabled = false;
      const g = load('services/gpsService'); await settle18();
      assert.ok(!M.bg.starts, 'no start from the background');
      assert.ok((await logOf(g)).some((l) => /engine off: restart deferred too/.test(l)));
      M.openApp(); await settle18();
      assert.strictEqual(M.bg.starts, 1, 'started on the open');
      assert.ok(M.sdkDelivers());
      assert.ok((await logOf(g)).some((l) => /^🔁 Cold boot — live session found, engine restarted/.test(l)));
    });
    test('app backgrounded again before it ever became active: still deferred, one listener (no stacking)', async () => {
      live(); headlessBoot();
      const g = load('services/gpsService'); await settle18();
      await g.rehydrateTracking(); await g.rehydrateTracking();   // e.g. a notification tap that never reached the screen
      assert.strictEqual(M.appCbs.length, 1);
      assert.strictEqual((M.bg.readyCalls || []).length, 0);
    });
    test('Android warm reopen (process alive, app on screen): rehydrateTracking still arms ready() as before', async () => {
      live(); M.os = 'android'; M.appState = 'active';
      const g = load('services/gpsService'); await settle18();
      await g.rehydrateTracking();
      assert.ok(M.sdkDelivers());
      assert.strictEqual(M.appCbs.length, 0);
    });
  }
  results.push(await run('18. Android headless relaunch: ready() deferred until Livio is opened (bibs 151 / 353 / 2 / 459)'));

  // ════════════ 19. a new Start shows 00:00:00, not the last race's clock (developer report 2026-10-30) ════════════
  {
    const START = '@PFSLive:sessionStartedAt';
    const withOdometer = async (fn) => {
      const BG = require('react-native-background-geolocation').default;
      const odo = { m: 0, calls: [] };
      BG.setOdometer = async (v) => { odo.calls.push(['set', v, M.store.get(START) ?? null]); odo.m = v; return {}; };
      BG.getOdometer = async () => odo.m;
      try { return await fn(odo); } finally { delete BG.setOdometer; delete BG.getOdometer; }
    };
    const begin = (pid = '2', eid = '12') => load('services/gpsService').gpsService.startWatchingPosition(
      () => {}, () => {}, 30, pid, eid, 't', 'b', 59, new Date(M.clock - 60 * 60000).toISOString(), 0, 'Test race');
    test('Stop clears the session clock: the stats read 00:00:00 / 0 km until the next Start stamps its own', async () => {
      await withOdometer(async (odo) => {
        const g = load('services/gpsService').gpsService;
        const h = await begin();
        M.clock += 42 * 60000; odo.m = 5230;
        assert.deepStrictEqual(await g.getSessionStats().then((s) => [s.startedAt !== null, s.distanceKm]), [true, 5.23], 'race 1 running');
        await h.remove();
        assert.ok(!M.store.has(START), 'start time cleared on Stop');
        const s = await g.getSessionStats();
        assert.deepStrictEqual([s.startedAt, s.distanceKm], [null, 0], 'what a new Start shows until it is stamped (was race 1\'s 42 min, 5.23 km)');
      });
    });
    test('…a new race zeroes the odometer BEFORE stamping its start (no old distance on the new clock), then stamps now', async () => {
      await withOdometer(async (odo) => {
        const h = await begin(); await h.remove();
        M.clock += 3 * 3600000; odo.m = 9999; odo.calls.length = 0;
        await begin('3', '13');
        assert.deepStrictEqual(odo.calls, [['set', 0, null]], 'odometer zeroed while no start was stamped');
        assert.strictEqual(M.store.get(START), String(M.clock));
        assert.strictEqual((await load('services/gpsService').gpsService.getSessionStats()).distanceKm, 0);
      });
    });
    test('…a resume of the SAME race (relaunch after an OS kill, no Stop) keeps its clock and distance', async () => {
      await withOdometer(async (odo) => {
        await begin();
        const t0 = M.store.get(START);
        M.clock += 20 * 60000; odo.m = 3100; odo.calls.length = 0;
        await begin();
        assert.strictEqual(M.store.get(START), t0);
        assert.deepStrictEqual(odo.calls, [], 'odometer untouched');
        assert.strictEqual((await load('services/gpsService').gpsService.getSessionStats()).distanceKm, 3.1);
      });
    });
  }
  results.push(await run('19. a new Start shows 00:00:00, not the last race\'s clock (developer report 2026-10-30)'));

  const tot = results.reduce((a, r) => ({ pass: a.pass + r.pass, fail: a.fail + r.fail }), { pass: 0, fail: 0 });
  console.log(`\nAPP TOTAL: ${tot.pass} passed, ${tot.fail} failed`);
  process.exit(tot.fail ? 1 : 0);
})();
