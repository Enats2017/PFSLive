// Cases added 2026-10-23 (confirmation of today's changes): the parts of the
// landscape popup / sheet work that had no test yet.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

module.exports = ({ M, load, test, SRC }) => {
  const read = (rel) => fs.readFileSync(path.join(SRC, rel), 'utf8').replace(/\r/g, '');
  const walk = (n, out = []) => {
    if (!n || typeof n !== 'object') return out;
    if (Array.isArray(n)) { n.forEach((c) => walk(c, out)); return out; }
    out.push(n);
    (n.children || []).forEach((c) => walk(c, out));
    return out;
  };
  const list = (st) => (Array.isArray(st) ? st.flat(Infinity) : [st]).filter(Boolean);
  const flat = (st) => Object.assign({}, ...list(st).filter((x) => typeof x === 'object'));
  const names = (st) => list(st).map((x) => { try { return String(x); } catch (e) { return ''; } });
  const screen = (win, ins, fn, stateMap) => {
    const prev = [M.window, M.insets, M.useStateMap];
    try { M.window = win; M.insets = ins; M.useStateMap = stateMap; return fn(); } finally { [M.window, M.insets, M.useStateMap] = prev; }
  };
  const IPHONE_L = [{ width: 852, height: 393 }, { top: 0, bottom: 21, left: 59, right: 59 }];
  const IPHONE_P = [{ width: 393, height: 852 }, { top: 59, bottom: 34, left: 0, right: 0 }];
  const IPAD_L = [{ width: 1194, height: 834 }, { top: 24, bottom: 20, left: 0, right: 0 }];
  const noop = () => {};

  test('useCompactDialog (rendered): compact in every landscape window (phone, Android, tablet) — styles + reserve 16; portrait: nothing (every entry undefined), reserve 40', () => {
    const { useCompactDialog } = load('components/ui/Dialog');
    const L = [[852, 393], [800, 360], [667, 375], [1194, 834], [1366, 1024]];
    const P = [[320, 568], [393, 852], [430, 932], [834, 1194]];
    for (const [w, h] of L) {
      const cd = screen({ width: w, height: h }, IPHONE_L[1], () => useCompactDialog());
      assert.strictEqual(cd.compact, true, `${w}×${h}`);
      assert.strictEqual(cd.reserve, 16);
      assert.deepStrictEqual(cd.s.hide, { display: 'none' });
      assert.deepStrictEqual(cd.s.buttonsRow, { flexDirection: 'row', flexWrap: 'wrap' });
      assert.strictEqual(cd.s.button.width, 'auto', 'undoes a full-width button');
      assert.strictEqual(cd.s.card.maxWidth, 520);
    }
    for (const [w, h] of P) {
      const cd = screen({ width: w, height: h }, IPHONE_P[1], () => useCompactDialog());
      assert.strictEqual(cd.compact, false, `${w}×${h}`);
      assert.strictEqual(cd.reserve, 40);
      assert.deepStrictEqual(Object.values(cd.s).filter(Boolean), [], 'portrait: no style added');
    }
  });

  test('fan e-mail popup (rendered): landscape — buttons side by side; WHILE TYPING the description hides and the scroll cap gets the home-indicator inset back; portrait unchanged', () => {
    const { FanEmailModal } = load('components/Fanemailmodal');
    const typing = (x) => (x === 0 ? 209 : x);              // keyboardHeight starts at 0 → a 209pt keyboard
    const parts = (win, ins, map) => screen(win, ins, () => {
      const all = walk(FanEmailModal({ visible: true, onSave: noop, onSkip: noop }));
      const desc = all.find((n) => n.type === 'Text' && n.children.includes('home:fanEmail.description'));
      const btnRow = all.find((n) => n.props && names(n.props.style).some((s) => /notifButtonContainer$/.test(s)));
      const scroll = all.find((n) => typeof n.type === 'function' && n.type.name === 'ModalScroll');
      return {
        descHidden: names(desc.props.style).some((s) => /hideCompact$/.test(s)),
        row: names(btnRow.props.style).some((s) => /notifButtonRowCompact$/.test(s)),
        buttons: walk(btnRow).filter((n) => n.type === 'TouchableOpacity' && names(n.props.style).some((s) => /notifButtonCompact$/.test(s))).length,
        reserve: scroll.props.reserve,
      };
    }, map);
    assert.deepStrictEqual(parts(...IPHONE_L), { descHidden: false, row: true, buttons: 2, reserve: 16 });
    // typing on a landscape iPhone: 16 + 209 − 2 × 21 (the home indicator is under the keyboard)
    assert.deepStrictEqual(parts(...IPHONE_L, typing), { descHidden: true, row: true, buttons: 2, reserve: 16 + 209 - 42 });
    // Android landscape, status bar 24 > nav 16: nothing to give back (the status bar stays clear)
    assert.strictEqual(parts({ width: 800, height: 360 }, { top: 24, bottom: 16, left: 0, right: 0 }, typing).reserve, 16 + 209);
    // portrait, typing or not: as before
    assert.deepStrictEqual(parts(...IPHONE_P), { descHidden: false, row: false, buttons: 0, reserve: 40 });
    assert.deepStrictEqual(parts(...IPHONE_P, typing), { descHidden: false, row: false, buttons: 0, reserve: 40 + 209 - 2 * (59 - 59) });
  });

  test('purchase popup, processing (rendered): in landscape the hidden icon\'s spinner is replaced by a small inline one — the "processing" cue never disappears; portrait: the halo spinner only', () => {
    const P = load('components/PurchaseStatusModal').default;
    // a spinner: size 'small' | 'large' + color, no children (the stub has no ActivityIndicator type); visible =
    // no ancestor with display none
    const spinners = (win, ins) => screen(win, ins, () => {
      const out = [];
      const go = (n, hidden) => {
        if (!n || typeof n !== 'object') return;
        if (Array.isArray(n)) return n.forEach((c) => go(c, hidden));
        const h = hidden || (n.props && flat(n.props.style).display === 'none');
        if (n.props && /^(small|large)$/.test(n.props.size) && n.props.color && !(n.children || []).length) out.push(h);
        (n.children || []).forEach((c) => go(c, h));
      };
      go(P({ visible: true, status: 'processing', onClose: noop }), false);
      return { visible: out.filter((h) => !h).length, hidden: out.filter((h) => h).length };
    });
    assert.deepStrictEqual(spinners(...IPHONE_L), { visible: 1, hidden: 1 }, 'landscape: the halo (and its spinner) hidden, the inline one shown');
    assert.deepStrictEqual(spinners(...IPAD_L), { visible: 1, hidden: 1 });
    assert.deepStrictEqual(spinners(...IPHONE_P), { visible: 1, hidden: 0 }, 'portrait: only the halo spinner, as before');
    const src = read('components/PurchaseStatusModal.tsx');
    assert.ok(/\{cd\.compact && \(\s*<ActivityIndicator size="small"/.test(src), 'inline spinner only when compact');
    assert.ok(/<View style=\{\[styles\.iconHalo, cd\.s\.hide\]\}>/.test(src));
  });

  test('popups with a ✕ in the corner: in landscape (icon hidden) the first line keeps clear of the ✕ — registration, success, no membership, purchase; portrait unchanged', () => {
    const cases = [
      ['components/RegistrationModal', { status: 'membership_required', distanceName: 'Kayak Trail duo', onClose: noop }, /^membership|^registration|^Kayak/],
      ['components/SuccessCelebrationModal', { title: 'You are in!', message: 'Live tracking is on', onClose: noop }, /^You are in!$/],
      ['components/MembershipPlanModel', { actionType: 'locked', title: 'Membership needed', description: 'x', onClose: noop }, /^Membership needed$/],
    ];
    const bad = [];
    for (const [file, props, first] of cases) {
      for (const [win, ins, land] of [[...IPHONE_L, true], [...IPHONE_P, false]]) {
        screen(win, ins, () => {
          const mod = load(file);
          const C = mod.default || Object.values(mod).find((x) => typeof x === 'function');
          const texts = walk(C({ visible: true, ...props })).filter((n) => n.type === 'Text' || n.type === 'Animated.Text');
          const t = texts.find((n) => first.test(n.children.join(''))) || texts[0];
          const pad = flat(t.props.style).paddingHorizontal || 0;
          if (land ? pad < 32 : pad >= 32) bad.push(`${file} ${land ? 'landscape' : 'portrait'}: paddingHorizontal ${pad}`);
        });
      }
    }
    assert.deepStrictEqual(bad, []);
    assert.ok(/bodyCompact: \{[^}]*paddingHorizontal: 52/.test(read('components/PurchaseStatusModal.tsx')), 'purchase body clears the ✕ (right 16 + 32 wide)');
  });

  test('success popup: the confetti spans the CURRENT window width (it read Dimensions once at import — portrait width in landscape)', () => {
    const s = read('components/SuccessCelebrationModal.tsx');
    assert.ok(/const \{ width \} = useWindowDimensions\(\);/.test(s));
    assert.ok(!/Dimensions\.get\(/.test(s) && !/^\s*Dimensions,$/m.test(s));
  });

  test('password sheets (tracking password, settings): when the keyboard opens the body scrolls to the field — clamped to the overflow, so a body that fits never moves', () => {
    const { fieldScrollY } = load('utils/screenFit');
    assert.strictEqual(fieldScrollY(140, 300, 112), 132, 'landscape: field at 140 in a 112pt body → to 8pt above it');
    assert.strictEqual(fieldScrollY(140, 180, 112), 68, 'never past the end');
    assert.ok(fieldScrollY(140, 260, 400) <= 0, 'portrait: content fits → no scroll');
    for (const [f, ref, box] of [['components/TrackingPasswordModal.tsx', 'bodyRef', 'bodyBox'], ['screens/SettingScreen/UserTrackingSettings.tsx', 'sheetBodyRef', 'sheetBodyBox']]) {
      const s = read(f);
      assert.ok(new RegExp(`const y = fieldScrollY\\(inputY\\.current, ${box}\\.current\\.content, ${box}\\.current\\.box\\);\\s*if \\(y > 0\\) ${ref}\\.current\\?\\.scrollTo\\(\\{ y, animated: true \\}\\);`).test(s), f);
      assert.ok(/<View onLayout=\{\(e\) => \{ inputY\.current = e\.nativeEvent\.layout\.y; \}\}>/.test(s), f + ' field position measured');
      assert.ok(/paddingBottom: keyboardHeight > 0 && isLandscape \? 8 :/.test(s), f + ' landscape typing pad 8');
    }
  });

  test('country picker with the keyboard up in landscape: the result count and bottom padding go so a row of the list stays; tighter header / search; empty / error icons hidden; portrait unchanged', () => {
    const s = read('components/CountrySelector.tsx');
    assert.ok(/const kbCompact = cd\.compact && keyboardHeight > 0;/.test(s));
    assert.ok(/kbCompact && \{ paddingBottom: 0 \}/.test(s));
    assert.ok(/\{!loading && !fetchError && !kbCompact && \(/.test(s), 'result count hidden while typing in landscape');
    assert.ok(/<View style=\{\[styles\.modalHeader, cd\.compact && \{ paddingVertical: 8 \}\]\}>/.test(s));
    assert.ok(/<View style=\{\[styles\.searchContainer, cd\.compact && \{ marginTop: 8 \}\]\}>/.test(s));
    assert.strictEqual((s.match(/size=\{40\} color=\{palette\.inputBorder\} style=\{cd\.s\.hide\}/g) || []).length, 2, 'both 40pt icons');
    // the room: 393pt iPhone − 209 keyboard − 8 = 176; compact header 47 + search 50 + no count / pad → ≥ one 56pt row
    assert.ok(176 - (63 - 16) - (66 - 8) >= 56);
  });

  test('result e-mail sent popup (participant result screen): compact in landscape — no icon, compact card / reserve', () => {
    const s = read('screens/EventDetails/ParticipantResult.tsx');
    assert.ok(/<View style=\{\[mailStyles\.backdrop, cd\.s\.wrapper\]\}>/.test(s));
    assert.ok(/<ModalScroll contentStyle=\{\{ alignItems: 'center' \}\} style=\{cd\.s\.scroll\} reserve=\{cd\.compact \? 16 : 48\}>/.test(s));
    assert.ok(/<View style=\{\[mailStyles\.card, cd\.s\.card\]\}>/.test(s) && /<View style=\{\[mailStyles\.iconWrapper, cd\.s\.hide\]\}>/.test(s));
    // the hook runs before the screen's early returns (hooks rule)
    const body = s.slice(s.indexOf('const ParticipantResult'));
    assert.ok(body.indexOf('const cd = useCompactDialog();') < body.indexOf('return ('), 'hook before any return');
  });

  test('every popup that uses the compact hook calls it before any early return (hooks rule)', () => {
    const bad = [];
    const files = ['components/RegistrationModal.tsx', 'components/UpdateRequiredModal.tsx', 'screens/EventDetails/ConfirmRaceResultModal.tsx', 'components/MembershipPlanModel.tsx', 'components/PurchaseStatusModal.tsx'];
    for (const f of files) {
      const s = read(f);
      const hook = s.indexOf('useCompactDialog();');
      const early = s.search(/\n\s*if \([^)]*\) return null;/);
      if (hook < 0 || (early >= 0 && early < hook)) bad.push(f);
    }
    assert.deepStrictEqual(bad, []);
  });
};
