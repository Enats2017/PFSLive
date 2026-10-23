// Cases added 2026-10-23 (full landscape / portrait re-check of the results,
// details, live tracking, favourites, profile and search screens).
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const SPACE = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, xxxxl: 90 };

module.exports = ({ M, load, test, SRC }) => {
  const read = (rel) => fs.readFileSync(path.join(SRC, rel), 'utf8').replace(/\r/g, '');
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
  const texts = (n) => walk(n).flatMap((x) => (x.n.children || []).filter((c) => typeof c === 'string' || typeof c === 'number').map(String));
  const screen = (win, ins, fn, stateMap) => {
    const prev = [M.window, M.insets, M.useStateMap];
    try { M.window = win; M.insets = ins; M.useStateMap = stateMap; return fn(); } finally { [M.window, M.insets, M.useStateMap] = prev; }
  };
  const quiet = (fn) => { const l = console.log; console.log = () => {}; try { return fn(); } finally { console.log = l; } };
  const IPHONE_L = [{ width: 852, height: 393 }, { top: 0, bottom: 21, left: 59, right: 59 }];
  const ANDROID_L = [{ width: 800, height: 360 }, { top: 24, bottom: 16, left: 32, right: 0 }];
  const IPAD_L = [{ width: 1194, height: 834 }, { top: 24, bottom: 20, left: 0, right: 0 }];
  const IPHONE_P = [{ width: 393, height: 852 }, { top: 59, bottom: 34, left: 0, right: 0 }];
  const SMALL_P = [{ width: 320, height: 568 }, { top: 20, bottom: 0, left: 0, right: 0 }];
  const LANDSCAPE = { 'iPhone 15 landscape': IPHONE_L, 'Android landscape': ANDROID_L, 'iPad landscape': IPAD_L };
  const PORTRAIT = { 'iPhone 15 portrait': IPHONE_P, '320pt portrait': SMALL_P };
  const nav = { navigate() {}, goBack() {}, addListener() { return () => {}; }, setOptions() {}, push() {} };
  const loaded = (x) => (x === true ? false : x);   // every loading flag done
  // the harness hands screens named style tokens: space.xl → 'styles.space.xl',
  // space.xl + 59 → 'styles.space.xl59'; this turns them back into points
  const pt = (v) => {
    if (typeof v === 'number') return v;
    const m = String(v).match(/^styles\.(?:space|spacing)\.(xxxxl|xxxl|xxl|xl|lg|md|sm|xs)(\d*)$/);
    assert.ok(m, 'a spacing token: ' + String(v));
    return SPACE[m[1]] + Number(m[2] || 0);
  };
  const pts = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, pt(v)]));

  // ── Live map ──────────────────────────────────────────────────────────────
  test('Live map, Android portrait: while a popup is open the elevation panel (5) and its chevron (10) drop to elevation 0 — Android draws by elevation before zIndex, so they were painted over the popup', () => {
    const s = read('screens/LiveTrackingScreen.tsx');
    assert.ok(/const popupOpen = popupState\.type !== null;/.test(s));
    assert.ok(/height: panelHeight,[^\n]*\n[\s\S]{0,400}elevation: popupOpen \? 0 : 5,/.test(s), 'panel');
    assert.ok(/zIndex: 10, elevation: popupOpen \? 0 : 10/.test(s), 'chevron');
    // the portrait popup is still a later sibling inside the same map area (drawn on top once nothing is elevated)
    const area = s.slice(s.indexOf('onLayout={(e) => setMapAreaHeight'), s.indexOf('{!isLandscape && mapPopups}') + 30);
    assert.ok(area.indexOf('liveTrackingStyles.collapseBtn') < area.indexOf('{!isLandscape && mapPopups}'));
  });

  test('Live map head (rendered): in landscape "Live map", the status pill and the distance selector share ONE row (~55pt, was ~100 of a ~200pt body); portrait: two rows as before', () => {
    const { DistanceDropdown } = load('components/DistanceDropdown');
    const props = { distances: [], selectedDistance: { distance_name: 'Kayak Trail duo', product_option_value_app_id: 1 }, onSelect() {}, raceState: 'live' };
    const parts = (win, ins) => screen(win, ins, () => {
      const root = DistanceDropdown(props);
      const btn = walk(root).find((x) => x.n.type === 'TouchableOpacity' && has(x.n.props.style, /dropdownButton$/)).n;
      const head = walk(root).find((x) => has(x.n.props && x.n.props.style, /mapHeadRow$/)).n;
      return { row: has(root.props.style, /dropdownContainerRow$/), head: has(head.props.style, /mapHeadRowInline$/), btn: has(btn.props.style, /dropdownButtonInline$/) };
    });
    for (const [name, [w, i]] of Object.entries(LANDSCAPE)) assert.deepStrictEqual(parts(w, i), { row: true, head: true, btn: true }, name);
    for (const [name, [w, i]] of Object.entries(PORTRAIT)) assert.deepStrictEqual(parts(w, i), { row: false, head: false, btn: false }, name);
    const st = read('styles/liveTracking.styles.ts');
    assert.ok(/flexDirection: 'row'/.test(block(st, 'dropdownContainerRow')));
    assert.strictEqual(num(block(st, 'mapHeadRowInline'), 'marginBottom'), 0);
    assert.strictEqual(num(block(st, 'dropdownButtonInline'), 'flex'), 1);
    assert.strictEqual(num(block(st, 'dropdownButtonInline'), 'paddingVertical'), 8);
  });

  test('bottom bar (rendered, participant + follower): in landscape icon and label side by side with 4pt top / bottom (~43pt, was 79 — ~40% of a landscape body); portrait unchanged', () => {
    const st = read('styles/bottomNav.styles.ts');
    assert.strictEqual(num(block(st, 'containerSlim'), 'paddingTop'), 4);
    assert.strictEqual(num(block(st, 'containerSlim'), 'paddingBottom'), 4);
    assert.ok(/flexDirection: 'row'/.test(block(st, 'tabSlim')));
    for (const [mod, name] of [['components/common/BottomNavigation', 'BottomNavigation'], ['components/common/BottomNavigationFollower', 'BottomNavigationFollower']]) {
      const C = load(mod)[name];
      const parts = (win, ins) => screen(win, ins, () => {
        const root = C({ activeTab: 'Home', event_name: 'E' });
        const tabs = walk(root).filter((x) => x.n.type === 'TouchableOpacity');
        const labels = walk(root).filter((x) => x.n.type === 'Text');
        return {
          slim: has(root.props.style, /containerSlim$/),
          tabs: tabs.filter((x) => has(x.n.props.style, /tabSlim$/)).length,
          oneLine: labels.every((x) => x.n.props.numberOfLines === 1 && x.n.props.adjustsFontSizeToFit),
        };
      });
      for (const [dev, [w, i]] of Object.entries(LANDSCAPE)) assert.deepStrictEqual(parts(w, i), { slim: true, tabs: 4, oneLine: true }, `${name} ${dev}`);
      for (const [dev, [w, i]] of Object.entries(PORTRAIT)) assert.deepStrictEqual(parts(w, i), { slim: false, tabs: 0, oneLine: true }, `${name} ${dev}`);
    }
  });

  test('details header image in landscape: 30% of the window (iPhone 118, Android 108, iPad 250 — was 45%: 177 / 162, as tall as the whole visible list) on all four details screens', () => {
    const { detailsHeaderImageLandscape } = load('utils/screenFit');
    assert.strictEqual(detailsHeaderImageLandscape(393), 118);
    assert.strictEqual(detailsHeaderImageLandscape(360), 108);
    assert.strictEqual(detailsHeaderImageLandscape(834), 250);
    for (const f of ['screens/EventDetails/DistanceTab.tsx', 'screens/EventDetails/ParticipantTab.tsx', 'screens/FollowerDetailsList/DistanceTab.tsx', 'screens/ParticipantEvent/RaceResultScreen.tsx']) {
      const s = read(f);
      assert.ok(/headerLandscape && \{ aspectRatio: undefined, height: headerImageHeight \}/.test(s) || /aspectRatio: undefined, height: headerImageHeight/.test(s), f + ': landscape only');
      assert.ok(!/\* 0\.45/.test(s), f);
    }
  });

  // ── Result List ───────────────────────────────────────────────────────────
  test('Result List (rendered): LANDSCAPE with no results — filters, statistics and the message scroll together, the message with ≥260pt (it got 0pt and spilled over the statistics; Retry unreachable on an error); PORTRAIT: filters fixed above the message, as before', () => {
    const render = (win, ins) => screen(win, ins, () => {
      const C = load('screens/ResultList/ResultList').default;
      return walk(C({ route: { params: { product_app_id: 1, product_option_value_app_id: 2, event_name: 'TRAIL', sourceTab: 'past' } }, navigation: nav }));
    }, (x) => (x === true ? false : x === '' ? 'finished' : x));   // loaded, race finished, NO results
    const st = read('styles/ResultList.styles.ts');
    assert.strictEqual(num(block(st, 'stateInScroll'), 'minHeight'), 260);
    assert.ok(/flexGrow: 1/.test(block(st, 'stateScroll')));
    // landscape, and short portrait phones (iPhone SE 568 / 667; filtersScrollWithList)
    const SCROLLS = { ...LANDSCAPE, '320×568 portrait (SE 1)': SMALL_P, '375×667 portrait (SE 2/3)': [{ width: 375, height: 667 }, { top: 20, bottom: 0, left: 0, right: 0 }] };
    for (const [name, [w, i]] of Object.entries(SCROLLS)) {
      const all = render(w, i);
      const scroll = all.find((x) => x.n.props && has(x.n.props.contentContainerStyle, /stateScroll$/));
      assert.ok(scroll, name + ': one scroll');
      const inside = walk(scroll.n);
      assert.ok(inside.some((x) => x.n.props && has(x.n.props.style, /filterRow1$/)), name + ': filters inside');
      assert.ok(inside.some((x) => x.n.props && has(x.n.props.style, /statisticsContainer$/)), name + ': statistics inside');
      const box = inside.find((x) => x.n.props && has(x.n.props.style, /stateInScroll$/));
      assert.ok(box && texts(box.n).includes('allrace:race.noResults'), name + ': the message in its box');
    }
    const TALL = { 'iPhone 15 portrait': IPHONE_P, 'iPhone 12 mini portrait': [{ width: 375, height: 812 }, { top: 50, bottom: 34, left: 0, right: 0 }], 'Android 800 portrait': [{ width: 360, height: 800 }, { top: 24, bottom: 48, left: 0, right: 0 }] };
    for (const [name, [w, i]] of Object.entries(TALL)) {
      const all = render(w, i);
      assert.ok(!all.some((x) => x.n.props && has(x.n.props.contentContainerStyle, /stateScroll$/)), name);
      const f1 = all.find((x) => x.n.props && has(x.n.props.style, /filterRow1$/));
      assert.ok(f1 && !f1.up.some((u) => u.props && u.props.contentContainerStyle), name + ': filters fixed');
      assert.ok(all.some((x) => (x.n.children || []).includes('allrace:race.noResults')), name);
    }
  });

  // ── Result details ────────────────────────────────────────────────────────
  test('result details (rendered): "Next timing point" spans its card (the list card\'s 20pt side margin pulled it in); Runner info wave row shows the value only, label fixed, value wraps right-aligned — as Race info', () => {
    const live = load('screens/ResultDetailsScreen/RaceLive');
    const RL = live.default || live.RaceLive;
    const all = walk((RL.type || RL)({ raceInfo: { next_cp: { name: 'CP 2' } }, runnerInfo: {} }));
    const box = all.find((x) => x.n.props && has(x.n.props.style, /resultListStyle\.card$/) && flat(x.n.props.style).borderColor);
    assert.ok(box, 'next timing point box');
    assert.strictEqual(flat(box.n.props.style).marginHorizontal, 0);

    const { stripWavePrefix } = load('utils/waveLabel');
    const ri = load('screens/ResultDetailsScreen/RunnerInfoTab');
    const RI = ri.default || ri.RunnerInfoTab;
    const wave = 'Wave 1: Start @ 9h';
    const nodes = walk((RI.type || RI)({ runnerInfo: {}, raceInfo: { wave, position: 1 } }));
    const label = nodes.find((x) => (x.n.children || []).includes('raceInfo.wavelabel'));
    assert.ok(label && has(label.n.props.style, /rowLabelFixed$/), 'label fixed');
    const row = label.up[label.up.length - 1];
    const value = row.children.find((c) => c && c.type === 'Text' && c !== label.n);
    assert.ok(has(value.props.style, /rowValueEnd$/), 'value wraps right-aligned');
    assert.deepStrictEqual(value.children.filter((c) => typeof c === 'string' || c === ''), [stripWavePrefix(wave)]);
    assert.notStrictEqual(stripWavePrefix(wave), wave, 'the prefix is gone');
  });

  // ── Favourites ────────────────────────────────────────────────────────────
  test('favourite card (rendered): before the race no divider (a rule over ~32pt of empty card); once started the divider sits above the stats', () => {
    const m = load('screens/FavouriteScreen/FavouriteCard');
    const C = m.default || m.FavouriteCard;
    const seps = (race_status) => walk((C.type || C)({ item: { race_status, name: 'A', bib: '1' }, onPress() {}, onToggle() {} }))
      .filter((x) => x.n.props && has(x.n.props.style, /favstyle\.separator$/)).length;
    assert.strictEqual(seps('not_started'), 0);
    assert.strictEqual(seps('in_progress'), 1);
    assert.strictEqual(seps('finished'), 1);
  });

  test('favourites list (rendered): LANDSCAPE — the sub-header scrolls away with the cards (fixed, it left ~105-141pt for a ~175pt card); PORTRAIT fixed as before; every state has the bar with Favourites highlighted (loading said Results, the error state had none)', () => {
    const route = { params: { product_app_id: 1, event_name: 'E' } };
    const render = (win, ins, map) => quiet(() => screen(win, ins, () => walk(load('screens/FavouriteScreen/FavouriteList').default({ route, navigation: nav })), map));
    for (const [name, [w, i]] of Object.entries(LANDSCAPE)) {
      const all = render(w, i, loaded);
      const fl = all.find((x) => x.n.props && 'renderItem' in x.n.props).n;
      assert.ok(fl.props.ListHeaderComponent && has(fl.props.ListHeaderComponent.props.style, /subHeader$/), name + ': in the list');
      assert.strictEqual(pt(fl.props.ListHeaderComponentStyle.marginBottom), 16, name + ': 16 above the first card');
      assert.strictEqual(all.filter((x) => x.n.props && has(x.n.props.style, /subHeader$/)).length, 0, name + ': not also fixed above the list');
    }
    for (const [name, [w, i]] of Object.entries(PORTRAIT)) {
      const all = render(w, i, loaded);
      const fl = all.find((x) => x.n.props && 'renderItem' in x.n.props).n;
      assert.strictEqual(fl.props.ListHeaderComponent, null, name);
      const sub = all.find((x) => x.n.props && has(x.n.props.style, /subHeader$/));
      assert.deepStrictEqual(pts(flat(sub.n.props.style)), { paddingLeft: 20, paddingRight: 20 }, name + ': gutter as before');
    }
    assert.ok(/ListHeaderComponentStyle=\{isLandscape \? \{ marginHorizontal: -space\.xl, marginTop: -spacing\.lg, marginBottom: spacing\.lg \} : undefined\}/.test(read('screens/FavouriteScreen/FavouriteList.tsx')), 'full-bleed, flush on top');
    // loading (participant section): Favourites highlighted
    const loading = render(...IPHONE_P, undefined);
    const bar = loading.find((x) => typeof x.n.type === 'function' && x.n.type.name === 'BottomNavigation');
    assert.ok(bar, 'bar while loading');
    assert.strictEqual(bar.n.props.activeTab, 'Favorites');
    const s = read('screens/FavouriteScreen/FavouriteList.tsx');
    const err = s.slice(s.indexOf('if (hasError && !loading) {'), s.indexOf('    return (\n        <SafeAreaView style={commonStyles.container} edges={isLandscape'));
    assert.ok(/\{bottomNav\}/.test(err), 'error state has the bar');
    assert.ok(/favstyle\.subHeader, subHeaderPad/.test(err) && /<View style=\{\[\{ flex: 1 \}, sidePadding\]\}>\s*<ErrorScreen/.test(err), 'error state clear of the notch');
  });

  // ── Search band ───────────────────────────────────────────────────────────
  test('search screens (rendered, search participants + add favourite): in landscape the white search band reaches the screen edges (grey notch strips before) and the field keeps clear of the notch; portrait: 20pt as before', () => {
    assert.ok(/<View style=\{\[styles\.frame, frameStyle\]\}>/.test(read('components/SearchInput.tsx')));
    for (const mod of ['screens/ResultList/SearchParticipant', 'screens/FavouriteScreen/AllParticipant']) {
      const fs_ = (win, ins) => quiet(() => screen(win, ins, () => {
        const all = walk(load(mod).default({ route: { params: { product_app_id: 1, event_name: 'E' } }, navigation: nav }));
        return pts(all.find((x) => x.n.props && x.n.props.placeholder === 'details:participant.search').n.props.frameStyle);
      }, loaded));
      assert.deepStrictEqual(fs_(...IPHONE_L), { marginLeft: -59, marginRight: -59, paddingLeft: 79, paddingRight: 79 }, mod);
      // portrait: margins 0, padding the frame's own 20 — unchanged
      assert.deepStrictEqual(fs_(...IPHONE_P), { marginLeft: -0, marginRight: -0, paddingLeft: 20, paddingRight: 20 }, mod);
    }
  });

  // ── Athlete profile (follower view) ──────────────────────────────────────
  test('athlete profile (rendered): in landscape the events list is the visible area under the header (iPhone 278, Android 226 — was 360, taller than the screen) and ends 16pt under the last card (was 90); portrait unchanged', () => {
    const render = (win, ins) => quiet(() => screen(win, ins, () => walk(load('screens/ProfileScreen/ProfileScreen').default({ route: { params: { customer_app_id: 5 } }, navigation: nav })), loaded));
    const parts = (win, ins) => {
      const all = render(win, ins);
      const pager = all.find((x) => x.n.props && typeof x.n.props.onLayout === 'function' && flat(x.n.props.style).height !== undefined);
      const scroll = all.find((x) => x.n.props && x.n.props.contentContainerStyle && flat(x.n.props.contentContainerStyle).flexGrow === 1);
      return { h: flat(pager.n.props.style).height, pad: pt(flat(scroll.n.props.contentContainerStyle).paddingBottom) };
    };
    assert.deepStrictEqual(parts(...IPHONE_L), { h: 393 - 0 - 21 - 94, pad: 16 });
    assert.deepStrictEqual(parts(...ANDROID_L), { h: 360 - 24 - 16 - 94, pad: 16 });
    assert.deepStrictEqual(parts(...IPHONE_P), { h: 852 * 0.5 - 34, pad: 90 });
  });

  test('tab pagers re-sync after a rotation (rendered: the width effect runs and scrolls to the ACTIVE tab without animation) — follower event tabs and athlete profile; they scrolled with the old page width (half of one tab + half of the next)', async () => {
    const cases = [
      ['screens/FollowerEventList/FollowerEvent', { route: { params: {} }, navigation: nav }],
      ['screens/ProfileScreen/ProfileScreen', { route: { params: { customer_app_id: 5 } }, navigation: nav }],
    ];
    for (const [mod, props] of cases) {
      for (const [win, ins] of [IPHONE_L, IPHONE_P]) {
        const prev = M.effects;
        M.effects = [];
        let tree;
        try { tree = quiet(() => screen(win, ins, () => load(mod).default(props), loaded)); } finally { var effects = M.effects; M.effects = prev; }
        const pager = walk(tree).find((x) => x.n.props && x.n.props.horizontal && x.n.props.pagingEnabled).n;
        const calls = [];
        pager.props.ref.current = { scrollToIndex: (a) => calls.push(a) };
        const widthFx = effects.filter((e) => Array.isArray(e.deps) && e.deps.length === 1 && e.deps[0] === win.width);
        assert.ok(widthFx.length >= 1, `${mod} ${win.width}: an effect on the page width`);
        widthFx.forEach((e) => e.fn());
        await new Promise((r) => setTimeout(r, 120));
        const data = pager.props.data;
        assert.ok(calls.length >= 1 && calls.every((c) => c.animated === false && c.index >= 0 && c.index < data.length), `${mod}: scrolled to a tab, no animation`);
      }
    }
  });

  // ── Membership + athlete suggestions ──────────────────────────────────────
  test('membership checkout bar (rendered): the bottom inset ONCE — the bar pads it (white to the edge), the screen no longer does (it was added twice: 34+34+20 portrait, 21+21+20 landscape); the button clear of the notch in landscape', () => {
    const bar = (win, ins) => quiet(() => screen(win, ins, () => {
      const all = walk(load('screens/ProfileScreen/MembershipPlansScreen').default({ route: { params: {} }, navigation: nav }));
      return pts(flat(all.find((x) => x.n.props && has(x.n.props.style, /ctaWrapper$/)).n.props.style));
    }, loaded));
    assert.deepStrictEqual(bar(...IPHONE_L), { paddingBottom: 21 + 20, paddingLeft: 79, paddingRight: 79 });
    assert.deepStrictEqual(bar(...IPHONE_P), { paddingBottom: 34 + 20, paddingLeft: 20, paddingRight: 20 });
    // the screen's SafeAreaView: never the bottom edge (in every orientation)
    for (const [win, ins] of [IPHONE_L, IPHONE_P, ANDROID_L]) {
      const root = quiet(() => screen(win, ins, () => load('screens/ProfileScreen/MembershipPlansScreen').default({ route: { params: {} }, navigation: nav }), loaded));
      assert.ok(!root.props.edges.includes('bottom'), JSON.stringify(root.props.edges));
    }
  });

  test('athlete suggestions (rendered): in landscape the list ends 16pt under the last name (90 of its 260pt were blank, over the keyboard); portrait 90 as before', () => {
    const Dd = load('components/AthleteSuggestionDropdown').default;
    const pad = (win, ins) => screen(win, ins, () => {
      const all = walk(Dd({ visible: true, suggestions: [{ customer_app_id: 1, name: 'A' }], loading: false, onSelect() {} }));
      return pt(flat(all.find((x) => x.n.props && x.n.props.contentContainerStyle).n.props.contentContainerStyle).paddingBottom);
    });
    assert.strictEqual(pad(...IPHONE_L), 16);
    assert.strictEqual(pad(...ANDROID_L), 16);
    assert.strictEqual(pad(...IPHONE_P), 90);
    // hooks before the early return
    const s = read('components/AthleteSuggestionDropdown.tsx');
    assert.ok(s.indexOf('useWindowDimensions()') < s.indexOf('if (!visible) return null;'));
  });
};
