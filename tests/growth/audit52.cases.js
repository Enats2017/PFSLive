// Case added 2026-11-21: growth ships to the live 1.0.9 store builds as an OTA update, and a later store
// build from master (after growth is merged) must not change the native brand colours. The redesign had set
// the splash background, the Android adaptive-icon background and the notification icon colour to the
// redesign lime #C7D92C; the user wants the live store look kept, so app.config.js keeps live's #D5DA28.
// (The in-app palette in src/styles is JS and is not covered here: it is the redesign and ships on purpose.)
const assert = require('assert');
const fs = require('fs');
const path = require('path');

module.exports = ({ test, SRC }) => {
  const cfg = fs.readFileSync(path.join(SRC, '..', 'app.config.js'), 'utf8').replace(/\r/g, '');
  const LIVE = '#D5DA28';

  test('app.config.js: splash, Android adaptive icon and notification colours stay the live #D5DA28', () => {
    const splash = /splash:\s*\{[^}]*backgroundColor:\s*"([^"]+)"/.exec(cfg);
    const adaptive = /adaptiveIcon:\s*\{[^}]*backgroundColor:\s*"([^"]+)"/.exec(cfg);
    const notif = /"expo-notifications",\s*\{[^}]*color:\s*"([^"]+)"/.exec(cfg);
    assert.ok(splash && adaptive && notif, 'splash / adaptiveIcon / expo-notifications colour not found in app.config.js');
    assert.strictEqual(splash[1].toUpperCase(), LIVE, 'splash backgroundColor');
    assert.strictEqual(adaptive[1].toUpperCase(), LIVE, 'android adaptiveIcon backgroundColor');
    assert.strictEqual(notif[1].toUpperCase(), LIVE, 'expo-notifications color');
  });

  test('app.config.js: the OTA runtime is the live store version 1.0.9 (runtimeVersion policy appVersion)', () => {
    assert.ok(/runtimeVersion:\s*\{\s*policy:\s*"appVersion"/.test(cfg), 'runtimeVersion policy is not appVersion');
    assert.strictEqual((/\bversion:\s*"([^"]+)"/.exec(cfg) || [])[1], '1.0.9');
  });
};
