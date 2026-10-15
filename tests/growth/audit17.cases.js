// Cases added in the SEVENTEENTH round (2026-10-15). Registered by app.test.js.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

module.exports = function register({ M, load, test, SRC }) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const SYNC = '/update_follower_favourites_api.php';
  const ok = () => M.api.posted.filter((p) => p.url.endsWith(SYNC) && !p.rejected);
  const FS = () => load('utils/followStorage');
  const NP = () => load('services/notificationPermissionService').notificationPermissionService;
  const TOMB = '@PFSLive:followRemovedBeforeAdopt';

  // ── list_too_large only covers the refused upload's change ────────────
  test('list_too_large: a change QUEUED behind the refused upload stays owed (a download meanwhile does not erase it)', async () => {
    M.store.set('FOLLOWER_ID', '501');
    M.storeDelay = 5;                                      // b has not marked itself pending yet
    M.api.syncScript = [{ delay: 30, failCode: 'list_too_large' }, { delay: 80 }];
    const fs_ = load('utils/followStorage', { raw: true });
    const a = fs_.followUser(1);                           // refused
    await wait(5);
    const b = fs_.followUser(2);                           // queued behind it
    await a;
    // follow no longer waits for its upload: wait for a's refusal to be
    // handled (b's upload, 80 ms, is still in flight).
    while (!M.api.posted.some((p) => p.rejected)) await wait(1);
    await wait(25);
    assert.strictEqual(ok().length, 0, 'b not delivered yet (scenario intact)');
    await fs_.syncFollowDataFromAPI([9], {}, fs_.getFollowWriteSeq());   // download right then
    assert.ok((await fs_.getFollowedUsers()).includes(2), 'queued follow not erased by the download');
    await b;
    if (fs_.whenFollowSyncIdle) await fs_.whenFollowSyncIdle();
    assert.ok(ok().some((p) => p.body.customer_app_id_string.split(',').includes('2')), 'queued change delivered');
  });
  test('list_too_large: remembered unfollows from before a merge are dropped (server list is the truth)', async () => {
    M.store.set('FOLLOWER_ID', '501');
    M.store.set(TOMB, JSON.stringify({ customers: [4], bibs: {} }));
    M.api.failWith = { type: 'empty', code: 'list_too_large' };
    await FS().followUser(1);
    assert.strictEqual(M.store.has(TOMB), false);
  });
  test('control: a NETWORK failure keeps remembered unfollows', async () => {
    M.store.set('FOLLOWER_ID', '501');
    M.store.set(TOMB, JSON.stringify({ customers: [4], bibs: {} }));
    M.api.fail = true;
    await FS().followUser(1);
    assert.ok(M.store.has(TOMB));
  });

  // ── push token re-sent in the SAME session ────────────────────────────
  test('row lost mid-session → the push token is sent again on the next foreground, no restart needed', async () => {
    M.notif.status = 'granted';
    M.store.set('FOLLOWER_ID', '501');
    const np = NP();
    await np.registerIfGranted();                           // sent once
    assert.strictEqual(M.fapi.registerCalls.length, 1);
    M.api.failWith = { type: 'empty', code: 'follower_not_found' };
    await FS().followUser(7);                               // row gone
    M.api.failWith = null;
    await np.registerIfGranted();                           // e.g. app comes to the foreground
    assert.strictEqual(M.fapi.registerCalls.length, 2, 'sent again in this session');
  });
  test('control: without a lost row the next foreground does NOT re-send', async () => {
    M.notif.status = 'granted';
    M.store.set('FOLLOWER_ID', '501');
    const np = NP();
    await np.registerIfGranted();
    await FS().followUser(7);
    await np.registerIfGranted();
    assert.strictEqual(M.fapi.registerCalls.length, 1);
  });

  // ── race-ready opens in the same tick as its checks ───────────────────
  test('race-ready navigates BEFORE awaiting its storage write (a Start tap cannot slip in between)', () => {
    const s = fs.readFileSync(path.resolve(SRC, 'services/raceReadyService.ts'), 'utf8');
    const nav = s.indexOf("navigationRef.navigate('RaceReady'");
    assert.ok(nav > 0);
    const before = s.slice(s.lastIndexOf('stillAllowed()', nav), nav);
    assert.ok(!/await\s/.test(before), 'no await between the last check and navigate');
    assert.ok(/await marking;/.test(s.slice(nav, nav + 300)), 'the write is still awaited');
  });
};
