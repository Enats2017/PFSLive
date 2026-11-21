// Cases added by the FIFTH audit round (2026-10-14). Registered by app.test.js.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

module.exports = function register({ M, load, test, SRC }) {
  const read = (p) => fs.readFileSync(path.resolve(SRC, p), 'utf8');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const READY = '/update_device_readiness_api.php';
  const SYNC = '/update_follower_favourites_api.php';
  const posts = (suffix) => M.api.posted.filter((p) => p.url.endsWith(suffix) && !p.rejected);
  const FS = () => load('utils/followStorage');
  const RS = () => load('services/readinessService').readinessService;

  // ── stale storage read must not overwrite a newer list ────────────────
  test('download lands while an older storage read is in flight → server follows kept', async () => {
    M.store.set('FOLLOWER_ID', '501');
    M.store.set('followed_users', JSON.stringify([1]));
    M.storeDelay = 3;
    const fs_ = FS();
    const dl = fs_.syncFollowDataFromAPI([1, 2, 3], {});       // swaps in the server list
    await wait(4);
    const rd = fs_.isUserFollowed(2);                            // cold read, started later, lands later
    await Promise.all([dl, rd]);
    await fs_.followUser(9);
    M.storeDelay = 0;
    assert.deepStrictEqual((await fs_.getFollowedUsers()).sort((a, b) => a - b), [1, 2, 3, 9]);
    assert.deepStrictEqual(posts(SYNC).pop().body.customer_app_id_string.split(',').map(Number).sort((a, b) => a - b), [1, 2, 3, 9]);
  });
  test('clearCache() while a read is in flight → that read can\'t land; follows intact', async () => {
    M.store.set('FOLLOWER_ID', '501');
    M.store.set('followed_users', JSON.stringify([1]));
    M.storeDelay = 3;
    const fs_ = FS();
    const rd = fs_.getFollowedUsers();                            // read in flight
    fs_.clearCache();                                             // e.g. a screen mounting
    await fs_.followUser(9);
    await rd;
    M.storeDelay = 0;
    assert.deepStrictEqual((await fs_.getFollowedUsers()).sort((a, b) => a - b), [1, 9]);
  });
  test('bib list: same protection', async () => {
    M.store.set('FOLLOWER_ID', '501');
    M.store.set('followed_bibs_by_product', JSON.stringify({ 13: ['1'] }));
    M.storeDelay = 3;
    const fs_ = FS();
    const dl = fs_.syncFollowDataFromAPI([], { 13: ['1', '2'] });
    await wait(4);
    const rd = fs_.isBibFollowed(13, '2');
    await Promise.all([dl, rd]);
    M.storeDelay = 0;
    assert.deepStrictEqual((await fs_.getFollowedBibs(13)).sort(), ['1', '2']);
  });

  // ── readiness: temporary vs permanent ─────────────────────────────────
  for (const [label, err] of [
    ['404 (endpoint not deployed yet)', { type: 'empty', code: 'not_found' }],
    ['429 (rate limited at a busy race)', { type: 'empty', code: 'rate_limited' }],
    ['maintenance', { type: 'empty', code: 'maintenance' }],
  ]) {
    test(`readiness ${label} → temporary: re-sent on the next refresh`, async () => {
      M.api.failWith = err;
      const rs = RS();
      await rs.getState(); await wait(5);
      M.api.failWith = null;
      await rs.getState(); await wait(5);
      assert.strictEqual(posts(READY).length, 1, 'delivered on the retry');
    });
  }
  test('readiness rejected as invalid (device_id_invalid) → sent once, not on every refresh', async () => {
    M.api.failWith = { type: 'empty', code: 'device_id_invalid' };
    const rs = RS();
    for (let i = 0; i < 3; i++) { await rs.getState(); await wait(5); }
    assert.strictEqual(M.api.posted.filter((p) => p.url.endsWith(READY)).length, 1);
  });

  // ── merge for a changed follower id ───────────────────────────────────
  test('follower id changes while a merge runs → that new merge stays owed, nothing pushed over it', async () => {
    M.store.set('FOLLOWER_ID', '501');
    M.store.set('@PFSLive:followAdoptPending', '1');
    M.store.set('followed_users', JSON.stringify([5]));
    M.fapi.byDevice = { follower_id: 501, followed_customers: [111], followed_bibs: {} };
    M.fapi.byDeviceDelay = 20;
    const fs_ = FS();
    const merging = fs_.adoptServerFollowData();
    await wait(5);
    M.store.set('FOLLOWER_ID', '777');                      // token registration hands a new id
    M.store.set('@PFSLive:followAdoptPending', '1');
    await merging;
    assert.strictEqual(M.store.get('@PFSLive:followAdoptPending'), '1', 'merge with 777 still owed');
    assert.strictEqual(posts(SYNC).length, 0, 'old-row merge not pushed over row 777');
  });

  // ── start funnel ──────────────────────────────────────────────────────
  test('return-from-Settings start steps read the CURRENT race id (not the first-render null)', () => {
    const s = read('screens/HomeScreen.tsx');
    // audit23: the ref holds the race-ready key (custom_<id> for custom events).
    assert.ok(/const eventIdRef = useRef\((eventId|raceReadyKey)\);\s*eventIdRef\.current = \1;/.test(s));
    assert.ok(/'granted_on_return', eventIdRef\.current\)/.test(s));
    assert.ok(/'still_blocked_on_return', eventIdRef\.current\)/.test(s));
  });
};
