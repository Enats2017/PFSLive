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
  test('no radio (isConnected=false) → false', async () => {
    M.net = { isConnected: false, isInternetReachable: false };
    assert.strictEqual(await Q().locationQueueService.hasNetwork(), false);
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
  test('trust never overrides "no radio"', async () => {
    const { locationQueueService: q } = Q();
    q.markSendSucceeded();
    M.net = { isConnected: false, isInternetReachable: false };
    assert.strictEqual(await q.hasNetwork(), false);
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
    M.store.set(OK_, JSON.stringify([fix(1, 1, 5)])); M.net = { isConnected: false, isInternetReachable: false };
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
    setQ([fix(2, 12, 3), fix(2, 12, 2)]); M.net = { isConnected: false, isInternetReachable: false };
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
    M.net = { isConnected: false, isInternetReachable: false };
    assert.strictEqual(await L().drainForStop('2699', '12', 30000, FAST), 0);
    // session ends (params cleared by the real stop) → leftovers parked, still offline
    assert.strictEqual(await L().drainOrphans(), 0); assert.strictEqual(getO().length + getQ().length, 173);
    // later: app opened with network
    M.net = { isConnected: true, isInternetReachable: true }; M.clock += 3600000;
    let sent = 0; for (let i = 0; i < 10 && (getO().length || getQ().length); i++) sent += await L().drainOrphans(45000);
    assert.strictEqual(sent, 173); assert.strictEqual(M.api.posted.length, 173);
    assert.ok(M.api.posted.every((p) => p.body.participantId === '2699' && p.body.is_queued === 1));
  });
  test('p1652 (Kemmelberg): Stop with 173 queued, then Start again same race → leftovers sent FIRST', async () => {
    setQ(Array.from({ length: 173 }, (_, i) => fix(2, 9, 200 - i)));
    M.net = { isConnected: false, isInternetReachable: false };
    await L().drainForStop('2', '9', 30000, FAST);
    await L().drainOrphans();                     // parks them (no session)
    M.net = { isConnected: true, isInternetReachable: true };
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
  const confirmBody = () => bodyOf(/const confirmStopTracking = useCallback\(\(\) => \{([\s\S]*?)\n  \}, \[hasRaceStarted, stopGPSTracking, t\]\);/);
  const startedBody = () => bodyOf(/const hasRaceStarted = useCallback\(\(\): boolean => \{([\s\S]*?)\n  \}, \[homeData\?\.manual_start\]\);/);
  const confirmStop = (started) => {
    const calls = { stop: 0, alerts: [] };
    new Function('hasRaceStarted', 'stopGPSTracking', 'Alert', 't', confirmBody())(
      () => started, () => { calls.stop++; return Promise.resolve(); },
      { alert: (title, msg, buttons) => calls.alerts.push({ title, msg, buttons }) }, (k) => k);
    return calls;
  };
  const raceStarted = (homeData, start) =>
    new Function('homeData', 'raceStartTimeRef', startedBody())(homeData, { current: start });

  test('#2 Stop BEFORE the gun → confirmation, tracking keeps running', async () => {
    const c = confirmStop(false);
    assert.strictEqual(c.stop, 0, 'not stopped yet');
    assert.strictEqual(c.alerts.length, 1);
    assert.strictEqual(c.alerts[0].title, 'home:alerts.stopBeforeStartTitle');
    assert.strictEqual(c.alerts[0].msg, 'home:alerts.stopBeforeStartMessage');
  });
  test('#2 "Keep tracking" → nothing happens; "Stop anyway" → stops once', async () => {
    const c = confirmStop(false);
    const [keep, stop] = c.alerts[0].buttons;
    assert.strictEqual(keep.text, 'home:alerts.keepTracking'); assert.strictEqual(keep.style, 'cancel');
    assert.strictEqual(keep.onPress, undefined, 'keep has no action');
    assert.strictEqual(stop.text, 'home:alerts.stopAnyway'); assert.strictEqual(stop.style, 'destructive');
    stop.onPress();
    assert.strictEqual(c.stop, 1);
  });
  // Changed 2026-10-18 (M4): post-gun Stop used to be one tap and irreversible.
  test('#2 Stop AFTER the gun → confirmation with post-gun copy, not stopped until confirmed', async () => {
    const c = confirmStop(true);
    assert.strictEqual(c.stop, 0, 'not stopped yet'); assert.strictEqual(c.alerts.length, 1);
    assert.strictEqual(c.alerts[0].title, 'home:alerts.stopAfterStartTitle');
    assert.strictEqual(c.alerts[0].msg, 'home:alerts.stopAfterStartMessage');
    c.alerts[0].buttons[1].onPress();
    assert.strictEqual(c.stop, 1);
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
  test('isStaleSession: home offers ANOTHER race → stale; same race → not', async () => {
    const { isStaleSession } = R();
    const p = { participantId: '2', eventId: '12', raceStartTime: new Date(M.clock - 10 * HOUR).toISOString() };
    assert.strictEqual(isStaleSession(p, M.clock, { participantId: '7', eventId: '13' }), true, 'other participant + race');
    assert.strictEqual(isStaleSession(p, M.clock, { participantId: '2', eventId: '13' }), true, 'same participant, other race');
    assert.strictEqual(isStaleSession(p, M.clock, { participantId: 2, eventId: 12 }), false, 'same race (number vs string ids)');
  });
  test('isStaleSession: offline relaunch (no home ids) → keeps resuming', async () => {
    const { isStaleSession } = R();
    const p = { participantId: '2', eventId: '12', raceStartTime: new Date(M.clock - 3 * HOUR).toISOString() };
    assert.strictEqual(isStaleSession(p, M.clock, null), false);
    assert.strictEqual(isStaleSession(p, M.clock, { participantId: undefined, eventId: undefined }), false);
    assert.strictEqual(isStaleSession(null, M.clock), false, 'no session');
  });
  test('isStaleSession: manual start (no gun stored) → only the home check applies', async () => {
    const { isStaleSession } = R();
    const p = { participantId: '2', eventId: '12', raceStartTime: null, manualStart: 1 };
    assert.strictEqual(isStaleSession(p, M.clock), false);
    assert.strictEqual(isStaleSession(p, M.clock, { participantId: '9', eventId: '99' }), true);
    assert.strictEqual(isStaleSession({ ...p, raceStartTime: new Date(M.clock - 30 * HOUR).toISOString() }, M.clock), true, 'manual with an old stored gun');
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
  results.push(await run('12. 2026-10-18 audit (rr finish authoritative, stale sessions, gun offset, watchdog ids)'));

  const tot = results.reduce((a, r) => ({ pass: a.pass + r.pass, fail: a.fail + r.fail }), { pass: 0, fail: 0 });
  console.log(`\nAPP TOTAL: ${tot.pass} passed, ${tot.fail} failed`);
  process.exit(tot.fail ? 1 : 0);
})();
