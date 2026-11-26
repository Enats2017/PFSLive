// Follow / favourites / push audit 2026-11-26 — one case per finding.
//   node tests/follow/followAudit.test.js
// Against another checkout (e.g. to prove a case fails on the old code):
//   APP_SRC=D:/react_native/PFSLive/src node tests/follow/followAudit.test.js
// Uses the growth harness: the REAL src/ modules with mocked native/network layers.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const { M, load, test, run, SRC } = require('../growth/harness');

global.__DEV__ = false;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const flush = () => new Promise((r) => setImmediate(r));
const SYNC = '/update_follower_favourites_api.php';
const accepted = () => M.api.posted.filter((p) => p.url.endsWith(SYNC) && !p.rejected);
const customersOf = (p) => String(p.body.customer_app_id_string || '').split(',').filter(Boolean).map(Number);
const t = (k) => k;
const idle = async () => { await load('utils/followStorage', { raw: true }).whenFollowSyncIdle(); };

// axios (Fanemailservice) and one screen's useFollowManager can be scripted per test.
const hooks = { axios: null, favouriteListFollowManager: null, userFavouriteListFollowManager: null, favouritesApi: null, followerApi: null, resultList: null };
const prevLoad = Module._load;
Module._load = function (request, parent) {
  if (request === 'axios' && hooks.axios) return hooks.axios;
  if (request === '../../hooks/useFollowManager' && hooks.favouriteListFollowManager
      && parent && /FavouriteList\.tsx$/.test(parent.filename || '')) {
    return { useFollowManager: hooks.favouriteListFollowManager };
  }
  if (request === '../../hooks/useFollowManager' && hooks.userFavouriteListFollowManager
      && parent && /UserFavouriteList\.tsx$/.test(parent.filename || '')) {
    return { useFollowManager: hooks.userFavouriteListFollowManager };
  }
  if (request === '../../services/favourites' && hooks.favouritesApi
      && parent && /[\\/]FavouriteList\.tsx$/.test(parent.filename || '')) {
    return { favouritesApi: hooks.favouritesApi };
  }
  if (request === '../services/resultList' && hooks.resultList
      && parent && /useResultList\.ts$/.test(parent.filename || '')) {
    return { resultList: hooks.resultList };
  }
  if (request === './registerFollowerServices' && hooks.followerApi
      && parent && /notificationPermissionService\.ts$/.test(parent.filename || '')) {
    return { followerApi: hooks.followerApi };
  }
  // FavouriteList's error hook + favourites.ts's language id (not in the harness stubs).
  if (request === '../../hooks/useApiError' && parent && /FavouriteList\.tsx$/.test(parent.filename || '')) {
    return { useScreenError: () => ({ error: null, hasError: false, handleApiError: () => {}, clearError: () => {} }) };
  }
  if (request === '../i18n' && parent && /services[\\/]favourites\.ts$/.test(parent.filename || '')) {
    return { getCurrentLanguageId: () => 1 };
  }
  return prevLoad.apply(this, arguments);
};
const N = require('expo-notifications');   // the harness mock (a Proxy over a plain object)

const verifyFetch = (delays) => {
  const calls = [];
  global.fetch = async (url, init) => {
    const i = calls.length;
    calls.push(init && init.body);
    await sleep(delays[Math.min(i, delays.length - 1)]);
    return { ok: true, status: 200, json: async () => ({ success: true, data: { verified: 1 }, error: null }) };
  };
  return calls;
};

