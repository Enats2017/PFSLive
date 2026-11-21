// Cases added in the THIRD round (2026-10-14). Registered by app.test.js.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

module.exports = function register({ M, load, test, SRC }) {
  const read = (p) => fs.readFileSync(path.resolve(SRC, p), 'utf8');
  const NP = () => load('services/notificationPermissionService').notificationPermissionService;

  test('notifications switched off while the token was being fetched → token not announced', async () => {
    M.notif.status = 'granted';
    const heard = [];
    const np = NP(); np.onTokenChange((t) => heard.push(t));
    const pending = np.registerIfGranted();
    // flip it off DURING the token fetch (permission check already passed;
    // the mocked fetch takes 5 ms)
    await new Promise((r) => setTimeout(r, 2));
    assert.strictEqual(M.notif.tokenFetches, 1, 'fetch is in flight');
    M.notif.status = 'denied';
    assert.strictEqual(await pending, null);
    assert.deepStrictEqual(heard, []);
    assert.strictEqual(np.getCurrentToken(), null);
  });
  test('…and switched on again → announced normally', async () => {
    M.notif.status = 'granted';
    const np = NP();
    const pending = np.registerIfGranted();
    await new Promise((r) => setTimeout(r, 2));
    M.notif.status = 'denied';
    await pending;
    M.notif.status = 'granted';
    assert.strictEqual(await np.registerIfGranted(), 'ExponentPushToken[abc]');
  });
  test('Home: Get race-ready never opens while one of Home\'s own popups is up', () => {
    const s = read('screens/HomeScreen.tsx');
    assert.ok(/const homeModalOpen =/.test(s));
    for (const m of ['showStartConfirmModal', 'showEarlyTrackingModal',
      'showLocationPermissionModal', 'showPowerSavingModal', 'notificationPopup.visible', 'showFanEmailModal']) {
      assert.ok(s.slice(s.indexOf('const homeModalOpen ='), s.indexOf('const homeModalOpen =') + 400).includes(m), m);
    }
    assert.ok(/raceMoreThan3hAway && !homeModalOpen && homeIsFocused/.test(s));
    assert.ok(/raceMoreThan3hAway, homeModalOpen,/.test(s), 'in deps → opens after the popup closes');
  });
  test('every <Modal> on Home is covered by the gate', () => {
    const s = read('screens/HomeScreen.tsx');
    const gate = s.slice(s.indexOf('const homeModalOpen ='), s.indexOf('const homeModalOpen =') + 400);
    const visibles = [...s.matchAll(/visible=\{([A-Za-z.]+)\}/g)].map((m) => m[1]);
    const missing = visibles.filter((v) => !gate.includes(v));
    assert.deepStrictEqual(missing, []);
  });
  // 2026-10-19 merge: the popups master added have comparison expressions
  // (stopConfirmMode !== null), which the identifier-only test above cannot see.
  test('homeModalOpen covers every Home popup, comparison expressions included (Stop / start error / override)', () => {
    const s = read('screens/HomeScreen.tsx').replace(/\r/g, '');
    const at = s.indexOf('const homeModalOpen =');
    const gate = s.slice(at, s.indexOf(';', at));
    for (const v of ['stopConfirmMode !== null', 'startErrorMessage !== null', 'showOverrideModal']) assert.ok(gate.includes(v), v);
    const visibles = [...s.matchAll(/<Modal[^>]*?visible=\{([^}]+)\}/g)].map((m) => m[1].trim());
    assert.ok(visibles.length >= 8, 'found the modals: ' + visibles.length);
    assert.deepStrictEqual(visibles.filter((v) => !gate.includes(v)), []);
  });
  // ── round 3c: Start sequence, last-moment veto, merges vs downloads ────
  const RR = () => load('services/raceReadyService');
  const FS = () => load('utils/followStorage');
  const posts = (suffix) => M.api.posted.filter((p) => p.url.endsWith(suffix));
  const SYNC = '/update_follower_favourites_api.php';

  test('race-ready: a popup/Start that appears while the checks run vetoes it — not used up', async () => {
    M.gps.background = false;
    let allowed = false;
    const svc = RR().raceReadyService;
    assert.strictEqual(await svc.maybeOpen({ raceKey: 13, source: 'home', stillAllowed: () => allowed }), false);
    assert.strictEqual(M.nav.navigations.length, 0);
    assert.strictEqual(await svc.wasShown('13'), false, 'not used up');
    allowed = true;
    assert.strictEqual(await svc.maybeOpen({ raceKey: 13, source: 'home', stillAllowed: () => allowed }), true);
  });
  test('Start tapped → Get race-ready is done for this race (never mid-Start)', async () => {
    const s = read('screens/HomeScreen.tsx');
    const fn = s.slice(s.indexOf('const confirmStartTracking'), s.indexOf('const confirmStartTracking') + 700);
    assert.ok(/raceReadyService\.markShown\(raceReadyKey\)/.test(fn));
    assert.ok(/stillAllowed: \(\) => !homeModalOpenRef\.current && navigation\.isFocused\(\)/.test(s));
    // behaviour: once marked, the Home trigger does nothing
    M.gps.background = false;
    const svc = RR().raceReadyService;
    await svc.markShown('13');
    assert.strictEqual(await svc.maybeOpen({ raceKey: 13, source: 'home' }), false);
  });
  test('merge then an older download lands → merged follows kept (pushed, not overwritten)', async () => {
    M.store.set('FOLLOWER_ID', '501');
    M.store.set('@PFSLive:followAdoptPending', '1');
    M.store.set('followed_users', JSON.stringify([300]));
    const fs_ = FS();
    const seq = fs_.getFollowWriteSeq();                         // download starts here
    await fs_.adoptServerFollowData({ followed_customers: [111], followed_bibs: {} });
    await fs_.syncFollowDataFromAPI([111], {}, seq);              // pre-merge server list lands
    assert.deepStrictEqual((await fs_.getFollowedUsers()).sort(), [111, 300]);
  });
  test('unfollow before the merge, then follow the same person again → kept', async () => {
    M.store.set('followed_users', JSON.stringify([111]));
    M.fapi.guestFail = true;
    await FS().unfollowUser(111);
    await FS().followUser(111);
    M.fapi.guestFail = false;
    M.fapi.byDevice = { follower_id: 501, followed_customers: [111], followed_bibs: {} };
    await FS().followUser(400);
    assert.deepStrictEqual(posts(SYNC).pop().body.customer_app_id_string.split(',').sort(), ['111', '400']);
  });
  test('share button: ids as strings — "0" hidden, real ids shown', () => {
    const { ShareTrackingLink } = load('components/Home/ShareTrackingLink');
    assert.strictEqual(ShareTrackingLink({ productAppId: '13', povId: '0', bib: '7', raceName: 'R' }), null);
    assert.strictEqual(ShareTrackingLink({ productAppId: '0', povId: '5', bib: '7', raceName: 'R' }), null);
    assert.notStrictEqual(ShareTrackingLink({ productAppId: '13', povId: '5', bib: '7', raceName: 'R' }), null);
  });
  test('distance highlight matches when the API sends the id as a string', () => {
    const s = read('screens/EventDetails/DistanceTab.tsx');
    assert.strictEqual((s.match(/Number\(d\.product_option_value_app_id\) === preselect_pov_id/g) || []).length, 2);
    assert.ok(/preselect_pov_id === Number\(item\.product_option_value_app_id\)/.test(s));
  });
  test('event link is exactly livio://event (livio://events… is not it)', () => {
    const s = read('../App.tsx');
    assert.ok(s.includes('if (url && /^livio:\\/\\/event(\\?|$)/.test(url))'), 'exact-match regex present');
    const re = /^livio:\/\/event(\?|$)/;
    assert.ok(re.test('livio://event?product_app_id=1'));
    assert.ok(re.test('livio://event'));
    assert.ok(!re.test('livio://events?product_app_id=1'));
  });
  test('ask again while a token is already registered → no second server registration', async () => {
    M.notif.status = 'granted';
    const np = NP();
    await np.registerIfGranted();
    await np.request();
    assert.strictEqual(M.fapi.registerCalls.length, 1);
  });
  test('readiness: report A in flight, state changes to B → B is reported too', async () => {
    const { readinessService } = load('services/readinessService');
    M.storeDelay = 3;
    const a = readinessService.getState();                       // A: notifications off
    await new Promise((r) => setTimeout(r, 1));
    M.notif.status = 'granted';
    const b = readinessService.getState();                       // B: notifications on
    await Promise.all([a, b]);
    await new Promise((r) => setTimeout(r, 40));
    M.storeDelay = 0;
    const sent = posts('/update_device_readiness_api.php').map((p) => p.body.notifications_enabled);
    assert.ok(sent.includes(0) && sent.includes(1), JSON.stringify(sent));
  });
  // ── runners-only readiness ───────────────────────────────────────────
  test('readiness: logged out (fan) → nothing sent; after login → reported', async () => {
    const { readinessService } = load('services/readinessService');
    M.loggedIn = false;
    await readinessService.getState();
    await new Promise((r) => setTimeout(r, 10));
    assert.strictEqual(posts('/update_device_readiness_api.php').length, 0, 'no call without a login');
    assert.strictEqual(M.store.has('@PFSLive:readinessReported'), false, 'nothing remembered');
    M.loggedIn = true;
    await readinessService.getState();
    await new Promise((r) => setTimeout(r, 10));
    assert.strictEqual(posts('/update_device_readiness_api.php').length, 1, 'reported once logged in');
  });
};
