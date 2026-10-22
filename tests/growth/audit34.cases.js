// Cases added 2026-10-22 (device test, round 2): long event names cut on the
// home "Events you follow" cards, "Next events" cards of different heights, and
// the Results filters doing nothing in landscape.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { textWidth } = require('../../scripts/text-width.cjs');

module.exports = ({ load, test, SRC }) => {
  const read = (rel) => fs.readFileSync(path.join(SRC, rel), 'utf8').replace(/\r/g, '');
  const block = (src, name) => {
    const m = src.match(new RegExp('\\n\\s*' + name + ': ?\\{([^}]*)\\}'));
    assert.ok(m, 'style ' + name);
    return m[1];
  };
  const files = [];
  (function walk(d) {
    for (const f of fs.readdirSync(d)) {
      const p = path.join(d, f);
      if (fs.statSync(p).isDirectory()) walk(p);
      else if (/\.tsx$/.test(f)) files.push(p);
    }
  })(SRC);

  // ── 1. event names shown in full ───────────────────────────────────────
  test('home "Events you follow": the event name has no line limit (was 1 → "…") and wraps in its flex-1 column beside the countdown', () => {
    const s = read('screens/FollowingLiveEventsSection.tsx');
    assert.ok(/<Text style=\{commonStyles\.title\}>\n\s*\{event\.event_name\}/.test(s), 'no numberOfLines');
    assert.ok(/<View style=\{homeStyles\.eventBody\}>/.test(s));
    const h = read('styles/home.styles.ts');
    assert.ok(/eventBody: \{ flex: 1 \}/.test(h), 'name column takes the rest of the row');
    assert.ok(/cardTop: \{ flexDirection: "row"/.test(h));
    // a real long name needs more than one line of the column on a 375pt phone
    const col = 375 - 2 * 20 - 2 * 16 - 2 - 12 - 70;   // gutters, card padding + border, gap, countdown
    assert.ok(textWidth('Trail Festival des Hautes Fagnes 2026', 'fonts.display', 20) > col, 'old: cut');
  });

  test('home "Events you follow": "Follow the event" wraps inside its button beside the icon (flexShrink, centred)', () => {
    const b = block(read('styles/home.styles.ts'), 'followerText');
    assert.ok(/flexShrink: 1,/.test(b) && /textAlign: 'center',/.test(b));
  });

  test('profile live / past event cards: the event name has no line limit; the date line beside the buttons takes 2 lines', () => {
    for (const f of ['screens/ProfileScreen/EventCardLive.tsx', 'screens/ProfileScreen/EventCardPast.tsx']) {
      const s = read(f);
      assert.ok(/<Text style=\{(?:commonStyles\.title|\[commonStyles\.title, \{ marginBottom: spacing\.sm \}\])\}>\{item\.name\}<\/Text>/.test(s), f + ' name');
      assert.ok(/<Text style=\{\[commonStyles\.date, \{ flexShrink: 1 \}\]\} numberOfLines=\{2\}>/.test(s), f + ' date');
    }
  });

  test('no event name anywhere is limited to one line (event cards, home, profile)', () => {
    const bad = [];
    for (const p of files) {
      const s = fs.readFileSync(p, 'utf8');
      for (const m of s.matchAll(/<Text\b[^>]*numberOfLines=\{1\}[^>]*>\s*\{(?:event\.event_name|item\.event_name|event_name|eventName)\}/g)) bad.push(path.relative(SRC, p));
      if (/ProfileScreen[\\/]EventCard|components[\\/]EventCard|FollowingLiveEvents/.test(p) && /numberOfLines=\{1\}>\{item\.name\}/.test(s)) bad.push(path.relative(SRC, p) + ' item.name');
    }
    assert.deepStrictEqual(bad, []);
  });

  // ── 2. "Next events": one height for every card ───────────────────────
  test('"Next events" (participant + follower): every card fills its touchable, which the row stretches to the tallest card — same height, name at the top, date at the bottom', () => {
    const fan = read('styles/fan.styles.ts');
    const card = block(fan, 'eventCard');
    assert.ok(/width: 160,/.test(card) && /flex: 1,/.test(card), 'card fills the stretched touchable');
    const info = block(fan, 'eventInfo');
    assert.ok(/flex: 1,/.test(info) && /justifyContent: "space-between",/.test(info), 'date row pinned to the bottom');
    assert.ok(!/alignItems/.test(block(fan, 'sliderContent')), 'follower row: default stretch');
    const ec = read('components/EventCard.tsx');
    assert.ok(/<View style=\{fanstyle\.eventCard\}>/.test(ec) && /<View style=\{fanstyle\.eventInfo\}>/.test(ec));
    assert.ok(/<Text style=\{fanstyle\.eventName\} numberOfLines=\{2\}>\{item\.name\}<\/Text>/.test(ec));
    for (const f of ['screens/ParticipantScreen/ParticipantScreen.tsx', 'screens/FollowerScreen/FanScreen.tsx']) {
      const s = read(f);
      const i = s.indexOf('<EventCard item={item} t={t} />');
      assert.ok(i > 0, f);
      const before = s.slice(0, i);
      const sv = before.slice(before.lastIndexOf('<ScrollView'));
      assert.ok(/horizontal/.test(sv), f + ' horizontal row');
      assert.ok(!/alignItems/.test(sv), f + ': no alignItems on the row — children stretch to the tallest');
      const touch = before.slice(before.lastIndexOf('<TouchableOpacity'));
      assert.ok(!/style=/.test(touch), f + ': the touchable keeps the stretch (no alignSelf / height)');
    }
    // why: a 2-line name is a line taller than a 1-line one in the 136pt text box
    assert.ok(textWidth('Trail Festival des Hautes Fagnes', 'fonts.bodySemi', 14) > 160 - 24);
    assert.ok(textWidth('Run Brussels', 'fonts.bodySemi', 14) <= 160 - 24);
  });

  // ── 3. landscape: the Results filters ──────────────────────────────────
  test('every Modal in the app may show in landscape (supportedOrientations; RN\'s iOS default is portrait only — the filter popup never appeared)', () => {
    const bad = [];
    let n = 0;
    for (const p of files) {
      const s = fs.readFileSync(p, 'utf8');
      for (const m of s.matchAll(/<Modal(?=\s)([^>]*)>/g)) {
        n++;
        if (!/supportedOrientations=\{MODAL_ORIENTATIONS\}/.test(m[1])) bad.push(path.relative(SRC, p));
      }
      if (/<Modal\s/.test(s)) assert.ok(/import \{ MODAL_ORIENTATIONS \} from '[./]+constants\/modalOrientations';/.test(s), p);
    }
    assert.deepStrictEqual(bad, []);
    assert.strictEqual(n, 30);
    const { MODAL_ORIENTATIONS } = load('constants/modalOrientations');
    assert.deepStrictEqual(MODAL_ORIENTATIONS, ['portrait', 'landscape', 'landscape-left', 'landscape-right']);
    assert.ok(/orientation: "default"/.test(fs.readFileSync(path.join(SRC, '..', 'app.config.js'), 'utf8')), 'the app rotates');
    assert.ok(/<Modal supportedOrientations=\{MODAL_ORIENTATIONS\} transparent animationType="none" onRequestClose=\{closeMenu\}>/.test(read('components/FilterDropdown.tsx')));
  });

  test('filter popup position: below the button with the room left, above when there is more room there, never past the screen (portrait and landscape)', () => {
    const { dropPosition, POPUP_MAX } = load('utils/screenFit');
    assert.strictEqual(POPUP_MAX, 420);
    // portrait iPhone 15, filter row near the top: below, full 420
    assert.deepStrictEqual(dropPosition(20, 200, 150, 38, 393, 852), { top: 238, left: 20, width: 160, maxHeight: 420 });
    // landscape, filters in the list header: below, only the room left
    const l1 = dropPosition(80, 150, 300, 38, 852, 393);
    assert.deepStrictEqual(l1, { top: 188, left: 80, width: 300, maxHeight: 197 });
    // landscape, button scrolled low: opens above
    const l2 = dropPosition(80, 300, 300, 38, 852, 393);
    assert.deepStrictEqual(l2, { top: 0, bottom: 93, left: 80, width: 300, maxHeight: 292 });
    // never off-screen, any button position, both orientations
    for (const [W, H] of [[393, 852], [852, 393], [320, 568], [568, 320], [430, 932], [932, 430]]) {
      for (let y = 0; y <= H - 38; y += 7) for (const x of [0, W / 2, W - 100]) {
        const p = dropPosition(x, y, 120, 38, W, H);
        const top = p.bottom !== undefined ? H - p.bottom - p.maxHeight : p.top;
        assert.ok(top >= 8 - 1e-9 && top + p.maxHeight <= H - 8 + 1e-9, `${W}x${H} y=${y}: ${JSON.stringify(p)}`);
        assert.ok(p.left >= 8 && p.left + p.width <= W - 8, `${W}x${H} x=${x}`);
        assert.ok(p.maxHeight >= Math.min(160, (H - 38) / 2 - 8), `${W}x${H} y=${y}: room for the list`);
      }
    }
    // old: always below with 420 — in landscape the list ran ~215pt past the screen
    assert.ok(188 + 420 > 393);
  });

  test('filter popup: the dropdown uses the computed position (top or bottom, maxHeight), not the old fixed 420 below', () => {
    const s = read('components/FilterDropdown.tsx');
    assert.ok(/const \{ width: screenW, height: screenH \} = Dimensions\.get\('window'\);\n\s*setPos\(dropPosition\(x, y, w, h, screenW, screenH\)\);/.test(s));
    assert.ok(/\.\.\.\(pos\.bottom !== undefined \? \{ bottom: pos\.bottom \} : \{ top: pos\.top \}\),/.test(s));
    assert.ok(/maxHeight: pos\.maxHeight,/.test(s) && !/maxHeight: 420/.test(s));
  });
};
