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
    storeDelay: 0,          // ms per AsyncStorage call — exposes interleavings
    writes: [],             // order of keys written
    multiRemoveFail: false,
    // expo-notifications
    notif: { available: true, isDevice: true, status: 'undetermined', canAskAgain: true,
             requestResult: { status: 'granted', canAskAgain: true }, token: 'ExponentPushToken[abc]',
             requests: 0, tokenFetches: 0, channels: 0 },
    // followerApi (registerFollowerServices)
    fapi: { guestCalls: 0, guestResult: { follower_id: 501 }, guestFail: false, guestDelay: 0,
            byDevice: null /* null → throws follower_not_found */, byDeviceCalls: 0,
            byDeviceTransient: false /* true → network error (not a 'no row' answer) */,
            byDeviceDelay: 0, registerFail: false,
            registerCalls: [], registerResult: { follower_id: 501 } },
    // apiClient.post
    api: { posted: [], fail: false, rejectIds: [] /* follower ids the sync endpoint answers follower_not_found */,
           seqByFollower: {} /* server's applied client_seq per follower row */, ignoreSeq: false /* true = server before the follow_seq migration */,
           // Opt-in server rows WITH lists: { [follower_id]: { follow_seq, customers: [], bibs: {} } }.
           // A row here gets the base_seq check (follow_conflict, HTTP 409) and is
           // updated by every accepted upload; a test can bump it like a web follow.
           rows: {} },
    netListeners: [],      // NetInfo.addEventListener callbacks
    // gpsService
    gps: { foreground: true, background: true, level: 'always', canAskAgain: true, servicesOn: true },
    battery: { exempt: true, exemptThrows: false, lowPower: false },
    nav: { ready: true, route: 'HomeScreen', navigations: [] },
    tracking: false,
    loggedIn: true,        // getHeaders() sends a login token
    authToken: 'x',        // which login (changes on re-login / another account)
    deviceId: 'dev-1',     // getDeviceId() (changes after a backup restore)
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
  memo: (c) => c,            // memo(Component) renders Component itself
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

const storeWait = () => (M.storeDelay ? new Promise((r) => setTimeout(r, M.storeDelay)) : Promise.resolve());
const AsyncStorage = {
  getItem: async (k) => { await storeWait(); return M.store.has(k) ? M.store.get(k) : null; },
  setItem: async (k, v) => { await storeWait(); M.writes.push(k); M.store.set(k, String(v)); },
  removeItem: async (k) => { await storeWait(); M.writes.push('-' + k); M.store.delete(k); },
  multiRemove: async (ks) => {
    await storeWait();
    if (M.multiRemoveFail) throw new Error('storage full');
    ks.forEach((k) => M.store.delete(k));
  },
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
      if (M.notif.onRequest) M.notif.onRequest();
      M.notif.status = M.notif.requestResult.status;
      M.notif.canAskAgain = M.notif.requestResult.canAskAgain;
      return { ...M.notif.requestResult };
    },
    getExpoPushTokenAsync: async () => {
      M.notif.tokenFetches++;
      await new Promise((r) => setTimeout(r, 5)); // a real fetch takes time — lets overlaps show
      return { data: M.notif.token };
    },
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
  '@react-native-community/netinfo': { __esModule: true, default: {
    addEventListener: (cb) => { M.netListeners.push(cb); return () => {}; },
    fetch: async () => ({ isConnected: true, isInternetReachable: true }),
  } },
  // useNavigation().navigate records into M.nav.navigations (same list as
  // navigationRef); everything else on the module stays an inert stub.
  '@react-navigation/native': new Proxy({
    useNavigation: () => ({
      navigate: (name, params) => { M.nav.navigations.push({ name, params }); },
      goBack: () => {}, canGoBack: () => true, reset: () => {},
    }),
  }, { get(tg, p) { return p in tg ? tg[p] : anyStub('navigation.' + String(p)); } }),
  zustand: require(path.resolve(__dirname, '../../node_modules/zustand')),
};

