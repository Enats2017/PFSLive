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
    assert.strictEqual(logUploads().length, 1);
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
  const liftResolveApprox = (setShown, ref) => {
    const r = cb('resolveApprox', '');
    const params = r.params.replace(/:\s*[A-Za-z]+/g, '');   // drop the TS type ("proceed: boolean")
    return new Function('setShowApproxModal', 'approxResolveRef', 'return (' + params + ') => {' + r.body + '\n};')(setShown, ref);
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
    for (const v of ['showStartConfirmModal', 'stopConfirmMode !== null', 'showApproxModal', 'startErrorMessage !== null', 'showOverrideModal', 'showEarlyTrackingModal'])
      assert.ok(modalJsx(v).includes('homeStyles.notifCard'), v + ' uses notifCard');
  });
  test('approximate location: Start waits; "Continue anyway" → proceeds; popup closes', async () => {
    const c = cb('handleApproxContinue', 'resolveApprox');
    const shown = []; const ref = { current: null };
    const resolveApprox = liftResolveApprox((x) => shown.push(x), ref);
    const answer = new Promise((res) => { ref.current = res; });
    new Function('resolveApprox', c.body)(resolveApprox);
    assert.strictEqual(await answer, true);
    assert.deepStrictEqual(shown, [false]);
    assert.strictEqual(ref.current, null, 'resolver released');
  });
  test('approximate location: "Open settings" → start stops here, re-armed for return, Settings opened', async () => {
    const o = cb('handleApproxOpenSettings', 'resolveApprox');
    const shown = []; const ref = { current: null }; let settings = 0;
    const resolveApprox = liftResolveApprox((x) => shown.push(x), ref);
    const answer = new Promise((res) => { ref.current = res; });
    const pendingStartRef = { current: false };
    new Function('pendingStartRef', 'Linking', 'resolveApprox', o.body)(
      pendingStartRef, { openSettings: () => { settings++; return Promise.resolve(); } }, resolveApprox);
    assert.strictEqual(await answer, false);
    assert.strictEqual(pendingStartRef.current, true);
    assert.strictEqual(settings, 1);
    assert.deepStrictEqual(shown, [false]);
  });
  test('approximate location: a second answer is ignored (resolver used once)', async () => {
    const ref = { current: null }; let n = 0;
    const resolveApprox = liftResolveApprox(() => {}, ref);
    ref.current = () => { n++; };
    resolveApprox(true); resolveApprox(false);
    assert.strictEqual(n, 1);
  });
  test('approximate location popup: copy, buttons wired, back press does not dismiss (choice required)', async () => {
    const jsx = modalJsx('showApproxModal');
    for (const k of ['home:alerts.approximateLocationTitle', 'home:alerts.approximateLocationMessage']) assert.ok(jsx.includes(k), k);
    assert.ok(/onPress=\{handleApproxOpenSettings\}[\s\S]*?home:alerts\.openSettings/.test(jsx), 'Open settings wired');
    assert.ok(/onPress=\{handleApproxContinue\}[\s\S]*?home:alerts\.continueAnyway/.test(jsx), 'Continue anyway wired');
    assert.ok(/onRequestClose=\{\(\) => \{ \/\* a choice is required \*\/ \}\}/.test(jsx), 'back press keeps it open');
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
    const m = homeLF.match(/\n    \} catch \(error\) \{\n      setIsGPSActive\(false\);([\s\S]*?)\n    \} finally \{\n      void gpsService\.endStartWindow\(startWindow\);\n    \}\n  \}, \[\n    hasPermission,/);
    assert.ok(m, 'start catch found');
    const out = { pending: { current: false }, toasts: [], notes: [], errorMsg: undefined, active: [], stored: {} };
    const Notifications = { scheduleNotificationAsync: (req) => { out.notes.push(req); return notifyFails ? Promise.reject(new Error('x')) : Promise.resolve('id'); } };
    const AsyncStorageStub = { setItem: async (k, v) => { out.stored[k] = v; } };
    new Function('error', 'setIsGPSActive', 'isGPSActiveRef', 'START_BACKGROUNDED_CODE', 'pendingStartRef', 'toastError', 't', 'Notifications', 'setStartErrorMessage',
      'AsyncStorage', 'PENDING_BG_START_KEY', 'homeData', 'participantId', 'eventId',
      'setIsGPSActive(false);' + m[1].replace(/\(error as any\)/g, 'error'))(
      error, (x) => out.active.push(x), { current: true }, 'start_backgrounded', out.pending,
      (a, b) => out.toasts.push([a, b]), (k) => k, Notifications, (x) => { out.errorMsg = x; },
      AsyncStorageStub, '@PFSLive:pendingBgStart', { next_race_participant_app_id: '4807', next_race_id: '19' }, 'x', 'y');
    return out;
  };
  test('start in a pocket (Android backgrounded): re-armed, toast AND a notification, never the error popup', async () => {
    const o = runStartCatch(Object.assign(new Error('App did not return to foreground in time'), { code: 'start_backgrounded' }));
    assert.strictEqual(o.pending.current, true, 'start re-armed for the next foreground');
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
    const iBox = jsx.indexOf('<View style={homeStyles.notifKeepOpenBox}>');
    const iButtons = jsx.indexOf('homeStyles.notifButtonContainer');
    assert.ok(iBody > 0 && iBox > iBody && iKeep > iBox && iButtons > iKeep, 'message → amber box → buttons');
    assert.ok(!/Platform\.OS/.test(jsx), 'shown on both platforms');
    const st = fs.readFileSync(`${SRC}/styles/home.styles.ts`, 'utf8').replace(/\r/g, '');
    // design_newv0.2: the branch's amber note tokens, not master's hex values
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
    // Approximate location: warned (Open settings / Continue anyway), never blocked.
    assert.ok(/if \(await gpsService\.isApproximateLocation\(\)\)/.test(s), 'approximate check at Start');
    assert.ok(/approxResolveRef\.current = resolve;\s*setShowApproxModal\(true\);/.test(s), 'Start waits on the approximate-location popup');
    assert.ok(/const handleApproxContinue = useCallback\(\(\) => \{\s*resolveApprox\(true\);/.test(s), 'Continue anyway proceeds');
    // No captured offset → no gun (session waits), as before when server_datetime was missing.
    assert.ok(/const raceTime = serverTimeOffsetKnownRef\.current\s*\?\s*computeRaceStartTime\(/.test(s), 'gun only from a captured offset');
    assert.ok(/serverTimeOffsetKnownRef\.current = true;/.test(s), 'flag set where the offset is captured');
  });
  test('HomeScreen merge (design_newv0.2, 2026-10-18): design card follows the session in the session-only state', async () => {
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
    const iApprox = fn.indexOf('if (!proceed) return;');
    const iTake = fn.indexOf('startWindow = await gpsService.beginStartWindow();');
    const iFetch = fn.indexOf('fetchHomeData(true)');
    const iEngine = fn.indexOf('await gpsService.startWatchingPosition(');
    assert.ok(iDecl > 0 && iDecl < iTry, 'declared before the try');
    assert.ok(iApprox > 0 && iTake > iApprox, 'after the approximate-location popup (nothing waits for the runner after it)');
    assert.ok(iFetch > iTake && iEngine > iFetch, 'before the home refetch and the engine start');
    assert.strictEqual((fn.match(/beginStartWindow\(/g) || []).length, 1, 'taken once');
    assert.ok(/\n    \} finally \{\n      void gpsService\.endStartWindow\(startWindow\);\n    \}$/.test(fn), 'the function-level finally releases it');
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
    await G().maybeUploadInterimLog();
    assert.strictEqual(logUploads().length, 1);
  });
  // ── merge of master into design_newv0.2 (2026-10-19) ──
  // This branch has no `colors` palette and folds the session-start key into
  // SESSION_START_KEY; the merge mapped master's code onto both.
  test('design_newv0.2 merge (2026-10-19): merged popups use this branch\'s palette, not the old colors', async () => {
    const s = fs.readFileSync(`${SRC}/screens/HomeScreen.tsx`, 'utf8').replace(/\r/g, '');
    const st = fs.readFileSync(`${SRC}/styles/home.styles.ts`, 'utf8').replace(/\r/g, '');
    assert.ok(!/\bcolors\./.test(s), 'no colors.* in HomeScreen');
    assert.ok(!/\bcolors\./.test(st), 'no colors.* in home.styles');
    for (const [visible, colour] of [['stopConfirmMode !== null', 'palette.danger'], ['startErrorMessage !== null', 'palette.danger'], ['showOverrideModal', 'palette.navy'], ['showApproxModal', 'palette.warning'], ['showBatteryStartModal', 'palette.navy']]) {
      const esc = visible.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const m = s.match(new RegExp('<Modal[^>]*?visible=\\{' + esc + '\\}[\\s\\S]*?</Modal>'));
      assert.ok(m, 'modal ' + visible);
      assert.ok(m[0].includes('<Ionicons') && m[0].includes('color={' + colour + '}'), visible + ' icon is ' + colour);
    }
    assert.ok(/notifIconWrapperDanger: \{\s*backgroundColor: palette\.dangerBg,\s*\}/.test(st), 'danger circle = dangerBg');
    assert.ok(/notifDangerButton: \{\s*borderColor: palette\.danger,\s*\}/.test(st), 'danger button border');
    assert.ok(/notifDangerText: \{\s*color: palette\.danger,\s*\}/.test(st), 'danger button text');
  });
  test('design_newv0.2 merge (2026-10-19): the stale-session stop reads the one session-start key', async () => {
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
    const calls = { asked: 0, shown: [], exempt: 0 };
    const ref = { current: null };
    const fn = new Function('Platform', 'gpsService', 'batteryStartResolveRef', 'setShowBatteryStartModal', 'requestBatteryOptimizationExemption',
      'return (async () => { if (Platform.OS === \'android\' && (await gpsService.isBatteryOptimized())) {' + m[1].replace(/new Promise<[^>]*>\(/g, 'new Promise(') + '\n} return \'continued\'; })();');
    const p = fn({ OS: os }, { isBatteryOptimized: async () => { calls.asked++; return optimized; } }, ref,
      (v) => calls.shown.push(v), async () => { calls.exempt++; });
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
    const iSaver = homeLF.indexOf('if (await checkPowerSavingMode()) {\n        setShowPowerSavingModal(true);\n        return;\n      }', at);
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
    const notes = M.notif.log.filter((x) => x[0] === 'schedule');
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

  const tot = results.reduce((a, r) => ({ pass: a.pass + r.pass, fail: a.fail + r.fail }), { pass: 0, fail: 0 });
  console.log(`\nAPP TOTAL: ${tot.pass} passed, ${tot.fail} failed`);
  process.exit(tot.fail ? 1 : 0);
})();
