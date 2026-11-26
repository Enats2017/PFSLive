// Results, live map and event lists — regression tests for the app audit of
// 2026-11-26 (findings 1-23). Plain Node, no framework:
//
//   node tests/results/app.test.js
//   APP_SRC=D:/react_native/PFSLive/src node tests/results/app.test.js   (old code: must FAIL)
//
// The REAL app TypeScript is loaded (see harness.js); hooks run in a tiny fake
// React with fake timers; services are mocked at their module boundary.
const assert = require('assert');
const path = require('path');
const { spawnSync } = require('child_process');
const H = require('./harness');
const { T, M, flush, advance, sleepInBackground, renderHook, mockModule, load, exists, source, deferred, test, run, textOf } = H;

const need = (rel) => { assert.ok(exists(rel), `missing module src/${rel} (fix not present)`); return load(rel); };
const has = (rel, snippet, msg) => assert.ok(source(rel).includes(snippet), msg || `${rel} lacks: ${snippet}`);
const hasNot = (rel, snippet, msg) => assert.ok(!source(rel).includes(snippet), msg || `${rel} still has: ${snippet}`);

(async () => {
  const results = [];

  // ════════ 1. Tab bar: back to the open screen, not another copy (finding 1) ════════
  const { StackRouter, StackActions, CommonActions } = require('@react-navigation/routers');
  const names = ['HomeScreen', 'EventDetails', 'ResultList', 'LiveTracking', 'ResultDetails', 'FavouriteList', 'FollowDetails'];
  const router = StackRouter({});
  const ropts = { routeNames: names, routeParamList: {}, routeGetIdList: {} };
  const start = () => router.getInitialState(ropts);
  const nav = (s, n, p) => router.getStateForAction(s, CommonActions.navigate(n, p), ropts) || s;
  // What BottomNavigation's goTo does, against the real router.
  const tab = (s, n, p) => {
    const { tabPopCount } = need('utils/tabNavigation');
    const pops = tabPopCount(s.routes, s.index, n, n === 'HomeScreen' ? null : (p && p.product_app_id));
    return pops > 0 ? router.getStateForAction(s, StackActions.pop(pops), ropts) : nav(s, n, p);
  };
  const shape = (s) => s.routes.map((r) => r.name + (r.params && r.params.product_app_id ? ':' + r.params.product_app_id : '')).join(' > ');

  test('Results ↔ Map ↔ Results ↔ Map never stacks a second map or list (React Navigation 7 navigate pushed a copy each time)', () => {
    let s = start();
    s = nav(s, 'ResultList', { product_app_id: 24 });
    for (let i = 0; i < 5; i++) {
      s = tab(s, 'LiveTracking', { product_app_id: 24 });
      assert.ok(s.routes.filter((r) => r.name === 'LiveTracking').length <= 1, shape(s));
      s = tab(s, 'ResultList', { product_app_id: 24 });
      assert.ok(s.routes.filter((r) => r.name === 'ResultList').length <= 1, shape(s));
    }
    assert.strictEqual(shape(s), 'HomeScreen > ResultList:24', 'Results pops back to the list the map was opened from');
  });
  test('a map opened first, then Results, then Map: back to THAT map (same route key, state intact)', () => {
    let s = start();
    s = nav(s, 'LiveTracking', { product_app_id: 24 });
    const key = s.routes[1].key;
    s = tab(s, 'ResultList', { product_app_id: 24 });
    assert.strictEqual(shape(s), 'HomeScreen > LiveTracking:24 > ResultList:24');
    s = tab(s, 'LiveTracking', { product_app_id: 24 });
    assert.strictEqual(shape(s), 'HomeScreen > LiveTracking:24');
    assert.strictEqual(s.routes[s.index].key, key);
  });
  test('a map open for ANOTHER race is never reused — a new one is pushed', () => {
    let s = start();
    s = nav(s, 'LiveTracking', { product_app_id: 11 });
    s = nav(s, 'ResultList', { product_app_id: 24 });
    s = tab(s, 'LiveTracking', { product_app_id: 24 });
    assert.strictEqual(shape(s), 'HomeScreen > LiveTracking:11 > ResultList:24 > LiveTracking:24');
  });
  test('a custom event map with the same numeric id is never reused', () => {
    const { tabPopCount } = need('utils/tabNavigation');
    const routes = [{ name: 'HomeScreen' }, { name: 'LiveTracking', params: { product_app_id: 24, event_source: 'custom' } }, { name: 'ResultList', params: { product_app_id: 24 } }];
    assert.strictEqual(tabPopCount(routes, 2, 'LiveTracking', 24), 0);
  });
  test('Results from Result Details (opened from the list) goes back to that list; back from it still works', () => {
    let s = start();
    s = nav(s, 'EventDetails', { product_app_id: 24 });
    s = nav(s, 'ResultList', { product_app_id: 24 });
    s = nav(s, 'ResultDetails', { bib: '7' });
    s = nav(s, 'LiveTracking', { product_app_id: 24 });
    s = tab(s, 'ResultList', { product_app_id: 24 });
    assert.strictEqual(shape(s), 'HomeScreen > EventDetails:24 > ResultList:24');
    s = router.getStateForAction(s, StackActions.pop(1), ropts);
    assert.strictEqual(shape(s), 'HomeScreen > EventDetails:24', 'back lands on the event page');
  });
  test('Home tab with no race returns to the existing HomeScreen instead of a second one', () => {
    let s = start();
    s = nav(s, 'ResultList', { product_app_id: 24 });
    s = tab(s, 'HomeScreen');
    assert.strictEqual(shape(s), 'HomeScreen');
  });
  test('tapping the tab of the screen you are on still just updates it (no pop, no push)', () => {
    let s = start();
    s = nav(s, 'ResultList', { product_app_id: 24 });
    s = tab(s, 'ResultList', { product_app_id: 24, x: 1 });
    assert.strictEqual(s.routes.length, 2);
  });
  test('both tab bars navigate through goTo (tabPlan), not a bare navigate()', () => {
    for (const f of ['components/common/BottomNavigation.tsx', 'components/common/BottomNavigationFollower.tsx']) {
      has(f, 'tabPlan(state.routes, state.index, name, params)');
      has(f, 'navigation.dispatch(StackActions.pop(plan.pops));');
      const calls = source(f).split('navigation.navigate(').length - 1;
      assert.strictEqual(calls, 1, `${f}: navigate() only inside goTo, found ${calls}`);
    }
  });
  test('the live map pauses its timer and location watcher when not focused', () => {
    has('screens/LiveTrackingScreen.tsx', 'const isFocused = useIsFocused();');
    has('screens/LiveTrackingScreen.tsx', '        if (!isFocused) return;\n        let watcher');
    has('screens/LiveTrackingScreen.tsx', '        if (!isFocused) return;\n\n        // Back on the map');
    has('screens/LiveTrackingScreen.tsx', '}, [isFocused]);');
  });
  results.push(await run('1. tab bar + focus'));

  // ════════ 2/6/15. Live map: failures, timeouts, cadence ════════
  test('a failed AUTO refresh over a drawn map keeps the map; first load / switch / retry still show the error', () => {
    const { failureShowsErrorScreen } = need('utils/liveMapRequests');
    assert.strictEqual(failureShowsErrorScreen(true, true), false);
    assert.strictEqual(failureShowsErrorScreen(true, false), true, 'nothing drawn yet');
    assert.strictEqual(failureShowsErrorScreen(false, true), true, 'distance switch / retry');
  });
  test('screen wiring: success clears the error + banner; an auto failure sets the banner, not the error screen', () => {
    const f = 'screens/LiveTrackingScreen.tsx';
    const s = source(f);
    const iSucc = s.indexOf('hasShownData.current = true;');
    assert.ok(iSucc > 0 && s.indexOf('clearError();', iSucc) > iSucc && s.indexOf('setRefreshFailed(false);', iSucc) > iSucc);
    const iFail = s.indexOf('if (!failureShowsErrorScreen(autoRefresh, hasShownData.current)) {');
    assert.ok(iFail > 0 && iFail < s.indexOf('handleApiError(err);', iFail), 'checked before the error screen');
    has(f, "t('livetracking:refreshFailed')");
  });
  test('auto refresh waits while the previous one is out, while not focused, and during a 429 pause', () => {
    const { shouldRunAutoRefresh } = need('utils/liveMapRequests');
    const now = 1000;
    assert.strictEqual(shouldRunAutoRefresh({ focused: true, autoInFlight: 0, pausedUntil: 0, now }), true);
    assert.strictEqual(shouldRunAutoRefresh({ focused: true, autoInFlight: 1, pausedUntil: 0, now }), false);
    assert.strictEqual(shouldRunAutoRefresh({ focused: false, autoInFlight: 0, pausedUntil: 0, now }), false);
    assert.strictEqual(shouldRunAutoRefresh({ focused: true, autoInFlight: 0, pausedUntil: 5000, now }), false);
    has('screens/LiveTrackingScreen.tsx', 'if (!shouldRunAutoRefresh({ focused: true, autoInFlight: autoInFlight.current');
  });
  test('429 pause = Retry-After seconds (default 60 s, capped 10 min)', () => {
    const { rateLimitPauseMs } = need('utils/liveMapRequests');
    assert.strictEqual(rateLimitPauseMs({ data: { retryAfter: 30 } }), 30000);
    assert.strictEqual(rateLimitPauseMs({}), 60000);
    assert.strictEqual(rateLimitPauseMs({ data: { retryAfter: 99999 } }), 600000);
  });
  test('10 s cadence only for a runner really on the last km — not offline / finished / silent 10 min', () => {
    const { liveRefreshMs } = need('utils/liveMapRequests');
    assert.strictEqual(liveRefreshMs([{ distance_to_finish_km: 0.5 }], 20, false), 10000);
    assert.strictEqual(liveRefreshMs([{ distance_to_finish_km: 0.5, connection_status: 'offline' }], 20, false), 60000);
    assert.strictEqual(liveRefreshMs([{ distance_to_finish_km: 0.5, connection_status: 'finished' }], 20, false), 60000);
    assert.strictEqual(liveRefreshMs([{ distance_to_finish_km: 0.5, seconds_since_update: 900 }], 20, false), 60000);
    assert.strictEqual(liveRefreshMs([{ distance_to_finish_km: 0.5, seconds_since_update: 120 }], 20, false), 10000);
    assert.strictEqual(liveRefreshMs([{ distance_to_finish_km: null, distance_covered_km: 19.5 }], 20, false), 10000, 'fallback total − covered');
    assert.strictEqual(liveRefreshMs([{ distance_to_finish_km: null, distance_covered_km: 19.5 }], 20, true), 60000, 'training: no remaining');
    has('screens/LiveTrackingScreen.tsx', 'liveRefreshMs(participants, routeData?.totalDistance ?? 0, trainingFree)');
  });

  const okJson = (body, status = 200, hdr = {}) => ({ ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body), headers: { get: (k) => hdr[k.toLowerCase()] ?? null } });
  test('live tracking request that never answers is abandoned after 20 s as a NETWORK error (Android fetch has no timeout)', async () => {
    global.fetch = () => new Promise(() => {});
    const { liveTrackingService } = load('services/liveTrackingService');
    const { AppError } = load('services/api');
    let err = null, settled = false;
    liveTrackingService.getLiveTrackingData(24, [], 85, true, 'partner', []).then(() => { settled = true; }, (e) => { settled = true; err = e; });
    await advance(25000);
    assert.ok(settled, 'still pending after 25 s');
    assert.ok(err instanceof AppError && err.type === 'network', `got ${err && err.constructor.name} ${err && err.type}`);
  });
  test('live tracking 429 → AppError server + rateLimited + Retry-After', async () => {
    global.fetch = async () => okJson({ success: false, error: 'Rate limit exceeded. Try again in 30s.' }, 429, { 'retry-after': '30' });
    const { liveTrackingService } = load('services/liveTrackingService');
    const { AppError, isRateLimited } = load('services/api');
    const err = await liveTrackingService.getLiveTrackingData(24, [], 85).catch((e) => e);
    assert.ok(err instanceof AppError, 'plain Error');
    assert.strictEqual(err.type, 'server');
    assert.ok(isRateLimited(err));
    assert.strictEqual(err.data.retryAfter, 30);
  });
  test('live tracking 401 → session_expired; success without participants → []', async () => {
    global.fetch = async () => okJson({ success: false, error: 'unauthorized' }, 401);
    let { liveTrackingService } = load('services/liveTrackingService');
    const err = await liveTrackingService.getLiveTrackingData(24, [], 85).catch((e) => e);
    assert.strictEqual(err.code, 'session_expired');
    global.fetch = async () => okJson({ success: true, data: { participants: null, distances: [] } });
    const ok = await liveTrackingService.getLiveTrackingData(24, [], 85);
    assert.deepStrictEqual(ok.data.participants, []);
  });
  test('GPX download that never answers is abandoned after 90 s (re-audit: was 30 s)', async () => {
    global.fetch = () => new Promise(() => {});
    const { gpxService } = load('services/gpxService');
    let settled = false;
    gpxService.fetchAndParseGPX('http://x/a.gpx').then(() => { settled = true; }, () => { settled = true; });
    await advance(95000);
    assert.ok(settled, 'GPX fetch still pending after 35 s');
  });
  results.push(await run('2/6/15. live map refresh'));

  // ════════ 3. 429 is not "no data" ════════
  test('apiClient: HTTP 429 → type server (Retry shown), rateLimited, Retry-After; server text kept as code', async () => {
    M.axiosPost = () => Promise.reject({ isAxiosError: true, response: { status: 429, data: { success: false, error: 'Rate limit exceeded. Try again in 42s.' }, headers: { 'retry-after': '42' } } });
    const { apiClient, AppError, isRateLimited } = load('services/api');
    const err = await apiClient.post('/x', {}).catch((e) => e);
    assert.ok(err instanceof AppError);
    assert.strictEqual(err.type, 'server', 'was "empty" → "No data found" with no Retry');
    assert.ok(isRateLimited(err));
    assert.strictEqual(err.data.retryAfter, 42);
    assert.ok(/rate limit/.test(err.code), 'locationService log still recognises it');
  });
  test('apiClient: other 4xx / 404 / 401 unchanged', async () => {
    const { apiClient } = load('services/api');
    M.axiosPost = () => Promise.reject({ isAxiosError: true, response: { status: 400, data: { error: 'distance_not_found' } } });
    assert.strictEqual((await apiClient.post('/x').catch((e) => e)).type, 'empty');
    M.axiosPost = () => Promise.reject({ isAxiosError: true, response: { status: 401, data: {} } });
    assert.strictEqual((await apiClient.post('/x').catch((e) => e)).code, 'session_expired');
    M.axiosPost = () => Promise.reject({ isAxiosError: true, code: 'ECONNABORTED' });
    assert.strictEqual((await apiClient.post('/x').catch((e) => e)).type, 'network');
  });
  test('result detail / participants / event detail send X-Device-Id (per-phone server limit)', async () => {
    let seen = null;
    M.axiosPost = (url, body, cfg) => { seen = cfg; return Promise.resolve({ data: { success: true, data: { race_info: {} } } }); };
    const { resultDetail } = load('services/resultDetailsService');
    await resultDetail.getResultDetail({ product_app_id: 24, product_option_value_app_id: 85, bib: '7' });
    assert.strictEqual(seen && seen.headers && seen.headers['X-Device-Id'], 'dev-1');
    has('services/participantService.ts', "'X-Device-Id': await getDeviceId()");
    has('services/eventDetailService.ts', "'X-Device-Id': await getDeviceId()");
  });
  results.push(await run('3. rate limit'));

  // ════════ 4/13/14. Results list requests ════════
  function rankingMock() {
    const calls = [];
    mockModule('services/resultList', { resultList: { getEventRanking: (p) => { const d = deferred(); calls.push({ p, d }); return d.p; } } });
    return calls;
  }
  const rows = (bibs) => bibs.map((b) => ({ bib: String(b), position: String(b), name: 'R' + b, checkpoints: [] }));
  const page = (pov, bibs, pg = 1, total = 3) => ({
    distances: [{ product_option_value_app_id: 85, distance_name: '10K', is_selected: pov === 85 ? 1 : 0 }, { product_option_value_app_id: 86, distance_name: '25K', is_selected: pov === 86 ? 1 : 0 }],
    categories: [{ key: 'scratch', label: 'Scratch' }],
    results: rows(bibs), pagination: { page: pg, per_page: 3, total: total * 3, total_pages: total },
    statistics: { crossed: 0, expected: 0, started: 0, dnf: 0 }, event: { race_status: 'in_progress' },
  });
  const mountList = () => {
    const { useResultList } = load('hooks/useResultList');
    return renderHook(() => useResultList(24, 85));
  };
  test('distance picked while page 2 loads → the new distance is fetched and shown; the late page 2 is dropped', async () => {
    const calls = rankingMock();
    const h = mountList();
    calls[0].d.resolve(page(85, [1, 2, 3])); await flush();
    h.result.onEndReached(); await flush();
    assert.strictEqual(calls.length, 2, 'page 2 requested');
    h.result.onDistanceSelect({ label: '25K', value: '86' }); await flush();
    assert.strictEqual(calls.length, 3, 'the new distance was never requested (request lock)');
    assert.strictEqual(calls[2].p.product_option_value_app_id, 86);
    calls[2].d.resolve(page(86, [100, 101, 102])); await flush();
    calls[1].d.resolve(page(85, [4, 5, 6], 2)); await flush();
    assert.deepStrictEqual(h.result.results.map((r) => r.bib), ['100', '101', '102']);
    assert.strictEqual(h.result.selectedPovId, 86);
    assert.strictEqual(h.result.pageLoad, false);
    assert.strictEqual(h.result.filterLoad, false);
  });
  test('type changed during the first load → refetched with the new type', async () => {
    const calls = rankingMock();
    const h = mountList();
    h.result.onTypeSelect({ label: 'live', value: '1' }); await flush();
    assert.strictEqual(calls.length, 2);
    assert.strictEqual(calls[1].p.from_live, 1);
    calls[1].d.resolve(page(85, [7, 8])); await flush();
    calls[0].d.resolve(page(85, [1, 2, 3])); await flush();
    assert.deepStrictEqual(h.result.results.map((r) => r.bib), ['7', '8'], 'the older first-load answer must not win');
    assert.strictEqual(h.result.initialLoad, false);
  });
  test('a failing NEXT page keeps the rows (footer retry), no full-screen error', async () => {
    const calls = rankingMock();
    const h = mountList();
    calls[0].d.resolve(page(85, [1, 2, 3])); await flush();
    h.result.onEndReached(); await flush();
    calls[1].d.reject(Object.assign(new Error('Network'), { type: 'network' })); await flush();
    assert.strictEqual(h.result.hasError, false, 'whole list replaced by the error screen');
    assert.strictEqual(h.result.results.length, 3);
    assert.strictEqual(h.result.pageError, true);
    h.result.onEndReached(); await flush();
    assert.strictEqual(calls.length, 3, 'retry asks the same page again');
    assert.strictEqual(calls[2].p.page, 2);
    has('screens/ResultList/ResultList.tsx', "t('allrace:race.loadMoreFailed')");
  });
  test('a runner pushed over the page boundary is not listed twice', async () => {
    const calls = rankingMock();
    const h = mountList();
    calls[0].d.resolve(page(85, [1, 2, 3])); await flush();
    h.result.onEndReached(); await flush();
    calls[1].d.resolve(page(85, [3, 4, 5], 2)); await flush();
    assert.deepStrictEqual(h.result.results.map((r) => r.bib), ['1', '2', '3', '4', '5']);
  });
  test('two onEndReached in one frame load the next page once (regression guard)', async () => {
    const calls = rankingMock();
    const h = mountList();
    calls[0].d.resolve(page(85, [1, 2, 3])); await flush();
    h.result.onEndReached(); h.result.onEndReached(); await flush();
    assert.strictEqual(calls.length, 2);
  });
  results.push(await run('4/13/14. results list'));

  // ════════ 5/20. GPX parsing ════════
  test('a GPX with 1-4 track points and no waypoints parses (was an endless loop → frozen app)', () => {
    const script = `
      process.env.APP_SRC = ${JSON.stringify(H.SRC)};
      const H = require(${JSON.stringify(path.join(__dirname, 'harness.js'))});
      const { parseGPX } = H.load('utils/gpx');
      const gpx = '<gpx><trk><trkseg><trkpt lat="50.1" lon="4.1"><ele>1</ele></trkpt><trkpt lat="50.2" lon="4.2"><ele>2</ele></trkpt><trkpt lat="50.3" lon="4.3"><ele>3</ele></trkpt></trkseg></trk></gpx>';
      parseGPX(gpx).then((r) => { console.log(JSON.stringify({ n: r.trackPoints.length, s: r.stations.length })); process.exit(0); });`;
    const r = spawnSync(process.execPath, ['-e', script], { timeout: 8000, encoding: 'utf8' });
    assert.ok(!r.error && r.status === 0, `parse did not finish in 8 s (${r.error ? r.error.code : 'exit ' + r.status})`);
    const out = JSON.parse(r.stdout.trim().split('\n').pop());
    assert.strictEqual(out.n, 3);
    assert.ok(out.s >= 1 && out.s <= 3, `stations ${out.s}`);
  }, 15000);
  const gpxText = (n, segs = 1) => {
    const per = Math.ceil(n / segs); let s = '<gpx><trk>';
    for (let g = 0; g < segs; g++) {
      s += '<trkseg>';
      for (let i = g * per; i < Math.min(n, (g + 1) * per); i++) s += `<trkpt lat="${(50 + i * 1e-5).toFixed(6)}" lon="${(4 + i * 1e-5).toFixed(6)}"><ele>${100 + (i % 50)}</ele></trkpt>`;
      s += '</trkseg>';
    }
    return s + '</trk></gpx>';
  };
  test('a 160k-point GPX parses (Math.min(...elevations) threw RangeError) and the map bounds work', async () => {
    const big = gpxText(160000);
    global.fetch = async () => ({ ok: true, status: 200, text: async () => big, headers: { get: () => null } });
    const { gpxService, minMax } = load('services/gpxService');
    const r = await gpxService.fetchAndParseGPX('http://x/big.gpx');
    assert.strictEqual(r.trackPoints.length, 160000);
    assert.strictEqual(r.minElevation, 100);
    assert.strictEqual(r.maxElevation, 149);
    assert.ok(minMax, 'minMax helper');
    has('components/LiveMap/LiveRouteMap.tsx', 'const lon = minMax(trackPoints.map(pt => pt.lon));');
  }, 60000);
  results.push(await run('5/20. GPX'));

  // ════════ 7. Search participant ════════
  function participantsMock() {
    const calls = [];
    mockModule('services/participantService', { participantService: {
      getParticipants: (p) => { const d = deferred(); calls.push({ p, d }); return d.p; },
      getParticipantId: (x) => x.bib_number,
    } });
    return calls;
  }
  const plist = (names, total = 1) => ({ participants: names.map((n) => ({ bib_number: n, firstname: n })), pagination: { page: 1, total: names.length, total_pages: total } });
  const mountSearch = () => {
    const { useParticipantSearch } = need('screens/ResultList/useParticipantSearch');
    return renderHook(() => useParticipantSearch({ productId: 24, onError() {}, clearError() {} }));
  };
  test('"jan" answering after "janssens" does not replace the janssens list', async () => {
    const calls = participantsMock();
    const h = mountSearch();
    calls[0].d.resolve(plist(['a', 'b'])); await flush();
    h.result.setSearchText('jan'); await flush(); await advance(500);
    h.result.setSearchText('janssens'); await flush(); await advance(500);
    assert.strictEqual(calls.length, 3);
    calls[2].d.resolve(plist(['janssens1'])); await flush();
    calls[1].d.resolve(plist(['jan1', 'jan2', 'jan3'])); await flush();
    assert.deepStrictEqual(h.result.participants.map((p) => p.bib_number), ['janssens1']);
    assert.strictEqual(h.result.loading, false);
  });
  test('a page 2 of the old query is not appended to the new query', async () => {
    const calls = participantsMock();
    const h = mountSearch();
    calls[0].d.resolve(plist(['a', 'b'], 3)); await flush();
    h.result.loadMore(); await flush();
    h.result.setSearchText('z'); await flush(); await advance(500);
    calls[2].d.resolve(plist(['z1'])); await flush();
    calls[1].d.resolve(plist(['c', 'd'], 3)); await flush();
    assert.deepStrictEqual(h.result.participants.map((p) => p.bib_number), ['z1']);
  });
  test('two loadMore calls in one frame request the next page once', async () => {
    const calls = participantsMock();
    const h = mountSearch();
    calls[0].d.resolve(plist(['a'], 3)); await flush();
    h.result.loadMore(); h.result.loadMore(); await flush();
    assert.strictEqual(calls.length, 2);
  });
  test('the screen no longer refetches on focus (it reset the list to unfiltered and swallowed a keystroke)', () => {
    has('screens/ResultList/SearchParticipant.tsx', 'useParticipantSearch({');
    hasNot('screens/ResultList/SearchParticipant.tsx', 'useFocusEffect(');
    hasNot('screens/ResultList/SearchParticipant.tsx', 'isInitialLoad');
  });
  results.push(await run('7. search participant'));

  // ════════ 8. Other searches ════════
  test('suggestions: an older query answering last does not replace the newer suggestions', async () => {
    const calls = [];
    mockModule('services/followerScreenService', { suggestionService: { getSuggestions: (q) => { const d = deferred(); calls.push({ q, d }); return d.p; } } });
    const useSearchSuggestions = load('hooks/useSearchSuggestions').default;
    const h = renderHook(() => useSearchSuggestions('filter_name'));
    h.result.handleSearch('ab'); await flush(); await advance(400);
    h.result.handleSearch('abc'); await flush(); await advance(400);
    assert.strictEqual(calls.length, 2);
    calls[1].d.resolve([{ name: 'abc-race' }]); await flush();
    calls[0].d.resolve([{ name: 'ab-1' }, { name: 'ab-2' }]); await flush();
    assert.deepStrictEqual(h.result.suggestions.map((s) => s.name), ['abc-race']);
    assert.strictEqual(h.result.loading, false);
  });
  test('suggestions: clear cancels a pending debounced search', async () => {
    const calls = [];
    mockModule('services/followerScreenService', { suggestionService: { getSuggestions: (q) => { calls.push(q); return Promise.resolve([{ name: 'x' }]); } } });
    const useSearchSuggestions = load('hooks/useSearchSuggestions').default;
    const h = renderHook(() => useSearchSuggestions('filter_name'));
    h.result.handleSearch('ab'); await flush();
    h.result.clearSuggestions(); await flush(); await advance(400);
    assert.strictEqual(calls.length, 0);
    assert.deepStrictEqual(h.result.suggestions, []);
  });
  test('event lists: participant / past searches drop stale answers; load-more uses a generation + ref guard', () => {
    has('screens/FollowerEventList/FollowerEvent.tsx', 'if (searchId !== participantSearchId.current) return;');
    has('screens/FollowerEventList/FollowerEvent.tsx', 'if (gen !== listGeneration.current) return;');
    has('screens/FollowerEventList/FollowerEvent.tsx', 'loadingMoreTab.current.past = true;');
    has('screens/FollowerEventList/PastTab.tsx', 'if (id !== searchId.current) return;   // a newer search owns the list');
    has('screens/FollowerEventList/PastTab.tsx', 'const currentPage = searchPaginationRef.current.page;');
    hasNot('screens/FollowerEventList/PastTab.tsx', 'setSearchPagination(prev => {');
  });
  results.push(await run('8/21/22. searches + event lists'));

  // ════════ 9/17. Countdowns ════════
  test('Home following-events countdown: a refetch after 10 min shows 20:00 for a race 20 min away (was 10:00)', async () => {
    mockModule('styles/common.styles', { commonStyles: new Proxy({}, { get: () => ({}) }), spacing: new Proxy({}, { get: () => 8 }), palette: new Proxy({}, { get: () => '#000' }), space: new Proxy({}, { get: () => 8 }) });
    mockModule('styles/home.styles', { homeStyles: new Proxy({}, { get: () => ({}) }) });
    mockModule('utils/timeFormat', { formatClockTime: (x) => x });
    const Section = load('screens/FollowingLiveEventsSection').default;
    const ev = (startsIn) => [{ product_app_id: 24, product_option_value_app_id: 85, event_name: 'Soupe', race_time: '09:00', race_status: 'upcoming', starts_in_seconds: startsIn, followed_participants: [] }];
    const h = renderHook((p) => Section(p), { events: ev(1800), onRoutePress() {} });
    await flush();
    assert.ok(textOf(h.result).includes('30:00'), textOf(h.result));
    await advance(600000);
    assert.ok(textOf(h.result).includes('20:00'), 'ticking: ' + textOf(h.result));
    h.rerender({ events: ev(1200), onRoutePress() {} }); await flush();
    assert.ok(textOf(h.result).includes('20:00'), 'after refetch: ' + textOf(h.result));
    assert.ok(!textOf(h.result).includes('followingEvents.live'), 'shown as Live early');
  }, 30000);
  test('distance countdown badge follows the wall clock after the app slept in the background', async () => {
    const { useCountdown } = load('hooks/useCountdown');
    const h = renderHook(() => useCountdown(0, 1, 0, 'not_started'));
    await flush();
    assert.strictEqual(h.result.totalSeconds, 3600);
    sleepInBackground(30 * 60 * 1000);
    await advance(1000);
    assert.ok(Math.abs(h.result.totalSeconds - 1799) <= 1, `after 30 min away: ${h.result.totalSeconds}`);
  });
  test('distance countdown badge takes new props from a refetch', async () => {
    const { useCountdown } = load('hooks/useCountdown');
    const h = renderHook((p) => useCountdown(0, 0, p.m, 'not_started'), { m: 30 });
    await flush();
    h.rerender({ m: 10 }); await flush();
    assert.strictEqual(h.result.totalSeconds, 600);
  });
  results.push(await run('9/17. countdowns'));

  // ════════ 10/12/23. Result details ════════
  function detailMock() {
    const calls = [];
    mockModule('services/resultDetailsService', { resultDetail: { getResultDetail: (p) => { const d = deferred(); calls.push({ p, d }); return d.p; } } });
    return calls;
  }
  const liveDetail = (bib) => ({ event: { race_status: 'in_progress' }, race_info: { bib, name: 'R' + bib, participant_status: 'in_progress', server_time: '01:00:00' } });
  test('detail polls once a minute only while focused; refreshes on return when stale', async () => {
    const calls = detailMock();
    const { useResultDetail } = load('hooks/useResultDetail');
    const h = renderHook(() => useResultDetail(24, 85, '7', 1));
    calls[0].d.resolve(liveDetail('7')); await flush();
    await advance(60000);
    assert.strictEqual(calls.length, 2, 'polls while focused');
    calls[1].d.resolve(liveDetail('7')); await flush();
    M.focused = false; h.rerender(); await flush();
    await advance(180000);
    assert.strictEqual(calls.length, 2, 'kept polling under the live map');
    M.focused = true; h.rerender(); await flush();
    assert.strictEqual(calls.length, 3, 'refresh on return');
  });
  test('failed polls mark the data stale (live clock stops), a good answer clears it', async () => {
    const calls = detailMock();
    const { useResultDetail } = load('hooks/useResultDetail');
    const h = renderHook(() => useResultDetail(24, 85, '7', 1));
    calls[0].d.resolve(liveDetail('7')); await flush();
    assert.strictEqual(h.result.stale, false);
    await advance(60000);
    calls[1].d.reject(new Error('net')); await flush();
    assert.strictEqual(h.result.stale, true);
    assert.strictEqual(h.result.hasError, false);
    await advance(60000);
    calls[2].d.resolve(liveDetail('7')); await flush();
    assert.strictEqual(h.result.stale, false);
    has('screens/ResultDetailsScreen/RaceLive.tsx', "if (event?.race_status === 'in_progress' && !stale) {");
    has('screens/ResultDetailsScreen/ResultDetails.tsx', 'stale={stale} lastUpdatedAt={lastUpdatedAt}');
  });
  test('a 429 on a poll pauses polling for Retry-After', async () => {
    const calls = detailMock();
    const { useResultDetail } = load('hooks/useResultDetail');
    renderHook(() => useResultDetail(24, 85, '7', 1));
    calls[0].d.resolve(liveDetail('7')); await flush();
    await advance(60000);
    calls[1].d.reject({ type: 'server', code: 'rate limit exceeded.', data: { rateLimited: true, retryAfter: 150 } }); await flush();
    await advance(60000);
    assert.strictEqual(calls.length, 2, 'polled inside the 150 s pause');
    await advance(120000);
    assert.strictEqual(calls.length, 3);
  });
  test('the first runner answering after the second (params changed) is not shown', async () => {
    const calls = detailMock();
    const { useResultDetail } = load('hooks/useResultDetail');
    const h = renderHook((p) => useResultDetail(24, 85, p.bib, 1), { bib: '7' });
    h.rerender({ bib: '8' }); await flush();
    assert.strictEqual(calls.length, 2);
    calls[1].d.resolve(liveDetail('8')); await flush();
    calls[0].d.resolve(liveDetail('7')); await flush();
    assert.strictEqual(h.result.data.race_info.bib, '8');
  });
  test('resultDetailsService keeps the AppError type (was re-wrapped as a plain Error → always "server")', async () => {
    const api = load('services/api');
    M.axiosPost = () => Promise.reject({ isAxiosError: true, response: { status: 400, data: { error: 'participant_not_found' } } });
    const { resultDetail } = load('services/resultDetailsService');
    const err = await resultDetail.getResultDetail({ product_app_id: 24, product_option_value_app_id: 85, bib: '7' }).catch((e) => e);
    assert.ok(err instanceof api.AppError, 'plain Error');
    assert.strictEqual(err.type, 'empty');
    assert.strictEqual(err.code, 'participant_not_found');
  });
  results.push(await run('10/12/23. result details'));

  // ════════ 11/18/19. Elevation profile + RaceLive chart ════════
  const styleStub = () => new Proxy({}, { get: (t, k) => (k === '__esModule' ? false : k === 'withAlpha' ? (c) => c : new Proxy({}, { get: () => 1 })) });
  const mockProfileStyles = () => {
    mockModule('styles/common.styles', styleStub());
    mockModule('styles/liveTracking.styles', { liveTrackingStyles: styleStub(), ELEVATION_CHART_HEIGHT: 180, ELEVATION_PANEL_HEIGHT: 224 });
  };
  test('nearest-3 route points: same pick as the old full sort, without it', () => {
    mockProfileStyles();
    const mod = need('components/ElevationProfile/LiveElevationProfile');
    const { nearestChartPoints, downsampleChart } = mod;
    let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const chart = Array.from({ length: 3000 }, (_, i) => ({ x: i / 100, y: 0, lat: 50 + Math.round(rnd() * 200) / 1e4, lon: 4 + Math.round(rnd() * 200) / 1e4 }));
    for (let k = 0; k < 50; k++) {
      const lat = 50 + rnd() / 50, lon = 4 + rnd() / 50;
      const ref = [...chart].map((pt) => ({ pt, diff: Math.pow(pt.lat - lat, 2) + Math.pow(pt.lon - lon, 2) })).sort((a, b) => a.diff - b.diff).slice(0, 3);
      const got = nearestChartPoints(chart, lat, lon, 3);
      assert.deepStrictEqual(got.map((g) => g.pt.x), ref.map((r) => r.pt.x));
    }
    const d = downsampleChart(Array.from({ length: 40000 }, (_, i) => ({ x: i, y: i, lat: 0, lon: 0 })));
    assert.strictEqual(d.length, 1500);
    assert.strictEqual(d[0].x, 0); assert.strictEqual(d[d.length - 1].x, 39999);
  });
  test('40k-point route, 10 runners: participant placement is fast (was a full copy + sort per runner per poll)', () => {
    mockProfileStyles();
    const { nearestChartPoints } = need('components/ElevationProfile/LiveElevationProfile');
    const chart = Array.from({ length: 40000 }, (_, i) => ({ x: i / 400, y: 0, lat: 50 + i * 1e-5, lon: 4 + i * 1e-5 }));
    const t0 = process.hrtime.bigint();
    for (let r = 0; r < 10; r++) nearestChartPoints(chart, 50 + r * 0.01, 4 + r * 0.01, 3);
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    assert.ok(ms < 250, `${ms.toFixed(0)} ms`);
  });
  test('profile: area drawn downsampled, no snap-back after the user scrolls; map handlers are stable', () => {
    has('components/ElevationProfile/LiveElevationProfile.tsx', 'data={drawnChartData}');
    has('components/ElevationProfile/LiveElevationProfile.tsx', 'onScrollBeginDrag={() => { userScrolledRef.current = true; }}');
    has('components/ElevationProfile/LiveElevationProfile.tsx', 'if (userScrolledRef.current) return;');
    has('screens/LiveTrackingScreen.tsx', 'const handleParticipantPress = useCallback(');
    has('screens/LiveTrackingScreen.tsx', 'const handleAidStationPress = useCallback(');
    has('screens/LiveTrackingScreen.tsx', 'participants={showParticipants ? participantMarkers : NO_MARKERS}');
  });
  test('RaceLive elevation: a multi-segment GPX gives all points; the second screen revalidates instead of re-downloading', async () => {
    const xml = gpxText(300, 3);
    const seen = [];
    global.fetch = async (url, init) => {
      const inm = init && init.headers && init.headers['If-None-Match'];
      seen.push(inm || null);
      if (inm === '"v1"') return { ok: false, status: 304, text: async () => '', headers: { get: () => null } };
      return { ok: true, status: 200, text: async () => xml, headers: { get: (k) => (k.toLowerCase() === 'etag' ? '"v1"' : null) } };
    };
    const { useGpxElevation } = load('hooks/useGpxElevation');
    const a = renderHook(() => useGpxElevation('http://x/route.gpx'));
    await flush(10);
    assert.strictEqual(a.result.points.length, 300, `points ${a.result.points.length}`);
    const b = renderHook(() => useGpxElevation('http://x/route.gpx'));
    await flush(10);
    assert.strictEqual(b.result.points.length, 300);
    assert.deepStrictEqual(seen, [null, '"v1"'], 'second mount downloaded the whole file again');
  });
  results.push(await run('11/18/19. elevation'));

  // ════════ 24. Follow-up: participant event lists + live map device id ════════
  const { findEl } = H;
  function participantPastTab() {
    const calls = [];
    mockModule('services/eventService', { eventService: { getEvents: (p) => { const d = deferred(); calls.push({ p, d }); return d.p; } } });
    for (const m of ['styles/common.styles', 'styles/event', 'components/EventListCard', 'utils/dateFormatter', 'components/SearchInput', 'components/ErrorScreen', 'constants/analyticsScreens']) {
      mockModule(m, new Proxy({ __esModule: true }, { get: (t, k) => (k === '__esModule' ? true : k === 'default' ? function Stub() { return null; } : new Proxy({}, { get: () => 1 })) }));
    }
    const PastTab = load('screens/ParticipantEvent/PastTab').default;
    const h = renderHook((p) => PastTab(p), { events: [], onLoadMore() {}, loadingMore: false, hasMore: false });
    const type = (txt) => findEl(h.result, (p) => typeof p.onChangeText === 'function').props.onChangeText(txt);
    const list = () => findEl(h.result, (p) => typeof p.onEndReached === 'function');
    return { calls, h, type, list };
  }
  const evs = (ids, total = 1) => ({ tabs: { past: ids.map((i) => ({ product_app_id: String(i), name: 'E' + i })), live: [], upcoming: [] }, pagination: { past: { page: 1, total_pages: total }, live: {}, upcoming: {} } });
  test('participant Past tab: an older search answering last does not replace the newer results', async () => {
    const { calls, h, type, list } = participantPastTab();
    type('ab'); await flush(); await advance(500);
    type('abc'); await flush(); await advance(500);
    assert.strictEqual(calls.length, 2);
    calls[1].d.resolve(evs(['abc'])); await flush();
    calls[0].d.resolve(evs(['ab1', 'ab2'])); await flush();
    assert.deepStrictEqual(list().props.data.map((e) => e.product_app_id), ['abc']);
  });
  test('participant Past tab: page 2 of the old search is not appended to a new search', async () => {
    const { calls, type, list } = participantPastTab();
    type('ab'); await flush(); await advance(500);
    calls[0].d.resolve(evs(['a1', 'a2'], 3)); await flush();
    list().props.onEndReached(); await flush();
    assert.strictEqual(calls.length, 2, 'page 2 asked');
    assert.strictEqual(calls[1].p.page_past, 2);
    type('zz'); await flush(); await advance(500);
    calls[2].d.resolve(evs(['z1'])); await flush();
    calls[1].d.resolve(evs(['a3', 'a4'], 3)); await flush();
    assert.deepStrictEqual(list().props.data.map((e) => e.product_app_id), ['z1']);
  });
  test('participant event lists: pagination read from a ref; load-more generation + ref guard', () => {
    has('screens/ParticipantEvent/PastTab.tsx', 'const currentPage = searchPaginationRef.current.page;');
    hasNot('screens/ParticipantEvent/PastTab.tsx', 'setSearchPagination(prev => {');
    const f = 'screens/ParticipantEvent/ParticipantEvent.tsx';
    has(f, 'listGeneration.current++;');
    for (const tabName of ['past', 'live', 'upcoming']) {
      has(f, `loadingMoreTab.current.${tabName} = true;`);
      has(f, `loadingMoreTab.current.${tabName} = false;`);
    }
    assert.strictEqual(source(f).split('if (gen !== listGeneration.current) return;').length - 1, 3, 'all three tabs drop a stale page');
  });
  test('live map request carries X-Device-Id as a HEADER (body — the cache key — unchanged)', async () => {
    let init = null;
    global.fetch = async (u, i) => { init = i; return okJson({ success: true, data: { participants: [], distances: [] } }); };
    const { liveTrackingService } = load('services/liveTrackingService');
    await liveTrackingService.getLiveTrackingData(24, [5], 85, true, 'partner', []);
    assert.strictEqual(init.headers['X-Device-Id'], 'dev-1');
    assert.ok(!('device_id' in JSON.parse(init.body)), 'device id must not enter the body');
  });
  test('live map: no device id available → no header, request still sent (today\'s per-IP bucket)', async () => {
    let init = null;
    M.deviceId = '';
    try {
      global.fetch = async (u, i) => { init = i; return okJson({ success: true, data: { participants: [], distances: [] } }); };
      const { liveTrackingService } = load('services/liveTrackingService');
      await liveTrackingService.getLiveTrackingData(24, [5], 85);
      assert.ok(init && !('X-Device-Id' in init.headers));
    } finally { M.deviceId = 'dev-1'; }
  });
  results.push(await run('24. follow-up: participant lists + live map device id'));

  // ════════ 25. Review: the detail spinner is never left up by an overtaken load ════════
  const settleAllNewestFirst = async (calls, from, value) => {
    for (let i = calls.length - 1; i >= from; i--) { calls[i].d.resolve(value(calls[i].p)); await flush(); }
  };
  test('stale live runner → other runner: the re-armed poll does not strand the spinner (trigger A)', async () => {
    const calls = detailMock();
    const { useResultDetail } = load('hooks/useResultDetail');
    const h = renderHook((p) => useResultDetail(24, 85, p.bib, 1), { bib: '7' });
    calls[0].d.resolve(liveDetail('7')); await flush();
    await advance(60000);
    calls[1].d.reject(new Error('net')); await flush();      // poll failed → stale, lastUpdatedAt 60 s old
    h.rerender({ bib: '8' }); await flush();
    const from = 2;
    assert.ok(calls.length >= 3, 'the new runner was requested');
    await settleAllNewestFirst(calls, from, (p) => liveDetail(p.bib));
    assert.strictEqual(h.result.loading, false, 'spinner left up for good');
    assert.strictEqual(h.result.data.race_info.bib, '8');
  });
  test('Retry on the error screen while the 60 s tick lands: the spinner ends (trigger B)', async () => {
    const calls = detailMock();
    const { useResultDetail } = load('hooks/useResultDetail');
    const h = renderHook((p) => useResultDetail(24, 85, p.bib, 1), { bib: '7' });
    calls[0].d.resolve(liveDetail('7')); await flush();
    await advance(30000);
    h.rerender({ bib: '8' }); await flush();
    const iFail = calls.length - 1;
    calls[iFail].d.reject(Object.assign(new Error('net'), { type: 'network' })); await flush();
    assert.strictEqual(h.result.hasError, true);
    h.result.retry(); await flush();
    const from = calls.length - 1;
    await advance(60000);                                     // the poll tick (re-armed at the param change) lands during the retry
    await settleAllNewestFirst(calls, from, (p) => liveDetail(p.bib));
    assert.strictEqual(h.result.loading, false, 'spinner left up for good');
    assert.strictEqual(h.result.hasError, false);
    assert.strictEqual(h.result.data.race_info.bib, '8');
  });
  results.push(await run('25. review: detail spinner'));

  // ════════ 26. Re-audit 2026-11-26: EN1-EN5 ════════
  test('EN1: event list (3 services) and version check send X-Device-Id as a header; body unchanged', async () => {
    const seen = [];
    M.axiosPost = (url, body, cfg) => { seen.push({ url, body, h: (cfg && cfg.headers) || {} }); return Promise.reject({ isAxiosError: true, code: 'ECONNABORTED' }); };
    await load('services/eventService').eventService.getEvents().catch(() => {});
    await load('services/followerEvent').eventService.getEvents().catch(() => {});
    await load('services/followerScreenService').suggestionService.getSuggestions({ filter_name: 'ab' }).catch(() => {});
    const listCalls = seen.filter((c) => /EVENTS_LIST/.test(c.url));
    assert.strictEqual(listCalls.length, 3, `event list calls seen: ${listCalls.length}`);
    for (const c of listCalls) {
      assert.strictEqual(c.h['X-Device-Id'], 'dev-1', `${c.url} without X-Device-Id`);
      assert.ok(!(c.body && 'device_id' in c.body), 'device id must not enter the body (cache key)');
    }
    has('services/versionService.ts', "...(deviceId ? { 'X-Device-Id': deviceId } : {})");
  });

  test('EN2: Map → Results → other distance → Map: the open map gets the new distance (real router)', () => {
    const { tabPlan } = need('utils/tabNavigation');
    assert.ok(typeof tabPlan === 'function', 'tabPlan missing');
    let s = start();
    s = nav(s, 'LiveTracking', { product_app_id: 24, selectedDistanceLabel: '10K' });
    const mapKey = s.routes[1].key;
    s = nav(s, 'ResultList', { product_app_id: 24 });
    const plan = tabPlan(s.routes, s.index, 'LiveTracking', { product_app_id: 24, selectedDistanceLabel: '25K' });
    assert.strictEqual(plan.pops, 1);
    assert.strictEqual(plan.setParamsKey, mapKey);
    s = router.getStateForAction(s, { ...CommonActions.setParams(plan.setParams), source: plan.setParamsKey, target: s.key }, ropts) || s;
    s = router.getStateForAction(s, StackActions.pop(plan.pops), ropts);
    assert.strictEqual(s.routes[s.index].key, mapKey, 'same map');
    assert.strictEqual(s.routes[s.index].params.selectedDistanceLabel, '25K');
    assert.strictEqual(s.routes[s.index].params.product_app_id, 24, 'other params kept (merge)');
    const same = tabPlan([...s.routes, { name: 'ResultList', key: 'x', params: { product_app_id: 24 } }], s.routes.length, 'LiveTracking', { product_app_id: 24, selectedDistanceLabel: '25K' });
    assert.strictEqual(same.setParamsKey, undefined, 'same distance: plain pop');
    has('screens/LiveTrackingScreen.tsx', 'if (lastLabelParam.current === selectedDistanceLabel) return;');
    has('screens/LiveTrackingScreen.tsx', 'void handleDistanceChange(wanted);');
    has('components/common/BottomNavigation.tsx', 'source: plan.setParamsKey');
    has('components/common/BottomNavigationFollower.tsx', 'source: plan.setParamsKey');
  });

  const gpxOk = (xml) => ({ ok: true, status: 200, text: async () => xml, headers: { get: () => null } });
  test('EN3: a GPX already loaded is shown again when the next download fails or times out', async () => {
    const xml = gpxText(50);
    global.fetch = async () => gpxOk(xml);
    const { gpxService } = load('services/gpxService');
    const first = await gpxService.fetchAndParseGPX('http://x/r.gpx');
    global.fetch = () => Promise.reject(new TypeError('Network request failed'));
    const again = await gpxService.fetchAndParseGPX('http://x/r.gpx').catch((e) => e);
    assert.strictEqual(again, first, 'network error with a cached copy failed');
    global.fetch = () => new Promise(() => {});
    let got = null;
    gpxService.fetchAndParseGPX('http://x/r.gpx').then((v) => { got = v; }, (e) => { got = e; });
    await advance(95000);
    assert.strictEqual(got, first, 'timeout with a cached copy failed');
  });
  test('EN3: a slow GPX gets 90 s (still loading at 60 s), API calls keep 20 s', async () => {
    global.fetch = () => new Promise(() => {});
    const { gpxService, GPX_FETCH_TIMEOUT_MS } = load('services/gpxService');
    let settled = false;
    gpxService.fetchAndParseGPX('http://x/slow.gpx').then(() => { settled = true; }, () => { settled = true; });
    await advance(60000);
    assert.strictEqual(settled, false, 'gave up before 90 s');
    assert.strictEqual(GPX_FETCH_TIMEOUT_MS, 90000);
    assert.strictEqual(load('services/liveTrackingService').LIVE_TRACKING_TIMEOUT_MS, 20000);
  });
  test('EN3: a body that never finishes downloading is bounded by the same 90 s deadline', async () => {
    global.fetch = async () => ({ ok: true, status: 200, text: () => new Promise(() => {}), headers: { get: () => null } });
    const { gpxService } = load('services/gpxService');
    let err = null;
    gpxService.fetchAndParseGPX('http://x/body.gpx').catch((e) => { err = e; });
    await advance(95000);
    assert.ok(err, 'body download hung past 95 s');
  });

  test('EN4: no load-more while the page-1 refetch is running (both event-list screens)', () => {
    for (const f of ['screens/FollowerEventList/FollowerEvent.tsx', 'screens/ParticipantEvent/ParticipantEvent.tsx']) {
      has(f, 'listRefetching.current = true;');
      has(f, 'listRefetching.current = false;');
      assert.strictEqual(source(f).split('|| listRefetching.current ||').length - 1, 3, `${f}: all three tabs wait`);
      const s = source(f);
      assert.ok(s.indexOf('listRefetching.current = true;') < s.indexOf('page_past: 1,'), 'set before the request');
    }
  });

  test('EN5: a runner who moved up across the page boundary is fetched again and shown in place', async () => {
    const calls = rankingMock();
    const h = mountList();
    const pos = (list) => ({ ...page(85, []), results: list.map(([bib, p]) => ({ bib, position: String(p), name: bib, checkpoints: [] })), event: { race_status: 'in_progress' } });
    calls[0].d.resolve(pos([['a', 1], ['b', 2], ['c', 3]])); await flush();
    h.result.onEndReached(); await flush();
    calls[1].d.resolve(pos([['e', 5], ['f', 6], ['g', 7]])); await flush();   // X moved 4 → 2: on neither page
    assert.strictEqual(calls.length, 3, 'boundary page not fetched again');
    assert.strictEqual(calls[2].p.page, 1);
    calls[2].d.resolve(pos([['a', 1], ['X', 2], ['b', 3]])); await flush();
    assert.deepStrictEqual(h.result.results.map((r) => r.bib), ['a', 'X', 'b', 'c', 'e', 'f', 'g']);
    assert.strictEqual(h.result.pageLoad, false);
  });
  test('EN5: no extra request when the pages join up', async () => {
    const calls = rankingMock();
    const { pageBoundaryGap } = need('hooks/useResultList');
    assert.ok(typeof pageBoundaryGap === 'function', 'pageBoundaryGap missing');
    const r = (p) => ({ bib: 'b' + p, position: String(p) });
    assert.strictEqual(pageBoundaryGap([r(1), r(2), r(3)], [r(4), r(5)]), false);
    assert.strictEqual(pageBoundaryGap([r(1), r(2), r(3)], [r(5), r(6)]), true);
    assert.strictEqual(pageBoundaryGap([r(1), { bib: 'x', position: 'DNF' }], [r(5)]), false);
    const h = mountList();
    calls[0].d.resolve(page(85, [1, 2, 3])); await flush();
    h.result.onEndReached(); await flush();
    calls[1].d.resolve(page(85, [4, 5, 6], 2)); await flush();
    assert.strictEqual(calls.length, 2);
  });
  results.push(await run('26. re-audit EN1-EN5'));

  const pass = results.reduce((n, r) => n + r.pass, 0);
  const fail = results.reduce((n, r) => n + r.fail, 0);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
