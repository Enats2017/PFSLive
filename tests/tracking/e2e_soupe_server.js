// End-to-end on the Trail de la Soupe routes (event 24, 2026-11-28 / 29).
//
// The REAL app code (harness: native modules mocked) talks HTTP to the REAL larssie location / log / heartbeat APIs
// of a local checkout (default http://localhost/larssie_soupe), on the six real day routes (fixtures/soupe of the
// larssie repo), with fake RaceResult lists whose state the test moves on as the race goes; then the REAL watch cron
// decides who gets "Livio stopped tracking". LOCAL / DEV ONLY.
//
// Needs (see tests/tracking/README.md, "Trail de la Soupe end-to-end"):
//   php -S 127.0.0.1:8098 -t <larssie>/tests/tracking_api/fixtures/rr_fake_soupe
//   LARSSIE_DIR=<larssie checkout> API_BASE=<its URL> E2E_STORAGE=<its DIR_STORAGE> node tests/tracking/e2e_soupe_server.js
// ONLY=S1,S8 runs some scenarios (the fixture is shared). APP_SRC=<old src> runs them on older app code.
const cp = require('child_process');            // before the harness: it stubs unknown modules
const nodeFs = require('fs');
const assert = require('assert');
const H = require('./harness');
const { M, load, run, SRC } = H;
const test = (name, fn) => { if (!process.env.ONLY || process.env.ONLY.split(',').some((o) => name.startsWith(o + ' '))) H.test(name, fn); };

const LARSSIE = (process.env.LARSSIE_DIR || 'C:/xampp/htdocs/larssie_soupe').replace(/\\/g, '/');
const BASE = (process.env.API_BASE || 'http://localhost/larssie_soupe').replace(/\/$/, '');
const RR_BASE = process.env.RR_BASE || 'http://127.0.0.1:8098';
const STORAGE = (process.env.E2E_STORAGE || LARSSIE + '/ticketpress_storage').replace(/\\/g, '/').replace(/\/$/, '');
const STATE = LARSSIE + '/tests/tracking_api/fixtures/rr_fake_soupe/state.json';
const PHP = process.env.PHP_BIN || 'C:/php8/php';

// The fixture answers with one JSON line; tests/_env.php may print its environment notes before it.
const php = (...a) => {
  const out = cp.execFileSync(PHP, [LARSSIE + '/tests/tracking_api/e2e_soupe_fixture.php', ...a], { encoding: 'utf8' });
  const line = out.trim().split(/\r?\n/).filter((l) => l.trim().startsWith('{')).pop();
  if (!line) throw new Error('fixture ' + a[0] + ' answered no JSON: ' + out.slice(0, 300));
  return JSON.parse(line);
};
const realMs = () => Number(process.hrtime.bigint() / 1000000n);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const QK = '@PFSLive:locationQueue', QCK = '@PFSLive:locationQueueCount', OK_ = '@PFSLive:orphanQueue';
const PARAMS = '@PFSLive:trackingParams', RACE_FIN = '@PFSLive:raceFinished';

