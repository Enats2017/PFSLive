// Cases added in the EIGHTEENTH round (2026-10-15). Registered by app.test.js.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

module.exports = function register({ test, SRC, load }) {
  const read = (p) => fs.readFileSync(path.resolve(SRC, p), 'utf8');

  // ── "did the OS show anything" (utils/permissionPrompt) ───────────────
  test('iOS no-dialog refusal (expo answers after ~1.5 s, app never left the foreground) → NOT a real "no"', () => {
    const { osShowedPrompt } = load('utils/permissionPrompt');
    assert.strictEqual(osShowedPrompt(false, 1600), false, '1.5 s timeout is not a dialog');
    assert.strictEqual(osShowedPrompt(false, 300), false);
  });
  test('…a dialog / the Location page (app left the foreground) IS one, however quick', () => {
    const { osShowedPrompt } = load('utils/permissionPrompt');
    assert.strictEqual(osShowedPrompt(true, 200), true);
    assert.strictEqual(osShowedPrompt(false, 4000), true, 'a long wait still counts (fallback)');
  });
  test('watchForOsPrompt works without AppState (never throws) and both screens use it', () => {
    const { watchForOsPrompt } = load('utils/permissionPrompt');
    assert.strictEqual(watchForOsPrompt().done(), false);
    for (const f of ['screens/HomeScreen.tsx', 'screens/RaceReadyScreen.tsx']) {
      const s = read(f);
      assert.ok(s.includes('watchForOsPrompt()'), f);
      assert.ok(!/Date\.now\(\) - t0 [<>] 700/.test(s), `${f}: no 700 ms guess left`);
      assert.ok(/finally \{[\s\S]{0,120}osShowed = promptWatch\.done\(\);/.test(s), `${f}: watch released even on error`);
    }
  });

  test('iOS two-step permission: return listener does NOT re-show the popup while the popup\'s own request runs', () => {
    const s = read('screens/HomeScreen.tsx');
    const at = s.indexOf("'still_blocked_on_return'");
    assert.ok(at > 0);
    const before = s.slice(Math.max(0, at - 700), at);
    assert.ok(/if \(inlineRequestRef\.current && Date\.now\(\) - inlineRequestAtRef\.current < 60_000\) return;/.test(before), 'listener stays quiet (time-limited)');
    const after = s.slice(at, at + 1200);
    assert.ok(after.indexOf('setShowLocationPermissionModal(true)') > 0, 'still re-shows otherwise');
  });
  test('…and the popup\'s own request puts the Start popup back after a real "no"', () => {
    const s = read('screens/HomeScreen.tsx');
    const at = s.indexOf('if (osShowed) {');
    assert.ok(at > 0, 'real-refusal branch');
    const body = s.slice(at, at + 900);
    const ret = body.indexOf('return;');
    const show = body.indexOf('setShowLocationPermissionModal(true)');
    assert.ok(/if \(pendingStartRef\.current\) \{/.test(body), 'Start flow only');
    assert.ok(show > 0 && show < ret, 're-shown before returning');
    assert.ok(body.indexOf('setPermissionModalMidRace(false)') > 0, 'Start wording');
  });
};
