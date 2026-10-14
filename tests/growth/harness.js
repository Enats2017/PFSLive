// Growth-work test harness. Same idea as tests/tracking/harness.js: load the
// REAL app TypeScript from ../../src (transpiled on the fly with the project's
// own `typescript`) with native / Expo / network modules replaced by
// controllable mocks. Plain Node, no framework.
//
// React is replaced by a tiny stand-in so function components can be CALLED
// and their returned element tree inspected (hooks are inert: useState returns
// its initial value, useCallback returns the function, effects don't run).
const Module = require('module');
const path = require('path');
const fs = require('fs');
const ts = require('typescript');

const SRC = (process.env.APP_SRC || path.resolve(__dirname, '../../src')).replace(/\\/g, '/');
const realNow = Date.now.bind(Date);

// ── controllable mock state ──────────────────────────────────────────────
const M = {};
function freshState() {
  Object.assign(M, {
    clock: realNow(),
    os: 'ios',
    store: new Map(),
    // expo-notifications
    notif: { available: true, isDevice: true, status: 'undetermined', canAskAgain: true,
             requestResult: { status: 'granted', canAskAgain: true }, token: 'ExponentPushToken[abc]',
             requests: 0, tokenFetches: 0, channels: 0 },
    // followerApi (registerFollowerServices)
    fapi: { guestCalls: 0, guestResult: { follower_id: 501 }, guestFail: false, guestDelay: 0,
            byDevice: null /* null → throws follower_not_found */, byDeviceCalls: 0,
            registerCalls: [], registerResult: { follower_id: 501 } },
    // apiClient.post
    api: { posted: [], fail: false },
    // gpsService
    gps: { foreground: true, background: true, level: 'always', canAskAgain: true, servicesOn: true },
    battery: { exempt: true, exemptThrows: false, lowPower: false },
    nav: { ready: true, route: 'HomeScreen', navigations: [] },
    analytics: [],
    appStateListeners: [],
    shares: [], shareAction: 'sharedAction',
  });
}
freshState();
Date.now = () => M.clock;

function anyStub(name) {
  const fn = function () { return Promise.resolve(undefined); };
  return new Proxy(fn, {
    get(t, p) {
      if (p === '__esModule') return true;
      if (p === 'then') return undefined;
      if (p === 'default') return anyStub(name + '.default');
      if (p === Symbol.toPrimitive) return () => name;
      return anyStub(name + '.' + String(p));
    },
    apply() { return Promise.resolve(undefined); },
  });
}

// ── minimal React stand-in ───────────────────────────────────────────────
const ReactStub = {
  createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat() }),
  useState: (v) => [typeof v === 'function' ? v() : v, () => {}],
  useCallback: (f) => f,
  useMemo: (f) => f(),
  useEffect: () => {},
  useRef: (v) => ({ current: v }),
  Fragment: 'Fragment',
};
ReactStub.default = ReactStub;

/** Depth-first text of an element tree. */
function textOf(node) {
  if (node == null || node === false) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  return (node.children || []).map(textOf).join('');
}
/** First element whose props has `onPress`. */
function findPressable(node) {
  if (!node || typeof node !== 'object') return null;
  if (node.props && typeof node.props.onPress === 'function') return node;
  for (const c of node.children || []) { const f = findPressable(c); if (f) return f; }
  return null;
}

const AsyncStorage = {
  getItem: async (k) => (M.store.has(k) ? M.store.get(k) : null),
  setItem: async (k, v) => { M.store.set(k, String(v)); },
  removeItem: async (k) => { M.store.delete(k); },
  multiRemove: async (ks) => ks.forEach((k) => M.store.delete(k)),
  getAllKeys: async () => [...M.store.keys()],
};

const t = (key, params) => (params ? `${key}${JSON.stringify(params)}` : key);

const overrides = {
  react: ReactStub,
  '@react-native-async-storage/async-storage': { __esModule: true, default: AsyncStorage },
  'react-native': {
    get Platform() { return { OS: M.os, Version: '17', select: (o) => o[M.os] }; },
    AppState: { addEventListener: (ev, cb) => { M.appStateListeners.push(cb); return { remove() {} }; }, currentState: 'active' },
    Linking: { openSettings: async () => { M.analytics.push(['openSettings']); } },
    Share: {
      sharedAction: 'sharedAction', dismissedAction: 'dismissedAction',
      share: async (content) => { M.shares.push(content); return { action: M.shareAction }; },
    },
    StyleSheet: { create: (x) => x, hairlineWidth: 1 },
    Text: 'Text', View: 'View', TouchableOpacity: 'TouchableOpacity', Pressable: 'Pressable', Modal: 'Modal',
  },
  'react-i18next': { useTranslation: () => ({ t, i18n: { language: 'en' } }) },
  '@expo/vector-icons': { Ionicons: 'Ionicons' },
  'expo-notifications': new Proxy({
    setNotificationHandler: () => {},
    setNotificationChannelAsync: async () => { M.notif.channels++; },
    setNotificationCategoryAsync: async () => {},
    AndroidImportance: { MAX: 5 },
    getPermissionsAsync: async () => ({ status: M.notif.status, canAskAgain: M.notif.canAskAgain }),
    requestPermissionsAsync: async () => {
      M.notif.requests++;
      M.notif.status = M.notif.requestResult.status;
      M.notif.canAskAgain = M.notif.requestResult.canAskAgain;
      return { ...M.notif.requestResult };
    },
    getExpoPushTokenAsync: async () => { M.notif.tokenFetches++; return { data: M.notif.token }; },
  }, { get(tg, p) { return p in tg ? tg[p] : anyStub('Notifications.' + String(p)); } }),
  'expo-device': { get isDevice() { return M.notif.isDevice; } },
  'expo-battery': {
    getPowerStateAsync: async () => ({ lowPowerMode: M.battery.lowPower }),
    isLowPowerModeEnabledAsync: async () => M.battery.lowPower,
  },
  'expo-location': {
    requestForegroundPermissionsAsync: async () => ({ status: M.gps.foreground ? 'granted' : 'denied', canAskAgain: M.gps.canAskAgain }),
  },
  'react-native-background-geolocation': { __esModule: true, default: {
    deviceSettings: { isIgnoringBatteryOptimizations: async () => {
      if (M.battery.exemptThrows) throw new Error('no ready()');
      return M.battery.exempt;
    } },
  } },
  zustand: require(path.resolve(__dirname, '../../node_modules/zustand')),
};

