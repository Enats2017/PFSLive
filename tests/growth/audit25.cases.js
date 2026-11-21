// Cases added 2026-10-21: master's 2026-10-20 start work (start reminders,
// battery-optimisation popup at Start, Battery Saver gate on every start path,
// start_backgrounded / battery_saver notifications) merged into growth_v0.1 —
// checked against what this branch added around the same flows.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

module.exports = ({ load, test, SRC }) => {
  const home = () => fs.readFileSync(path.join(SRC, 'screens/HomeScreen.tsx'), 'utf8').replace(/\r/g, '');

  // The reminder effect's own gun expression, run with stand-ins.
  const reminderGun = (homeData, offsetKnown = true, offsetMs = 2 * 3600000) => {
    const s = home();
    const at = s.indexOf('// ✅ Start reminders — see startReminderService.');
    assert.ok(at > 0, 'reminder effect found');
    const m = s.slice(at).match(/\n    const gun = ([\s\S]*?);\n    void startReminderService\.sync\(/);
    assert.ok(m, 'gun expression found');
    const { computeRaceStartTime } = load('services/trackingSessionRules');
    // eslint-disable-next-line no-new-func
    return new Function('homeData', 'serverTimeOffsetKnownRef', 'serverTimeOffsetRef', 'computeRaceStartTime', 'return (' + m[1] + ');')(
      homeData, { current: offsetKnown }, { current: offsetMs }, computeRaceStartTime);
  };

  test('start reminders: a placeholder start time (00:00 / 00:01) schedules nothing — same rule as the countdown', () => {
    for (const t of ['00:00', '00:01', '00:00:00', '00:01:00', ' 00:00:00 ']) {
      assert.strictEqual(reminderGun({ next_race_date: '2026-10-25', next_race_time: t }), null, JSON.stringify(t));
    }
    // and the countdown uses the very same pattern
    assert.ok(home().includes("/^00:0[01](:00)?$/.test(String(homeData?.next_race_time ?? '').trim()) ? null :"));
  });

  test('start reminders: a real start time still gives the session\'s gun (event offset applied); unknown offset → none', () => {
    const { computeRaceStartTime } = load('services/trackingSessionRules');
    for (const t of ['09:30:00', '00:02:00', '00:30', '12:00:00']) {
      const gun = reminderGun({ next_race_date: '2026-10-25', next_race_time: t });
      assert.ok(gun instanceof Date, t);
      assert.strictEqual(gun.getTime(), computeRaceStartTime('2026-10-25', t, 2 * 3600000).getTime(), t);
    }
    assert.strictEqual(reminderGun({ next_race_date: '2026-10-25', next_race_time: '09:30:00' }, false), null, 'offset unknown');
    assert.strictEqual(reminderGun({ next_race_date: '', next_race_time: '09:30:00' }) || null, null, 'no date');
    assert.strictEqual(reminderGun(undefined) || null, null, 'no home data');
  });

  test('start funnel: every Battery Saver refusal on a start path logs blocked/power_saving before its popup', () => {
    const s = home();
    const sites = [...s.matchAll(/setShowPowerSavingModal\(true\);/g)].map((x) => x.index);
    assert.ok(sites.length >= 2, 'button gate + doStartGPSTracking gate: ' + sites.length);
    for (const i of sites) {
      const before = s.slice(Math.max(0, i - 260), i);
      assert.ok(/void analyticsService\.logStartStep\('blocked', 'power_saving', raceReadyKey\);\s*(?:\/\/[^\n]*\n\s*)?$/.test(before), 'logged right before the popup at ' + i);
    }
  });

  test('start funnel: the battery-optimisation popup\'s Cancel is a blocked step (battery_optimization); Allow / Start anyway are not', () => {
    const s = home();
    const at = s.indexOf("if (Platform.OS === 'android' && (await gpsService.isBatteryOptimized())) {");
    assert.ok(at > 0);
    const gate = s.slice(at, s.indexOf('// Warn for ANY start before the gun', at));
    assert.ok(/if \(choice === 'cancel'\) \{\n[^\n]*\n\s*void analyticsService\.logStartStep\('blocked', 'battery_optimization', raceReadyKey\);\n\s*return;\n\s*\}/.test(gate), gate);
    assert.strictEqual((gate.match(/logStartStep\(/g) || []).length, 1, 'only the cancel logs');
    // both callbacks list raceReadyKey, so the step carries the right race
    for (const fn of ['const startGPSTracking = useCallback(', 'const doStartGPSTracking = useCallback(']) {
      const f = s.indexOf(fn);
      const deps = s.slice(s.indexOf('\n  }, [', f), s.indexOf(']);', s.indexOf('\n  }, [', f)));
      assert.ok(/\braceReadyKey\b/.test(deps), fn + ' deps');
    }
  });

  test('local notifications the app raises (start reminders, start not started, Battery Saver, GPS health) never open the race popup or navigate', () => {
    // Home's foreground popup and the tap handler both need race_id AND event_name
    // (checkpoint / finish pushes from the server).
    const s = home();
    assert.ok(/if \(data\?\.race_id && data\?\.event_name\) \{\n\s*setNotificationPopup\(/.test(s), 'foreground popup gate');
    const hook = fs.readFileSync(path.join(SRC, 'hooks/useNotifications.ts'), 'utf8');
    assert.ok(/if \(data\?\.race_id && data\?\.event_name && onNotificationTapRef\.current\) \{/.test(hook), 'tap gate');
    // every local notification the app schedules, and its data payload
    const files = ['screens/HomeScreen.tsx', 'services/gpsService.ts', 'services/startReminderService.ts'];
    let found = 0;
    for (const f of files) {
      const src = fs.readFileSync(path.join(SRC, f), 'utf8').replace(/\r/g, '');
      for (const m of src.matchAll(/scheduleNotificationAsync\(\{([\s\S]*?)\n\s*\}\)/g)) {
        found++;
        assert.ok(!/race_id|event_name/.test(m[1]), f + ': local notification carries race data: ' + m[1].slice(0, 200));
      }
    }
    assert.ok(found >= 4, 'start_backgrounded, gps health, battery_saver, start reminders: ' + found);
  });
};