(async () => {
  // ── #1 failed upload: retried in-session on a timer ─────────────────────
  test('#1 an upload that failed while the app stays open is retried on a timer (no foreground, no network edge)', async () => {
    const fs_ = load('utils/followStorage', { raw: true });
    assert.strictEqual(typeof fs_.setFollowRetryDelaysForTests, 'function', 'in-session retry exists');
    fs_.setFollowRetryDelaysForTests([60, 120]);
    M.store.set('FOLLOWER_ID', '501');
    M.api.syncScript = [{ fail: true }, { fail: true }];
    await fs_.followUser(7);
    await idle();
    assert.strictEqual(accepted().length, 0, 'first upload failed');
    await sleep(100);                      // retry 1 fails too
    await idle();
    assert.strictEqual(accepted().length, 0);
    await sleep(250);                      // retry 2 (next back-off step) delivers
    await idle();
    assert.ok(accepted().some((p) => p.body.follower_id === 501 && customersOf(p).includes(7)), 'follow reached the server');
    assert.strictEqual(M.store.get('@PFSLive:followSyncPending'), undefined, 'pending cleared');
  });
  test('#1 the retry only acts for the JS context that armed it (reload / headless / test isolation)', async () => {
    const fs_ = load('utils/followStorage', { raw: true });
    if (fs_.setFollowRetryDelaysForTests) fs_.setFollowRetryDelaysForTests([60]);
    M.store.set('FOLLOWER_ID', '501');
    M.api.syncScript = [{ fail: true }];
    await fs_.followUser(7);
    await idle();
    M.store.set('@PFSLive:followRetryArmed', 'another-context');
    await sleep(150);
    await idle();
    assert.strictEqual(accepted().length, 0, 'not retried by a context that does not own the retry');
  });

  // ── #2 cold-start notification tap ──────────────────────────────────────
  test('#2 a tap that launched the app is read on mount and routed once the handler registers (deduped, then cleared)', async () => {
    const resp = { notification: { request: { identifier: 'n-1', content: { title: 'CP', data: {
      race_id: 5, event_name: 'Ghent 10K', bib: '7', product_option_value_app_id: 3, tracking_source: 'rr', type: 'checkpoint' } } } } };
    let listener = null; let cleared = 0;
    N.getLastNotificationResponse = () => resp;
    N.clearLastNotificationResponse = () => { cleared++; };
    N.addNotificationResponseReceivedListener = (cb) => { listener = cb; return { remove() {} }; };
    M.effects = [];
    try {
      const { useNotifications } = load('hooks/useNotifications');
      const h = useNotifications();
      M.effects.forEach((e) => e.fn());
      await flush(); await flush();
      const got = [];
      h.setOnNotificationTap((d) => got.push(d));
      await flush();
      assert.strictEqual(got.length, 1, 'cold-start tap routed');
      assert.strictEqual(Number(got[0].race_id), 5);
      listener(resp);                       // same tap also arriving through the listener
      assert.strictEqual(got.length, 1, 'not routed twice');
      assert.ok(cleared >= 1, 'last response cleared after routing');
    } finally {
      M.effects = undefined;
      delete N.getLastNotificationResponse; delete N.clearLastNotificationResponse; delete N.addNotificationResponseReceivedListener;
    }
  });
  test('#2 a warm tap still routes straight away through the listener', async () => {
    let listener = null;
    N.addNotificationResponseReceivedListener = (cb) => { listener = cb; return { remove() {} }; };
    M.effects = [];
    try {
      const { useNotifications } = load('hooks/useNotifications');
      const h = useNotifications();
      M.effects.forEach((e) => e.fn());
      const got = [];
      h.setOnNotificationTap((d) => got.push(d));
      listener({ notification: { request: { identifier: 'n-2', content: { data: { race_id: 9, event_name: 'X' } } } } });
      assert.strictEqual(got.length, 1);
    } finally {
      M.effects = undefined;
      delete N.addNotificationResponseReceivedListener;
    }
  });

  // ── #4 unfollow removes the bib follow too ──────────────────────────────
  test('#4 unfollow on an event row removes BOTH the athlete follow and a bib follow of the same runner', async () => {
    const fs_ = load('utils/followStorage');
    M.store.set('FOLLOWER_ID', '501');
    await fs_.followBib(13, '640');
    await fs_.followUser(7);
    await fs_.smartUnfollow(13, '640', 7);
    assert.strictEqual(await fs_.isUserFollowed(7), false);
    assert.strictEqual(await fs_.isBibFollowed(13, '640'), false, 'bib follow gone too (pushes stop)');
    const last = accepted().pop();
    assert.ok(!customersOf(last).includes(7) && !(last.body.bib_number_string || {})[13], 'server got neither');
  });

  // ── #5 / #6 password sheet ──────────────────────────────────────────────
  const pending = { customerAppId: 7, productAppId: 13, bib: '640' };
  test('#5 double tap on Submit: one verification, the athlete ends up FOLLOWED', async () => {
    const calls = verifyFetch([5, 80]);
    M.useStateMap = (x) => (x === null ? { ...pending } : x);
    try {
      const { useFollowManager } = load('hooks/useFollowManager');
      const h = useFollowManager(t, 13);
      await Promise.all([h.handlePasswordSubmit('pw'), h.handlePasswordSubmit('pw')]);
      await idle();
      assert.strictEqual(calls.length, 1, 'verified once');
      assert.strictEqual(await load('utils/followStorage').isUserFollowed(7), true, 'still followed');
    } finally { M.useStateMap = undefined; delete global.fetch; }
  });
  test('#6 sheet closed while the password is being checked → no follow', async () => {
    verifyFetch([60]);
    M.useStateMap = (x) => (x === null ? { ...pending } : x);
    try {
      const { useFollowManager } = load('hooks/useFollowManager');
      const h = useFollowManager(t, 13);
      const p = h.handlePasswordSubmit('pw');
      await sleep(5);
      h.handlePasswordModalClose();
      await p;
      await idle();
      assert.strictEqual(await load('utils/followStorage').isUserFollowed(7), false, 'cancelled = not followed');
    } finally { M.useStateMap = undefined; delete global.fetch; }
  });

  // ── #7 double tap on the star ───────────────────────────────────────────
  test('#7 second tap right after the first finished is a double tap (ignored); a later tap still unfollows', async () => {
    const { useFollowManager } = load('hooks/useFollowManager');
    const fs_ = load('utils/followStorage');
    const h = useFollowManager(t, 13);
    await h.toggleFollow(13, '640', null);
    await h.toggleFollow(13, '640', null);
    assert.strictEqual(await fs_.isBibFollowed(13, '640'), true, 'double tap did not unfollow');
    M.clock += 1000;
    await h.toggleFollow(13, '640', null);
    assert.strictEqual(await fs_.isBibFollowed(13, '640'), false, 'a real second tap does');
  });

  // ── #8 language / fan-email screens: merge runs at once ─────────────────
  test('#8 fan email replaces a stale id → the new row gets the phone\'s follows right away', async () => {
    M.store.set('FOLLOWER_ID', '400');
    M.store.set('followed_users', '[7]');
    const bodies = [];
    hooks.axios = { __esModule: true, default: { post: async (url, body) => {
      bodies.push(body);
      if (bodies.length === 1) { const e = new Error('400'); e.response = { data: { success: false, error: 'follower_not_found' } }; throw e; }
      return { data: { success: true, data: { follower_id: 501, email: body.email } } };
    } } };
    try {
      const { fanEmailApi } = load('services/Fanemailservice');
      const r = await fanEmailApi.updateEmail('fan@example.com');
      assert.strictEqual(r.success, true);
      await sleep(20); await idle();
      assert.ok(accepted().some((p) => p.body.follower_id === 501 && customersOf(p).includes(7)), 'merged + uploaded to the new row');
    } finally { hooks.axios = null; }
  });
  test('#8 language change replaces a stale id → the new row gets the phone\'s follows right away', async () => {
    M.store.set('FOLLOWER_ID', '400');
    M.store.set('followed_users', '[7]');
    let n = 0;
    global.fetch = async () => {
      n++;
      if (n === 1) return { ok: false, status: 400, json: async () => ({ success: false, error: 'follower_not_found' }) };
      return { ok: true, status: 200, json: async () => ({ success: true, data: { follower_id: 501, language_id: 2 } }) };
    };
    try {
      const { guestSettingsService } = load('services/guestSettingsService');
      await guestSettingsService.updateLanguage(2);
      await sleep(20); await idle();
      assert.ok(accepted().some((p) => p.body.follower_id === 501 && customersOf(p).includes(7)), 'merged + uploaded to the new row');
    } finally { delete global.fetch; }
  });

  // ── #9 token re-confirmed with the server ───────────────────────────────
  test('#9 the push token is sent again after 6 h (session and after a restart), not on every foreground', async () => {
    M.notif.status = 'granted';
    let np = load('services/notificationPermissionService').notificationPermissionService;
    await np.registerIfGranted();
    await np.registerIfGranted();
    assert.strictEqual(M.fapi.registerCalls.length, 1, 'once per session normally');
    M.clock += 7 * 3600 * 1000;
    await np.registerIfGranted();
    assert.strictEqual(M.fapi.registerCalls.length, 2, 're-sent in a long session');
    // restart: fresh modules, same storage
    for (const k of Object.keys(require.cache)) if (k.replace(/\\/g, '/').startsWith(SRC)) delete require.cache[k];
    np = load('services/notificationPermissionService').notificationPermissionService;
    await np.registerIfGranted();
    assert.strictEqual(M.fapi.registerCalls.length, 2, 'fresh stamp → skipped');
    for (const k of Object.keys(require.cache)) if (k.replace(/\\/g, '/').startsWith(SRC)) delete require.cache[k];
    M.clock += 7 * 3600 * 1000;
    np = load('services/notificationPermissionService').notificationPermissionService;
    await np.registerIfGranted();
    assert.strictEqual(M.fapi.registerCalls.length, 3, 're-sent after a restart once the stamp is old');
  });
  test('#9 backward compatible: a token stored by an older build (no stamp) is not re-posted on update', async () => {
    M.notif.status = 'granted';
    M.store.set('expo_push_token', M.notif.token);
    M.store.set('FOLLOWER_ID', '501');
    const np = load('services/notificationPermissionService').notificationPermissionService;
    await np.registerIfGranted();
    assert.strictEqual(M.fapi.registerCalls.length, 0);
  });

  // ── #10 list screens ────────────────────────────────────────────────────
  test('#10 FavouriteList: a refetch asked for during a running fetch is run afterwards, not dropped', async () => {
    let onFollowSuccess = null;
    hooks.favouriteListFollowManager = (_t, _p, cb) => {
      onFollowSuccess = cb;
      return { isFollowed: () => false, isLoading: () => false, refreshFollowedUsers: async () => {}, handleFollowPress: () => {},
        passwordModalVisible: false, isVerifying: false, passwordError: '', handlePasswordSubmit: async () => {}, handlePasswordModalClose: () => {} };
    };
    try {
      const FavouriteList = load('screens/FavouriteScreen/FavouriteList').default;
      FavouriteList({ route: { params: { product_app_id: 13, event_name: 'E' } }, navigation: { navigate() {}, goBack() {} } });
      assert.strictEqual(typeof onFollowSuccess, 'function');
      M.storeDelay = 10;                 // the fetch takes a moment
      const favPosts = () => M.api.posted.filter((p) => p.body && p.body.product_app_id === 13 && 'bib_number_string' in p.body && !p.url.endsWith(SYNC));
      onFollowSuccess();                 // e.g. the focus fetch
      await sleep(5);
      onFollowSuccess();                 // the post-unfollow refetch, while the first runs
      await sleep(200);
      assert.strictEqual(favPosts().length, 2, 'second fetch ran after the first');
    } finally { hooks.favouriteListFollowManager = null; M.storeDelay = 0; }
  });
  test('#10 UserFavouriteList: a row hidden by an unfollow that was rolled back comes back', async () => {
    const { pruneRestoredRemovals } = load('screens/FollowerScreen/removedRows');
    const prev = new Set([7, 8]);
    assert.deepStrictEqual([...pruneRestoredRemovals(prev, new Set([7]), new Set())], [8], '7 followed again → shown');
    assert.strictEqual(pruneRestoredRemovals(prev, new Set([7]), new Set(['customer:7'])), prev, 'still toggling → stays hidden');
    assert.strictEqual(pruneRestoredRemovals(prev, new Set(), new Set()), prev, 'unfollowed → stays hidden, same object');
    const s = fs.readFileSync(path.resolve(SRC, 'screens/FollowerScreen/UserFavouriteList.tsx'), 'utf8');
    assert.ok(/setRemovedIds\(prev => pruneRestoredRemovals\(prev, followedUsers, followingInProgress\)\)/.test(s), 'screen wires it');
  });
  test('#10 UserFavouriteList: a Remove tap the follow manager IGNORES (double-tap cooldown) does not leave the row hidden', async () => {
    // Two renders that differ ONLY in removedIds — what an ignored toggle leaves
    // behind (the row was hidden first; followedUsers / in-progress unchanged).
    // React re-runs an effect only when a dep changed, so the prune effect must
    // list removedIds, or the hidden-but-followed row stays hidden.
    const followedUsers = new Set([7]);
    const followingInProgress = new Set();
    hooks.userFavouriteListFollowManager = () => ({
      followedUsers, followingInProgress, isFollowed: (id) => followedUsers.has(id), isLoading: () => false,
      handleFollowPress: () => {}, refreshFollowedUsers: async () => {}, passwordModalVisible: false, isVerifying: false,
      passwordError: '', handlePasswordSubmit: async () => {}, handlePasswordModalClose: () => {} });
    const pruneDeps = () => {
      const e = M.effects.find((x) => Array.isArray(x.deps) && x.deps.includes(followedUsers) && x.deps.includes(followingInProgress));
      assert.ok(e, 'prune effect present');
      return e;
    };
    try {
      const UserFavouriteList = load('screens/FollowerScreen/UserFavouriteList').default;
      const props = { navigation: { navigate() {}, goBack() {} }, route: { params: {} } };
      const before = new Set();            // removedIds before the tap
      const after = new Set([7]);          // …after the (ignored) Remove tap
      M.effects = []; M.useStateMap = (x) => (x instanceof Set ? before : x);
      UserFavouriteList(props); const e1 = pruneDeps();
      M.effects = []; M.useStateMap = (x) => (x instanceof Set ? after : x);
      UserFavouriteList(props); const e2 = pruneDeps();
      const reruns = e1.deps.length !== e2.deps.length || e1.deps.some((d, i) => !Object.is(d, e2.deps[i]));
      assert.ok(reruns, 'prune effect re-runs when only removedIds changed');
      e2.fn();                             // runs; its setRemovedIds is the stub's no-op — apply the updater here
      const { pruneRestoredRemovals } = load('screens/FollowerScreen/removedRows');
      const next = pruneRestoredRemovals(after, followedUsers, followingInProgress);
      assert.ok(!next.has(7), 'still followed → row shown again');
    } finally { hooks.userFavouriteListFollowManager = null; M.effects = undefined; M.useStateMap = undefined; }
  });

  // ── FN1 athlete unfollow on athlete-only screens drops their bib follows ─
  test('FN1 unfollowing an athlete (profile / search / Following list) also drops a bib follow linked to them', async () => {
    const fs_ = load('utils/followStorage');
    M.store.set('FOLLOWER_ID', '501');
    await fs_.followBib(13, '640');                       // made while the row had no account
    await fs_.followUser(7);
    assert.strictEqual(typeof fs_.rememberBibOwners, 'function', 'bib → athlete links exist');
    await fs_.rememberBibOwners(13, [{ bib_number: '640', customer_app_id: 7 }, { bib_number: '9', customer_app_id: 8 }]);
    await fs_.unfollowUser(7);                            // customer-only screens call this
    assert.strictEqual(await fs_.isBibFollowed(13, '640'), false, 'bib follow gone → no more pushes');
    const last = accepted().pop();
    assert.ok(!customersOf(last).includes(7) && !(last.body.bib_number_string || {})[13], 'server got neither');
    assert.ok(!('13|9' in JSON.parse(M.store.get('@PFSLive:bibOwners') || '{}')), 'links only kept for followed bibs');
  });
  test('FN1 another athlete\'s bib is never touched; no link → athlete unfollow leaves bibs alone', async () => {
    const fs_ = load('utils/followStorage');
    M.store.set('FOLLOWER_ID', '501');
    await fs_.followBib(13, '640');
    await fs_.followBib(13, '700');
    await fs_.followUser(7);
    if (fs_.rememberBibOwners) await fs_.rememberBibOwners(13, [{ bib_number: '700', customer_app_id: 8 }]);
    await fs_.unfollowUser(7);
    assert.strictEqual(await fs_.isBibFollowed(13, '640'), true);
    assert.strictEqual(await fs_.isBibFollowed(13, '700'), true);
  });
  test('FN1 FavouriteList learns the links from get_favourite_api (bib → account) when it loads', async () => {
    let onFollowSuccess = null;
    hooks.favouriteListFollowManager = (_t, _p, cb) => {
      onFollowSuccess = cb;
      return { isFollowed: () => true, isLoading: () => false, refreshFollowedUsers: async () => {}, handleFollowPress: () => {},
        passwordModalVisible: false, isVerifying: false, passwordError: '', handlePasswordSubmit: async () => {}, handlePasswordModalClose: () => {} };
    };
    hooks.favouritesApi = { getFavourites: async () => ({
      favourites: [{ bib_number: '640', customer_app_id: 7 }], pagination: { page: 1, total_pages: 1, total: 1, per_page: 20 }, show_results: 1 }) };
    try {
      const fs_ = load('utils/followStorage');
      M.store.set('FOLLOWER_ID', '501');
      await fs_.followBib(13, '640');
      await fs_.followUser(7);
      const FavouriteList = load('screens/FavouriteScreen/FavouriteList').default;
      FavouriteList({ route: { params: { product_app_id: 13, event_name: 'E' } }, navigation: { navigate() {}, goBack() {} } });
      onFollowSuccess();
      await sleep(30);
      await fs_.unfollowUser(7);
      assert.strictEqual(await fs_.isBibFollowed(13, '640'), false);
    } finally { hooks.favouriteListFollowManager = null; hooks.favouritesApi = null; }
  });

  test('FN1 a bib followed earlier is dropped by an athlete-only unfollow once the result list showed that runner with an account', async () => {
    const fs_ = load('utils/followStorage');
    M.store.set('FOLLOWER_ID', '501');
    await fs_.followBib(13, '640');                       // followed from the result list while the row had no account
    await fs_.followUser(7);                              // later followed as an athlete
    hooks.resultList = { getEventRanking: async () => ({
      distances: [{ product_option_value_app_id: 85, distance_name: '10K', is_selected: 1 }],
      categories: [{ key: 'scratch', label: 'Scratch' }],
      results: [{ bib: '640', position: '1', name: 'R', checkpoints: [], customer_app_id: 7 }, { bib: '9', position: '2', name: 'S', checkpoints: [], customer_app_id: null }],
      pagination: { page: 1, per_page: 20, total: 2, total_pages: 1 },
      statistics: { crossed: 0, expected: 0, started: 0, dnf: 0 }, event: { race_status: 'in_progress' } }) };
    M.effects = [];
    try {
      const { useResultList } = load('hooks/useResultList');
      useResultList(13, 85);
      M.effects.forEach((e) => { try { e.fn(); } catch { /* inert stub effects */ } });
      await sleep(30);
      await fs_.unfollowUser(7);                          // profile / athlete search / Following list
      assert.strictEqual(await fs_.isBibFollowed(13, '640'), false, 'bib follow dropped with the athlete');
    } finally { hooks.resultList = null; M.effects = undefined; }
  });

  // ── FN2 token cleared server-side mid-race: noticed on the next foreground ─
  test('FN2 foreground > 15 min after the last check: server says follower_not_found → token sent again now', async () => {
    M.notif.status = 'granted';
    let checks = 0;
    hooks.followerApi = {
      registerFollower: async (tok) => { M.fapi.registerCalls.push(tok); return { follower_id: 501 }; },
      getFollowerData: async () => { checks++; throw Object.assign(new Error('follower_not_found'), { type: 'empty', code: 'follower_not_found' }); },
      registerGuestFollower: async () => ({ follower_id: 501 }), getFollowerDataByDevice: async () => ({}),
    };
    try {
      const np = load('services/notificationPermissionService').notificationPermissionService;
      await np.registerIfGranted();
      assert.strictEqual(M.fapi.registerCalls.length, 1);
      const foreground = async () => { M.appStateListeners.forEach((l) => l('active')); await sleep(30); };
      M.clock += 5 * 60 * 1000;
      await foreground();
      assert.strictEqual(checks, 0, 'not within 15 min of the registration');
      M.clock += 11 * 60 * 1000;
      await foreground();
      assert.strictEqual(checks, 1, 'checked once');
      assert.strictEqual(M.fapi.registerCalls.length, 2, 'token re-sent at once');
      M.clock += 60 * 1000;
      await foreground();
      assert.strictEqual(checks, 1, 'rate-limited');
    } finally { hooks.followerApi = null; }
  });
  test('FN2 a timeout / 5xx on the check never re-registers', async () => {
    M.notif.status = 'granted';
    hooks.followerApi = {
      registerFollower: async (tok) => { M.fapi.registerCalls.push(tok); return { follower_id: 501 }; },
      getFollowerData: async () => { throw Object.assign(new Error('Network Error'), { type: 'network' }); },
    };
    try {
      const np = load('services/notificationPermissionService').notificationPermissionService;
      await np.registerIfGranted();
      M.clock += 20 * 60 * 1000;
      M.appStateListeners.forEach((l) => l('active')); await sleep(30);
      assert.strictEqual(M.fapi.registerCalls.length, 1);
    } finally { hooks.followerApi = null; }
  });

  const r = await run('follow / favourites / push audit 2026-11-26');
  console.log(`\nFOLLOW AUDIT TOTAL: ${r.pass} passed, ${r.fail} failed`);
  process.exit(r.fail ? 1 : 0);
})();
