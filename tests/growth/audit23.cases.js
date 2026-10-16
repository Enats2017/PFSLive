// Cases added in the TWENTY-THIRD round (2026-10-16). Registered by app.test.js.
// Each one fails on the code before this round (checked with APP_SRC pointing
// at a `git archive HEAD` copy) and passes after.
//
// Cross-repo contract (server side lands in parallel): downloads carry
// follow_seq; update_follower_favourites takes base_seq and answers 409
// follow_conflict {follow_seq, followed_customers, followed_bibs} when the row
// moved on since. The harness fake implements it for rows in M.api.rows.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Module = require('module');

module.exports = function register({ M, load, test, SRC }) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const read = (p) => fs.readFileSync(path.resolve(SRC, p), 'utf8').replace(/\r\n/g, '\n');
  const SYNC = '/update_follower_favourites_api.php';
  const ok = () => M.api.posted.filter((p) => p.url.endsWith(SYNC) && !p.rejected);
  const RAW = () => load('utils/followStorage', { raw: true });
  const ids = (p) => String(p.body.customer_app_id_string).split(',').filter(Boolean).map(Number).sort((a, b) => a - b);
  const block = (s, from, len = 1500) => { const at = s.indexOf(from); assert.ok(at > -1, 'found: ' + from); return s.slice(at, at + len); };
  /** Runs fn with `name` resolved to `fake` (non-relative requires only). */
  const withModule = async (name, fake, fn) => {
    const orig = Module._load;
    Module._load = function (request, ...rest) { return request === name ? fake : orig.call(this, request, ...rest); };
    try { return await fn(); } finally { Module._load = orig; }
  };

  // ── 1. base_seq + follow_conflict merge ────────────────────────────────
  test('phone follow does NOT erase a web follow on the shared row (base_seq → follow_conflict → merge) (R1)', async () => {
    M.store.set('FOLLOWER_ID', '501');
    M.store.set('followed_users', JSON.stringify([1]));
    M.api.rows[501] = { follow_seq: 1000, customers: [1, 2], bibs: {} };   // 2 = followed on the web
    const m = RAW();
    await m.followUser(3);
    await m.whenFollowSyncIdle();
    const last = ok().pop();
    assert.ok(last, 'an upload landed');
    assert.strictEqual(typeof last.body.base_seq, 'number', 'base_seq sent');
    assert.deepStrictEqual(ids(last), [1, 2, 3], 'web follow kept');
    assert.deepStrictEqual(M.api.rows[501].customers.sort(), [1, 2, 3]);
    assert.deepStrictEqual((await m.getFollowedUsers()).sort(), [1, 2, 3], 'web follow now on the phone');
    assert.strictEqual(await m.hasPendingFollowSync(), false);
  });
  test('conflict merge: local unfollow never resurrected, web unfollow kept, both sides\' adds kept (customers + bibs)', async () => {
    M.store.set('FOLLOWER_ID', '501');
    const m = RAW();
    // Phone took a download of the row at #1000: [1,2,5], bib 13|7.
    await m.syncFollowDataFromAPI([1, 2, 5], { 13: ['7'] }, undefined, 1000);
    // Web since: unfollowed 2, followed 8 and bib 13|9.
    M.api.rows[501] = { follow_seq: 2000, customers: [1, 5, 8], bibs: { 13: ['7', '9'] } };
    await m.unfollowUser(5); await m.followUser(9); await m.unfollowBib(13, '7');
    await m.whenFollowSyncIdle();
    assert.deepStrictEqual(ids(ok().pop()), [1, 8, 9]);
    assert.deepStrictEqual((await m.getFollowedUsers()).sort((a, b) => a - b), [1, 8, 9]);
    assert.deepStrictEqual(await m.getFollowedBibs(13), ['9']);
    assert.deepStrictEqual(M.api.rows[501].bibs, { 13: ['9'] });
  });
  test('conflict rounds are bounded (3 merges, then pending stays) — no loop', async () => {
    M.store.set('FOLLOWER_ID', '501');
    M.api.failWith = { type: 'empty', code: 'follow_conflict', data: { follow_seq: 5000, followed_customers: [1], followed_bibs: {} } };
    const m = RAW();
    await m.followUser(4);
    await m.whenFollowSyncIdle();
    const tries = M.api.posted.filter((p) => p.url.endsWith(SYNC) && p.rejected).length;
    assert.strictEqual(tries, 4, 'first upload + 3 merge rounds');
    assert.strictEqual(await m.hasPendingFollowSync(), true, 'still pending');
    assert.deepStrictEqual((await m.getFollowedUsers()).sort(), [1, 4], 'merged locally');
  });
  test('conflict naming the phone\'s OWN late-committed upload: its lists are the base (a re-follow is not dropped)', async () => {
    M.store.set('FOLLOWER_ID', '501');
    M.store.set('followed_users', JSON.stringify([1, 2]));
    const m = RAW();
    await m.syncFollowDataFromAPI([1, 2], {}, undefined, 1000);
    M.api.rows[501] = { follow_seq: 1000, customers: [1, 2], bibs: {} };
    M.api.syncScript = [{ lateCommit: 30 }];   // unfollow 2: times out here, server commits later
    await m.unfollowUser(2); await m.whenFollowSyncIdle();
    await wait(60);                            // row is now [1] at the phone's own number
    assert.deepStrictEqual(M.api.rows[501].customers, [1], 'late commit applied');
    await m.followUser(2); await m.whenFollowSyncIdle();
    assert.ok(M.api.posted.some((p) => p.conflict), 'went through a conflict');
    assert.deepStrictEqual(M.api.rows[501].customers.sort(), [1, 2], 're-follow reached the row');
    assert.deepStrictEqual((await m.getFollowedUsers()).sort(), [1, 2]);
  });

  // ── 2. stale download never overwrites ─────────────────────────────────
  test('download OLDER than the phone\'s accepted upload (stale server cache) → pushed, not taken', async () => {
    M.store.set('FOLLOWER_ID', '501');
    const m = RAW();
    await m.followUser(4); await m.whenFollowSyncIdle();
    const before = ok().length;
    await m.syncFollowDataFromAPI([], {}, undefined, 5);   // follow_seq 5 < the accepted client_seq
    await m.whenFollowSyncIdle();
    assert.deepStrictEqual(await m.getFollowedUsers(), [4], 'kept');
    assert.ok(ok().length > before, 'pushed instead');
  });

  // ── 3. pending upload retried on foreground / reconnect ────────────────
  test('offline follow retried when the app comes to the foreground (R2)', async () => {
    M.store.set('FOLLOWER_ID', '501');
    const m = RAW();
    M.api.fail = true;
    await m.followUser(7); await m.whenFollowSyncIdle();
    assert.strictEqual(await m.hasPendingFollowSync(), true);
    M.api.fail = false;
    M.appStateListeners.forEach((l) => l('active'));
    await wait(20); await m.whenFollowSyncIdle();
    assert.strictEqual(ok().length, 1, 'retried');
    assert.strictEqual(await m.hasPendingFollowSync(), false);
  });
  test('offline follow retried when the network becomes reachable again — on the edge only', async () => {
    M.store.set('FOLLOWER_ID', '501');
    const m = RAW();
    M.api.fail = true;
    await m.followUser(7); await m.whenFollowSyncIdle();
    M.api.fail = false;
    assert.ok(M.netListeners.length >= 1, 'NetInfo listener installed');
    M.netListeners.forEach((l) => l({ isConnected: true, isInternetReachable: true }));   // first report: no edge
    await wait(20); await m.whenFollowSyncIdle();
    assert.strictEqual(ok().length, 0, 'no retry without an offline → online edge');
    M.netListeners.forEach((l) => l({ isConnected: false, isInternetReachable: false }));
    M.netListeners.forEach((l) => l({ isConnected: true, isInternetReachable: true }));
    await wait(20); await m.whenFollowSyncIdle();
    assert.strictEqual(ok().length, 1, 'retried on reconnect');
  });

  // ── 4. push token re-sent at once when the row was re-created ─────────
  test('row gone (follower_not_found) → push token re-registered in-session, not at the next foreground (R5)', async () => {
    M.notif.status = 'granted';
    const n = load('services/notificationPermissionService').notificationPermissionService;
    await n.registerIfGranted();
    assert.strictEqual(M.fapi.registerCalls.length, 1);
    const m = RAW();
    M.api.rejectIds = [501];
    M.fapi.guestResult = { follower_id: 900 };
    M.fapi.byDevice = null;
    await m.followUser(4); await m.whenFollowSyncIdle();
    await m.followUser(5); await m.whenFollowSyncIdle();
    await wait(30);
    assert.ok(M.fapi.registerCalls.length >= 2, 'token sent again in-session');
  });
  test('new token-less row (ensureFollowerId) → registerIfGranted right away', () => {
    const s = read('utils/followStorage.ts');
    const ens = block(s, 'export async function ensureFollowerId', 1800);
    assert.ok(/forgetSentPushToken\(\);[\s\S]{0,300}void notificationPermissionService\.registerIfGranted\(\);/.test(ens));
    const rest = block(s, 'export async function restoreFollowsWithoutToken', 2500);
    assert.ok(/forgetSentPushToken\(\);\s*void notificationPermissionService\.registerIfGranted\(\);/.test(rest));
  });

  // ── 5. adopt with a prefetched download older than a local change ──────
  test('adopt merge with a prefetched download taken BEFORE a local unfollow → fresh download, unfollow stays (R3)', async () => {
    M.store.set('FOLLOWER_ID', '501');
    M.store.set('followed_users', JSON.stringify([1, 9]));
    const m = RAW();
    const seq = m.getFollowWriteSeq();
    await m.unfollowUser(9); await m.whenFollowSyncIdle();
    M.store.set('@PFSLive:followAdoptPending', '1');
    M.fapi.byDevice = { follower_id: 501, followed_customers: [1], followed_bibs: {} };
    await m.syncFollowDataFromAPI([1, 9], {}, seq);
    await m.whenFollowSyncIdle();
    assert.ok(!(await m.getFollowedUsers()).includes(9), 'unfollow not resurrected');
    assert.ok(M.fapi.byDeviceCalls >= 1, 'fresh download used');
  });

  // ── 6. fan email / language: stale id → re-register + retry once ───────
  test('fan email: follower_not_found → stale id dropped, device registered again, retried once', async () => {
    M.store.set('FOLLOWER_ID', '501');
    M.fapi.guestResult = { follower_id: 900 };
    const calls = [];
    const axios = { __esModule: true, default: { post: async (url, body) => {
      calls.push(body);
      if (calls.length === 1) throw Object.assign(new Error('400'), { response: { status: 400, data: { success: false, error: 'follower_not_found' } } });
      return { data: { success: true, data: { follower_id: 900, email: body.email } } };
    } } };
    const res = await withModule('axios', axios, () => load('services/Fanemailservice').fanEmailApi.updateEmail('a@b.c'));
    assert.strictEqual(res.success, true, JSON.stringify(res));
    assert.strictEqual(calls.length, 2, 'retried once');
    assert.strictEqual(M.store.get('FOLLOWER_ID'), '900', 'new row');
    assert.strictEqual(M.fapi.guestCalls, 1);
  });
  test('language: follower_not_found → stale id dropped, device registered again, retried once', async () => {
    M.store.set('FOLLOWER_ID', '501');
    M.fapi.guestResult = { follower_id: 900 };
    const calls = [];
    const origFetch = global.fetch;
    global.fetch = async (url, init) => {
      calls.push(JSON.parse(init.body));
      if (calls.length === 1) return { ok: false, status: 400, json: async () => ({ success: false, data: null, error: 'follower_not_found' }) };
      return { ok: true, status: 200, json: async () => ({ success: true, data: { follower_id: 900, language_id: 2 }, error: null }) };
    };
    try {
      const r = await load('services/guestSettingsService').guestSettingsService.updateLanguage(2);
      assert.deepStrictEqual(r, { languageId: 2 });
    } finally { global.fetch = origFetch; }
    assert.strictEqual(calls.length, 2);
    assert.strictEqual(M.store.get('FOLLOWER_ID'), '900');
  });

  // ── 7. useFollowManager ────────────────────────────────────────────────
  test('follow: a failing markAsFollowerActive does not fail the follow (no rollback / error path)', async () => {
    M.store.set('FOLLOWER_ID', '501');
    const log = [];
    M.analytics = { push: (a) => { if (a[0] === 'markAsFollowerActive') throw new Error('analytics down'); log.push(a); } };
    const { useFollowManager } = load('hooks/useFollowManager');
    const r = useFollowManager((k) => k);
    await r.toggleFollow(5);
    assert.ok(log.some((a) => a[0] === 'logFollowToggle' && a[1] === 'follow'), 'follow completed (follow_toggle logged)');
    await r.toggleFollow(13, '7');   // bib follow, dual mode
    assert.strictEqual(log.filter((a) => a[0] === 'logFollowToggle' && a[1] === 'follow').length, 2);
  });
  test('follow: a fast double tap runs ONE follow (one toast / follow_toggle)', async () => {
    M.store.set('FOLLOWER_ID', '501');
    const { useFollowManager } = load('hooks/useFollowManager');
    const r = useFollowManager((k) => k);
    await Promise.all([r.toggleFollow(5), r.toggleFollow(5)]);
    await Promise.all([r.toggleFollow(13, '7'), r.toggleFollow(13, '7')]);
    assert.strictEqual(M.analytics.filter((a) => a[0] === 'logFollowToggle').length, 2, 'one per control');
    // Let its uploads finish here — left running, they land in a later test's fake server.
    await RAW().whenFollowSyncIdle();
  });

  // ── 8. notification_ask 'shown' when the sheet really shows ───────────
  test('fan sheet: "shown" logged from the Modal onShow (once per opening), not when the store opens', async () => {
    const st = load('store/useFollowPromptStore');
    await st.maybePromptNotificationsAfterFollow();
    assert.strictEqual(st.useFollowPromptStore.getState().visible, true);
    assert.strictEqual(M.analytics.filter((a) => a[2] === 'shown').length, 0, 'not logged by the store');
    st.useFollowPromptStore = (sel) => sel({ visible: true, hide() {} });
    const el = load('components/FollowNotificationPrompt').FollowNotificationPrompt({});
    el.props.onShow(); el.props.onShow();
    assert.strictEqual(M.analytics.filter((a) => a[0] === 'logNotificationAsk' && a[2] === 'shown').length, 1);
  });

  // ── follow-up: first upload after an update (no stored base) ──────────
  test("no base, 409 names the phone's own last upload (stored seqIssued): row lists are the base — offline unfollow stays removed", async () => {
    M.store.set('FOLLOWER_ID', '501');
    M.store.set('@PFSLive:followSeqIssued', '500');
    M.store.set('followed_users', JSON.stringify([1]));        // 2 unfollowed offline on the old version
    M.store.set('@PFSLive:followSyncPending', '1');
    M.api.rows[501] = { follow_seq: 500, customers: [1, 2], bibs: {} };   // the phone's own last upload
    const m = RAW();
    await m.syncFollowDataToAPI();
    await m.whenFollowSyncIdle();
    assert.ok(M.api.posted.some((p) => p.url.endsWith(SYNC) && p.conflict), 'conflict hit');
    assert.deepStrictEqual(M.api.rows[501].customers.sort(), [1], 'unfollow not resurrected');
    assert.deepStrictEqual(await m.getFollowedUsers(), [1]);
    assert.strictEqual(await m.hasPendingFollowSync(), false);
  });
  test("no base, 409 row number NOT the phone's own: plain union keeps the row's follows", async () => {
    M.store.set('FOLLOWER_ID', '501');
    M.store.set('@PFSLive:followSeqIssued', '500');
    M.store.set('followed_users', JSON.stringify([1]));
    M.store.set('@PFSLive:followSyncPending', '1');
    M.api.rows[501] = { follow_seq: 700, customers: [1, 2, 3], bibs: {} };
    const m = RAW();
    await m.syncFollowDataToAPI();
    await m.whenFollowSyncIdle();
    assert.deepStrictEqual(M.api.rows[501].customers.sort(), [1, 2, 3], 'union');
    assert.deepStrictEqual((await m.getFollowedUsers()).sort(), [1, 2, 3]);
  });
  test('HomeScreen: a start older than START_STUCK_MS (60 s) no longer blocks Start; only the newest start clears the guard', () => {
    const s = read('screens/HomeScreen.tsx');
    assert.ok(/export const START_STUCK_MS = 60 \* 1000;/.test(s));
    assert.ok(/const isStarting = \(\) => startingRef\.current && Date\.now\(\) - startingAtRef\.current < START_STUCK_MS;/.test(s));
    const fn = block(s, 'const doStartGPSTracking = useCallback(async () => {', 700);
    assert.ok(/if \(isStarting\(\) \|\| isGPSActiveRef\.current\) return;\s*startingRef\.current = true;\s*const startedAt = Date\.now\(\);\s*startingAtRef\.current = startedAt;/.test(fn));
    assert.ok(/\} finally \{[\s\S]{0,200}if \(startingAtRef\.current === startedAt\) startingRef\.current = false;\s*\}/.test(s));
    assert.ok(/if \(isStarting\(\)\) return;/.test(block(s, 'const confirmStartTracking', 200)), 'confirm');
    assert.ok(/if \(isStarting\(\)\) return;[\s\S]{0,120}'start_approximate'/.test(s), '"Start anyway"');
  });

  // ── 9–12. HomeScreen Start flow (HomeScreen is not loadable here) ──────
  test('pending start: window refreshed when the popup button is pressed and when the listener re-shows it', () => {
    const s = read('screens/HomeScreen.tsx');
    const btn = block(s, '{popupCopy.showSettingsButton && (', 600);
    assert.ok(/setShowLocationPermissionModal\(false\);[\s\S]{0,300}if \(pendingStartRef\.current\) pendingStartAtRef\.current = Date\.now\(\);/.test(btn));
    const re = block(s, "'still_blocked_on_return'", 900);
    assert.ok(/pendingStartAtRef\.current = Date\.now\(\);[\s\S]*setShowLocationPermissionModal\(true\)/.test(re));
  });
  test('doStartGPSTracking: one at a time (startingRef + isGPSActiveRef), cleared in finally; taps ignored while starting', () => {
    const s = read('screens/HomeScreen.tsx');
    const fn = block(s, 'const doStartGPSTracking = useCallback(async () => {', 700);
    assert.ok(/if \(isStarting\(\) \|\| isGPSActiveRef\.current\) return;\s*startingRef\.current = true;/.test(fn));
    assert.ok(/\} finally \{[\s\S]{0,200}startingRef\.current = false;\s*\}/.test(block(s, "void analyticsService.logStartStep('failed', 'exception'", 900)));
    assert.ok(/if \(isStarting\(\)\) return;/.test(block(s, 'const confirmStartTracking', 200)), 'confirm ignores');
    assert.ok(/if \(isStarting\(\)\) return;[\s\S]{0,120}'start_approximate'/.test(s), '"Start anyway" ignores');
  });
  test('return listener: needs a real background trip; precise block needs readPrecise() !== false', () => {
    const s = read('screens/HomeScreen.tsx');
    const l = block(s, 'let sawBackground = false;', 1600);
    assert.ok(/if \(next === 'background'\) \{ sawBackground = true; return; \}/.test(l));
    assert.ok(/if \(!cameBack \|\| !pendingStartRef\.current\) return;/.test(l));
    assert.ok(/\(await readPrecise\(\)\) !== false/.test(l) && /servicesOn && preciseOk;/.test(l));
  });
  test('"Start anyway" covers one start only: consumed at the top of doStartGPSTracking (early gate returns cannot carry it)', () => {
    const s = read('screens/HomeScreen.tsx');
    const fn = block(s, 'const doStartGPSTracking = useCallback(async () => {', 900);
    assert.ok(/const allowApproximate = allowApproximateRef\.current;\s*allowApproximateRef\.current = false;\s*try \{/.test(fn));
    assert.ok(/if \(!allowApproximate && \(await readPrecise\(\)\) === false\)/.test(s));
  });

  // ── 13. RaceReadyScreen ─────────────────────────────────────────────────
  test('Get race-ready: busyRef double-tap guard; "abandoned" logged on unmount without done/later', () => {
    const s = read('screens/RaceReadyScreen.tsx');
    assert.ok(/if \(!current \|\| !state \|\| busyRef\.current\) return;\s*busyRef\.current = true;/.test(s));
    assert.ok(/busyRef\.current = false;/.test(block(s, 'await refresh();', 200)));
    assert.ok(/useEffect\(\(\) => \(\) => \{\s*if \(finishedLogged\.current \|\| laterLogged\.current\) return;\s*void analyticsService\.logRaceReadyStep\('abandoned'/.test(s));
    assert.ok(/laterLogged\.current = true;/.test(block(s, 'const onLater', 300)));
    assert.ok(/\| "abandoned"/.test(read('services/analyticsService.ts')), 'in the analytics union');
  });

  // ── 14. ReadinessCard product_app_id + custom-aware start_step ─────────
  test('readiness card → RaceReady carries product_app_id for partner races only; start_step race id is the race-ready key', () => {
    const c = read('components/Home/ReadinessCard.tsx');
    assert.ok(/const productAppId = raceKey && \/\^\\d\+\$\/\.test\(raceKey\) \? Number\(raceKey\) : undefined;/.test(c));
    assert.ok(/product_app_id: productAppId/.test(c));
    const s = read('screens/HomeScreen.tsx');
    assert.ok(/<ReadinessCard[\s\S]{0,120}raceKey=\{raceReadyKey\}/.test(s));
    const calls = [...s.matchAll(/logStartStep\([\s\S]*?\);/g)].map((m) => m[0]);
    assert.ok(calls.length >= 14);
    for (const c2 of calls) assert.ok(/raceReadyKey|eventIdRef\.current/.test(c2) && !/,\s*eventId,?\s*\)/.test(c2), c2);
    assert.ok(/eventIdRef = useRef\(raceReadyKey\)/.test(s));
  });

  // ── 15. screen_ready claimed synchronously ─────────────────────────────
  test('screen_ready: module-level claim BEFORE the storage read (no double log)', () => {
    const s = read('screens/HomeScreen.tsx');
    assert.ok(/^const screenReadyClaimed = new Set<string>\(\);/m.test(s));
    const b = block(s, "const KEY = '@PFSLive:startReadyLogged';", 900);
    const claim = b.indexOf('screenReadyClaimed.add(claim);');
    assert.ok(claim > -1 && b.indexOf('if (screenReadyClaimed.has(claim)) return;') < claim);
    assert.ok(claim < b.indexOf('AsyncStorage.getItem(KEY)'), 'claimed before the read');
  });

  // ── 16. guest language default ─────────────────────────────────────────
  test('guest settings: picker shows the app language when the server has none / load fails', () => {
    const s = read('screens/SettingScreen/GuestTrackingSettings.tsx');
    assert.ok(/LANGUAGE_OPTIONS\.find\(o => o\.value === getCurrentLanguageId\(\)\)/.test(s));
    const load2 = block(s, 'const loadLanguage', 1400);
    assert.ok(/if \(!match\) setSelectedLanguage\(appLanguageOption\(\)\);\s*if \(!found\) return;/.test(load2));
    assert.ok(/catch[\s\S]{0,200}setSelectedLanguage\(appLanguageOption\(\)\);/.test(load2));
  });

  // ── 17. DistanceTab scroll retry ───────────────────────────────────────
  test('DistanceTab: onScrollToIndexFailed retries scrollToIndex once after ~100 ms', () => {
    const s = read('screens/EventDetails/DistanceTab.tsx');
    const h = block(s, 'onScrollToIndexFailed={(info) => {', 900);
    assert.ok(/if \(scrollRetriedRef\.current\) return;\s*scrollRetriedRef\.current = true;\s*setTimeout\(\(\) => \{[\s\S]{0,80}scrollToIndex\(\{ index: info\.index/.test(h));
    assert.ok(/\}, 100\);/.test(h));
  });
};
