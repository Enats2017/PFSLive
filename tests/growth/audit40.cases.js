// Cases added 2026-10-23 (device test, landscape):
//  1. Fan e-mail / start / stop / step / notification popups on Home: the icon
//     section hidden in landscape (phone AND tablet), portrait unchanged.
//  2. Past / Live / Upcoming tabs (follower + participant event lists): too much
//     blank space at the bottom and event cards not fully visible in landscape.
// The layout numbers are read from the real source; where the landscape code is
// missing they fall back to the old values, so every case fails on old code.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { textWidth } = require('../../scripts/text-width.cjs');

const SPACE = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, xxxxl: 90 };

module.exports = ({ M, load, test, SRC }) => {
  const read = (rel) => fs.readFileSync(path.join(SRC, rel), 'utf8').replace(/\r/g, '');
  const lang = (ns, l) => JSON.parse(fs.readFileSync(path.join(SRC, 'i18n', ns, `${l}.json`), 'utf8'));
  const soft = (src, name) => {
    const m = src.match(new RegExp('\\n\\s*' + name + ': ?\\{([^}]*)\\}'));
    return m ? m[1] : '';
  };
  const num = (b, prop) => {
    const m = b.match(new RegExp('(?:^|[\\s,{])' + prop + ':\\s*(spacing\\.\\w+|space\\.\\w+|[\\d.]+)'));
    if (!m) return null;
    return /^spac/.test(m[1]) ? SPACE[m[1].split('.')[1]] : Number(m[1]);
  };
  const TABS = ['FollowerEventList', 'ParticipantEvent'].flatMap((d) => ['PastTab', 'LiveTab', 'UpcomingTab'].map((t) => `screens/${d}/${t}.tsx`));
  const PAGERS = { follower: 'screens/FollowerEventList/FollowerEvent.tsx', participant: 'screens/ParticipantEvent/ParticipantEvent.tsx' };

  // ── 1. popups ─────────────────────────────────────────────────────────
  test('compact popups (icon hidden) in ANY landscape window — phones and tablets — or under 500pt tall; portrait phones and tablets keep the icon', () => {
    const { isCompactPopup } = load('hooks/useLandscapeSidePadding');
    assert.strictEqual(typeof isCompactPopup, 'function', 'isCompactPopup');
    const landscape = [[568, 320], [667, 375], [852, 393], [932, 430], [800, 360], [914, 411], [1024, 768], [1194, 834], [1366, 1024]];
    const portrait = [[320, 568], [375, 667], [393, 852], [430, 932], [360, 800], [411, 914], [768, 1024], [834, 1194], [1024, 1366]];
    assert.deepStrictEqual(landscape.filter(([w, h]) => !isCompactPopup(w, h)), [], 'landscape → compact');
    assert.deepStrictEqual(portrait.filter(([w, h]) => isCompactPopup(w, h)), [], 'portrait → normal (icon shown)');
    assert.strictEqual(isCompactPopup(600, 480), true, 'a short window still goes compact');
    assert.strictEqual(isCompactPopup(undefined, undefined), false);
  });

  test('every popup with an icon section (9 Home popups, fan e-mail, follow-notification prompt) uses the landscape rule and hides the icon when compact', () => {
    const h = read('screens/HomeScreen.tsx');
    assert.ok(/const compactPopups = isCompactPopup\(popupWindow\.width, popupWindow\.height\);/.test(h), 'Home');
    assert.strictEqual((h.match(/homeStyles\.notifIconWrapper[^\]]*compactPopups && homeStyles\.hideCompact/g) || []).length, 9, 'every Home icon');
    const fe = read('components/Fanemailmodal.tsx');
    assert.ok(/const compact = isCompactPopup\(popupWindow\.width, popupWindow\.height\);/.test(fe), 'fan e-mail');
    assert.ok(/homeStyles\.notifIconWrapper, compact && homeStyles\.hideCompact/.test(fe));
    const fp = read('components/FollowNotificationPrompt.tsx');
    assert.ok(/const compact = isCompactPopup\(windowWidth, windowHeight\);/.test(fp), 'follow prompt');
    assert.ok(/s\.stepIconPlate, compact && \{ display: 'none' \}/.test(fp));
    for (const [f, s] of [['HomeScreen', h], ['Fanemailmodal', fe], ['FollowNotificationPrompt', fp]]) {
      assert.ok(!/isShortScreen\(/.test(s), f + ': no height-only rule left');
    }
  });

  // Rendered, not read: the whole Home screen with EVERY popup open (each boolean
  // state flipped: loading off, every show* on), iOS and Android (the battery
  // popup is Android only), phone + tablet, landscape and portrait.
  const walk = (n, out = []) => {
    if (!n || typeof n !== 'object') return out;
    if (Array.isArray(n)) { n.forEach((c) => walk(c, out)); return out; }
    out.push(n);
    (n.children || []).forEach((c) => walk(c, out));
    return out;
  };
  const names = (st) => (Array.isArray(st) ? st.flat(Infinity) : [st]).filter(Boolean)
    .map((x) => { try { return String(x); } catch (e) { return JSON.stringify(x); } });
  const SCREENS = {
    'iPhone 15 landscape': [{ width: 852, height: 393 }, { top: 0, bottom: 21, left: 59, right: 59 }, true],
    'Android 360dp landscape': [{ width: 800, height: 360 }, { top: 24, bottom: 0, left: 0, right: 48 }, true],
    'iPad landscape': [{ width: 1194, height: 834 }, { top: 24, bottom: 20, left: 0, right: 0 }, true],
    'iPhone 15 portrait': [{ width: 393, height: 852 }, { top: 59, bottom: 34, left: 0, right: 0 }, false],
    'Android 360dp portrait': [{ width: 360, height: 800 }, { top: 24, bottom: 0, left: 0, right: 0 }, false],
    'iPad portrait': [{ width: 834, height: 1194 }, { top: 24, bottom: 20, left: 0, right: 0 }, false],
  };
  const rendered = (fn) => {
    const prev = [M.window, M.insets, M.os, M.useStateMap, global.__DEV__];
    try { return fn(); } finally { [M.window, M.insets, M.os, M.useStateMap, global.__DEV__] = prev; }
  };

  test('Home (rendered, every popup open): the icon section is hidden in landscape on phones AND tablets, shown in portrait — all 9 popups + the fan e-mail popup, iOS and Android', () => {
    const mod = load('screens/HomeScreen');
    const Home = mod.default || mod.HomeScreen;
    const bad = [];
    for (const os of ['ios', 'android']) {
      for (const [name, [win, ins, land]] of Object.entries(SCREENS)) {
        rendered(() => {
          M.os = os; M.window = win; M.insets = ins; global.__DEV__ = false;
          M.useStateMap = (x) => (x === true ? false : x === false ? true : x);
          const all = walk(Home({ navigation: { navigate() {}, addListener: () => () => {}, setOptions() {} }, route: { params: {} } }));
          const popups = all.filter((n) => n.type === 'Modal' && n.props.supportedOrientations);
          const icons = all.filter((n) => n.props && names(n.props.style).some((s) => /notifIconWrapper$/.test(s)));
          const hidden = icons.filter((n) => names(n.props.style).some((s) => /hideCompact$/.test(s)));
          const want = os === 'android' ? 9 : 8;                 // battery popup: Android only
          if (popups.length !== want || icons.length !== want) bad.push(`${os} ${name}: ${popups.length} popups, ${icons.length} icons (want ${want})`);
          if (hidden.length !== (land ? icons.length : 0)) bad.push(`${os} ${name}: ${hidden.length}/${icons.length} icons hidden`);
          // the fan e-mail popup sits on Home as its own component — render it too
          const fan = all.find((n) => typeof n.type === 'function' && n.type.name === 'FanEmailModal');
          if (!fan) { bad.push(`${os} ${name}: no fan e-mail popup`); return; }
          const fanIcon = walk(fan.type(fan.props)).filter((n) => n.props && names(n.props.style).some((s) => /notifIconWrapper$/.test(s)));
          const fanHidden = fanIcon.filter((n) => names(n.props.style).some((s) => /hideCompact$/.test(s))).length;
          if (fanIcon.length !== 1 || fanHidden !== (land ? 1 : 0)) bad.push(`${os} ${name}: fan e-mail icon ${fanHidden}/${fanIcon.length} hidden`);
        });
      }
    }
    assert.deepStrictEqual(bad, []);
  });

  // ── 2. event tabs ─────────────────────────────────────────────────────
  // The landscape layout as the source draws it (old values where it does not).
  const layout = () => {
    const hd = read('components/common/AppHeader.tsx');
    const m = hd.match(/paddingTop: insets\.top \+ \(width > height \? (\d+) : 16\)/);
    const hb = hd.match(/width > height && \{ paddingBottom: (\d+) \}/);
    const ev = read('styles/event.ts');
    const subL = soft(ev, 'subHeaderLandscape');
    const pager = {};
    for (const [k, f] of Object.entries(PAGERS)) pager[k] = /paddingBottom: isLandscape \? 0 : spacing\.xxxxl/.test(read(f)) ? 0 : 90;
    const listPad = {};
    const searchScrolls = {};
    for (const f of TABS) {
      const s = read(f);
      const lp = s.match(/paddingBottom: isLandscape \? spacing\.(\w+) : spacing\.xxxxl/);
      listPad[f] = lp ? SPACE[lp[1]] : 90;
      if (/PastTab/.test(f)) searchScrolls[f] = /ListHeaderComponent=\{isLandscape \? searchBand : null\}/.test(s) && /\{!isLandscape && searchBand\}/.test(s);
    }
    return {
      headerTop: m ? Number(m[1]) : 16,
      headerBottom: hb ? Number(hb[1]) : 16,
      subPad: num(subL, 'paddingVertical') ?? 16,
      subRow: /flexDirection: 'row'/.test(subL),
      pager, listPad, searchScrolls,
    };
  };
  const BAND = 8 + 8 + Math.ceil(13 * 1.35);                 // lime band: 8pt padding, one 13pt line
  const TAB_BAR = 4 * 2 + 1 * 2 + 8 * 2 + 19;              // pill: padding 4, border 1, item 8+8, 19pt line
  const SEARCH = 16 * 2 + 40 + 1;                          // SearchInput frame: 16 + 40pt field + 16 + hairline
  const LABEL = Math.ceil(11 * 1.35);                      // "OFFICIAL PARTNER EVENTS"
  // An event card with a badge, a one-line name (landscape width) and date + place, at ×1.35 text
  const CARD = (s) => 12 * 2 + (8 + Math.ceil(12 * s * 1.35)) + 4 + Math.ceil(15 * s * 1.35) + 2 * (8 + Math.ceil(13 * s * 1.35)) + 12;
  const LANDSCAPE = {
    'iPhone SE (667×375)': [375, 0, 0],
    'iPhone 15 / 16 (852×393)': [393, 0, 21],
    'iPhone 11 (896×414)': [414, 0, 21],
    'iPhone Pro Max (932×430)': [430, 0, 21],
    'Android 360dp gesture': [360, 24, 16],
    'Android 360dp 3-button': [360, 24, 0],
    'Android 411dp gesture': [411, 24, 16],
  };
  // Height the cards can use on one tab page (header, sub-header, pager pad, bottom inset off)
  const pageHeight = (L, which, f, [H, top, bottom]) => {
    const header = top + L.headerTop + 44 + L.headerBottom + BAND;
    const sub = 2 * L.subPad + 1 + (which === 'participant' && !L.subRow ? LABEL + 12 + TAB_BAR : Math.max(TAB_BAR, which === 'participant' ? LABEL : 0));
    const search = /PastTab/.test(f) && !L.searchScrolls[f] ? SEARCH : 0;
    return H - header - sub - L.pager[which] - bottom - search;
  };

  test('landscape: every event card on the Past / Live / Upcoming tabs fits whole on the page — up to ×1.35 text, iPhone SE to Pro Max, Android 360 / 411dp (follower + participant lists)', () => {
    const L = layout();
    const bad = [];
    for (const f of TABS) {
      const which = /Follower/.test(f) ? 'follower' : 'participant';
      for (const [phone, dims] of Object.entries(LANDSCAPE)) {
        const h = pageHeight(L, which, f, dims);
        if (h < CARD(1.35)) bad.push(`${f} ${phone}: ${h} < ${CARD(1.35)}`);
      }
    }
    assert.deepStrictEqual(bad, []);
  });

  test('landscape: no blank band under the last card — no 90pt pad on the pager, the list ends 16pt under its last card (was 90 + 90)', () => {
    const L = layout();
    assert.deepStrictEqual(L.pager, { follower: 0, participant: 0 });
    for (const f of TABS) assert.strictEqual(L.listPad[f], 16, f);
  });

  test('landscape: the Past tab search band scrolls away with the cards (list header, full-bleed); portrait keeps it fixed above the list', () => {
    const L = layout();
    for (const f of TABS.filter((x) => /PastTab/.test(x))) {
      assert.strictEqual(L.searchScrolls[f], true, f);
      assert.ok(/ListHeaderComponentStyle=\{isLandscape \? \{ marginHorizontal: -spacing\.xl, marginTop: -spacing\.sm, marginBottom: spacing\.sm \} : undefined\}/.test(read(f)), f + ' full-bleed');
    }
  });

  test('landscape: the sub-header is one 8pt row — "OFFICIAL PARTNER EVENTS" and the three tabs fit side by side from 568pt wide (en / fr / nl)', () => {
    const L = layout();
    assert.strictEqual(L.subPad, 8);
    assert.ok(L.subRow);
    for (const f of Object.values(PAGERS)) assert.ok(/<View style=\{\[eventStyles\.subHeader, isLandscape && eventStyles\.subHeaderLandscape\]\}>/.test(read(f)), f);
    const bad = [];
    for (const l of ['en', 'fr', 'nl']) {
      const p = lang('ParticipantEvent', l);
      const tabs = ['Past', 'Live', 'Upcoming'].reduce((w, k) => w + 2 * 16 + textWidth(p.live[k], 'fonts.display', 13), 0) + 2 * 4 + 2 * 4 + 2;
      const label = textWidth(p.official.title, 'fonts.bodySemi', 11, { letterSpacing: 0.7, upper: true });
      const inner = 568 - 2 * 20;
      if (label + 12 + tabs > inner) bad.push(`${l}: ${Math.round(label)} + ${Math.round(tabs)} > ${inner}`);
    }
    assert.deepStrictEqual(bad, []);
  });

  test('portrait unchanged: header 16pt, list and pager 90pt nav-bar pads, the Past search band fixed above the list', () => {
    const hd = read('components/common/AppHeader.tsx');
    assert.ok(/paddingTop: insets\.top \+ \(width > height \? 8 : 16\)/.test(hd) && /width > height && \{ paddingBottom: 8 \}/.test(hd), 'header: portrait 16 / landscape 8');
    for (const f of TABS) assert.ok(/paddingBottom: isLandscape \? spacing\.lg : spacing\.xxxxl/.test(read(f)), f);
    for (const f of Object.values(PAGERS)) assert.ok(/paddingBottom: isLandscape \? 0 : spacing\.xxxxl/.test(read(f)), f);
    for (const f of TABS.filter((x) => /PastTab/.test(x))) assert.ok(/\{!isLandscape && searchBand\}/.test(read(f)), f);
  });
};
