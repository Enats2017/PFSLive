// Cases added in the TWENTIETH round — the known LOW items (2026-10-15).
// Registered by app.test.js.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

module.exports = function register({ M, load, test, SRC }) {
  const { CONFIG } = require('./harness');
  const read = (p) => fs.readFileSync(path.resolve(SRC, p), 'utf8');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const SYNC = '/update_follower_favourites_api.php';
  const ok = () => M.api.posted.filter((p) => p.url.endsWith(SYNC) && !p.rejected);
  const FS = () => load('utils/followStorage');
  const NP = () => load('services/notificationPermissionService').notificationPermissionService;
  const list = (p) => p.body.customer_app_id_string.split(',').filter(Boolean).map(Number).sort((a, b) => a - b);

  test('an unfollow that already reached the server does not block a LATER merge from adopting a web follow of that athlete', async () => {
    M.store.set('FOLLOWER_ID', '501');
    M.store.set('followed_users', JSON.stringify([7]));
    const fs_ = FS();
    await fs_.unfollowUser(7);                         // uploaded, server agrees
    // later: the web followed 7 again on the same row; a merge is owed
    M.store.set('@PFSLive:followAdoptPending', '1');
    M.fapi.byDevice = { follower_id: 501, followed_customers: [7], followed_bibs: {} };
    await fs_.followUser(1);
    assert.ok((await fs_.getFollowedUsers()).includes(7), 'web follow adopted');
    assert.deepStrictEqual(list(ok().pop()), [1, 7]);
  });

  test('a push registration that lands AFTER the time limit is remembered (no second POST next foreground)', async () => {
    const saved = CONFIG.API_CONFIG.TIMEOUT;
    CONFIG.API_CONFIG.TIMEOUT = 50;                    // limit = TIMEOUT + 5 s
    try {
      M.notif.status = 'granted';
      M.fapi.registerDelay = 5300;                     // lands ~250 ms after the limit
      const np = NP();
      assert.strictEqual(await np.registerIfGranted(), null, 'timed out');
      await wait(500);                                 // the late POST lands
      M.fapi.registerDelay = 0;
      await np.registerIfGranted();                    // next foreground
      assert.strictEqual(M.fapi.registerCalls.length, 1, `posts: ${M.fapi.registerCalls.length}`);
    } finally { CONFIG.API_CONFIG.TIMEOUT = saved; }
  });

  test('countdown uses the absolute start (cache-proof); the server clock only when the phone clock is > 10 min off', () => {
    const { startMsFromServer } = load('components/Home/PreRaceCountdown');
    const now = 1_760_000_000_000;
    // phone clock right, server "now" 45 s stale (cache): absolute start
    assert.strictEqual(startMsFromServer(1_760_003_600, 1_759_999_955, now), 1_760_003_600_000);
    // phone clock 1 h fast: server-anchored
    assert.strictEqual(startMsFromServer(1_760_003_600, 1_760_000_000, now + 3_600_000), now + 3_600_000 + 3_600_000);
  });
  test('placeholder start times (00:00 / 00:01) show no countdown', () => {
    const s = read('screens/HomeScreen.tsx');
    assert.ok(s.includes("/^00:0[01](:00)?$/.test(String(homeData?.next_race_time ?? '').trim()) ? null :"));
  });
};
