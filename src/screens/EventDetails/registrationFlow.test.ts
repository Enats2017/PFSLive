/**
 * Tests for registrationFlow.ts and the screens that use it (app audit
 * 2026-11-26: H1, H2, M1, M2, M3, M4, M5, L1, L2, L3, L4, L6).
 *
 * Run (from the repo root):
 *   npx tsc src/screens/EventDetails/registrationFlow.ts src/screens/EventDetails/registrationFlow.test.ts --rootDir src --target es2019 --module commonjs --moduleResolution node --esModuleInterop --skipLibCheck --resolveJsonModule --outDir .cardtest && node .cardtest/screens/EventDetails/registrationFlow.test.js
 *
 * The wiring checks read the sources under <cwd>/src - run the compiled file
 * from another checkout's root to see which checks fail on its code.
 *
 * No test framework in this repo - plain asserts, exit code 1 on failure.
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import {
  classifyCallError,
  isRegisteredOutcome,
  isPendingRegistrationFresh,
  PENDING_REGISTRATION_TTL_MS,
  thisIsMeOutcome,
} from './registrationFlow';

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  PASS  ${name}`);
  } catch (e) {
    failed++;
    console.log(`  FAIL  ${name}\n        ${(e as Error).message}`);
  }
}

console.log('registrationFlow.ts');

test('H1: a thrown session_expired is a session problem, not a network one', () => {
  assert.strictEqual(classifyCallError({ type: 'server', code: 'session_expired' }), 'session_expired');
  assert.strictEqual(classifyCallError({ type: 'network', code: 'network_error' }), 'network');
  assert.strictEqual(classifyCallError({ type: 'empty', code: 'product_option_value_app_id_invalid' }), 'server');
  assert.strictEqual(classifyCallError({ type: 'server', code: 'unknown' }), 'server');
  assert.strictEqual(classifyCallError(new Error('x')), 'network');
  assert.strictEqual(classifyCallError(undefined), 'network');
});

test('M1/M2: already_registered after Connect / Confirm counts as registered', () => {
  assert.strictEqual(isRegisteredOutcome('registered'), true);
  assert.strictEqual(isRegisteredOutcome('already_registered'), true);
  for (const a of ['confirm_race_result', 'membership_required', 'insert_failed', '', undefined, null]) {
    assert.strictEqual(isRegisteredOutcome(a as any), false, String(a));
  }
});

test('H2: a pending Connect is replayed only while fresh', () => {
  const now = 1_800_000_000_000;
  assert.strictEqual(isPendingRegistrationFresh(String(now - 60_000), now), true, 'a minute ago');
  assert.strictEqual(isPendingRegistrationFresh(now - PENDING_REGISTRATION_TTL_MS, now), true, 'at the limit');
  assert.strictEqual(isPendingRegistrationFresh(now - PENDING_REGISTRATION_TTL_MS - 1, now), false, 'past the limit');
  assert.strictEqual(isPendingRegistrationFresh(String(now - 21 * 86400_000), now), false, 'three weeks ago');
  assert.strictEqual(isPendingRegistrationFresh(null, now), false, 'saved by an older build (no time)');
  assert.strictEqual(isPendingRegistrationFresh('', now), false);
  assert.strictEqual(isPendingRegistrationFresh('abc', now), false);
  assert.strictEqual(isPendingRegistrationFresh(now + 60_000, now), false, 'in the future');
  assert.ok(PENDING_REGISTRATION_TTL_MS <= 60 * 60 * 1000, 'an hour at most');
});

test('M4: membership answers to "This is me" get the membership popup', () => {
  for (const a of ['membership_required', 'limit_reached', 'membership_upcoming']) {
    assert.strictEqual(thisIsMeOutcome(a), 'membership', a);
  }
  assert.strictEqual(thisIsMeOutcome('already_registered'), 'already_registered');
  assert.strictEqual(thisIsMeOutcome('confirm_race_result'), 'confirm');
  assert.strictEqual(thisIsMeOutcome('bib_number_invalid'), 'invalid_bib');
  assert.strictEqual(thisIsMeOutcome('not_found_in_race_result'), 'invalid_bib');
  assert.strictEqual(thisIsMeOutcome('validation_error'), 'validation');
  assert.strictEqual(thisIsMeOutcome('whatever'), 'failed');
});

test('review: "This is me" successes are successes, not "registration failed"', () => {
  assert.strictEqual(thisIsMeOutcome('registered'), 'registered');
  assert.strictEqual(thisIsMeOutcome('verification_email_sent'), 'email_sent');
});

// ── wiring: the screens use the rules (reads <cwd>/src) ──
const root = path.resolve(process.cwd(), 'src');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8').replace(/\r\n/g, '\n');
/** The text of `name`'s useCallback body, up to the next top-level `const` of the hook. */
function block(src: string, start: string, end: string): string {
  const i = src.indexOf(start);
  assert.ok(i >= 0, `no "${start}"`);
  const j = src.indexOf(end, i + start.length);
  return src.slice(i, j < 0 ? undefined : j);
}

