// Cases added in the TWELFTH round (2026-10-15). Registered by app.test.js.
// Follow uploads carry client_seq; the server ignores an older upload that
// reaches it after a newer one (see update_follower_favourites_api.php).
const assert = require('assert');

module.exports = function register({ M, load, test }) {
  const { CONFIG } = require('./harness');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const SYNC = '/update_follower_favourites_api.php';
  const sent = () => M.api.posted.filter((p) => p.url.endsWith(SYNC));
  const applied = () => sent().filter((p) => !p.rejected);
  const list = (p) => p.body.customer_app_id_string.split(',').filter(Boolean).sort((a, b) => a - b).join(',');
  const FS = () => load('utils/followStorage');
  const SEQ = '@PFSLive:followSeqIssued';

  test('THE CASE: phone times out, server commits that OLD list later → ignored, server keeps the newest', async () => {
    M.store.set('FOLLOWER_ID', '501');
    M.api.syncScript = [{ lateCommit: 150 }];            // "1": phone sees a timeout, server commits at +150 ms
    const fs_ = FS();
    await fs_.followUser(1);
    await fs_.followUser(2);                              // "1,2" committed now
    await wait(250);                                      // the old "1" reaches the server
    assert.deepStrictEqual(applied().map(list), ['1,2'], `server applied ${JSON.stringify(applied().map(list))}`);
    assert.ok(sent().some((p) => p.stale && list(p) === '1'), 'the late old list was refused as stale');
  });
  test('…same with the phone SEEING the late answer: no list regression, no needless re-send', async () => {
    const saved = CONFIG.API_CONFIG.TIMEOUT;
    CONFIG.API_CONFIG.TIMEOUT = 50;
    try {
      M.store.set('FOLLOWER_ID', '501');
      M.api.syncScript = [{ delay: 5300 }];
      const fs_ = FS();
      const a = fs_.followUser(1);
      await wait(5);
      await fs_.followUser(2);
      await a;
      await wait(450);
      assert.deepStrictEqual(applied().map(list), ['1,2']);
      assert.strictEqual(M.store.has('@PFSLive:followSyncPending'), false, 'in sync');
    } finally { CONFIG.API_CONFIG.TIMEOUT = saved; }
  });

  test('every upload carries a RISING client_seq, persisted for the next launch', async () => {
    M.store.set('FOLLOWER_ID', '501');
    const fs_ = FS();
    await fs_.followUser(1);
    await fs_.followUser(2);
    await fs_.unfollowUser(1);
    const seqs = sent().map((p) => p.body.client_seq);
    assert.strictEqual(seqs.length, 3);
    assert.ok(seqs.every((s) => Number.isInteger(s) && s > 0), JSON.stringify(seqs));
    assert.ok(seqs[0] < seqs[1] && seqs[1] < seqs[2], 'rising');
    assert.strictEqual(M.store.get(SEQ), String(seqs[2]), 'persisted');
  });
  test('after a restart the numbering continues ABOVE the stored one (even with the clock set back)', async () => {
    const ahead = Date.now() + 5e8;
    M.store.set(SEQ, String(ahead));
    M.store.set('FOLLOWER_ID', '501');
    await FS().followUser(1);
    assert.strictEqual(sent()[0].body.client_seq, ahead + 1);
  });
  test('server holds a HIGHER number than the phone (clock back, data cleared) → phone jumps above it and re-sends once', async () => {
    const serverSeq = Date.now() + 9e8;
    M.api.seqByFollower[501] = serverSeq;
    M.store.set('FOLLOWER_ID', '501');
    await FS().followUser(7);
    await wait(30);
    assert.strictEqual(sent().length, 2, `uploads: ${sent().length}`);
    assert.ok(sent()[0].stale, 'first refused');
    assert.ok(sent()[1].body.client_seq > serverSeq, 'continued above the server');
    assert.strictEqual(list(applied()[0]), '7');
    assert.strictEqual(M.store.has('@PFSLive:followSyncPending'), false);
  });
  test('a stale answer for an OLDER list is not "synced" and sends nothing more', async () => {
    M.store.set('FOLLOWER_ID', '501');
    const fs_ = FS();
    await fs_.followUser(1);
    const before = sent().length;
    M.api.seqByFollower[501] = Date.now() + 9e8;         // a newer upload already applied
    M.api.syncScript = [{ delay: 20 }];
    const a = fs_.followUser(2);                          // will be refused…
    await wait(5);
    const b = fs_.followUser(3);                          // …and is no longer the newest list
    await Promise.all([a, b]);
    await wait(30);
    assert.ok(sent()[before].stale, 'refused');
    // the newest list (1,2,3) is what follows — and it lands
    assert.strictEqual(list(applied().pop()), '1,2,3');
  });
  test('row number above 2^53 / absurd (hostile or buggy writer) → no stale/re-send loop, stored number stays sane', async () => {
    M.storeDelay = 1;                                     // lets timers run even if it loops
    M.api.seqByFollower[501] = 1e16;
    M.store.set('FOLLOWER_ID', '501');
    try {
      await FS().followUser(1);
      await wait(200);
      assert.strictEqual(sent().length, 1, `uploads: ${sent().length}`);
      assert.ok(Number(M.store.get(SEQ)) < Date.now() + 1e9, 'not adopted');
    } finally { M.api.seqByFollower[501] = 0; await wait(20); }   // ends a loop, if any
  });
  test('corrupt stored number (above 2^53) → ignored at launch, numbering from the clock', async () => {
    M.store.set(SEQ, '10000000000000000');
    M.store.set('FOLLOWER_ID', '501');
    await FS().followUser(1);
    const n = sent()[0].body.client_seq;
    assert.ok(Number.isSafeInteger(n) && n < Date.now() + 1e9, String(n));
  });
  test('stale answer naming the phone OWN number (duplicate delivery) → no extra re-send', async () => {
    M.store.set('FOLLOWER_ID', '501');
    M.api.staleEcho = true;
    await FS().followUser(1);
    await wait(30);
    assert.strictEqual(sent().length, 1, `uploads: ${sent().length}`);
  });
  test('uploads to a NEW follower row start fresh there (numbers are per row on the server)', async () => {
    M.api.seqByFollower[501] = Date.now() + 9e8;         // the old row's number
    M.store.set('FOLLOWER_ID', '600');
    await FS().followUser(1);
    assert.strictEqual(sent().length, 1);
    assert.ok(!sent()[0].rejected, 'applied first time');
  });
};
