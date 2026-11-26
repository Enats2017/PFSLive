// Minimal harness for the results / live-map / event-list suite (app audit
// 2026-11-26). Loads the REAL app TypeScript from ../../src (transpiled on the
// fly with the project's own `typescript`), with native / Expo modules stubbed
// and a tiny fake React that runs HOOKS (state, refs, memo, callbacks,
// effects) without a renderer. No test framework needed — plain Node.
//
// APP_SRC points the suite at another checkout to confirm the tests FAIL
// without the fixes:  APP_SRC=D:/react_native/PFSLive/src node tests/results/app.test.js
const Module = require('module');
const path = require('path');
const fs = require('fs');
const ts = require('typescript');

const SRC = (process.env.APP_SRC || path.resolve(__dirname, '../../src')).replace(/\\/g, '/');

// ── fake clock + timers ──────────────────────────────────────────────────
// Every setTimeout / setInterval made by app code is queued here and only runs
// when a test calls advance(). Date.now follows the same clock.
const realSetTimeout = setTimeout;
const realSetImmediate = setImmediate;
const T = { now: 1_800_000_000_000, timers: new Map(), nextId: 1 };
Date.now = () => T.now;
global.setTimeout = (fn, ms = 0, ...a) => { const id = T.nextId++; T.timers.set(id, { fn, at: T.now + (ms || 0), every: 0, a }); return id; };
global.setInterval = (fn, ms = 0, ...a) => { const id = T.nextId++; T.timers.set(id, { fn, at: T.now + (ms || 0), every: ms || 1, a }); return id; };
global.clearTimeout = (id) => { T.timers.delete(id); };
global.clearInterval = (id) => { T.timers.delete(id); };

/** Let pending promise callbacks run (several macrotask turns). */
async function flush(n = 6) { for (let i = 0; i < n; i++) await new Promise((r) => realSetImmediate(r)); }

/** Move the clock forward, firing due timers in order, flushing promises between. */
async function advance(ms) {
  const end = T.now + ms;
  for (;;) {
    await flush();   // let pending awaits create their timers first
    let next = null;
    for (const [id, t] of T.timers) if (t.at <= end && (!next || t.at < next[1].at)) next = [id, t];
    if (!next) break;
    const [id, t] = next;
    T.now = Math.max(T.now, t.at);
    if (t.every) t.at += t.every; else T.timers.delete(id);
    t.fn(...t.a);
    await flush();
  }
  T.now = end;
  await flush();
}
/** Jump the clock WITHOUT firing timers — the app was in the background. */
function sleepInBackground(ms) {
  T.now += ms;
  for (const t of T.timers.values()) t.at += ms;   // paused timers resume where they were
}

// ── fake React (hooks only) ──────────────────────────────────────────────
let current = null;
const depsChanged = (a, b) => !a || !b || a.length !== b.length || a.some((v, i) => !Object.is(v, b[i]));
function scheduleRender(host) {
  if (!host.mounted || host.dirty) return;
  host.dirty = true;
  Promise.resolve().then(() => { if (host.mounted && host.dirty) { host.dirty = false; renderHost(host); } });
}
function renderHost(host) {
  const prev = current;
  current = host; host.i = 0; host.pendingEffects = [];
  try { host.result = host.fn(host.props); } finally { current = prev; }
  for (const e of host.pendingEffects) {
    if (e.slot.cleanup) { try { e.slot.cleanup(); } catch (_) {} }
    const c = e.fn();
    e.slot.cleanup = typeof c === 'function' ? c : null;
  }
}
function slot(init) {
  const h = current; const i = h.i++;
  if (!(i in h.slots)) h.slots[i] = init();
  return h.slots[i];
}
const fakeReact = {
  __esModule: true,
  useState(init) {
    const h = current;
    const s = slot(() => ({ v: typeof init === 'function' ? init() : init }));
    if (!s.set) s.set = (v) => { const nv = typeof v === 'function' ? v(s.v) : v; if (Object.is(nv, s.v)) return; s.v = nv; scheduleRender(h); };
    return [s.v, s.set];
  },
  useReducer(red, init) { const [v, set] = fakeReact.useState(init); return [v, (a) => set((p) => red(p, a))]; },
  useRef(v) { return slot(() => ({ current: v })); },
  useMemo(fn, deps) { const s = slot(() => ({ deps: null, v: undefined })); if (depsChanged(s.deps, deps)) { s.v = fn(); s.deps = deps; } return s.v; },
  useCallback(fn, deps) { return fakeReact.useMemo(() => fn, deps); },
  useEffect(fn, deps) { const s = slot(() => ({ deps: undefined, cleanup: null, first: true })); if (s.first || depsChanged(s.deps, deps)) { s.first = false; s.deps = deps; current.pendingEffects.push({ slot: s, fn }); } },
  useLayoutEffect(fn, deps) { return fakeReact.useEffect(fn, deps); },
  memo: (c) => c, forwardRef: (c) => c, createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
  Fragment: 'Fragment',
};
fakeReact.default = fakeReact;

