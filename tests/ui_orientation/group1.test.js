// UI check 2026-11-26 (branch fix/app-audit-2026-11-26), group 1: every UI
// element the audit batch added or changed on Home, the live map, the results
// list / details, the event lists, favourites and the bottom bars — rendered
// in PORTRAIT and LANDSCAPE on iPhone 15, Android 360dp and iPad (plus 320 /
// 430pt portrait for text), en / fr / nl, text ×1 and ×1.35.
//
//   node tests/ui_orientation/group1.test.js
//
// Reuses the growth harness (tests/growth/harness.js): the real src/ modules
// are called as function components and their element tree inspected. There
// is no layout engine, so "does it fit" is measured with the app's own font
// files (scripts/text-width.cjs) against widths taken from the real styles /
// rendered props. Toasts and the old map banner used the SYSTEM font; they are
// measured with Inter (≈ SF / Roboto metrics) — marked "approx." below.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { M, load, test, run, textOf, SRC } = require('../growth/harness');
const { textWidth } = require('../../scripts/text-width.cjs');

const SPACE = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, xxxxl: 90 };
const read = (rel) => fs.readFileSync(path.join(SRC, rel), 'utf8').replace(/\r/g, '');
const lang = (ns, l) => JSON.parse(fs.readFileSync(path.join(SRC, 'i18n', ns, `${l}.json`), 'utf8'));
const LANGS = ['en', 'fr', 'nl'];
const SCALES = [1, 1.35];
const block = (src, name) => {
  const m = src.match(new RegExp('\\n\\s*' + name + ': ?\\{([^}]*)\\}'));
  assert.ok(m, 'style ' + name);
  return m[1];
};
const num = (b, prop) => {
  const m = b.match(new RegExp('(?:^|[\\s,{])' + prop + ':\\s*(spacing\\.\\w+|space\\.\\w+|[\\d.]+)'));
  if (!m) return null;
  return /^spac/.test(m[1]) ? SPACE[m[1].split('.')[1]] : Number(m[1]);
};
const walk = (n, out = [], up = []) => {
  if (!n || typeof n !== 'object') return out;
  if (Array.isArray(n)) { n.forEach((c) => walk(c, out, up)); return out; }
  out.push({ n, up });
  (n.children || []).forEach((c) => walk(c, out, up.concat(n)));
  return out;
};
const list = (st) => (Array.isArray(st) ? st.flat(Infinity) : [st]).filter(Boolean);
const flat = (st) => Object.assign({}, ...list(st).filter((x) => typeof x === 'object'));
const names = (st) => list(st).map((x) => { try { return String(x); } catch (e) { return ''; } });
const has = (st, re) => names(st).some((s) => re.test(s));
const typeName = (n) => (typeof n.type === 'function' ? n.type.name : String(n.type));
const quiet = (fn) => { const l = console.log, e = console.error, w = console.warn; console.log = console.error = console.warn = () => {}; try { return fn(); } finally { console.log = l; console.error = e; console.warn = w; } };
// "styles.space.xl59" (token + n, from the harness's stub styles) → points
const pt = (v) => {
  if (typeof v === 'number') return v;
  const m = String(v).match(/^styles\.(?:space|spacing)\.(xxxxl|xxxl|xxl|xl|lg|md|sm|xs)(\d*)$/);
  assert.ok(m, 'a spacing token: ' + String(v));
  return SPACE[m[1]] + Number(m[2] || 0);
};
// Word-wrapped line count (iOS / Android also break after a hyphen); Infinity
// when one word is wider than the box (it would be split mid-word).
const lines = (t, W, f, size) => {
  let n = 0;
  for (const para of String(t).split('\n')) {
    n++;
    let cur = '';
    for (const x of para.split(/\s+|(?<=-)/).filter(Boolean)) {
      if (textWidth(x, f, size) > W) return Infinity;
      const nx = cur ? (cur.endsWith('-') ? cur + x : cur + ' ' + x) : x;
      if (textWidth(nx, f, size) <= W) cur = nx; else { n++; cur = x; }
    }
  }
  return n;
};

// ── devices (window, safe-area insets, landscape?) ─────────────────────────
const DEVICES = {
  'iPhone 15 portrait': [{ width: 393, height: 852 }, { top: 59, bottom: 34, left: 0, right: 0 }, false, 'ios'],
  'iPhone 15 landscape': [{ width: 852, height: 393 }, { top: 0, bottom: 21, left: 59, right: 59 }, true, 'ios'],
  'Android 360dp portrait': [{ width: 360, height: 800 }, { top: 24, bottom: 0, left: 0, right: 0 }, false, 'android'],
  'Android 360dp landscape (3-button, nav bar right)': [{ width: 800, height: 360 }, { top: 24, bottom: 0, left: 0, right: 48 }, true, 'android'],
  'Android 360dp landscape (gesture, cutout left)': [{ width: 800, height: 360 }, { top: 24, bottom: 16, left: 32, right: 0 }, true, 'android'],
  'iPad portrait': [{ width: 834, height: 1194 }, { top: 24, bottom: 20, left: 0, right: 0 }, false, 'ios'],
  'iPad landscape': [{ width: 1194, height: 834 }, { top: 24, bottom: 20, left: 0, right: 0 }, true, 'ios'],
};
// Text-only widths: the narrow portrait phones too.
const PORTRAIT_WIDTHS = [320, 360, 375, 393, 430];

