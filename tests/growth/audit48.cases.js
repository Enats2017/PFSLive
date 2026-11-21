// Cases added 2026-10-29, after master's live-map bib follows ([#MAP-BIB-FOLLOWS],
// feedback #31) were merged into growth: the map reads the bib follows that
// GROWTH's followStorage writes (its own rewrite: guest rows, sync, merges).
// master's tests only cover the pure helpers; these join the two halves —
// growth's follow / unfollow / download → the real useFollowManager the live
// map uses → the bibs the live-tracking request carries.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

module.exports = ({ M, load, test, SRC }) => {
  const Module = require('module');
  const FS = () => load('utils/followStorage');
  const read = (rel) => fs.readFileSync(path.join(SRC, rel), 'utf8').replace(/\r/g, '');

  // The real hook, its state setters captured (the harness React keeps no state).
  const liveMapFollows = async () => {
    const React = Module._load('react', { filename: path.join(SRC, 'screens', 'LiveTrackingScreen.tsx') });
    const prev = React.useState;
    const set = { users: null, bibs: null };
    let n = 0;
    React.useState = (v) => {
      const x = typeof v === 'function' ? v() : v;
      const i = n++;
      return [x, (nv) => { if (i === 0) set.users = nv; if (i === 1) set.bibs = nv; }];
    };
    try {
      const { useFollowManager } = load('hooks/useFollowManager');
      const h = useFollowManager((k) => k, 13);
      await h.refreshFollowedUsers();
    } finally { React.useState = prev; }
    assert.ok(set.bibs instanceof Map, 'hook set the bib map');
    return set;
  };
  const { followedBibsForEvent, liveTrackingBibsParam } = load('utils/liveMapBibs');
  const sent = (bibs, id, src = 'partner') => liveTrackingBibsParam(followedBibsForEvent(bibs, id, src), src);

  test('live map + growth followStorage: a bib followed in the app is on the map request (and only for its own race)', async () => {
    M.store.set('FOLLOWER_ID', '501');
    await FS().followBib(13, '450');
    await FS().followBib(13, '12');
    await FS().followBib(14, '7');
    const { bibs } = await liveMapFollows();
    assert.strictEqual(sent(bibs, 13), '12,450', 'race 13: both, sorted');
    assert.strictEqual(sent(bibs, 14), '7');
    assert.strictEqual(sent(bibs, 15), null, 'another race: none');
    assert.strictEqual(sent(bibs, 13, 'custom'), null, 'custom event with the same id: never');
  });
  test('…an unfollow takes the bib off the map request', async () => {
    M.store.set('FOLLOWER_ID', '501');
    await FS().followBib(13, '450');
    await FS().followBib(13, '12');
    await FS().unfollowBib(13, '450');
    const { bibs } = await liveMapFollows();
    assert.strictEqual(sent(bibs, 13), '12');
    await FS().unfollowBib(13, '12');
    assert.strictEqual(sent((await liveMapFollows()).bibs, 13), null, 'last one gone: field left out');
  });
  test('…bibs followed on another device / the website (downloaded by growth\'s sync) reach the map too', async () => {
    M.store.set('FOLLOWER_ID', '501');
    await FS().syncFollowDataFromAPI([111], { 13: ['450', ' 450', '9'] }, FS().getFollowWriteSeq(), 5);
    const { users, bibs } = await liveMapFollows();
    assert.ok(users instanceof Set && users.has(111), 'account follow');
    assert.strictEqual(sent(bibs, 13), '450,9', 'trimmed + deduped ("450" and " 450" are one runner)');
  });
  test('…a guest with no follower row yet (fresh install, no push, no login) who follows by bib has it on the map', async () => {
    // No FOLLOWER_ID yet: a fresh install that follows before any push / login.
    M.fapi.byDevice = null;
    await FS().followBib(13, '450');
    const { bibs } = await liveMapFollows();
    assert.strictEqual(sent(bibs, 13), '450');
  });
  test('…the hook and growth\'s followStorage name the same storage key (a rename would empty the map silently)', () => {
    const fsKey = read('utils/followStorage.ts').match(/const STORAGE_KEY_BIBS = '([^']+)'/);
    assert.ok(fsKey, 'followStorage key');
    assert.ok(read('hooks/useFollowManager.ts').includes(`AsyncStorage.getItem("${fsKey[1]}")`), 'useFollowManager reads it');
    assert.ok(/followedBibsForEvent\(followedBibs, product_app_id, event_source\)/.test(read('screens/LiveTrackingScreen.tsx')), 'map uses the hook\'s bibs');
  });
};
