// Cases added after the code audit of 2026-10-14 — one block per finding,
// plus coverage gaps the audit listed. Registered by app.test.js.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

module.exports = function register({ M, load, test, SRC }) {
  const read = (p) => fs.readFileSync(path.resolve(SRC, p), 'utf8');
  const flush = () => new Promise((r) => setImmediate(r));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const posts = (suffix) => M.api.posted.filter((p) => p.url.endsWith(suffix));
  const SYNC = '/update_follower_favourites_api.php';
  const FS = () => load('utils/followStorage');
  const RR = () => load('services/raceReadyService');
  const NP = () => load('services/notificationPermissionService').notificationPermissionService;
  const DL = () => load('utils/deepLink');

  // ── deep links ────────────────────────────────────────────────────────
  test('link parsing: "+" is a space, %2B stays "+", "=" inside a value kept', () => {
    const q = DL().parseQuery('livio://event?event_name=Ghent+10K%2B&note=a=b&x');
    assert.strictEqual(q.event_name, 'Ghent 10K+');
    assert.strictEqual(q.note, 'a=b');
    assert.strictEqual(q.x, '');
  });
  test('link parsing: broken %-escape does not crash', () => {
    assert.strictEqual(DL().parseQuery('livio://event?event_name=100%25%E0%A4%A').event_name, '100%25%E0%A4%A'.replace(/\+/g, ' '));
  });
  test('event link: distance 0 / text / negative → no preselect; no event → null', () => {
    const { parseEventLink } = DL();
    assert.deepStrictEqual(parseEventLink('livio://event?product_app_id=13&event_name=Trail&pov=55'),
      { product_app_id: 13, event_name: 'Trail', preselect_pov_id: 55 });
    for (const pov of ['0', 'abc', '-3', '']) assert.strictEqual(parseEventLink(`livio://event?product_app_id=13&pov=${pov}`).preselect_pov_id, null, pov);
    assert.strictEqual(parseEventLink('livio://event?event_name=x'), null);
    assert.strictEqual(parseEventLink('livio://event?product_app_id=abc'), null);
  });
  test('cold start: link waits for the navigator, then navigates once', async () => {
    M.nav.ready = false;
    let calls = 0;
    DL().whenNavigatorReady(() => { calls++; });
    await sleep(250);
    assert.strictEqual(calls, 0, 'not before ready');
    M.nav.ready = true;
    await sleep(250);
    assert.strictEqual(calls, 1);
  });
  test('cold start: navigator never ready → gives up quietly', async () => {
    M.nav.ready = false;
    let calls = 0;
    DL().whenNavigatorReady(() => { calls++; }, 300);
    await sleep(500); M.nav.ready = true; await sleep(200);
    assert.strictEqual(calls, 0);
  });
  test('App.tsx: both email links go through the ready-wait and the shared parser', () => {
    const s = read('../App.tsx');
    assert.strictEqual((s.match(/whenNavigatorReady\(/g) || []).length, 2);
    assert.ok(!/p\.split\('='\)/.test(s), 'old inline parser gone');
  });

  // ── Get race-ready guards ─────────────────────────────────────────────
  test('race-ready: two triggers at the same moment → opened once', async () => {
    M.gps.background = false;
    const svc = RR().raceReadyService;
    const r = await Promise.all([svc.maybeOpen({ raceKey: 13, source: 'home' }), svc.maybeOpen({ raceKey: 13, source: 'connect' })]);
    assert.deepStrictEqual(r.filter(Boolean).length, 1);
    assert.strictEqual(M.nav.navigations.length, 1);
    assert.strictEqual(M.analytics.filter((a) => a[0] === 'logRaceReadyStep' && a[1] === 'shown').length, 1);
  });
  test('race-ready: phone is tracking → not opened, not used up', async () => {
    M.gps.background = false; M.tracking = true;
    assert.strictEqual(await RR().raceReadyService.maybeOpen({ raceKey: 13, source: 'home' }), false);
    M.tracking = false;
    assert.strictEqual(await RR().raceReadyService.maybeOpen({ raceKey: 13, source: 'home' }), true);
  });
  test('race-ready: already on the race-ready screen → not pushed again', async () => {
    M.gps.background = false; M.nav.route = 'RaceReady';
    assert.strictEqual(await RR().raceReadyService.maybeOpen({ raceKey: 14, source: 'connect' }), false);
  });
  test('step counter: background appearing later never repeats "2 of 2"', () => {
    const { stepProgress } = RR();
    const seen = new Set();
    const at = (remaining) => { if (remaining[0]) seen.add(remaining[0]); return stepProgress(seen, remaining); };
    assert.deepStrictEqual(at(['notifications', 'location']), { index: 1, total: 2 });
    assert.deepStrictEqual(at(['location']), { index: 2, total: 2 });
    assert.deepStrictEqual(at(['background']), { index: 3, total: 3 }, 'location granted → background shows as step 3');
  });
  test('step counter: skipped steps count as done; empty → 1 of 1', () => {
    const { stepProgress } = RR();
    assert.deepStrictEqual(stepProgress(new Set(['notifications', 'battery']), ['battery']), { index: 2, total: 2 });
    assert.deepStrictEqual(stepProgress(new Set(), []), { index: 1, total: 1 });
  });
  test('custom events: create screen + Home use the same key custom_<id>', () => {
    const create = read('screens/PersonalEventScreen/CreatePersonalEvent.tsx');
    const home = read('screens/HomeScreen.tsx');
    assert.ok(/product_custom_app_id/.test(create) && /`custom_\$\{createdId\}`/.test(create));
    assert.ok(/event_source === 'custom' \? `custom_\$\{eventId\}` : eventId/.test(home));
    assert.ok(!/createdName\}`/.test(create), 'no longer keyed on the event name');
  });
  test('every race-ready trigger is screen-guarded', () => {
    assert.ok(/onlyFromRoute: 'EventDetails'/.test(read('screens/EventDetails/DistanceTab.tsx')));
    assert.ok(/onlyFromRoute: 'OwnProfile'/.test(read('screens/PersonalEventScreen/CreatePersonalEvent.tsx')));
    assert.ok(/onlyFromRoute: 'HomeScreen'/.test(read('screens/HomeScreen.tsx')));
    assert.ok(/onlyFromRoute: 'EventDetails'/.test(read('../App.tsx')));
  });

  // ── push token ────────────────────────────────────────────────────────
  test('grant: app returning to foreground mid-prompt → ONE token fetch, ONE registration', async () => {
    M.notif.onRequest = () => setImmediate(() => M.appStateListeners.forEach((cb) => cb('active')));
    await NP().request();
    await sleep(30);
    assert.strictEqual(M.notif.tokenFetches, 1);
    assert.deepStrictEqual(M.fapi.registerCalls, ['ExponentPushToken[abc]']);
  });
  test('server registration fails → retried on the next foreground', async () => {
    M.notif.status = 'granted'; M.fapi.registerFail = true;
    const np = NP();
    assert.strictEqual(await np.registerIfGranted(), null);
    assert.strictEqual(np.getCurrentToken(), null, 'not remembered');
    M.fapi.registerFail = false;
    assert.strictEqual(await np.registerIfGranted(), 'ExponentPushToken[abc]');
    assert.strictEqual(M.fapi.registerCalls.length, 2);
  });
  test('switched off then on again (same token) → listeners get it back, server not called twice', async () => {
    M.notif.status = 'granted';
    const heard = []; const np = NP(); np.onTokenChange((t) => heard.push(t));
    await np.registerIfGranted();
    M.notif.status = 'denied'; await np.registerIfGranted();
    M.notif.status = 'granted'; await np.registerIfGranted();
    assert.deepStrictEqual(heard, ['ExponentPushToken[abc]', null, 'ExponentPushToken[abc]']);
    assert.strictEqual(M.fapi.registerCalls.length, 1);
  });
  test('Home: a token the server doesn\'t know falls back to the device restore', () => {
    const s = read('screens/HomeScreen.tsx');
    const block = s.slice(s.indexOf('const syncFromServer'), s.indexOf('syncFromServer();'));
    assert.ok(/getFollowWriteSeq\(\)/.test(block) && /catch \{/.test(block) && /restoreFollowsWithoutToken\(\)/.test(block));
  });

  // ── follows: never lose the server's list ─────────────────────────────
  test('reinstall + server unreachable → nothing pushed, nothing created', async () => {
    M.store.set('followed_users', JSON.stringify([42])); M.fapi.byDeviceTransient = true;
    await FS().restoreFollowsWithoutToken();
    assert.strictEqual(M.fapi.guestCalls, 0);
    assert.strictEqual(posts(SYNC).length, 0, 'server list not overwritten');
  });
  test('merge download fails → no push; next follow (online) merges the server list', async () => {
    M.fapi.byDeviceTransient = true;
    await FS().followUser(300);
    assert.strictEqual(posts(SYNC).length, 0, 'held back while the server list is unknown');
    assert.strictEqual(M.store.get('@PFSLive:followAdoptPending'), '1');
    M.fapi.byDeviceTransient = false;
    M.fapi.byDevice = { follower_id: 501, followed_customers: [111], followed_bibs: {} };
    await FS().followUser(301);
    const body = posts(SYNC).pop().body;
    assert.deepStrictEqual(body.customer_app_id_string.split(',').sort(), ['111', '300', '301']);
    assert.strictEqual(M.store.has('@PFSLive:followAdoptPending'), false);
  });
  test('id learned from the fan-email screen → next follow still merges the server list', async () => {
    await FS().ensureFollowerId();                    // what Fanemailservice / language do
    M.fapi.byDevice = { follower_id: 501, followed_customers: [111], followed_bibs: { 13: ['9'] } };
    await FS().followUser(300);
    const body = posts(SYNC).pop().body;
    assert.deepStrictEqual(body.customer_app_id_string.split(',').sort(), ['111', '300']);
    assert.deepStrictEqual(body.bib_number_string, { 13: '9' });
  });
  test('id learned elsewhere → launch restore merges instead of overwriting', async () => {
    M.store.set('followed_users', JSON.stringify([300]));
    await FS().ensureFollowerId();
    M.fapi.byDevice = { follower_id: 501, followed_customers: [111], followed_bibs: {} };
    await FS().restoreFollowsWithoutToken();
    assert.deepStrictEqual((await FS().getFollowedUsers()).sort(), [111, 300]);
  });
  test('stored id "null" (old install) → treated as no id, guest id created', async () => {
    M.store.set('FOLLOWER_ID', 'null');
    await FS().followUser(300);
    assert.strictEqual(M.fapi.guestCalls, 1);
    assert.strictEqual(posts(SYNC).pop().body.follower_id, 501);
  });
  test('unfollow before the merge is not undone by it', async () => {
    M.store.set('followed_users', JSON.stringify([111, 300]));
    M.fapi.guestFail = true;
    await FS().unfollowUser(111);                      // offline, no id yet
    M.fapi.guestFail = false;
    M.fapi.byDevice = { follower_id: 501, followed_customers: [111], followed_bibs: { 13: ['7', '8'] } };
    await FS().unfollowBib(13, '7').catch(() => {});   // not local — no-op
    await FS().followUser(400);
    const body = posts(SYNC).pop().body;
    assert.deepStrictEqual(body.customer_app_id_string.split(',').sort(), ['300', '400']);
  });
  test('bib unfollowed before the merge stays unfollowed', async () => {
    M.store.set('followed_bibs_by_product', JSON.stringify({ 13: ['7', '8'] }));
    M.fapi.guestFail = true;
    await FS().unfollowBib(13, '7');
    M.fapi.guestFail = false;
    M.fapi.byDevice = { follower_id: 501, followed_customers: [], followed_bibs: { 13: ['7', '8'] } };
    await FS().followUser(400);
    assert.deepStrictEqual(posts(SYNC).pop().body.bib_number_string, { 13: '8' });
  });
  test('download in flight + follow → the follow is kept (pushed, not overwritten)', async () => {
    M.store.set('FOLLOWER_ID', '501');
    M.fapi.byDevice = { follower_id: 501, followed_customers: [], followed_bibs: {} };
    M.fapi.byDeviceDelay = 40;
    const fs_ = FS();
    const restoring = fs_.restoreFollowsWithoutToken();
    await sleep(5);
    await fs_.followUser(300);                          // lands while the GET is in flight
    await restoring;
    assert.deepStrictEqual(await fs_.getFollowedUsers(), [300]);
    assert.strictEqual(posts(SYNC).pop().body.customer_app_id_string, '300');
  });
  test('merge: duplicate bibs collapsed, invalid race id dropped, phone-only bibs kept', async () => {
    M.store.set('followed_bibs_by_product', JSON.stringify({ 20: ['5'] }));
    M.fapi.byDevice = { follower_id: 501, followed_customers: [], followed_bibs: { 13: ['7', '7', ''], abc: ['1'] } };
    await FS().followUser(1);
    assert.deepStrictEqual(posts(SYNC).pop().body.bib_number_string, { 13: '7', 20: '5' });
  });

  // ── readiness report ──────────────────────────────────────────────────
  test('readiness: card + race-ready reading at once → ONE server report', async () => {
    const { readinessService } = load('services/readinessService');
    await Promise.all([readinessService.getState(), readinessService.getState()]);
    await flush(); await flush();
    assert.strictEqual(posts('/update_device_readiness_api.php').length, 1);
  });
  test('readiness: phone location switch comes first in the list', async () => {
    M.gps.servicesOn = false; M.gps.foreground = false;
    const s = await load('services/readinessService').readinessService.getState();
    assert.deepStrictEqual(s.missing.slice(0, 3), ['locationServices', 'notifications', 'location']);
  });

  // ── small gaps ────────────────────────────────────────────────────────
  test('start time: "HH:MM" race time and "T"-separated server time also work', () => {
    const { computeRaceStartMs } = load('components/Home/PreRaceCountdown');
    assert.strictEqual(computeRaceStartMs('2026-10-14', '10:00', '2026-10-14T09:00:00', 1), 1 + 3600000);
  });
  test('countdown: exactly 1 min → "starting", 24 h → "1 d 0 h", 29/31 min after gun', () => {
    const { PreRaceCountdown } = load('components/Home/PreRaceCountdown');
    const { textOf } = require('./harness');
    const at = (ms) => PreRaceCountdown({ startAtMs: M.clock + ms });
    assert.strictEqual(textOf(at(60000)), 'readiness:countdown.startingSoon');
    assert.ok(textOf(at(24 * 3600000 + 1000)).includes('countdown.days{\\"count\\":1} readiness:countdown.hours{\\"count\\":0}'));
    assert.notStrictEqual(at(-29 * 60000), null);
    assert.strictEqual(at(-31 * 60000), null);
  });
  test('share button: server defaults (bib "", distance 0) → hidden', () => {
    const { ShareTrackingLink } = load('components/Home/ShareTrackingLink');
    assert.strictEqual(ShareTrackingLink({ productAppId: 13, povId: 0, bib: '', raceName: 'R' }), null);
  });
};
