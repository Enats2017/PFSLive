// Personal events, settings, feedback, share intent, version check —
// app audit 2026-11-26 (findings 1, 3-8, 10-13, 16, 17).
//
//   node tests/personal_events/app.test.js
//   APP_SRC=D:/react_native/PFSLive/src node tests/personal_events/app.test.js   (old code: must FAIL)
//
// Loads the REAL TypeScript (transpiled with the project's own `typescript`)
// with native / network modules replaced by small fakes, plus source checks
// for screen wiring that cannot run outside React Native. Plain Node, no
// framework.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const SRC = (process.env.APP_SRC || path.resolve(__dirname, '../../src')).replace(/\\/g, '/');
const ROOT = path.resolve(SRC, '..');

// ── tiny module loader ───────────────────────────────────────────────────
function resolveTs(abs) {
  for (const ext of ['', '.ts', '.tsx', '/index.ts']) {
    if (fs.existsSync(abs + ext) && fs.statSync(abs + ext).isFile()) return abs + ext;
  }
  throw new Error('module not found: ' + abs);
}
function load(rel, mocks = {}, cache = {}) {
  const file = resolveTs(path.resolve(SRC, rel));
  if (cache[file]) return cache[file].exports;
  const src = fs.readFileSync(file, 'utf8');
  const out = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019, esModuleInterop: true, jsx: ts.JsxEmit.React },
  }).outputText;
  const mod = { exports: {} };
  cache[file] = mod;
  const req = (spec) => {
    if (Object.prototype.hasOwnProperty.call(mocks, spec)) return mocks[spec];
    if (spec.startsWith('.')) {
      const abs = path.resolve(path.dirname(file), spec);
      const relToSrc = path.relative(SRC, abs).replace(/\\/g, '/');
      if (Object.prototype.hasOwnProperty.call(mocks, relToSrc)) return mocks[relToSrc];
      return load(relToSrc, mocks, cache);
    }
    return require(spec);
  };
  new Function('require', 'module', 'exports', out)(req, mod, mod.exports);
  return mod.exports;
}
const read = (rel) => fs.readFileSync(path.resolve(SRC, rel), 'utf8');
const readRoot = (rel) => fs.readFileSync(path.resolve(ROOT, rel), 'utf8');
const between = (s, from, to) => { const i = s.indexOf(from); assert.ok(i >= 0, `"${from}" not found`); const j = s.indexOf(to, i + from.length); return s.slice(i, j < 0 ? undefined : j); };

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

// ── shared fakes ─────────────────────────────────────────────────────────
const fakeConfig = () => ({
  __esModule: true,
  API_CONFIG: { DEBUG: false, TIMEOUT: 15000, ENDPOINTS: new Proxy({}, { get: (_, k) => '/' + String(k) }),
    getHeaders: async () => ({}), getMutiForm: async () => ({}) },
  APP_CONFIG: { VERSION: '1.0.9' },
  getApiEndpoint: (p) => 'http://test' + p,
});
class FakeFormData { constructor() { this.parts = []; } append(k, v) { this.parts.push([k, v]); } get(k) { const p = this.parts.find((x) => x[0] === k); return p ? p[1] : undefined; } has(k) { return this.parts.some((x) => x[0] === k); } }
global.FormData = FakeFormData;
const G = () => load('screens/PersonalEventScreen/personalEventGuards');

