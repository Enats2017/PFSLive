// Cases added in the TENTH round (2026-10-14). Registered by app.test.js.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

module.exports = function register({ M, load, test, SRC }) {
  const { CONFIG } = require('./harness');
  const read = (p) => fs.readFileSync(path.resolve(SRC, p), 'utf8');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const SYNC = '/update_follower_favourites_api.php';
  const sorted = (p) => p.body.customer_app_id_string.split(',').filter(Boolean).sort((a, b) => a - b).join(',');
  const ok = () => M.api.posted.filter((p) => p.url.endsWith(SYNC) && !p.rejected);
  const FS = () => load('utils/followStorage');
  const withTimeout = async (ms, fn) => {
    const saved = CONFIG.API_CONFIG.TIMEOUT;
    CONFIG.API_CONFIG.TIMEOUT = ms;                       // job limit = TIMEOUT + 5 s
    try { return await fn(); } finally { CONFIG.API_CONFIG.TIMEOUT = saved; }
  };

  // ── follow uploads: id replaced while one is queued ───────────────────
  test('a new id stored while an upload for the OLD id is queued → new id kept, its push goes to it', async () => {
    M.store.set('FOLLOWER_ID', '501');
    M.api.rejectIds = [501];                             // old id no longer valid on the server
    M.api.syncScript = [{ delay: 60 }];
    const fs_ = FS();
    const a = fs_.followUser(1);                          // slow, to 501
    await wait(5);
    const b = fs_.followUser(2);                          // queued, to 501
    await wait(5);
    M.store.set('FOLLOWER_ID', '600');                   // push-token registration lands
    await fs_.followUser(3);                              // to 600: must NOT join the 501 run
    await Promise.all([a, b]);
    assert.strictEqual(M.store.get('FOLLOWER_ID'), '600', 'valid new id kept');
    const to600 = ok().filter((p) => p.body.follower_id === 600);
    assert.ok(to600.length >= 1, 'pushed to the new row');
    assert.strictEqual(sorted(to600.pop()), '1,2,3');
  });
  test('"follower_not_found" for the id the phone still holds → that id IS dropped (control)', async () => {
    M.store.set('FOLLOWER_ID', '501');
    M.api.rejectIds = [501];
    await FS().followUser(1);
    assert.strictEqual(M.store.has('FOLLOWER_ID'), false);
  });

  // ── a timed-out upload that still lands, late ─────────────────────────
  test('an old upload landing AFTER a newer one → phone re-sends the current list (server before the follow_seq migration)', async () => {
    await withTimeout(50, async () => {
      M.api.ignoreSeq = true;
      M.store.set('FOLLOWER_ID', '501');
      M.api.syncScript = [{ delay: 5300 }];              // past the 5.05 s job limit, still arrives
      const fs_ = FS();
      const a = fs_.followUser(1);
      await wait(5);
      await fs_.followUser(2);                            // released by the limit, lands "1,2" first
      await a;
      await wait(450);                                    // old "1" lands, then the re-send
      const lists = ok().map(sorted);
      assert.deepStrictEqual(lists.slice(0, 2), ['1,2', '1'], `landing order ${JSON.stringify(lists)}`);
      assert.strictEqual(lists[lists.length - 1], '1,2', 'server ends on the newest list');
    });
  });

  // ── hung merge download / guest registration ──────────────────────────
  test('a HUNG merge download does not freeze follows (released, merge still owed)', async () => {
    await withTimeout(50, async () => {
      M.store.set('FOLLOWER_ID', '501');
      M.store.set('@PFSLive:followAdoptPending', '1');
      M.fapi.byDeviceDelay = 1e9;
      const t0 = Date.now();
      await FS().followUser(1);
      assert.ok(Date.now() - t0 < 8000, 'released by the time limit');
      assert.strictEqual(M.store.get('@PFSLive:followAdoptPending'), '1', 'merge still owed (timeout ≠ no row)');
      assert.strictEqual(M.store.get('@PFSLive:followSyncPending'), '1');
      assert.strictEqual(ok().length, 0, 'never pushed over an unknown server list');
    });
  });
  test('a HUNG guest registration does not freeze follows', async () => {
    await withTimeout(50, async () => {
      M.fapi.guestDelay = 1e9;
      const t0 = Date.now();
      await FS().followUser(1);
      assert.ok(Date.now() - t0 < 8000, 'released by the time limit');
      assert.strictEqual(M.store.has('FOLLOWER_ID'), false);
      assert.strictEqual(M.store.get('@PFSLive:followSyncPending'), '1');
    });
  });

  // ── remembered unfollows survive a failed merge push ──────────────────
  test('merge push rejected → remembered unfollow still honoured by the next merge', async () => {
    M.store.set('FOLLOWER_ID', '501');
    M.store.set('@PFSLive:followAdoptPending', '1');
    M.store.set('@PFSLive:followRemovedBeforeAdopt', JSON.stringify({ customers: [4], bibs: {} }));
    M.fapi.byDevice = { follower_id: 501, followed_customers: [4, 5], followed_bibs: {} };
    M.api.rejectIds = [501];
    const fs_ = FS();
    await fs_.followUser(1);
    assert.strictEqual(M.store.has('FOLLOWER_ID'), false, 'stale id dropped');
    assert.ok(M.store.has('@PFSLive:followRemovedBeforeAdopt'), 'unfollow list kept');
    M.api.rejectIds = [];
    M.fapi.guestResult = { follower_id: 600 };
    M.fapi.byDevice = { follower_id: 600, followed_customers: [4, 5], followed_bibs: {} };
    await fs_.followUser(2);
    const last = ok().pop();
    assert.strictEqual(last.body.follower_id, 600);
    assert.ok(!last.body.customer_app_id_string.split(',').includes('4'), `unfollowed athlete came back: ${last.body.customer_app_id_string}`);
    assert.strictEqual(M.store.has('@PFSLive:followRemovedBeforeAdopt'), false, 'cleared once the merge reached the row');
  });

  // ── Start / location popup ────────────────────────────────────────────
  test('return-from-Settings re-checks "start pending" AFTER its awaits (no second start)', () => {
    const s = read('screens/HomeScreen.tsx');
    const at = s.indexOf('(await gpsService.isLocationServiceEnabled());');
    assert.ok(at > 0);
    const after = s.slice(at, at + 600);
    const recheck = after.indexOf('if (!pendingStartRef.current) return;');
    assert.ok(recheck > 0, 're-check present');
    assert.ok(recheck < after.indexOf('if (satisfied)'), 'before acting');
  });
  test('granted from the popup itself → popup closed before tracking starts', () => {
    const s = read('screens/HomeScreen.tsx');
    const at = s.indexOf('if (perms.background) {');
    assert.ok(at > 0);
    const after = s.slice(at, at + 1400);
    const hide = after.indexOf('setShowLocationPermissionModal(false);');
    assert.ok(hide > 0, 'popup hidden');
    assert.ok(hide < after.indexOf('await doStartGPSTracking();'), 'before starting');
  });
};
