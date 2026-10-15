// Cases added in the NINETEENTH round — the exhaustive final audit (2026-10-15).
// Registered by app.test.js.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

module.exports = function register({ M, load, test, SRC }) {
  const { CONFIG } = require('./harness');
  const read = (p) => fs.readFileSync(path.resolve(SRC, p), 'utf8');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const SYNC = '/update_follower_favourites_api.php';
  const ok = () => M.api.posted.filter((p) => p.url.endsWith(SYNC) && !p.rejected);
  const FS = () => load('utils/followStorage');
  const NP = () => load('services/notificationPermissionService').notificationPermissionService;
  const list = (p) => p.body.customer_app_id_string.split(',').filter(Boolean).map(Number).sort((a, b) => a - b);

  // ── follow sync ──────────────────────────────────────────────────────
  test('merge: "not synced" is written BEFORE the merge-pending flag is cleared (kill-safe)', async () => {
    M.store.set('FOLLOWER_ID', '501');
    M.store.set('@PFSLive:followAdoptPending', '1');
    M.fapi.byDevice = { follower_id: 501, followed_customers: [3], followed_bibs: {} };
    await FS().followUser(1);
    const set = M.writes.indexOf('@PFSLive:followSyncPending');
    const del = M.writes.indexOf('-@PFSLive:followAdoptPending');
    assert.ok(set > -1 && del > -1 && set < del, `writes: ${M.writes.join(' ')}`);
  });
  test('an unfollow tapped while the merge download is landing is NOT added back', async () => {
    M.store.set('FOLLOWER_ID', '501');
    M.store.set('followed_users', JSON.stringify([7]));
    M.store.set('@PFSLive:followAdoptPending', '1');
    M.fapi.byDevice = { follower_id: 501, followed_customers: [7], followed_bibs: {} };
    M.fapi.byDeviceDelay = 30;
    M.storeDelay = 2;
    const fs_ = FS();
    const a = fs_.followUser(1);                  // starts the merge
    await wait(28);                                // the download is about to land
    await fs_.unfollowUser(7);
    await a;
    await wait(80);
    assert.ok(!(await fs_.getFollowedUsers()).includes(7), 'not back on the phone');
    const last = ok().pop();
    assert.ok(last && !list(last).includes(7), `pushed ${last && last.body.customer_app_id_string}`);
  });

  // ── push registration ────────────────────────────────────────────────
  test('a HUNG push-token POST does not block permission requests for the session (time-limited)', async () => {
    const saved = CONFIG.API_CONFIG.TIMEOUT;
    CONFIG.API_CONFIG.TIMEOUT = 50;               // limit = TIMEOUT + 5 s
    try {
      M.notif.status = 'granted';
      M.fapi.registerDelay = 1e9;
      const t0 = Date.now();
      const r = await NP().registerIfGranted();
      assert.strictEqual(r, null, 'not registered');
      assert.ok(Date.now() - t0 < 8000, 'released');
    } finally { CONFIG.API_CONFIG.TIMEOUT = saved; }
  });
  test('home download by token says "follower_not_found" → the token is sent again (source)', () => {
    const s = read('screens/HomeScreen.tsx');
    const at = s.indexOf('const data = await followerApi.getFollowerData(expoPushToken);');
    const body = s.slice(at, at + 1200);
    assert.ok(/e\?\.code === 'follower_not_found'/.test(body));
    assert.ok(/forgetSentPushToken\(\);[\s\S]{0,80}registerIfGranted\(\)/.test(body));
  });

  // ── follow prompt ────────────────────────────────────────────────────
  test('the follow sheet is not opened again while its own OS dialog is up', async () => {
    M.notif.status = 'undetermined';
    const m = load('store/useFollowPromptStore');
    m.setFollowPromptAsking(true);
    await m.maybePromptNotificationsAfterFollow();
    assert.strictEqual(m.useFollowPromptStore.getState().visible, false);
    m.setFollowPromptAsking(false);
    await m.maybePromptNotificationsAfterFollow();
    assert.strictEqual(m.useFollowPromptStore.getState().visible, true, 'control: shown otherwise');
  });

  // ── countdown ────────────────────────────────────────────────────────
  test('countdown uses the server start instant (DST-correct), wall-clock maths only as fallback', () => {
    const { startMsFromServer } = load('components/Home/PreRaceCountdown');
    assert.strictEqual(startMsFromServer(1000 + 3600, 1000, 5_000_000), 5_000_000 + 3_600_000);
    assert.strictEqual(startMsFromServer(0, 1000, 5), null);
    assert.strictEqual(startMsFromServer(undefined, undefined, 5), null);
    const s = read('screens/HomeScreen.tsx');
    assert.ok(/startMsFromServer\(homeData\?\.next_race_start_ts, homeData\?\.server_now_ts, Date\.now\(\)\) \?\?\s*computeRaceStartMs\(/.test(s));
  });

  // ── Start gate / popup ───────────────────────────────────────────────
  test('Start gate checks the phone-wide Location switch BEFORE the app permission (iOS reports "denied" while it is off)', () => {
    const s = read('screens/HomeScreen.tsx');
    const g = s.indexOf('const perms = await gpsService.getPermissionState();\n      setHasPermission(perms.foreground);\n      setPermissionCanAskAgain(perms.canAskAgain);'.replace(/\n/g, s.includes('\r\n') ? '\r\n' : '\n'));
    assert.ok(g > 0, 'gate');
    const body = s.slice(g, g + 2500);
    const off = body.indexOf("setPermissionBlockReason('location_off')");
    const perm = body.indexOf('if (!perms.foreground || !perms.background)');
    assert.ok(off > 0 && perm > 0 && off < perm, 'switch first');
  });
  test('no "No race coming up" card over a running session', () => {
    assert.ok(read('screens/HomeScreen.tsx').includes('homeData.show_start_track !== 1 && !isGPSActive && <IdleHome />'));
  });

  // ── readiness: precise location ──────────────────────────────────────
  test('approximate location is a readiness item (not "all set"), with a Get race-ready step and copy in en/fr/nl', () => {
    const r = read('services/readinessService.ts');
    assert.ok(r.includes("if (perm.foreground && precise === false) missing.push('precise');"));
    assert.ok(r.includes('trackingReady: perm.foreground && perm.background && servicesOn && precise !== false'));
    assert.ok(/'precise',/.test(read('services/raceReadyService.ts')));
    assert.ok(read('screens/RaceReadyScreen.tsx').includes("case 'precise': {"));
    for (const l of ['en', 'fr', 'nl']) {
      const d = JSON.parse(fs.readFileSync(path.resolve(SRC, `i18n/Readiness/${l}.json`), 'utf8'));
      assert.ok(d.items.precise && d.items.preciseWhy, `${l} items`);
      assert.ok(d.raceReady.steps.precise && d.raceReady.steps.precise.title && d.raceReady.steps.precise.body, `${l} step`);
    }
  });

  // ── small ones ───────────────────────────────────────────────────────
  test('deep links: absurd ids rejected, event name capped, our own links never taken for a GPX file', () => {
    const { positiveInt, parseEventLink } = load('utils/deepLink');
    assert.strictEqual(positiveInt('99999999999999999999'), null);
    assert.strictEqual(positiveInt('42'), 42);
    const p = parseEventLink('livio://event?product_app_id=5&event_name=' + 'x'.repeat(300));
    assert.strictEqual(p.event_name.length, 120);
    assert.ok(read('../App.tsx').includes("!/^livio:/i.test(url) && /\\.gpx(\\?|$)/i.test(url)"));
  });
  test('guest settings never apply the server DEFAULT language (found:false)', () => {
    assert.ok(read('screens/SettingScreen/GuestTrackingSettings.tsx').includes('if (!found) return;'));
    assert.ok(read('services/guestSettingsService.ts').includes('found: json.data.found !== false'));
  });
  test('battery step never throws when the phone has neither settings page', () => {
    const s = read('utils/deviceSettings.ts');
    assert.ok(/catch \{\s*\/\/ Fallback[\s\S]{0,200}try \{\s*await IntentLauncher\.startActivityAsync\(\s*'android\.settings\.IGNORE_BATTERY_OPTIMIZATION_SETTINGS'/.test(s));
  });
  test('notifications "Turn on" with no OS dialog opens Settings (settings screen + Get race-ready)', () => {
    for (const f of ['screens/SettingScreen/NotificationSettingsScreen.tsx', 'screens/RaceReadyScreen.tsx']) {
      const s = read(f);
      assert.ok(/watchForOsPrompt\(\)/.test(s), f);
      assert.ok(/!== 'granted' && !(shown|notifShown)\)[\s\S]{0,140}openSettings\(\)/.test(s), f);
    }
  });
  test('Start popup copy no longer says "press Start again" (the start resumes by itself); no-fix banner agrees with the popup', () => {
    for (const l of ['en', 'fr', 'nl']) {
      const g = JSON.parse(fs.readFileSync(path.resolve(SRC, `i18n/HomeScreen/${l}.json`), 'utf8')).gpsHealth;
      assert.ok(!/press Start again|de nouveau sur Démarrer|opnieuw op Start/.test(g.blockedBodyLocationOff), l);
      assert.ok(!/not being recorded|n'est pas enregistrée|niet opgenomen/.test(g.bannerNoFix), l);
    }
  });
};
