// Cases added in the TWENTY-SECOND round (2026-10-15). Registered by app.test.js.
// Each one fails on the code before this round (checked with APP_SRC pointing
// at a `git archive HEAD` copy) and passes after.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

module.exports = function register({ M, load, test, SRC }) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const read = (p) => fs.readFileSync(path.resolve(SRC, p), 'utf8');
  const exists = (p) => fs.existsSync(path.resolve(SRC, p));
  const json = (p) => JSON.parse(read(p));
  const SYNC = '/update_follower_favourites_api.php';
  const ok = () => M.api.posted.filter((p) => p.url.endsWith(SYNC) && !p.rejected);
  const RAW = () => load('utils/followStorage', { raw: true });
  const { CONFIG } = require('./harness');
  const AS = require('@react-native-async-storage/async-storage').default;
  const origGet = AS.getItem, origSet = AS.setItem;
  const restoreAS = () => { AS.getItem = origGet; AS.setItem = origSet; CONFIG.API_CONFIG.TIMEOUT = 10000; CONFIG.API_CONFIG.DEBUG = false; };
  const idle = async (m) => { if (m.whenFollowSyncIdle) await m.whenFollowSyncIdle(); };
  /** Fails storage writes of `key` once. */
  const failWriteOnce = (key) => {
    let armed = true;
    AS.setItem = async (k, v) => { if (k === key && armed) { armed = false; throw new Error('disk full'); } return origSet(k, v); };
  };
  const block = (s, from, len = 1500) => { const at = s.indexOf(from); assert.ok(at > -1, 'found: ' + from); return s.slice(at, at + len); };

  // ── 1. follow/unfollow never wait for the network ─────────────────────
  test('first follow resolves after the LOCAL save, not after register + merge + upload; idle waits for the upload', async () => {
    M.fapi.guestDelay = 400; M.fapi.byDeviceDelay = 400;
    M.fapi.byDevice = { follower_id: 501, followed_customers: [], followed_bibs: {} };
    const m = RAW();
    assert.strictEqual(typeof m.whenFollowSyncIdle, 'function', 'whenFollowSyncIdle exported');
    const h0 = process.hrtime.bigint();
    await m.followUser(1);
    const ms = Number(process.hrtime.bigint() - h0) / 1e6;
    assert.ok(ms < 200, `followUser waited ${Math.round(ms)} ms for the network`);
    assert.deepStrictEqual(await m.getFollowedUsers(), [1], 'saved locally at once');
    assert.strictEqual(ok().length, 0, 'upload not done yet');
    await m.whenFollowSyncIdle();
    assert.strictEqual(ok().pop().body.customer_app_id_string, '1', 'uploaded once idle');  });
  test('unfollow / bib follow / bib unfollow also resolve before their upload', async () => {
    M.store.set('FOLLOWER_ID', '501');
    M.api.syncScript = [{ delay: 400 }, { delay: 400 }, { delay: 400 }];
    const m = RAW();
    for (const step of [() => m.followBib(13, '7'), () => m.unfollowBib(13, '7'), () => m.unfollowUser(99)]) {
      const h0 = process.hrtime.bigint();
      await step();
      assert.ok(Number(process.hrtime.bigint() - h0) / 1e6 < 200, 'resolved before the upload');
    }
    await idle(m);
  });

  // ── 2. a failed local save is undone in memory ─────────────────────────
  test('follow whose save fails: rejected AND gone from memory — a later upload never carries it (R1)', async () => {
    M.store.set('FOLLOWER_ID', '501');
    const m = RAW();
    await m.getFollowedUsers();
    failWriteOnce('followed_users');
    let threw = false;
    try { await m.followUser(7); } catch { threw = true; }
    restoreAS();
    assert.ok(threw, 'followUser rejected');
    assert.strictEqual(await m.isUserFollowed(7), false, 'not followed in memory');
    await m.followUser(8); await idle(m);
    assert.ok(!ok().pop().body.customer_app_id_string.split(',').includes('7'), 'rolled-back follow not uploaded');
  });
  test('unfollow whose save fails: still followed in memory', async () => {
    M.store.set('FOLLOWER_ID', '501');
    const m = RAW();
    await m.followUser(5); await idle(m);
    failWriteOnce('followed_users');
    await assert.rejects(m.unfollowUser(5));
    restoreAS();
    assert.strictEqual(await m.isUserFollowed(5), true);
  });
  test('bib follow / unfollow whose save fails: memory unchanged', async () => {
    M.store.set('FOLLOWER_ID', '501');
    const m = RAW();
    await m.getFollowedBibs(13);
    failWriteOnce('followed_bibs_by_product');
    await assert.rejects(m.followBib(13, '42'));
    assert.strictEqual(await m.isBibFollowed(13, '42'), false, 'bib follow undone');
    restoreAS();
    await m.followBib(13, '43'); await idle(m);
    failWriteOnce('followed_bibs_by_product');
    await assert.rejects(m.unfollowBib(13, '43'));
    restoreAS();
    assert.strictEqual(await m.isBibFollowed(13, '43'), true, 'bib unfollow undone');
  });

  // ── 3. stale answer naming an OLDER list of ours → re-sent ─────────────
  test('stale: the server applied an older list numbered by THIS phone → newest list re-sent (once)', async () => {
    M.store.set('FOLLOWER_ID', '501');
    const m = RAW();
    await m.followUser(1); await idle(m);
    const first = ok().pop().body.client_seq;
    M.api.staleWith = () => first;            // "an older upload of yours won"
    await m.followUser(2); await idle(m);
    await wait(20); await idle(m);
    const last = ok().pop();
    assert.deepStrictEqual(last.body.customer_app_id_string.split(',').sort(), ['1', '2'], 'newest list reached the server');
    assert.ok(M.api.posted.filter((p) => p.url.endsWith(SYNC)).length <= 3, 'no loop');
  });
  test('R4: upload numbered AFTER a newer one (storage stall past the job timeout) → server ends with the phone\'s list', async () => {
    CONFIG.API_CONFIG.TIMEOUT = 100;          // job timeout 5.1 s
    M.store.set('FOLLOWER_ID', '501');
    const m = RAW();
    await m.getFollowedUsers();
    let stall = true;
    AS.getItem = async (k) => { if (k === '@PFSLive:followSeqIssued' && stall) { stall = false; await wait(6000); } return origGet(k); };
    M.api.syncScript = [{ delay: 1500 }];
    const pA = m.followUser(1);
    await wait(5300);
    await pA;
    await m.unfollowUser(1);
    await wait(3000);
    restoreAS();
    await idle(m);
    const list = ok().length ? ok().pop().body.customer_app_id_string : '(none)';
    assert.strictEqual(list, '', `server ends with "${list}" while the phone has none`);
  });

  // ── 4. upload numbers: the server's 1-year bound ──────────────────────
  test('stored upload number > 1 year ahead is junk (server bound) — not continued from (R5)', async () => {
    M.store.set('FOLLOWER_ID', '501');
    M.store.set('@PFSLive:followSeqIssued', String(M.clock + 2 * 365 * 864e5));
    const m = RAW();
    await m.followUser(1); await idle(m);
    const seq = ok().pop().body.client_seq;
    assert.ok(seq < M.clock + 365 * 864e5, `client_seq ${seq} is beyond the server's 1-year bound`);
  });

  // ── 5. fan email "Skip" creates no follower row ───────────────────────
  test('fan email skip with no follower id → no guest registration, no request (R2)', async () => {
    const fe = load('services/Fanemailservice').fanEmailApi;
    await fe.updateEmail('');
    assert.strictEqual(M.fapi.guestCalls, 0);
    await fe.updateEmail('a@b.c');
    assert.strictEqual(M.fapi.guestCalls, 1, 'a real email still makes sure the row exists');
  });

  // ── 6. guest language settings ────────────────────────────────────────
  test('guest language request: aborted after API_CONFIG.TIMEOUT (fetch has none)', async () => {
    CONFIG.API_CONFIG.TIMEOUT = 50;
    const origFetch = global.fetch;
    global.fetch = (url, opts) => new Promise((_, rej) => {
      if (opts && opts.signal) opts.signal.addEventListener('abort', () => rej(new Error('aborted')));
    });
    try {
      const svc = load('services/guestSettingsService').guestSettingsService;
      const r = await Promise.race([svc.getLanguage().then(() => 'ok', () => 'rejected'), wait(1000).then(() => 'hung')]);
      assert.strictEqual(r, 'rejected');
    } finally { global.fetch = origFetch; restoreAS(); }
  });
  test('guest settings: a slow mount load landing after the user picked a language is ignored', () => {
    const s = read('screens/SettingScreen/GuestTrackingSettings.tsx');
    const load_ = block(s, 'const loadLanguage', 600);
    assert.ok(/getLanguage\(\);\s*if \(userPickedRef\.current\) return;/.test(load_), 'checked right after the load');
    assert.ok(/userPickedRef\.current = true;/.test(block(s, 'const handleLanguageChange', 200)), 'set on pick');
  });

  // ── 7. fan follow sheet ───────────────────────────────────────────────
  test('follow sheet: OS shows no dialog → Settings; never-presented sheet releases the store', () => {
    const s = read('components/FollowNotificationPrompt.tsx');
    const acc = block(s, 'const onAccept', 1500);
    assert.ok(/watchForOsPrompt\(\)/.test(acc), 'request watched');
    assert.ok(/res\.status !== 'granted' && !shown\) await notificationPermissionService\.openSettings\(\)/.test(acc));
    assert.ok(/onShow=\{\(\) => \{ shownRef\.current = true; \}\}/.test(s), 'onShow noted');
    assert.ok(/if \(!shownRef\.current\) hide\(\)/.test(s) && /FOLLOW_SHEET_SHOW_TIMEOUT_MS = 2000/.test(s), 'store reset when it never showed');
  });

  // ── 8. adoptIfOtherRow with no stored id ──────────────────────────────
  test('no stored id + server row WITH follows → merged (never overwrites local)', async () => {
    M.store.set('followed_users', JSON.stringify([42]));
    const m = RAW();
    assert.strictEqual(await m.adoptIfOtherRow({ follower_id: 501, followed_customers: [7], followed_bibs: {} }), true);
    assert.strictEqual(M.store.get('FOLLOWER_ID'), '501');
    assert.deepStrictEqual((await m.getFollowedUsers()).sort((a, b) => a - b), [7, 42]);
    await idle(m);
  });
  test('no stored id + server row with NO follows → not handled here (control)', async () => {
    const m = RAW();
    assert.strictEqual(await m.adoptIfOtherRow({ follower_id: 501, followed_customers: [], followed_bibs: {} }), false);
  });

  // ── 9. Start gate: precise location ───────────────────────────────────
  test('popup copy: reason "precise" → its own title/body + steps + settings button', () => {
    const c = load('utils/locationPopupCopy').locationPopupCopy;
    for (const platform of ['ios', 'android']) {
      assert.deepStrictEqual(c({ midRace: false, noFix: false, reason: 'precise', platform }),
        { titleKey: 'home:gpsHealth.titlePrecise', bodyKey: 'home:gpsHealth.blockedBodyPrecise', showSettingsSteps: true, showSettingsButton: true });
    }
  });
  test('precise-location copy in en / fr / nl', () => {
    for (const l of ['en', 'fr', 'nl']) {
      const g = json(`i18n/HomeScreen/${l}.json`).gpsHealth;
      for (const k of ['titlePrecise', 'blockedBodyPrecise', 'stepsPreciseIos', 'stepsPreciseAndroid', 'startAnyway']) {
        assert.ok(typeof g[k] === 'string' && g[k].trim(), `${l}: ${k}`);
      }
    }
  });
  test('Start gate: precise checked AFTER location switch and permission, before the gate is passed; "Start anyway" continues', () => {
    assert.strictEqual(typeof load('services/readinessService').readPrecise, 'function', 'readPrecise exported');
    const s = read('screens/HomeScreen.tsx');
    const fn = block(s, 'const doStartGPSTracking = useCallback', 6000);
    const sw = fn.indexOf('isLocationServiceEnabled()'), perm = fn.indexOf('!perms.foreground || !perms.background');
    const pr = fn.indexOf('await readPrecise()'), past = fn.indexOf('pendingStartRef.current = false;');
    assert.ok(sw > -1 && perm > sw && pr > perm && past > pr, 'order: switch → permission → precise → past the gate');
    assert.ok(/setPermissionBlockReason\('precise'\)/.test(fn));
    const any = block(s, "permissionBlockReason === 'precise' && !permissionModalMidRace && (", 1200);
    assert.ok(/allowApproximateRef\.current = true;/.test(any) && /doStartGPSTracking\(\)/.test(any) && /home:gpsHealth\.startAnyway/.test(any));
    assert.ok(/openLocationSettingsFor\(permissionBlockReason === 'precise' \? 'denied' : permissionBlockReason\)/.test(s), 'button opens the app permission page');
  });

  // ── 10. Get race-ready location step ──────────────────────────────────
  test('race-ready location step: no OS dialog → Settings (not a silent skip)', () => {
    const s = read('screens/RaceReadyScreen.tsx');
    const loc = block(s, "case 'location': {", 1400);
    assert.ok(/watchForOsPrompt\(\)/.test(loc));
    assert.ok(/if \(!res\.granted && !locShown\) \{[\s\S]*?openLocationSettingsFor\('denied'\)/.test(loc));
  });

  // ── 11. Start tapped while maybeOpen waits ────────────────────────────
  test('race-ready: race marked (Start tapped) while maybeOpen waited → not opened', async () => {
    M.gps.background = false; M.nav.ready = false;
    const rr = load('services/raceReadyService').raceReadyService;
    const p = rr.maybeOpen({ raceKey: 13, source: 'home' });
    await wait(150);
    void rr.markShown('13');                  // HomeScreen confirmStartTracking
    M.nav.ready = true;
    assert.strictEqual(await p, false);
    assert.strictEqual(M.nav.navigations.length, 0);
  });

  // ── 12. Notifications screen ──────────────────────────────────────────
  test('notifications screen: body matches "Turn on" when the OS can still ask; double tap guarded', () => {
    const s = read('screens/SettingScreen/NotificationSettingsScreen.tsx');
    assert.ok(/perm\.status === 'undetermined' \|\| canAsk\s*\?\s*t\('readiness:notifications\.bodyNotAsked'\)/.test(s));
    assert.ok(/if \(busyRef\.current\) return;\s*busyRef\.current = true;/.test(s) && /finally \{\s*busyRef\.current = false;/.test(s));
  });

  // ── 13. countdown freshness ───────────────────────────────────────────
  test('countdown: fresh "now" at effect start and when the app returns', () => {
    const s = read('components/Home/PreRaceCountdown.tsx');
    const eff = block(s, 'useEffect(() => {', 900);
    assert.ok(eff.indexOf('setNow(Date.now());') > -1 && eff.indexOf('setNow(Date.now());') < eff.indexOf('setInterval'), 'at effect start');
    assert.ok(/AppState\.addEventListener\('change'[\s\S]*?'active'\) setNow\(Date\.now\(\)\)/.test(eff) && /sub\.remove\(\)/.test(eff));
  });

  // ── 14. share on Android ──────────────────────────────────────────────
  test('share (Android): logged as "opened" — Android never says whether it was shared', async () => {
    M.os = 'android';
    const { ShareTrackingLink } = load('components/Home/ShareTrackingLink');
    const { findPressable } = require('./harness');
    await findPressable(ShareTrackingLink({ productAppId: 9, povId: 3, bib: '21', raceName: 'R' })).props.onPress();
    assert.deepStrictEqual(M.analytics.find((a) => a[0] === 'logShareLiveLink'), ['logShareLiveLink', 'opened']);
  });

  // ── 15. race-ready analytics carry the race ───────────────────────────
  test('race-ready: partner race → product_app_id in params + "shown" event; custom event → none', async () => {
    M.gps.background = false;
    const rr = load('services/raceReadyService').raceReadyService;
    await rr.maybeOpen({ raceKey: 13, source: 'connect' });
    await rr.maybeOpen({ raceKey: 'custom_5', source: 'custom_event' });
    assert.strictEqual(M.nav.navigations[0].params.product_app_id, 13);
    assert.ok(!('product_app_id' in M.nav.navigations[1].params), 'custom event: no product id');
    assert.deepStrictEqual(M.analytics.find((a) => a[0] === 'logRaceReadyStep' && a[1] === 'shown'), ['logRaceReadyStep', 'shown', undefined, 'connect', 13]);
    const s = read('screens/RaceReadyScreen.tsx');
    assert.ok(!/logRaceReadyStep\([^;\n]*, source\);/.test(s), 'every step event carries productAppId');
    assert.ok(/product_app_id\?: number;/.test(block(read('types/navigation.ts'), 'RaceReady: {', 300)), 'typed');
  });

  // ── 16. screen_ready bookkeeping ──────────────────────────────────────
  test('screen_ready: local date, one pruned map key (not one key per race)', () => {
    const s = read('screens/HomeScreen.tsx');
    const at = s.indexOf("logStartStep('screen_ready', undefined, eventId)");
    assert.ok(at > -1);
    const b = s.slice(at - 1400, at + 400);
    assert.ok(!/toISOString\(\)\.slice\(0, 10\)/.test(b), 'not the UTC date');
    assert.ok(/getFullYear\(\)/.test(b) && /const KEY = '@PFSLive:startReadyLogged';/.test(b));
    assert.ok(!/startReadyLogged:\$\{eventId\}/.test(s), 'no per-race key');
    assert.ok(/if \(v === day\) next\[k\] = v;/.test(b), 'pruned to today');
  });

  // ── 17. deep links ────────────────────────────────────────────────────
  test('whenNavigatorReady: 20 s default; a dropped link is logged in DEBUG', async () => {
    assert.ok(/timeoutMs = 20000/.test(read('utils/deepLink.ts')));
    CONFIG.API_CONFIG.DEBUG = true;
    const logs = []; const orig = console.log; console.log = (...a) => logs.push(a.join(' '));
    try {
      M.nav.ready = false;
      load('utils/deepLink').whenNavigatorReady(() => {}, 200);
      await wait(400);
    } finally { console.log = orig; restoreAS(); }
    assert.ok(logs.some((l) => /not ready/.test(l)), 'timeout logged');
  });
  test('livio://event without event_name → same rule as registration-confirmed (no blank event screen)', () => {
    const s = read('../App.tsx');
    assert.ok(/if \(link && link\.event_name\) \{\s*navigationRef\.current\?\.navigate\('EventDetails'/.test(block(s, 'Exactly livio://event', 1500)));
  });

  // ── 18–19. small screens ──────────────────────────────────────────────
  test('DistanceTab: preselect re-armed when preselect_pov_id changes', () => {
    assert.ok(/useEffect\(\(\) => \{ preselectDoneRef\.current = false; \}, \[preselect_pov_id\]\);/.test(read('screens/EventDetails/DistanceTab.tsx')));
  });
  test('IdleHome: upcoming events retried once after a failure; refetched on language change', async () => {
    const ev = load('services/eventService').eventService;
    let calls = 0;
    ev.getEvents = async () => { if (++calls === 1) throw new Error('Network Error'); return { tabs: { upcoming: [{ product_app_id: 1 }] } }; };
    const mod = load('components/Home/IdleHome');
    assert.strictEqual(typeof mod.loadUpcomingEvents, 'function', 'loader exported');
    assert.deepStrictEqual(await mod.loadUpcomingEvents(10), [{ product_app_id: 1 }]);
    assert.strictEqual(calls, 2);
    assert.ok(/\}, \[i18n\.language\]\);/.test(read('components/Home/IdleHome.tsx')));
  });

  // ── 20. armed start expires ───────────────────────────────────────────
  test('pending start: armed time stored at every arm; return listener only starts within 15 min', () => {
    const s = read('screens/HomeScreen.tsx');
    assert.ok(/export const PENDING_START_MAX_MS = 15 \* 60 \* 1000;/.test(s));
    const arms = s.split('pendingStartRef.current = true;').length - 1;
    const stamped = s.split(/pendingStartRef\.current = true;\s*pendingStartAtRef\.current = Date\.now\(\);/).length - 1;
    assert.ok(arms >= 3 && stamped === arms, `${stamped}/${arms} arms stamped`);
    const ret = block(s, 'if (satisfied) {', 900);
    assert.ok(ret.indexOf('Date.now() - pendingStartAtRef.current > PENDING_START_MAX_MS') > -1
      && ret.indexOf('PENDING_START_MAX_MS') < ret.indexOf('doStartGPSTrackingRef.current()'));
  });

  // ── 21. clean-up ──────────────────────────────────────────────────────
  test('clean-up: no unused Linking, no unreachable battery modal, legacy follow files gone, doc comment on logNotificationAsk', () => {
    const s = read('screens/HomeScreen.tsx');
    assert.ok(!/^\s*Linking,$/m.test(s.slice(0, s.indexOf("} from 'react-native';"))), 'Linking import');
    assert.ok(!/showBatteryModal|checkAndPromptBatteryOptimization|handleBatteryAllow/.test(s), 'battery modal');
    assert.ok(!exists('hooks/useFollow.ts') && !exists('../utils/followStorage.ts'), 'legacy files');
    const a = read('services/analyticsService.ts');
    assert.ok(/is the OS dialog's answer after it\.\s*\*\/\s*async logNotificationAsk\(/.test(a), 'doc comment moved');
  });

  // ── 22. guest row language ────────────────────────────────────────────
  test('registerGuestFollower sends language_id', () => {
    const s = read('services/registerFollowerServices.ts');
    assert.ok(/language_id: getCurrentLanguageId\(\)/.test(block(s, 'registerGuestFollower: async', 700)));
  });

  // ── verify pass: own favourites list refetches after the upload ───────
  test('UserFavouriteList: a follow refetches only once the follow upload is done (followUser no longer waits for it)', () => {
    const s = read('screens/FollowerScreen/UserFavouriteList.tsx');
    const cb = s.slice(s.indexOf('onFollowSuccessRef.current = () =>'), s.indexOf('useFocusEffect('));
    assert.ok(/whenFollowSyncIdle\(\)\.then\(\(\) => loadInitial\(\)\)/.test(cb), 'refetch waits for sync');
    assert.ok(!/^\s*loadInitial\(\);\s*$/m.test(cb), 'no immediate refetch');
  });
};
