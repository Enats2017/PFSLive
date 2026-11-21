// Cases added 2026-10-18 (round 25): repo hygiene found while re-running every suite.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

module.exports = ({ test }) => {
  const ROOT = path.resolve(__dirname, '../..');

  test('npm run test:activation build output (.cardtest/) is ignored by git', () => {
    // package.json compiles the activation card tests into .cardtest/ — left
    // unignored, every run showed it as a new folder to commit.
    const script = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).scripts['test:activation'] || '';
    assert.ok(script.includes('--outDir .cardtest'), 'the script still writes to .cardtest');
    const out = execFileSync('git', ['check-ignore', '-v', '--no-index', '.cardtest/screens/x.js'], { cwd: ROOT, encoding: 'utf8' });
    assert.ok(/\.gitignore:\d+:\.cardtest\//.test(out), out);
  });

  // Server contract (larssie api/FollowerGuard.php, round 25): ids shaped like a
  // browser guest's (lower-case UUID, 'g_' + hex) are refused by the app's own
  // endpoints (register_follower, register_guest_follower as the app, follower
  // email/language). Every id this app can produce must stay outside it.
  test('device ids the app makes are never shaped like a browser guest id (server FollowerGuard)', () => {
    const src = fs.readFileSync(path.join(ROOT, 'src/constants/config.ts'), 'utf8');
    // The server's pattern, from the paired larssie branch when it is here.
    const dir = process.env.LARSSIE_DIR || 'C:/xampp/htdocs/larssie';
    const ref = process.env.LARSSIE_REF || 'origin/growth_api_v0.1';
    let browser = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|g_[0-9a-f]+)$/;
    try {
      const php = execFileSync('git', ['-C', dir, 'show', `${ref}:api/FollowerGuard.php`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      const m = php.match(/function livio_is_browser_guest_id[\s\S]*?preg_match\('\/(.+?)\\z\//);
      assert.ok(m, 'pattern found in FollowerGuard.php');
      browser = new RegExp(m[1] + '$');
    } catch (e) { if (e instanceof assert.AssertionError) throw e; }   // larssie not here: the copy above
    // Android: SSAID first; iOS: the IDFV (upper case); else the generated fallback.
    assert.ok(/Application\.getAndroidId\(\)/.test(src), 'Android uses SSAID');
    assert.ok(/getIosIdForVendorAsync\(\)/.test(src), 'iOS uses the IDFV');
    const tpl = src.match(/id = (`gen_\$\{[^`]+`);/);
    assert.ok(tpl, 'generated fallback found');
    // eslint-disable-next-line no-new-func
    const gen = new Function(`return ${tpl[1]};`);
    for (let i = 0; i < 200; i++) {
      const id = gen();
      assert.ok(id.startsWith('gen_') && !browser.test(id), id);
    }
    for (const id of ['a1b2c3d4e5f60718', '3F2B8C1E-9A4D-4E6F-8B2A-1C3D5E7F9A0B', 'unknown_device', 'fallback_1700000000000']) {
      assert.ok(!browser.test(id), `${id} (an app id shape) is not a browser id`);
    }
    assert.ok(browser.test('3f2b8c1e-9a4d-4e6f-8b2a-1c3d5e7f9a0b') && browser.test('g_00ff'), 'the pattern itself is live');
  });
};
