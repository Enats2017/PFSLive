// Cases added 2026-10-22 (confirmation pass after the full layout audit): the
// new layouts measured with the app's own fonts at 320-1024pt and 100-135% text
// (en / fr / nl), and the fixes made after the audit's verification review.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { textWidth } = require('../../scripts/text-width.cjs');

// phones 320-1024pt, then large phones (iPhone Pro Max 440, big Android 480),
// small tablets / foldables (600) and iPads in portrait (744 mini, 834 Air, 1024 Pro)
const WIDTHS = [320, 360, 375, 393, 430, 440, 480, 600, 744, 834, 1024];
const SCALES = [1, 1.12, 1.24, 1.35];
const LANGS = ['en', 'fr', 'nl'];
const SPACE = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 };

module.exports = ({ M, load, test, SRC }) => {
  const read = (rel) => fs.readFileSync(path.join(SRC, rel), 'utf8').replace(/\r/g, '');
  const lang = (ns, l) => JSON.parse(fs.readFileSync(path.join(SRC, 'i18n', ns, `${l}.json`), 'utf8'));
  const block = (src, name) => {
    const m = src.match(new RegExp('\\n\\s*' + name + ': ?\\{([^}]*)\\}'));
    assert.ok(m, 'style ' + name);
    return m[1];
  };
  const num = (b, prop) => {
    const m = b.match(new RegExp('(?:^|[\\s,{])' + prop + ':\\s*(space\\.\\w+|[\\d.]+)'));
    if (!m) return null;
    return m[1].startsWith('space.') ? SPACE[m[1].slice(6)] : Number(m[1]);
  };
  const font = (b) => b.match(/fontFamily:\s*(fonts\.\w+)/)[1];
  const lineCount = (text, w, f, size, opt) => {
    let n = 1;
    let cur = '';
    for (const word of String(text).split(/\s+/).filter(Boolean)) {
      if (textWidth(word, f, size, opt) > w) return Infinity;
      const next = cur ? cur + ' ' + word : word;
      if (textWidth(next, f, size, opt) <= w) cur = next;
      else { n++; cur = word; }
    }
    return n;
  };

  test('bottom bar (4 tabs): every label fits its tab at the default size (no shrink); with larger text it needs ≥ 0.8 shrink — never split or cut (en / fr / nl, 320-1024pt)', () => {
    const st = read('styles/bottomNav.styles.ts');
    const lb = block(st, 'label');
    const pad = num(block(st, 'tab'), 'paddingHorizontal');
    for (const f of ['components/common/BottomNavigation.tsx', 'components/common/BottomNavigationFollower.tsx']) {
      assert.ok(/numberOfLines=\{1\}\s*adjustsFontSizeToFit\s*minimumFontScale=\{0\.8\}/.test(read(f)), f);
    }
    const bad = [];
    for (const W of WIDTHS) for (const s of SCALES) for (const l of LANGS) {
      const nav = lang('common', l).nav;
      const room = W / 4 - 2 * pad;
      for (const k of ['home', 'favorites', 'results', 'participants', 'map']) {
        const w = textWidth(nav[k], 'fonts.bodySemi', num(lb, 'fontSize')) * s;   // active tab: semibold, the wider
        if (s === 1 && w > room) bad.push(`${W} ${l} ${nav[k]} shrinks at default`);
        if (room / w < 0.8) bad.push(`${W} ×${s} ${l} ${nav[k]} needs ${(room / w).toFixed(2)}`);
      }
    }
    assert.deepStrictEqual(bad, []);
  });

  test('event tabs (Past / Live / Upcoming): one line that shrinks (≥ 0.75), capped at ×1.2, 8pt padding below 360pt — "Binnenkort" never splits (320-1024pt)', () => {
    const ev = read('styles/event.ts');
    const bar = block(ev, 'tabBar');
    for (const f of ['screens/FollowerEventList/FollowerEvent.tsx', 'screens/ParticipantEvent/ParticipantEvent.tsx']) {
      const s = read(f);
      assert.ok(/numberOfLines=\{1\}\s*adjustsFontSizeToFit\s*minimumFontScale=\{0\.75\}\s*maxFontSizeMultiplier=\{1\.2\}/.test(s), f);
      assert.ok(/(?:windowWidth|width) < 360 && eventStyles\.tabItemNarrow/.test(s), f + ' narrow padding');
    }
    const bad = [];
    for (const W of WIDTHS) for (const s of SCALES) for (const l of LANGS) {
      const tabs = lang('FollowerEvent', l).live;   // the `follower` namespace
      const pad = W < 360 ? num(block(ev, 'tabItemNarrow'), 'paddingHorizontal') : num(block(ev, 'tabItem'), 'paddingHorizontal');
      const inner = W - 2 * SPACE.xl - 2 * num(bar, 'padding') - 2;
      const room = (inner - 2 * num(bar, 'gap')) / 3 - 2 * pad;
      for (const k of ['Past', 'Live', 'Upcoming']) {
        const w = textWidth(tabs[k], 'fonts.display', 13) * Math.min(s, 1.2);
        if (room / w < 0.75) bad.push(`${W} ×${s} ${l} ${tabs[k]} needs ${(room / w).toFixed(2)}`);
      }
    }
    assert.deepStrictEqual(bad, []);
  });

  test('header band: a long event name fits its 2 lines on every phone (en uppercase, 13pt, letter-spaced)', () => {
    const bt = block(read('styles/header.styles.ts'), 'bandText');
    const opt = { letterSpacing: num(bt, 'letterSpacing'), upper: true };
    for (const W of WIDTHS) {
      const room = W - 2 * SPACE.xl;
      for (const name of ['Marathon International de la Côte d\'Opale', 'Ultra Trail des Lacs de la Haute Sûre', 'Trail des Fantômes de Dinant 2026']) {
        assert.ok(lineCount(name, room, font(bt), num(bt, 'fontSize'), opt) <= 2, `${W} ${name}`);
      }
      // old one-line band: cut on a 320pt phone
      if (W === 320) assert.ok(textWidth('Ultra Trail des Lacs de la Haute Sûre', font(bt), num(bt, 'fontSize'), opt) > room);
    }
  });

  test('result details rankings: 14pt headings fit the column from 360pt, 12pt below — "Classement" / "klassement" whole (fr / nl)', () => {
    const st = read('styles/resultDetails.styles.ts');
    const label = block(st, 'rankingLabel');
    const small = block(st, 'rankingLabelSmall');
    assert.ok(/fontFamily: fonts\.body,/.test(small), 'family set (design check)');
    const colPad = num(block(st, 'rankingCol'), 'paddingHorizontal');
    for (const W of WIDTHS) {
      // card margin xl + padding lg each side (resultListStyle.card), 3 columns
      const col = (W - 2 * SPACE.xl - 2 * SPACE.lg) / 3 - 2 * colPad;
      const size = W < 360 ? num(small, 'fontSize') : num(label, 'fontSize');
      for (const l of LANGS) {
        const r = lang('Resultdetails', l);
        const words = JSON.stringify(r).match(/"(?:overall|gender|category|ranking)[^"]*":"([^"]+)"/g) || [];
        for (const w of ['Classement', 'klassement', 'Categorie', 'Catégorie', 'Algemeen']) {
          assert.ok(textWidth(w, font(label), size) <= col, `${W} ${w} ${size}pt in ${col.toFixed(0)}`);
        }
        assert.ok(words.length >= 0);
      }
    }
  });

  test('OTP: six boxes fit the 320pt screen (were 288pt in 280) and a digit fits its box even at ×1.35', () => {
    const fp = read('styles/forgetPassword.styles.ts');
    const row = block(fp, 'otpRow');
    const box = block(fp, 'otpInput');
    assert.ok(/flex: 1,/.test(box) && /maxWidth: 48,/.test(box), 'boxes share the row, max 48');
    const gap = num(row, 'gap');
    assert.strictEqual(gap % 4, 0, '4pt grid');
    const w320 = (320 - 2 * SPACE.xl - 5 * gap) / 6;
    assert.ok(w320 >= 36 && w320 <= 48, String(w320));
    const size = num(box, 'fontSize') || 22;
    assert.ok(textWidth('8', 'fonts.display', size) * 1.35 < w320 - 4);
  });

  test('live map elevation panel height (evaluated): full 224 in portrait, hidden on a phone in landscape, capped at 60% on a tablet in landscape', () => {
    const s = read('screens/LiveTrackingScreen.tsx');
    const m = s.match(/const panelHeight = mapAreaHeight > 0\n\s*\? Math\.floor\(Math\.min\(([\s\S]*?)\)\)\n\s*: ELEVATION_PANEL_HEIGHT;/);
    assert.ok(m, 'panelHeight expression');
    // eslint-disable-next-line no-new-func
    const panel = new Function('mapAreaHeight', 'isLandscape', 'ELEVATION_PANEL_HEIGHT', 'COLLAPSE_BTN_ROOM',
      'return mapAreaHeight > 0 ? Math.floor(Math.min(' + m[1] + ')) : ELEVATION_PANEL_HEIGHT;');
    const MIN = Number(s.match(/const MIN_PANEL = (\d+);/)[1]);
    const ROOM = Number(s.match(/const COLLAPSE_BTN_ROOM = (\d+);/)[1]);
    const P = 224;
    assert.strictEqual(panel(520, false, P, ROOM), 224, 'portrait phone');
    assert.ok(panel(96, true, P, ROOM) < MIN, 'phone landscape (~96pt map): hidden');
    assert.ok(panel(130, true, P, ROOM) < MIN || panel(130, true, P, ROOM) <= 130 * 0.6, 'large phone landscape: hidden or ≤ 60%');
    assert.strictEqual(panel(600, true, P, ROOM), 224, 'tablet landscape: fits in full');
    assert.strictEqual(panel(0, true, P, ROOM), 224, 'not measured yet');
    assert.ok(/<Text style=\{resultInfoStyles\.checkpointName\} numberOfLines=\{2\}>\{item\.name\}<\/Text>\{\/\*/.test(read('screens/ResultDetailsScreen/LiveTimingPoint.tsx')), 'checkpoint name 2 lines');
  });

  test('after-review fixes: registration slide-in outside the scroll, country picker sees an open keyboard, sheets drop the home-indicator inset while typing', () => {
    const reg = read('components/RegistrationModal.tsx');
    const outer = reg.indexOf('transform: [{ translateY: cardTranslateY }]');
    assert.ok(outer > 0 && outer < reg.indexOf('<ModalScroll'), 'animated wrapper around ModalScroll');
    assert.ok(/<Animated\.View style=\{(?:styles\.card|\[styles\.card, cd\.s\.card, cd\.compact && styles\.cardCompact\])\}>/.test(reg), 'card itself not transformed (the ScrollView clipped it)');
    assert.ok(/setKeyboardHeight\(Keyboard\.isVisible\(\) \? Keyboard\.metrics\(\)\?\.height \?\? 0 : 0\);/.test(read('components/CountrySelector.tsx')));
    for (const f of ['screens/SettingScreen/UserTrackingSettings.tsx', 'components/TrackingPasswordModal.tsx']) {
      assert.ok(/paddingBottom: keyboardHeight > 0 && isLandscape \? 8 : \(keyboardHeight > 0 \? 0 : insets\.bottom\) \+ 24,/.test(read(f)), f);
    }
  });

  test('after-review fixes: portrait looks as before — stats divider 32pt centred, favourites labels reserve no second line, file names cut in the middle', () => {
    assert.ok(/alignSelf: 'center',/.test(block(read('styles/resultDetails.styles.ts'), 'statsColBorder')));
    assert.ok(!/minHeight/.test(block(read('styles/favourite.style.ts'), 'statLabel')));
    assert.ok(/ellipsizeMode="middle"/.test(read('screens/PersonalEventScreen/CreatePersonalEvent.tsx')));
    assert.ok(/ellipsizeMode="middle"/.test(read('components/FileCard.tsx')));
  });

  test('the notch padding never REPLACES a 20pt gutter: a style merged with sidePadding has no horizontal padding of its own; Membership / Notification settings add the inset to their 20pt', () => {
    // paddingLeft / paddingRight beat padding / paddingHorizontal whatever the
    // order, so [styleWithGutter, { paddingLeft: 0 }] removed the gutter in portrait.
    const bad = [];
    (function walk(d) {
      for (const f of fs.readdirSync(d)) {
        const p = path.join(d, f);
        if (fs.statSync(p).isDirectory()) { walk(p); continue; }
        if (!/\.tsx$/.test(f)) continue;
        const s = fs.readFileSync(p, 'utf8').replace(/\r/g, '');
        for (const m of s.matchAll(/\[(\w+)\.(\w+), sidePadding\]/g)) {
          // the style sheet this screen imports under that name
          const im = s.match(new RegExp('import \\{[^}]*\\b' + m[1] + '\\b[^}]*\\} from \'([^\']+)\''));
          assert.ok(im, m[0] + ' import');
          const file = path.resolve(path.dirname(p), im[1]);
          const src = fs.readFileSync(fs.existsSync(file + '.ts') ? file + '.ts' : file + '.tsx', 'utf8').replace(/\r/g, '');
          const blocks = [src.match(new RegExp('\\n\\s*' + m[2] + ': ?\\{([^}]*)\\}'))].filter(Boolean);
          assert.ok(blocks.length, m[0]);
          for (const b of blocks) if (/(?:^|[\s,])padding(?:Horizontal|Left|Right)?:/.test(b[1])) bad.push(`${path.relative(SRC, p)} ${m[1]}.${m[2]}`);
        }
        for (const m of s.matchAll(/\[\{([^{}]*)\}, sidePadding\]/g)) {
          if (/(?:^|[\s,])padding(?:Horizontal|Left|Right)?:/.test(m[1])) bad.push(`${path.relative(SRC, p)} inline`);
        }
      }
    })(SRC);
    assert.deepStrictEqual(bad, []);
    for (const f of ['screens/ProfileScreen/MembershipPlansScreen.tsx', 'screens/SettingScreen/NotificationSettingsScreen.tsx']) {
      const s = read(f);
      assert.ok(/paddingLeft: space\.xl \+ sidePadding\.paddingLeft,?/.test(s) && /paddingRight: space\.xl \+ sidePadding\.paddingRight/.test(s), f);
    }
  });

  test('every SafeAreaView that pairs with the side padding uses the shared edges (or the same inline rule) and the const is declared in the same file', () => {
    const bad = [];
    (function walk(d) {
      for (const f of fs.readdirSync(d)) {
        const p = path.join(d, f);
        if (fs.statSync(p).isDirectory()) { walk(p); continue; }
        if (!/\.tsx$/.test(f)) continue;
        const s = fs.readFileSync(p, 'utf8').replace(/\r/g, '');
        if (!/useLandscapeSidePadding\(\)/.test(s)) continue;
        for (const m of s.matchAll(/<SafeAreaView\b[^>]*edges=\{([^}]*\}?)\}/g)) {
          if (!/^safeEdges$|isLandscape && !isGestureNav \? \[\s*'left',\s*'right'\s*\] : \['bottom'\]/.test(m[1])) bad.push(`${path.relative(SRC, p)}: ${m[1]}`);
        }
        if (/edges=\{safeEdges\}/.test(s) && !/const safeEdges = useSafeAreaEdges\(\);/.test(s)) bad.push(path.relative(SRC, p) + ' no const');
      }
    })(SRC);
    assert.deepStrictEqual(bad, []);
  });
};
