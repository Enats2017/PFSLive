// End-to-end on the GTLC Winter GT80 course (2026-11-08 post-race review).
//
// The REAL app code (harness: native modules mocked) talks HTTP to the REAL
// larssie location / log / heartbeat APIs of a local checkout, on a copy of the
// GT80 distance with the real GPX (gpx_20261102091713.gpx, 78.909 km) and a fake
// RaceResult feed whose state the test moves on as the race goes; then the REAL
// watch cron decides who gets "Livio stopped tracking". LOCAL / DEV ONLY.
//
// Needs (see tests/tracking/README.md, "GT80 end-to-end"):
//   php -S 127.0.0.1:8099 -t <larssie>                                 (API; config DIR_STORAGE = E2E_STORAGE)
//   php -S 127.0.0.1:8097 -t <larssie>/tests/tracking_api/fixtures/rr_fake
//   LARSSIE_DIR=<larssie> E2E_STORAGE=<that DIR_STORAGE> node tests/tracking/e2e_gt80_server.js
// APP_SRC=<old src> runs the same scenarios on older app code (see harness.js).
const cp = require('child_process');            // before the harness: it stubs unknown modules
const nodeFs = require('fs');
const assert = require('assert');
const H = require('./harness');
const { M, load, run, SRC } = H;
// ONLY=S6 runs that scenario alone (the fixture setup is shared).
const test = (name, fn) => { if (!process.env.ONLY || process.env.ONLY.split(',').some((o) => name.startsWith(o + ' '))) H.test(name, fn); };

const LARSSIE = (process.env.LARSSIE_DIR || 'C:/wt/e2e_srv').replace(/\\/g, '/');
const BASE = process.env.API_BASE || 'http://127.0.0.1:8099';
const RR_URL = process.env.RR_URL || 'http://127.0.0.1:8097/index.php';
const STORAGE = (process.env.E2E_STORAGE || '').replace(/\\/g, '/').replace(/\/$/, '');
const GPX = process.env.GPX || 'C:/xampp/htdocs/larssie/image/mobile_app/gpx_files/gpx_20261102091713.gpx';
const STATE = LARSSIE + '/tests/tracking_api/fixtures/rr_fake/state.json';
const EV = '990021';
if (!STORAGE) { console.error('E2E_STORAGE (the API server\'s DIR_STORAGE) is required'); process.exit(2); }

const php = (...a) => JSON.parse(cp.execFileSync('php', [LARSSIE + '/tests/tracking_api/e2e_gt80_fixture.php', ...a], { encoding: 'utf8' }));
const realMs = () => Number(process.hrtime.bigint() / 1000000n);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const QK = '@PFSLive:locationQueue', QCK = '@PFSLive:locationQueueCount', OK_ = '@PFSLive:orphanQueue';
const PARAMS = '@PFSLive:trackingParams', RACE_FIN = '@PFSLive:raceFinished';

// ── course ────────────────────────────────────────────────────────────────
const pts = [];
for (const m of nodeFs.readFileSync(GPX, 'utf8').matchAll(/<trkpt[^>]*lat="([-\d.]+)"[^>]*lon="([-\d.]+)"[^>]*>(?:\s*<ele>([-\d.]+)<\/ele>)?/g)) {
  pts.push({ lat: +m[1], lon: +m[2], ele: m[3] !== undefined ? +m[3] : 300 });
}
const hav = (a, b) => { const R = 6371000, r = Math.PI / 180, dLa = (b.lat - a.lat) * r, dLo = (b.lon - a.lon) * r;
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLo / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + hav(pts[i - 1], pts[i]));
const COURSE_KM = cum[cum.length - 1] / 1000;
const posAt = (km) => {
  const m = Math.min(km * 1000, cum[cum.length - 1]);
  let i = 1; while (i < cum.length - 1 && cum[i] < m) i++;
  const f = cum[i] === cum[i - 1] ? 0 : (m - cum[i - 1]) / (cum[i] - cum[i - 1]);
  return { lat: pts[i - 1].lat + f * (pts[i].lat - pts[i - 1].lat), lon: pts[i - 1].lon + f * (pts[i].lon - pts[i - 1].lon), ele: pts[i - 1].ele };
};