// relative modules replaced by absolute (extension-less) path
const rel = (p) => path.resolve(SRC, p);
const relOverrides = {
  [rel('constants/config')]: {
    API_CONFIG: { DEBUG: false, TIMEOUT: 10000,
      getHeaders: async () => (M.loggedIn ? { Authorization: 'Bearer ' + M.authToken } : { 'Content-Type': 'application/json' }),
      ENDPOINTS: { SYNC_FOLLOW_DATA: '/update_follower_favourites_api.php', UPDATE_DEVICE_READINESS: '/update_device_readiness_api.php' } },
    APP_CONFIG: { VERSION: '1.1.0', WEB_BASE_URL: 'https://my.liviolive.com/livio_website' },
    getApiEndpoint: (x) => 'https://api.test' + x,
    getDeviceId: async () => M.deviceId,
  },
  [rel('services/api')]: { apiClient: {
    post: async (url, body) => {
      // Per-call script for the follow sync endpoint: [{ delay, fail }, …]
      if (url.endsWith('/update_follower_favourites_api.php') && M.api.syncScript && M.api.syncScript.length) {
        const step = M.api.syncScript.shift();
        if (step.delay) await new Promise((r) => setTimeout(r, step.delay));
        // The phone gets a timeout NOW, but the server still commits the upload later.
        if (step.lateCommit) {
          const b = JSON.parse(JSON.stringify(body));
          setTimeout(() => {
            if (!M.api.ignoreSeq && b.client_seq !== undefined) {
              if (Number(b.client_seq) <= (M.api.seqByFollower[b.follower_id] || 0)) { M.api.posted.push({ url, body: b, rejected: true, stale: true }); return; }
              M.api.seqByFollower[b.follower_id] = Number(b.client_seq);
            }
            // A row with lists (M.api.rows) gets the same base_seq check and update.
            const r = (M.api.rows || {})[b.follower_id];
            if (r && !M.api.ignoreSeq) {
              if (b.base_seq !== undefined && (r.follow_seq || 0) > Number(b.base_seq)) { M.api.posted.push({ url, body: b, rejected: true, conflict: true }); return; }
              r.follow_seq = Number(b.client_seq);
              r.customers = String(b.customer_app_id_string || '').split(',').filter(Boolean).map(Number);
              r.bibs = {};
              Object.entries(b.bib_number_string || {}).forEach(([p, l]) => { r.bibs[p] = String(l).split(',').filter(Boolean); });
            }
            M.api.posted.push({ url, body: b, late: true });
          }, step.lateCommit);
          const e = new Error('timeout of 15000ms exceeded'); e.type = 'network'; throw e;
        }
        if (step.fail) { const e = new Error('Network Error'); e.type = 'network'; throw e; }
        if (step.failCode) { M.api.posted.push({ url, body, rejected: true }); throw Object.assign(new Error(step.failCode), { type: 'empty', code: step.failCode }); }
      }
      if (url.endsWith('/update_follower_favourites_api.php') && (M.api.rejectIds || []).includes(Number(body.follower_id))) {
        M.api.posted.push({ url, body, rejected: true });
        throw Object.assign(new Error('follower_not_found'), { type: 'empty', code: 'follower_not_found' });
      }
      if (M.api.fail) { const e = new Error('Network Error'); e.type = 'network'; throw e; }
      // A row with lists (M.api.rows) keeps its follow_seq in step with the order check.
      const row = url.endsWith('/update_follower_favourites_api.php') && !M.api.ignoreSeq ? (M.api.rows || {})[body.follower_id] : undefined;
      if (row) M.api.seqByFollower[body.follower_id] = Math.max(M.api.seqByFollower[body.follower_id] || 0, row.follow_seq || 0);
      // Server-side order check (update_follower_favourites_api client_seq).
      if (url.endsWith('/update_follower_favourites_api.php') && !M.api.ignoreSeq && body && body.client_seq !== undefined) {
        if (M.api.staleWith) {               // scripted once: stale, naming follow_seq = staleWith(body)
          const f = M.api.staleWith; M.api.staleWith = null;
          M.api.posted.push({ url, body, rejected: true, stale: true });
          return { success: true, data: { stale: true, follow_seq: f(body) } };
        }
        if (M.api.staleEcho) {               // e.g. a duplicate delivery: stale, naming the phone's OWN number
          M.api.staleEcho = false;
          M.api.posted.push({ url, body, rejected: true, stale: true });
          return { success: true, data: { stale: true, follow_seq: Number(body.client_seq) } };
        }
        const applied = M.api.seqByFollower[body.follower_id] || 0;
        if (Number(body.client_seq) <= applied) {
          M.api.posted.push({ url, body, rejected: true, stale: true });
          return { success: true, data: { stale: true, follow_seq: applied } };
        }
        // base_seq contract: the row moved on since the phone's base → nothing
        // written, 409 follow_conflict with the row's number + lists.
        if (row && body.base_seq !== undefined && (row.follow_seq || 0) > Number(body.base_seq)) {
          M.api.posted.push({ url, body, rejected: true, conflict: true });
          throw Object.assign(new Error('follow_conflict'), { type: 'empty', code: 'follow_conflict',
            data: { follow_seq: row.follow_seq, followed_customers: [...row.customers], followed_bibs: JSON.parse(JSON.stringify(row.bibs || {})) } });
        }
        M.api.seqByFollower[body.follower_id] = Number(body.client_seq);
        if (row) {
          row.follow_seq = Number(body.client_seq);
          row.customers = String(body.customer_app_id_string || '').split(',').filter(Boolean).map(Number);
          row.bibs = {};
          Object.entries(body.bib_number_string || {}).forEach(([p, l]) => { row.bibs[p] = String(l).split(',').filter(Boolean); });
        }
      }
      if (M.api.failWith) { M.api.posted.push({ url, body, rejected: true }); throw Object.assign(new Error(M.api.failWith.code), M.api.failWith); }
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
      if (M.fapi.byDeviceDelay) await new Promise((r) => setTimeout(r, M.fapi.byDeviceDelay));
      if (M.fapi.byDeviceTransient) throw Object.assign(new Error('Network Error'), { type: 'network', code: 'network_error' });
      if (!M.fapi.byDevice) throw Object.assign(new Error('follower_not_found'), { type: 'empty', code: 'follower_not_found' });
      return JSON.parse(JSON.stringify(M.fapi.byDevice));
    },
    registerFollower: async (token) => {
      M.fapi.registerCalls.push(token);
      if (M.fapi.registerDelay) await new Promise((r) => setTimeout(r, M.fapi.registerDelay));
      if (M.fapi.registerFail) throw Object.assign(new Error('Network Error'), { type: 'network' });
      return { ...M.fapi.registerResult };
    },
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
    isLocationServiceEnabled: async () => {
      if (M.gps.servicesThrows) throw new Error('provider state unavailable');
      return M.gps.servicesOn;
    },
  },
  isTracking: async () => M.tracking },
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
      && !['assert', 'path', 'fs', 'module', 'util', 'child_process'].includes(request)) {
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

// follow/unfollow resolve after the LOCAL save; their upload runs on its own
// (followStorage: fire-and-forget). Tests that inspect what reached the server
// get the follow functions wrapped to also wait for whenFollowSyncIdle().
// `load('utils/followStorage', { raw: true })` gives the real functions.
const SETTLE_FNS = ['followUser', 'followBib', 'unfollowUser', 'unfollowBib', 'smartFollow', 'smartUnfollow'];
function load(p, opts) {
  const mod = require(path.resolve(SRC, p));
  if (p !== 'utils/followStorage' || (opts && opts.raw)) return mod;
  const idle = typeof mod.whenFollowSyncIdle === 'function' ? mod.whenFollowSyncIdle : async () => {};
  const out = Object.create(mod);
  for (const n of SETTLE_FNS) out[n] = async (...a) => { try { return await mod[n](...a); } finally { await idle(); } };
  return out;
}

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
    // 20 s cap: a hang (e.g. an endless merge/sync loop) is a FAIL, not a stuck run.
    let timer;
    const cap = new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('timed out after 20 s (hang / endless loop)')), 20000); });
    try { await Promise.race([tc.fn(), cap]); pass++; console.log('  PASS ', tc.name); }
    catch (e) { fail++; console.log('  FAIL ', tc.name, '\n        ', String((e && e.message) || e).split('\n').join('\n         ')); }
    finally { clearTimeout(timer); }
  }
  tests.length = 0;
  return { pass, fail };
}

// CONFIG: the constants/config stub the app modules see (tests may tune TIMEOUT).
const CONFIG = relOverrides[rel('constants/config')];
module.exports = { M, load, test, run, textOf, findPressable, SRC, CONFIG };