/** Mount a hook: renderHook(() => useX(a, b)). props can be changed with rerender(). */
function renderHook(fn, props) {
  const host = { fn, props, slots: [], mounted: true, dirty: false, result: undefined };
  renderHost(host);
  return {
    get result() { return host.result; },
    rerender(p) { host.props = p; renderHost(host); },
    unmount() { host.mounted = false; for (const s of host.slots) if (s && s.cleanup) { try { s.cleanup(); } catch (_) {} } },
  };
}

// ── mocks ────────────────────────────────────────────────────────────────
const M = { focused: true, appCbs: [], netFetch: null, deviceId: 'dev-1' };

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

const tFn = (k, o) => (typeof o === 'string' ? o : k);
const I18N = { t: tFn, i18n: { language: 'en' } };
const overrides = {
  react: fakeReact,
  // One stable t, like i18next's: a new function per render would re-run every
  // effect that depends on it (useScreenError's does).
  'react-i18next': { useTranslation: () => I18N },
  '@react-navigation/native': {
    useIsFocused: () => M.focused,
    useNavigation: () => ({ navigate() {}, goBack() {} }),
    // Runs while focused, cleans up on blur — the shape React Navigation gives.
    useFocusEffect: (cb) => fakeReact.useEffect(() => (M.focused ? cb() : undefined), [cb, M.focused]),
  },
  'react-native': {
    Platform: { OS: 'ios', select: (o) => o.ios },
    AppState: {
      currentState: 'active',
      addEventListener: (ev, cb) => { const h = { cb, remove() { M.appCbs = M.appCbs.filter((x) => x !== h); } }; M.appCbs.push(h); return h; },
    },
    Alert: { alert() {} },
    useWindowDimensions: () => ({ width: 390, height: 800, scale: 3, fontScale: 1 }),
  },
  // axios: an instance whose post/get call M.axiosPost (set per test).
  axios: {
    __esModule: true,
    default: {
      create: () => ({
        interceptors: { request: { use() {} }, response: { use() {} } },
        post: (url, data, cfg) => (M.axiosPost ? M.axiosPost(url, data, cfg) : Promise.reject(new Error('no axios mock'))),
        get: (url, cfg) => (M.axiosPost ? M.axiosPost(url, undefined, cfg) : Promise.reject(new Error('no axios mock'))),
        put: () => Promise.reject(new Error('no axios mock')),
        delete: () => Promise.reject(new Error('no axios mock')),
      }),
      isAxiosError: (e) => !!(e && e.isAxiosError),
    },
    isAxiosError: (e) => !!(e && e.isAxiosError),
  },
  '@react-native-async-storage/async-storage': { __esModule: true, default: { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} } },
};

// Relative modules replaced per test: key = path under src without extension.
const relMocks = {};
function mockModule(relNoExt, exportsObj) { relMocks[path.resolve(SRC, relNoExt).replace(/\\/g, '/')] = exportsObj; }