console.log('\nwiring');

const hook = read('services/useRegistrationHandler.ts');
const reg = block(hook, 'const callRegisterAPI', 'const callDeleteAPI');
const del = block(hook, 'const callDeleteAPI', 'const handleConfirmRegister');
const conf = block(hook, 'const handleConfirmRegister', 'const handleRegister');

test('H1: register / confirm / unregister send an expired session to the login', () => {
  for (const [name, b] of [['register', reg], ['unregister', del], ['confirm', conf]] as const) {
    const c = b.slice(b.lastIndexOf('} catch'));
    assert.ok(c.includes('classifyCallError(error)'), `${name}: the catch classifies the error`);
    assert.ok(c.includes('handleUnauthorized('), `${name}: the catch can log the runner out`);
  }
  assert.ok(reg.slice(reg.lastIndexOf('} catch')).includes('handleUnauthorized(item.product_option_value_app_id)'), 'register keeps the Connect for after the login');
  assert.ok(conf.slice(conf.lastIndexOf('} catch')).includes('handleUnauthorized(keep)'), 'confirm keeps the Connect for after the login');
});

test('H2: the Connect to resume is saved AFTER the logout (which clears pending Connects)', () => {
  const h = block(hook, 'const handleUnauthorized', 'const callRegisterAPI');
  const out = h.indexOf('await logout()');
  const save = h.indexOf('savePendingRegistration(');
  assert.ok(out >= 0 && save > out, 'handleUnauthorized: logout, then save');
  assert.ok(!/savePendingRegistration\(/.test(hook.replace(h, '')), 'no other save in the hook (each would be wiped by the logout after it)');
  const p = block(read('screens/EventDetails/ParticipantResult.tsx'), 'const handleSessionExpired', 'const showCallError');
  assert.ok(p.indexOf('await logout()') >= 0 && p.indexOf('savePendingRegistration(') > p.indexOf('await logout()'), 'ParticipantResult: logout, then save');
});

test('M1: the confirm step treats already_registered as done', () => {
  assert.ok(conf.includes('isRegisteredOutcome(action)'), 'uses isRegisteredOutcome');
  assert.ok(!/if \(action === 'registered'\)/.test(conf), 'no longer only "registered"');
});

test('M2: already_registered on Connect refreshes the list', () => {
  const c = block(reg, "case 'already_registered':", 'break;');
  assert.ok(c.includes('invalidateEventCache()'), 'refetches');
});

test('L1: a fresh registration does not open the "already registered" popup', () => {
  const c = block(reg, "case 'registered':", 'break;');
  assert.ok(!c.includes('setModalVisible(true)'), 'no RegistrationModal');
  assert.ok(c.includes('onSuccess?.('), 'the celebration still runs');
});

test('L2: register / confirm / unregister share a synchronous in-flight guard', () => {
  assert.ok(hook.includes('const inFlightRef = useRef(false)'), 'ref');
  for (const [name, b] of [['register', reg], ['unregister', del], ['confirm', conf]] as const) {
    assert.ok(b.includes('if (inFlightRef.current) return;'), `${name} checks it`);
    assert.ok(b.includes('inFlightRef.current = false;'), `${name} releases it`);
  }
  const fan = read('components/Fanemailmodal.tsx');
  assert.ok(fan.includes('if (savingRef.current) return;'), 'fan e-mail Save guarded');
  const pr = read('screens/EventDetails/ParticipantResult.tsx');
  assert.strictEqual((pr.match(/if \(inFlightRef\.current\) return;/g) || []).length, 2, 'This is me + Confirm guarded');
});

test('every error text the hook and ParticipantResult show exists in en / fr / nl', () => {
  const ns: Record<string, string> = { details: 'EventDetails', confirmModal: 'ConfirmModal', participantResult: 'ParticipantResult' };
  const src = hook + read('screens/EventDetails/ParticipantResult.tsx');
  const keys = new Set((src.match(/'(details|confirmModal|participantResult):error\.[A-Za-z_]+'/g) || []).map((k) => k.slice(1, -1)));
  assert.ok(keys.size > 10, 'keys found');
  for (const lang of ['en', 'fr', 'nl']) {
    for (const k of keys) {
      const [n, rest] = k.split(':');
      const json = JSON.parse(fs.readFileSync(path.join(root, 'i18n', ns[n], `${lang}.json`), 'utf8'));
      const v = rest.split('.').reduce((o: any, p) => (o ? o[p] : undefined), json);
      assert.ok(typeof v === 'string' && v.length > 0, `${lang}: ${k}`);
    }
  }
});

const pending = read('hooks/usePendingRegistration.ts');

test('H2: the pending Connect carries its time and is replayed only while fresh', () => {
  assert.ok(/PENDING_SAVED_AT_KEY, String\(Date\.now\(\)\)/.test(pending), 'saved with the time');
  assert.ok(pending.includes('safeRemoveItem(PENDING_SAVED_AT_KEY)'), 'cleared with the rest');
  assert.ok(pending.includes('isPendingRegistrationFresh(savedAt, Date.now())'), 'checked before replay');
  assert.ok(/if \(productId && optionId && fresh\)/.test(pending), 'stale is not replayed');
});

test('L3 / L4: the replay lands on Event over Home and is not cleared before use', () => {
  const ok = block(pending, 'if (productId && optionId && fresh)', '} else {');
  assert.ok(!ok.includes('clearPendingRegistration()'), 'not cleared before the event screen consumed it');
  assert.ok(/routes: \[\s*\{ name: 'HomeScreen' \},\s*\{\s*name: 'EventDetails'/.test(ok), 'Home under the event');
});

const tab = read('screens/EventDetails/DistanceTab.tsx');

test('H2 / L4: the auto-register goes through the connect_confirm popup and consumes the pending Connect', () => {
  const eff = block(tab, '// ✅ AUTO-REGISTER LOGIC', '// ✅ GPX CLICK HANDLER');
  assert.ok(eff.includes('handleConnectClick(distanceItem)'), 'through handleConnectClick');
  assert.ok(!eff.includes('handleRegister(distanceItem)'), 'not straight to the API');
  assert.ok(eff.includes('clearPendingRegistration()'), 'consumed here');
});

test('M3: back in the foreground the event screen refetches past the cache, silently', () => {
  assert.ok(/AppState\.addEventListener\('change'/.test(tab), 'listens');
  assert.ok(tab.includes('fetchDistances(true, true)'), 'bust + silent');
  const f = block(tab, 'const fetchDistances = useCallback(', '// ✅ OPTIMISTICALLY UPDATE');
  assert.ok(f.includes('if (!silent)'), 'silent keeps the list');
});

test('L6: refreshing after connect / undo does not remount the tab', () => {
  assert.ok(!tab.includes('onRefresh?.()'), 'no onRefresh() (it bumps the parent key)');
});

const pr = read('screens/EventDetails/ParticipantResult.tsx');

test('M4: ParticipantResult shows the membership popup for membership answers', () => {
  assert.ok(pr.includes('thisIsMeOutcome(action)'), 'uses the mapping');
  assert.ok(pr.includes('<RegistrationModal'), 'renders the membership popup');
});

test('review: ParticipantResult handles a direct registration and a sent e-mail on "This is me" and on Confirm', () => {
  const me = block(pr, 'const handleThisIsMe', 'const handleConfirmSendEmail');
  assert.ok(/case 'registered':\s*await handleRegisteredHere\(\);/.test(me), 'This is me: registered');
  assert.ok(/case 'email_sent':[\s\S]*?setMailSentVisible\(true\)/.test(me), 'This is me: e-mail sent');
  const cf = block(pr, 'const handleConfirmSendEmail', 'const renderParticipant');
  assert.ok(/thisIsMeOutcome\(action\) === 'registered'\) \{[\s\S]*?await handleRegisteredHere\(\);/.test(cf), 'Confirm: registered');
  const ok = block(pr, 'const handleRegisteredHere', 'const fetchParticipants');
  // The success text is an Alert, not a toast: it needs more lines than a toast allows (tests/ui_orientation/group2).
  for (const x of ['clearPendingRegistration()', 'invalidateEventCache()', "Alert.alert(t('details:success.label'), t('details:success.message'))", 'navigation.goBack()']) {
    assert.ok(ok.includes(x), `success path: ${x}`);
  }
  assert.ok(pr.indexOf('const invalidateEventCache') < pr.indexOf('const handleRegisteredHere'), 'declared before use (no TDZ)');
});

test('M5 / H1: ParticipantResult keeps the screen on errors and handles an expired session', () => {
  assert.ok(pr.includes('if (errorLeaves) navigation.goBack()'), 'only the missing-params error leaves');
  assert.ok(pr.includes('const handleSessionExpired'), 'session handling');
  assert.ok(!pr.includes("navigation.navigate('LoginScreen')"), 'no dead unauthorized branch left');
});

console.log('\nre-audit 2026-11-26');

test('RN1: register and unregister send the phone id (per-phone rate limit at the venue)', () => {
  const svc = read('services/eventDetailService.ts');
  const reg = block(svc, 'async registerParticipant(', 'async deleteParticipant(');
  const del = block(svc, 'async deleteParticipant(', '\n};');
  for (const [name, b] of [['register', reg], ['unregister', del]] as const) {
    assert.ok(/'X-Device-Id': await getDeviceId\(\)/.test(b), `${name} sends X-Device-Id`);
  }
});

test('RN2: coming back to the event screen, or a refresh_nonce link, refetches past the cache', () => {
  assert.ok(/fetchDistances\(focusedBeforeRef\.current \|\| !!refresh_nonce\)/.test(tab), 'refocus busts the cache');
  assert.ok(/if \(!refresh_nonce \|\| refresh_nonce === lastNonceRef\.current\) return;/.test(tab), 'a new nonce refetches');
  const ed = read('screens/EventDetails/EventDetails.tsx');
  assert.ok(ed.includes('refresh_nonce={refresh_nonce}'), 'EventDetails passes it on');
});

test('RN4: every Connect / Undo is off while any register / unregister call runs', () => {
  assert.ok(tab.includes('disabled={isRegistering || (registerLoading && !isRegisterMode)}'), 'disabled');
  assert.ok(tab.includes('registerLoading && !isRegistering && !isRegisterMode && { opacity: 0.5 }'), 'visibly busy');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