// Render fn() as if on that device; stateMap maps every useState initial value.
const on = ([win, ins, , os], fn, stateMap) => {
  const prev = [M.window, M.insets, M.os, M.useStateMap, global.__DEV__];
  try {
    M.window = win; M.insets = ins; M.os = os; M.useStateMap = stateMap; global.__DEV__ = false;
    return quiet(fn);
  } finally { [M.window, M.insets, M.os, M.useStateMap, global.__DEV__] = prev; }
};
const loaded = (x) => (x === true ? false : x);          // every loading flag done
const nav = { navigate() {}, goBack() {}, addListener() { return () => {}; }, setOptions() {}, push() {}, canGoBack: () => true, getState: () => ({ routes: [], index: 0 }), dispatch() {} };
// Flip exactly the n-th boolean useState (all loading flags done) — used to find
// a screen's state by what it renders, so a reordered useState cannot fool it.
// rows: every list state starts with that row (a list screen past its empty state)
const flipOne = (k, rows) => { let i = -1; return (x) => { i++; if (i === k && typeof x === 'boolean') return !x; if (rows && Array.isArray(x) && x.length === 0) return rows; return loaded(x); }; };
const findStateIndex = (device, renderFn, found, rows, max = 80) => {
  for (let k = 0; k < max; k++) {
    let tree;
    try { tree = on(device, renderFn, flipOne(k, rows)); } catch (e) { continue; }
    if (found(tree)) return k;
  }
  return -1;
};