// relative modules replaced by absolute (extension-less) path
const rel = (p) => path.resolve(SRC, p);
const relOverrides = {
  [rel('constants/config')]: {
    API_CONFIG: { DEBUG: false, TIMEOUT: 10000, getHeaders: async () => ({ Authorization: 'Bearer x' }),
      ENDPOINTS: { SYNC_FOLLOW_DATA: '/update_follower_favourites_api.php', UPDATE_DEVICE_READINESS: '/update_device_readiness_api.php' } },
    APP_CONFIG: { VERSION: '1.1.0', WEB_BASE_URL: 'https://my.liviolive.com/livio_website' },
    getApiEndpoint: (x) => 'https://api.test' + x,
    getDeviceId: async () => 'dev-1',
  },
  [rel('services/api')]: { apiClient: {
    post: async (url, body) => {
      if (M.api.fail) { const e = new Error('Network Error'); e.type = 'network'; throw e; }
      M.api.posted.push({ url, body });
      return { success: true };
    },
    get: async () => ({}),
  } },
  [rel('services/registerFollowerServices')]: { followerApi: {
    registerGuestFollower: async () => {
      M.fapi.guestCalls++;
      if (M.fapi.guestDelay) await new Promise((r) => setTimeout(r, M.fapi.guestDelay));
      if (M.fapi.guestFail) throw Object.assign(new Error('Network Error'), { type: 'network' });
      return { ...M.fapi.guestResult };
    },
    getFollowerDataByDevice: async () => {
      M.fapi.byDeviceCalls++;
      if (!M.fapi.byDevice) throw Object.assign(new Error('follower_not_found'), { type: 'empty', code: 'follower_not_found' });
      return JSON.parse(JSON.stringify(M.fapi.byDevice));
    },
    registerFollower: async (token) => { M.fapi.registerCalls.push(token); return { ...M.fapi.registerResult }; },
  } },
  [rel('services/analyticsService')]: { analyticsService: new Proxy({}, {
    get: (tg, p) => (...args) => { M.analytics.push([String(p), ...args]); return Promise.resolve(); },
  }) },
  [rel('navigation/navigationRef')]: { navigationRef: {
    isReady: () => M.nav.ready,
    getCurrentRoute: () => (M.nav.route ? { name: M.nav.route } : undefined),
    navigate: (name, params) => { M.nav.navigations.push({ name, params }); },
  } },
  [rel('services/gpsService')]: { gpsService: {
    getPermissionState: async () => ({ foreground: M.gps.foreground, background: M.gps.background,
      level: M.gps.level, canAskAgain: M.gps.canAskAgain }),
    isLocationServiceEnabled: async () => M.gps.servicesOn,
  } },
  [rel('i18n')]: { __esModule: true, default: { t, language: 'en' } },
};

const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (overrides[request]) return overrides[request];
  if (request.startsWith('.') && parent && parent.filename) {
    const abs = path.resolve(path.dirname(parent.filename), request);
    if (abs in relOverrides) return relOverrides[abs];
    if (abs.replace(/\\/g, '/').startsWith(SRC + '/styles/')) return anyStub('styles');
  }
  if (!request.startsWith('.') && !path.isAbsolute(request)
      && !['assert', 'path', 'fs', 'module', 'util'].includes(request)) {
    return anyStub(request);
  }
  return origLoad.apply(this, arguments);
};
Module._extensions['.ts'] = function (module, filename) {
  const src = fs.readFileSync(filename, 'utf8');
  const out = ts.transpileModule(src, { fileName: filename, compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019, esModuleInterop: true,
    jsx: ts.JsxEmit.React } });
  module._compile(out.outputText, filename);
};
Module._extensions['.tsx'] = Module._extensions['.ts'];

function load(p) { return require(path.resolve(SRC, p)); }

function reset() {
  freshState();
  for (const k of Object.keys(require.cache)) {
    if (k.replace(/\\/g, '/').startsWith(SRC)) delete require.cache[k];
  }
}

// ── tiny runner ──────────────────────────────────────────────────────────
const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
async function run(title) {
  let pass = 0, fail = 0;
  console.log(`\n== ${title} ==`);
  for (const tc of tests) {
    reset();
    try { await tc.fn(); pass++; console.log('  PASS ', tc.name); }
    catch (e) { fail++; console.log('  FAIL ', tc.name, '\n        ', String((e && e.message) || e).split('\n').join('\n         ')); }
  }
  tests.length = 0;
  return { pass, fail };
}

module.exports = { M, load, test, run, textOf, findPressable, SRC };
