// Cases added 2026-10-23 (the four items left open by the full re-check):
// Result List on short portrait phones, search suggestions vs the keyboard,
// the Live map compass vs the panel's ⌄ button, the membership checkout bar.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

module.exports = ({ M, load, test, SRC }) => {
  const read = (rel) => fs.readFileSync(path.join(SRC, rel), 'utf8').replace(/\r/g, '');
  const walk = (n, out = [], up = []) => {
    if (!n || typeof n !== 'object') return out;
    if (Array.isArray(n)) { n.forEach((c) => walk(c, out, up)); return out; }
    out.push({ n, up });
    (n.children || []).forEach((c) => walk(c, out, up.concat(n)));
    return out;
  };
  const list = (st) => (Array.isArray(st) ? st.flat(Infinity) : [st]).filter(Boolean);
  const flat = (st) => Object.assign({}, ...list(st).filter((x) => typeof x === 'object'));
  const screen = (win, ins, fn, stateMap) => {
    const prev = [M.window, M.insets, M.useStateMap];
    try { M.window = win; M.insets = ins; M.useStateMap = stateMap; return fn(); } finally { [M.window, M.insets, M.useStateMap] = prev; }
  };
  const quiet = (fn) => { const l = console.log; console.log = () => {}; try { return fn(); } finally { console.log = l; } };
  // the harness hands screens named style tokens; spacing.xxxxl → 90
  // ('styles.spacing.xxxxl209' = spacing.xxxxl + 209)
  const pt = (v) => {
    if (typeof v === 'number') return v;
    const m = String(v).match(/^styles\.spacing\.xxxxl(\d*)$/);
    assert.ok(m, 'token ' + String(v));
    return 90 + Number(m[1] || 0);
  };
  const IPHONE_L = [{ width: 852, height: 393 }, { top: 0, bottom: 21, left: 59, right: 59 }];
  const IPHONE_P = [{ width: 393, height: 852 }, { top: 59, bottom: 34, left: 0, right: 0 }];
  const SE1 = [{ width: 320, height: 568 }, { top: 20, bottom: 0, left: 0, right: 0 }];
  const SE3 = [{ width: 375, height: 667 }, { top: 20, bottom: 0, left: 0, right: 0 }];
  const MINI = [{ width: 375, height: 812 }, { top: 50, bottom: 34, left: 0, right: 0 }];
  const nav = { navigate() {}, goBack() {}, addListener() { return () => {}; }, setOptions() {}, push() {} };
  const KB = 209;   // a keyboard is up: every useState(0) → 209 (the keyboard height state)

  // ── 1. Result List on short portrait phones ───────────────────────────────
  test('Result List (rendered, with results): on a SHORT portrait phone (SE 568 / 667) the filters + statistics scroll with the list (fixed they left ~120pt — less than one card); standard portrait (812pt+) keeps them fixed, as before', () => {
    const { filtersScrollWithList } = load('utils/screenFit');
    assert.strictEqual(filtersScrollWithList(320, 568), true);
    assert.strictEqual(filtersScrollWithList(375, 667), true);
    assert.strictEqual(filtersScrollWithList(360, 732), true, 'small Android');
    assert.strictEqual(filtersScrollWithList(375, 812), false, 'iPhone mini');
    assert.strictEqual(filtersScrollWithList(393, 852), false);
    assert.strictEqual(filtersScrollWithList(852, 393), true, 'landscape');
    const fl = (win, ins) => screen(win, ins, () => {
      const C = load('screens/ResultList/ResultList').default;
      return walk(C({ route: { params: { product_app_id: 1, product_option_value_app_id: 2, event_name: 'T', sourceTab: 'past' } }, navigation: nav }))
        .find((x) => x.n.props && 'renderItem' in x.n.props && 'ListHeaderComponent' in x.n.props).n;
    }, (x) => (x === true ? false : x === '' ? 'finished' : Array.isArray(x) && x.length === 0 ? [{ bib: '1', position: 1, name: 'A' }] : x));
    for (const [name, win] of [['SE 1', SE1], ['SE 2/3', SE3]]) {
      const l = fl(...win);
      assert.ok(l.props.ListHeaderComponent, name + ': filters in the list');
      assert.ok(String(l.props.ListHeaderComponentStyle).endsWith('listHeaderInList'), name + ': 8pt above the first card');
    }
    for (const [name, win] of [['mini', MINI], ['iPhone 15', IPHONE_P]]) assert.strictEqual(fl(...win).props.ListHeaderComponent, null, name + ': unchanged');
  });

  // ── 2. Search suggestions vs the keyboard ─────────────────────────────────
  test('suggestion lists: never taller than the room left above the keyboard (≥96pt = ~2 rows; 220 / 260 without a keyboard)', () => {
    const { dropdownRoom, DROPDOWN_MIN, searchScrollY } = load('hooks/useKeyboardHeight');
    assert.strictEqual(DROPDOWN_MIN, 96);
    assert.strictEqual(dropdownRoom(393, 0, 150, 220), 220, 'no keyboard');
    assert.strictEqual(dropdownRoom(393, KB, null, 220), 220, 'not measured yet');
    assert.strictEqual(dropdownRoom(393, KB, 60, 220), 393 - KB - 60 - 8, 'landscape: the room above the keyboard');
    assert.strictEqual(dropdownRoom(393, KB, 150, 220), 96, 'never below 2 rows');
    assert.strictEqual(dropdownRoom(852, 336, 200, 220), 220, 'portrait: room enough → the normal cap');
    assert.strictEqual(dropdownRoom(852, 336, 300, 260), 852 - 336 - 300 - 8, 'portrait, a search lower down');
    assert.strictEqual(searchScrollY(300), 292);
    assert.strictEqual(searchScrollY(4), 0);
    // rendered: the lists use it (keyboard up, list top measured at 60pt in a landscape window)
    const map = (x) => (x === 0 ? KB : x === null ? 60 : x);
    const Sd = load('components/SuggestionDropdown').default;
    const sd = screen(...IPHONE_L, () => walk(Sd({ suggestions: [{ product_app_id: 1, name: 'E', race_date: '' }], loading: false, visible: true, onSelect() {} })), map);
    assert.strictEqual(flat(sd.find((x) => x.n.props && x.n.props.nestedScrollEnabled && x.n.props.style).n.props.style).maxHeight, 393 - KB - 60 - 8);
    const Ad = load('components/AthleteSuggestionDropdown').default;
    const ad = screen(...IPHONE_L, () => walk(Ad({ suggestions: [{ customer_app_id: 1 }], loading: false, loadingMore: false, visible: true, hasMore: false, onSelect() {}, onLoadMore() {} })), map);
    assert.strictEqual(flat(ad.find((x) => x.n.props && 'renderItem' in x.n.props).n.props.style).maxHeight, 393 - KB - 60 - 8);
    // no keyboard: as before
    const sd0 = screen(...IPHONE_P, () => walk(Sd({ suggestions: [{ product_app_id: 1, name: 'E', race_date: '' }], loading: false, visible: true, onSelect() {} })));
    assert.strictEqual(flat(sd0.find((x) => x.n.props && x.n.props.nestedScrollEnabled && x.n.props.style).n.props.style).maxHeight, 220);
  });

  // render a search screen with the keyboard up, give each search section a y, focus each search
  const searchScreen = (mod, scrollMethod) => {
    const tree = quiet(() => screen(...IPHONE_L, () => load(mod).default({ route: { params: {} }, navigation: nav }), (x) => (x === true ? false : x === 0 ? KB : x)));
    const all = walk(tree);
    const scroller = all.find((x) => x.n.props && x.n.props.ref && x.n.props.keyboardShouldPersistTaps === 'handled' && x.n.props.contentContainerStyle).n;
    const calls = [];
    scroller.props.ref.current = { [scrollMethod]: (a) => calls.push(a) };
    // a FlatList's header (FollowerScreen) is a prop, not a child
    if (scroller.props.ListHeaderComponent) all.push(...walk(scroller.props.ListHeaderComponent));
    const fields = all.filter((x) => x.n.props && typeof x.n.props.onChangeText === 'function' && typeof x.n.props.placeholder === 'string');
    const focused = fields.map((f, k) => {
      // the section around the field: the nearest ancestor that measures its y
      const section = [...f.up].reverse().find((u) => u.props && typeof u.props.onLayout === 'function');
      const y = 200 + 150 * k;
      section.props.onLayout({ nativeEvent: { layout: { x: 0, y, width: 300, height: 120 } } });
      calls.length = 0;
      f.n.props.onFocus();
      f.n.props.onBlur();
      return { y, call: calls[0] };
    });
    return { pad: pt(flat(scroller.props.contentContainerStyle).paddingBottom), focused };
  };

  test('follower screen (rendered, keyboard up): EVERY search (upcoming, past, athlete — only athlete before) scrolls to its section when focused, and the list has the keyboard\'s height as extra end room', () => {
    const r = searchScreen('screens/FollowerScreen/FollowerScreen', 'scrollToOffset');
    assert.strictEqual(r.pad, 90 + KB);
    assert.strictEqual(r.focused.length, 3);
    for (const f of r.focused) assert.deepStrictEqual(f.call, { offset: f.y - 8, animated: true });
  });

  test('fan + participant screens (rendered, keyboard up): the search scrolls to the top when focused and the page has the keyboard\'s height as end room (the suggestions opened behind the keyboard)', () => {
    for (const mod of ['screens/FollowerScreen/FanScreen', 'screens/ParticipantScreen/ParticipantScreen']) {
      const r = searchScreen(mod, 'scrollTo');
      assert.strictEqual(r.pad, 90 + KB, mod);
      assert.strictEqual(r.focused.length, 1, mod);
      assert.deepStrictEqual(r.focused[0].call, { y: r.focused[0].y - 8, animated: true }, mod);
    }
  });

  test('athlete search results (rendered): with the keyboard up the end of the list can scroll above it (end room + keyboard height); without it 90 as before', () => {
    const pad = (map) => quiet(() => screen(...IPHONE_L, () => {
      const all = walk(load('screens/FollowerScreen/AthleteSearchScreen').default({ route: { params: {} }, navigation: nav }));
      return pt(flat(all.find((x) => x.n.props && 'renderItem' in x.n.props && x.n.props.contentContainerStyle).n.props.contentContainerStyle).paddingBottom);
    }, map));
    assert.strictEqual(pad((x) => (x === true ? false : x === 0 ? KB : x)), 90 + KB);
    assert.strictEqual(pad((x) => (x === true ? false : x)), 90);
  });

  // ── 3. Live map compass ──────────────────────────────────────────────────
  test('Live map: the compass is top-LEFT — on a small portrait phone the elevation panel\'s ⌄ button (right) sits 8pt from the map top, over the default top-right compass', () => {
    const s = read('components/LiveMap/LiveRouteMap.tsx');
    assert.ok(/compassEnabled=\{true\}[\s\S]{0,600}compassPosition=\{\{ top: 8, left: 8 \}\}/.test(s));
    assert.ok(/logoEnabled=\{false\}/.test(s) && /attributionEnabled=\{false\}/.test(s), 'the top-left corner is free');
    // the ⌄ button stays on the right
    assert.ok(/right: \d+/.test(read('styles/liveTracking.styles.ts').match(/collapseBtn: \{[^}]*\}/)[0]));
  });
};