const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (overrides[request]) return overrides[request];
  if (request.startsWith('.') && parent && parent.filename) {
    const abs = path.resolve(path.dirname(parent.filename), request).replace(/\\/g, '/').replace(/\.(ts|tsx)$/, '');
    if (abs in relMocks) return relMocks[abs];
  }
  // Packages' own requires (turf → @turf/helpers, …) load for real; only
  // the app's direct imports are stubbed.
  const fromApp = parent && parent.filename && parent.filename.split(path.sep).join('/').startsWith(SRC);
  if (fromApp && !request.startsWith('.') && !path.isAbsolute(request)
      && !['assert', 'path', 'fs', 'module', 'util', 'typescript', 'child_process', 'fast-xml-parser', '@turf/turf', '@react-navigation/routers'].includes(request)) {
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

// The app's real config reads EXPO_PUBLIC_* env; a fixed stub keeps it offline.
mockModule('constants/config', {
  API_CONFIG: { DEBUG: false, TIMEOUT: 15000, BASE_URL: 'http://test.invalid', ENDPOINTS: new Proxy({}, { get: (t, p) => '/' + String(p) }), getHeaders: async () => ({ Authorization: 'Bearer t' }) },
  APP_CONFIG: {},
  getApiEndpoint: (p) => 'http://test.invalid' + p,
  getImageUrl: (u) => u || null,
  getDeviceId: async () => M.deviceId,
});
mockModule('i18n', { getCurrentLanguageId: () => 1, default: {} });
mockModule('services/tokenService', { tokenService: { getToken: async () => 'tok', getCustomerId: async () => null } });
mockModule('services/analyticsService', { analyticsService: anyStub('analytics') });

function load(rel) { return require(path.resolve(SRC, rel)); }
function exists(rel) { return ['', '.ts', '.tsx'].some((e) => fs.existsSync(path.resolve(SRC, rel + e))); }
function source(rel) { return fs.readFileSync(path.resolve(SRC, rel), 'utf8').split(String.fromCharCode(13, 10)).join(String.fromCharCode(10)); }

/** A promise the test resolves / rejects by hand. */
function deferred() { let resolve, reject; const p = new Promise((a, b) => { resolve = a; reject = b; }); return { p, resolve, reject }; }

function reset() {
  T.timers.clear(); M.focused = true; M.appCbs = []; M.netFetch = null; M.axiosPost = null;
  global.fetch = () => Promise.reject(new Error('no fetch mock'));
  for (const k of Object.keys(relMocks)) if (!/constants\/config$|\/i18n$|services\/tokenService$|services\/analyticsService$/.test(k)) delete relMocks[k];
  for (const k of Object.keys(require.cache)) if (k.replace(/\\/g, '/').startsWith(SRC)) delete require.cache[k];
}

const tests = [];
function test(name, fn, timeoutMs = 5000) { tests.push({ name, fn, timeoutMs }); }
/** Replace a package for the tests that follow (e.g. 'axios'). */
function setOverride(name, value) { overrides[name] = value; }
async function run(title) {
  let pass = 0, fail = 0;
  console.log(`\n== ${title} ==`);
  for (const t of tests) {
    reset();
    try {
      await Promise.race([t.fn(), new Promise((_, rej) => realSetTimeout(() => rej(new Error(`test timed out (${t.timeoutMs / 1000}s)`)), t.timeoutMs))]);
      pass++; console.log('  PASS ', t.name);
    } catch (e) { fail++; console.log('  FAIL ', t.name, '\n        ', String((e && e.message) || e).split('\n').join('\n         ')); }
  }
  tests.length = 0;
  return { pass, fail };
}

/** All text in a fake-React element tree (strings and numbers, in order). */
/** First element in a fake-React tree whose props pass test(props). */
function findEl(node, test) {
  if (node == null || typeof node !== 'object') return null;
  if (Array.isArray(node)) { for (const n of node) { const f = findEl(n, test); if (f) return f; } return null; }
  if (node.props && test(node.props)) return node;
  return node.props ? findEl(node.props.children, test) : null;
}

function textOf(node) {
  if (node == null || node === false || node === true) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (node.props) return textOf(node.props.children);
  return '';
}

module.exports = { SRC, T, M, flush, advance, sleepInBackground, renderHook, mockModule, load, exists, source, deferred, test, run, realSetTimeout, setOverride, textOf, findEl };