// ── fixture, routes, clock ────────────────────────────────────────────────
let FX = null;   // { event, povs, gun, course: {dk: gpx path}, runners: {S1: {pid, token, bib, dk, pov}} }
let EV = '';
const PACE = { 14: 8.0, 21: 7.5, 32: 7.0, 26: 7.5, 38: 7.0, 57: 6.5 };   // km/h, as the server suite
const ROUTES = {};
const hav = (a, b) => { const R = 6371000, r = Math.PI / 180, dLa = (b.lat - a.lat) * r, dLo = (b.lon - a.lon) * r;
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLo / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
const route = (dk) => {
  if (ROUTES[dk]) return ROUTES[dk];
  const pts = [];
  for (const m of nodeFs.readFileSync(FX.course[dk], 'utf8').matchAll(/<trkpt[^>]*lat="([-\d.]+)"[^>]*lon="([-\d.]+)"[^>]*>(?:\s*<ele>([-\d.]+)<\/ele>)?/g)) {
    pts.push({ lat: +m[1], lon: +m[2], ele: m[3] !== undefined ? +m[3] : 300 });
  }
  const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + hav(pts[i - 1], pts[i]));
  return (ROUTES[dk] = { pts, cum, km: cum[cum.length - 1] / 1000 });
};
const posAt = (dk, km) => {
  const { pts, cum } = route(dk);
  const m = Math.min(Math.max(km, 0) * 1000, cum[cum.length - 1]);
  let i = 1; while (i < cum.length - 1 && cum[i] < m) i++;
  const f = cum[i] === cum[i - 1] ? 0 : (m - cum[i - 1]) / (cum[i] - cum[i - 1]);
  return { lat: pts[i - 1].lat + f * (pts[i].lat - pts[i - 1].lat), lon: pts[i - 1].lon + f * (pts[i].lon - pts[i - 1].lon), ele: pts[i - 1].ele };
};
const R_ = (key) => FX.runners[key];
const raceSec = (dk) => route(dk).km / PACE[dk] * 3600;
const tAt = (dk, km) => (FX.gun + (km / route(dk).km) * raceSec(dk)) * 1000;
const STEP_KM = 0.2;
const kms = (a, b) => { const o = []; for (let k = a; k <= b + 1e-9; k += STEP_KM) o.push(+k.toFixed(3)); return o; };
const qfix = (key, km, extra = {}) => { const r = R_(key); const p = posAt(r.dk, km); return { participantId: String(r.pid), eventId: EV, latitude: p.lat, longitude: p.lon,
  altitude: p.ele, accuracy: 5, timestamp: new Date(tAt(r.dk, km)).toISOString(), speed: 2.1, heading: 0, batteryLevel: 60, batteryCharging: false,
  isMoving: true, queuedAt: '', retryCount: 0, ...extra }; };
const setQ = (a) => { M.store.set(QK, JSON.stringify(a)); M.store.set(QCK, String(a.length)); };
const getQ = () => JSON.parse(M.store.get(QK) || '[]');
const getO = () => JSON.parse(M.store.get(OK_) || '[]');
const arm = (key) => M.store.set(PARAMS, JSON.stringify({ participantId: String(R_(key).pid), eventId: EV, intervalSeconds: 30,
  raceStartTime: new Date(FX.gun * 1000).toISOString(), manualStart: 0, raceName: 'E2E Soupe' }));

// RaceResult as the timing mats see it, per day distance; the API's 30 s list cache is dropped on every change.
let RR = {};
const rr = (key, st) => {
  const r = R_(key);
  RR[r.dk] = RR[r.dk] || {};
  RR[r.dk][r.bib] = { ...(RR[r.dk][r.bib] || {}), ...st };
  nodeFs.writeFileSync(STATE, JSON.stringify(RR));
  try { nodeFs.unlinkSync(`${STORAGE}/rr_cache/rr_result_${EV}_${r.pov}.json`); } catch { /* none yet */ }
};

