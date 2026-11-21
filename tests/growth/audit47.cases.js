// Cases added 2026-10-28: the Start popup's "Open settings" re-showed the same
// popup instead of opening Settings (Android: location allowed, then switched
// off for Livio in Settings, then Start again).
const assert = require('assert');
const fs = require('fs');
const path = require('path');

module.exports = ({ M, load, test, SRC }) => {
  const read = (rel) => fs.readFileSync(path.join(SRC, rel), 'utf8').replace(/\r/g, '');
  const emit = (state) => M.appStateListeners.slice().forEach((cb) => cb(state));

  // ── 1. A blink out of 'active' is not a dialog ───────────────────────────
  test('Android silent refusal: the permission activity blinks the app away (150 ms) → NOT "the OS showed a dialog"', () => {
    const { watchForOsPrompt } = load('utils/permissionPrompt');
    M.clock = 1_000_000;
    const w = watchForOsPrompt();
    M.clock += 20; emit('background');
    M.clock += 150; emit('active');
    M.clock += 30;
    assert.strictEqual(w.done(), false, 'a blink must send the runner to Settings');
  });
  test('…a dialog the runner reads and answers (app away 1.2 s) still IS one', () => {
    const { watchForOsPrompt } = load('utils/permissionPrompt');
    M.clock = 2_000_000;
    const w = watchForOsPrompt();
    M.clock += 20; emit('inactive');
    M.clock += 1200; emit('active');
    assert.strictEqual(w.done(), true);
  });
  test('…several blinks do not add up to a dialog; still away when the request settles counts up to then', () => {
    const { watchForOsPrompt, MIN_AWAY_MS } = load('utils/permissionPrompt');
    M.clock = 3_000_000;
    const w = watchForOsPrompt();
    for (let i = 0; i < 3; i++) { emit('background'); M.clock += 100; emit('active'); M.clock += 10; }
    assert.strictEqual(w.done(), false, '3 x 100 ms');
    assert.ok(MIN_AWAY_MS > 300 && MIN_AWAY_MS <= 1000, 'threshold between a blink and a human answer');
    const w2 = watchForOsPrompt();
    emit('background'); M.clock += 900;
    assert.strictEqual(w2.done(), true, 'Location page still open');
  });

  // ── 2. The popup never asks the OS twice: the second tap opens Settings ──
  test('HomeScreen: after a refusal from the popup, "Open settings" goes straight to Settings', () => {
    const s = read('screens/HomeScreen.tsx');
    assert.ok(/const osAskedFromPopupRef = useRef\(false\);/.test(s), 'ref');
    const btn = s.indexOf("{t('home:gpsHealth.openSettings')}");
    const start = s.lastIndexOf('{popupCopy.showSettingsButton && (', btn);
    const body = s.slice(start, btn);
    assert.ok(/permissionBlockReason !== 'precise' && !osAskedFromPopupRef\.current\) \{/.test(body), 'OS request skipped once asked');
    assert.ok(/if \(osShowed\) \{\s*osAskedFromPopupRef\.current = true;/.test(body), 'set on a real "no"');
    assert.ok(body.indexOf('await openLocationSettingsFor(') > body.indexOf('osAskedFromPopupRef.current = true'), 'Settings route after it');
  });
  test('…cleared by a new Start tap and by the mid-race banner (a new popup)', () => {
    const s = read('screens/HomeScreen.tsx');
    const c = s.indexOf('const confirmStartTracking = useCallback(');
    assert.ok(/pendingStartRef\.current = false;\s*osAskedFromPopupRef\.current = false;/.test(s.slice(c, c + 700)), 'Start tap');
    const m = s.indexOf('setPermissionModalMidRace(true);');
    assert.ok(/osAskedFromPopupRef\.current = false;/.test(s.slice(m, m + 200)), 'mid-race banner');
  });
};

// ── 3. The real button, pressed on the rendered Home screen ────────────────
// The popup state is opened by call order: the useState right before the
// block reason ('denied') is showLocationPermissionModal (see HomeScreen).
module.exports.rendered = ({ M, load, test, SRC }) => {
  const Module = require('module');
  const emit = (state) => M.appStateListeners.slice().forEach((cb) => cb(state));
  const flush = async () => { for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r)); };
  const textOf = (n) => (n == null || n === false ? '' : typeof n !== 'object' ? String(n)
    : Array.isArray(n) ? n.map(textOf).join('') : (n.children || []).map(textOf).join(''));
  const find = (n, ok) => {
    if (!n || typeof n !== 'object') return null;
    if (Array.isArray(n)) { for (const c of n) { const f = find(c, ok); if (f) return f; } return null; }
    if (ok(n)) return n;
    return find(n.children || [], ok);
  };
  const nav = { navigate() {}, addListener: () => () => {}, setOptions() {}, isFocused: () => true };

  // Renders Home with the location popup open for `reason`; returns its
  // "Open settings" press, the OS requests made and the Settings routes opened.
  const openPopup = ({ os, reason, request }) => {
    const mod = load('screens/HomeScreen');
    const Home = mod.default || mod.HomeScreen;
    const settings = [];
    load('utils/deviceSettings').openLocationSettingsFor = async (r) => { settings.push(r); };
    const requests = [];
    // the gpsService mock Home gets (the harness swaps it in for relative imports from src/)
    const gps = Module._load('../services/gpsService', { filename: path.join(SRC, 'screens', 'HomeScreen.tsx') }).gpsService;
    gps.requestPermissionsDetailed = async () => { requests.push(1); return request(); };
    const prevOs = M.os, prevMap = M.useStateMap, prevDev = global.__DEV__;
    try {
      M.os = os; global.__DEV__ = false;
      const seq = [];
      M.useStateMap = (x) => { seq.push(x); return x; };
      Home({ navigation: nav, route: { params: {} } });
      const at = seq.findIndex((x, i) => x === 'denied' && seq[i - 1] === false && seq[i + 1] === false && seq[i + 2] === false && seq[i + 3] === true);
      if (at < 1) throw new Error('popup state not found by call order');
      let n = 0;
      // Every other popup / flag flipped as in audit40 (that is what gets Home
      // past its loading state); the location popup open for `reason`, from
      // Start (midRace and noFix false).
      M.useStateMap = (x) => {
        const i = n++;
        if (i === at - 1) return true;
        if (i === at) return reason;
        if (i === at + 1 || i === at + 2) return false;
        return x === true ? false : x === false ? true : x;
      };
      const tree = Home({ navigation: nav, route: { params: {} } });
      const modal = find(tree, (e) => e.type === 'Modal' && e.props.visible === true && textOf(e).includes('home:gpsHealth.openSettings'));
      if (!modal) throw new Error('location popup not rendered');
      const btn = find(modal, (e) => typeof (e.props && e.props.onPress) === 'function' && textOf(e) === 'home:gpsHealth.openSettings');
      return { press: async () => { btn.props.onPress(); await flush(); }, requests, settings };
    } finally { M.os = prevOs; M.useStateMap = prevMap; global.__DEV__ = prevDev; }
  };
  const refused = { foreground: false, background: false, level: 'denied', canAskAgain: true };
  // the OS's answer, after the app was away `awayMs` (0 = never left) and `totalMs` in all
  const answer = (awayMs, totalMs, result = refused) => () => {
    if (awayMs) { emit('background'); M.clock += awayMs; emit('active'); }
    M.clock += Math.max(0, totalMs - awayMs);
    return result;
  };

  test('Home popup, Android, location switched off for Livio in Settings: OS refuses silently (150 ms blink) → ONE tap opens Settings', async () => {
    const p = openPopup({ os: 'android', reason: 'denied', request: answer(150, 180) });
    await p.press();
    assert.deepStrictEqual(p.requests.length, 1, 'OS asked once');
    assert.deepStrictEqual(p.settings, ['denied'], 'Settings opened (Livio permission page)');
  });
  test('…same for "Allow only while using" (no_background_perm): the blink opens Settings', async () => {
    const p = openPopup({ os: 'android', reason: 'no_background_perm', request: answer(120, 150, { ...refused, foreground: true, level: 'when_in_use' }) });
    await p.press();
    assert.deepStrictEqual(p.settings, ['no_background_perm']);
  });
  test('Home popup: a REAL dialog the runner refuses → popup back; the NEXT tap opens Settings without asking again', async () => {
    const p = openPopup({ os: 'android', reason: 'denied', request: answer(1200, 1250) });
    await p.press();
    assert.strictEqual(p.requests.length, 1);
    assert.deepStrictEqual(p.settings, [], 'first tap: the runner just answered the OS, no Settings on top');
    await p.press();
    assert.strictEqual(p.requests.length, 1, 'second tap: OS not asked again');
    assert.deepStrictEqual(p.settings, ['denied'], 'second tap: Settings');
    await p.press();
    assert.deepStrictEqual(p.settings, ['denied', 'denied'], 'every later tap: Settings');
  });
  test('…iOS: refused in Settings, expo answers after its 1.5 s no-dialog wait without leaving the app → Settings', async () => {
    const p = openPopup({ os: 'ios', reason: 'denied', request: answer(0, 1500) });
    await p.press();
    assert.deepStrictEqual(p.settings, ['denied']);
  });
  test('…granted from the OS dialog → no Settings trip', async () => {
    const p = openPopup({ os: 'android', reason: 'denied', request: answer(1500, 1600, { foreground: true, background: true, level: 'always', canAskAgain: true }) });
    await p.press();
    assert.strictEqual(p.requests.length, 1);
    assert.deepStrictEqual(p.settings, []);
  });
  test('…phone Location switched off: no OS request, straight to the Location switch page', async () => {
    const p = openPopup({ os: 'android', reason: 'location_off', request: answer(0, 10) });
    await p.press();
    assert.strictEqual(p.requests.length, 0);
    assert.deepStrictEqual(p.settings, ['location_off']);
  });
  test('…precise location off: no OS request, the app permission page', async () => {
    const p = openPopup({ os: 'android', reason: 'precise', request: answer(0, 10) });
    await p.press();
    assert.strictEqual(p.requests.length, 0);
    assert.deepStrictEqual(p.settings, ['denied']);
  });
};

