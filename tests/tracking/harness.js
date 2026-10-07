// Minimal harness: loads the REAL app TypeScript from ../../src (transpiled on
// the fly with the project's own `typescript`) with native / Expo modules
// replaced by controllable mocks. No test framework needed — plain Node.
const Module = require('module');
const path = require('path');
const fs = require('fs');
const ts = require('typescript');

// APP_SRC points the suite at another checkout, e.g. an older commit, to confirm
// the tests FAIL without the fixes:  APP_SRC=/path/to/old/src npm run test:tracking
const SRC = (process.env.APP_SRC || path.resolve(__dirname, '../../src')).replace(/\\/g, '/');

// ── controllable mock state ──────────────────────────────────────────────
const M = {
  store: new Map(),
  net: { isConnected: true, isInternetReachable: true },
  netHang: false,
  api: { mode: 'ok', posted: [], handler: null },
  axios: { calls: [], script: [] },
  logs: [],
  clock: Date.now(),
  perm: { fg: 'granted', bg: 'granted', iosAccuracy: 'full' },
  provider: { enabled: true, gps: true, network: true, status: 3 },
  appVersion: '1.0.9',
  updateId: 'abcdef1234567890',
};
const realNow = Date.now.bind(Date);
Date.now = () => M.clock;

function anyStub(name) {
  // Callable, any property → another stub; awaiting it resolves undefined.
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

const AsyncStorage = {
  getItem: async (k) => (M.store.has(k) ? M.store.get(k) : null),
  setItem: async (k, v) => { M.store.set(k, String(v)); },
  removeItem: async (k) => { M.store.delete(k); },
  multiRemove: async (ks) => ks.forEach((k) => M.store.delete(k)),
  getAllKeys: async () => [...M.store.keys()],
};

function apiPost(url, body) {
  if (M.api.handler) return M.api.handler(url, body);
  if (M.api.mode === 'down') { const e = new Error('Network Error'); e.type = 'network'; return Promise.reject(e); }
  if (M.api.mode === 'reject') { const e = new Error('bad'); e.type = 'empty'; e.code = M.api.rejectCode || 'latitude_invalid'; return Promise.reject(e); }
  if (M.api.mode === 'softfail') return Promise.resolve({ success: false, data: null, error: 'insert_failed' });
  M.api.posted.push({ url, body });
  return Promise.resolve({ success: true, data: { coordinate_id: M.api.posted.length, finished: 0 }, error: null });
}

const overrides = {
  '@react-native-async-storage/async-storage': { __esModule: true, default: AsyncStorage },
  '@react-native-community/netinfo': { __esModule: true, default: {
    fetch: () => (M.netHang ? new Promise(() => {}) : Promise.resolve({ ...M.net })),
    addEventListener: () => () => {},
  } },
  'react-native': { Platform: { OS: 'ios', Version: '26.6', select: (o) => o.ios }, AppState: { addEventListener: () => ({ remove() {} }), currentState: 'active' }, NativeModules: {}, Alert: { alert() {} } },
  'expo-application': { get nativeApplicationVersion() { return M.appVersion; }, getAndroidId: () => 'aid', getIosIdForVendorAsync: async () => 'vid' },
  'expo-updates': { get updateId() { return M.updateId; } },
  'expo-location': {
    getForegroundPermissionsAsync: async () => ({ status: M.perm.fg, canAskAgain: true, ios: { accuracy: M.perm.iosAccuracy } }),
    getBackgroundPermissionsAsync: async () => ({ status: M.perm.bg, canAskAgain: true }),
    Accuracy: { High: 4 },
    stopLocationUpdatesAsync: async () => {},
    hasStartedLocationUpdatesAsync: async () => false,
  },
  'react-native-background-geolocation': { __esModule: true, default: new Proxy({
    getProviderState: async () => ({ ...M.provider }),
  }, { get(t, p) { return p in t ? t[p] : anyStub('BG.' + String(p)); } }) },
  axios: { __esModule: true, default: {
    post: async (url, body, cfg) => {
      M.axios.calls.push({ url, body, cfg, at: M.clock });
      const next = M.axios.script.shift();
      if (!next || next === 'ok') return { data: { success: true } };
      if (next === 'network') throw Object.assign(new Error('Network Error'), {});
      throw Object.assign(new Error('HTTP ' + next), { response: { status: next } });
    },
    create: () => ({ post: async () => ({}), get: async () => ({}), interceptors: { request: { use() {} }, response: { use() {} } } }),
  } },
};

// Relative modules we replace (resolved absolute path → mock), set per suite.
const relOverrides = {
  [path.resolve(SRC, 'services/api')]: { apiClient: { post: (u, b) => apiPost(u, b), get: async () => ({}) } },
  [path.resolve(SRC, 'constants/config')]: null, // filled below (real or stub)
};

const configStub = {
  API_CONFIG: { DEBUG: false, USE_MOCK_DATA: false, TIMEOUT: 10000,
    ENDPOINTS: { PARTICIPANT_LOCATION: '/insert_participant_location_api.php', SAVE_TRACKING_LOG: '/save_tracking_log_api.php', SAVE_TRACKING_START: '/save_tracking_start_api.php', HEARTBEAT_PING: '/heartbeat_ping_api.php' },
    getHeaders: async () => ({ Authorization: 'Bearer x' }) },
  APP_CONFIG: { VERSION: 'stub' },
  getApiEndpoint: (x) => 'https://api.test' + x,
  getDeviceId: async () => 'dev',
};
relOverrides[path.resolve(SRC, 'constants/config')] = configStub;
relOverrides[path.resolve(SRC, 'i18n')] = { __esModule: true, default: { t: (k) => k, language: 'en', changeLanguage: async () => {} } };

let useRealConfig = false;
const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (overrides[request]) return overrides[request];
  if (request.startsWith('.') && parent && parent.filename) {
    const abs = path.resolve(path.dirname(parent.filename), request);
    if (abs in relOverrides && !(useRealConfig && abs.endsWith(path.join('constants', 'config')))) {
      return relOverrides[abs];
    }
    if (useRealConfig && abs.endsWith(path.join('services', 'tokenService'))) {
      return { tokenService: { getToken: async () => 'tok' } };
    }
  }
  if (!request.startsWith('.') && !path.isAbsolute(request) && !['assert', 'path', 'fs', 'module', 'util'].includes(request)) {
    return anyStub(request);
  }
  return origLoad.apply(this, arguments);
};
Module._extensions['.ts'] = function (module, filename) {
  const src = fs.readFileSync(filename, 'utf8');
  const out = ts.transpileModule(src, { fileName: filename, compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019, esModuleInterop: true, jsx: ts.JsxEmit.React } });
  module._compile(out.outputText, filename);
};
Module._extensions['.tsx'] = Module._extensions['.ts'];

// gpsService.addLog writes to the real (mocked-storage) log; also mirror to M.logs.
function load(rel) { return require(path.resolve(SRC, rel)); }

function reset() {
  M.store.clear(); M.net = { isConnected: true, isInternetReachable: true }; M.netHang = false;
  M.api = { mode: 'ok', posted: [], handler: null }; M.axios = { calls: [], script: [] }; M.logs = [];
  M.perm = { fg: 'granted', bg: 'granted', iosAccuracy: 'full' };
  M.provider = { enabled: true, gps: true, network: true, status: 3 };
  M.clock = realNow();
  // Fresh module instances per test: the services keep module-level state
  // (probe window, trust window, drain mutexes) that must not leak between tests.
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
  for (const t of tests) {
    reset();
    try { await t.fn(); pass++; console.log('  PASS ', t.name); }
    catch (e) { fail++; console.log('  FAIL ', t.name, '\n        ', (e && e.message || e).split('\n').join('\n         ')); }
  }
  tests.length = 0;
  return { pass, fail };
}

module.exports = { M, load, test, run, reset, setRealConfig: (v) => { useRealConfig = v; }, SRC };
