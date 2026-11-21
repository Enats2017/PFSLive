// Cases added by the SIXTH audit round (2026-10-14). Registered by app.test.js.
const assert = require('assert');

module.exports = function register({ M, load, test }) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const READY = '/update_device_readiness_api.php';
  const SYNC = '/update_follower_favourites_api.php';
  const posts = (suffix) => M.api.posted.filter((p) => p.url.endsWith(suffix) && !p.rejected);
  const FS = () => load('utils/followStorage');
  const AS = () => require('module')._load('@react-native-async-storage/async-storage').default;

  // ── follow screen opening while a download is being saved ─────────────
  // The gap is a few ms wide — try every moment across the save.
  for (const w of [5, 6, 7, 8, 9, 10, 11, 12, 13]) {
    test(`screen opens (clearCache) ${w} ms into a download save → server bibs kept + pushed`, async () => {
      M.store.set('FOLLOWER_ID', '501');
      M.store.set('followed_bibs_by_product', JSON.stringify({ 13: ['1'] }));
      M.storeDelay = 3;
      const fs_ = FS();
      const dl = fs_.syncFollowDataFromAPI([], { 13: ['1', '2'] });
      await wait(w);
      fs_.clearCache();                              // a follow screen mounting
      const rd = fs_.getFollowedBibs(13);            // its first read
      await Promise.all([dl, rd]);
      await fs_.followBib(14, '7');
      M.storeDelay = 0;
      const body = posts(SYNC).pop().body;
      assert.strictEqual(body.bib_number_string['13'], '1,2', JSON.stringify(body.bib_number_string));
      assert.strictEqual(body.bib_number_string['14'], '7');
    });
  }
  test('same for the athlete list', async () => {
    M.store.set('FOLLOWER_ID', '501');
    M.store.set('followed_users', JSON.stringify([1]));
    M.storeDelay = 3;
    const fs_ = FS();
    const dl = fs_.syncFollowDataFromAPI([1, 2], {});
    await wait(8);
    fs_.clearCache();
    await fs_.getFollowedUsers();
    await dl;
    await fs_.followUser(9);
    M.storeDelay = 0;
    assert.deepStrictEqual(posts(SYNC).pop().body.customer_app_id_string.split(',').map(Number).sort((a, b) => a - b), [1, 2, 9]);
  });
  test('unfollow while a download is in flight → the unfollow wins', async () => {
    M.store.set('FOLLOWER_ID', '501');
    M.store.set('followed_users', JSON.stringify([1, 2]));
    M.fapi.byDevice = { follower_id: 501, followed_customers: [1, 2], followed_bibs: {} };
    M.fapi.byDeviceDelay = 30;
    const fs_ = FS();
    const restoring = fs_.restoreFollowsWithoutToken();
    await wait(5);
    await fs_.unfollowUser(2);
    await restoring;
    assert.deepStrictEqual(await fs_.getFollowedUsers(), [1]);
    assert.strictEqual(posts(SYNC).pop().body.customer_app_id_string, '1');
  });
  test('repeated clearCache() during reads → settles, reads stay bounded, value correct', async () => {
    M.store.set('followed_users', JSON.stringify([4]));
    M.storeDelay = 2;
    let reads = 0;
    const as = AS(); const orig = as.getItem;
    as.getItem = async (k) => { if (k === 'followed_users') reads++; return orig(k); };
    try {
      const fs_ = FS();
      const p = fs_.getFollowedUsers();
      for (let i = 0; i < 5; i++) { await wait(1); fs_.clearCache(); }
      assert.deepStrictEqual(await p, [4]);
      assert.ok(reads <= 7, `reads ${reads}`);
    } finally { as.getItem = orig; M.storeDelay = 0; }
  });

  // ── merge: id changes at the very end ─────────────────────────────────
  test('follower id changes right after the merge re-checked it → no push over the new row, merge still owed', async () => {
    M.store.set('FOLLOWER_ID', '501');
    M.store.set('@PFSLive:followAdoptPending', '1');
    M.store.set('followed_users', JSON.stringify([5]));
    M.storeDelay = 2;
    const as = AS(); const orig = as.getItem; let n = 0;
    // 2nd read of FOLLOWER_ID is the merge's "idNow": change the id right after it
    as.getItem = async (k) => {
      const v = await orig(k);
      if (k === 'FOLLOWER_ID' && ++n === 2) { M.store.set('@PFSLive:followAdoptPending', '1'); M.store.set('FOLLOWER_ID', '777'); }
      return v;
    };
    try {
      await FS().adoptServerFollowData({ followed_customers: [111], followed_bibs: {} });
    } finally { as.getItem = orig; M.storeDelay = 0; }
    assert.strictEqual(posts(SYNC).length, 0, 'nothing pushed over row 777');
    assert.strictEqual(M.store.get('@PFSLive:followAdoptPending'), '1', 'merge with 777 still owed');
  });
  test('restore with a merge owed and the server saying "no row" → phone follows pushed', async () => {
    M.store.set('FOLLOWER_ID', '501');
    M.store.set('@PFSLive:followAdoptPending', '1');
    M.store.set('followed_users', JSON.stringify([5, 6]));
    await FS().restoreFollowsWithoutToken();     // byDevice null → follower_not_found
    assert.deepStrictEqual(posts(SYNC).pop().body.customer_app_id_string.split(',').sort(), ['5', '6']);
    assert.strictEqual(M.store.has('@PFSLive:followAdoptPending'), false);
  });

  // ── screens (sixth audit) ─────────────────────────────────────────────
  test('Home race-ready trigger re-runs when Home gets focus back (cold start from a push tap)', () => {
    const s = require('fs').readFileSync(require('path').resolve(require('./harness').SRC, 'screens/HomeScreen.tsx'), 'utf8');
    assert.ok(/const homeIsFocused = useIsFocused\(\);/.test(s));
    assert.ok(/raceMoreThan3hAway && !homeModalOpen && homeIsFocused\)/.test(s));
    assert.ok(/homeModalOpen, homeIsFocused, raceReadyKey/.test(s), 'focus is a dependency');
    assert.ok(/stillAllowed: \(\) => !homeModalOpenRef\.current && navigation\.isFocused\(\)/.test(s), 'last-moment check unchanged');
  });
  test('countdown: before the gun "starting soon"; after the gun "race started" (en/fr/nl)', () => {
    const { PreRaceCountdown } = load('components/Home/PreRaceCountdown');
    const { textOf } = require('./harness');
    assert.strictEqual(textOf(PreRaceCountdown({ startAtMs: M.clock + 30000 })), 'readiness:countdown.startingSoon');
    assert.strictEqual(textOf(PreRaceCountdown({ startAtMs: M.clock - 1000 })), 'readiness:countdown.started');
    assert.strictEqual(textOf(PreRaceCountdown({ startAtMs: M.clock - 29 * 60000 })), 'readiness:countdown.started');
    assert.strictEqual(PreRaceCountdown({ startAtMs: M.clock - 31 * 60000 }), null);
    for (const l of ['en', 'fr', 'nl']) {
      const j = JSON.parse(require('fs').readFileSync(require('path').resolve(require('./harness').SRC, `i18n/Readiness/${l}.json`), 'utf8'));
      assert.ok(j.countdown.started && j.countdown.started !== j.countdown.startingSoon, l);
    }
  });

  // ── readiness codes ───────────────────────────────────────────────────
  test('readiness location_permission_invalid → sent once; unknown_error → retried', async () => {
    const rs = load('services/readinessService').readinessService;
    M.api.failWith = { type: 'empty', code: 'location_permission_invalid' };
    await rs.getState(); await wait(5);
    await rs.getState(); await wait(5);
    assert.strictEqual(M.api.posted.filter((p) => p.url.endsWith(READY)).length, 1, 'invalid: once');
    M.notif.status = 'granted';                  // new state → new attempt
    M.api.failWith = { type: 'empty', code: 'unknown_error' };
    await rs.getState(); await wait(5);
    await rs.getState(); await wait(5);
    assert.strictEqual(M.api.posted.filter((p) => p.url.endsWith(READY)).length, 3, 'unknown_error: retried');
  });
};
