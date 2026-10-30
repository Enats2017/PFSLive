/**
 * Tests for profileLoadError.ts. Run: npm run test:profile-load-error
 *
 * No test framework in this repo - plain asserts, exit code 1 on failure.
 * Section 1 checks the code rule. Section 2 checks that fetchProfileApi and
 * EditProfileScreen are really wired to it (2026-10-30 support ticket: a deleted
 * account showed the raw text "account_not_found" with no way to log out).
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { isDeletedAccountCode } from './profileLoadError';

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

console.log('== rule ==');
test('account_not_found means the account is gone', () => {
  assert.strictEqual(isDeletedAccountCode('account_not_found'), true);
});
test('case and spaces do not matter (api.ts lowercases, response.error does not)', () => {
  assert.strictEqual(isDeletedAccountCode('ACCOUNT_NOT_FOUND'), true);
  assert.strictEqual(isDeletedAccountCode(' account_not_found\n'), true);
});
test('other profile errors are not a lost account', () => {
  for (const code of ['unauthorized', 'session_expired', 'network_error', 'unknown', 'not_found',
                      'account_disabled', 'email_not_found', 'rate_limited', 'unknown_error']) {
    assert.strictEqual(isDeletedAccountCode(code), false, code);
  }
});
test('missing or non-string codes are not a lost account', () => {
  assert.strictEqual(isDeletedAccountCode(undefined), false);
  assert.strictEqual(isDeletedAccountCode(null), false);
  assert.strictEqual(isDeletedAccountCode(''), false);
  assert.strictEqual(isDeletedAccountCode(400), false);
});

console.log('== wiring ==');
// Compiled to .cardtest/services/, sources sit at ../../src from there.
const SRC = path.resolve(__dirname, '../../src');
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), 'utf8');

test('fetchProfileApi maps the thrown AppError (HTTP 400) to session_expired', () => {
  const s = read('services/profileServices.ts');
  assert.match(s, /catch \(err\) \{\s*if \(err instanceof AppError && isDeletedAccountCode\(err\.code\)\) \{\s*throw new AppError\('server', 'session_expired'\);/);
});
test('fetchProfileApi maps a success:false body to session_expired too', () => {
  const s = read('services/profileServices.ts');
  assert.match(s, /if \(isDeletedAccountCode\(response\.error\)\) \{\s*throw new AppError\('server', 'session_expired'\);/);
});
test('session_expired is the code useScreenError treats as an auth error', () => {
  assert.match(read('hooks/useApiError.ts'), /export const AUTH_ERROR_CODE = "session_expired";/);
});
test('api.ts still turns a 400 with error=account_not_found into an AppError (not a resolved body)', () => {
  const s = read('services/api.ts');
  assert.match(s, /if \(status && status >= 400\) return new AppError\("empty", code\);/);
  assert.ok(!/"account_not_found"/.test(s), 'account_not_found must not be mapped globally: LoginScreen reads it as a login error');
});
test('EditProfileScreen no longer prints the raw error text', () => {
  const s = read('screens/AuthScreens/EditProfileScreen.tsx');
  assert.ok(!/\{profileError\}/.test(s), 'raw {profileError} still rendered');
  assert.ok(!/setProfileError/.test(s), 'setProfileError still used');
});
test('EditProfileScreen routes load errors through useScreenError + ErrorScreen', () => {
  const s = read('screens/AuthScreens/EditProfileScreen.tsx');
  assert.match(s, /useScreenError\(\)/);
  assert.match(s, /\.catch\(handleApiError\)/);
  assert.match(s, /<ErrorScreen[\s\S]*?type=\{profileError\.type\}/);
});
test('EditProfileScreen: auth error → Log In button runs useSessionExpired; other errors retry', () => {
  const s = read('screens/AuthScreens/EditProfileScreen.tsx');
  assert.match(s, /const handleSessionExpired = useSessionExpired\(\)/);
  assert.match(s, /buttonLabel=\{isAuthError \? t\('errorScreen:codes\.session_expired\.button'\) : undefined\}/);
  assert.match(s, /onRetry=\{isAuthError \? \(\) => \{ void handleSessionExpired\(\) \} : \(\) => \{ setProfileLoading\(true\); loadProfile\(\) \}\}/);
  assert.match(s, /useTranslation\(\[[^\]]*'errorScreen'[^\]]*\]\)/);
});
test('EditProfileScreen: the language-change refetch stays quiet (no spinner swap, like the old [t] effect)', () => {
  const s = read('screens/AuthScreens/EditProfileScreen.tsx');
  const body = (s.match(/const loadProfile = useCallback\(\(\) => \{([\s\S]*?)\}, \[clearError, handleApiError\]\)/) || [])[1];
  assert.ok(body, 'loadProfile not found');
  assert.ok(!/setProfileLoading\(true\)/.test(body), 'loadProfile must not show the spinner');
  assert.match(body, /\.finally\(\(\) => setProfileLoading\(false\)\)/);
});
test('fetchProfileApi is only called by EditProfileScreen (no other flow sees the new code)', () => {
  const hits: string[] = [];
  const walk = (dir: string) => {
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, f.name);
      if (f.isDirectory()) { if (f.name !== 'i18n') walk(p); }
      else if (/\.tsx?$/.test(f.name) && !/\.test\.ts$/.test(f.name) && /fetchProfileApi\(/.test(fs.readFileSync(p, 'utf8'))) hits.push(path.relative(SRC, p).replace(/\\/g, '/'));
    }
  };
  walk(SRC);
  // profileServices.ts declares it (`fetchProfileApi = async (`), so it is not a hit.
  assert.deepStrictEqual(hits.sort(), ['screens/AuthScreens/EditProfileScreen.tsx']);
});
test('useSessionExpired clears the token, flips auth and resets to LoginScreen', () => {
  const s = read('hooks/useSessionExpired.ts');
  assert.match(s, /await tokenService\.removeToken\(\);\s*logout\(\);/);
  assert.match(s, /navigation\.reset\(\{ index: 0, routes: \[\{ name: 'LoginScreen' \}\] \}\)/);
});
test('errorScreen session_expired copy exists in en/fr/nl (title, message, button)', () => {
  for (const lang of ['en', 'fr', 'nl']) {
    const j = JSON.parse(read(`i18n/errorScreen/${lang}.json`));
    const c = j.codes && j.codes.session_expired;
    assert.ok(c && c.title && c.message && c.button, `${lang} missing session_expired copy`);
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
