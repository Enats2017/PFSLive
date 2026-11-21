// Cases added in the SEVENTH round (2026-10-14). Registered by app.test.js.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

module.exports = function register({ M, load, test, SRC }) {
  const read = (p) => fs.readFileSync(path.resolve(SRC, p), 'utf8');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const SYNC = '/update_follower_favourites_api.php';
  const posts = () => M.api.posted.filter((p) => p.url.endsWith(SYNC));
  const FS = () => load('utils/followStorage');
  const COPY = () => load('utils/locationPopupCopy').locationPopupCopy;

  // ── location popup copy: Start flow vs mid-race vs no GPS position ─────
  test('Start flow: the pitch title; body says what to allow (incl. "then press Start again")', () => {
    const c = COPY();
    for (const reason of ['denied', 'no_background_perm', 'location_off']) {
      assert.strictEqual(c({ midRace: false, noFix: false, reason, platform: 'ios' }).titleKey, 'home:gpsHealth.title', reason);
    }
    assert.strictEqual(c({ midRace: false, noFix: false, reason: 'location_off', platform: 'ios' }).bodyKey, 'home:gpsHealth.blockedBodyLocationOff');
    assert.strictEqual(c({ midRace: false, noFix: false, reason: 'denied', platform: 'ios' }).bodyKey, 'home:gpsHealth.blockedBodyDenied');
    assert.strictEqual(c({ midRace: false, noFix: false, reason: 'no_background_perm', platform: 'ios' }).bodyKey, 'home:gpsHealth.blockedBody');
  });
  test('mid-race banner: "Location access is limited"; Location-off body never says "press Start"', () => {
    const c = COPY();
    const off = c({ midRace: true, noFix: false, reason: 'location_off', platform: 'ios' });
    assert.strictEqual(off.titleKey, 'home:gpsHealth.titleLocationOffMidRace', 'title agrees with the body (Location is off)');
    assert.strictEqual(off.bodyKey, 'home:gpsHealth.blockedBodyLocationOffMidRace');
    assert.strictEqual(c({ midRace: true, noFix: false, reason: 'no_background_perm', platform: 'ios' }).titleKey, 'home:gpsHealth.titleMidRace');
  });
  test('mid-race "no GPS position" (indoors/tunnel): own title + body, no settings steps', () => {
    const r = COPY()({ midRace: true, noFix: true, reason: 'location_off', platform: 'android' });
    assert.deepStrictEqual(r, { titleKey: 'home:gpsHealth.titleNoFix', bodyKey: 'home:gpsHealth.blockedBodyNoFix', showSettingsSteps: false, showSettingsButton: false });
  });
  test('settings steps: hidden only where Android lands exactly on the Location switch', () => {
    const c = COPY();
    assert.strictEqual(c({ midRace: false, noFix: false, reason: 'location_off', platform: 'android' }).showSettingsSteps, false);
    assert.strictEqual(c({ midRace: false, noFix: false, reason: 'location_off', platform: 'ios' }).showSettingsSteps, true);
    assert.strictEqual(c({ midRace: false, noFix: false, reason: 'denied', platform: 'android' }).showSettingsSteps, true);
  });
  test('who sets what: only the banner sets mid-race (and no-fix); both Start openers reset both', () => {
    const s = read('screens/HomeScreen.tsx');
    assert.strictEqual((s.match(/setPermissionModalMidRace\(true\)/g) || []).length, 1);
    assert.ok(/setPermissionModalMidRace\(true\);\s*setPermissionModalNoFix\(gpsHealth === 'no_fix'\);/.test(s), 'banner');
    assert.ok(/setPermissionBlockReason\(perms\.foreground \? 'no_background_perm' : 'denied'\);\s*setPermissionModalMidRace\(false\);\s*setPermissionModalNoFix\(false\);/.test(s), 'Start: permission');
    assert.ok(/setPermissionBlockReason\('location_off'\);\s*setPermissionModalMidRace\(false\);\s*setPermissionModalNoFix\(false\);/.test(s), 'Start: location off');
    assert.ok(/\{t\(popupCopy\.titleKey\)\}/.test(s) && /\{t\(popupCopy\.bodyKey\)\}/.test(s) && /popupCopy\.showSettingsSteps &&/.test(s), 'rendered from the helper');
  });
  test('copy in en/fr/nl: mid-race title is the original wording; mid-race bodies never mention Start', () => {
    const want = { en: 'Location access is limited', fr: 'Accès à la localisation limité', nl: 'Locatietoegang is beperkt' };
    const startWord = { en: /\bStart\b/, fr: /Démarrer|Start/, nl: /\bStart\b/ };
    for (const l of ['en', 'fr', 'nl']) {
      const g = JSON.parse(read(`i18n/HomeScreen/${l}.json`)).gpsHealth;
      assert.strictEqual(g.titleMidRace, want[l], l);
      assert.ok(g.title !== g.titleMidRace, `${l} start title differs`);
      for (const k of ['titleNoFix', 'blockedBodyNoFix', 'blockedBodyLocationOffMidRace']) assert.ok(g[k], `${l} ${k}`);
      assert.ok(!startWord[l].test(g.blockedBodyLocationOffMidRace), `${l}: mid-race body must not say press Start`);
      assert.ok(!startWord[l].test(g.blockedBodyNoFix), `${l}: no-fix body must not say press Start`);
    }
  });

  // ── follow upload still in flight when a download lands ────────────────
  test('download lands while a follow\'s upload is still in flight → the follow survives (phone + server)', async () => {
    M.store.set('FOLLOWER_ID', '501');
    M.api.syncScript = [{ delay: 30 }];                // the follow's upload is slow
    const fs_ = FS();
    const following = fs_.followUser(77);
    await wait(5);
    const seq = fs_.getFollowWriteSeq();               // Home's download starts AFTER the follow
    await fs_.syncFollowDataFromAPI([], {}, seq);       // server doesn't have 77 yet
    await following;
    assert.deepStrictEqual(await fs_.getFollowedUsers(), [77], 'kept on the phone');
    await fs_.followUser(88);
    assert.deepStrictEqual(posts().pop().body.customer_app_id_string.split(',').sort(), ['77', '88'], 'and on the server');
  });
  test('slow upload succeeds AFTER a newer one failed → the "not synced" mark stays', async () => {
    M.store.set('FOLLOWER_ID', '501');
    M.api.syncScript = [{ delay: 30 }, { fail: true }];
    const fs_ = FS();
    const a = fs_.followUser(77);                        // slow, will succeed
    await wait(3);
    await fs_.followUser(88);                            // fails fast → pending
    await a;                                             // the older upload lands last
    assert.strictEqual(M.store.get('@PFSLive:followSyncPending'), '1', 'still ahead of the server');
    await fs_.syncFollowDataFromAPI([77], {});           // server only has 77
    assert.deepStrictEqual((await fs_.getFollowedUsers()).sort(), [77, 88]);
  });
  test('no local change pending → a download still applies normally', async () => {
    M.store.set('FOLLOWER_ID', '501');
    M.store.set('followed_users', JSON.stringify([1]));
    await FS().syncFollowDataFromAPI([1, 2], {});
    assert.deepStrictEqual((await FS().getFollowedUsers()).sort(), [1, 2]);
  });
};
