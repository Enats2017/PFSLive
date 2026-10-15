// Cases added in the SIXTEENTH round (2026-10-15). Registered by app.test.js.
const assert = require('assert');

module.exports = function register({ M, load, test }) {
  const SYNC = '/update_follower_favourites_api.php';
  const ok = () => M.api.posted.filter((p) => p.url.endsWith(SYNC) && !p.rejected);
  const FS = () => load('utils/followStorage');
  const NP = () => load('services/notificationPermissionService').notificationPermissionService;
  const TOKEN = 'ExponentPushToken[abc]';

  // ── push token re-sent after the row was lost ─────────────────────────
  test('follower_not_found → "already sent" token forgotten; next launch sends the token again', async () => {
    M.store.set('FOLLOWER_ID', '501');
    M.store.set('expo_push_token', TOKEN);
    M.api.failWith = { type: 'empty', code: 'follower_not_found' };
    await FS().followUser(7);
    assert.strictEqual(M.store.has('expo_push_token'), false, 'forgotten');
    M.api.failWith = null;
    M.notif.status = 'granted';
    await NP().registerIfGranted();
    assert.deepStrictEqual(M.fapi.registerCalls, [TOKEN], 'token sent again → row gets it back');
  });
  test('a fresh guest registration also forgets the "already sent" token', async () => {
    M.store.set('expo_push_token', TOKEN);
    M.fapi.guestResult = { follower_id: 600 };
    await FS().followUser(7);                               // no id yet → registers as guest
    assert.strictEqual(M.store.get('FOLLOWER_ID'), '600');
    assert.strictEqual(M.store.has('expo_push_token'), false);
  });
  test('control: an ordinary successful upload keeps the saved token (no needless re-register)', async () => {
    M.store.set('FOLLOWER_ID', '501');
    M.store.set('expo_push_token', TOKEN);
    await FS().followUser(7);
    assert.strictEqual(M.store.get('expo_push_token'), TOKEN);
  });

  // ── server refuses an over-limit list ────────────────────────────────
  test('list_too_large → not left "not synced": the next download takes the server list', async () => {
    M.store.set('FOLLOWER_ID', '501');
    M.api.failWith = { type: 'empty', code: 'list_too_large' };
    const fs_ = FS();
    await fs_.followUser(7);
    assert.strictEqual(M.store.has('@PFSLive:followSyncPending'), false, 'not pending');
    M.api.failWith = null;
    const before = ok().length;
    await fs_.syncFollowDataFromAPI([1, 2], {}, fs_.getFollowWriteSeq());
    assert.strictEqual(ok().length, before, 'pulled, did not push the refused list again');
    assert.deepStrictEqual((await fs_.getFollowedUsers()).sort(), [1, 2]);
  });
  test('control: a NETWORK failure still keeps the phone ahead (pushes on the next download)', async () => {
    M.store.set('FOLLOWER_ID', '501');
    M.api.fail = true;
    const fs_ = FS();
    await fs_.followUser(7);
    assert.strictEqual(M.store.get('@PFSLive:followSyncPending'), '1');
    M.api.fail = false;
    await fs_.syncFollowDataFromAPI([1, 2], {}, fs_.getFollowWriteSeq());
    assert.ok(ok().some((p) => p.body.customer_app_id_string.split(',').includes('7')), 'pushed the local follow');
  });
};
