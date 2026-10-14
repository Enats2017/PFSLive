// Cases added in the EIGHTH round (2026-10-14). Registered by app.test.js.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

module.exports = function register({ M, load, test, SRC }) {
  const read = (p) => fs.readFileSync(path.resolve(SRC, p), 'utf8');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const SYNC = '/update_follower_favourites_api.php';
  const posts = () => M.api.posted.filter((p) => p.url.endsWith(SYNC));
  const FS = () => load('utils/followStorage');
  // "Kill and relaunch": drop every app module so in-memory state starts fresh;
  // phone storage (M.store) survives, as on a real phone.
  const relaunch = () => {
    for (const k of Object.keys(require.cache)) {
      if (k.replace(/\\/g, '/').startsWith(SRC)) delete require.cache[k];
    }
  };

  // ── follow uploads ────────────────────────────────────────────────────
  test('app killed while a follow uploads → after relaunch the download does NOT wipe it', async () => {
    M.store.set('FOLLOWER_ID', '501');
    M.api.syncScript = [{ delay: 200 }];               // the upload hangs
    const dangling = FS().followUser(77);               // not awaited: the app dies mid-upload
    await wait(10);
    assert.strictEqual(M.store.get('@PFSLive:followSyncPending'), '1', 'marked before sending');
    relaunch();
    M.api.syncScript = [];
    const fs2 = FS();
    await fs2.syncFollowDataFromAPI([], {});            // server never got 77
    assert.deepStrictEqual(await fs2.getFollowedUsers(), [77]);
    assert.strictEqual(posts().pop().body.customer_app_id_string, '77', 'pushed instead');
    // Let the "dead" upload finish inside THIS test, or it lands in the next one.
    await dangling.catch(() => {});
  });
  test('two quick follows → uploads arrive IN ORDER; the server ends with both', async () => {
    M.store.set('FOLLOWER_ID', '501');
    M.api.syncScript = [{ delay: 30 }, { delay: 1 }];  // first upload slow, second fast
    const fs_ = FS();
    const first = fs_.followUser(77);                  // its upload is built and sent …
    await wait(8);                                     // … and still in flight when
    await fs_.followUser(88);                          // the second follow happens
    await first;
    const sent = posts().map((p) => p.body.customer_app_id_string.split(',').sort().join(','));
    assert.strictEqual(sent[sent.length - 1], '77,88', `arrival order: ${JSON.stringify(sent)}`);
    assert.ok(!sent.slice(1).includes('77'), 'no older list lands after a newer one');
    assert.strictEqual(M.store.has('@PFSLive:followSyncPending'), false, 'all delivered');
  });
  test('a failed upload in the queue does not block the next one', async () => {
    M.store.set('FOLLOWER_ID', '501');
    M.api.syncScript = [{ fail: true }];
    const fs_ = FS();
    await fs_.followUser(77);                           // fails → pending
    assert.strictEqual(M.store.get('@PFSLive:followSyncPending'), '1');
    await fs_.followUser(88);                           // next upload goes through
    assert.strictEqual(posts().pop().body.customer_app_id_string.split(',').sort().join(','), '77,88');
    assert.strictEqual(M.store.has('@PFSLive:followSyncPending'), false);
  });

  // ── location popup (eighth audit) ─────────────────────────────────────
  test('"no GPS position" popup: no "Open settings" button (nothing to change there)', () => {
    const c = load('utils/locationPopupCopy').locationPopupCopy;
    assert.strictEqual(c({ midRace: true, noFix: true, reason: 'location_off', platform: 'android' }).showSettingsButton, false);
    assert.strictEqual(c({ midRace: true, noFix: false, reason: 'location_off', platform: 'android' }).showSettingsButton, true);
    assert.strictEqual(c({ midRace: false, noFix: false, reason: 'denied', platform: 'ios' }).showSettingsButton, true);
    assert.ok(/\{popupCopy\.showSettingsButton && \(/.test(read('screens/HomeScreen.tsx')), 'button rendered only when allowed');
  });
  test('mid-race, Location switched off → title says so (agrees with body + banner), en/fr/nl', () => {
    const c = load('utils/locationPopupCopy').locationPopupCopy;
    assert.strictEqual(c({ midRace: true, noFix: false, reason: 'location_off', platform: 'ios' }).titleKey, 'home:gpsHealth.titleLocationOffMidRace');
    assert.strictEqual(c({ midRace: true, noFix: false, reason: 'no_background_perm', platform: 'ios' }).titleKey, 'home:gpsHealth.titleMidRace');
    const want = { en: 'Location is switched off', fr: 'Localisation désactivée', nl: 'Locatie staat uit' };
    for (const l of ['en', 'fr', 'nl']) {
      assert.strictEqual(JSON.parse(read(`i18n/HomeScreen/${l}.json`)).gpsHealth.titleLocationOffMidRace, want[l], l);
    }
  });
  test('mid-race popup taps are NOT counted in the Start funnel', () => {
    const s = read('screens/HomeScreen.tsx');
    for (const step of ['sent_to_settings', 'dismissed']) {
      const at = s.indexOf(`'permission_result', '${step}'`);
      assert.ok(at > -1, step);
      assert.ok(/if \(!permissionModalMidRace\) \{\s*$/.test(s.slice(Math.max(0, at - 200), at).split('void analyticsService')[0]), `${step} guarded`);
    }
    const g = s.indexOf("perms.background ? 'granted' : (Date.now() - t0 > 700 ? 'denied' : 'no_prompt')");
    assert.ok(/if \(!permissionModalMidRace\) \{/.test(s.slice(g - 300, g)), 'granted/denied guarded');
  });
  test('French no-fix copy uses the improved wording', () => {
    const t = JSON.parse(read('i18n/HomeScreen/fr.json')).gpsHealth.blockedBodyNoFix;
    assert.ok(t.includes('sous un feuillage dense') && t.includes('dès que le GPS vous aura localisé'), t);
  });
};