// ── 4. "Get race-ready" uses the same check: a blink is not a dialog there either ──
module.exports.raceReady = ({ M, load, test, SRC }) => {
  const Module = require('module');
  const emit = (state) => M.appStateListeners.slice().forEach((cb) => cb(state));
  const flush = async () => { for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r)); };
  const textOf = (n) => (n == null || n === false ? '' : typeof n !== 'object' ? String(n)
    : Array.isArray(n) ? n.map(textOf).join('') : (n.children || []).map(textOf).join(''));
  const find = (n, ok) => {
    if (!n || typeof n !== 'object') return null;
    if (Array.isArray(n)) { for (const c of n) { const f = find(c, ok); if (f) return f; } return null; }
    if (ok(n)) return n;
    return find(n.children || [], ok);
  };
  const blink = (ms) => { emit('background'); M.clock += ms; emit('active'); };
  const from = (request) => Module._load(request, { filename: path.join(SRC, 'screens', 'RaceReadyScreen.tsx') });

  // Renders Get race-ready on step `missing[0]`; returns its main button's press.
  const openStep = (missing) => {
    const mod = load('screens/RaceReadyScreen');
    const Screen = mod.default || mod.RaceReadyScreen;
    const settings = [];
    load('utils/deviceSettings').openLocationSettingsFor = async (r) => { settings.push(r); };
    const prevOs = M.os, prevMap = M.useStateMap;
    try {
      M.os = 'android';
      const state = { missing, notifications: 'granted', notificationsCanAskAgain: true, locationCanAskAgain: true };
      // the first useState(null) is the readiness state (then the skipped Set)
      const seq = []; M.useStateMap = (x) => { seq.push(x); return x; };
      const props = { navigation: { navigate() {}, goBack() {}, addListener: () => () => {}, setOptions() {} }, route: { params: { race_name: 'R', source: 'home' } } };
      Screen(props);
      const at = seq.findIndex((x, i) => x === null && seq[i + 1] instanceof Set);
      if (at < 0) throw new Error('readiness state not found by call order');
      let n = 0; M.useStateMap = (x) => (n++ === at ? state : x);
      const tree = Screen(props);
      const btn = find(tree, (e) => typeof (e.props && e.props.onPress) === 'function'
        && /readiness:raceReady\.(continue|openSettings)/.test(textOf(e)));
      if (!btn) throw new Error('step button not rendered');
      return { press: async () => { btn.props.onPress(); await flush(); }, settings };
    } finally { M.os = prevOs; M.useStateMap = prevMap; }
  };

  test('Get race-ready, "Allow all the time" step, Android: OS refuses silently (blink) → Settings, not a silent skip', async () => {
    const gps = from('../services/gpsService').gpsService;
    gps.requestPermissionsDetailed = async () => { blink(150); return { foreground: true, background: false, level: 'when_in_use', canAskAgain: true }; };
    const p = openStep(['background']);
    await p.press();
    assert.deepStrictEqual(p.settings, ['no_background_perm']);
  });
  test('…a real refusal there (the Location page open 2 s) is still a skip, no Settings on top', async () => {
    const gps = from('../services/gpsService').gpsService;
    gps.requestPermissionsDetailed = async () => { blink(2000); return { foreground: true, background: false, level: 'when_in_use', canAskAgain: true }; };
    const p = openStep(['background']);
    await p.press();
    assert.deepStrictEqual(p.settings, []);
  });
  test('Get race-ready, location step, Android: location switched off for Livio, OS refuses silently (blink) → Settings', async () => {
    const loc = from('expo-location');
    const prev = loc.requestForegroundPermissionsAsync;
    loc.requestForegroundPermissionsAsync = async () => { blink(150); return { status: 'denied', canAskAgain: true }; };
    try {
      const p = openStep(['location']);
      await p.press();
      assert.deepStrictEqual(p.settings, ['denied']);
    } finally { loc.requestForegroundPermissionsAsync = prev; }
  });
};
