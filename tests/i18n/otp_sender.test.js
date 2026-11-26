/**
 * OTP screen "check your spam" hint must name the address the code is REALLY
 * sent from. Run: npm run test:otp-sender
 *
 * 2026-11-26: the hint said no-reply@liviolive.com in en/fr/nl, but every app
 * mail (register, resend OTP, verify OTP, forgot password, edit profile, device
 * change, feedback, participant verification) is sent by the PHP API with
 * setFrom(LIVIO_STORE_EMAIL, TEXT_LIVIO), and larssie/config.php defines
 * LIVIO_STORE_EMAIL = robot@liviolive.com - the sender the users actually see.
 *
 * When the larssie checkout is present (LARSSIE_DIR, default
 * C:/xampp/htdocs/larssie) the address is read from its config.php and the
 * API's setFrom calls are checked too; without it those checks are skipped,
 * never passed.
 *
 * No test framework in this repo - plain asserts, exit code 1 on failure.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const EXPECTED_SENDER = 'robot@liviolive.com';
const LARSSIE = process.env.LARSSIE_DIR || 'C:/xampp/htdocs/larssie';

let passed = 0, failed = 0, skipped = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  PASS  ${name}`); }
  catch (e) { failed++; console.log(`  FAIL  ${name}\n        ${e.message}`); }
}
function skip(name, why) { skipped++; console.log(`  SKIP  ${name} (${why})`); }

const otp = lang => JSON.parse(fs.readFileSync(path.join(ROOT, 'src/i18n/OtpScreen', `${lang}.json`), 'utf8'));
const emailsIn = s => (s.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || []).map(e => e.replace(/\.$/, ''));

console.log('== OTP spam hint names the real sender ==');
for (const lang of ['en', 'fr', 'nl']) {
  test(`${lang}: notArrived.spam names ${EXPECTED_SENDER} and no other address`, () => {
    const hint = otp(lang).notArrived && otp(lang).notArrived.spam;
    assert.ok(typeof hint === 'string' && hint.length > 0, 'notArrived.spam missing');
    assert.deepStrictEqual(emailsIn(hint), [EXPECTED_SENDER], `hint: ${hint}`);
  });
}
test('the OTP screen still renders that key', () => {
  const src = fs.readFileSync(path.join(ROOT, 'src/screens/AuthScreens/OTPVerificationScreen.tsx'), 'utf8');
  assert.ok(src.includes("t('otp:notArrived.spam')"));
});

console.log('== no app text names a no-reply sender ==');
test('no src/i18n file mentions no-reply@ / noreply@ / donotreply@', () => {
  const bad = [];
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).forEach(e => {
    const p = path.join(d, e.name);
    if (e.isDirectory()) return walk(p);
    if (/\.(json|ts|tsx)$/.test(e.name) && /(no-?reply|donotreply|do-not-reply)@/i.test(fs.readFileSync(p, 'utf8'))) bad.push(path.relative(ROOT, p));
  });
  walk(path.join(ROOT, 'src'));
  assert.deepStrictEqual(bad, []);
});

console.log('== matches the backend (larssie) ==');
const configPath = path.join(LARSSIE, 'config.php');
if (!fs.existsSync(configPath)) {
  skip('LIVIO_STORE_EMAIL in larssie/config.php', `no checkout at ${LARSSIE}`);
  skip('app mails in larssie/api use LIVIO_STORE_EMAIL', `no checkout at ${LARSSIE}`);
} else {
  test(`larssie config.php LIVIO_STORE_EMAIL is ${EXPECTED_SENDER}`, () => {
    const m = fs.readFileSync(configPath, 'utf8').match(/define\(\s*'LIVIO_STORE_EMAIL'\s*,\s*'([^']+)'\s*\)/);
    assert.ok(m, 'LIVIO_STORE_EMAIL not defined');
    assert.strictEqual(m[1], EXPECTED_SENDER, 'config changed - update the OTP hint in en/fr/nl and this test');
  });
  test('every OTP / account mail in larssie/api is sent from LIVIO_STORE_EMAIL', () => {
    const files = ['register_api.php', 'resent_otp_api.php', 'verify_otp_api.php', 'forgot_password_api.php',
                   'edit_profile_api.php', 'device_change_request_api.php', 'insert_participant_app_api.php'];
    for (const f of files) {
      const s = fs.readFileSync(path.join(LARSSIE, 'api', f), 'utf8');
      const froms = s.match(/->setFrom\(([^,]+),/g) || [];
      assert.ok(froms.length > 0, `${f}: no setFrom`);
      for (const c of froms) assert.ok(/LIVIO_STORE_EMAIL/.test(c), `${f}: ${c}`);
      assert.ok(!/(no-?reply|donotreply)@/i.test(s), `${f}: still names a no-reply address`);
    }
  });
}

console.log(`\n${passed} passed, ${failed} failed, ${skipped} skipped`);
if (failed > 0) process.exit(1);
