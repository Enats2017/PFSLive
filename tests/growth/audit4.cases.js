// Cases added by the FOURTH audit round (2026-10-14). Registered by app.test.js.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

module.exports = function register({ M, load, test, SRC }) {
  const read = (p) => fs.readFileSync(path.resolve(SRC, p), 'utf8');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const READY = '/update_device_readiness_api.php';
  const SYNC = '/update_follower_favourites_api.php';
  const posts = (suffix) => M.api.posted.filter((p) => p.url.endsWith(suffix));
  const RS = () => load('services/readinessService').readinessService;
  const FS = () => load('utils/followStorage');
  const NP = () => load('services/notificationPermissionService').notificationPermissionService;

  // ── readiness: rejected reports are not resent on every refresh ───────
  test('readiness rejected (device not this account) → sent once, not on every refresh', async () => {
    M.api.failWith = { type: 'empty', code: 'device_mismatch' };
    const rs = RS();
    for (let i = 0; i < 3; i++) { await rs.getState(); await wait(5); }
    assert.strictEqual(posts(READY).length, 1);
  });
  test('readiness rejected for an expired login → retried after a NEW login', async () => {
    M.api.failWith = { type: 'server', code: 'session_expired' };
    const rs = RS();
    await rs.getState(); await wait(5);
    await rs.getState(); await wait(5);
    assert.strictEqual(posts(READY).length, 1, 'not retried with the same login');
    M.api.failWith = null; M.authToken = 'fresh-login';
    await rs.getState(); await wait(5);
    assert.strictEqual(posts(READY).length, 2, 'retried after login');
  });
  test('readiness: server down / offline → still retried (temporary)', async () => {
    M.api.failWith = { type: 'server', code: 'internal_error' };
    const rs = RS();
    await rs.getState(); await wait(5);
    await rs.getState(); await wait(5);
    assert.strictEqual(posts(READY).length, 2);
  });
  test('readiness: another runner logs in on the same phone, same state → reported for them', async () => {
    const rs = RS();
    await rs.getState(); await wait(5);
    M.authToken = 'runner-B';
    await rs.getState(); await wait(5);
    assert.strictEqual(posts(READY).length, 2);
  });
  test('readiness: backup restored on a new phone (new device id) → reported again', async () => {
    const rs = RS();
    await rs.getState(); await wait(5);
    M.deviceId = 'dev-2';
    await rs.getState(); await wait(5);
    const sent = posts(READY);
    assert.strictEqual(sent.length, 2);
    assert.strictEqual(sent[1].body.device_id, 'dev-2');
  });
  test('readiness: nothing about the login itself is stored (only a short fingerprint)', async () => {
    M.authToken = 'super-secret-token-value';
    await RS().getState(); await wait(5);
    const stored = M.store.get('@PFSLive:readinessReported') || '';
    assert.ok(stored && !stored.includes('super-secret'), stored);
  });

  // ── follows ───────────────────────────────────────────────────────────
  test('two quick follows with the merge owed → ONE merge download, follows both kept', async () => {
    M.store.set('FOLLOWER_ID', '501');
    M.store.set('@PFSLive:followAdoptPending', '1');
    M.fapi.byDevice = { follower_id: 501, followed_customers: [111], followed_bibs: {} };
    M.fapi.byDeviceDelay = 20;
    const fs_ = FS();
    await Promise.all([fs_.followUser(300), fs_.followUser(301)]);
    assert.strictEqual(M.fapi.byDeviceCalls, 1);
    const last = posts(SYNC).pop().body.customer_app_id_string.split(',').sort();
    assert.ok(last.includes('111') && last.includes('300'), last.join(','));
  });
  test('server hands back a DIFFERENT follower id than stored → merge owed (not overwritten)', async () => {
    M.store.set('FOLLOWER_ID', '400');            // e.g. restored from a backup
    M.fapi.registerResult = { follower_id: 777 };
    M.store.set('followed_users', JSON.stringify([42]));
    await NP().request();
    await new Promise((r) => setTimeout(r, 30));           // registration runs in the background now
    assert.strictEqual(M.store.get('@PFSLive:followAdoptPending'), '1');
    await FS().syncFollowDataFromAPI([], {});
    assert.deepStrictEqual(await FS().getFollowedUsers(), [42]);
  });
  test('id from the server is 0 / "null" / missing → nothing stored, no merge flag', async () => {
    for (const bad of [{ follower_id: 0 }, { follower_id: 'null' }, {}]) {
      M.store.clear(); M.fapi.guestResult = bad;
      const fs_ = FS();
      assert.deepStrictEqual(await fs_.ensureFollowerId(), { id: null, adopted: false });
      assert.strictEqual(M.store.has('FOLLOWER_ID'), false);
      assert.strictEqual(M.store.has('@PFSLive:followAdoptPending'), false);
    }
  });
  test('restore: phone knows its id, server says "no row" (id from another device, e.g. a backup) → stale id replaced, local follows kept and pushed to the new row', async () => {
    M.store.set('FOLLOWER_ID', '501');
    M.store.set('followed_users', JSON.stringify([5, 6]));
    M.fapi.guestResult = { follower_id: 777 };
    await FS().restoreFollowsWithoutToken();          // byDevice null → follower_not_found
    assert.deepStrictEqual((await FS().getFollowedUsers()).sort(), [5, 6]);
    assert.strictEqual(M.store.get('FOLLOWER_ID'), '777', 'new row');
    const p = posts(SYNC).pop();
    assert.ok(p && p.body.follower_id === 777, 'pushed to the new row');
  });

  // ── fan sheet + token timer ───────────────────────────────────────────
  test('fan accepts the sheet but refuses the OS prompt → same 30-day pause as "Not now"', () => {
    const s = read('components/FollowNotificationPrompt.tsx');
    const fn = s.slice(s.indexOf('const onAccept'), s.indexOf('const onAccept') + 700);
    assert.ok(/if \(res\.status !== 'granted'\) void markFollowPromptDismissed\(\)/.test(fn));
  });
  test('…and the pause really suppresses the next sheet', async () => {
    const m = load('store/useFollowPromptStore');
    await m.markFollowPromptDismissed();
    await m.maybePromptNotificationsAfterFollow();
    assert.strictEqual(m.useFollowPromptStore.getState().visible, false);
  });
  test('iOS: follow sheet presented only after a closing modal has gone (no stuck sheet)', () => {
    const s = read('components/FollowNotificationPrompt.tsx');
    assert.ok(/FOLLOW_SHEET_IOS_DELAY_MS = 600/.test(s));
    assert.ok(/<Modal visible=\{presented\}/.test(s));
    assert.ok(/clearTimeout\(timer\)/.test(s), 'timer cleared when hidden/unmounted');
  });
  test('push-token timeout timer is cleared after the fetch', () => {
    assert.ok(/\.finally\(\(\) => clearTimeout\(timer\)\)/.test(read('services/notificationPermissionService.ts')));
  });

  // ── Home + small things ───────────────────────────────────────────────
  test('Home without a race: "following live" stays right under the hero, idle card after it', () => {
    const s = read('screens/HomeScreen.tsx');
    const live = s.indexOf('{homeData?.following_live_events && homeData.following_live_events.length > 0 && (\n            <FollowingLiveEventsSection'.replace(/\n/g, s.includes('\r\n') ? '\r\n' : '\n'));
    const idle = s.indexOf('{homeData && homeData.show_start_track !== 1 && !isGPSActive && <IdleHome />}');
    assert.ok(live > -1 && idle > -1 && idle > live, `live ${live} idle ${idle}`);
  });
  test('start funnel: every permission_result step carries the race id', () => {
    const s = read('screens/HomeScreen.tsx');
    const calls = [...s.matchAll(/logStartStep\(\s*'permission_result'[^;]*;/g)].map((m) => m[0]);
    assert.ok(calls.length >= 3);
    for (const c of calls) assert.ok(/eventId/.test(c), c);
  });
  test('no garbled characters (â€) left in source', () => {
    const bad = [];
    const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).forEach((d) => {
      const f = path.join(dir, d.name);
      if (d.isDirectory()) walk(f);
      else if (/\.(tsx?|json)$/.test(d.name) && fs.readFileSync(f, 'utf8').includes('â€')) bad.push(f);
    });
    walk(SRC);
    assert.deepStrictEqual(bad, []);
  });
  test('link parsing: repeated key → last wins; #fragment ignored; empty value', () => {
    const { parseQuery } = load('utils/deepLink');
    const q = parseQuery('livio://event?a=1&a=2&b=&c=x#frag');
    assert.strictEqual(q.a, '2'); assert.strictEqual(q.b, ''); assert.strictEqual(q.c, 'x');
  });
  test('two follows at the same moment right after launch → BOTH kept (phone + server)', async () => {
    M.store.set('FOLLOWER_ID', '501');
    M.storeDelay = 3;                          // cold cache: each follow reads storage
    const fs_ = FS();
    await Promise.all([fs_.followUser(300), fs_.followUser(301)]);
    M.storeDelay = 0;
    assert.deepStrictEqual((await fs_.getFollowedUsers()).sort(), [300, 301]);
    assert.deepStrictEqual(posts(SYNC).pop().body.customer_app_id_string.split(',').sort(), ['300', '301']);
  });
  test('two bib follows at the same moment right after launch → both kept', async () => {
    M.store.set('FOLLOWER_ID', '501');
    M.storeDelay = 3;
    const fs_ = FS();
    await Promise.all([fs_.followBib(13, '7'), fs_.followBib(13, '8')]);
    M.storeDelay = 0;
    assert.deepStrictEqual((await fs_.getFollowedBibs(13)).sort(), ['7', '8']);
  });
};