// ── fixture + clock ───────────────────────────────────────────────────────
let FX = null;   // { gun, runners: { pid: { token, bib } } }
const RACE_SEC = 9.75 * 3600;                                  // p6755: 9:45:34
const tAt = (km) => (FX.gun + (km / COURSE_KM) * RACE_SEC) * 1000;
const STEP_KM = 0.2;
const kms = (a, b) => { const o = []; for (let k = a; k <= b + 1e-9; k += STEP_KM) o.push(+k.toFixed(3)); return o; };
const qfix = (pid, km, extra = {}) => { const p = posAt(km); return { participantId: String(pid), eventId: EV, latitude: p.lat, longitude: p.lon,
  altitude: p.ele, accuracy: 5, timestamp: new Date(tAt(km)).toISOString(), speed: 2.25, heading: 0, batteryLevel: 60, batteryCharging: false,
  isMoving: true, queuedAt: '', retryCount: 0, ...extra }; };
const setQ = (a) => { M.store.set(QK, JSON.stringify(a)); M.store.set(QCK, String(a.length)); };
const getQ = () => JSON.parse(M.store.get(QK) || '[]');
const getO = () => JSON.parse(M.store.get(OK_) || '[]');
const arm = (pid) => M.store.set(PARAMS, JSON.stringify({ participantId: String(pid), eventId: EV, intervalSeconds: 30,
  raceStartTime: new Date(FX.gun * 1000).toISOString(), manualStart: 0, raceName: 'E2E GT80' }));

// RaceResult as the timing mats see it; the shared 30 s feed cache is dropped on every change.
let RR = {};
const rr = (bib, st) => {
  RR[bib] = { ...(RR[bib] || {}), ...st };
  nodeFs.writeFileSync(STATE, JSON.stringify(RR));
  try { nodeFs.unlinkSync(`${STORAGE}/rr_cache/rr_result_${EV}_990091.json`); } catch { /* none yet */ }
};

// ── the app's HTTP, to the real server ────────────────────────────────────
const net = { down: false, killAfter: null, posts: 0 };
let window_ = [];
// The API allows 600 requests / min per IP. Pacing happens OUTSIDE the app's
// requests (a wait inside one would trip the app's own 10 s withTimeout):
// history waits per fix, an app phase first waits for room for its burst.
const room = async (n) => {
  for (;;) {
    const now = realMs(); window_ = window_.filter((t) => now - t < 60000);
    if (window_.length + n <= 560 || window_.length === 0) return;
    await sleep(Math.max(50, 60050 - (now - window_[0])));
  }
};
const throttle = async () => { window_.push(realMs()); };
const wire = () => {
  net.down = false; net.killAfter = null; net.posts = 0;
  M.api.handler = async (url, body) => {
    const ep = url.replace('https://api.test', '');
    const isLoc = ep.includes('insert_participant_location');
    if (isLoc && net.killAfter !== null && net.posts >= net.killAfter) return new Promise(() => {});   // Livio ended mid-request
    if (isLoc && net.down) { const e = new Error('Network Error'); e.type = 'network'; throw e; }
    await throttle();
    const tok = FX.runners[String(body.participantId)]?.token;
    const res = await fetch(BASE + '/api' + ep, { method: 'POST', body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok } });
    const j = await res.json().catch(() => null);
    if (isLoc) net.posts++;
    M.api.posted.push({ url, body, status: res.status, json: j });
    if (!j) { const e = new Error('HTTP ' + res.status); e.type = 'server'; throw e; }
    if (j.success !== true) { const e = new Error(j.error); e.type = res.status >= 500 ? 'server' : 'empty'; e.code = String(j.error || '').toLowerCase(); throw e; }
    return j;
  };
};
// Earlier, online part of a race: what the phone already delivered (queued, so the real times are kept).
const history = async (pid, a, b) => {
  const L = load('services/locationService').locationService;
  for (const km of kms(a, b)) {
    const f = qfix(pid, km);
    await room(1);
    const r = await L.sendLocation(String(pid), EV, f, false, true);
    assert.ok(r.success, `history km ${km}: ${r.message}`);
  }
};
const rows = (pid) => php('rows', String(pid));
const logText = (name) => { try { return nodeFs.readFileSync(`${STORAGE}/logs/${name}`, 'utf8'); } catch { return ''; } };
const apiLog = () => logText(`api_logs_${new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Brussels' })}.txt`);
// The cron judges silence by when the SERVER received the last fix; history was
// posted seconds ago, so it runs as it would 35 min later (a real silence).
const cronNow = (aheadMin = 35) => php('cron', String(Math.floor(new Date().getTime() / 1000) + aheadMin * 60));
const indoorsHeadless = async () => {                          // Android, Livio's UI killed, no GPS fix indoors
  M.os = 'android'; M.appState = 'background';
  const BG = require('react-native-background-geolocation').default;
  BG.getCurrentPosition = async () => { throw new Error('timeout'); };
  try { await load('services/gpsService').headlessTask({ name: 'heartbeat', params: {} }); }
  finally { delete BG.getCurrentPosition; }
};
const restartJs = () => {                                      // a new JS context: modules fresh, AsyncStorage kept
  for (const k of Object.keys(require.cache)) if (k.replace(/\\/g, '/').startsWith(SRC)) delete require.cache[k];
};
const expectWhole = (r, n, what) => {
  assert.strictEqual(r.n, n, `${what}: ${r.n} rows stored, ${n} fixes recorded`);
  assert.strictEqual(r.distinct_ts, r.n, `${what}: ${r.n - r.distinct_ts} duplicate rows`);
  assert.ok(r.in_order, `${what}: rows not in recording order`);
  assert.strictEqual(r.backwards, 0, `${what}: distance went backwards ${r.backwards}×`);
};