// ════════════ 1. double submit (create / edit / feedback / delete) ════════════
test('F1 tryBeginSubmit: a second tap in the same frame is refused', () => {
  const { tryBeginSubmit, endSubmit } = G();
  const gate = { current: false };
  assert.strictEqual(tryBeginSubmit(gate), true);
  assert.strictEqual(tryBeginSubmit(gate), false);
  endSubmit(gate);
  assert.strictEqual(tryBeginSubmit(gate), true);
});
test('F1 CreatePersonalEvent: the ref gate is taken before createPersonalEvent() and released in finally', () => {
  const s = read('screens/PersonalEventScreen/CreatePersonalEvent.tsx');
  const body = between(s, 'const handleSubmit = useCallback(async () => {', '}, [');
  const gate = body.indexOf('tryBeginSubmit(submitGateRef)');
  const call = body.indexOf('await createPersonalEvent(');
  assert.ok(gate > 0 && call > gate, 'gate before the request');
  assert.ok(/finally \{[\s\S]*endSubmit\(submitGateRef\)/.test(body), 'released in finally');
});
test('F1 EditPersonalEvent: same gate before updatePersonalEvent()', () => {
  const s = read('screens/PersonalEventScreen/EditPersonalEvent.tsx');
  const body = between(s, 'const handleSubmit = useCallback(async () => {', '}, [');
  assert.ok(body.indexOf('tryBeginSubmit(submitGateRef)') > 0 && body.indexOf('await updatePersonalEvent(') > body.indexOf('tryBeginSubmit(submitGateRef)'));
  assert.ok(/finally \{[\s\S]*endSubmit\(submitGateRef\)/.test(body));
});
test('F1 create request uses the upload timeout (>= 60 s), not the shared 15 s', async () => {
  let cfg = null;
  const svc = load('services/personalEventService', {
    '../constants/config': fakeConfig(),
    './api': { apiClient: { postRaw: async (_u, _b, c) => { cfg = c; return { status: 200, data: { success: true, data: { action: 'registered', event: { product_custom_app_id: 5 } } } }; } } },
  });
  await svc.createPersonalEvent({ name: 'Run', eventTypeId: 3, categoryId: 59, date: '2099-01-01', startTime: '', timezone: 'Europe/Brussels' });
  assert.ok(cfg && cfg.timeout >= 60000, 'timeout was ' + (cfg && cfg.timeout));
});

// ════════════ 6 + 16. edit: start time cleared, time zone only when needed ════════════
const runEdit = async (params) => {
  let sent = null, cfg = null;
  const svc = load('services/editPersonalEventService', {
    '../constants/config': fakeConfig(),
    './api': { apiClient: { postRaw: async (_u, body, c) => { sent = body; cfg = c; return { status: 200, data: { success: true, data: { message: 'ok' } } }; } } },
  });
  await svc.updatePersonalEvent({ eventId: 7, name: 'Run', eventTypeId: 3, categoryId: 59, date: '2099-01-01', ...params });
  return { sent, cfg };
};
test('F6 edit: a cleared start time is SENT as start_hour "" (it was left out → server kept the old time)', async () => {
  const { sent } = await runEdit({ startTime: '', timezone: 'Europe/Brussels' });
  assert.strictEqual(sent.has('start_hour'), true, 'start_hour sent');
  assert.strictEqual(sent.get('start_hour'), '');
});
test('F6 edit: a set start time is sent as HH:MM', async () => {
  const { sent } = await runEdit({ startTime: '7:05', timezone: 'Europe/Brussels' });
  assert.strictEqual(sent.get('start_hour'), '07:05');
});
test('F16 edit: no timezone field when the screen passes none (event keeps its zone)', async () => {
  const { sent, cfg } = await runEdit({ startTime: '09:00', timezone: undefined });
  assert.strictEqual(sent.has('timezone'), false);
  assert.ok(cfg.timeout >= 60000, 'upload timeout on edit too');
});
test('F16 editTimezoneToSend: rename only → undefined; date or time changed → the phone zone', () => {
  const { editTimezoneToSend } = G();
  const base = { date: '2099-01-01', startTime: '09:00', loadedDate: '2099-01-01', loadedStartTime: '09:00', deviceTimezone: 'Asia/Tokyo' };
  assert.strictEqual(editTimezoneToSend(base), undefined);
  assert.strictEqual(editTimezoneToSend({ ...base, date: '2099-01-02' }), 'Asia/Tokyo');
  assert.strictEqual(editTimezoneToSend({ ...base, startTime: '10:00' }), 'Asia/Tokyo');
  assert.strictEqual(editTimezoneToSend({ ...base, startTime: '' }), 'Asia/Tokyo');
});
test('F16 EditPersonalEvent passes editTimezoneToSend(...) instead of getDeviceTimezone() directly', () => {
  const s = read('screens/PersonalEventScreen/EditPersonalEvent.tsx');
  assert.ok(/timezone:\s*editTimezoneToSend\(/.test(s));
  assert.ok(!/timezone:\s*getDeviceTimezone\(\)/.test(s));
});

// ════════════ 7. unmapped server field codes ════════════
test('F7 timezone codes are mapped; an unknown code is detected so the screen can say something', () => {
  const { hasNoMappedField } = G();
  assert.strictEqual(hasNoMappedField(['timezone_invalid']), false);
  assert.strictEqual(hasNoMappedField(['gpx_read_failed']), false);
  assert.strictEqual(hasNoMappedField(['something_new']), true);
  assert.strictEqual(hasNoMappedField(['something_new', 'name_required']), false);
});
test('F7 both screens map timezone_invalid and fall back when nothing is mapped', () => {
  for (const f of ['CreatePersonalEvent.tsx', 'EditPersonalEvent.tsx']) {
    const s = read('screens/PersonalEventScreen/' + f);
    assert.ok(/case 'timezone_invalid':[\s\S]{0,120}timezoneInvalid/.test(s), f + ' maps timezone_invalid');
    assert.ok(s.includes('hasNoMappedField(response.fields)'), f + ' falls back');
  }
  for (const l of ['en', 'fr', 'nl']) {
    const j = JSON.parse(read(`i18n/PersonalEvent/${l}.json`));
    assert.ok(j.errors.timezoneInvalid, 'PersonalEvent ' + l);
  }
});

// ════════════ 3. visibility: saved vs tabs ════════════
test('F3 language change sends the SAVED visibility, never an unsaved tab', () => {
  const { languageUpdateSettings } = load('screens/SettingScreen/visibilitySettings');
  assert.deepStrictEqual(languageUpdateSettings({ visibility: 'public', password: '' }),
    { live_tracking_visibility: 'public', live_tracking_password: '' });
  assert.deepStrictEqual(languageUpdateSettings({ visibility: 'private', password: 'abc123' }),
    { live_tracking_visibility: 'private', live_tracking_password: 'abc123' });
});
test('F3 UserTrackingSettings: language change uses savedRef; closing the sheet unsaved reverts the tabs', () => {
  const s = read('screens/SettingScreen/UserTrackingSettings.tsx');
  const lang = between(s, 'const handleLanguageChange = async', 'const handleTabSwitch');
  assert.ok(lang.includes('languageUpdateSettings(savedRef.current)'), 'saved state sent');
  assert.ok(!/live_tracking_visibility:\s*visibility/.test(lang), 'the tab state is not sent');
  assert.ok(/onRequestClose=\{dismissModal\}/.test(s), 'back reverts');
  assert.ok(/modalBackdrop\} onPress=\{dismissModal\}/.test(s), 'backdrop reverts');
  const dismiss = between(s, 'const dismissModal = () => {', '};');
  assert.ok(dismiss.includes('afterSheetDismissed(savedRef.current)') && dismiss.includes('setVisibility('));
});

// ════════════ 4 + 5. share intent ════════════
test('F4 navigateToPersonalEvent waits with whenNavigatorReady (20 s), not a 5 s private poll', () => {
  const s = readRoot('App.tsx');
  const fn = between(s, 'const navigateToPersonalEvent = (', '\n};');
  assert.ok(fn.includes('whenNavigatorReady('), 'uses whenNavigatorReady');
  assert.ok(!/setTimeout\(\(\) => clearInterval\(interval\), 5000\)/.test(fn), 'no 5 s cut-off');
});
test('F5 a repeated GPX share within 2 s is dropped before navigating / counting', () => {
  const s = readRoot('App.tsx');
  const fn = between(s, 'const navigateToPersonalEvent = (', '\n};');
  const rep = fn.indexOf('isRepeatLink(');
  assert.ok(rep >= 0 && rep < fn.indexOf('logGpxImported'), 'repeat check before analytics');
});

// ════════════ 8. delete / edit while tracking ════════════
test('F8 isTrackingParticipant matches the stored session by participant id', () => {
  const { isTrackingParticipant, trackedParticipantFrom, TRACKING_PARAMS_KEY_LOCAL } = G();
  assert.strictEqual(TRACKING_PARAMS_KEY_LOCAL, '@PFSLive:trackingParams');
  const raw = JSON.stringify({ participantId: 4711, eventId: 100123 });
  assert.strictEqual(isTrackingParticipant(raw, 4711), true);
  assert.strictEqual(isTrackingParticipant(raw, '4711'), true);
  assert.strictEqual(isTrackingParticipant(raw, 4712), false);
  assert.strictEqual(isTrackingParticipant(null, 4711), false);
  assert.strictEqual(isTrackingParticipant('{bad', 4711), false);
  assert.strictEqual(trackedParticipantFrom(raw), '4711');
  assert.strictEqual(trackedParticipantFrom(null), null);
});
test('F8 the literal key matches gpsService TRACKING_PARAMS_KEY', () => {
  assert.ok(read('services/gpsService.ts').includes("const TRACKING_PARAMS_KEY = '@PFSLive:trackingParams'"));
});
test('F8 OwnProfile refuses delete of the tracked event (request + confirm); card hides Edit/Delete', () => {
  const s = read('screens/ProfileScreen/OwnProfile.tsx');
  const req = between(s, 'const handleDeleteRequest = useCallback(', '}, [');
  assert.ok(req.includes('isTrackedNow(event)') && req.includes('trackingNowError'), 'request checks tracking');
  const conf = between(s, 'const handleConfirmDelete = useCallback(', '}, [');
  assert.ok(conf.indexOf('isTrackedNow(deleteTarget)') > 0 && conf.indexOf('isTrackedNow(deleteTarget)') < conf.indexOf('deleteCustomEvent('), 'confirm re-checks before the request');
  const card = read('screens/ProfileScreen/EventCardLive.tsx');
  assert.ok(/const canDelete = [^;]*!isTrackedNow/.test(card), 'Delete hidden');
  assert.ok(/const showEdit = [^;]*isTrackedNow/.test(card), 'Edit hidden');
  assert.ok(read('screens/ProfileScreen/TrainingContent.tsx').includes('isTrackedNow='), 'TrainingContent passes it');
  for (const l of ['en', 'fr', 'nl']) assert.ok(JSON.parse(read(`i18n/OwnProfile/${l}.json`)).deleteEvent.trackingNowError, 'OwnProfile ' + l);
});

// ════════════ 13. delete confirm double tap ════════════
test('F13 handleConfirmDelete has a synchronous gate before the request', () => {
  const s = read('screens/ProfileScreen/OwnProfile.tsx');
  const conf = between(s, 'const handleConfirmDelete = useCallback(', '}, [');
  const g = conf.indexOf('if (deleteGateRef.current) return;');
  assert.ok(g > 0 && g < conf.indexOf('deleteCustomEvent('));
  assert.ok(/finally \{[\s\S]*deleteGateRef\.current = false/.test(conf));
});

// ════════════ 10. feedback ════════════
test('F10 ContactFeedbackScreen: ref gate before feedbackApi.submit', () => {
  const s = read('screens/ProfileScreen/ContactFeedbackScreen.tsx');
  const body = between(s, 'const handleSubmit = useCallback(async () => {', '}, [');
  assert.ok(/if \(submitting \|\| sendingRef\.current\) return;/.test(body));
  assert.ok(body.indexOf('sendingRef.current = true') < body.indexOf('feedbackApi.submit('));
});
test('F10 feedback request timeout >= 45 s (server mails before answering)', async () => {
  let cfg = null;
  const api = load('services/feedbackApi', {
    axios: { __esModule: true, default: { post: async (_u, _b, c) => { cfg = c; return { data: { success: true, data: { feedback_id: 1 } } }; } } },
    'react-native': { Platform: { OS: 'ios', Version: '17' } },
    '../constants/config': fakeConfig(),
  });
  const r = await api.feedbackApi.submit({ topic: 'bug', message: 'hello there' });
  assert.strictEqual(r.success, true);
  assert.ok(cfg.timeout >= 45000, 'timeout ' + cfg.timeout);
});

// ════════════ 11. version check ════════════
test('F11 a failed version check is flagged, and the hook stamps the throttle only for a real answer', async () => {
  const vs = load('services/versionService', {
    './api': { apiClient: { post: async () => { const e = new Error('Network Error'); e.type = 'network'; throw e; } } },
    '../constants/config': fakeConfig(),
    'react-native': { Platform: { OS: 'android' }, Linking: {} },
    'expo-constants': { __esModule: true, default: { expoConfig: { version: '1.0.9' } } },
    '../i18n': { getCurrentLanguageId: () => 1 },
    'expo-application': { nativeApplicationVersion: '1.0.9' },
  }).versionService;
  const r = await vs.checkVersion();
  assert.strictEqual(r.needsUpdate, false);
  assert.strictEqual(r.failed, true, 'failure is not "up to date"');
  const hook = read('hooks/useVersionCheck.ts');
  assert.ok(/if \(shouldStampCheck\(result\)\) \{\s*await AsyncStorage\.setItem\(LAST_CHECK_KEY/.test(hook), 'stamp guarded');
});

// ════════════ 12. analytics never breaks a success ════════════
test('F12 markAsParticipant resolves even when Firebase rejects', async () => {
  const reject = async () => { throw new Error('firebase down'); };
  const svc = load('services/analyticsService', {
    '@react-native-firebase/analytics': { getAnalytics: () => ({}), setUserId: reject, setUserProperty: reject,
      setAnalyticsCollectionEnabled: reject, setDefaultEventParameters: reject, logEvent: reject },
    'expo-location': {}, 'expo-notifications': {},
    '@react-native-async-storage/async-storage': { __esModule: true, default: { getItem: async () => null, setItem: async () => {} } },
    './tokenService': { tokenService: { getHasParticipated: async () => false, setHasParticipated: async () => {}, getHasUsedFollowerFeature: async () => false } },
    '../constants/analyticsScreens': { ANALYTICS_PARAMS: {} },
  }).analyticsService;
  await svc.markAsParticipant('create_event');   // must not throw
});

// ════════════ 17. form kept across a login ════════════
test('F17 draft round-trip; older than a day or unreadable → nothing', () => {
  const { serializeDraft, parseDraft, DRAFT_MAX_AGE_MS } = G();
  const now = 1_800_000_000_000;
  const raw = serializeDraft({ name: 'Trail', eventTypeId: 3, categoryId: 59, date: '2099-01-01', startTime: '08:00',
    file: { uri: 'content://x/route.gpx', name: 'route.gpx', mimeType: 'application/gpx+xml' } }, now);
  const d = parseDraft(raw, now + 1000);
  assert.strictEqual(d.name, 'Trail');
  assert.strictEqual(d.file.uri, 'content://x/route.gpx');
  assert.strictEqual(parseDraft(raw, now + DRAFT_MAX_AGE_MS + 1), null);
  assert.strictEqual(parseDraft('{oops', now), null);
});
test('F17 CreatePersonalEvent saves the draft on 401 and restores + clears it on open', () => {
  const s = read('screens/PersonalEventScreen/CreatePersonalEvent.tsx');
  // (room for the N5 file copy that now runs before the draft is written)
  assert.ok(/case 'token_expired':[\s\S]{0,900}AsyncStorage\.setItem\(PERSONAL_EVENT_DRAFT_KEY/.test(s), 'saved before Login');
  assert.ok(/parseDraft\(await AsyncStorage\.getItem\(PERSONAL_EVENT_DRAFT_KEY\)/.test(s) && /removeItem\(PERSONAL_EVENT_DRAFT_KEY\)/.test(s), 'restored once');
});

// ════════════ re-audit 2026-11-26 (N1, N3, N4, N5) ════════════
test('N1 settings never loaded → a language change sends NO visibility (null = language only)', () => {
  const { languageUpdateSettings } = load('screens/SettingScreen/visibilitySettings');
  assert.strictEqual(languageUpdateSettings(null), null);
});
test('N1 settingsService.updateSettings(null, lang) posts no `settings` key; with settings it still does (old server)', async () => {
  const bodies = [];
  global.fetch = async (_u, init) => { bodies.push(JSON.parse(init.body)); return { ok: true, json: async () => ({ success: true, data: { settings: { live_tracking_visibility: 'private', live_tracking_password: 'x' }, language_id: 2 } }) }; };
  const cfg = fakeConfig(); cfg.getDeviceId = async () => 'dev-1';
  const svc = load('services/settingsService', {
    '../constants/config': cfg, '../i18n': { getCurrentLanguageId: () => 1 },
    './tokenService': { tokenService: { getToken: async () => 'tok' } },
  }).settingsService;
  await svc.updateSettings(null, 2);
  assert.strictEqual('settings' in bodies[0], false, 'language-only body: ' + JSON.stringify(bodies[0]));
  assert.strictEqual(bodies[0].language_id, 2);
  await svc.updateSettings({ live_tracking_visibility: 'public', live_tracking_password: '' }, 2);
  assert.ok(bodies[1].settings, 'settings still sent when known');
});
test('N1 UserTrackingSettings: saved state starts unknown (null), a failed first load shows ErrorScreen + Retry, not the form', () => {
  const s = read('screens/SettingScreen/UserTrackingSettings.tsx');
  assert.ok(/useRef<SavedVisibility \| null>\(null\)/.test(s), 'savedRef starts null');
  assert.ok(/if \(!isLoading && loadFailed\) \{\s*return <ErrorScreen type="network" onRetry=\{loadSettings\} \/>/.test(s), 'error state with retry');
  assert.ok(/if \(savedRef\.current === null\) setLoadFailed\(true\)/.test(s), 'only when never loaded');
});

test('N3 isTrackingRecent + the edit service returns the server reason from a 400', async () => {
  assert.strictEqual(G().isTrackingRecent({ reason: 'tracking_recent' }), true);
  assert.strictEqual(G().isTrackingRecent({ action: 'tracking_already_started' }), false);
  const svc = load('services/editPersonalEventService', {
    '../constants/config': fakeConfig(),
    './api': { apiClient: { postRaw: async () => ({ status: 400, data: { success: false, error: 'tracking_already_started', data: { reason: 'tracking_recent', retry_after_seconds: 600 } } }) } },
  });
  const r = await svc.updatePersonalEvent({ eventId: 7, name: 'Run', eventTypeId: 3, categoryId: 59, date: '2099-01-01', startTime: '' });
  assert.strictEqual(r.message, 'tracking_already_started');
  assert.strictEqual(r.reason, 'tracking_recent');
});
test('N3 edit + delete show the temporary "try again in a few minutes" copy for tracking_recent (en/fr/nl)', () => {
  assert.ok(/case 'tracking_already_started':[\s\S]{0,400}isTrackingRecent\(response\)[\s\S]{0,80}personal:errors\.trackingRecent/.test(read('screens/PersonalEventScreen/EditPersonalEvent.tsx')));
  assert.ok(/isTrackingRecent\(deleted[\s\S]{0,80}ownProfile:deleteEvent\.trackingRecentError/.test(read('screens/ProfileScreen/OwnProfile.tsx')));
  for (const l of ['en', 'fr', 'nl']) {
    assert.ok(JSON.parse(read(`i18n/PersonalEvent/${l}.json`)).errors.trackingRecent, 'PersonalEvent ' + l);
    assert.ok(JSON.parse(read(`i18n/OwnProfile/${l}.json`)).deleteEvent.trackingRecentError, 'OwnProfile ' + l);
  }
});

test('N4 reminders: deleting / editing ANOTHER event leaves the next race reminders; this event cancels them', async () => {
  const store = new Map(); const pending = new Set(); let ids = 0;
  const notif = {
    SchedulableTriggerInputTypes: { DATE: 'date' },
    scheduleNotificationAsync: async ({ identifier }) => { pending.add(identifier); ids++; return identifier; },
    cancelScheduledNotificationAsync: async (id) => { pending.delete(id); },
  };
  const svc = load('services/startReminderService', {
    'expo-notifications': notif,
    '@react-native-async-storage/async-storage': { __esModule: true, default: {
      getItem: async (k) => (store.has(k) ? store.get(k) : null), setItem: async (k, v) => { store.set(k, String(v)); }, removeItem: async (k) => { store.delete(k); } } },
    '../constants/config': fakeConfig(),
  }).startReminderService;
  const texts = { preTitle: 'a', preBody: 'b', postTitle: 'c', postBody: 'd' };
  await svc.sync({ gun: new Date(Date.now() + 3600e3), eligible: true, texts, participantId: 9001 });
  assert.strictEqual(pending.size, 2, 'both scheduled for the next race');
  assert.strictEqual(await svc.cancelIfFor(4242), false);
  assert.strictEqual(pending.size, 2, 'another event: untouched');
  assert.strictEqual(await svc.cancelIfFor(9001), true);
  assert.strictEqual(pending.size, 0, 'this event: cancelled');
});
test('N4 OwnProfile / EditPersonalEvent use cancelIfFor(participant), never a blanket cancel(); Home records the owner', () => {
  for (const f of ['screens/ProfileScreen/OwnProfile.tsx', 'screens/PersonalEventScreen/EditPersonalEvent.tsx']) {
    const s = read(f);
    assert.ok(!/startReminderService\.cancel\(\)/.test(s), f + ' blanket cancel');
    assert.ok(/startReminderService\.cancelIfFor\(/.test(s), f + ' cancelIfFor');
  }
  assert.ok(/participantId: homeData\?\.next_race_participant_app_id/.test(read('screens/HomeScreen.tsx')), 'Home passes the owner');
  assert.ok(/navigate\('EditPersonalEvent', \{ eventId: item\.id, participantId: item\.participant_app_id \}\)/.test(read('screens/ProfileScreen/EventCardLive.tsx')));
});

test('N5 the draft keeps a COPY of the shared GPX in the app folder (content:// dies with the process)', async () => {
  const { persistDraftFile, clearDraftFiles } = load('screens/PersonalEventScreen/draftFile');
  const ops = [];
  const fs = { documentDirectory: 'file:///data/app/files/',
    makeDirectoryAsync: async (u) => ops.push(['mkdir', u]), copyAsync: async (o) => ops.push(['copy', o.from, o.to]),
    deleteAsync: async (u) => ops.push(['rm', u]) };
  const kept = await persistDraftFile(fs, 'content://com.whatsapp/x/route 1.gpx', 'route 1.gpx', 1700000000000);
  assert.ok(kept.startsWith('file:///data/app/files/personal_event_draft/'), kept);
  assert.ok(ops.some((o) => o[0] === 'copy' && o[1] === 'content://com.whatsapp/x/route 1.gpx' && o[2] === kept));
  await clearDraftFiles(fs);
  assert.deepStrictEqual(ops[ops.length - 1], ['rm', 'file:///data/app/files/personal_event_draft/']);
  const failing = { ...fs, copyAsync: async () => { throw new Error('no grant'); } };
  assert.strictEqual(await persistDraftFile(failing, 'content://x/a.gpx', 'a.gpx', 1), 'content://x/a.gpx', 'falls back to the original');
});
test('N5 CreatePersonalEvent stores the kept copy in the draft and clears it after a create', () => {
  const s = read('screens/PersonalEventScreen/CreatePersonalEvent.tsx');
  const i = s.indexOf('persistDraftFile(FileSystem, selectedFile.uri');
  assert.ok(i > 0 && i < s.indexOf('AsyncStorage.setItem(PERSONAL_EVENT_DRAFT_KEY'), 'copied before the draft is written');
  assert.ok(/uri: keptUri/.test(s), 'the draft points at the copy');
  assert.ok(/clearDraftFiles\(FileSystem\)/.test(s.slice(s.indexOf('resetForm();'))), 'cleared after success');
});

// ════════════ A11 unsaved edit survives a logout ════════════
test('A11 edit draft: only changed fields; per event + account; < 24 h', () => {
  const g = G();
  const base = g.editDraftSnapshot({ name: 'Run', selectedEventType: { value: 3 }, selectedCategory: { value: 59 }, date: '2099-01-01', startTime: '09:00' });
  assert.strictEqual(g.editDraftDiff(base, base), null, 'nothing changed → no draft');
  const diff = g.editDraftDiff({ ...base, name: 'Long run', startTime: '' }, base);
  assert.deepStrictEqual(diff, { name: 'Long run', startTime: '' });
  const now = 1_800_000_000_000;
  const raw = g.serializeEditDraft(100777, 42, diff, now);
  assert.deepStrictEqual(g.usableEditDraft(raw, 100777, 42, now + 1000), diff);
  assert.strictEqual(g.usableEditDraft(raw, 100778, 42, now), null, 'other event');
  assert.strictEqual(g.usableEditDraft(raw, 100777, 43, now), null, 'other account');
  assert.strictEqual(g.usableEditDraft(raw, 100777, 42, now + g.DRAFT_MAX_AGE_MS + 1), null, 'older than a day');
  assert.ok(!raw.includes('gpx') && !raw.includes('uri'), 'never a file');
});
test('A11 EditPersonalEvent keeps the draft, restores it with a notice, drops it on save / intentional leave', () => {
  const s = read('screens/PersonalEventScreen/EditPersonalEvent.tsx');
  assert.ok(/AsyncStorage\.setItem\(EDIT_EVENT_DRAFT_KEY, serializeEditDraft\(eventId, customerIdForDraft, diff/.test(s), 'kept while changed');
  assert.ok(/usableEditDraft\(await AsyncStorage\.getItem\(EDIT_EVENT_DRAFT_KEY\), eventId, customerIdForDraft/.test(s), 'restored for this event + account');
  assert.ok(/personal:draft\.restoredTitle/.test(s), 'notice');
  const leave = between(s, "navigation.addListener('beforeRemove'", '});');
  assert.ok(/removeItem\(EDIT_EVENT_DRAFT_KEY\)/.test(leave), 'intentional leave drops it');
  const ok = s.indexOf("toastSuccess(t('personal:success.title'), t('personal:success.editMessage'))");
  assert.ok(ok > 0 && /removeItem\(EDIT_EVENT_DRAFT_KEY\)/.test(s.slice(ok - 300, ok)), 'save drops it');
  for (const l of ['en', 'fr', 'nl']) {
    const d = JSON.parse(read(`i18n/PersonalEvent/${l}.json`)).draft;
    assert.ok(d && d.restoredTitle && d.restoredMessage, 'PersonalEvent draft ' + l);
  }
});

// ════════════ second audit 2026-11-26 (PA, PB, F-16 rest, F-17 rest) ════════════
test('PA a top-level gpx_* code from create is shown on the file field, not "try again later"', () => {
  const { isGpxErrorCode } = G();
  assert.strictEqual(isGpxErrorCode('gpx_invalid_content'), true);
  assert.strictEqual(isGpxErrorCode('gpx_too_large'), true);
  assert.strictEqual(isGpxErrorCode('create_failed'), false);
  const s = read('screens/PersonalEventScreen/CreatePersonalEvent.tsx');
  const def = s.slice(s.lastIndexOf('default:', s.indexOf("showErrorModal('personal:errors.createFailedTitle', 'personal:errors.createFailedMessage')")));
  assert.ok(/if \(isGpxErrorCode\(action\)\) \{\s*applyApiFieldErrors\(\[action\]\);/.test(def), 'mapped before the generic modal');
});
test('PB a rename keeps the reminders; date or time change → cancelIfFor', () => {
  const { editMovesGun } = G();
  const base = { date: '2099-01-01', startTime: '09:00', loadedDate: '2099-01-01', loadedStartTime: '09:00' };
  assert.strictEqual(editMovesGun(base), false);
  assert.strictEqual(editMovesGun({ ...base, startTime: '10:00' }), true);
  assert.strictEqual(editMovesGun({ ...base, date: '2099-01-02' }), true);
  const s = read('screens/PersonalEventScreen/EditPersonalEvent.tsx');
  assert.ok(/if \(editMovesGun\(\{[^}]*\}\)\) \{\s*void startReminderService\.cancelIfFor\(/.test(s), 'cancel only when the gun moved');
});
test('F16-rest a time-only edit keeps the event zone; a date change or an event without zone sends the phone zone', () => {
  const { editTimezoneToSend } = G();
  const base = { date: '2099-01-01', startTime: '09:00', loadedDate: '2099-01-01', loadedStartTime: '09:00', deviceTimezone: 'Asia/Tokyo', loadedTimezone: 'Europe/Brussels' };
  assert.strictEqual(editTimezoneToSend({ ...base, startTime: '10:00' }), undefined, 'time only');
  assert.strictEqual(editTimezoneToSend({ ...base, date: '2099-01-02' }), 'Asia/Tokyo', 'date changed');
  assert.strictEqual(editTimezoneToSend({ ...base, loadedTimezone: '' }), 'Asia/Tokyo', 'no stored zone');
  assert.ok(/loadedTimezone,\s+\/\/ a time-only edit keeps the event's zone/.test(read('screens/PersonalEventScreen/EditPersonalEvent.tsx')), 'screen passes the stored zone');
  assert.ok(/setLoadedTimezone\(event\.timezone/.test(read('hooks/Useeditpersonaleventform.ts')), 'hook keeps it');
});
test('F17-rest after login with a pending create draft → back to PersonalEvent (Home underneath)', async () => {
  const g = G();
  const store = new Map([[g.PERSONAL_EVENT_DRAFT_KEY, g.serializeDraft({ name: 'Trail', eventTypeId: 3, categoryId: 59, date: '2099-01-01', startTime: '', file: null }, Date.now())]]);
  const resets = [];
  const hook = load('hooks/usePendingRegistration', {
    react: { useCallback: (f) => f },
    '@react-native-async-storage/async-storage': { __esModule: true, default: {
      getItem: async (k) => (store.has(k) ? store.get(k) : null), setItem: async (k, v) => { store.set(k, v); }, removeItem: async (k) => { store.delete(k); }, multiRemove: async () => {} } },
    '../constants/config': fakeConfig(),
    '../../utils/toast': { toastInfo: () => {} },
    '../i18n': { __esModule: true, default: { t: (k) => k } },
  }).usePendingRegistration;
  await hook({ reset: (r) => resets.push(r) }).handleAfterAuth();
  assert.deepStrictEqual(resets[0] && resets[0].routes.map((r) => r.name), ['HomeScreen', 'PersonalEvent']);
  store.clear(); resets.length = 0;
  await hook({ reset: (r) => resets.push(r) }).handleAfterAuth();
  assert.deepStrictEqual(resets[0].routes.map((r) => r.name), ['HomeScreen'], 'no draft → Home as before');
});

// ── run ──────────────────────────────────────────────────────────────────
(async () => {
  let pass = 0, fail = 0;
  console.log('personal events / settings / misc — app (' + SRC + ')');
  for (const t of tests) {
    try { await t.fn(); pass++; console.log('  PASS  ' + t.name); }
    catch (e) { fail++; console.log('  FAIL  ' + t.name + '\n          ' + String(e && e.message || e).split('\n')[0]); }
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
