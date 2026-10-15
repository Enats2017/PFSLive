// Cases added by the SECOND code audit (2026-10-14) — one per verified
// finding, plus the gaps it listed. Registered by app.test.js.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

module.exports = function register({ M, load, test, SRC }) {
  const read = (p) => fs.readFileSync(path.resolve(SRC, p), 'utf8');
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const posts = (suffix) => M.api.posted.filter((p) => p.url.endsWith(suffix));
  const SYNC = '/update_follower_favourites_api.php';
  const FS = () => load('utils/followStorage');
  const NP = () => load('services/notificationPermissionService').notificationPermissionService;

  // ── first id learned by registering a push token ─────────────────────
  test('1.0.9 user with phone-only follows allows notifications → follows NOT wiped by the download', async () => {
    M.store.set('followed_users', JSON.stringify([42]));          // no FOLLOWER_ID: 1.0.9 refused push
    await NP().request();                                         // grant → registerFollower → id 501
    await new Promise((r) => setTimeout(r, 30));           // registration runs in the background now
    assert.strictEqual(M.store.get('@PFSLive:followAdoptPending'), '1', 'merge owed');
    await FS().syncFollowDataFromAPI([], {});                     // Home's token-path download (empty row)
    assert.deepStrictEqual(await FS().getFollowedUsers(), [42]);
    assert.strictEqual(posts(SYNC).pop().body.customer_app_id_string, '42');
  });
  test('phone that already had an id registers a new token → no merge flag (normal download)', async () => {
    M.store.set('FOLLOWER_ID', '501');
    await NP().request();
    assert.strictEqual(M.store.has('@PFSLive:followAdoptPending'), false);
  });
  test('download with merge owed + unfollow made before it → merged, unfollow kept, flag cleared', async () => {
    M.store.set('FOLLOWER_ID', '501');
    M.store.set('@PFSLive:followAdoptPending', '1');
    M.store.set('@PFSLive:followRemovedBeforeAdopt', JSON.stringify({ customers: [111], bibs: {} }));
    M.store.set('followed_users', JSON.stringify([300]));
    await FS().syncFollowDataFromAPI([111, 222], {});
    assert.deepStrictEqual((await FS().getFollowedUsers()).sort(), [222, 300]);
    assert.strictEqual(M.store.has('@PFSLive:followAdoptPending'), false);
  });
  test('Android reinstall: silent token registration, server unreachable, then a follow → server list not overwritten', async () => {
    M.notif.status = 'granted';
    await NP().registerIfGranted();                               // learns id 501 through the token
    M.fapi.byDeviceTransient = true;
    await FS().followUser(300);
    assert.strictEqual(posts(SYNC).length, 0, 'held back');
    M.fapi.byDeviceTransient = false;
    M.fapi.byDevice = { follower_id: 501, followed_customers: [111], followed_bibs: {} };
    await FS().followUser(301);
    assert.deepStrictEqual(posts(SYNC).pop().body.customer_app_id_string.split(',').sort(), ['111', '300', '301']);
  });

  // ── interleavings (slow storage) ──────────────────────────────────────
  test('download lands while a follow is being saved → the follow survives (phone + server)', async () => {
    M.store.set('FOLLOWER_ID', '501');
    M.storeDelay = 5;
    const fs_ = FS();
    const seq = fs_.getFollowWriteSeq();
    const dl = fs_.syncFollowDataFromAPI([], {}, seq);
    const fol = fs_.followUser(300);
    await Promise.all([dl, fol]);
    M.storeDelay = 0;
    assert.deepStrictEqual(await fs_.getFollowedUsers(), [300]);
    assert.strictEqual(posts(SYNC).pop().body.customer_app_id_string, '300');
  });
  test('fan-email screen wins the id race against a follow → the follow still merges first', async () => {
    M.fapi.guestDelay = 20;
    M.fapi.byDevice = { follower_id: 501, followed_customers: [111], followed_bibs: {} };
    const fs_ = FS();
    await Promise.all([fs_.ensureFollowerId(), fs_.followUser(300)]);
    const first = posts(SYNC)[0];
    assert.ok(first, 'pushed');
    assert.deepStrictEqual(first.body.customer_app_id_string.split(',').sort(), ['111', '300']);
  });
  test('merge flag is written BEFORE the follower id (crash-safe ordering)', async () => {
    await FS().ensureFollowerId();
    const w = M.writes;
    assert.ok(w.indexOf('@PFSLive:followAdoptPending') > -1 && w.indexOf('@PFSLive:followAdoptPending') < w.indexOf('FOLLOWER_ID'), w.join(' → '));
  });
  test('restore learning the id from the server also flags first', async () => {
    M.fapi.byDevice = { follower_id: 888, followed_customers: [], followed_bibs: {} };
    await FS().restoreFollowsWithoutToken();
    const w = M.writes;
    assert.ok(w.indexOf('@PFSLive:followAdoptPending') < w.indexOf('FOLLOWER_ID'), w.join(' → '));
  });
  test('storage cannot clear the merge flag → no endless merge/sync loop', async () => {
    M.multiRemoveFail = true;
    M.storeDelay = 1; // each storage call yields, so the 20 s cap can fire on a loop
    M.fapi.byDevice = { follower_id: 501, followed_customers: [1], followed_bibs: {} };
    await FS().followUser(300);
    assert.ok(M.fapi.byDeviceCalls <= 2, `bounded (${M.fapi.byDeviceCalls} downloads)`);
    assert.ok(posts(SYNC).length >= 1, 'still pushed');
  });

  // ── token fetch + links ───────────────────────────────────────────────
  test('hung push-token fetch is capped (timeout) and the slot is freed', () => {
    const s = read('services/notificationPermissionService.ts');
    assert.ok(/TOKEN_FETCH_TIMEOUT_MS = 20000/.test(s));
    assert.ok(/Promise\.race\(\[\s*Notifications\.getExpoPushTokenAsync/.test(s));
    assert.ok(/finally \{\s*fetchInFlight = null;/.test(s));
  });
  test('same link twice within 2 s (iOS cold start) → handled once; later or different → handled', () => {
    const { isRepeatLink } = load('utils/deepLink');
    assert.strictEqual(isRepeatLink('livio://event?product_app_id=1'), false);
    assert.strictEqual(isRepeatLink('livio://event?product_app_id=1'), true);
    assert.strictEqual(isRepeatLink('livio://event?product_app_id=2'), false);
    M.clock += 2500;
    assert.strictEqual(isRepeatLink('livio://event?product_app_id=2'), false);
  });
  test('App.tsx drops a repeated link before navigating', () => {
    const s = read('../App.tsx');
    assert.ok(s.indexOf('isRepeatLink(url)') > -1 && s.indexOf('isRepeatLink(url)') < s.indexOf("url?.startsWith('livio://registration-confirmed')"));
  });
  // ── race-ready screen (second audit) ─────────────────────────────────
  const RR = () => load('services/raceReadyService');
  test('finish screen: a skipped step fixed in Settings counts as done', () => {
    const { raceReadyOutcome } = RR();
    assert.strictEqual(raceReadyOutcome(new Set(['notifications']), []), 'done');
    assert.strictEqual(raceReadyOutcome(new Set(['notifications']), ['notifications']), 'skipped');
    assert.strictEqual(raceReadyOutcome(new Set(), ['battery']), 'done', 'nothing skipped');
  });
  test('screen uses the outcome helper for title, icon and analytics', () => {
    const s = read('screens/RaceReadyScreen.tsx');
    assert.ok(!/skipped\.size > 0/.test(s), 'no raw skipped.size checks left');
    assert.ok((s.match(/raceReadyOutcome\(/g) || []).length >= 2);
  });
  test('background step: Android "won\'t ask again" → Settings on the FIRST tap; iOS asks', () => {
    const { backgroundOpensSettings } = RR();
    assert.strictEqual(backgroundOpensSettings('android', false, false), true);
    assert.strictEqual(backgroundOpensSettings('android', true, false), false);
    assert.strictEqual(backgroundOpensSettings('ios', false, false), false, 'iOS upgrade prompt may still show');
    assert.strictEqual(backgroundOpensSettings('ios', true, true), true, 'after a no-dialog round trip');
  });
  test('iOS "location off" step explains where the switch is (en/fr/nl)', () => {
    const s = read('screens/RaceReadyScreen.tsx');
    assert.ok(/Platform\.OS === 'ios' && current === 'locationServices'/.test(s) && /home:gpsHealth\.stepsLocationOffIos/.test(s));
    for (const l of ['en', 'fr', 'nl']) {
      const j = JSON.parse(read(`i18n/HomeScreen/${l}.json`));
      assert.ok(j.gpsHealth && j.gpsHealth.stepsLocationOffIos, l);
    }
  });
  test('two races marked "shown" at the same moment → both remembered', async () => {
    M.storeDelay = 5;
    const svc = RR().raceReadyService;
    await Promise.all([svc.markShown('13'), svc.markShown('custom_13')]);
    M.storeDelay = 0;
    assert.strictEqual(await svc.wasShown('13'), true);
    assert.strictEqual(await svc.wasShown('custom_13'), true);
  });
  test('race id 0 / "0" (server default) → never opens', async () => {
    M.gps.background = false;
    const svc = RR().raceReadyService;
    assert.strictEqual(await svc.maybeOpen({ raceKey: 0, source: 'home' }), false);
    assert.strictEqual(await svc.maybeOpen({ raceKey: '0', source: 'home' }), false);
    assert.strictEqual(M.nav.navigations.length, 0);
  });
  test('partner race 123 and custom event 123 are separate races', async () => {
    M.gps.background = false;
    const svc = RR().raceReadyService;
    assert.strictEqual(await svc.maybeOpen({ raceKey: 123, source: 'connect' }), true);
    assert.strictEqual(await svc.maybeOpen({ raceKey: 'custom_123', source: 'custom_event' }), true);
  });
  test('readiness: location-services read failing → not reported as off', async () => {
    M.notif.status = 'granted'; M.gps.servicesThrows = true;
    const s = await load('services/readinessService').readinessService.getState();
    assert.ok(!s.missing.includes('locationServices'));
    assert.strictEqual(s.locationServicesOn, true);
  });
};