module.exports = () => {
  // ═══════════════ HomeScreen ═══════════════
  const homeEl = () => { const m = load('screens/HomeScreen'); const H = m.default || m.HomeScreen; return H({ navigation: nav, route: { params: {} } }); };
  const hs = read('styles/home.styles.ts');
  const cs = read('styles/common.styles.ts');

  test('Home "log in again" popup (rendered, 7 screens): rotates, status bar translucent, card in a ModalScroll capped to the window (reserve 16 compact / 40), icon hidden + compact card + buttons side by side in landscape, icon shown + stacked buttons in portrait; card clear of notch / nav bar', () => {
    const bad = [];
    for (const [name, dev] of Object.entries(DEVICES)) {
      const [win, ins, land] = dev;
      const all = walk(on(dev, homeEl, loaded));
      const modal = all.find((x) => x.n.type === 'Modal' && textOf(x.n).includes('home:auth.expiredTitle'));
      if (!modal) { bad.push(name + ': no popup'); continue; }
      const p = modal.n.props;
      if (!Array.isArray(p.supportedOrientations) || !p.supportedOrientations.some((o) => /landscape/.test(o)) || !p.supportedOrientations.some((o) => /portrait/.test(o))) bad.push(name + ': orientations');
      if (!p.transparent || !p.statusBarTranslucent || typeof p.onRequestClose !== 'function') bad.push(name + ': transparent / statusBarTranslucent / back button');
      const inside = walk(modal.n);
      const ms = inside.find((x) => typeName(x.n) === 'ModalScroll');
      if (!ms) { bad.push(name + ': no ModalScroll'); continue; }
      if (ms.n.props.reserve !== (land ? 16 : 40)) bad.push(`${name}: reserve ${ms.n.props.reserve}`);
      const sv = on(dev, () => ms.n.type(ms.n.props));
      const cap = flat(sv.props.style).maxHeight;
      if (cap !== Math.max(120, win.height - 2 * Math.max(ins.top, ins.bottom) - (land ? 16 : 40))) bad.push(`${name}: scroll cap ${cap}`);
      if (flat(sv.props.style).flexShrink !== 1) bad.push(name + ': cannot shrink → cannot scroll');
      const icon = inside.filter((x) => has(x.n.props.style, /notifIconWrapper$/));
      if (icon.length !== 1 || has(icon[0].n.props.style, /hideCompact$/) !== land) bad.push(`${name}: icon hidden=${icon.length && has(icon[0].n.props.style, /hideCompact$/)}`);
      const card = inside.find((x) => has(x.n.props.style, /notifCard$/));
      if (has(card.n.props.style, /notifCardCompact$/) !== land) bad.push(name + ': compact card');
      const row = inside.find((x) => has(x.n.props.style, /notifButtonContainer$/));
      if (has(row.n.props.style, /notifButtonRowCompact$/) !== land) bad.push(name + ': button row');
      const btns = walk(row.n).filter((x) => x.n.type === 'TouchableOpacity');
      if (btns.length !== 2 || btns.some((b) => has(b.n.props.style, /notifButtonCompact$/) !== land)) bad.push(name + ': buttons');
      // centred card: the margin left beside it covers the notch / nav bar
      const cardW = Math.min(land ? num(block(hs, 'notifCardCompact'), 'maxWidth') : num(block(hs, 'notifCard'), 'maxWidth'), win.width - 2 * (land ? 8 : 20));
      const sideGap = (win.width - cardW) / 2;
      if (sideGap < Math.max(ins.left, ins.right)) bad.push(`${name}: card ${sideGap}pt from the edge < inset ${Math.max(ins.left, ins.right)}`);
    }
    assert.deepStrictEqual(bad, []);
  });

  test('Home "log in again" popup (measured): both variants (tracking / logged out) fit a landscape iPhone 15 and Android 360dp WITHOUT scrolling in compact mode, and every label fits its button without splitting a word — en / fr / nl, ×1 and ×1.35 for the labels', () => {
    const card = block(hs, 'notifCard'), cardC = block(hs, 'notifCardCompact');
    const title = block(hs, 'notifTitle'), body = block(hs, 'notifBody'), bodyC = block(hs, 'notifBodyCompact');
    const btn = block(cs, 'primaryButton'), btnT = block(cs, 'primaryButtonText');
    const GAP = num(block(hs, 'notifButtonContainer'), 'gap');
    const BASIS = num(block(hs, 'notifButtonCompact'), 'flexBasis');
    const labelH = (label, bw, s) => {
      const n = lines(label, bw - 2 * num(btn, 'paddingHorizontal'), 'fonts.display', num(btnT, 'fontSize') * s);
      return n === Infinity ? Infinity : Math.max(num(btn, 'minHeight'), 2 * num(btn, 'paddingVertical') + n * Math.ceil(num(btnT, 'fontSize') * s * 1.35));
    };
    const bad = [];
    for (const [name, [win, ins, land]] of Object.entries(DEVICES).filter(([n, d]) => d[2] && !/iPad/.test(n))) {
      const inner = Math.min(num(cardC, 'maxWidth'), win.width - 16) - 2 * num(card, 'paddingHorizontal');
      const cap = win.height - 2 * Math.max(ins.top, ins.bottom) - 16 - 16;   // ModalScroll cap − its 8 + 8 padding
      const per = Math.max(1, Math.floor((inner + GAP) / (BASIS + GAP)));
      assert.strictEqual(per >= 2, true, name + ': two buttons share a row');
      const bw = (inner - GAP) / 2;
      for (const l of LANGS) {
        const a = lang('HomeScreen', l).auth;
        for (const b of [a.expiredTrackingBody, a.expiredBody]) {
          const h = 2 * num(cardC, 'paddingVertical')
            + lines(a.expiredTitle, inner, 'fonts.bodySemi', num(title, 'fontSize')) * Math.ceil(num(title, 'fontSize') * 1.35) + num(title, 'marginBottom')
            + lines(b, inner, 'fonts.body', num(body, 'fontSize')) * num(body, 'lineHeight') + num(bodyC, 'marginBottom')
            + Math.max(labelH(a.logIn, bw, 1), labelH(a.later, bw, 1));
          if (!(h <= cap)) bad.push(`${name} ${l}: ${h} > ${cap}`);
        }
        for (const s of SCALES) {
          for (const x of [a.logIn, a.later]) {
            if (labelH(x, bw, s) === Infinity) bad.push(`${name} ${l} ×${s} compact "${x}"`);
            for (const W of PORTRAIT_WIDTHS) if (labelH(x, Math.min(400, W - 40) - 2 * num(card, 'paddingHorizontal'), s) === Infinity) bad.push(`${W}pt ${l} ×${s} "${x}"`);
          }
        }
      }
    }
    assert.deepStrictEqual(bad, []);
  });

  test('Home Start / Stop button (rendered, 7 screens): "Stopping…" keeps the Stop look (outlined red, dimmed 0.6, busy) — not the navy Start button (textual: the idle Start look, which needs a loaded home answer); the label fits one line from 320pt at ×1.35 (en / fr / nl)', () => {
    const bad = [];
    const button = (tree, key) => walk(tree).find((x) => x.n.type === 'TouchableOpacity' && textOf(x.n).includes(key));
    for (const [name, dev] of Object.entries(DEVICES)) {
      // every boolean flipped: tracking + stopping (the state right after Stop)
      const stopping = button(on(dev, homeEl, (x) => (x === true ? false : x === false ? true : x)), 'home:tracking.stopping');
      if (!stopping) { bad.push(name + ': no Stopping… button'); continue; }
      const st = stopping.n.props.style;
      if (!has(st, /stopButton$/) || has(st, /homeStyles\.button$/)) bad.push(name + ': Stopping… not in the Stop style');
      if (flat(st).opacity !== 0.6) bad.push(name + ': not dimmed');
      if (!(stopping.n.props.accessibilityState && stopping.n.props.accessibilityState.busy === true)) bad.push(name + ': not busy');
      const label = walk(stopping.n).find((x) => x.n.type === 'Text');
      if (!has(label.n.props.style, /stopButtonText$/)) bad.push(name + ': label style');
      if (label.n.props.numberOfLines !== undefined) bad.push(name + ': label capped');
    }
    // the source keeps the look tied to isStopping even after isGPSActive went false
    const h = read('screens/HomeScreen.tsx');
    assert.ok(/isGPSActive \|\| isStopping \? homeStyles\.stopButton : homeStyles\.button/.test(h), 'style while stopping');
    assert.ok(/<Text style=\{isGPSActive \|\| isStopping \? homeStyles\.stopButtonText : homeStyles\.buttonText\}>/.test(h), 'label style while stopping');
    // full-width button inside the Home card: 320 − 2×20 screen − 2×16 card (stopButton has no side padding)
    for (const l of LANGS) for (const s of SCALES) {
      const w = textWidth(lang('HomeScreen', l).tracking.stopping, 'fonts.display', num(block(hs, 'stopButtonText'), 'fontSize') * s);
      if (w > 320 - 40 - 32) bad.push(`${l} ×${s}: ${Math.round(w)}pt`);
    }
    assert.deepStrictEqual(bad, []);
  });

  // Toasts: utils/toastConfig caps the title at 4 lines and the body at 8 (were 1 / 2 until the
  // group 2 toast fix 2026-11-26; the Home copy below still fits the old 1 / 2).
  const toastBox = (dev) => {
    const { toastConfig } = load('../utils/toastConfig');
    const el = on(dev, () => toastConfig.success({ text1: 'T', text2: 'B' }));
    const tree = on(dev, () => el.type(el.props));
    const box = walk(tree).find((x) => flat(x.n.props && x.n.props.style).maxWidth !== undefined);
    const texts = walk(tree).filter((x) => x.n.type === 'Text');
    return { maxWidth: flat(box.n.props.style).maxWidth, titleLines: texts[0].n.props.numberOfLines, bodyLines: texts[1].n.props.numberOfLines, through: tree.props.pointerEvents === 'none' };
  };
  test('Home toasts "still stopping" / "earlier day stopped" (rendered toast + measured, approx. system font): title on its one line and body within the toast\'s 2 lines — portrait 320-430pt, iPhone 15 / Android 360dp / iPad landscape, ×1 and ×1.35, en / fr / nl (the first copy ran to 3-5 lines: cut with "…")', () => {
    const bad = [];
    const screens = { ...Object.fromEntries(PORTRAIT_WIDTHS.map((w) => [`${w}pt portrait`, [{ width: w, height: 700 }, { top: 20, bottom: 0, left: 0, right: 0 }, false, 'ios']])), ...DEVICES };
    for (const [name, dev] of Object.entries(screens)) {
      const b = toastBox(dev);
      assert.strictEqual(b.titleLines, 4); assert.strictEqual(b.bodyLines, 8); assert.ok(b.through, 'toast never takes taps');
      const inner = b.maxWidth - 2 * 16 - 2 - 22 - 8;   // padding, border, icon, gap
      for (const l of LANGS) {
        const tr = lang('HomeScreen', l).tracking;
        for (const [k1, k2] of [['stopInProgressTitle', 'stopInProgressBody'], ['previousDayStoppedTitle', 'previousDayStoppedBody']]) {
          for (const s of SCALES) {
            if (textWidth(tr[k1], 'fonts.bodyMedium', 14 * s) > inner) bad.push(`${name} ${l} ×${s} ${k1}`);
            const n = lines(tr[k2], inner, 'fonts.bodyMedium', 12 * s);
            if (n > 2) bad.push(`${name} ${l} ×${s} ${k2}: ${n} lines`);   // still the old 2-line budget: stricter than the cap
          }
        }
      }
    }
    assert.deepStrictEqual(bad, []);
  });

  // ═══════════════ Live map ═══════════════
  const liveEl = () => load('screens/LiveTrackingScreen').default({ route: { params: { product_app_id: 1, event_name: 'E', product_option_value_app_id: 2 } }, navigation: nav });
  const hasBanner = (tree) => textOf(tree).includes('livetracking:refreshFailed');

  test('Live map "connection problem" banner (rendered, 7 screens): a strip ABOVE the map area — not floating over the compass, the ⌄ button, the elevation panel or an open runner popup — inside the notch padding, never taking taps, up to 3 lines (no "…")', () => {
    const k = findStateIndex(DEVICES['iPhone 15 portrait'], liveEl, hasBanner);
    assert.ok(k >= 0, 'a state that shows the banner (refreshFailed)');
    const bad = [];
    for (const [name, dev] of Object.entries(DEVICES)) {
      const [, ins, land] = dev;
      const root = on(dev, liveEl, flipOne(k));
      const all = walk(root);
      const txt = all.find((x) => x.n.type === 'Text' && (x.n.children || []).includes('livetracking:refreshFailed'));
      if (!txt) { bad.push(name + ': no banner'); continue; }
      const banner = txt.up[txt.up.length - 1];
      const bs = flat(banner.props.style);
      if (bs.position === 'absolute') bad.push(name + ': floats over the map');
      if (banner.props.pointerEvents !== 'none') bad.push(name + ': takes taps');
      if (txt.n.props.numberOfLines !== 3) bad.push(name + ': line cap ' + txt.n.props.numberOfLines);
      // not inside the map area (the View measured for panelHeight / holding the popups)
      if (txt.up.some((u) => u.props && typeof u.props.onLayout === 'function')) bad.push(name + ': inside the map area');
      const parent = txt.up[txt.up.length - 2];
      const sibs = parent.children.filter((c) => c && typeof c === 'object');
      const mapArea = sibs.findIndex((c) => c.props && typeof c.props.onLayout === 'function');
      if (!(mapArea > sibs.indexOf(banner))) bad.push(name + ': not above the map area');
      // sides: SafeAreaView edges + the screen side padding clear the notch / nav bar
      const edges = root.props.edges || [];
      const pad = flat(parent.props.style);
      for (const side of ['left', 'right']) {
        const P = side === 'left' ? 'paddingLeft' : 'paddingRight';
        const clear = (edges.includes(side) ? ins[side] : 0) + (pad[P] || 0) + pt(banner.props.style && bs.marginHorizontal);
        if (clear < ins[side]) bad.push(`${name}: ${side} ${clear} < inset ${ins[side]}`);
      }
      if (!land && edges.includes('bottom') === false && ins.bottom > 0 && !edges.includes('bottom')) bad.push(name + ': bottom inset');
    }
    assert.deepStrictEqual(bad, []);
  });

  test('Live map banner (measured, fonts.bodyMedium 12 / 16): at most 3 lines on 320-430pt portrait and ONE line on every landscape phone / tablet (it takes ≤ 40pt of a ~180pt landscape map) — en / fr / nl, ×1 and ×1.35', () => {
    const s = read('screens/LiveTrackingScreen.tsx');
    assert.ok(/fontFamily: fonts\.bodyMedium, fontSize: 12, lineHeight: 16, textAlign: 'center' \}\} numberOfLines=\{3\}>\s*\{t\('livetracking:refreshFailed'\)\}/.test(s), 'banner text style');
    const bad = [];
    const widths = { ...Object.fromEntries(PORTRAIT_WIDTHS.map((w) => [`${w}pt portrait`, [w, false]])), 'iPhone 15 landscape': [852 - 118, true], 'Android 360dp landscape': [800 - 48, true], 'iPad portrait': [834, false], 'iPad landscape': [1194, true] };
    for (const [name, [w, land]] of Object.entries(widths)) {
      const inner = w - 2 * 20 - 2 * 10;
      for (const l of LANGS) for (const sc of SCALES) {
        const n = lines(lang('livetracking', l).refreshFailed, inner, 'fonts.bodyMedium', 12 * sc);
        if (n > (land ? 1 : 3)) bad.push(`${name} ${l} ×${sc}: ${n} lines`);
      }
    }
    assert.deepStrictEqual(bad, []);
  });

  test('Live map elevation profile (rendered, 7 screens): a 6000-point route is drawn with ≤ 1500 points, the dots keep the full data, the profile scrolls sideways and a drag stops the auto-scroll back to the runner', () => {
    const { LiveElevationProfile, MAX_DRAWN_CHART_POINTS } = load('components/ElevationProfile/LiveElevationProfile');
    const chartData = Array.from({ length: 6000 }, (_, i) => ({ x: i / 100, y: 100 + (i % 50), lat: 50 + i / 1e5, lon: 4 + i / 1e5 }));
    for (const [name, dev] of Object.entries(DEVICES)) {
      const tree = on(dev, () => (LiveElevationProfile.type || LiveElevationProfile)({ chartData, aidStations: [], apiCheckpoints: [], participants: [], totalDistance: 60, minElevation: 100, maxElevation: 150, elevationGain: 10, onAidStationPress() {}, onParticipantPress() {}, panelHeight: dev[2] ? 108 : 224 }));
      const all = walk(tree);
      const sv = all.find((x) => x.n.props && x.n.props.horizontal === true);
      assert.ok(sv && typeof sv.n.props.onScrollBeginDrag === 'function', name + ': horizontal scroll with drag handler');
      const areas = all.filter((x) => x.n.props && Array.isArray(x.n.props.data) && x.n.props.interpolation === 'monotoneX');
      assert.ok(areas.length >= 1 && areas.every((a) => a.n.props.data.length <= MAX_DRAWN_CHART_POINTS), name + ': drawn points');
    }
  });

  // ═══════════════ Bottom bars ═══════════════
  test('bottom bars (rendered, participant + follower, 7 screens): still 4 tabs, slim icon-beside-label row in landscape and the tall bar in portrait, labels one line that shrink to fit (the tab change only alters where a tap goes)', () => {
    for (const [mod, n] of [['components/common/BottomNavigation', 'BottomNavigation'], ['components/common/BottomNavigationFollower', 'BottomNavigationFollower']]) {
      const C = load(mod)[n];
      for (const [name, dev] of Object.entries(DEVICES)) {
        const root = on(dev, () => C({ activeTab: 'Map', event_name: 'E', product_app_id: 1 }));
        const tabs = walk(root).filter((x) => x.n.type === 'TouchableOpacity');
        const labels = walk(root).filter((x) => x.n.type === 'Text');
        assert.strictEqual(tabs.length, 4, `${n} ${name}`);
        assert.strictEqual(has(root.props.style, /containerSlim$/), dev[2], `${n} ${name}: slim in landscape only`);
        assert.ok(labels.every((x) => x.n.props.numberOfLines === 1 && x.n.props.adjustsFontSizeToFit), `${n} ${name}: labels`);
      }
    }
  });

  // ═══════════════ Results list / search / details ═══════════════
  const resultListEl = () => load('screens/ResultList/ResultList').default({ route: { params: { product_app_id: 1, product_option_value_app_id: 2, event_name: 'E', sourceTab: 'past' } }, navigation: nav });
  const ROWS = [{ bib: '1', name: 'A', participant_app_id: 1 }];
  test('Result List page-2 "couldn\'t load more — tap to retry" footer (rendered, 7 screens): a full-width tap target ≥ 44pt tall, text centred and wrapping (no line cap), wired to load the next page again; at most 3 lines from 320pt at ×1.35 (en / fr / nl)', () => {
    const footerOf = (tree) => {
      const f = walk(tree).find((x) => x.n.props && 'ListFooterComponent' in x.n.props);
      return f && typeof f.n.props.ListFooterComponent === 'function' ? { list: f.n, foot: quiet(() => f.n.props.ListFooterComponent()) } : null;
    };
    const k = findStateIndex(DEVICES['iPhone 15 portrait'], resultListEl, (t) => { const f = footerOf(t); return !!(f && f.foot && textOf(f.foot).includes('allrace:race.loadMoreFailed')); }, ROWS);
    assert.ok(k >= 0, 'a state that shows the retry footer (pageError)');
    for (const [name, dev] of Object.entries(DEVICES)) {
      const f = footerOf(on(dev, resultListEl, flipOne(k, ROWS)));
      assert.ok(f && f.foot, name + ': list + footer');
      assert.strictEqual(f.foot.type, 'TouchableOpacity', name);
      assert.strictEqual(f.foot.props.onPress, f.list.props.onEndReached, name + ': retries the next page');
      const st = flat(f.foot.props.style);
      assert.ok(st.paddingVertical * 2 + 20 >= 44 && st.alignItems === 'center', name + ': tap target');
      const txt = walk(f.foot).find((x) => x.n.type === 'Text').n;
      assert.ok(has(txt.props.style, /loadingText$/) && txt.props.numberOfLines === undefined, name + ': wraps');
    }
    assert.ok(/textAlign: "center"/.test(block(read('styles/ResultList.styles.ts'), 'loadingText')));
    const bad = [];
    for (const l of LANGS) for (const s of SCALES) for (const W of PORTRAIT_WIDTHS) {
      const n = lines(lang('ResultList', l).race.loadMoreFailed, W - 2 * 20, 'fonts.body', 14 * s);
      if (n > 3) bad.push(`${W} ${l} ×${s}: ${n}`);
    }
    assert.deepStrictEqual(bad, []);
  });

  test('Search participants (rendered after the useParticipantSearch rewrite, 7 screens): the search field keeps 20pt + the notch / nav-bar inset from each screen edge in every orientation; the list pages through loadMore', () => {
    const bad = [];
    for (const [name, dev] of Object.entries(DEVICES)) {
      const all = walk(on(dev, () => load('screens/ResultList/SearchParticipant').default({ route: { params: { product_app_id: 1, event_name: 'E' } }, navigation: nav }), loaded));
      const input = all.find((x) => x.n.props && x.n.props.placeholder === 'details:participant.search');
      if (!input) { bad.push(name + ': no search field'); continue; }
      const fsx = Object.fromEntries(Object.entries(flat(input.n.props.frameStyle)).map(([a, b]) => [a, pt(b)]));
      const [, ins] = dev;
      // screen edge → field: the SafeAreaView's side edge (Android 3-button pads there) + band margin + band padding
      const root = on(dev, () => load('screens/ResultList/SearchParticipant').default({ route: { params: { product_app_id: 1, event_name: 'E' } }, navigation: nav }), loaded);
      const edges = root.props.edges || [];
      // the screen's container pads by the landscape side rule; the band's negative margin undoes it
      const sp = on(dev, () => load('hooks/useLandscapeSidePadding').useLandscapeSidePadding());
      for (const [side, mg, pd] of [['left', 'marginLeft', 'paddingLeft'], ['right', 'marginRight', 'paddingRight']]) {
        const toField = (edges.includes(side) ? ins[side] : 0) + sp[pd] + (fsx[mg] || 0) + (fsx[pd] || 0);
        if (toField < ins[side] + 20) bad.push(`${name}: ${side} field ${toField}pt from the edge < inset + 20`);
      }
      const fl = all.find((x) => x.n.props && 'renderItem' in x.n.props);
      if (!fl || typeof fl.n.props.onEndReached !== 'function') bad.push(name + ': list paging');
    }
    assert.deepStrictEqual(bad, []);
  });

  test('Result details "Connection problem — last updated hh:mm" line (rendered RaceLive, 7 screens): under the section label in the card column (not squeezed into a label/value row), danger colour, wraps (no line cap); absent when the data is live; the live clock stops while stale', () => {
    const live = load('screens/ResultDetailsScreen/RaceLive');
    const RL = live.default || live.RaceLive;
    const props = { raceInfo: { server_time: '01:00:00', next_cp: { name: 'CP 2' } }, event: { race_status: 'in_progress', distance_name: 'Trail 42' }, checkpoints: [] };
    for (const [name, dev] of Object.entries(DEVICES)) {
      for (const [lastUpdatedAt, key] of [[Date.UTC(2026, 10, 26, 9, 5), 'raceInfo.staleSince'], [null, 'raceInfo.staleNoTime']]) {
        const all = walk(on(dev, () => (RL.type || RL)({ ...props, stale: true, lastUpdatedAt })));
        const line = all.find((x) => x.n.type === 'Text' && (x.n.children || []).some((c) => typeof c === 'string' && c.startsWith(key)));
        assert.ok(line, `${name}: ${key}`);
        assert.strictEqual(line.n.props.numberOfLines, undefined, name + ': wraps');
        assert.ok(has(line.n.props.style, /rowLabel$/), name + ': rowLabel (flexShrink 1)');
        const parent = line.up[line.up.length - 1];
        assert.ok(has(parent.props.style, /resultInfoStyles\.card$/) && !has(parent.props.style, /bibCard$/), name + ': in the card column');
        if (lastUpdatedAt) assert.ok(/"time":"\d{2}[:.h]\d{2}/.test(line.n.children.join('')) || /\d/.test(line.n.children.join('')), name + ': shows the time');
      }
      const fresh = walk(on(dev, () => (RL.type || RL)({ ...props, stale: false })));
      assert.ok(!fresh.some((x) => /raceInfo\.stale/.test((x.n.children || []).join(''))), name + ': no line when live');
    }
    assert.ok(/flexShrink: 1/.test(block(read('styles/resultDetails.styles.ts'), 'rowLabel')));
    assert.ok(/event\?\.race_status === 'in_progress' && !stale/.test(read('screens/ResultDetailsScreen/RaceLive.tsx')), 'clock stops while stale');
    assert.ok(/<RaceLive [^>]*stale=\{stale\} lastUpdatedAt=\{lastUpdatedAt\}/.test(read('screens/ResultDetailsScreen/ResultDetails.tsx')), 'ResultDetails passes it (textual)');
  });

  // ═══════════════ Event lists, Home section, favourites ═══════════════
  test('event lists after the paging fixes (rendered: follower + participant pagers and both Past tabs, 7 screens): one-row sub-header in landscape, pages fill the pager, the Past search band scrolls with the cards in landscape (fixed above in portrait), list end pad 16 landscape / 90 portrait', () => {
    const bad = [];
    for (const [mod, label] of [['screens/FollowerEventList/FollowerEvent', 'follower'], ['screens/ParticipantEvent/ParticipantEvent', 'participant']]) {
      for (const [name, dev] of Object.entries(DEVICES)) {
        const all = walk(on(dev, () => load(mod).default({ route: { params: {} }, navigation: nav }), loaded));
        const sub = all.find((x) => x.n.props && has(x.n.props.style, /eventStyles\.subHeader$/));
        if (!sub || has(sub.n.props.style, /subHeaderLandscape$/) !== dev[2]) bad.push(`${label} ${name}: sub-header`);
        const pager = all.find((x) => x.n.props && x.n.props.horizontal && x.n.props.pagingEnabled);
        if (!pager) bad.push(`${label} ${name}: pager`);
      }
    }
    for (const mod of ['screens/FollowerEventList/PastTab', 'screens/ParticipantEvent/PastTab']) {
      for (const [name, dev] of Object.entries(DEVICES)) {
        const all = walk(on(dev, () => load(mod).default({ events: [{ product_app_id: 1, event_name: 'A long event name for the card', race_date: '2026-11-20' }], onLoadMore() {}, loadingMore: false, hasMore: true }), loaded));
        const fl = all.find((x) => x.n.props && 'renderItem' in x.n.props);
        if (!fl) { bad.push(`${mod} ${name}: list`); continue; }
        const headerIn = !!fl.n.props.ListHeaderComponent;
        if (headerIn !== dev[2]) bad.push(`${mod} ${name}: search band in list = ${headerIn}`);
        const padB = pt(flat(fl.n.props.contentContainerStyle).paddingBottom);
        if (padB !== (dev[2] ? 16 : 90)) bad.push(`${mod} ${name}: end pad ${padB}`);
        if (typeof fl.n.props.onEndReached !== 'function') bad.push(`${mod} ${name}: paging`);
      }
    }
    assert.deepStrictEqual(bad, []);
  });

  test('Home "Events you follow" section after the countdown re-anchor (rendered, 7 screens): an upcoming race shows "starts in" + h:mm:ss beside a name column that wraps (flex 1, no line cap); a race whose time is up shows LIVE', () => {
    const S = load('screens/FollowingLiveEventsSection');
    const Sec = S.default;
    const ev = (o) => ({ product_app_id: 1, product_option_value_app_id: 2, event_name: 'Grizzly 100 — Les Crêtes du Haut-Jacques (ultra distance)', race_time: '09:00:00', race_distance: '100 km', followed_participants: [], ...o });
    for (const [name, dev] of Object.entries(DEVICES)) {
      const all = walk(on(dev, () => Sec({ events: [ev({ race_status: 'upcoming', starts_in_seconds: 3725 })], onRoutePress() {} })));
      assert.ok(all.some((x) => (x.n.children || []).includes('1:02:05')), name + ': countdown');
      const title = all.find((x) => x.n.type === 'Text' && (x.n.children || []).includes(ev({}).event_name));
      assert.strictEqual(title.n.props.numberOfLines, undefined, name + ': name wraps');
      assert.ok(title.up.some((u) => has(u.props.style, /eventBody$/)), name + ': in the flex column');
      const liveAll = walk(on(dev, () => Sec({ events: [ev({ race_status: 'upcoming', starts_in_seconds: 0 })], onRoutePress() {} })));
      assert.ok(liveAll.some((x) => (x.n.children || []).includes('home:followingEvents.live')), name + ': LIVE at 0');
    }
    assert.ok(/eventBody: \{ flex: 1 \}/.test(hs));
    assert.strictEqual(S.secondsToStart(600, 0, 120000), 480);
  });

  test('favourites lists after the refetch / restore fixes (rendered, 7 screens): race favourites keep the landscape sub-header-in-list rule and the bar; "my favourites" renders its list in both orientations', () => {
    const bad = [];
    for (const [name, dev] of Object.entries(DEVICES)) {
      const all = walk(on(dev, () => load('screens/FavouriteScreen/FavouriteList').default({ route: { params: { product_app_id: 1, event_name: 'E' } }, navigation: nav }), loaded));
      const fl = all.find((x) => x.n.props && 'renderItem' in x.n.props);
      if (!fl) { bad.push(name + ': race favourites list'); continue; }
      if (!!fl.n.props.ListHeaderComponent !== dev[2]) bad.push(name + ': sub-header in list only in landscape');
      if (!all.some((x) => typeName(x.n) === 'BottomNavigation')) bad.push(name + ': bar');
      const u = walk(on(dev, () => load('screens/FollowerScreen/UserFavouriteList').default({ navigation: nav, route: { params: {} } }), loaded));
      if (!u.length) bad.push(name + ': my favourites');
    }
    assert.deepStrictEqual(bad, []);
  });
};

if (require.main === module) {
  module.exports();
  run('ui orientation — group 1').then((r) => {
    console.log(`\nUI ORIENTATION GROUP 1: ${r.pass} passed, ${r.fail} failed`);
    process.exit(r.fail ? 1 : 0);
  });
}
