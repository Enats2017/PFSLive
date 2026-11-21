// Cases added 2026-10-22 (device test, landscape): the Home popups did not fit
// / did not scroll in landscape, and on the left side elements sat under the
// camera on iPhone and Android. A Modal is outside every SafeAreaView, and on
// Android (edge-to-edge) it draws under the status bar, a side navigation bar
// and the camera cutout — so popups and sheets have to keep themselves clear.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { textWidth } = require('../../scripts/text-width.cjs');

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
    const m = b.match(new RegExp('(?:^|[\\s,{])' + prop + ':\\s*(spacing\\.\\w+|space\\.\\w+|[\\d.]+)'));
    if (!m) return null;
    const v = m[1];
    if (/^spac(?:e|ing)\./.test(v)) return SPACE[v.split('.')[1]];
    return Number(v);
  };
  const flat = (st) => (Array.isArray(st) ? st.flat(Infinity) : [st]).filter(Boolean);
  const withScreen = (win, insets, fn) => {
    const prev = [M.window, M.insets];
    try { M.window = win; M.insets = insets; return fn(); } finally { [M.window, M.insets] = prev; }
  };
  const PHONES = {
    'Android 32dp status bar landscape': [{ width: 780, height: 360 }, { top: 32, bottom: 0, left: 0, right: 48 }],
    'iPhone 15 portrait': [{ width: 393, height: 852 }, { top: 59, bottom: 34, left: 0, right: 0 }],
    'iPhone 15 landscape': [{ width: 852, height: 393 }, { top: 0, bottom: 21, left: 59, right: 59 }],
    'iPhone 11 landscape': [{ width: 812, height: 375 }, { top: 0, bottom: 21, left: 44, right: 44 }],
    'Android 3-button landscape': [{ width: 800, height: 360 }, { top: 24, bottom: 0, left: 32, right: 48 }],
    'Android gesture landscape': [{ width: 800, height: 360 }, { top: 24, bottom: 16, left: 32, right: 0 }],
  };

  // ── popups: always capped, always scroll ───────────────────────────────
  test('popup scroll box (rendered): an explicit height cap in points (window − system bars − wrapper), so a taller card ALWAYS scrolls — iPhone and Android, portrait and landscape', () => {
    const ModalScroll = load('components/ui/ModalScroll').default;
    for (const [name, [win, ins]] of Object.entries(PHONES)) {
      for (const reserve of [16, 40, 48]) {
        const el = withScreen(win, ins, () => ModalScroll({ children: null, reserve }));
        const st = Object.assign({}, ...flat(el.props.style));
        assert.strictEqual(st.maxHeight, win.height - 2 * Math.max(ins.top, ins.bottom) - reserve, `${name} reserve ${reserve}`);
        assert.strictEqual(st.flexShrink, 1, name);
        assert.strictEqual(st.maxWidth, 400);
        const cc = Object.assign({}, ...flat(el.props.contentContainerStyle));
        assert.strictEqual(cc.paddingVertical, 8, 'no inset counted twice');
      }
    }
    const s = read('components/ui/ModalScroll.tsx');
    assert.ok(!/maxHeight: '100%'/.test(s), 'no percentage cap');
    assert.ok(/showsVerticalScrollIndicator=\{overflows\}/.test(s) && /persistentScrollbar=\{overflows\}/.test(s) && /flashScrollIndicators\(\)/.test(s), 'scroll bar shown when the card overflows');
  });

  test('Home: all 9 popups pass their wrapper\'s padding to the cap (compact 8+8, normal 20+20) and go compact on a short screen — no icon, 520 wide, tighter gaps, buttons side by side', () => {
    const h = read('screens/HomeScreen.tsx');
    const count = (re) => (h.match(re) || []).length;
    assert.strictEqual(count(/<ModalScroll style=\{\[homeStyles\.notifScroll, compactPopups && homeStyles\.notifScrollCompact\]\} reserve=\{compactPopups \? 16 : 40\}>/g), 9);
    assert.strictEqual(count(/homeStyles\.notifWrapper, compactPopups && homeStyles\.notifWrapperCompact/g), 9);
    assert.strictEqual(count(/homeStyles\.notifCard, compactPopups && homeStyles\.notifCardCompact/g), 9);
    assert.strictEqual(count(/homeStyles\.notifIconWrapper[^\]]*compactPopups && homeStyles\.hideCompact/g), 9, 'every icon hidden');
    assert.strictEqual(count(/homeStyles\.notifButtonContainer, compactPopups && homeStyles\.notifButtonRowCompact/g), 9);
    assert.strictEqual(count(/compactPopups && homeStyles\.notifButtonCompact\]/g), 19, 'every button');
    assert.ok(/homeStyles\.notifTitle, compactPopups && homeStyles\.notifTitleClearClose/.test(h), 'notification title clear of the ✕');
    // landscape (phone or tablet) or a short window — device test 2026-10-23
    assert.ok(/const compactPopups = isCompactPopup\(popupWindow\.width, popupWindow\.height\);/.test(h));
    const st = read('styles/home.styles.ts');
    assert.strictEqual(num(block(st, 'notifWrapperCompact'), 'paddingVertical'), 8);
    assert.strictEqual(num(block(st, 'notifWrapper'), 'padding'), 20);
    assert.ok(/display: 'none'/.test(block(st, 'hideCompact')));
    assert.ok(/flexDirection: 'row'/.test(block(st, 'notifButtonRowCompact')) && /flexWrap: 'wrap'/.test(block(st, 'notifButtonRowCompact')));
    assert.strictEqual(num(block(st, 'notifCardCompact'), 'maxWidth'), 520);
  });

  test('Home start confirmation (the longest popup) fits a landscape phone WITHOUT scrolling in compact mode — en / fr / nl, iPhone 15, iPhone 11, Android 360dp', () => {
    const st = read('styles/home.styles.ts');
    const card = block(st, 'notifCard');
    const cardC = block(st, 'notifCardCompact');
    const title = block(st, 'notifTitle');
    const body = block(st, 'notifBody');
    const keep = block(st, 'notifKeepOpenBox');
    const keepT = block(st, 'notifKeepOpenText');
    const lines = (t, W, f, size) => {
      let n = 0;
      for (const para of String(t).split('\n')) {
        n++;
        let cur = '';
        for (const w of para.split(/\s+/).filter(Boolean)) {
          const nx = cur ? cur + ' ' + w : w;
          if (textWidth(nx, f, size) <= W) cur = nx; else { n++; cur = w; }
        }
      }
      return n;
    };
    const bad = [];
    // the rare 32dp-status-bar phone scrolls a little (scroll bar shown) — covered by the cap test
    for (const [name, [win, ins]] of Object.entries(PHONES).filter(([n]) => /landscape/.test(n) && !/32dp/.test(n))) {
      const cap = win.height - 2 * Math.max(ins.top, ins.bottom) - 16 - 16;   // ModalScroll cap − its 8+8 content padding
      const width = Math.min(num(cardC, 'maxWidth'), win.width - 40) - 2 * num(card, 'paddingHorizontal');
      for (const l of ['en', 'fr', 'nl']) {
        const sc = lang('HomeScreen', l).startConfirm;
        const h = 2 * num(cardC, 'paddingVertical')
          + lines(sc.title, width, 'fonts.bodySemi', num(title, 'fontSize')) * Math.ceil(num(title, 'fontSize') * 1.35) + num(title, 'marginBottom')
          + lines(sc.message, width, 'fonts.body', num(body, 'fontSize')) * num(body, 'lineHeight') + num(block(st, 'notifBodyCompact'), 'marginBottom')
          + lines(sc.keepOpen, width - 2 * num(keep, 'paddingHorizontal'), 'fonts.bodySemi', num(keepT, 'fontSize')) * num(keepT, 'lineHeight')
          + 2 * num(block(st, 'notifKeepOpenCompact'), 'paddingVertical') - SPACE.xs + SPACE.md
          + 48;                                                          // one row of buttons (minHeight 48)
        if (h > cap) bad.push(`${name} ${l}: ${h} > ${cap}`);
      }
    }
    assert.deepStrictEqual(bad, []);
  });

  test('every popup whose wrapper pads more than 20pt tells the cap (reserve 48); the fan e-mail popup adds the keyboard', () => {
    for (const f of ['components/RegistrationModal.tsx', 'components/MembershipPlanModel.tsx', 'components/FeedbackSuccessModal.tsx', 'screens/EventDetails/ParticipantResult.tsx']) {
      // 48 in portrait; 16 in compact landscape (wrapper padding 8 + 8) — device test 2026-10-23
      assert.ok(/<ModalScroll contentStyle=\{\{ alignItems: 'center' \}\} style=\{cd\.s\.scroll\} reserve=\{cd\.compact \? 16 : 48\}>/.test(read(f)), f);
    }
    const fe = read('components/Fanemailmodal.tsx');
    assert.ok(/reserve=\{\(compact \? 16 : 40\) \+ keyboardHeight - keyboardGiveBack\}/.test(fe));
    assert.ok(/homeStyles\.notifCard, compact && homeStyles\.notifCardCompact/.test(fe) && /homeStyles\.notifIconWrapper, compact && homeStyles\.hideCompact/.test(fe));
    assert.ok(!/notifWrapperCompact, modalSides/.test(fe), 'the centred card keeps its 20pt gutter (a bare paddingLeft: 0 removed it)');
  });

  // ── sheets and popups: clear of the camera / nav bar ──────────────────
  test('modal side insets (rendered): landscape pads by the real side insets on EVERY platform (Android 3-button too — the screen rule returned 0 there); portrait 0', () => {
    const { useModalSideInsets, isShortScreen, useLandscapeSidePadding } = load('hooks/useLandscapeSidePadding');
    const got = {};
    for (const [name, [win, ins]] of Object.entries(PHONES)) got[name] = withScreen(win, ins, () => [useModalSideInsets(), useLandscapeSidePadding()]);
    assert.deepStrictEqual(got['iPhone 15 portrait'][0], { paddingLeft: 0, paddingRight: 0 });
    assert.deepStrictEqual(got['iPhone 15 landscape'][0], { paddingLeft: 59, paddingRight: 59 });
    assert.deepStrictEqual(got['Android 3-button landscape'][0], { paddingLeft: 32, paddingRight: 48 });
    assert.deepStrictEqual(got['Android 3-button landscape'][1], { paddingLeft: 0, paddingRight: 0 }, 'the SCREEN rule is 0 there (SafeAreaView pads) — wrong inside a Modal');
    assert.deepStrictEqual(got['Android gesture landscape'][0], { paddingLeft: 32, paddingRight: 0 });
    assert.deepStrictEqual([320, 360, 393, 430, 499, 500, 852, undefined].map(isShortScreen), [true, true, true, true, true, false, false, false]);
  });

  test('every bottom sheet / edge popup inside a Modal uses the modal side insets — never the screen rule', () => {
    const uses = {
      'components/TrackingPasswordModal.tsx': /const side = useModalSideInsets\(\);/,
      'screens/EventDetails/ConfirmRaceResultModal.tsx': /const side = useModalSideInsets\(\);/,
      'screens/SettingScreen/UserTrackingSettings.tsx': /const sheetSide = useModalSideInsets\(\);[\s\S]*paddingLeft: space\.xxl \+ sheetSide\.paddingLeft/,
      'components/CountrySelector.tsx': /styles\.modalOverlay, modalSides/,
      'components/FloatingLabelInput.tsx': /styles\.pickerBackdrop, modalSides/,
      'components/FollowNotificationPrompt.tsx': /s\.sheetBackdrop, modalSides/,
      'components/FilterDropdown.tsx': /screenW - p\.left - 8 - modalSides\.paddingRight/,
    };
    for (const [f, re] of Object.entries(uses)) assert.ok(re.test(read(f)), f);
    for (const f of ['components/TrackingPasswordModal.tsx', 'screens/EventDetails/ConfirmRaceResultModal.tsx']) {
      assert.ok(!/useLandscapeSidePadding\(\)/.test(read(f)), f + ': no screen rule left');
    }
  });

  test('follow-notifications sheet: capped to the screen and scrolls, at most 560 wide and centred, no icon on a short screen (it was ~355pt on a ~340-393pt landscape screen)', () => {
    const s = read('components/FollowNotificationPrompt.tsx');
    assert.ok(/maxHeight: windowHeight - insets\.top - 8, maxWidth: 560, width: '100%', alignSelf: 'center'/.test(s));
    assert.ok(/<ScrollView style=\{\{ alignSelf: 'stretch' \}\}/.test(s));
    assert.ok(/s\.stepIconPlate, compact && \{ display: 'none' \}/.test(s));
  });

  test('no screen with a header leaves its sides to a plain edges={[\'bottom\']} (Android 3-button landscape: header icons under the camera)', () => {
    const bad = [];
    (function walk(d) {
      for (const f of fs.readdirSync(d)) {
        const p = path.join(d, f);
        if (fs.statSync(p).isDirectory()) { walk(p); continue; }
        if (!/\.tsx$/.test(f)) continue;
        const s = fs.readFileSync(p, 'utf8');
        if (/<AppHeader\b/.test(s) && /<SafeAreaView[^>]*edges=\{\['bottom'\]\}/.test(s)) bad.push(path.relative(SRC, p));
      }
    })(SRC);
    assert.deepStrictEqual(bad, []);
  });

  test('toasts: width from the current window and clear of the side insets (was read once at module load — wider than a portrait screen when started in landscape)', () => {
    const s = fs.readFileSync(path.join(SRC, '..', 'utils', 'toastConfig.tsx'), 'utf8');
    assert.ok(!/Dimensions\.get\(/.test(s));
    assert.ok(/const maxWidth = Math\.min\(width \* 0\.85, width - 2 \* Math\.max\(insets\.left, insets\.right\) - 16\);/.test(s));
  });
};