(async () => {
  FX = php('setup', RR_URL);
  console.log(`GT80 copy: ${pts.length} GPX points, ${COURSE_KM.toFixed(3)} km; gun ${new Date(FX.gun * 1000).toISOString()} (now - 10 h); app src ${SRC}; API ${BASE}`);
  RR = {}; for (const r of Object.values(FX.runners)) RR[r.bib] = { km: 0 };
  nodeFs.writeFileSync(STATE, JSON.stringify(RR));
  const results = [];
  const sessionClosed = () => !M.store.has(PARAMS) && M.store.get(RACE_FIN) === '1';

  test('S1 p6755: offline from km 40, RaceResult finish, phone back online indoors → one heartbeat closes the session and delivers every fix', async () => {
    wire(); rr('990001', { km: 40 });
    await history(990601, 0, 40);
    rr('990001', { km: 79.5, finished: true });                 // 16:45, phone still offline
    const backlog = kms(40 + STEP_KM, COURSE_KM).map((k) => qfix(990601, k)); setQ(backlog); arm(990601);
    await room(260);
    await indoorsHeadless();                                     // 18:07: network back, standing still
    assert.ok(sessionClosed(), `session still open — params:${M.store.has(PARAMS)} raceFinished:${M.store.get(RACE_FIN)} queue:${getQ().length} leftovers:${getO().length}`);
    assert.strictEqual(getQ().length + getO().length, 0, 'nothing left on the phone');
    const r = rows(990601);
    expectWhole(r, kms(0, 40).length + backlog.length, 'p6755');
    assert.ok(Math.abs(r.max_dist - COURSE_KM) < 0.5 && r.last_dtf < 0.5, `end of course: max ${r.max_dist} km, last dtf ${r.last_dtf}`);
    assert.strictEqual(r.logs.length, 1, 'device log uploaded (prod: none)');
    const hb = logText('api_hearbeat_logs.txt').split('\n').filter((l) => l.includes('p:990601 '));
    assert.ok(hb.some((l) => / \| q:\d+ .*src:headless$/.test(l.trim())), 'heartbeat line with the queue, src:headless: ' + hb.join(' / '));
    const lefts = apiLog().split('\n').filter((l) => l.includes('LOCATION OK | p:990601 ') && / queued left:\d+ /.test(l));
    assert.ok(lefts.length >= backlog.length, `queued left:N on the backlog lines (${lefts.length})`);
    const c = cronNow();
    assert.ok(!c.due.some((d) => d[0] === 990601), 'no "Livio stopped tracking" for p6755: ' + JSON.stringify(c.due));
  });

  test('S2 RaceResult finished, phone died at km 74 → no push; the same runner NOT finished would get it (control)', async () => {
    wire(); rr('990002', { km: 72.7 });
    await history(990602, 0, 74);
    rr('990002', { km: 72.7, finished: false });
    let c = cronNow();
    assert.ok(c.due.some((d) => d[0] === 990602 && d[1] === 'quiet'), 'control: quiet push due while RR has no finish: ' + JSON.stringify(c.due));
    rr('990002', { km: 79.5, finished: true });
    c = cronNow();
    assert.ok(!c.due.some((d) => d[0] === 990602), 'finished per RaceResult → no push: ' + JSON.stringify(c.due));
    assert.ok(c.log.some((l) => /p:990602 .*finished per RaceResult — not pushed/.test(l)), 'skip logged');
  });

  test('S3 RaceResult DNF at km 30 (predicted finish time, no rank, no speed), phone quiet → the push still goes out', async () => {
    wire(); rr('990003', { km: 30 });
    await history(990603, 0, 30);
    rr('990003', { km: 30, dnf: true });
    const c = cronNow();
    assert.ok(c.due.some((d) => d[0] === 990603 && d[1] === 'quiet'), JSON.stringify(c.due));
    assert.ok(c.log.some((l) => /quiet \| p:990603 .*key:trk_quiet_\d+ \| last fix:\d\d:\d\d dtf:/.test(l)), 'push line with last fix + dtf');
  });

  test('S4 backlog km 50-60, no finish yet, indoors (no GPS fix) → the heartbeat delivers it; session stays open', async () => {
    wire(); rr('990004', { km: 51.6 });
    await history(990604, 0, 50);
    const backlog = kms(50 + STEP_KM, 60).map((k) => qfix(990604, k)); setQ(backlog); arm(990604);
    await room(260);
    await indoorsHeadless();
    assert.ok(M.store.has(PARAMS), 'session still open (no finish)');
    assert.strictEqual(getQ().length, 0, 'queue delivered by the beat (old app: waits for a GPS fix)');
    expectWhole(rows(990604), kms(0, 50).length + backlog.length, 'p990604');
  });

  test('S5 RaceResult finish, network lost again during the leftover upload → closed, rest kept, delivered on the next app open, no duplicates', async () => {
    wire(); rr('990005', { km: 40 });
    await history(990605, 0, 40);
    rr('990005', { km: 79.5, finished: true });
    const backlog = kms(40 + STEP_KM, COURSE_KM).map((k) => qfix(990605, k)); setQ(backlog); arm(990605);
    const before = net.posts;
    const L = load('services/locationService').locationService;
    M.api.handler = ((h) => async (u, b) => { if (u.includes('insert_participant_location') && net.posts - before >= 100) { const e = new Error('Network Error'); e.type = 'network'; throw e; } return h(u, b); })(M.api.handler);
    await room(260);
    M.appState = 'background';
    await L.processQueue('990605', EV);
    assert.ok(sessionClosed(), `closed — queue:${getQ().length} leftovers:${getO().length}`);
    assert.strictEqual(getQ().length + getO().length, backlog.length - 100, 'the unsent rest is kept');
    await room(260);
    wire();                                                      // network back, runner opens Livio (HomeScreen → drainOrphans)
    M.appState = 'active';
    await L.drainOrphans(45000);
    assert.strictEqual(getO().length, 0);
    expectWhole(rows(990605), kms(0, 40).length + backlog.length, 'p990605');
  });

  test('S6 RaceResult finish, Livio killed during the leftover upload, opened again → every fix stored exactly once', async () => {
    wire(); rr('990006', { km: 40 });
    await history(990606, 0, 40);
    rr('990006', { km: 79.5, finished: true });
    const backlog = kms(40 + STEP_KM, COURSE_KM).map((k) => qfix(990606, k)); setQ(backlog); arm(990606);
    await room(260);
    net.killAfter = net.posts + 50 + 37;                          // processQueue's 50, then 37 leftovers, then the OS ends Livio
    M.appState = 'background';
    const L = load('services/locationService').locationService;
    void L.processQueue('990606', EV);
    for (let t = 0; t < 600 && net.posts < net.killAfter; t++) await sleep(100);   // until the OS ends Livio
    await sleep(500);
    // The OS ended Livio here: from now on that JS context writes nothing. (Hanging
    // its request is not enough — its own 10 s withTimeout fires later, and the
    // "dead" drain would then save its progress, which a killed app never does.)
    const AS = require('@react-native-async-storage/async-storage').default;
    const live = { setItem: AS.setItem, removeItem: AS.removeItem, multiRemove: AS.multiRemove };
    AS.setItem = async () => {}; AS.removeItem = async () => {}; AS.multiRemove = async () => {};
    const leftAtKill = getQ().length + getO().length;
    const postsAtKill = net.posts;
    if (process.env.E2E_DEBUG) console.log('        [debug] at kill: queue', getQ().length, 'orphans', getO().length, 'first orphan', getO()[0]?.timestamp, 'params', M.store.has(PARAMS), 'fin', M.store.get(RACE_FIN), 'killAfter', net.killAfter);
    await sleep(11000);                                          // the dead context's timers run out, into the void
    Object.assign(AS, live);
    await room(260);
    restartJs(); wire(); M.appState = 'active';                   // reopened: new JS context, same storage
    await load('services/locationService').locationService.drainOrphans(45000);
    if (getQ().length) { await load('services/locationService').locationService.drainForStop('990606', EV, 30000); }
    const r = rows(990606);
    const drops = (apiLog().match(/DEDUPE drop \((queued resend|exact dup)\) \| p:990606 /g) || []).length;
    assert.ok(net.posts > leftAtKill - 1 && drops >= 1, `the reopened app re-sent fixes the server already had (posts ${net.posts}, left ${leftAtKill}, dedupe drops ${drops}) — otherwise this scenario tests nothing`);
    console.log(`        (location posts before the kill: ${postsAtKill}; after reopening: ${net.posts})`);
    console.log(`        (at the kill: ${leftAtKill} still on the phone; dedupe drops: ${drops})`);
    expectWhole(r, kms(0, 40).length + backlog.length, 'p990606');
  });

  test('S7 online the whole way, crosses the line live → RaceResult finish stops tracking at the line; no push', async () => {
    wire(); rr('990007', { km: 72.7 });
    await history(990607, 0, 77.6);
    M.clock = FX.gun * 1000 + RACE_SEC * 1000 - 5 * 60000;     // live from 5 min before the finish
    await room(260);
    const { gpsService } = load('services/gpsService');
    await gpsService.startWatchingPosition(() => {}, () => {}, 30, '990607', EV, 't', 'b', 59, new Date(FX.gun * 1000).toISOString(), 0, 'E2E GT80');
    assert.ok(typeof M.bg.location === 'function');
    const fire = async (km) => { const p = posAt(km);
      M.bg.location({ coords: { latitude: p.lat, longitude: p.lon, speed: 2.3, accuracy: 5, altitude: p.ele, heading: 0 }, timestamp: new Date(M.clock).toISOString(), is_moving: true });
      await sleep(400); };
    let km = 77.8;
    for (; km < COURSE_KM - 0.05 && M.store.has(PARAMS); km += 0.1) {
      if (km > COURSE_KM - 0.12) rr('990007', { km: 79.5, finished: true });   // over the mat
      M.clock += 31000; await fire(km);
    }
    for (let i = 0; i < 4 && M.store.has(PARAMS); i++) { M.clock += 31000; await fire(COURSE_KM); }
    assert.ok(!M.store.has(PARAMS), 'tracking stopped at the line');
    const r = rows(990607);
    assert.strictEqual(r.distinct_ts, r.n); assert.strictEqual(r.backwards, 0);
    assert.ok(r.last_dtf < 0.2, 'last fix at the finish, dtf ' + r.last_dtf);
    const c = cronNow();
    assert.ok(!c.due.some((d) => d[0] === 990607), JSON.stringify(c.due));
  });

  results.push(await run('GT80 end-to-end: real app code → real location API → real watch cron'));
  php('cleanup');
  const tot = results.reduce((a, r) => ({ pass: a.pass + r.pass, fail: a.fail + r.fail }), { pass: 0, fail: 0 });
  console.log(`\nE2E TOTAL: ${tot.pass} passed, ${tot.fail} failed`);
  process.exit(tot.fail ? 1 : 0);
})().catch((e) => { console.error(e); try { php('cleanup'); } catch {} process.exit(1); });