// ── the app's HTTP, to the real server ────────────────────────────────────
const net = { down: false, killAfter: null, posts: 0 };
let window_ = [];
const room = async (n) => {   // the API allows 600 requests / min per IP: pace OUTSIDE the app's own requests
  for (;;) {
    const now = realMs(); window_ = window_.filter((t) => now - t < 60000);
    if (window_.length + n <= 560 || window_.length === 0) return;
    await sleep(Math.max(50, 60050 - (now - window_[0])));
  }
};
const TOK = () => Object.fromEntries(Object.values(FX.runners).map((r) => [String(r.pid), r.token]));
const wire = () => {
  net.down = false; net.killAfter = null; net.posts = 0;
  const tokens = TOK();
  M.api.handler = async (url, body) => {
    const ep = url.replace('https://api.test', '');
    const isLoc = ep.includes('insert_participant_location');
    if (isLoc && net.killAfter !== null && net.posts >= net.killAfter) return new Promise(() => {});   // Livio ended mid-request
    if (isLoc && net.down) { const e = new Error('Network Error'); e.type = 'network'; throw e; }
    window_.push(realMs());
    const tok = tokens[String(body.participantId)];
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
// The online part of a race: what the phone already delivered (queued, so the real times are kept).
const history = async (key, a, b) => {
  const L = load('services/locationService').locationService;
  for (const km of kms(a, b)) {
    await room(1);
    const res = await L.sendLocation(String(R_(key).pid), EV, qfix(key, km), false, true);
    assert.ok(res.success, `history km ${km}: ${res.message}`);
  }
};
const rows = (key) => php('rows', String(R_(key).pid));
const logText = (name) => { try { return nodeFs.readFileSync(`${STORAGE}/logs/${name}`, 'utf8'); } catch { return ''; } };
// Wall-clock time: the harness fakes Date.now (the app's clock) but not new Date(); realMs() is a monotonic counter
// for pacing only, NOT a date.
const wallMs = () => new Date().getTime();
const apiLog = () => logText(`api_logs_${new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Brussels' })}.txt`);
// The cron judges silence by when the SERVER received the last fix; history was posted seconds ago, so it runs as
// it would 35 min later (a real silence; QUIET_AFTER_MIN is 30).
const cronNow = (aheadMin = 35) => php('cron', String(Math.floor(wallMs() / 1000) + aheadMin * 60));
const indoorsHeadless = async () => {                          // Android, Livio's UI killed, no GPS fix indoors
  M.os = 'android'; M.appState = 'background';
  const BG = require('react-native-background-geolocation').default;
  BG.getCurrentPosition = async () => { throw new Error('timeout'); };
  try { await load('services/gpsService').headlessTask({ name: 'heartbeat', params: {} }); }
  finally { delete BG.getCurrentPosition; }
};
const restartJs = () => { for (const k of Object.keys(require.cache)) if (k.replace(/\\/g, '/').startsWith(SRC)) delete require.cache[k]; };
const expectWhole = (r, n, what) => {
  assert.strictEqual(r.n, n, `${what}: ${r.n} rows stored, ${n} fixes recorded`);
  assert.strictEqual(r.distinct_ts, r.n, `${what}: ${r.n - r.distinct_ts} duplicate rows`);
  assert.ok(r.in_order, `${what}: rows not in recording order`);
  assert.strictEqual(r.backwards, 0, `${what}: distance went backwards ${r.backwards}x`);
};
const sessionClosed = () => !M.store.has(PARAMS) && M.store.get(RACE_FIN) === '1';
// Live tracking through the real gpsService: start the session, then fire engine fixes 31 s apart.
const startLive = async (key, clockMs) => {
  M.clock = clockMs;
  const { gpsService } = load('services/gpsService');
  await gpsService.startWatchingPosition(() => {}, () => {}, 30, String(R_(key).pid), EV, 't', 'b', 59, new Date(FX.gun * 1000).toISOString(), 0, 'E2E Soupe');
  assert.ok(typeof M.bg.location === 'function', 'engine location listener attached');
};
// One engine fix. Waits until the app has POSTED it (or 8 s): a real request to the local Apache (route + RaceResult
// read) takes longer than the fixed 400 ms the GT80 run used, and firing the next fix before the app finished the
// last one made it resend the first live fix instead (run 3: S1 sent km 13.98 three times, never reached the line).
// Live fixes reach the server stamped to the SECOND; two live fixes in the same real second are an exact duplicate
// there (LOCATION DEDUPE drop), so the later one never moves the runner (run 3: S10 posted 8 times, stored km 20.438
// each time). A phone sends at most one fix every 5 s: keep >= 1.1 s of real time between fires.
let lastFireMs = 0;
const fire = async (key, km, jitterM = 0) => { const r = R_(key); const p = posAt(r.dk, km);
  const j = jitterM ? (Math.random() * 2 - 1) * jitterM / 111320 : 0;
  const wait = 1100 - (realMs() - lastFireMs); if (wait > 0) await sleep(wait);
  lastFireMs = realMs();
  const before = M.api.posted.filter((x) => x.url.includes('insert_participant_location')).length;
  M.bg.location({ coords: { latitude: p.lat + j, longitude: p.lon + j, speed: 2.1, accuracy: 5, altitude: p.ele, heading: 0 }, timestamp: new Date(M.clock).toISOString(), is_moving: true });
  for (let t = 0; t < 80; t++) {
    await sleep(100);
    if (M.api.posted.filter((x) => x.url.includes('insert_participant_location')).length > before) break;
  }
  await sleep(150); };

(async () => {
  FX = php('setup', RR_BASE);
  EV = String(FX.event);
  console.log(`Soupe e2e: event ${EV}, gun ${new Date(FX.gun * 1000).toISOString()} (now - 10 h); routes ` +
    Object.keys(FX.course).map((d) => `${d}=${route(d).km.toFixed(2)} km`).join(' ') + `; app src ${SRC}; API ${BASE}`);
  RR = {}; for (const r of Object.values(FX.runners)) { RR[r.dk] = RR[r.dk] || {}; RR[r.dk][r.bib] = { km: 0 }; }
  delete RR['21']['2102'];                                        // S10: not on the 21 km list at all (GPS owns the finish)
  nodeFs.writeFileSync(STATE, JSON.stringify(RR));
  const results = [];

  test('S1 14 km online the whole way, crosses the line live → RaceResult finish stops tracking at the line; no push', async () => {
    wire(); const C = route('14').km; rr('S1', { km: 11.8 });
    await history('S1', 0, C - 1.2);
    await room(80);
    await startLive('S1', tAt('14', C - 1.0));
    for (let km = C - 1.0; km < C - 0.03 && M.store.has(PARAMS); km += 0.1) {
      if (km > C - 0.12) rr('S1', { km: 14.8, finished: true });   // over the mat
      M.clock += 31000; await fire('S1', km);
    }
    for (let i = 0; i < 4 && M.store.has(PARAMS); i++) { M.clock += 31000; await fire('S1', C); }
    assert.ok(!M.store.has(PARAMS), 'tracking stopped at the line');
    const r = rows('S1'); assert.strictEqual(r.distinct_ts, r.n); assert.strictEqual(r.backwards, 0);
    assert.ok(r.last_dtf < 0.2, 'last fix at the finish, dtf ' + r.last_dtf);
    assert.ok(!cronNow().due.some((d) => d[0] === R_('S1').pid), 'no push');
  });

  test('S2 Challenge 7A Saturday 32 km: offline from km 15, RaceResult finish while offline, back online indoors → one heartbeat closes the session and delivers every fix', async () => {
    wire(); const C = route('32').km; rr('S2', { km: 8.9 });
    await history('S2', 0, 15);
    rr('S2', { km: 32.1, finished: true });                       // finished while the phone was still offline
    const backlog = kms(15 + STEP_KM, C).map((k) => qfix('S2', k)); setQ(backlog); arm('S2');
    await room(200);
    await indoorsHeadless();                                       // network back, standing still indoors
    assert.ok(sessionClosed(), `session still open — params:${M.store.has(PARAMS)} raceFinished:${M.store.get(RACE_FIN)} queue:${getQ().length} leftovers:${getO().length}`);
    assert.strictEqual(getQ().length + getO().length, 0, 'nothing left on the phone');
    const r = rows('S2');
    expectWhole(r, kms(0, 15).length + backlog.length, '7A');
    assert.ok(Math.abs(r.max_dist - C) < 0.5 && r.last_dtf < 0.5, `end of course: max ${r.max_dist} km, last dtf ${r.last_dtf}`);
    assert.strictEqual(r.logs.length, 1, 'device log uploaded');
    assert.ok(!cronNow().due.some((d) => d[0] === R_('S2').pid), 'no "stopped tracking" push');
  });

  test('S3 Challenge 8B Sunday 57 km: network lost during the leftover upload → closed, rest kept, delivered on the next app open, no duplicates (through the village hairpin)', async () => {
    wire(); const C = route('57').km; rr('S3', { km: 30 });
    await history('S3', 0, 30);
    rr('S3', { km: 57.5, finished: true });
    const backlog = kms(30 + STEP_KM, C).map((k) => qfix('S3', k)); setQ(backlog); arm('S3');
    const before = net.posts;
    const L = load('services/locationService').locationService;
    M.api.handler = ((h) => async (u, b) => { if (u.includes('insert_participant_location') && net.posts - before >= 60) { const e = new Error('Network Error'); e.type = 'network'; throw e; } return h(u, b); })(M.api.handler);
    await room(200);
    M.appState = 'background';
    await L.processQueue(String(R_('S3').pid), EV);
    assert.ok(sessionClosed(), `closed — queue:${getQ().length} leftovers:${getO().length}`);
    assert.strictEqual(getQ().length + getO().length, backlog.length - 60, 'the unsent rest is kept');
    await room(200);
    wire(); M.appState = 'active';                                // network back, Livio opened (HomeScreen → drainOrphans)
    await L.drainOrphans(45000);
    assert.strictEqual(getO().length, 0);
    expectWhole(rows('S3'), kms(0, 30).length + backlog.length, '8B');
  });

  test('S4 26 km: RaceResult finish, Livio killed during the leftover upload, opened again → every fix stored exactly once', async () => {
    wire(); const C = route('26').km; rr('S4', { km: 17.7 });
    await history('S4', 0, 18);
    rr('S4', { km: 26.8, finished: true });
    const backlog = kms(18 + STEP_KM, C).map((k) => qfix('S4', k)); setQ(backlog); arm('S4');
    await room(200);
    net.killAfter = net.posts + 30;                                // the OS ends Livio after 30 uploads
    M.appState = 'background';
    const L = load('services/locationService').locationService;
    void L.processQueue(String(R_('S4').pid), EV);
    for (let t = 0; t < 600 && net.posts < net.killAfter; t++) await sleep(100);
    await sleep(500);
    const AS = require('@react-native-async-storage/async-storage').default;   // the killed context writes nothing more
    const live = { setItem: AS.setItem, removeItem: AS.removeItem, multiRemove: AS.multiRemove };
    AS.setItem = async () => {}; AS.removeItem = async () => {}; AS.multiRemove = async () => {};
    await sleep(11000);
    Object.assign(AS, live);
    await room(200);
    restartJs(); wire(); M.appState = 'active';
    await load('services/locationService').locationService.drainOrphans(45000);
    if (getQ().length) await load('services/locationService').locationService.drainForStop(String(R_('S4').pid), EV, 30000);
    expectWhole(rows('S4'), kms(0, 18).length + backlog.length, '26 km');
  });

  test('S5 38 km: RaceResult DNF at km 22 (predicted finish, no rank), phone quiet → the "stopped tracking" push still goes out', async () => {
    wire(); rr('S5', { km: 22 });
    await history('S5', 0, 22);
    rr('S5', { km: 22, dnf: true });
    const c = cronNow();
    assert.ok(c.due.some((d) => d[0] === R_('S5').pid && d[1] === 'quiet'), JSON.stringify(c.due));
  });

  test('S6 21 km: RaceResult finished, phone died at km 19 → no push; the same runner NOT finished gets it (control)', async () => {
    wire(); rr('S6', { km: 18.2 });
    await history('S6', 0, 19);
    let c = cronNow();
    assert.ok(c.due.some((d) => d[0] === R_('S6').pid && d[1] === 'quiet'), 'control: quiet push due while RR has no finish: ' + JSON.stringify(c.due));
    rr('S6', { km: 21.2, finished: true });
    c = cronNow();
    assert.ok(!c.due.some((d) => d[0] === R_('S6').pid), 'finished per RaceResult → no push: ' + JSON.stringify(c.due));
  });

  test('S7 14 km start area (36 m from the finish): Start 10 min before the gun, standing, then running → no finish, session stays open', async () => {
    wire(); rr('S7', { km: 0 });
    await room(80);
    await startLive('S7', (FX.gun - 600) * 1000);
    for (let i = 0; i < 20; i++) { M.clock += 31000; await fire('S7', 0, 8); }            // before and just after the gun, at the start line
    for (let km = 0; km <= 1.5; km += 0.1) { M.clock += 31000; await fire('S7', km, 5); }   // off on the course
    assert.ok(M.store.has(PARAMS) && M.store.get(RACE_FIN) !== '1', `session must stay open — params:${M.store.has(PARAMS)} fin:${M.store.get(RACE_FIN)}`);
    const r = rows('S7'); assert.strictEqual(r.backwards, 0);
    assert.ok(r.last_dtf > 12, 'still ~13 km to go, dtf ' + r.last_dtf);
  });

  test('S8 Challenge 7B: Sunday session started on the phone that finished Saturday (raceFinished left on it) → tracks normally', async () => {
    wire(); rr('S8', { km: 0 });
    M.store.set(RACE_FIN, '1');                                    // what Saturday's finish leaves on the phone
    M.store.set(PARAMS, JSON.stringify({ participantId: String(R_('S2').pid), eventId: EV, intervalSeconds: 30, raceStartTime: new Date(FX.gun * 1000).toISOString(), manualStart: 0, raceName: 'E2E Soupe' }));
    await room(80);
    await startLive('S8', tAt('57', 0.4));
    for (let km = 0.4; km <= 1.6; km += 0.1) { M.clock += 31000; await fire('S8', km); }
    const p = JSON.parse(M.store.get(PARAMS) || '{}');
    assert.strictEqual(String(p.participantId), String(R_('S8').pid), 'the Sunday registration is the session');
    assert.notStrictEqual(M.store.get(RACE_FIN), '1', 'Saturday\'s finish flag cleared');
    const r = rows('S8');
    assert.ok(r.n >= 10, `Sunday fixes stored on 7B (${r.n})`); assert.strictEqual(r.backwards, 0);
  });

  test('S9 57 km live through the Sunday village hairpin (km 1.8-2.8, the course 9-25 m from itself) → distance never back, no finish, session open', async () => {
    wire(); rr('S9', { km: 0 });
    await history('S9', 0, 1.6);
    await room(80);
    await startLive('S9', tAt('57', 1.7));
    for (let km = 1.8; km <= 2.8; km += 0.05) { M.clock += 15000; await fire('S9', km, 10); }
    assert.ok(M.store.has(PARAMS) && M.store.get(RACE_FIN) !== '1', 'session open, no finish');
    const r = rows('S9'); assert.strictEqual(r.backwards, 0, 'distance went back');
    assert.ok(r.last_dist >= 2.5 && r.last_dist <= 3.4, 'shown at the end of the hairpin: ' + r.last_dist);
  });

  test('S10 21 km: bib not on the RaceResult list → GPS finish at the line stops tracking (finish_source distance)', async () => {
    wire(); const C = route('21').km;
    await history('S10', 0, C - 1.0);
    await room(80);
    await startLive('S10', tAt('21', C - 0.8));
    for (let km = C - 0.8; km < C && M.store.has(PARAMS); km += 0.1) { M.clock += 31000; await fire('S10', km); }
    for (let i = 0; i < 6 && M.store.has(PARAMS); i++) { M.clock += 31000; await fire('S10', C); }
    const live = M.api.posted.filter((p) => p.url.includes('insert_participant_location') && !p.body?.is_queued);
    const ans = live.map((p) => { const d = p.json?.data || p.json || {}; return `${d.distance_covered}/${d.distance_to_finish_km}/f${d.finished}/${d.finish_source}`; });
    assert.ok(!M.store.has(PARAMS), `tracking stopped at the line — ${live.length} live posts, server answered (dist/dtf/finished/src): ${ans.slice(-6).join(' ')}`);
    const fin = M.api.posted.filter((p) => p.json?.data?.finished === 1 || p.json?.finished === 1);
    assert.ok(fin.length > 0 && String((fin[0].json.data || fin[0].json).finish_source) === 'distance', 'finished by GPS: ' + JSON.stringify(fin[0]?.json));
  });

  test('S11 32 km: RaceResult finish arrives 3 min after the line → tracking keeps going until it does, then stops', async () => {
    wire(); const C = route('32').km; rr('S11', { km: 29.1 });
    await history('S11', 0, C - 1.0);
    await room(80);
    await startLive('S11', tAt('32', C - 0.8));
    for (let km = C - 0.8; km < C; km += 0.1) { M.clock += 31000; await fire('S11', km); }
    for (let i = 0; i < 6; i++) { M.clock += 31000; await fire('S11', C, 6); }   // 3 min standing at the line, no RR result yet
    assert.ok(M.store.has(PARAMS), 'must keep tracking while RaceResult has not finished the runner');
    rr('S11', { km: 32.1, finished: true });
    for (let i = 0; i < 4 && M.store.has(PARAMS); i++) { M.clock += 31000; await fire('S11', C, 6); }
    assert.ok(!M.store.has(PARAMS), 'stopped once RaceResult finished the runner');
  });

  results.push(await run('Trail de la Soupe end-to-end: real app code → real location API → real watch cron'));
  php('cleanup');
  try { nodeFs.unlinkSync(STATE); } catch {}
  const tot = results.reduce((a, r) => ({ pass: a.pass + r.pass, fail: a.fail + r.fail }), { pass: 0, fail: 0 });
  console.log(`\nE2E TOTAL: ${tot.pass} passed, ${tot.fail} failed`);
  process.exit(tot.fail ? 1 : 0);
})().catch((e) => { console.error(e); try { php('cleanup'); } catch {} try { nodeFs.unlinkSync(STATE); } catch {} process.exit(1); });
