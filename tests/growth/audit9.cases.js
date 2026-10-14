// Cases added in the NINTH round (2026-10-14). Registered by app.test.js.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

module.exports = function register({ M, load, test, SRC }) {
  const { CONFIG } = require('./harness');
  const read = (p) => fs.readFileSync(path.resolve(SRC, p), 'utf8');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const SYNC = '/update_follower_favourites_api.php';
  const posts = () => M.api.posted.filter((p) => p.url.endsWith(SYNC) && !p.rejected);
  const FS = () => load('utils/followStorage');

  // ── follow upload queue ───────────────────────────────────────────────
  test('a HUNG upload (socket never answers) does not freeze later follows', async () => {
    const saved = CONFIG.API_CONFIG.TIMEOUT;
    CONFIG.API_CONFIG.TIMEOUT = 50;                      // job limit = TIMEOUT + 5 s
    try {
      M.store.set('FOLLOWER_ID', '501');
      M.api.syncScript = [{ delay: 1e9 }];               // first upload never settles
      const fs_ = FS();
      fs_.followUser(77);                                 // its upload hangs
      await wait(5);
      const t0 = Date.now();
      await fs_.followUser(88);                           // must still complete
      assert.ok(posts().some((p) => p.body.customer_app_id_string.split(',').sort().join(',') === '77,88'), 'later upload carried both');
      assert.ok(Date.now() - t0 < 8000, 'released by the job time limit');
    } finally { CONFIG.API_CONFIG.TIMEOUT = saved; }
  });
  test('taps queued behind a slow upload are merged into ONE more upload', async () => {
    M.store.set('FOLLOWER_ID', '501');
    M.api.syncScript = [{ delay: 40 }];
    const fs_ = FS();
    const first = fs_.followUser(1);
    await wait(5);
    await Promise.all([2, 3, 4, 5, 6].map((id) => fs_.followUser(id)));
    await first;
    assert.strictEqual(posts().length, 2, `uploads: ${posts().length}`);
    assert.strictEqual(posts().pop().body.customer_app_id_string.split(',').sort().join(','), '1,2,3,4,5,6');
  });
  test('server says "follower_not_found" on upload → id dropped, next sync re-registers and merges', async () => {
    M.store.set('FOLLOWER_ID', '501');
    M.api.failWith = { type: 'empty', code: 'follower_not_found' };
    const fs_ = FS();
    await fs_.followUser(77);
    assert.strictEqual(M.store.has('FOLLOWER_ID'), false, 'stale id forgotten');
    assert.strictEqual(M.store.get('@PFSLive:followSyncPending'), '1');
    M.api.failWith = null;
    M.fapi.guestResult = { follower_id: 600 };
    M.fapi.byDevice = { follower_id: 600, followed_customers: [5], followed_bibs: {} };
    await fs_.followUser(88);
    assert.strictEqual(M.fapi.guestCalls, 1, 're-registered');
    const body = posts().pop().body;
    assert.strictEqual(body.follower_id, 600);
    assert.deepStrictEqual(body.customer_app_id_string.split(',').sort(), ['5', '77', '88']);
  });

  // ── Start funnel + re-shown popup ─────────────────────────────────────
  test('one permission answer is logged ONCE (return listener quiet during the inline request)', () => {
    const s = read('screens/HomeScreen.tsx');
    assert.ok(/inlineRequestRef\.current = true;\s*let perms;\s*try \{\s*perms = await gpsService\.requestPermissionsDetailed\(\);\s*\} finally \{\s*inlineRequestRef\.current = false;/.test(s), 'flag around the request');
    assert.ok(/if \(!inlineRequestRef\.current\) \{\s*void analyticsService\.logStartStep\('permission_result', 'granted_on_return'/.test(s));
    assert.ok(/if \(!inlineRequestRef\.current\) \{\s*void analyticsService\.logStartStep\('permission_result', 'still_blocked_on_return'/.test(s));
  });
  test('popup re-shown after Settings uses the CURRENT problem (reason + can-ask-again refreshed)', () => {
    const s = read('screens/HomeScreen.tsx');
    const at = s.indexOf("'still_blocked_on_return'");
    const after = s.slice(at, at + 900);
    assert.ok(/setPermissionBlockReason\(!perms\.foreground \? 'denied' : !perms\.background \? 'no_background_perm' : 'location_off'\)/.test(after));
    assert.ok(/setPermissionCanAskAgain\(perms\.canAskAgain\)/.test(after));
    assert.ok(after.indexOf('setPermissionBlockReason') < after.indexOf('setShowLocationPermissionModal(true)'), 'refreshed before showing');
  });
};
