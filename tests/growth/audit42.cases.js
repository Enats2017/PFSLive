// Cases added 2026-10-23 (device tests):
//  1. Training sessions (own profile): Delete / Edit / View stay at the
//     bottom-right of every card on every width — from 400pt, in landscape and
//     on tablets they used to sit beside the name, centred.
//  2. Every popup of the app in landscape and portrait (see below).
const assert = require('assert');

module.exports = ({ M, load, test }) => {
  const walk = (n, out = []) => {
    if (!n || typeof n !== 'object') return out;
    if (Array.isArray(n)) { n.forEach((c) => walk(c, out)); return out; }
    out.push(n);
    (n.children || []).forEach((c) => walk(c, out));
    return out;
  };
  const flat = (st) => Object.assign({}, ...(Array.isArray(st) ? st.flat(Infinity) : [st]).filter((x) => x && typeof x === 'object'));
  const withWindow = (win, fn) => {
    const prev = M.window;
    try { M.window = win; return fn(); } finally { M.window = prev; }
  };

  test('training sessions: Delete / Edit / View on their own row at the bottom-right of every own card — 320pt to tablet, portrait and landscape', () => {
    const { EventCard } = load('screens/ProfileScreen/EventCardLive');
    const item = (custom) => ({ id: 1, name: 'Tranning sessions week most public free events', race_date_formatted: '23 October 2026', race_time: '12:14',
      event_source: custom ? 'custom' : 'official', can_delete: custom ? 1 : 0, race_status: 'not_started', product_option_value_app_id: 2 });
    const bad = [];
    for (const win of [{ width: 320, height: 568 }, { width: 393, height: 852 }, { width: 430, height: 932 }, { width: 852, height: 393 }, { width: 1024, height: 768 }, { width: 834, height: 1194 }]) {
      for (const custom of [true, false]) {
        withWindow(win, () => {
          const card = EventCard({ item: item(custom), isOwnProfile: true, onDelete() {} });
          const root = flat(card.props.style);
          const row = card.children.filter((c) => c && typeof c === 'object')[1];
          const rs = flat(row.props.style);
          const buttons = walk(row).filter((n) => n.type === 'TouchableOpacity').length;
          const tag = `${win.width}×${win.height} ${custom ? 'custom' : 'official'}`;
          if (root.flexDirection !== 'column' || root.alignItems !== 'stretch') bad.push(`${tag}: buttons beside the name`);
          if (rs.flexDirection !== 'row' || rs.justifyContent !== 'flex-end') bad.push(`${tag}: buttons not right-aligned`);
          if (buttons !== (custom ? 3 : 2)) bad.push(`${tag}: ${buttons} buttons`);
        });
      }
    }
    assert.deepStrictEqual(bad, []);
  });

  // ── every popup, rendered, landscape and portrait ──────────────────────
  // Device test 2026-10-23 (event Distance screen): the Undo registration card
  // showed its 90pt icon in landscape and its buttons were cut off. Each popup
  // is rendered with its component tree expanded; an "icon section" is a plate
  // ≥ 56×56 or an icon glyph ≥ 36pt. Landscape: none visible, and buttons that
  // share a container sit in a row. Portrait: the icon is there (unchanged).
  const deep = (n, hidden = false, out = { nodes: [] }, parent = null) => {
    if (!n || typeof n !== 'object') return out;
    if (Array.isArray(n)) { n.forEach((c) => deep(c, hidden, out, parent)); return out; }
    if (typeof n.type === 'function') {
      let r = null;
      try { r = n.type({ ...n.props, children: n.children && n.children.length ? n.children : n.props.children }); } catch (e) { r = null; }
      return deep(r, hidden || flat(n.props.style).display === 'none', out, parent);
    }
    const st = flat(n.props && n.props.style);
    const names = (Array.isArray(n.props && n.props.style) ? n.props.style.flat(Infinity) : [n.props && n.props.style])
      .filter(Boolean).map((x) => { try { return String(x); } catch (e) { return ''; } });
    const h = hidden || st.display === 'none' || names.some((x) => /hideCompact$/.test(x));
    out.nodes.push({ n, st, names, hidden: h, parent });
    (n.children || []).forEach((c) => deep(c, h, out, n));
    if (n.props && n.props.children && !(n.children || []).length) deep(n.props.children, h, out, n);
    return out;
  };
  const noop = () => {};
  const POPUPS = {
    'Undo registration': ['components/UndoConfirmModal', { distanceName: 'Kayak Trail duo', onConfirm: noop, onClose: noop }],
    'Error (with retry)': ['components/ErrorModal', { messageKey: 'common:errors.network', onClose: noop, onRetry: noop }],
    'Delete event': ['components/DeleteEventModal', { event: { name: 'Training session' }, isDeleting: false, onCancel: noop, onConfirm: noop }],
    'No membership': ['components/MembershipPlanModel', { actionType: 'locked', title: 'Membership needed', description: 'Upgrade to track', confirmLabel: 'View plans', showConfirm: true, onClose: noop, onConfirm: noop }],
    'Success': ['components/SuccessCelebrationModal', { title: 'You are in!', message: 'Live tracking is on', onClose: noop }],
    'Feedback sent': ['components/FeedbackSuccessModal', { onClose: noop }],
    'Update required': ['components/UpdateRequiredModal', { isForced: false, currentVersion: '1.0', latestVersion: '1.1', title: 'Update', message: 'New version', onUpdate: noop, onLater: noop }],
    'Device transfer': ['components/DeviceTransferModal', { email: 'a@example.invalid', onConfirm: noop, onClose: noop }],
    'E-mail change': ['components/EmailChangeConfirmModal', { newEmail: 'a@example.invalid', onConfirm: noop, onClose: noop }],
    'Is this you?': ['screens/EventDetails/ConfirmRaceResultModal', { data: { bib_number: '12', firstname: 'Ann', lastname: 'Runner', dob: '1990-01-01', gender: 'F', city: 'Gent', country: 'BE', nation: 'BEL', distance_name: '21 km', email: 'a@example.invalid' }, distanceName: '21 km', registerLoading: false, onConfirm: noop, onClose: noop }],
  };
  for (const s of ['registered', 'membership_required', 'limit_reached', 'membership_upcoming', 'unavailable', 'available', 'connect_confirm']) {
    POPUPS[`Registration (${s})`] = ['components/RegistrationModal', { status: s, distanceName: 'Kayak Trail duo', membershipLimit: 3, membershipStartDate: '2026-11-01', onClose: noop, onConfirm: noop }];
  }
  for (const s of ['processing', 'success', 'error']) {
    POPUPS[`Purchase (${s})`] = ['components/PurchaseStatusModal', { status: s, errorMessage: 'Payment failed', onClose: noop }];
  }
  const render = (file, props, win) => withWindow(win, () => {
    const mod = load(file);
    const C = mod.default || Object.values(mod).find((x) => typeof x === 'function');
    return deep(C({ visible: true, ...props }));
  });
  const iconSections = (r) => r.nodes.filter(({ n, st }) =>
    (typeof st.width === 'number' && typeof st.height === 'number' && st.width >= 56 && st.height >= 56 && st.borderRadius)
    || (typeof n.type === 'string' && /Icon|Ionicons/.test(n.type) && (n.props.size || 0) >= 36));
  const buttonParents = (r) => {
    const by = new Map();
    for (const x of r.nodes) {
      if (x.hidden || x.n.type !== 'TouchableOpacity' || !x.names.some((nm) => /(primary|secondary|outline)Button$/.test(nm))) continue;
      by.set(x.parent, (by.get(x.parent) || 0) + 1);
    }
    return [...by].filter(([, c]) => c >= 2).map(([p]) => flat(p && p.props && p.props.style));
  };
  global.__DEV__ = false;

  test('every app popup in LANDSCAPE (phone, Android 360dp, tablet): no icon section, buttons side by side — 22 popups / states incl. registration, no membership, success, error, undo', () => {
    const bad = [];
    for (const [name, [file, props]] of Object.entries(POPUPS)) {
      for (const win of [{ width: 852, height: 393 }, { width: 800, height: 360 }, { width: 1194, height: 834 }]) {
        const r = render(file, props, win);
        if (!r.nodes.length) { bad.push(`${name} ${win.width}: nothing rendered`); continue; }
        const shown = iconSections(r).filter((x) => !x.hidden);
        if (shown.length) bad.push(`${name} ${win.width}×${win.height}: ${shown.length} icon section(s) shown`);
        const stacked = buttonParents(r).filter((st) => st.flexDirection !== 'row');
        if (stacked.length) bad.push(`${name} ${win.width}×${win.height}: buttons stacked`);
      }
    }
    assert.deepStrictEqual(bad, []);
  });

  test('every app popup in PORTRAIT (320pt, 393pt, tablet): the icon section is there, as before', () => {
    const bad = [];
    for (const [name, [file, props]] of Object.entries(POPUPS)) {
      for (const win of [{ width: 320, height: 568 }, { width: 393, height: 852 }, { width: 834, height: 1194 }]) {
        const r = render(file, props, win);
        if (!iconSections(r).some((x) => !x.hidden)) bad.push(`${name} ${win.width}×${win.height}: no icon`);
      }
    }
    assert.deepStrictEqual(bad, []);
  });

  test('every centred popup caps its height to the screen and scrolls (ModalScroll), with the compact reserve in landscape', () => {
    const bad = [];
    for (const [name, [file, props]] of Object.entries(POPUPS)) {
      if (/Is this you/.test(name)) continue;                     // a bottom sheet: its own cap + footer (audit35)
      const r = withWindow({ width: 852, height: 393 }, () => {
        const mod = load(file);
        const C = mod.default || Object.values(mod).find((x) => typeof x === 'function');
        const out = [];
        const find = (n) => {
          if (!n || typeof n !== 'object') return;
          if (Array.isArray(n)) return n.forEach(find);
          if (typeof n.type === 'function' && n.type.name === 'ModalScroll') out.push(n.props);
          if (typeof n.type === 'function' && n.type.name === 'Dialog') { try { find(n.type(n.props)); } catch (e) { /* */ } }
          (n.children || []).forEach(find);
        };
        find(C({ visible: true, ...props }));
        return out;
      });
      if (!r.length) bad.push(`${name}: no ModalScroll`);
      else if (r.some((p) => p.reserve !== 16)) bad.push(`${name}: reserve ${r.map((p) => p.reserve)}`);
    }
    assert.deepStrictEqual(bad, []);
  });
};
