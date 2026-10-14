// Growth work (branch growth_v0.1) — app-side tests.
//   npm run test:growth
// Loads the real src/ modules with mocked native/network layers (harness.js).
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { M, load, test, run, textOf, findPressable, SRC } = require('./harness');

const read = (p) => fs.readFileSync(path.resolve(SRC, p), 'utf8');
const json = (p) => JSON.parse(read(p));
const flush = () => new Promise((r) => setImmediate(r));
const DAY = 24 * 60 * 60 * 1000;

const posts = (suffix) => M.api.posted.filter((p) => p.url.endsWith(suffix));

(async () => {
  const results = [];

  // ═════════════ 1. Share my live link ═════════════
  test('link: exact web URL, values encoded', () => {
    const { buildLiveLink } = load('components/Home/ShareTrackingLink');
    assert.strictEqual(buildLiveLink(42, 7, 'A 12&x'),
      'https://my.liviolive.com/livio_website/result_detail/?product_app_id=42&product_option_value_app_id=7&bib=A%2012%26x&from_live=1');
  });
  test('link: leading-zero bib kept as text ("007")', () => {
    const { buildLiveLink } = load('components/Home/ShareTrackingLink');
    assert.ok(buildLiveLink(1, 2, '007').includes('bib=007&'));
  });
  test('button hidden: no bib / bib "0" / no distance / no event', () => {
    const { ShareTrackingLink } = load('components/Home/ShareTrackingLink');
    const base = { productAppId: 1, povId: 2, bib: '15', raceName: 'R' };
    assert.notStrictEqual(ShareTrackingLink(base), null, 'shown with everything present');
    for (const over of [{ bib: '' }, { bib: null }, { bib: '0' }, { bib: '  ' }, { povId: 0 }, { povId: null }, { productAppId: 0 }]) {
      assert.strictEqual(ShareTrackingLink({ ...base, ...over }), null, 'hidden for ' + JSON.stringify(over));
    }
  });
  test('tap (iPhone) → share sheet gets the message with the link ONCE, logs "shared"', async () => {
    const { ShareTrackingLink } = load('components/Home/ShareTrackingLink');
    const el = ShareTrackingLink({ productAppId: 9, povId: 3, bib: '21', raceName: 'Ghent 10K' });
    await findPressable(el).props.onPress();
    assert.strictEqual(M.shares.length, 1);
    assert.strictEqual(M.shares[0].url, undefined, 'no separate url on iOS (it would be appended twice)');
    const m = M.shares[0].message;
    assert.ok(m.startsWith('readiness:share.message') && m.includes('Ghent 10K'));
    assert.ok(m.includes('product_app_id=9') && m.includes('bib=21'), 'link inside the message');
    assert.deepStrictEqual(M.analytics.find((a) => a[0] === 'logShareLiveLink'), ['logShareLiveLink', 'shared']);
  });
  test('tap (Android) → message + url (Android ignores url, harmless)', async () => {
    M.os = 'android';
    const { ShareTrackingLink } = load('components/Home/ShareTrackingLink');
    await findPressable(ShareTrackingLink({ productAppId: 9, povId: 3, bib: '21', raceName: 'R' })).props.onPress();
    assert.ok(M.shares[0].url.includes('bib=21') && M.shares[0].message.includes('bib=21'));
  });
  test('tap → dismissed sheet logs "dismissed"; no race name uses short copy', async () => {
    M.shareAction = 'dismissedAction';
    const { ShareTrackingLink } = load('components/Home/ShareTrackingLink');
    const el = ShareTrackingLink({ productAppId: 9, povId: 3, bib: '21', raceName: '' });
    await findPressable(el).props.onPress();
    assert.ok(M.shares[0].message.startsWith('readiness:share.messageNoRace'));
    assert.deepStrictEqual(M.analytics.find((a) => a[0] === 'logShareLiveLink'), ['logShareLiveLink', 'dismissed']);
  });

  // ═════════════ 2. Pre-race countdown ═════════════
  test('start time: same maths as the Start gate (fake-UTC diff + fetch time)', () => {
    const { computeRaceStartMs } = load('components/Home/PreRaceCountdown');
    const fetched = 1_000_000;
    assert.strictEqual(computeRaceStartMs('2026-10-16', '09:30:00', '2026-10-14 08:00:00', fetched),
      fetched + (2 * 24 * 60 + 90) * 60000);
  });
  test('start time: independent of the phone timezone (event-tz strings only)', () => {
    const { computeRaceStartMs } = load('components/Home/PreRaceCountdown');
    // Event in Asia/Kolkata: both strings are Kolkata wall-clock → diff 1h.
    assert.strictEqual(computeRaceStartMs('2026-10-14', '10:00:00', '2026-10-14 09:00:00', 5), 5 + 3600000);
  });
  test('start time: missing or bad input → null (no countdown)', () => {
    const { computeRaceStartMs } = load('components/Home/PreRaceCountdown');
    assert.strictEqual(computeRaceStartMs(undefined, '09:00', '2026-10-14 08:00:00', 1), null);
    assert.strictEqual(computeRaceStartMs('2026-10-16', '', '2026-10-14 08:00:00', 1), null);
    assert.strictEqual(computeRaceStartMs('2026-10-16', '09:00:00', undefined, 1), null);
    assert.strictEqual(computeRaceStartMs('garbage', '09:00:00', '2026-10-14 08:00:00', 1), null);
  });
  test('countdown label: days+hours / hours+minutes / starting soon / hidden after gun', () => {
    const { PreRaceCountdown } = load('components/Home/PreRaceCountdown');
    const now = M.clock;
    const label = (ms) => textOf(PreRaceCountdown({ startAtMs: now + ms }));
    assert.ok(label(2 * DAY + 4 * 3600000 + 60000).includes('"time":"readiness:countdown.days{\\"count\\":2} readiness:countdown.hours{\\"count\\":4}"'), label(2 * DAY + 4 * 3600000 + 60000));
    assert.ok(label(3 * 3600000 + 25 * 60000 + 1000).includes('countdown.hours{\\"count\\":3} readiness:countdown.minutes{\\"count\\":25}'));
    assert.strictEqual(label(30000), 'readiness:countdown.startingSoon');
    assert.strictEqual(label(-10 * 60000), 'readiness:countdown.started', 'after the gun: "race started", not "starting soon"');
    assert.strictEqual(PreRaceCountdown({ startAtMs: now - 31 * 60000 }), null, 'gone 30 min after the gun');
    assert.strictEqual(PreRaceCountdown({ startAtMs: null }), null);
  });

  // ═════════════ 3. Readiness state ═════════════
  test('readiness: everything OK (iOS) → nothing missing, ready, battery n/a', async () => {
    M.notif.status = 'granted';
    const s = await load('services/readinessService').readinessService.getState();
    assert.deepStrictEqual(s.missing, []);
    assert.strictEqual(s.trackingReady, true);
    assert.strictEqual(s.batteryExempt, null);
  });
  test('readiness: notifications off → missing, but still tracking-ready', async () => {
    M.notif.status = 'denied';
    const s = await load('services/readinessService').readinessService.getState();
    assert.deepStrictEqual(s.missing, ['notifications']);
    assert.strictEqual(s.trackingReady, true);
  });
  test('readiness: "while using" only → background missing, NOT ready', async () => {
    M.notif.status = 'granted'; M.gps.background = false; M.gps.level = 'when_in_use';
    const s = await load('services/readinessService').readinessService.getState();
    assert.deepStrictEqual(s.missing, ['background']);
    assert.strictEqual(s.trackingReady, false);
  });
  test('readiness: no location → "location" (not background) missing', async () => {
    M.notif.status = 'granted'; M.gps.foreground = false; M.gps.background = false; M.gps.level = 'denied';
    const s = await load('services/readinessService').readinessService.getState();
    assert.deepStrictEqual(s.missing, ['location']);
  });
  test('readiness: phone location switched off → missing + not ready', async () => {
    M.notif.status = 'granted'; M.gps.servicesOn = false;
    const s = await load('services/readinessService').readinessService.getState();
    assert.deepStrictEqual(s.missing, ['locationServices']);
    assert.strictEqual(s.trackingReady, false);
  });
  test('readiness: Android battery optimisation on → "battery" missing', async () => {
    M.os = 'android'; M.notif.status = 'granted'; M.battery.exempt = false;
    const s = await load('services/readinessService').readinessService.getState();
    assert.deepStrictEqual(s.missing, ['battery']);
    assert.strictEqual(s.trackingReady, true, 'battery is advice, not a blocker');
  });
  test('readiness: battery read fails → unknown, never shown as a problem', async () => {
    M.os = 'android'; M.notif.status = 'granted'; M.battery.exemptThrows = true;
    const s = await load('services/readinessService').readinessService.getState();
    assert.strictEqual(s.batteryExempt, null);
    assert.deepStrictEqual(s.missing, []);
  });
  test('readiness: power saving → listed, does not block', async () => {
    M.notif.status = 'granted'; M.battery.lowPower = true;
    const s = await load('services/readinessService').readinessService.getState();
    assert.deepStrictEqual(s.missing, ['powerSaving']);
    assert.strictEqual(s.trackingReady, true);
  });
  test('readiness: several problems come in fixing order', async () => {
    M.os = 'android'; M.gps.background = false; M.gps.level = 'when_in_use';
    M.gps.servicesOn = false; M.battery.exempt = false; M.battery.lowPower = true;
    const s = await load('services/readinessService').readinessService.getState();
    // phone-wide location switch first (iOS: app permission unusable while it is off)
    assert.deepStrictEqual(s.missing, ['locationServices', 'notifications', 'background', 'battery', 'powerSaving']);
  });
  test('report to server: correct payload, sent once per change', async () => {
    const { readinessService } = load('services/readinessService');
    M.os = 'android'; M.gps.background = false; M.gps.level = 'when_in_use';
    await readinessService.getState(); await flush();
    await readinessService.getState(); await flush();
    let sent = posts('/update_device_readiness_api.php');
    assert.strictEqual(sent.length, 1, 'same state twice → one call');
    assert.deepStrictEqual(sent[0].body, { device_id: 'dev-1', location_permission: 'when_in_use',
      notifications_enabled: 0, tracking_ready: 0, platform: 'android', app_version: '1.1.0' });
    M.gps.background = true; M.gps.level = 'always'; M.notif.status = 'granted';
    await readinessService.getState(); await flush();
    sent = posts('/update_device_readiness_api.php');
    assert.strictEqual(sent.length, 2, 'changed → second call');
    assert.strictEqual(sent[1].body.tracking_ready, 1);
    assert.strictEqual(sent[1].body.notifications_enabled, 1);
  });
  test('report to server: failure is silent and retried next time', async () => {
    const { readinessService } = load('services/readinessService');
    M.api.fail = true;
    await readinessService.getState(); await flush();   // must not throw
    M.api.fail = false;
    await readinessService.getState(); await flush();
    assert.strictEqual(posts('/update_device_readiness_api.php').length, 1);
  });

  // ═════════════ 4. "Get race-ready" — when it opens ═════════════
  const RR = () => load('services/raceReadyService').raceReadyService;
  test('race-ready: something missing → opens once, with race name + source', async () => {
    M.gps.background = false;
    assert.strictEqual(await RR().maybeOpen({ raceKey: 13, raceName: 'Trail', source: 'connect' }), true);
    assert.deepStrictEqual(M.nav.navigations, [{ name: 'RaceReady', params: { race_name: 'Trail', source: 'connect' } }]);
    assert.ok(M.analytics.some((a) => a[0] === 'logRaceReadyStep' && a[1] === 'shown' && a[3] === 'connect'));
  });
  test('race-ready: same race again → never twice', async () => {
    M.gps.background = false;
    await RR().maybeOpen({ raceKey: 13, source: 'connect' });
    assert.strictEqual(await RR().maybeOpen({ raceKey: 13, source: 'home' }), false);
    assert.strictEqual(M.nav.navigations.length, 1);
  });
  test('race-ready: a different race → opens again', async () => {
    M.gps.background = false;
    await RR().maybeOpen({ raceKey: 13, source: 'connect' });
    assert.strictEqual(await RR().maybeOpen({ raceKey: 14, source: 'connect' }), true);
  });
  test('race-ready: all set → does not open, and is remembered as done', async () => {
    M.notif.status = 'granted';
    assert.strictEqual(await RR().maybeOpen({ raceKey: 13, source: 'connect' }), false);
    assert.strictEqual(M.nav.navigations.length, 0);
    M.notif.status = 'denied';  // revoked later → the card handles it, no popup
    assert.strictEqual(await RR().maybeOpen({ raceKey: 13, source: 'home' }), false);
  });
  test('race-ready: only power saving on → not a reason to open', async () => {
    M.notif.status = 'granted'; M.battery.lowPower = true;
    assert.strictEqual(await RR().maybeOpen({ raceKey: 13, source: 'home' }), false);
  });
  test('race-ready: user moved to another screen → not opened, not used up', async () => {
    M.gps.background = false; M.nav.route = 'LiveTracking';
    assert.strictEqual(await RR().maybeOpen({ raceKey: 13, source: 'home', onlyFromRoute: 'HomeScreen' }), false);
    assert.strictEqual(M.nav.navigations.length, 0);
    M.nav.route = 'HomeScreen';
    assert.strictEqual(await RR().maybeOpen({ raceKey: 13, source: 'home', onlyFromRoute: 'HomeScreen' }), true);
  });
  test('race-ready: no race id → nothing', async () => {
    M.gps.background = false;
    assert.strictEqual(await RR().maybeOpen({ raceKey: null, source: 'home' }), false);
    assert.strictEqual(await RR().maybeOpen({ raceKey: '', source: 'home' }), false);
  });
  test('race-ready: memory older than 120 days is dropped', async () => {
    M.gps.background = false;
    M.store.set('@PFSLive:raceReadyShown', JSON.stringify({ 13: M.clock - 121 * DAY, 14: M.clock - 5 * DAY }));
    assert.strictEqual(await RR().maybeOpen({ raceKey: 13, source: 'home' }), true);
    assert.strictEqual(await RR().maybeOpen({ raceKey: 14, source: 'home' }), false);
  });
  test('race-ready: navigator never ready → gives up after ~5 s, not used up', async () => {
    M.gps.background = false; M.nav.ready = false;
    const t0 = process.hrtime.bigint();
    assert.strictEqual(await RR().maybeOpen({ raceKey: 13, source: 'email_confirm' }), false);
    assert.ok(Number(process.hrtime.bigint() - t0) / 1e6 >= 4900);
    M.nav.ready = true;
    assert.strictEqual(await RR().maybeOpen({ raceKey: 13, source: 'home' }), true);
  });

  // ═════════════ 5. Fan notification ask after a follow ═════════════
  const FP = () => load('store/useFollowPromptStore');
  test('fan: first follow, never asked → sheet shows', async () => {
    const m = FP();
    await m.maybePromptNotificationsAfterFollow();
    assert.strictEqual(m.useFollowPromptStore.getState().visible, true);
    assert.ok(M.analytics.some((a) => a[0] === 'logNotificationAsk' && a[1] === 'follow' && a[2] === 'shown'));
  });
  test('fan: already allowed → no sheet', async () => {
    M.notif.status = 'granted';
    const m = FP(); await m.maybePromptNotificationsAfterFollow();
    assert.strictEqual(m.useFollowPromptStore.getState().visible, false);
  });
  test('fan: OS will not ask again → no sheet (Settings screen is the route)', async () => {
    M.notif.status = 'denied'; M.notif.canAskAgain = false;
    const m = FP(); await m.maybePromptNotificationsAfterFollow();
    assert.strictEqual(m.useFollowPromptStore.getState().visible, false);
  });
  test('fan: "Not now" → quiet for 30 days, then asks again', async () => {
    let m = FP();
    await m.markFollowPromptDismissed();
    M.clock += 29 * DAY;
    await m.maybePromptNotificationsAfterFollow();
    assert.strictEqual(m.useFollowPromptStore.getState().visible, false, 'day 29');
    M.clock += 2 * DAY;
    await m.maybePromptNotificationsAfterFollow();
    assert.strictEqual(m.useFollowPromptStore.getState().visible, true, 'day 31');
  });
  test('fan: simulator / no notifications module → no sheet', async () => {
    M.notif.isDevice = false;
    const m = FP(); await m.maybePromptNotificationsAfterFollow();
    assert.strictEqual(m.useFollowPromptStore.getState().visible, false);
  });
  test('fan: two follows at once → one sheet, one "shown" event', async () => {
    const m = FP();
    await Promise.all([m.maybePromptNotificationsAfterFollow(), m.maybePromptNotificationsAfterFollow()]);
    assert.strictEqual(M.analytics.filter((a) => a[0] === 'logNotificationAsk' && a[2] === 'shown').length, 1);
  });

  // ═════════════ 6. Notification permission + token ═════════════
  const NP = () => load('services/notificationPermissionService').notificationPermissionService;
  test('launch: never shows the OS prompt (undetermined stays undetermined)', async () => {
    assert.strictEqual(await NP().registerIfGranted(), null);
    assert.strictEqual(M.notif.requests, 0);
    assert.strictEqual(M.fapi.registerCalls.length, 0);
  });
  test('launch: already allowed → token fetched, sent to server, follower id stored', async () => {
    M.notif.status = 'granted';
    const heard = [];
    const np = NP(); np.onTokenChange((tk) => heard.push(tk));
    assert.strictEqual(await np.registerIfGranted(), 'ExponentPushToken[abc]');
    assert.deepStrictEqual(M.fapi.registerCalls, ['ExponentPushToken[abc]']);
    assert.strictEqual(M.store.get('FOLLOWER_ID'), '501');
    assert.deepStrictEqual(heard, ['ExponentPushToken[abc]']);
  });
  test('foreground again: no second Expo/token call in the same session', async () => {
    M.notif.status = 'granted';
    const np = NP(); await np.registerIfGranted(); await np.registerIfGranted();
    assert.strictEqual(M.notif.tokenFetches, 1);
  });
  test('token unchanged since last launch → server not called again', async () => {
    M.notif.status = 'granted'; M.store.set('expo_push_token', 'ExponentPushToken[abc]');
    await NP().registerIfGranted();
    assert.strictEqual(M.fapi.registerCalls.length, 0);
  });
  test('switched off in Settings → listeners hear null', async () => {
    M.notif.status = 'granted';
    const heard = []; const np = NP(); np.onTokenChange((tk) => heard.push(tk));
    await np.registerIfGranted();
    M.notif.status = 'denied';
    await np.registerIfGranted();
    assert.deepStrictEqual(heard, ['ExponentPushToken[abc]', null]);
  });
  test('switched on in Settings → picked up when the app comes back', async () => {
    const np = NP();
    M.notif.status = 'granted';
    M.appStateListeners.forEach((cb) => cb('active'));
    await new Promise((r) => setTimeout(r, 30));
    assert.strictEqual(np.getCurrentToken(), 'ExponentPushToken[abc]');
  });
  test('ask: OS still allows → prompt once, grant → registered', async () => {
    const st = await NP().request();
    assert.strictEqual(st.status, 'granted');
    assert.strictEqual(M.notif.requests, 1);
    assert.deepStrictEqual(M.fapi.registerCalls, ['ExponentPushToken[abc]']);
    assert.ok(M.analytics.some((a) => a[0] === 'syncPermissionProperties'));
  });
  test('ask: user says no → no token, status denied', async () => {
    M.notif.requestResult = { status: 'denied', canAskAgain: false };
    const st = await NP().request();
    assert.deepStrictEqual(st, { status: 'denied', canAskAgain: false });
    assert.strictEqual(M.fapi.registerCalls.length, 0);
  });
  test('ask: OS will not ask again → no prompt at all', async () => {
    M.notif.status = 'denied'; M.notif.canAskAgain = false;
    await NP().request();
    assert.strictEqual(M.notif.requests, 0);
  });
  test('Android: channel created before the prompt (Android 13 needs it)', async () => {
    M.os = 'android';
    await NP().request();
    assert.ok(M.notif.channels >= 1);
  });

  // ═════════════ 7. Following without notifications ═════════════
  const FS = () => load('utils/followStorage');
  test('follower id: existing id → no network call', async () => {
    M.store.set('FOLLOWER_ID', '77');
    assert.deepStrictEqual(await FS().ensureFollowerId(), { id: 77, adopted: false });
    assert.strictEqual(M.fapi.guestCalls, 0);
  });
  test('follower id: none → ONE guest registration even for 3 parallel calls', async () => {
    M.fapi.guestDelay = 20;
    const fs_ = FS();
    const r = await Promise.all([fs_.ensureFollowerId(), fs_.ensureFollowerId(), fs_.ensureFollowerId()]);
    assert.strictEqual(M.fapi.guestCalls, 1);
    assert.ok(r.every((x) => x.id === 501));
    assert.strictEqual(M.store.get('FOLLOWER_ID'), '501');
  });
  test('follower id: offline → null, nothing stored', async () => {
    M.fapi.guestFail = true;
    assert.deepStrictEqual(await FS().ensureFollowerId(), { id: null, adopted: false });
    assert.strictEqual(M.store.has('FOLLOWER_ID'), false);
  });
  test('follow with push OFF → reaches the server (used to be dropped)', async () => {
    await FS().followUser(300);
    const sync = posts('/update_follower_favourites_api.php');
    assert.strictEqual(sync.length, 1);
    assert.strictEqual(sync[0].body.follower_id, 501);
    assert.strictEqual(sync[0].body.customer_app_id_string, '300');
    assert.strictEqual(M.store.has('@PFSLive:followSyncPending'), false);
  });
  test('first id on a phone the web already used → server follows merged, not lost', async () => {
    M.fapi.byDevice = { follower_id: 501, followed_customers: [111], followed_bibs: { 13: ['7'] } };
    await FS().followUser(300);
    const body = posts('/update_follower_favourites_api.php').pop().body;
    assert.deepStrictEqual(body.customer_app_id_string.split(',').sort(), ['111', '300']);
    assert.deepStrictEqual(body.bib_number_string, { 13: '7' });
    assert.deepStrictEqual((await FS().getFollowedUsers()).sort(), [111, 300]);
  });
  test('follow while offline → kept on phone, marked to send later', async () => {
    M.fapi.guestFail = true;
    await FS().followUser(300);
    assert.deepStrictEqual(await FS().getFollowedUsers(), [300]);
    assert.strictEqual(M.store.get('@PFSLive:followSyncPending'), '1');
  });
  test('pending follow is pushed, not overwritten by the next download', async () => {
    M.store.set('FOLLOWER_ID', '501'); M.api.fail = true;
    await FS().followUser(300);              // sync fails → pending
    M.api.fail = false;
    await FS().syncFollowDataFromAPI([], {}); // server still empty
    assert.deepStrictEqual(await FS().getFollowedUsers(), [300]);
    assert.strictEqual(posts('/update_follower_favourites_api.php').pop().body.customer_app_id_string, '300');
  });
  test('restore (no token): phone knows its id → server list downloaded', async () => {
    M.store.set('FOLLOWER_ID', '501');
    M.fapi.byDevice = { follower_id: 501, followed_customers: [5, 6], followed_bibs: {} };
    await FS().restoreFollowsWithoutToken();
    assert.deepStrictEqual((await FS().getFollowedUsers()).sort(), [5, 6]);
    assert.strictEqual(M.fapi.guestCalls, 0);
  });
  test('restore (no token): reinstall, server knows device → id + follows back', async () => {
    M.fapi.byDevice = { follower_id: 888, followed_customers: [5], followed_bibs: { 20: ['44'] } };
    await FS().restoreFollowsWithoutToken();
    assert.strictEqual(M.store.get('FOLLOWER_ID'), '888');
    assert.deepStrictEqual(await FS().getFollowedUsers(), [5]);
    assert.deepStrictEqual(await FS().getFollowedBibs(20), ['44']);
    assert.strictEqual(M.fapi.guestCalls, 0);
  });
  test('restore (no token): brand-new user with no follows → NO server row created', async () => {
    await FS().restoreFollowsWithoutToken();
    assert.strictEqual(M.fapi.guestCalls, 0);
    assert.strictEqual(M.api.posted.length, 0);
  });
  test('restore (no token): local follows, unknown device → row created and pushed', async () => {
    M.store.set('followed_users', JSON.stringify([42]));
    await FS().restoreFollowsWithoutToken();
    assert.strictEqual(M.fapi.guestCalls, 1);
    assert.strictEqual(posts('/update_follower_favourites_api.php').pop().body.customer_app_id_string, '42');
  });
  test('bib follow with push OFF → synced with its race', async () => {
    await FS().followBib(13, '0042');
    const body = posts('/update_follower_favourites_api.php').pop().body;
    assert.deepStrictEqual(body.bib_number_string, { 13: '0042' });
  });

  // ═════════════ 8. Source-level guarantees (other flows untouched) ═════════════
  test('launch no longer asks for notifications (useNotifications)', () => {
    assert.ok(!/requestPermissionsAsync/.test(read('hooks/useNotifications.ts')));
  });
  test('live map no longer asks fans for location', () => {
    const s = read('screens/LiveTrackingScreen.tsx');
    assert.ok(!/requestForegroundPermissionsAsync/.test(s));
    assert.ok(/getForegroundPermissionsAsync/.test(s) && /isTracking\(\)/.test(s));
  });
  test('first-launch battery popup removed from Home', () => {
    assert.ok(!/useEffect\(\(\) => \{\s*checkAndPromptBatteryOptimization\(\);/.test(read('screens/HomeScreen.tsx')));
  });
  test('Start flow untouched: requestPermissionsDetailed + start gate still in HomeScreen', () => {
    const s = read('screens/HomeScreen.tsx');
    assert.ok(/requestPermissionsDetailed/.test(s));
    assert.ok(/doStartGPSTracking/.test(s));
  });
  test('home race-ready trigger only on Home, >3 h before, not while tracking', () => {
    const s = read('screens/HomeScreen.tsx');
    assert.ok(/next_race_in_hours \?\? 0\) > 3/.test(s));
    assert.ok(/onlyFromRoute: 'HomeScreen'/.test(s));
    assert.ok(/isGPSActive\) return;/.test(s));
  });
  test('email link never registers (auto_register_id null, preselect only)', () => {
    const s = read('../App.tsx');
    const at = s.indexOf('Exactly livio://event');
    assert.ok(at > -1, 'event-link handler found');
    const block = s.slice(at, at + 1500);
    assert.ok(/auto_register_id: null/.test(block) && /preselect_pov_id/.test(block));
  });
  test('screens registered in navigator + typed', () => {
    const nav = read('navigation/AppNavigator.tsx'), types = read('types/navigation.ts');
    for (const n of ['RaceReady', 'NotificationSettings']) {
      assert.ok(new RegExp(`name="${n}"`).test(nav), n + ' in navigator');
      assert.ok(new RegExp(`${n}:`).test(types), n + ' in types');
    }
  });
  test('translations: readiness keys identical in en / fr / nl', () => {
    const flat = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (typeof v === 'object' ? flat(v, p + k + '.') : [p + k]));
    const en = flat(json('i18n/Readiness/en.json')).sort();
    for (const l of ['fr', 'nl']) assert.deepStrictEqual(flat(json(`i18n/Readiness/${l}.json`)).sort(), en, l);
  });
  test('translations: every readiness key used in code exists', () => {
    const en = json('i18n/Readiness/en.json');
    const has = (k) => k.split('.').reduce((o, p) => (o && typeof o === 'object' ? o[p] : undefined), en) !== undefined;
    const files = ['screens/RaceReadyScreen.tsx', 'components/Home/ReadinessCard.tsx', 'components/Home/ShareTrackingLink.tsx',
      'components/Home/PreRaceCountdown.tsx', 'components/Home/IdleHome.tsx', 'components/FollowNotificationPrompt.tsx',
      'screens/SettingScreen/NotificationSettingsScreen.tsx', 'screens/SettingScreen/LiveTrackingSettingsScreen.tsx'];
    const missing = [];
    for (const f of files) for (const m of read(f).matchAll(/'readiness:([a-zA-Z0-9_.]+)'/g)) if (!has(m[1])) missing.push(`${f}: ${m[1]}`);
    // keys built from a variable, e.g. `readiness:items.${item}.title`
    // ReadinessCard: items.${item} + items.${item}Why — every readiness item
    for (const item of ['notifications', 'location', 'background', 'locationServices', 'battery', 'powerSaving']) {
      for (const k of [`items.${item}`, `items.${item}Why`]) if (!has(k)) missing.push(k);
    }
    // RaceReadyScreen: raceReady.steps.${step}.title/.body — every race-ready step
    for (const step of ['notifications', 'location', 'background', 'locationServices', 'battery']) {
      for (const k of [`raceReady.steps.${step}.title`, `raceReady.steps.${step}.body`]) if (!has(k)) missing.push(k);
    }
    assert.deepStrictEqual(missing, []);
  });
  test('server endpoints the app calls exist in larssie/api (if checked out)', () => {
    const api = 'C:/xampp/htdocs/larssie/api/';
    if (!fs.existsSync(api)) return;
    for (const f of ['update_device_readiness_api.php', 'register_guest_follower.php', 'get_follow_data_by_device.php', 'update_follower_favourites_api.php']) {
      assert.ok(fs.existsSync(api + f), f);
    }
  });

  // Cases added by the 2026-10-14 code audit (one per finding + gaps).
  require('./audit.cases')({ M, load, test, SRC });
  require('./audit2.cases')({ M, load, test, SRC });
  require('./audit3.cases')({ M, load, test, SRC });
  require('./audit4.cases')({ M, load, test, SRC });
  require('./audit5.cases')({ M, load, test, SRC });
  require('./audit6.cases')({ M, load, test, SRC });
  require('./audit7.cases')({ M, load, test, SRC });

  results.push(await run('growth — app'));
  const pass = results.reduce((a, r) => a + r.pass, 0), fail = results.reduce((a, r) => a + r.fail, 0);
  console.log(`\nGROWTH APP TOTAL: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
