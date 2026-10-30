"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Tests for profileLoadError.ts. Run: npm run test:profile-load-error
 *
 * No test framework in this repo - plain asserts, exit code 1 on failure.
 * Section 1 checks the code rule. Section 2 checks that fetchProfileApi and
 * EditProfileScreen are really wired to it (2026-10-30 support ticket: a deleted
 * account showed the raw text "account_not_found" with no way to log out).
 */
const assert_1 = __importDefault(require("assert"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const profileLoadError_1 = require("./profileLoadError");
let passed = 0;
let failed = 0;
function test(name, fn) {
    try {
        fn();
        passed++;
        console.log(`  PASS  ${name}`);
    }
    catch (e) {
        failed++;
        console.log(`  FAIL  ${name}\n        ${e.message}`);
    }
}
console.log('== rule ==');
test('account_not_found means the account is gone', () => {
    assert_1.default.strictEqual((0, profileLoadError_1.isDeletedAccountCode)('account_not_found'), true);
});
test('case and spaces do not matter (api.ts lowercases, response.error does not)', () => {
    assert_1.default.strictEqual((0, profileLoadError_1.isDeletedAccountCode)('ACCOUNT_NOT_FOUND'), true);
    assert_1.default.strictEqual((0, profileLoadError_1.isDeletedAccountCode)(' account_not_found\n'), true);
});
test('other profile errors are not a lost account', () => {
    for (const code of ['unauthorized', 'session_expired', 'network_error', 'unknown', 'not_found',
        'account_disabled', 'email_not_found', 'rate_limited', 'unknown_error']) {
        assert_1.default.strictEqual((0, profileLoadError_1.isDeletedAccountCode)(code), false, code);
    }
});
test('missing or non-string codes are not a lost account', () => {
    assert_1.default.strictEqual((0, profileLoadError_1.isDeletedAccountCode)(undefined), false);
    assert_1.default.strictEqual((0, profileLoadError_1.isDeletedAccountCode)(null), false);
    assert_1.default.strictEqual((0, profileLoadError_1.isDeletedAccountCode)(''), false);
    assert_1.default.strictEqual((0, profileLoadError_1.isDeletedAccountCode)(400), false);
});
console.log('== wiring ==');
// Compiled to .cardtest/services/, sources sit at ../../src from there.
const SRC = path_1.default.resolve(__dirname, '../../src');
const read = (rel) => fs_1.default.readFileSync(path_1.default.join(SRC, rel), 'utf8');
test('fetchProfileApi maps the thrown AppError (HTTP 400) to session_expired', () => {
    const s = read('services/profileServices.ts');
    assert_1.default.match(s, /catch \(err\) \{\s*if \(err instanceof AppError && isDeletedAccountCode\(err\.code\)\) \{\s*throw new AppError\('server', 'session_expired'\);/);
});
test('fetchProfileApi maps a success:false body to session_expired too', () => {
    const s = read('services/profileServices.ts');
    assert_1.default.match(s, /if \(isDeletedAccountCode\(response\.error\)\) \{\s*throw new AppError\('server', 'session_expired'\);/);
});
test('session_expired is the code useScreenError treats as an auth error', () => {
    assert_1.default.match(read('hooks/useApiError.ts'), /export const AUTH_ERROR_CODE = "session_expired";/);
});
test('api.ts still turns a 400 with error=account_not_found into an AppError (not a resolved body)', () => {
    const s = read('services/api.ts');
    // growth/free-event pass the response data as a third argument; the code is what matters.
    assert_1.default.match(s, /if \(status && status >= 400\) return new AppError\("empty", code[,)]/);
    assert_1.default.ok(!/"account_not_found"/.test(s), 'account_not_found must not be mapped globally: LoginScreen reads it as a login error');
});
test('EditProfileScreen no longer prints the raw error text', () => {
    const s = read('screens/AuthScreens/EditProfileScreen.tsx');
    assert_1.default.ok(!/\{profileError\}/.test(s), 'raw {profileError} still rendered');
    assert_1.default.ok(!/setProfileError/.test(s), 'setProfileError still used');
});
test('EditProfileScreen routes load errors through useScreenError + ErrorScreen', () => {
    const s = read('screens/AuthScreens/EditProfileScreen.tsx');
    assert_1.default.match(s, /useScreenError\(\)/);
    // master: promise chain; growth/free-event: async loadProfile (awaited by the email-confirm handlers)
    assert_1.default.match(s, /\.catch\(handleApiError\)|catch \(e\) \{\s*handleApiError\(e\)/);
    assert_1.default.match(s, /<ErrorScreen[\s\S]*?type=\{profileError\.type\}/);
});
test('EditProfileScreen: auth error → Log In button runs useSessionExpired; other errors retry', () => {
    const s = read('screens/AuthScreens/EditProfileScreen.tsx');
    assert_1.default.match(s, /const handleSessionExpired = useSessionExpired\(\)/);
    assert_1.default.match(s, /buttonLabel=\{isAuthError \? t\('errorScreen:codes\.session_expired\.button'\) : undefined\}/);
    assert_1.default.match(s, /onRetry=\{isAuthError \? \(\) => \{ void handleSessionExpired\(\) \} : \(\) => \{ setProfileLoading\(true\); (void )?loadProfile\(\)[^}]*\}\}/);
    assert_1.default.match(s, /useTranslation\(\[[^\]]*'errorScreen'[^\]]*\]\)/);
});
test('EditProfileScreen: the language-change refetch stays quiet (no spinner swap, like the old [t] effect)', () => {
    const s = read('screens/AuthScreens/EditProfileScreen.tsx');
    const body = (s.match(/const loadProfile = useCallback\((?:async )?\(\) => \{([\s\S]*?)\}, \[clearError, handleApiError\]\)/) || [])[1];
    assert_1.default.ok(body, 'loadProfile not found');
    assert_1.default.ok(!/setProfileLoading\(true\)/.test(body), 'loadProfile must not show the spinner');
    // The spinner is cleared either inside loadProfile (master) or by the mount effect (async variant).
    assert_1.default.ok(/\.finally\(\(\) => setProfileLoading\(false\)\)/.test(body)
        || /loadProfile\(\)\.finally\(\(\) => setProfileLoading\(false\)\)\s*\}, \[loadProfile\]\)/.test(s), 'spinner never cleared');
});
test('fetchProfileApi is only called by EditProfileScreen (no other flow sees the new code)', () => {
    const hits = [];
    const walk = (dir) => {
        for (const f of fs_1.default.readdirSync(dir, { withFileTypes: true })) {
            const p = path_1.default.join(dir, f.name);
            if (f.isDirectory()) {
                if (f.name !== 'i18n')
                    walk(p);
            }
            else if (/\.tsx?$/.test(f.name) && !/\.test\.ts$/.test(f.name) && /fetchProfileApi\(/.test(fs_1.default.readFileSync(p, 'utf8')))
                hits.push(path_1.default.relative(SRC, p).replace(/\\/g, '/'));
        }
    };
    walk(SRC);
    // profileServices.ts declares it (`fetchProfileApi = async (`), so it is not a hit.
    assert_1.default.deepStrictEqual(hits.sort(), ['screens/AuthScreens/EditProfileScreen.tsx']);
});
test('useSessionExpired clears the token, flips auth and resets to LoginScreen', () => {
    const s = read('hooks/useSessionExpired.ts');
    assert_1.default.match(s, /await tokenService\.removeToken\(\);\s*logout\(\);/);
    assert_1.default.match(s, /navigation\.reset\(\{ index: 0, routes: \[\{ name: 'LoginScreen' \}\] \}\)/);
});
test('errorScreen session_expired copy exists in en/fr/nl (title, message, button)', () => {
    for (const lang of ['en', 'fr', 'nl']) {
        const j = JSON.parse(read(`i18n/errorScreen/${lang}.json`));
        const c = j.codes && j.codes.session_expired;
        assert_1.default.ok(c && c.title && c.message && c.button, `${lang} missing session_expired copy`);
    }
});
console.log(`\n${passed} passed, ${failed} failed`);
if (failed)
    process.exit(1);
