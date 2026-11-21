// Cases added in the ELEVENTH round (2026-10-15). Registered by app.test.js.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

module.exports = function register({ M, load, test, SRC }) {
  const { CONFIG } = require('./harness');
  const read = (p) => fs.readFileSync(path.resolve(SRC, p), 'utf8');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const SYNC = '/update_follower_favourites_api.php';
  const ok = () => M.api.posted.filter((p) => p.url.endsWith(SYNC) && !p.rejected);
  const list = (p) => p.body.customer_app_id_string.split(',').filter(Boolean).sort((a, b) => a - b).join(',');
  const FS = () => load('utils/followStorage');
  const TOMB = '@PFSLive:followRemovedBeforeAdopt';
  const ADOPT = '@PFSLive:followAdoptPending';

  // ── remembered unfollows ──────────────────────────────────────────────
  test('merge push fails (network), next plain upload succeeds → remembered unfollows cleared', async () => {
    M.store.set('FOLLOWER_ID', '501');
    M.store.set(ADOPT, '1');
    M.store.set(TOMB, JSON.stringify({ customers: [4], bibs: {} }));
    M.fapi.byDevice = { follower_id: 501, followed_customers: [], followed_bibs: {} };
    M.api.syncScript = [{ fail: true }];                 // the merge's own push
    const fs_ = FS();
    await fs_.followUser(1);
    assert.ok(M.store.has(TOMB), 'kept while nothing reached the row');
    await fs_.followUser(2);                              // plain upload, succeeds
    assert.strictEqual(M.store.has(TOMB), false, 'spent once a full list reached the row');
  });
  test('…so a LATER merge keeps a follow the runner added on the web meanwhile', async () => {
    M.store.set('FOLLOWER_ID', '501');
    M.store.set(ADOPT, '1');
    M.store.set(TOMB, JSON.stringify({ customers: [4], bibs: {} }));
    M.fapi.byDevice = { follower_id: 501, followed_customers: [], followed_bibs: {} };
    M.api.syncScript = [{ fail: true }];
    const fs_ = FS();
    await fs_.followUser(1);
    await fs_.followUser(2);
    // weeks later: web follows athlete 4 on the same row; a merge is owed again
    M.store.set(ADOPT, '1');
    M.fapi.byDevice = { follower_id: 501, followed_customers: [4], followed_bibs: {} };
    await fs_.followUser(3);
    assert.strictEqual(list(ok().pop()), '1,2,3,4', 'web follow 4 kept');
  });
  test('an upload to a DIFFERENT id than the stored one does not clear remembered unfollows', async () => {
    M.store.set('FOLLOWER_ID', '501');
    M.api.syncScript = [{ delay: 40 }];
    const fs_ = FS();
    const a = fs_.followUser(1);                          // to 501, slow
    await wait(5);
    M.store.set('FOLLOWER_ID', '600');                   // new id, its merge owed
    M.store.set(ADOPT, '1');
    M.store.set(TOMB, JSON.stringify({ customers: [9], bibs: {} }));
    await a;
    assert.ok(M.store.has(TOMB), 'kept for the 600 merge');
  });

  // ── abandoned upload rejected late ────────────────────────────────────
  test('a timed-out upload REJECTED late with follower_not_found → stored id kept', async () => {
    const saved = CONFIG.API_CONFIG.TIMEOUT;
    CONFIG.API_CONFIG.TIMEOUT = 50;
    try {
      M.store.set('FOLLOWER_ID', '501');
      M.api.syncScript = [{ delay: 5200 }];
      M.api.rejectIds = [501];
      await FS().followUser(1);                           // released by the job limit (network error)
      assert.strictEqual(M.store.get('FOLLOWER_ID'), '501', 'a timeout is not "not found"');
      await wait(300);                                    // the late rejection lands
      assert.strictEqual(M.store.get('FOLLOWER_ID'), '501', 'late rejection ignored');
    } finally { CONFIG.API_CONFIG.TIMEOUT = saved; }
  });

  // ── Start ─────────────────────────────────────────────────────────────
  test('declining a later Start ("No" / early-tracking cancel / new tap) disarms a pending start', () => {
    const s = read('screens/HomeScreen.tsx');
    for (const name of ['confirmStartTracking', 'handleStartConfirmNo', 'handleEarlyTrackingCancel']) {
      const at = s.indexOf(`const ${name} = useCallback(`);
      assert.ok(at > 0, name);
      const body = s.slice(at, s.indexOf('}, [', at));
      assert.ok(body.includes('pendingStartRef.current = false;'), `${name} clears it`);
    }
  });
  test('popup re-shown after Settings uses the Start wording (mid-race / no-fix flags reset)', () => {
    const s = read('screens/HomeScreen.tsx');
    const at = s.indexOf("'still_blocked_on_return'");
    const after = s.slice(at, s.indexOf('setShowLocationPermissionModal(true)', at));
    assert.ok(after.includes('setPermissionModalMidRace(false);'));
    assert.ok(after.includes('setPermissionModalNoFix(false);'));
  });
};
