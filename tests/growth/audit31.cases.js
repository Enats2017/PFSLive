// Cases added 2026-10-22 after the iOS device test with larger text (Settings →
// Accessibility → Larger Text): buttons with a FIXED height let a taller label
// spill outside their colour ("All Events", "Create Personal Event" on the
// Participant screen), one-line event names were cut ("Trail Festival…"), and
// distance-card dates were cut. Buttons now grow with the text.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { textWidth } = require('../../scripts/text-width.cjs');

module.exports = ({ load, test, SRC }) => {
  const read = (rel) => fs.readFileSync(path.join(SRC, rel), 'utf8').replace(/\r/g, '');
  const block = (src, name) => {
    const m = src.match(new RegExp('\\n\\s*' + name + ':\\s*\\{([^{}]*)\\}'));
    assert.ok(m, 'style ' + name);
    return m[1];
  };

  const BUTTONS = [
    ['styles/common.styles.ts', 'primaryButton', 48], ['styles/common.styles.ts', 'outlineButton', 48],
    ['styles/common.styles.ts', 'limeButton', 48], ['styles/common.styles.ts', 'secondaryButton', 48],
    ['styles/common.styles.ts', 'favoriteButton', 48], ['styles/ui.styles.ts', 'btn', 48],
    ['components/FeedbackSuccessModal.tsx', 'button', 48], ['components/SearchInput.tsx', 'field', 40],
    ['components/CountrySelector.tsx', 'searchContainer', 46],
    ['styles/home.styles.ts', 'stopButton', 56], ['styles/home.styles.ts', 'button', 48],
    ['styles/login.styles.ts', 'registerButton', 56], ['styles/ownProfile.styles.ts', 'iosbutton', 44],
    ['styles/ownProfile.styles.ts', 'createBtn', 48], ['styles/readiness.styles.ts', 'laterButton', 44],
    ['styles/readiness.styles.ts', 'fixButton', 32], ['styles/readiness.styles.ts', 'shareButton', 44],
    ['styles/resultDetails.styles.ts', 'mapButton', 56], ['styles/ResultList.styles.ts', 'filterTab', 38],
  ];

  test('buttons / inputs that hold text grow with it: minHeight (same size as before), never a fixed height', () => {
    const bad = [];
    for (const [f, name, h] of BUTTONS) {
      const b = block(read(f), name);
      if (/(?:^|[\s,])height:\s*\d+/.test(b)) bad.push(`${f} ${name}: fixed height`);
      if (!new RegExp('minHeight:\\s*' + h + ',').test(b)) bad.push(`${f} ${name}: minHeight ${h} missing`);
      if (!/(?:^|[\s,])(paddingVertical|padding):/.test(b)) bad.push(`${f} ${name}: no vertical padding`);
    }
    assert.deepStrictEqual(bad, []);
  });

  test('no other button / tab / input style in the app has a fixed height (icon-only ones excepted by name)', () => {
    const ICON_ONLY = new Set(['favourite.style.ts addButton', 'favourite.style.ts addBtn', 'resultDetails.styles.ts cpBadge', 'ResultList.styles.ts cornerStarBtn',
      'forgetPassword.styles.ts otpInput', 'OtpScreen.styles.ts otpInput', 'forgetPassword.styles.ts progressSegment']);
    const bad = [];
    (function walk(d) {
      for (const f of fs.readdirSync(d)) {
        const p = path.join(d, f);
        if (fs.statSync(p).isDirectory()) { walk(p); continue; }
        if (!/\.(ts|tsx)$/.test(f) || /\.test\./.test(f)) continue;
        for (const m of fs.readFileSync(p, 'utf8').matchAll(/\n\s*([A-Za-z0-9_]+):\s*\{([^{}]*)\}/g)) {
          const [, name, b] = m;
          const h = b.match(/(?:^|[\s,])height:\s*(\d+)/);
          if (!h || !/button|btn|cta|pill|chip|tab|badge|toggle|segment|action|input|field|search/i.test(name)) continue;
          if (/icon|dot|line|divider|avatar|image|logo|indicator|handle/i.test(name)) continue;
          const w = b.match(/(?:^|[\s,])width:\s*(\d+)/);
          if (w && w[1] === h[1] && +h[1] <= 40) continue;
          if (!ICON_ONLY.has(`${f} ${name}`)) bad.push(`${path.relative(SRC, p)} ${name}`);
        }
      }
    })(SRC);
    assert.deepStrictEqual(bad, []);
  });

  test('button labels wrap INSIDE the button (centred, can shrink) — the shared Button allows 2 lines', () => {
    const c = read('styles/common.styles.ts');
    for (const name of ['primaryButtonText', 'outlineButtonText', 'limeButtonText', 'secondaryButtonText']) {
      const b = block(c, name);
      assert.ok(/textAlign: 'center'/.test(b) && /flexShrink: 1/.test(b), name);
    }
    const u = block(read('styles/ui.styles.ts'), 'btnLabel');
    assert.ok(/textAlign: 'center'/.test(u) && /flexShrink: 1/.test(u), 'btnLabel');
    assert.ok(/<Text style=\{\[ui\.btnLabel, LABEL_STYLE\[variant\]\]\} numberOfLines=\{2\}>/.test(read('components/ui/Button.tsx')));
  });

  test('Participant screen: "All events" / "Create personal event" are the shared growing buttons', () => {
    const s = read('screens/ParticipantScreen/ParticipantScreen.tsx');
    assert.ok(/style=\{\[commonStyles\.primaryButton, \{ flexDirection: 'row' \}\]\}[\s\S]{0,700}\{t\('participant:liveTracking\.showAll'\)\}/.test(s));
    assert.ok(/style=\{commonStyles\.limeButton\}[\s\S]{0,700}\{t\('participant:personalRace\.createButton'\)\}/.test(s));
    // at the largest common iOS step (xxxLarge ≈ 1.35×) both labels still fit the button width beside the icon
    for (const l of ['en', 'fr', 'nl']) {
      const p = JSON.parse(fs.readFileSync(path.join(SRC, 'i18n', 'ParticipantScreen', `${l}.json`), 'utf8'));
      for (const label of [p.liveTracking.showAll, p.personalRace.createButton]) {
        // 360pt phone: section padding 20 + button padding 20 each side, icon 15 + 8
        const room = 360 - 40 - 40 - 23;
        assert.ok(textWidth(label, 'fonts.display', 15) * 1.35 <= room * 2, `${l} "${label}" fits in at most 2 lines`);
      }
    }
  });

  test('Next events: event names take up to 2 lines (were cut at one: "Trail Festival…")', () => {
    assert.ok(/<Text style=\{fanstyle\.eventName\} numberOfLines=\{2\}>\{item\.name\}<\/Text>/.test(read('components/EventCard.tsx')));
  });
};
