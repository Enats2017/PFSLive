/**
 * Auth / account audit 2026-11-26 - findings 1-5, 7-10, 13 (app side).
 *
 * Run (from the repo root):
 *   npx tsc src/services/authFlowGuards.ts src/services/deviceIdStore.ts src/services/authFlowGuards.test.ts --rootDir src --target es2019 --module commonjs --moduleResolution node --esModuleInterop --skipLibCheck --outDir .cardtest && node .cardtest/services/authFlowGuards.test.js
 *
 * No test framework in this repo - plain asserts, exit code 1 on failure.
 * The first block tests the pure helpers. The second reads the real screens and
 * services so they cannot drift back; point it at another checkout to see what
 * an older tree fails:  AUTH_TEST_ROOT=../PFSLive node .cardtest/services/authFlowGuards.test.js
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import {
  tryBeginSubmit,
  endSubmit,
  createLatestRequestGate,
  otpTokenInvalidKey,
  parsePendingOtp,
  usablePendingOtp,
  PENDING_OTP_MAX_AGE_MS,
  classifyEditProfileFailure,
  shouldNoticeExpiredConnect,
  profileDraftDiff,
  usableProfileDraft,
  PROFILE_DRAFT_MAX_AGE_MS,
  otpDeadEndKey,
  pendingVerifyFailedOnField,
} from './authFlowGuards';
import { readStoredDeviceIdFrom, resolveUnstoredDeviceId } from './deviceIdStore';

let passed = 0;
let failed = 0;
const pending: Promise<void>[] = [];
function test(name: string, fn: () => void | Promise<void>) {
  pending.push((async () => {
    try {
      await fn();
      passed++;
      console.log(`  ok   ${name}`);
    } catch (e: any) {
      failed++;
      console.log(`  FAIL ${name}\n       ${String(e?.message ?? e).split('\n')[0]}`);
    }
  })());
}

const TOKEN = 'a'.repeat(64);

console.log('\nauthFlowGuards - pure helpers');

test('one submit at a time: a second tap in the same frame is refused (findings 1, 2, 8, 9)', () => {
  const gate = { current: false };
  assert.strictEqual(tryBeginSubmit(gate), true);
  assert.strictEqual(tryBeginSubmit(gate), false);
  endSubmit(gate);
  assert.strictEqual(tryBeginSubmit(gate), true, 'open again after the first ends');
});

test('newest token request wins whatever order the answers arrive in (finding 1)', async () => {
  // Server: one token per account, each new one revokes the older (AuthToken.php).
  const live = new Set<string>();
  let n = 0;
  const serverIssue = () => { live.clear(); const t = `T${++n}`; live.add(t); return t; };
  const gate = createLatestRequestGate();
  let stored: string | null = null;
  const login = async (delayMs: number) => {
    const ticket = gate.begin();                 // taken before the request goes out
    const token = serverIssue();                 // server order: T1 then T2
    await new Promise((r) => setTimeout(r, delayMs));
    if (gate.isLatest(ticket)) stored = token;   // authService.login saves only then
  };
  await Promise.all([login(30), login(5)]);       // T2 answers first, T1 last
  assert.ok(stored && live.has(stored), `stored ${stored} must be the live token`);
});

test('a dead registration / device-change token says "log in", others keep "register again" (finding 4)', () => {
  assert.strictEqual(otpTokenInvalidKey('registration', 'verification_token_invalid'), 'tokenInvalidMaybeVerified');
  assert.strictEqual(otpTokenInvalidKey('device_change', 'verification_token_invalid'), 'tokenInvalidMaybeVerified');
  assert.strictEqual(otpTokenInvalidKey('registration', 'verification_conflict'), 'tokenInvalidMaybeVerified');
  assert.strictEqual(otpTokenInvalidKey('forgot_password', 'verification_token_invalid'), 'tokenInvalid');
  assert.strictEqual(otpTokenInvalidKey('registration', 'otp_incorrect'), null);
});

test('stored unverified registration: resumable only for the same email and within a week (finding 3)', () => {
  const now = 1_800_000_000_000;
  const p = parsePendingOtp(JSON.stringify({ email: 'a@b.be', verification_token: TOKEN, savedAt: now - 1000 }));
  assert.ok(p);
  assert.ok(usablePendingOtp(p, ' A@B.be ', now), 'case/space-insensitive email match');
  assert.strictEqual(usablePendingOtp(p, 'other@b.be', now), null);
  assert.strictEqual(usablePendingOtp({ ...p!, savedAt: now - PENDING_OTP_MAX_AGE_MS - 1 }, 'a@b.be', now), null);
  assert.strictEqual(parsePendingOtp('{bad json'), null);
  assert.strictEqual(parsePendingOtp(JSON.stringify({ email: 'a@b.be', verification_token: 'short', savedAt: now })), null);
});

test('edit profile: every failure has something to say (finding 5)', () => {
  assert.strictEqual(classifyEditProfileFailure({ fields: ['profile_picture_too_large'] }), 'picture');
  assert.strictEqual(classifyEditProfileFailure({ fields: ['firstname_invalid', 'profile_picture_invalid_type'] }), 'picture');
  assert.strictEqual(classifyEditProfileFailure({ message: 'unauthorized' }), 'session_expired');
  assert.strictEqual(classifyEditProfileFailure({ type: 'network', code: 'network_error' }), 'network');
  assert.strictEqual(classifyEditProfileFailure({ message: 'no_changes' }), 'generic');
  assert.strictEqual(classifyEditProfileFailure({ message: 'edit_profile_failed' }), 'generic');
});

test('device id: a locked Keychain is "failed", never "empty" (finding 7)', async () => {
  const locked = () => Promise.reject(new Error('errSecInteractionNotAllowed'));
  const writes: string[] = [];
  const r = await readStoredDeviceIdFrom({ readV2: async () => null, readLegacy: locked, writeV2: async (v) => { writes.push(v); } });
  assert.strictEqual(r.kind, 'failed');
  assert.deepStrictEqual(writes, [], 'nothing persisted while locked');
});

test('device id: legacy value is copied to the readable-while-locked key, v2 wins after (finding 7)', async () => {
  let v2: string | null = null;
  const deps = {
    readV2: async () => v2,
    readLegacy: async () => 'OLD-IDFV',
    writeV2: async (v: string) => { v2 = v; },
  };
  const first = await readStoredDeviceIdFrom(deps);
  assert.deepStrictEqual(first, { kind: 'found', value: 'OLD-IDFV' });
  assert.strictEqual(v2, 'OLD-IDFV');
  const lockedLater = await readStoredDeviceIdFrom({ ...deps, readLegacy: () => Promise.reject(new Error('locked')) });
  assert.deepStrictEqual(lockedLater, { kind: 'found', value: 'OLD-IDFV' }, 'locked phone still gets the real id');
});

test('device id: locked Keychain + no IDFV -> ONE generated id for the session, never persisted (review)', () => {
  let n = 0;
  const generate = () => `gen_${++n}`;
  let fallback: string | null = null;
  const ids: string[] = [];
  for (let i = 0; i < 3; i++) {
    const d = resolveUnstoredDeviceId({ readFailed: true, osId: '', sessionFallback: fallback, generate });
    assert.strictEqual(d.persistAndCache, false, 'never cached as the device id / written');
    fallback = d.sessionFallback;
    ids.push(d.id);
  }
  assert.deepStrictEqual(ids, ['gen_1', 'gen_1', 'gen_1'], 'same id on every call');
});

test('device id: locked Keychain + IDFV -> IDFV for this call, not cached; fresh install persists', () => {
  const generate = () => 'gen_x';
  const locked = resolveUnstoredDeviceId({ readFailed: true, osId: 'IDFV', sessionFallback: null, generate });
  assert.deepStrictEqual(locked, { id: 'IDFV', persistAndCache: false, sessionFallback: null });
  const fresh = resolveUnstoredDeviceId({ readFailed: false, osId: '', sessionFallback: 'gen_1', generate });
  assert.deepStrictEqual(fresh, { id: 'gen_1', persistAndCache: true, sessionFallback: 'gen_1' }, 'keeps the id already sent');
});

test('device id: nothing stored anywhere is "empty" (fresh install generates + persists)', async () => {
  const r = await readStoredDeviceIdFrom({ readV2: async () => null, readLegacy: async () => null, writeV2: async () => {} });
  assert.strictEqual(r.kind, 'empty');
});

test('expired Connect: noticed only when one was really saved and dropped (AN3)', () => {
  assert.strictEqual(shouldNoticeExpiredConnect('12', '34', false), true);
  assert.strictEqual(shouldNoticeExpiredConnect('12', '34', true), false, 'fresh -> replayed, no notice');
  assert.strictEqual(shouldNoticeExpiredConnect(null, null, false), false, 'nothing saved');
});

test('profile draft: only changed fields, never passwords; same account and < 24 h only (A11)', () => {
  const saved = { firstname: 'Ann', lastname: 'Test', email: 'a@b.be', city: 'Gent', dob: '', gender: 'female',
    countryName: 'Belgium', country_id: '21', country_iso: 'BE', language_id: 1, parentConsent: false, password: '' };
  assert.strictEqual(profileDraftDiff({ ...saved }, saved), null);
  const diff = profileDraftDiff({ ...saved, city: 'Brugge', password: 'secret' }, saved);
  assert.deepStrictEqual(diff, { city: 'Brugge' });
  const now = 1_800_000_000_000;
  const raw = JSON.stringify({ customerId: 7, savedAt: now - 1000, values: { city: 'Brugge', password: 'x' } });
  assert.deepStrictEqual(usableProfileDraft(raw, 7, now), { city: 'Brugge' }, 'password never restored');
  assert.strictEqual(usableProfileDraft(raw, 8, now), null, 'other account');
  assert.strictEqual(usableProfileDraft(raw, 7, now + PROFILE_DRAFT_MAX_AGE_MS + 1), null, 'too old');
  assert.strictEqual(usableProfileDraft('{bad', 7, now), null);
});

test('registration dead ends: only for registration, only the blocking codes (AUB)', () => {
  assert.strictEqual(otpDeadEndKey('registration', 'otp_max_attempts'), 'registerAgain');
  assert.strictEqual(otpDeadEndKey('registration', 'otp_too_many_attempts'), 'registerAgain');
  assert.strictEqual(otpDeadEndKey('registration', 'otp_max_resends'), 'registerAgain');
  assert.strictEqual(otpDeadEndKey('registration', 'otp_incorrect'), null);
  assert.strictEqual(otpDeadEndKey('device_change', 'otp_max_attempts'), null);
});

test('pending-email verify: "taken" only for an address error (AUE)', () => {
  assert.strictEqual(pendingVerifyFailedOnField(['email_already_taken']), true);
  assert.strictEqual(pendingVerifyFailedOnField(undefined), false, '401 / offline have no field errors');
  assert.strictEqual(pendingVerifyFailedOnField(['city_invalid']), false);
});

// ── Wiring: the real files ───────────────────────────────────────────────────
const ROOT = path.resolve(process.env.AUTH_TEST_ROOT || process.cwd());
const read = (rel: string) => {
  try { return fs.readFileSync(path.join(ROOT, 'src', rel), 'utf8'); } catch { return ''; }
};
const between = (s: string, from: string, to: string) => {
  const i = s.indexOf(from);
  return i < 0 ? '' : s.slice(i, s.indexOf(to, i + from.length) >>> 0);
};
console.log(`\nwiring (${ROOT})`);

test('authService.login takes its ticket before the request and saves only the newest token (finding 1)', () => {
  const s = between(read('services/authService.ts'), 'async login(', 'async requestDeviceChange(');
  const ticket = s.indexOf('tokenIssueGate.begin()');
  const post = s.indexOf('axios.post');
  const latest = s.indexOf('tokenIssueGate.isLatest(ticket)');
  const save = s.indexOf('tokenService.saveToken(');
  assert.ok(ticket > 0 && post > ticket, 'ticket before axios.post');
  assert.ok(latest > post && save > latest, 'isLatest checked before saveToken');
});

test('otpService.verify uses the same ticket for registration / device_change (findings 1-2)', () => {
  const s = between(read('services/otpService.ts'), 'async verify(', 'async resend(');
  assert.ok(/tokenIssueGate\.begin\(\)/.test(s) && /tokenIssueGate\.isLatest\(ticket\)/.test(s));
  assert.ok(/superseded: true/.test(s));
});

test('LoginScreen: ref gate before the request, superseded answers ignored, transfer gated (finding 1)', () => {
  const s = read('screens/AuthScreens/LoginScreen.tsx');
  const h = between(s, 'const handleLogin = useCallback(', 'const handleDeviceTransfer');
  assert.ok(h.indexOf('tryBeginSubmit(submittingRef)') > 0 && h.indexOf('tryBeginSubmit(submittingRef)') < h.indexOf('authService.login('));
  assert.ok(/if \(response\.superseded\) return;/.test(h));
  assert.ok(/endSubmit\(submittingRef\)/.test(h));
  assert.ok(/tryBeginSubmit\(transferRef\)/.test(s) && /endSubmit\(transferRef\)/.test(s));
});

test('LoginScreen reopens the code screen for a stored unverified registration (finding 3)', () => {
  const s = read('screens/AuthScreens/LoginScreen.tsx');
  const c = between(s, "case 'email_not_verified'", "case 'account_disabled'");
  assert.ok(/pendingOtpService\.getFor\(/.test(c), 'reads the stored registration');
  assert.ok(/navigate\('OTPVerificationScreen'/.test(c) && /purpose: 'registration'/.test(c));
});

test('RegisterScreen: ref gate, and the registration is stored before the OTP screen opens (findings 3, 8)', () => {
  const s = read('screens/AuthScreens/RegisterScreen.tsx');
  assert.ok(/if \(!tryBeginSubmit\(submittingRef\)\) return;/.test(s));
  const save = s.indexOf('pendingOtpService.save(');
  const nav = s.indexOf("navigation.navigate('OTPVerificationScreen'");
  assert.ok(save > 0 && nav > save, 'save before navigate');
});

test('OTPVerificationScreen: one verify at a time, superseded ignored, "maybe verified" copy, stored registration cleared (findings 2-4)', () => {
  const s = read('screens/AuthScreens/OTPVerificationScreen.tsx');
  const v = between(s, 'const handleVerify = useCallback(', 'const handleResend');
  assert.ok(v.indexOf('tryBeginSubmit(verifyingRef)') > 0 && v.indexOf('tryBeginSubmit(verifyingRef)') < v.indexOf('otpService.verify('));
  assert.ok(/endSubmit\(verifyingRef\)/.test(v));
  assert.ok(/if \(data\.superseded\) return;/.test(v));
  assert.ok(/otpTokenInvalidKey\(purpose, errorCode\)/.test(v));
  assert.ok(/case 'verification_conflict'/.test(v));
  assert.ok(/pendingOtpService\.clear\(\)/.test(v));
  assert.ok(/tryBeginSubmit\(resendingRef\)/.test(s));
});

test('Forgot password steps are gated (finding 9)', () => {
  assert.ok(/tryBeginSubmit\(sendingRef\)/.test(read('screens/AuthScreens/ForgotPasswordScreen/EmailStep.tsx')));
  const o = read('screens/AuthScreens/ForgotPasswordScreen/OtpStep.tsx');
  assert.ok(/tryBeginSubmit\(verifyingRef\)/.test(o) && /tryBeginSubmit\(resendingRef\)/.test(o));
  assert.ok(/tryBeginSubmit\(submittingRef\)/.test(read('screens/AuthScreens/ForgotPasswordScreen/NewPasswordStep.tsx')));
});

test('Edit profile: save gated, failures returned and told to the user (findings 5, 9)', () => {
  const h = read('hooks/Useeditprofile.ts');
  assert.ok(/tryBeginSubmit\(submittingRef\)/.test(h) && /endSubmit\(submittingRef\)/.test(h));
  assert.ok(/classifyEditProfileFailure\(/.test(h) && /failure:/.test(h));
  const s = read('screens/AuthScreens/EditProfileScreen.tsx');
  assert.ok(/reportSaveFailure\(result\.failure\)/.test(s));
  assert.ok(/save_picture_rejected/.test(s) && /save_no_connection/.test(s) && /handleSessionExpired\(\)/.test(between(s, 'const reportSaveFailure', 'const performSave')));
});

test('tokenService: a failed secure write also drops the stale secure token (finding 10)', () => {
  const s = between(read('services/tokenService.ts'), 'async saveToken(', 'async getToken(');
  const fallback = s.indexOf('writeFallback(LEGACY_TOKEN_KEY, token)');
  const del = s.indexOf('SecureStore.deleteItemAsync(TOKEN_KEY)');
  assert.ok(fallback > 0 && del > fallback);
});

test('getDeviceId never caches or persists an id after a failed Keychain read (finding 7)', () => {
  const s = read('constants/config.ts');
  assert.ok(/readStoredDeviceIdFrom\(/.test(s), 'uses the tested reader');
  const g = between(s, 'export const getDeviceId', 'const getApiUrl');
  const bail = g.indexOf('if (!decision.persistAndCache) return id;');
  assert.ok(/resolveUnstoredDeviceId\(\{ readFailed,/.test(g), 'decision goes through the tested helper');
  assert.ok(/sessionFallbackDeviceId = decision\.sessionFallback;/.test(g), 'session fallback kept');
  assert.ok(bail > 0 && bail < g.indexOf('await writeStoredDeviceId(id);'));
  assert.ok(/AFTER_FIRST_UNLOCK\b/.test(s) && !/DEVICE_ID_V2_OPTS = \{ keychainAccessible: SecureStore\.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY/.test(s));
});

test('a deleted/expired account clears the pending registration + stored code (finding 13)', () => {
  const s = read('services/profileServices.ts');
  assert.ok(/clearPendingRegistration\(\)/.test(s) && /pendingOtpService\.clear\(\)/.test(s));
});

test('new copy exists in en/fr/nl', () => {
  for (const lang of ['en', 'fr', 'nl']) {
    const otp = JSON.parse(read(`i18n/OtpScreen/${lang}.json`) || '{}');
    const login = JSON.parse(read(`i18n/LoginScreen/${lang}.json`) || '{}');
    const prof = JSON.parse(read(`i18n/ProfileScreen/${lang}.json`) || '{}');
    assert.ok(otp.errors?.tokenInvalidMaybeVerified, `${lang} otp`);
    assert.ok(login.errors?.emailNotVerifiedResume, `${lang} login`);
    for (const k of ['save_failed_title', 'save_no_connection', 'save_picture_rejected', 'save_generic']) {
      assert.ok(prof.errors?.[k], `${lang} profile ${k}`);
    }
    assert.ok(!/enter the code we emailed you\. If you were/.test(JSON.stringify(login)), `${lang}: dead-end copy gone`);
  }
});

test('an expired Connect is TOLD after login, not dropped silently (re-audit AN3)', () => {
  const s = between(read('hooks/usePendingRegistration.ts'), 'const handleAfterAuth', 'return { handleAfterAuth }');
  assert.ok(/shouldNoticeExpiredConnect\(productId, optionId, fresh\)/.test(s), 'no notice for the dropped Connect');
  assert.ok(/toastInfo\(\s*i18n\.t\('login:pendingConnectExpiredTitle'\)/.test(s));
  for (const lang of ['en', 'fr', 'nl']) {
    const login = JSON.parse(read(`i18n/LoginScreen/${lang}.json`) || '{}');
    assert.ok(login.pendingConnectExpiredTitle && login.pendingConnectExpired, `${lang} copy`);
  }
});

test('Edit Profile keeps unsaved changes across a logout and offers them back (re-audit A11)', () => {
  const s = read('screens/AuthScreens/EditProfileScreen.tsx');
  assert.ok(/profileDraftService\.save\(customerIdForDraft, diff\)/.test(s), 'draft never written');
  assert.ok(/profileDraftService\.getFor\(customerIdForDraft\)/.test(s) && /applyDraft\(/.test(s), 'draft never restored');
  assert.ok(/addListener\('beforeRemove'[\s\S]{0,200}profileDraftService\.clear\(\)/.test(s), 'leaving on purpose must discard it');
  const save = between(s, 'const performSave = useCallback(', 'const langCode');
  assert.ok(/profileDraftService\.clear\(\)/.test(save), 'a successful save must discard it');
  for (const lang of ['en', 'fr', 'nl']) {
    const prof = JSON.parse(read(`i18n/ProfileScreen/${lang}.json`) || '{}');
    assert.ok(prof.messages?.draft_restored && prof.messages?.draft_restored_title, `${lang} copy`);
  }
});

test('a dead registration code clears the stored entry and says "register again", on verify AND resend (AUB)', () => {
  const s = read('screens/AuthScreens/OTPVerificationScreen.tsx');
  const dead = between(s, 'const endDeadRegistration = useCallback(', 'const handleVerify');
  assert.ok(/otpDeadEndKey\(purpose, code\)/.test(dead) && /pendingOtpService\.clear\(\)/.test(dead), 'helper missing');
  const v = between(s, 'const handleVerify = useCallback(', 'const handleResend');
  const r = between(s, 'const handleResend = useCallback(', 'return (');
  for (const [name, body] of [['verify', v], ['resend', r]] as const) {
    const n = (body.match(/await endDeadRegistration\(errorCode\)/g) || []).length;
    assert.strictEqual(n, 2, `${name}: max_attempts and max_resends both end the registration (got ${n})`);
  }
  for (const lang of ['en', 'fr', 'nl']) {
    const otp = JSON.parse(read(`i18n/OtpScreen/${lang}.json`) || '{}');
    assert.ok(otp.errors?.registerAgain && otp.errors?.registerAgainTitle, `${lang} copy`);
  }
});

test('pending-email "verify" sends ONLY the email and reports non-field failures as such (AUE)', () => {
  const s = read('screens/AuthScreens/EditProfileScreen.tsx');
  const h = between(s, 'const handleVerifyPending = useCallback(', 'const handleCancelPending');
  assert.ok(/submit\(\{ email: serverPendingEmail \}, \{ onlyEmail: true \}\)/.test(h), 'whole form submitted (draft saved silently)');
  assert.ok(/pendingVerifyFailedOnField\(result\.fieldErrors\)/.test(h) && /reportSaveFailure\(/.test(h), '401 / offline shown as "address taken"');
  const hook = read('hooks/Useeditprofile.ts');
  assert.ok(/opts\?\.onlyEmail \? \{ email: effective\.email\.trim\(\)\.toLowerCase\(\) \}/.test(hook), 'payload not email-only');
});

Promise.all(pending).then(() => {
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
});
