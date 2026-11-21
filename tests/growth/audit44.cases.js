// Cases added 2026-10-23 (device test, 3.28 PM screenshots): the Live map's
// participant / checkpoint popups in landscape, and the gap between the
// statistics and the first card on the Result List in landscape.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const SPACE = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 };

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
  // every node with the names of the components above it
  const walk = (n, out = [], up = []) => {
    if (!n || typeof n !== 'object') return out;
    if (Array.isArray(n)) { n.forEach((c) => walk(c, out, up)); return out; }
    const nm = typeof n.type === 'function' ? n.type.name : String(n.type);
    out.push({ n, nm, up });
    (n.children || []).forEach((c) => walk(c, out, up.concat(n)));
    return out;
  };
  const list = (st) => (Array.isArray(st) ? st.flat(Infinity) : [st]).filter(Boolean);
  const flat = (st) => Object.assign({}, ...list(st).filter((x) => typeof x === 'object'));
  const names = (st) => list(st).map((x) => { try { return String(x); } catch (e) { return ''; } });
  const screen = (win, ins, fn, stateMap) => {
    const prev = [M.window, M.insets, M.useStateMap];
    try { M.window = win; M.insets = ins; M.useStateMap = stateMap; return fn(); } finally { [M.window, M.insets, M.useStateMap] = prev; }
  };
  const LANDSCAPE = {
    'iPhone 15 landscape': [{ width: 852, height: 393 }, { top: 0, bottom: 21, left: 59, right: 59 }],
    'Android 3-button landscape': [{ width: 800, height: 360 }, { top: 24, bottom: 0, left: 32, right: 48 }],
    'Android gesture landscape': [{ width: 800, height: 360 }, { top: 24, bottom: 16, left: 32, right: 0 }],
    'iPad landscape': [{ width: 1194, height: 834 }, { top: 24, bottom: 20, left: 0, right: 0 }],
  };
  const PORTRAIT = {
    'iPhone 15 portrait': [{ width: 393, height: 852 }, { top: 59, bottom: 34, left: 0, right: 0 }],
    'Android portrait': [{ width: 360, height: 800 }, { top: 24, bottom: 48, left: 0, right: 0 }],
  };
  const nav = { navigate() {}, goBack() {}, addListener() { return () => {}; }, setOptions() {} };
  const noop = () => {};
  const station = { name: 'Ravito Nadrin', lat: 50.4, lon: 5.6, distance_km: 12.3, ele: 210, features: [], accessible_by_car: true };
  const runner = { name: 'BoWi', bib: '335', lat: 50.4, lon: 5.6, source: 'race_result', connection_status: 'online' };

  // The Live map, opened (loading done) with a popup open.
  const liveMap = (win, ins, popup) => {
    const quiet = console.log;
    console.log = (...a) => { if (!(typeof a[0] === 'string' && a[0].startsWith('🔍'))) quiet(...a); };
    try {
      return screen(win, ins, () => {
        const C = load('screens/LiveTrackingScreen').default;
        return C({ route: { params: { product_app_id: 1, product_option_value_app_id: 2, event_name: 'TRAIL', sectionType: 'follower', event_source: 'custom' } }, navigation: nav });
      }, (x) => (x === true ? false                                  // loading done
        : x && typeof x === 'object' && x.type === null && 'data' in x ? popup  // the popup open
          : x));
    } finally { console.log = quiet; }
  };

  test('Live map (rendered): in LANDSCAPE the participant / checkpoint popup covers the whole screen — the screen\'s last child, over header, selector and bottom bar, not inside the ~170pt map strip; in PORTRAIT it stays over the map, as before', () => {
    // rendered with the checkpoint popup open (the participant popup needs a live
    // marker from the poll; it shares the same mapPopups block — checked below)
    {
      const popup = { type: 'aidstation', data: station };
      const comp = 'AidStationPopup';
      for (const [name, [win, ins]] of Object.entries(LANDSCAPE)) {
        const root = liveMap(win, ins, popup);
        const all = walk(root);
        const p = all.filter((x) => x.nm === comp);
        assert.strictEqual(p.length, 1, `${name}: one ${comp}`);
        assert.strictEqual(p[0].n.props.fullScreen, true, `${name}: full screen`);
        assert.ok(!p[0].up.some((u) => u.props && typeof u.props.onLayout === 'function'), `${name}: not inside the measured map area`);
        // directly under the screen root (through the fragment), after the header and the map
        assert.ok(p[0].up.length <= 2 && p[0].up[0] === root, `${name}: at the screen's root`);
        const order = all.map((x) => x.nm);
        assert.ok(order.lastIndexOf(comp) > order.indexOf('LiveRouteMap') && order.lastIndexOf(comp) > order.indexOf('AppHeader'), `${name}: drawn last (on top)`);
      }
      for (const [name, [win, ins]] of Object.entries(PORTRAIT)) {
        const p = walk(liveMap(win, ins, popup)).filter((x) => x.nm === comp);
        assert.strictEqual(p.length, 1, `${name}: one ${comp}`);
        assert.strictEqual(p[0].n.props.fullScreen, false, name);
        assert.ok(p[0].up.some((u) => u.props && typeof u.props.onLayout === 'function'), `${name}: over the map area, unchanged`);
      }
    }
    // both popups are wired the same way, from the one mapPopups block
    const s = read('screens/LiveTrackingScreen.tsx');
    const popBlock = s.slice(s.indexOf('const mapPopups = ('), s.indexOf('    return (\n        <SafeAreaView'));
    assert.ok(/<ParticipantPopup[\s\S]*fullScreen=\{isLandscape\}[\s\S]*<AidStationPopup[\s\S]*fullScreen=\{isLandscape\}/.test(popBlock));
    assert.strictEqual((s.match(/<ParticipantPopup/g) || []).length, 1, 'rendered from one place only');
    assert.ok(/\{!isLandscape && mapPopups\}/.test(s) && /\{isLandscape && mapPopups\}\n        <\/SafeAreaView>/.test(s));
  });

  test('Live map popups (rendered): full screen — the overlay keeps the card clear of notch / status bar / home indicator, wider card with less padding, and the card gets ≥280pt of height on every landscape phone; portrait: no padding, card as before', () => {
    const { AidStationPopup } = load('components/LiveMap/AidStationPopup');
    const { ParticipantPopup } = load('components/LiveMap/ParticipantPopup');
    const render = (fullScreen) => [
      AidStationPopup({ station, onClose: noop, fullScreen }),
      ParticipantPopup({ participant: runner, onClose: noop, isRrActive: true, fullScreen }),
    ];
    const st = read('styles/liveTracking.styles.ts');
    assert.strictEqual(num(block(st, 'popupFullScreen'), 'padding'), 16);
    assert.strictEqual(num(block(st, 'popupFullScreen'), 'maxWidth'), 520);
    assert.ok(/maxHeight: '90%'/.test(block(st, 'popup')), 'card capped at 90% of the overlay, body scrolls');
    for (const [name, [win, ins]] of Object.entries(LANDSCAPE)) {
      for (const el of screen(win, ins, () => render(true))) {
        assert.ok(names(el.props.style).some((s) => /popupOverlay$/.test(s)));
        const pad = flat(el.props.style);
        assert.deepStrictEqual([pad.paddingTop, pad.paddingBottom, pad.paddingLeft, pad.paddingRight], [ins.top, ins.bottom, ins.left, ins.right], name);
        const card = walk(el).find((x) => names(x.n.props && x.n.props.style).some((s) => /\.popup$/.test(s)));
        assert.ok(names(card.n.props.style).some((s) => /popupFullScreen$/.test(s)), name + ': compact card');
        const cardMax = 0.9 * (win.height - ins.top - ins.bottom);
        assert.ok(cardMax >= 280, `${name}: ${cardMax}pt for the card`);
      }
    }
    for (const [name, [win, ins]] of Object.entries(PORTRAIT)) {
      for (const el of screen(win, ins, () => render(false))) {
        assert.deepStrictEqual(Object.keys(flat(el.props.style)), [], name + ': no padding added');
        const card = walk(el).find((x) => names(x.n.props && x.n.props.style).some((s) => /\.popup$/.test(s)));
        assert.ok(!names(card.n.props.style).some((s) => /popupFullScreen$/.test(s)), name);
      }
    }
  });

  // The Result List, loaded, race finished, one result.
  const resultList = (win, ins) => screen(win, ins, () => {
    const C = load('screens/ResultList/ResultList').default;
    const all = walk(C({ route: { params: { product_app_id: 1, product_option_value_app_id: 2, event_name: 'TRAIL', sourceTab: 'past' } }, navigation: nav }));
    return all.find((x) => x.n.props && 'renderItem' in x.n.props && 'ListHeaderComponent' in x.n.props).n;
  }, (x) => (x === true ? false : x === '' ? 'finished' : Array.isArray(x) && x.length === 0 ? [{ bib: '335', position: 1, name: 'BoWi' }] : x));

  test('Result List (rendered): in LANDSCAPE the statistics keep the same 8pt gap above the first card as portrait (they sat flush on it), and the filters sit flush under the header as in portrait', () => {
    const st = read('styles/ResultList.styles.ts');
    const listTop = num(block(st, 'list'), 'paddingTop');
    assert.strictEqual(listTop, 8);
    const gapOf = (fl) => {
      const header = names(fl.props.ListHeaderComponentStyle);
      const cc = names(fl.props.contentContainerStyle);
      const top = cc.some((s) => /listWithHeader$/.test(s)) ? num(block(st, 'listWithHeader'), 'paddingTop') : listTop;
      const below = header.some((s) => /listHeaderInList$/.test(s)) ? num(block(st, 'listHeaderInList'), 'marginBottom') : 0;
      return fl.props.ListHeaderComponent ? { aboveFilters: top, statsToCard: below } : { aboveFilters: 0, statsToCard: top };
    };
    for (const [name, [win, ins]] of Object.entries(PORTRAIT)) {
      assert.deepStrictEqual(gapOf(resultList(win, ins)), { aboveFilters: 0, statsToCard: 8 }, name + ' (unchanged)');
    }
    for (const [name, [win, ins]] of Object.entries(LANDSCAPE)) {
      const fl = resultList(win, ins);
      assert.ok(fl.props.ListHeaderComponent, name + ': filters + statistics scroll with the list');
      assert.deepStrictEqual(gapOf(fl), { aboveFilters: 0, statsToCard: 8 }, name + ': same as portrait');
    }
    // the cards' own gap is untouched
    assert.strictEqual(num(block(st, 'card'), 'marginBottom'), 12);
  });
};
