// Cases added in the second exhaustive pass (2026-10-15). Registered by app.test.js.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

module.exports = function register({ M, load, test, SRC }) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const SYNC = '/update_follower_favourites_api.php';
  const ok = () => M.api.posted.filter((p) => p.url.endsWith(SYNC) && !p.rejected);
  const FS = () => load('utils/followStorage');
  const NP = () => load('services/notificationPermissionService').notificationPermissionService;
  const list = (p) => p.body.customer_app_id_string.split(',').filter(Boolean).map(Number).sort((a, b) => a - b);

  test('restore: the stored id is NOT this device\'s server row → merge (union), never overwrite local follows', async () => {
    M.store.set('FOLLOWER_ID', '900');                 // foreign id (backup, old shared row)
    M.store.set('followed_users', JSON.stringify([1, 2]));
    M.fapi.byDevice = { follower_id: 501, followed_customers: [3], followed_bibs: {} };
    const fs_ = FS();
    await fs_.restoreFollowsWithoutToken();
    assert.deepStrictEqual((await fs_.getFollowedUsers()).sort(), [1, 2, 3], 'nothing lost');
    assert.strictEqual(M.store.get('FOLLOWER_ID'), '501', 'the device row\'s id');
    const p = ok().pop();
    assert.ok(p && p.body.follower_id === 501 && list(p).join(',') === '1,2,3', `pushed ${p && p.body.customer_app_id_string}`);
  });
  test('control: stored id = the device row → normal download (no merge)', async () => {
    M.store.set('FOLLOWER_ID', '501');
    M.fapi.byDevice = { follower_id: 501, followed_customers: [3], followed_bibs: {} };
    await FS().restoreFollowsWithoutToken();
    assert.strictEqual(M.store.has('@PFSLive:followAdoptPending'), false);
  });

  test('a "stale" answer naming the upload\'s OWN number (duplicate delivery) counts as delivered', async () => {
    M.store.set('FOLLOWER_ID', '501');
    M.api.staleEcho = true;
    const fs_ = FS();
    await fs_.followUser(1);
    assert.strictEqual(M.store.has('@PFSLive:followSyncPending'), false, 'in sync');
  });

  test('granting notifications returns at once — the token POST runs in the background', async () => {
    M.notif.status = 'undetermined';
    M.notif.requestResult = { status: 'granted', canAskAgain: true };
    const st = await NP().request();
    assert.strictEqual(st.status, 'granted');
    // returned BEFORE the registration POST was even made (it used to be awaited)
    assert.strictEqual(M.fapi.registerCalls.length, 0, 'not waited for');
    await wait(50);
    assert.strictEqual(M.fapi.registerCalls.length, 1, 'still registered, in the background');
  });

  test('registration-confirmed link: event name capped like the event link', () => {
    const s = fs.readFileSync(path.resolve(SRC, '../App.tsx'), 'utf8');
    assert.ok(s.includes("const event_name = (params.event_name ?? '').slice(0, 120);"));
  });
};
