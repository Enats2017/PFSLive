// UI orientation audit 2026-11-26, group 2 — every new / changed piece of UI in
// the fix batch (diff c8b1901..fix/app-audit-2026-11-26) for the auth screens,
// event details (This is me / distances), personal events, profile,
// membership plans, tracking settings, App.tsx and AppNavigator.
//
//   node tests/ui_orientation/group2.test.js
//
// Reuses the growth harness (tests/growth/harness.js): the REAL screens and
// popups are rendered (called) with a stand-in React, on iPhone 15, Android
// 360dp (3-button), iPad, iPhone SE (320pt) and Pro Max, portrait AND
// landscape. Text is measured with the app's own fonts (scripts/text-width.cjs)
// in en / fr / nl at 100% and 135%. A check that can only read the source is
// named "(textual)".
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const H = require('../growth/harness');
const { M, load, run, textOf, SRC } = H;
// UI_DEBUG=1 prints the stack of a test that throws (the harness prints the message only)
const test = (name, fn) => H.test(name, process.env.UI_DEBUG ? async () => { try { await fn(); } catch (e) { console.log(e.stack); throw e; } } : fn);
const { textWidth } = require('../../scripts/text-width.cjs');

const read = (rel) => fs.readFileSync(path.join(SRC, rel), 'utf8').replace(/\r/g, '');
const readRoot = (rel) => fs.readFileSync(path.resolve(__dirname, '../..', rel), 'utf8').replace(/\r/g, '');

// ── real translations (the harness t() returns the key) ───────────────────
const I18N = (() => {
  const idx = read('i18n/index.ts');
  const identFolder = {};
  for (const m of idx.matchAll(/import\s+(\w+)\s+from\s+['"]\.\/([^'"]+)\/(en|fr|nl)\.json['"]/g)) identFolder[m[1]] = [m[2], m[3]];
  const out = { en: {}, fr: {}, nl: {} };
  for (const m of idx.matchAll(/(\w+)\s*:\s*(\w+)/g)) {
    const f = identFolder[m[2]];
    if (f) out[f[1]][m[1]] = JSON.parse(read(`i18n/${f[0]}/${f[1]}.json`));
  }
  return out;
})();
let LANG = 'en';
const tr = (key, params, lang = LANG) => {
  const [ns, rest] = key.includes(':') ? key.split(/:(.*)/s) : ['common', key];
  let v = (rest || '').split('.').reduce((o, k) => (o == null ? o : o[k]), I18N[lang][ns]);
  if (params && params.returnObjects && v && typeof v === 'object') return v;
  if (typeof v !== 'string') return params && params.defaultValue !== undefined ? params.defaultValue : key;
  return v.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, p) => (params && params[p] !== undefined ? String(params[p]) : ''));
};

// ── extra mocks on top of the harness ─────────────────────────────────────
const harnessRN = require('react-native');          // the harness stand-in
const ReactStub = require('react');
const X = {                                          // per-test controllable state
  alerts: [], goBacks: 0, deferAnim: false, animCbs: [], setterCalls: [],
  stateFor: null,                                    // (index, initial) => value
  membership: null, form: null,
};
let stateIdx = 0;
const React2 = Object.assign({}, ReactStub, {
  useState: (v) => {
    const i = stateIdx++;
    const x = typeof v === 'function' ? v() : v;
    const val = X.stateFor ? X.stateFor(i, x) : (M.useStateMap ? M.useStateMap(x) : x);
    return [val, (nv) => { X.setterCalls.push([i, nv]); }];
  },
});
React2.default = React2;
const render = (C, props) => { stateIdx = 0; return C(props); };
const anim = () => ({ start(cb) { if (X.deferAnim) X.animCbs.push(cb); else if (cb) cb({ finished: true }); }, stop() {}, reset() {} });
const RN = Object.create(harnessRN, Object.getOwnPropertyDescriptors({
  ScrollView: 'ScrollView', KeyboardAvoidingView: 'KeyboardAvoidingView', ActivityIndicator: 'ActivityIndicator',
  TextInput: 'TextInput', FlatList: 'FlatList', Image: 'Image', Switch: 'Switch', RefreshControl: 'RefreshControl',
  Alert: { alert: (...a) => { X.alerts.push(a); } },
  Keyboard: { dismiss() {}, addListener: () => ({ remove() {} }) },
  Linking: { openURL: async () => {}, openSettings: async () => {}, addEventListener: () => ({ remove() {} }) },
  AppState: { addEventListener: () => ({ remove() {} }), currentState: 'active' },
  PixelRatio: { getFontScale: () => 1, get: () => 3 },
  I18nManager: { isRTL: false },
}));
Object.defineProperty(RN, 'Animated', { get() { return Object.assign({}, harnessRN.Animated, { timing: anim, spring: anim, sequence: anim, parallel: anim, subtract: (a) => a }); } });
const storeHook = (state) => { const h = (sel) => (sel ? sel(state) : state); h.getState = () => state; h.setState = () => {}; h.subscribe = () => () => {}; return h; };
const storeState = new Proxy({ currentLanguage: 'en', language: 'en' }, { get: (tg, p) => (p in tg ? tg[p] : () => {}) });
const extra = {
  react: React2,
  'react-native': RN,
  'react-i18next': { useTranslation: () => ({ t: (k, p) => tr(k, p), i18n: { language: LANG, changeLanguage: async () => {} } }) },
  '@react-navigation/native': new Proxy({
    useNavigation: () => ({ navigate: () => {}, goBack: () => { X.goBacks++; }, canGoBack: () => true, reset: () => {}, setParams: () => {}, addListener: () => () => {} }),
    useRoute: () => ({ params: { product_app_id: 5, product_option_value_app_id: 7, event_name: 'Trail des Fagnes' } }),
    useFocusEffect: () => {},
    useIsFocused: () => true,
  }, { get: (tg, p) => (p in tg ? tg[p] : () => {}) }),
  '@expo/vector-icons': new Proxy({}, { get: (tg, p) => (p === '__esModule' ? true : String(p)) }),
};
const relExtra = {
  'i18n': { __esModule: true, default: { t: (k, p) => tr(k, p), language: 'en' }, getCurrentLanguageId: () => 1, getLanguageCodeFromId: () => 'en' },
  'hooks/useMembershipplans': () => X.membership,
  'hooks/usePersonalEventForm': () => X.form,
};
const origLoad = Module._load;
Module._load = function (request, parent) {
  if (extra[request]) return extra[request];
  if (request.startsWith('.') && parent && parent.filename) {
    const abs = path.resolve(path.dirname(parent.filename), request).replace(/\\/g, '/');
    const rel = abs.startsWith(SRC + '/') ? abs.slice(SRC.length + 1) : null;
    if (rel && /^store\//.test(rel)) return new Proxy({}, { get: (tg, p) => (p === '__esModule' ? true : storeHook(storeState)) });
    if (rel && relExtra[rel]) {
      const v = relExtra[rel];
      if (typeof v === 'function') return { __esModule: true, ...membershipModuleExtras(rel), [rel === 'hooks/useMembershipplans' ? 'useMembershipPlans' : 'usePersonalEventForm']: v, default: v };
      return v;
    }
  }
  return origLoad.apply(this, arguments);
};
function membershipModuleExtras(rel) {
  return rel === 'hooks/useMembershipplans'
    ? { PLAN_IDS: ['lite', 'basic', 'pro'], PURCHASE_UNCONFIRMED: '__unconfirmed__', PURCHASE_OTHER_ACCOUNT: '__other_account__' }
    : {};
}

// ── screens ──────────────────────────────────────────────────────────────
const SCREENS = {
  'iPhone 15 portrait': [{ width: 393, height: 852 }, { top: 59, bottom: 34, left: 0, right: 0 }, 'ios'],
  'iPhone 15 landscape': [{ width: 852, height: 393 }, { top: 0, bottom: 21, left: 59, right: 59 }, 'ios'],
  'Android 360dp portrait': [{ width: 360, height: 800 }, { top: 24, bottom: 0, left: 0, right: 0 }, 'android'],
  'Android 360dp landscape': [{ width: 800, height: 360 }, { top: 24, bottom: 0, left: 0, right: 48 }, 'android'],
  'iPad portrait': [{ width: 834, height: 1194 }, { top: 24, bottom: 20, left: 0, right: 0 }, 'ios'],
  'iPad landscape': [{ width: 1194, height: 834 }, { top: 24, bottom: 20, left: 0, right: 0 }, 'ios'],
  'iPhone SE (320) portrait': [{ width: 320, height: 568 }, { top: 20, bottom: 0, left: 0, right: 0 }, 'ios'],
  'iPhone SE (320) landscape': [{ width: 568, height: 320 }, { top: 0, bottom: 0, left: 0, right: 0 }, 'ios'],
  'iPhone Pro Max portrait': [{ width: 430, height: 932 }, { top: 59, bottom: 34, left: 0, right: 0 }, 'ios'],
  'iPhone Pro Max landscape': [{ width: 932, height: 430 }, { top: 0, bottom: 21, left: 59, right: 59 }, 'ios'],
};
const isLand = (w) => w.width > w.height;
const onScreen = (name, fn) => {
  const [win, ins, os] = SCREENS[name];
  const prev = [M.window, M.insets, M.os, global.__DEV__];
  try { M.window = win; M.insets = ins; M.os = os; global.__DEV__ = false; return fn(win, ins, os); }
  finally { [M.window, M.insets, M.os, global.__DEV__] = prev; }
};
const REQUIRED = ['iPhone 15 portrait', 'iPhone 15 landscape', 'Android 360dp portrait', 'Android 360dp landscape', 'iPad portrait', 'iPad landscape'];
assert.ok(REQUIRED.every((s) => SCREENS[s]));

// ── tree helpers ─────────────────────────────────────────────────────────
const walk = (n, out = [], parents = []) => {
  if (!n || typeof n !== 'object') return out;
  if (Array.isArray(n)) { n.forEach((c) => walk(c, out, parents)); return out; }
  out.push({ n, parents });
  (n.children || []).forEach((c) => walk(c, out, [...parents, n]));
  if (n.props && n.props.children && !n.children.length) walk(n.props.children, out, [...parents, n]);
  return out;
};
const flat = (st) => (Array.isArray(st) ? st.flat(Infinity) : [st]).filter((x) => x && typeof x === 'object' && !(typeof x === 'function'));
const styleOf = (n) => Object.assign({}, ...flat(n.props && n.props.style).filter((x) => typeof x !== 'function' && !String(x).startsWith('styles')).map((x) => ({ ...x })));
const styleNames = (n) => (Array.isArray(n.props.style) ? n.props.style.flat(Infinity) : [n.props.style]).filter(Boolean).map((x) => { try { return String(x); } catch (e) { return ''; } });
// `space.xl + n` with common.styles stubbed reads "styles.space.xl" + n: the token's value + n
const SPACE_TOKENS = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 };
const px = (v) => {
  if (typeof v === 'number') return v;
  const m = String(v).match(/^styles\.space\.(\w+?)(-?[\d.]+)?$/);
  return m ? SPACE_TOKENS[m[1]] + Number(m[2] || 0) : NaN;
};
const fnName = (n) => (typeof n.type === 'function' ? n.type.name || n.type.displayName || '' : '');
const findText = (tree, s) => walk(tree).filter(({ n }) => n.type === 'Text' && textOf(n).includes(s));

// ── measuring ────────────────────────────────────────────────────────────
const lines = (t, W, font, size) => {
  let n = 0;
  for (const para of String(t).split('\n')) {
    n++; let cur = '';
    for (const w of para.split(/\s+/).filter(Boolean)) {
      const nx = cur ? cur + ' ' + w : w;
      if (textWidth(nx, font, size) <= W) cur = nx; else { n++; cur = w; }
    }
  }
  return n;
};
const longestWord = (t, font, size) => Math.max(...String(t).split(/\s+/).filter(Boolean).map((w) => textWidth(w, font, size)));
const LANGS = ['en', 'fr', 'nl'];
const SCALES = [1, 1.35];

// Shared popup check: rendered Modal → orientations, ModalScroll cap, icon hidden
// in landscape, card clear of the side insets, message never line-limited.
function checkPopup(modalEl, label, win, ins, bad, { iconName, messageText }) {
  const all = walk(modalEl);
  const modal = all.find(({ n }) => n.type === 'Modal');
  if (!modal) { bad.push(`${label}: no Modal`); return; }
  const so = modal.n.props.supportedOrientations || [];
  if (!(so.includes('portrait') && so.includes('landscape-left') && so.includes('landscape-right'))) bad.push(`${label}: supportedOrientations ${JSON.stringify(so)}`);
  const ms = all.find(({ n }) => fnName(n) === 'ModalScroll');
  if (!ms) { bad.push(`${label}: no ModalScroll — a tall card cannot scroll`); return; }
  const sv = render(ms.n.type, ms.n.props);
  const sst = Object.assign({}, ...flat(sv.props.style));
  const reserve = ms.n.props.reserve === undefined ? 40 : ms.n.props.reserve;
  const cap = win.height - 2 * Math.max(ins.top, ins.bottom) - reserve;
  if (!(sst.maxHeight > 0 && sst.maxHeight <= win.height - 2 * Math.max(ins.top, ins.bottom))) bad.push(`${label}: scroll cap ${sst.maxHeight} vs window ${win.height}`);
  if (Math.abs(sst.maxHeight - Math.max(120, cap)) > 0.01) bad.push(`${label}: cap ${sst.maxHeight} ≠ ${cap}`);
  // card centred, at most maxWidth wide: its edge must clear the camera / nav bar
  const maxW = sst.maxWidth || 400;
  const cardW = Math.min(maxW, win.width - 40);
  const margin = (win.width - cardW) / 2;
  if (margin < Math.max(ins.left, ins.right)) bad.push(`${label}: card ${margin}pt from the edge, inset ${Math.max(ins.left, ins.right)}`);
  // the icon: hidden in landscape (compact), shown in portrait
  if (iconName) {
    const icon = all.find(({ n }) => n.type === iconName || (n.props && n.props.name === iconName));
    const holder = icon && icon.parents[icon.parents.length - 1];
    const hidden = holder && (styleOf(holder).display === 'none');
    if (isLand(win) !== !!hidden) bad.push(`${label}: icon ${hidden ? 'hidden' : 'shown'} in ${isLand(win) ? 'landscape' : 'portrait'}`);
  }
  if (messageText) {
    const tx = findText(modalEl, messageText);
    if (!tx.length) bad.push(`${label}: message not rendered`);
    for (const { n, parents } of tx) {
      if (n.props.numberOfLines) bad.push(`${label}: message limited to ${n.props.numberOfLines} lines`);
      if (!parents.some((p) => fnName(p) === 'ModalScroll')) bad.push(`${label}: message outside the scroll box`);
    }
  }
}

(async () => {
  // ═════════ MembershipPlansScreen ═════════
  const plan = (id, action) => ({ tier: id, product_id: 'p_' + id, action, name: id });
  const membershipState = (over) => ({
    plansData: { entitlement: { has_membership: false, source: null, status: 'none', sessions_remaining: 0 } },
    loadingPlans: false, plansError: null,
    planByTier: { lite: plan('lite', 'subscribe'), basic: plan('basic', 'subscribe'), pro: plan('pro', 'subscribe') },
    singlePlan: { product_id: 'act', action: 'subscribe' }, visibleTiers: ['lite', 'basic', 'pro'],
    storeProducts: [], loadingPrices: false, defaultSelectedTier: 'basic', refetchPlans() {},
    requestPurchase: async () => {}, purchaseLoading: false, purchaseResult: null, purchaseError: null, resetPurchase() {},
    restorePurchases() {}, restoreLoading: false, restoreResult: null, restoreError: null, resetRestore() {},
    purchaseButtonLoading: false, unconfirmedPayment: false, retryUnconfirmed() {}, paymentPending: false,
    purchasePendingApproval: false, resetPendingApproval() {},
    ...over,
  });
  const renderPlans = (over) => {
    X.membership = membershipState(over);
    const mod = load('screens/ProfileScreen/MembershipPlansScreen');
    return render(mod.default, {});
  };
  const PLAN_STYLES = read('styles/membershipPlans.styles.ts');

  test('membership "Apple received your payment" banner (rendered, 10 screens × en/fr/nl × 100/135%): wraps in a shrinking column beside the icon, never line-limited, clear of the notch, "Check again now" a 44pt target', () => {
    const banner = PLAN_STYLES.match(/\n\s*infoBanner: ?\{([^}]*)\}/)[1];
    const bannerText = PLAN_STYLES.match(/\n\s*infoBannerText: ?\{([^}]*)\}/)[1];
    assert.ok(/flexDirection: 'row'/.test(banner) && /\.\.\.type\.small/.test(bannerText) && /flex: 1/.test(bannerText), 'banner row, 13pt text that takes the rest');
    const bad = [];
    for (const lang of LANGS) {
      LANG = lang;
      for (const name of Object.keys(SCREENS)) onScreen(name, (win, ins) => {
        const tree = renderPlans({ unconfirmedPayment: true });
        const msg = tr('membership:unconfirmed.banner'), retry = tr('membership:unconfirmed.retry');
        const [txt] = findText(tree, msg);
        const [rt] = findText(tree, retry);
        if (!txt || !rt) { bad.push(`${lang} ${name}: banner not rendered`); return; }
        if (txt.n.props.numberOfLines || rt.n.props.numberOfLines) bad.push(`${lang} ${name}: banner text line-limited`);
        const col = txt.parents[txt.parents.length - 1];
        const cs = styleOf(col);
        if (!(cs.flex === 1 && cs.minWidth === 0)) bad.push(`${lang} ${name}: text column ${JSON.stringify(cs)} (needs flex 1 + minWidth 0)`);
        const touch = rt.parents[rt.parents.length - 1];
        const hs = touch.props.hitSlop || {};
        if (19 + (hs.top || 0) + (hs.bottom || 0) < 44 || Math.ceil(19 * 1.35) + (hs.top || 0) + (hs.bottom || 0) < 44) bad.push(`${lang} ${name}: retry target < 44pt`);   // type.small lineHeight 19
        if (styleOf(touch).alignSelf !== 'flex-start') bad.push(`${lang} ${name}: retry spans the whole width`);
        const sv = txt.parents.find((p) => p.type === 'ScrollView');
        if (!sv) { bad.push(`${lang} ${name}: banner not in the scroll`); return; }
        const cc = Object.assign({}, ...flat(sv.props.contentContainerStyle).filter((x) => !String(x).startsWith('styles')));
        const side = isLand(win) && ins.bottom > 0 ? Math.max(ins.left, ins.right) : 0;
        cc.paddingLeft = px(cc.paddingLeft); cc.paddingRight = px(cc.paddingRight);
        if (!(cc.paddingLeft >= 20 + (isLand(win) && ins.bottom > 0 ? ins.left : 0)) || !(cc.paddingRight >= 20 + (isLand(win) && ins.bottom > 0 ? ins.right : 0))) bad.push(`${lang} ${name}: gutter ${cc.paddingLeft}/${cc.paddingRight} vs notch ${side}`);
        // Android 3-button landscape: SafeAreaView pads the sides (edges left/right)
        const inner = win.width - cc.paddingLeft - cc.paddingRight - (isLand(win) && ins.bottom === 0 ? ins.left + ins.right : 0) - 2 * 12 - 16 - 8;
        for (const s of SCALES) {
          if (longestWord(msg, 'fonts.body', 13 * s) > inner) bad.push(`${lang} ${name} ×${s}: a word is wider than the banner`);
          if (longestWord(retry, 'fonts.body', 13 * s) > inner) bad.push(`${lang} ${name} ×${s}: retry word cut`);
        }
      });
    }
    LANG = 'en';
    assert.deepStrictEqual(bad, []);
  });

  test('membership "payment pending" info banner + activation buy button (rendered, 10 screens): the pending copy replaces "no membership", the button dims whenever it cannot buy and is pressable except while busy', () => {
    const bad = [];
    for (const lang of LANGS) {
      LANG = lang;
      for (const name of Object.keys(SCREENS)) onScreen(name, (win) => {
        const variants = [
          [{}, null], [{ paymentPending: true }, 'pending'], [{ unconfirmedPayment: true }, 'unconfirmed'],
          [{ purchaseButtonLoading: true }, 'busy'], [{ purchaseLoading: true }, 'busy'],
          [{ singlePlan: { product_id: 'act', action: 'hidden' } }, 'action'],   // not sold to this account
        ];
        for (const [over, block] of variants) {
          const tree = renderPlans(over);
          const all = walk(tree);
          if (over.paymentPending) {
            const p = findText(tree, tr('membership:infoBanner.paymentPending'));
            if (!p.length || p[0].n.props.numberOfLines) bad.push(`${lang} ${name}: pending banner missing / cut`);
          }
          const buy = all.find(({ n }) => n.props && n.props.onPress && textOf(n).includes(tr('membership:activation.buy')));
          if (!buy) { bad.push(`${lang} ${name}: no activation button`); continue; }
          const st = styleOf(buy.n);
          const dim = st.opacity === 0.5;
          if (dim !== (block !== null)) bad.push(`${lang} ${name} ${JSON.stringify(over)}: dimmed=${dim}`);
          if (!!buy.n.props.disabled !== (block === 'busy')) bad.push(`${lang} ${name} ${JSON.stringify(over)}: disabled=${buy.n.props.disabled}`);
          if (buy.n.props.accessibilityState.disabled !== (block !== null)) bad.push(`${lang} ${name}: a11y state`);
          // the CTA bar sits outside the scroll and pads the notch / home indicator itself
          const cta = all.find(({ n }) => fnName(n) === 'Button' || (n.props && n.props.label && n.props.iconPosition));
          const bar = cta && cta.parents[cta.parents.length - 1];
          if (!bar || bar.type === 'ScrollView' || cta.parents.some((p) => p.type === 'ScrollView')) bad.push(`${lang} ${name}: Continue inside the scroll`);
          else {
            const bs = styleOf(bar);
            const ins = M.insets;
            if (bs.paddingBottom < ins.bottom + 20) bad.push(`${lang} ${name}: CTA under the home indicator`);
            if (isLand(win) && ins.bottom > 0 && !(px(bs.paddingLeft) >= 20 + ins.left && px(bs.paddingRight) >= 20 + ins.right)) bad.push(`${lang} ${name}: CTA under the notch`);
          }
          // the restore link is not live during a purchase
          const restore = all.find(({ n }) => n.props && n.props.onPress && textOf(n).includes(tr('membership:restorePurchases')));
          if (restore && (!!restore.n.props.disabled) !== !!(over.purchaseLoading || over.purchaseButtonLoading)) bad.push(`${lang} ${name}: restore disabled=${restore.n.props.disabled}`);
        }
      });
    }
    LANG = 'en';
    assert.deepStrictEqual(bad, []);
  });

  test('membership purchase error popup with "Apple received your payment…" / "another account" (rendered PurchaseStatusModal, 10 screens × en/fr/nl): every orientation, scrolls when taller than the screen, icon hidden in landscape, message whole', () => {
    const bad = [];
    for (const lang of LANGS) {
      LANG = lang;
      for (const name of Object.keys(SCREENS)) onScreen(name, (win, ins) => {
        for (const [code, key] of [['__unconfirmed__', 'membership:purchase.unconfirmedBody'], ['__other_account__', 'membership:purchase.otherAccountBody']]) {
          const tree = renderPlans({ purchaseError: code });
          const ps = walk(tree).find(({ n }) => fnName(n) === 'PurchaseStatusModal');
          if (!ps) { bad.push(`${name}: no PurchaseStatusModal`); continue; }
          if (ps.n.props.errorMessage !== tr(key)) bad.push(`${lang} ${name}: ${code} shows "${ps.n.props.errorMessage}"`);
          const el = render(ps.n.type, ps.n.props);
          checkPopup(el, `${lang} ${name} ${code}`, win, ins, bad, { iconName: 'close-circle', messageText: tr(key) });
        }
      });
    }
    LANG = 'en';
    assert.deepStrictEqual(bad, []);
  });

  test('membership restore / pending-approval / unconfirmed / payment-pending answers are native Alerts — full text in every orientation (textual: Alert is drawn by the OS)', () => {
    const s = read('screens/ProfileScreen/MembershipPlansScreen.tsx');
    for (const k of ['pendingApproval', 'restorePending', 'restoreOtherAccount', 'restoreError', 'unconfirmed', 'paymentPending']) {
      assert.ok(new RegExp(`Alert\\.alert\\(\\s*t\\('membership:${k}\\.title'\\),\\s*t\\('membership:${k}\\.message'\\)`).test(s), k);
      for (const l of LANGS) assert.ok(tr(`membership:${k}.title`, null, l) !== `membership:${k}.title` && tr(`membership:${k}.message`, null, l) !== `membership:${k}.message`, `${k} ${l}`);
    }
  });

  // ═════════ ParticipantResult: membership popup + error popups ═════════
  test('"This is me" membership answers (rendered RegistrationModal: membership_required / limit_reached / membership_upcoming, iOS + Android, 10 screens × en/fr/nl): every orientation, scrolls, icon hidden in landscape, buttons share a row only in compact', () => {
    X.stateFor = (i, x) => (x === true ? false : x);   // `loading` is the only true initial: past the spinner
    const pr = render(load('screens/EventDetails/ParticipantResult').default, {});
    X.stateFor = null;
    const wire = walk(pr).find(({ n }) => fnName(n) === 'RegistrationModal');
    assert.ok(wire, 'ParticipantResult renders the membership popup');
    assert.strictEqual(wire.n.props.visible, false, 'closed until an answer');
    assert.strictEqual(wire.n.props.distanceName, 'Trail des Fagnes');
    const RegistrationModal = load('components/RegistrationModal').default;
    const bad = [];
    for (const lang of LANGS) {
      LANG = lang;
      for (const name of Object.keys(SCREENS)) onScreen(name, (win, ins) => {
        for (const status of ['membership_required', 'limit_reached', 'membership_upcoming']) {
          const el = render(RegistrationModal, { ...wire.n.props, visible: true, status, membershipLimit: 3, membershipStartDate: '2026-12-01' });
          checkPopup(el, `${lang} ${name} ${status}`, win, ins, bad, {});
          const all = walk(el);
          const title = tr(`details:registrationModal.${status}.title`);
          const t = findText(el, title);
          if (!t.length) bad.push(`${lang} ${name} ${status}: title missing`);
          else if (t[0].n.props.numberOfLines) bad.push(`${lang} ${name} ${status}: title cut`);
          const btns = all.filter(({ n }) => n.props && typeof n.props.onPress === 'function' && n.type !== 'Modal' && textOf(n).trim() && !/✕/.test(textOf(n)));
          for (const b of btns) {
            const st = styleOf(b.n);
            if (isLand(win) && btns.length > 1 && st.flexBasis !== 160) bad.push(`${lang} ${name} ${status}: compact button not half-row`);
          }
        }
      });
    }
    LANG = 'en';
    assert.deepStrictEqual(bad, []);
  });

  test('error popups from the batch (rendered ErrorModal: "Still being processed" with Retry, This is me registration / network / already-registered, personal-event validation): every orientation, scrolls, icon hidden in landscape, Retry + Close side by side only in compact, no word wider than the card', () => {
    const ErrorModal = load('components/ErrorModal').default;
    const CASES = [
      ['details:error.inProgressTitle', 'details:error.inProgressMessage', true],
      ['participantResult:error.registrationFailedTitle', 'participantResult:error.registrationFailedMessage', false],
      ['participantResult:error.networkErrorTitle', 'participantResult:error.networkErrorMessage', false],
      ['participantResult:error.alreadyRegisteredTitle', 'participantResult:error.alreadyRegisteredMessage', false],
      ['personal:errors.validationErrorTitle', 'personal:errors.validationErrorMessage', false],
    ];
    const bad = [];
    for (const lang of LANGS) {
      LANG = lang;
      for (const name of Object.keys(SCREENS)) onScreen(name, (win, ins) => {
        for (const [tk, mk, retry] of CASES) {
          if (tr(mk) === mk || tr(tk) === tk) { bad.push(`${lang}: ${mk} missing`); continue; }
          const el = render(ErrorModal, { visible: true, titleKey: tk, messageKey: mk, onClose() {}, onRetry: retry ? () => {} : undefined });
          checkPopup(el, `${lang} ${name} ${mk}`, win, ins, bad, { iconName: 'alert-circle', messageText: tr(mk) });
          const btns = walk(el).filter(({ n }) => n.type === 'TouchableOpacity' && textOf(n).trim());
          if (btns.length !== (retry ? 2 : 1)) bad.push(`${lang} ${name} ${mk}: ${btns.length} buttons`);
          for (const b of btns) if ((styleOf(b.n).flexBasis === 160) !== isLand(win)) bad.push(`${lang} ${name} ${mk}: button layout`);
          const cardInner = Math.min(isLand(win) ? 520 : 400, win.width - 40) - 2 * (isLand(win) ? 20 : 24);
          for (const s of SCALES) if (longestWord(tr(mk), 'fonts.body', 15 * s) > cardInner) bad.push(`${lang} ${name} ×${s}: word wider than the card`);
        }
      });
    }
    LANG = 'en';
    assert.deepStrictEqual(bad, []);
  });

  test('This is me: closing a call-error popup keeps the screen (rendered ParticipantResult ErrorModal onClose, every orientation) — only the missing-params popup leaves', () => {
    for (const name of REQUIRED) onScreen(name, () => {
      X.goBacks = 0;
      X.stateFor = (i, x) => (x === true ? false : x);
      const pr = render(load('screens/EventDetails/ParticipantResult').default, {});
      X.stateFor = null;
      const em = walk(pr).find(({ n }) => fnName(n) === 'ErrorModal');
      assert.ok(em, name);
      em.n.props.onClose();
      assert.strictEqual(X.goBacks, 0, name + ': went back');
    });
    assert.ok(/showErrorModal\(\s*'participantResult:error\.missingParamsTitle',\s*'participantResult:error\.missingParamsMessage',\s*true/.test(read('screens/EventDetails/ParticipantResult.tsx')), 'missing params leaves (textual)');
  });

  // ═════════ DistanceTab silent refresh ═════════
  test('distances: the return-to-foreground refresh is silent — no spinner, no error screen over the list, open popups stay mounted (textual: AppState inside useFocusEffect)', () => {
    const s = read('screens/EventDetails/DistanceTab.tsx');
    assert.ok(/AppState\.addEventListener\('change', \(state\) => \{\s*if \(state === 'active'\) void fetchDistances\(true, true\);/.test(s));
    assert.ok(/if \(!silent\) \{\s*setLoading\(true\);\s*clearError\(\);\s*\}/.test(s), 'no spinner / error reset');
    assert.ok(/if \(!silent\) handleApiError\(err\);/.test(s) && /if \(!silent\) setLoading\(false\);/.test(s));
    assert.ok(!/onRefresh\?\.\(\)/.test(s), 'no remount of the tab (popups survive)');
  });

  // ═════════ Profile: tracked training card ═════════
  test('profile training card being tracked (rendered TrainingContent → EventCard, 10 screens): no Delete / Edit, the eye button alone at the bottom-right; untracked cards keep all three', () => {
    const { EventCard } = load('screens/ProfileScreen/EventCardLive');
    const TC = load('screens/ProfileScreen/TrainingContent').default;
    const item = (id) => ({ id: 1, participant_app_id: id, product_option_value_app_id: 2, name: 'Morning run along the Meuse valley', event_source: 'custom', can_delete: 1, race_status: 'live', race_date_formatted: '2026-11-26', race_time: '08:00:00', is_edit: 1 });
    const bad = [];
    for (const name of Object.keys(SCREENS)) onScreen(name, () => {
      const tc = render(TC, { liveEvents: [item(11), item(12)], events: [item(11), item(12)], loadingMoreLive: false, onLoadMoreLive() {}, pagination: { live: { page: 1, total_pages: 1 } }, profile: { is_own_profile: 1 }, onDeleteEvent() {}, trackedParticipantId: '11' });
      const fl = walk(tc).find(({ n }) => n.type === 'FlatList' && n.props.renderItem);
      if (!fl) { bad.push(name + ': no list'); return; }
      for (const [id, tracked] of [[11, true], [12, false]]) {
        const cardEl = fl.n.props.renderItem({ item: item(id), index: 0 });
        if (cardEl.props.isTrackedNow !== tracked) bad.push(`${name}: card ${id} isTrackedNow=${cardEl.props.isTrackedNow}`);
        const card = render(EventCard, cardEl.props);
        const icons = walk(card).filter(({ n }) => n.props && /trash-outline|pencil-outline|eye-outline/.test(n.props.name || '')).map(({ n }) => n.props.name);
        const want = tracked ? ['eye-outline'] : ['trash-outline', 'pencil-outline', 'eye-outline'];
        if (JSON.stringify(icons) !== JSON.stringify(want)) bad.push(`${name}: card ${id} icons ${icons}`);
        const eye = walk(card).find(({ n }) => n.props && n.props.name === 'eye-outline');
        const row = eye.parents[eye.parents.length - 2];
        const rs = styleOf(row);
        if (rs.flexDirection !== 'row' || rs.justifyContent !== 'flex-end') bad.push(`${name}: buttons not bottom-right`);
        const title = findText(card, 'Morning run');
        if (!title.length || title[0].n.props.numberOfLines) bad.push(`${name}: event name cut`);
      }
    });
    assert.deepStrictEqual(bad, []);
  });

  // ═════════ Tracking settings sheet ═════════
  test('tracking settings password sheet (rendered, 10 screens): every orientation, ✕ / backdrop / back all dismiss-and-revert, the sheet clears the camera / nav bar in landscape, capped to the screen and scrolls', () => {
    const bad = [];
    for (const name of Object.keys(SCREENS)) onScreen(name, (win, ins) => {
      X.stateFor = (i, x) => (i === 4 ? true /* modalVisible */ : i === 5 ? false /* isLoading */ : x);
      try {
        const el = render(load('screens/SettingScreen/UserTrackingSettings').UserTrackingSettings, {});
        const all = walk(el);
        const modal = all.find(({ n }) => n.type === 'Modal');
        if (!modal) { bad.push(name + ': no sheet'); return; }
        const so = modal.n.props.supportedOrientations || [];
        if (!so.includes('landscape-left') || !so.includes('landscape-right')) bad.push(name + ': orientations');
        const backdrop = all.find(({ n }) => n.type === 'TouchableOpacity' && n.props.activeOpacity === 1);
        const close = all.find(({ n }) => n.type === 'TouchableOpacity' && textOf(n) === '✕');
        const fns = [modal.n.props.onRequestClose, backdrop && backdrop.n.props.onPress, close && close.n.props.onPress];
        if (!fns.every((f) => f && f === fns[0])) bad.push(name + ': not every close path is the same dismiss');
        const sheet = close.parents[close.parents.length - 1];
        const st = styleOf(sheet);
        const side = isLand(win) ? { l: ins.left, r: ins.right } : { l: 0, r: 0 };
        if (px(st.paddingLeft) !== 24 + side.l || px(st.paddingRight) !== 24 + side.r) bad.push(`${name}: sheet sides ${st.paddingLeft}/${st.paddingRight}`);
        if (st.maxHeight !== win.height - ins.top - 8) bad.push(`${name}: sheet cap ${st.maxHeight}`);
        if (st.paddingBottom < ins.bottom) bad.push(`${name}: under the home indicator`);
        if (!walk(sheet).some(({ n }) => n.type === 'ScrollView')) bad.push(`${name}: sheet body does not scroll`);
        if (styleOf(close.n).right !== 14 + side.r) bad.push(`${name}: ✕ under the camera`);
      } finally { X.stateFor = null; }
    });
    assert.deepStrictEqual(bad, []);
  });

  test('tracking settings: dismissing reverts the tab at once but the sheet\'s own password / error only after the 280ms slide-out (rendered, setter order) — the sheet no longer jumps while it moves', () => {
    for (const name of REQUIRED) onScreen(name, () => {
      X.stateFor = (i, x) => (i === 4 ? true : i === 5 ? false : i === 1 ? 'private' : i === 2 ? 'abc' : x);   // 0 keyboardHeight, 1 visibility, 2 password, 3 passwordError, 4 modalVisible, 5 isLoading
      X.deferAnim = true; X.animCbs = []; X.setterCalls = [];
      try {
        const el = render(load('screens/SettingScreen/UserTrackingSettings').UserTrackingSettings, {});
        const modal = walk(el).find(({ n }) => n.type === 'Modal');
        X.setterCalls = [];
        modal.n.props.onRequestClose();
        // useState order in the screen: 0 keyboardHeight, 1 visibility, 2 password, 3 passwordError? → read it
        const idx = (src) => src;   // indices asserted by value below
        assert.deepStrictEqual(X.setterCalls.map(([, v]) => v), ['public'], name + ': during the slide only the tab moves');
        X.animCbs.forEach((cb) => cb({ finished: true }));
        assert.deepStrictEqual(X.setterCalls.map(([, v]) => v).slice(1), [false, '', ''], name + ': after the slide: hidden, then password + error reset');
        void idx;
      } finally { X.stateFor = null; X.deferAnim = false; }
    });
  });

  // ═════════ Auth + profile messages ═════════
  const TOAST = readRoot('utils/toastConfig.tsx');
  const toastLines = { title: Number(TOAST.match(/const TITLE_LINES = (\d+);/)[1]), body: Number(TOAST.match(/const BODY_LINES = (\d+);/)[1]) };
  assert.ok(/numberOfLines=\{TITLE_LINES\}/.test(TOAST) && /numberOfLines=\{BODY_LINES\}/.test(TOAST), 'the caps are the ones the toast uses');
  // toast inner text width: min(85%, W − 2·side − 16) − padding 16+16 − border 2 − icon 22 − gap 8
  const toastInner = (W, side) => Math.min(W * 0.85, W - 2 * side - 16) - 32 - 2 - 22 - 8;
  const fitsToast = (title, body, W, side, s) =>
    lines(title, toastInner(W, side), 'Inter_500Medium', 14 * s) <= toastLines.title
    && (!body || lines(body, toastInner(W, side), 'Inter_500Medium', 12 * s) <= toastLines.body);

  test('new / changed auth + profile messages are never cut: each either fits its toast (1 title line, 2 message lines, measured at 320-932pt portrait + landscape, en/fr/nl, 100/135%) or is an Alert (textual source check + measurement)', () => {
    const login = read('screens/AuthScreens/LoginScreen.tsx');
    const otp = read('screens/AuthScreens/OTPVerificationScreen.tsx');
    const edit = read('screens/AuthScreens/EditProfileScreen.tsx');
    const own = read('screens/ProfileScreen/OwnProfile.tsx');
    const editPe = read('screens/PersonalEventScreen/EditPersonalEvent.tsx');
    // [title key, message key, how the source shows it]
    const MSGS = [
      ['login:errors.emailNotVerifiedTitle', 'login:errors.emailNotVerifiedResume', /Alert\.alert\(t\('login:errors\.emailNotVerifiedTitle'\), t\('login:errors\.emailNotVerifiedResume'\)\)/.test(login) ? 'alert' : 'toast'],
      ['login:errors.emailNotVerifiedTitle', 'login:errors.emailNotVerified', /Alert\.alert\(t\('login:errors\.emailNotVerifiedTitle'\), t\('login:errors\.emailNotVerified'\)\)/.test(login) ? 'alert' : 'toast'],
      ['otp:errors.tokenInvalidTitle', 'otp:errors.tokenInvalidMaybeVerified', /key === 'tokenInvalidMaybeVerified'\) \{\s*Alert\.alert/.test(otp) ? 'alert' : 'toast'],
      ...['save_no_connection', 'save_picture_rejected', 'save_generic'].map((k) => ['profile:errors.save_failed_title', `profile:errors.${k}`, /Alert\.alert\(t\('profile:errors\.save_failed_title'\), t\(`profile:errors\.\$\{key\}`\)\)/.test(edit) ? 'alert' : 'toast']),
      ['errorScreen:codes.session_expired.title', 'errorScreen:codes.session_expired.message', /toastError\(t\('errorScreen:codes\.session_expired\.title'\)/.test(edit) ? 'toast' : 'alert'],
      ['ownProfile:deleteEvent.deleteFailed', 'ownProfile:deleteEvent.trackingNowError', (own.match(/Alert\.alert\(t\('ownProfile:deleteEvent\.deleteFailed'\), t\('ownProfile:deleteEvent\.trackingNowError'\)\)/g) || []).length === 2 && !/toastError\(t\('ownProfile:deleteEvent\.trackingNowError'\)\)/.test(own) ? 'alert' : 'toast-title'],
      // (trackingStartedError: an older one-line toast title, also cut — left as is, pinned by growth audit50; see the report)
      ['personal:errors.validationErrorTitle', 'personal:errors.updateFailed', /hasNoMappedField\(response\.fields\)\) \{[^}]*toastError\(t\('personal:errors\.validationErrorTitle'\), t\('personal:errors\.updateFailed'\)\)/.test(editPe) ? 'toast' : 'missing'],
    ];
    const bad = [];
    for (const [tk, mk, how] of MSGS) {
      for (const lang of LANGS) {
        const title = tr(tk, null, lang), body = tr(mk, null, lang);
        if (title === tk || body === mk) { bad.push(`${lang}: ${mk} missing`); continue; }
        if (how === 'alert') continue;                 // native Alert: wraps and scrolls on its own
        for (const name of Object.keys(SCREENS)) {
          const [win, ins] = SCREENS[name];
          for (const s of SCALES) {
            const ok = how === 'toast-title' ? lines(body, toastInner(win.width, Math.max(ins.left, ins.right)), 'Inter_500Medium', 14 * s) <= toastLines.title
              : fitsToast(title, body, win.width, Math.max(ins.left, ins.right), s);
            if (!ok) bad.push(`${mk} ${lang} ${name} ×${s}: cut in its ${how}`);
          }
        }
      }
    }
    assert.deepStrictEqual(bad, []);
    assert.ok(/import \{[^}]*Alert[^}]*\} from 'react-native'|\n\s*Alert,\n/.test(login) && /\n\s*Alert,\n/.test(otp) && /\bAlert\b[^\n]*\} from 'react-native'/.test(own));
  });

  test('OTP screen: the new "code no longer usable / maybe already verified" inline error (rendered, 10 screens × en/fr/nl) wraps whole, inside the scroll + keyboard-avoiding view, clear of the notch', () => {
    const bad = [];
    for (const lang of LANGS) {
      LANG = lang;
      const msg = tr('otp:errors.tokenInvalidMaybeVerified');
      for (const name of Object.keys(SCREENS)) onScreen(name, (win, ins) => {
        M.useStateMap = (x) => (x === '' ? msg : x);
        try {
          const el = render(load('screens/AuthScreens/OTPVerificationScreen').default, { navigation: { navigate() {}, goBack() {}, reset() {} }, route: { params: { email: 'a@b.cd', verification_token: 'tok', purpose: 'registration' } } });
          const [hit] = findText(el, msg);
          if (!hit) { bad.push(`${lang} ${name}: not rendered`); return; }
          if (hit.n.props.numberOfLines) bad.push(`${lang} ${name}: cut`);
          const kinds = hit.parents.map((p) => p.type);
          if (!kinds.includes('ScrollView') || !kinds.includes('KeyboardAvoidingView')) bad.push(`${lang} ${name}: not in scroll + KAV`);
          const need = isLand(win) && ins.bottom > 0 ? ins.left : 0;
          const padL = Math.max(0, ...hit.parents.map((p) => styleOf(p).paddingLeft || 0));
          if (padL < need) bad.push(`${lang} ${name}: under the notch (${padL} < ${need})`);
        } finally { M.useStateMap = null; }
      });
    }
    LANG = 'en';
    assert.deepStrictEqual(bad, []);
  });

  // ═════════ Personal events ═════════
  test('create personal event: the new time-zone field error (rendered, 10 screens × en/fr/nl) is a full-width line under the time row — not squeezed beside the ✕ — inside the scroll + keyboard-avoiding view with the notch padding', () => {
    const bad = [];
    for (const lang of LANGS) {
      LANG = lang;
      const msg = tr('personal:errors.timezoneInvalid');
      for (const name of Object.keys(SCREENS)) onScreen(name, (win, ins) => {
        X.form = { formData: { name: 'x', selectedEventType: null, selectedCategory: null, date: '2026-12-01', startTime: '08:00' }, errors: { startTime: msg },
          handlers: new Proxy({}, { get: () => () => {} }), setFieldError() {}, clearAllErrors() {}, validateForm: () => true, resetForm() {} };
        const el = render(load('screens/PersonalEventScreen/CreatePersonalEvent').default, { navigation: { navigate() {}, goBack() {}, addListener: () => () => {} }, route: { params: {} } });
        const [hit] = findText(el, msg);
        if (!hit) { bad.push(`${lang} ${name}: not rendered`); return; }
        if (hit.n.props.numberOfLines) bad.push(`${lang} ${name}: cut`);
        const parent = hit.parents[hit.parents.length - 1];
        if (styleOf(parent).flexDirection === 'row') bad.push(`${lang} ${name}: inside the row`);
        const kinds = hit.parents.map((p) => p.type);
        if (!kinds.includes('ScrollView') || !kinds.includes('KeyboardAvoidingView')) bad.push(`${lang} ${name}: not in scroll + KAV`);
        const need = isLand(win) && ins.bottom > 0 ? ins.left : 0;
        const padL = Math.max(0, ...hit.parents.map((p) => styleOf(p).paddingLeft || 0));
        if (padL < need) bad.push(`${lang} ${name}: under the notch`);
      });
    }
    LANG = 'en';
    X.form = null;
    assert.deepStrictEqual(bad, []);
    for (const l of LANGS) assert.notStrictEqual(tr('personal:errors.timezoneInvalid', null, l), 'personal:errors.timezoneInvalid', l);
  });

  test('personal events: unmapped validation codes reach a popup (create: ErrorModal, rendered above) / a toast that fits (edit); the restored draft fills the same fields — no new layout (textual)', () => {
    const c = read('screens/PersonalEventScreen/CreatePersonalEvent.tsx');
    assert.ok(/!hasNoMappedField\(response\.fields\)\) \{\s*applyApiFieldErrors\(response\.fields\);\s*\} else \{\s*showErrorModal\('personal:errors\.validationErrorTitle', 'personal:errors\.validationErrorMessage'\)/.test(c));
    assert.ok(/<ErrorModal\s+visible=\{errorModalVisible\}/.test(c));
    assert.ok(/handlers\.handleNameChange\(draft\.name\)/.test(c) && /setSelectedFile\(\{ uri: draft\.file\.uri/.test(c));
  });

  // ═════════ App.tsx / AppNavigator ═════════
  test('App.tsx / AppNavigator: the batch adds no UI (share de-dupe, navigator-ready wait, Apple recovery, logout clears the pending Connect) — the toast host is unchanged (textual)', () => {
    const app = readRoot('App.tsx');
    assert.ok(/isRepeatLink\(`gpx:\$\{uri\}`\)/.test(app) && /whenNavigatorReady\(\(\) => \{/.test(app));
    assert.ok(/<Toast\s+config=\{toastConfig\}/.test(app));
    const nav = read('navigation/AppNavigator.tsx');
    assert.ok(/useAppleRecovery\(isLoggedIn\);/.test(nav));
    assert.ok(!/Alert\.alert|<Modal/.test(read('hooks/useAppleRecovery.ts')), 'the recovery hook shows nothing');
  });

  // ═════════ Every toast in the app ═════════
  // Every toast call in src/ (toastSuccess / toastError / toastInfo / toastWarning,
  // and the OTP screens' own wrappers), with its i18n keys read from the call:
  // a plain t('…'), each side of a ternary, and t(`prefix.${x}`) as every string
  // under that prefix. Arguments that are not translations (a server message,
  // a validation result) are listed in TOAST_DYNAMIC so a new one is noticed.
  const TOAST_FNS = /\b(toastSuccess|toastError|toastInfo|toastWarning|showErrorToast|showError)\(/g;
  const TOAST_DYNAMIC = [
    'screens/AuthScreens/ForgotPasswordScreen/OtpStep.tsx t(titleKey)',     // the wrapper itself (its callers are scanned)
    'screens/AuthScreens/ForgotPasswordScreen/OtpStep.tsx t(msgKey)',
    'screens/AuthScreens/LoginScreen.tsx firstError',                     // a validation message (field errors, short)
    'screens/HomeScreen.tsx message',
    "screens/PersonalEventScreen/CreatePersonalEvent.tsx response.message || t('personal:success.message')",
    'screens/PersonalEventScreen/CreatePersonalEvent.tsx message',
    "screens/PersonalEventScreen/EditPersonalEvent.tsx err.message === 'API_ERROR' ? t('personal:errors.updateFailed') : err.message",
  ];
  const scanToasts = () => {
    const files = [];
    (function w(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) w(p); else if (/\.tsx?$/.test(f) && !/\.test\./.test(f)) files.push(p); } })(SRC);
    const split = (b) => { const a = []; let d = 0, c = ''; for (const ch of b) { if ('([{'.includes(ch)) d++; if (')]}'.includes(ch)) d--; if (ch === ',' && d === 0) { a.push(c); c = ''; } else c += ch; } if (c.trim()) a.push(c); return a.map((x) => x.trim()); };
    const leaves = (prefix) => {
      const [ns, r] = prefix.split(/:(.*)/s);
      const o = r.replace(/\.$/, '').split('.').filter(Boolean).reduce((x, k) => (x == null ? x : x[k]), I18N.en[ns]);
      const out = []; (function w(v, k) { if (typeof v === 'string') out.push(k); else if (v && typeof v === 'object') for (const kk in v) w(v[kk], k + '.' + kk); })(o, prefix.replace(/\.$/, ''));
      return out;
    };
    const pairs = [], dynamic = [];
    for (const p of files) {
      const s = fs.readFileSync(p, 'utf8').replace(/\r/g, '');
      const rel = path.relative(SRC, p).replace(/\\/g, '/');
      const nsm = s.match(/useTranslation\(\s*\[?\s*['"](\w+)['"]/);
      const q = (k) => (k.includes(':') ? k : (nsm ? nsm[1] : 'common') + ':' + k);
      let m; TOAST_FNS.lastIndex = 0;
      while ((m = TOAST_FNS.exec(s))) {
        const lineStart = s.lastIndexOf('\n', m.index) + 1;
        if (/\/\/|^\s*\*/.test(s.slice(lineStart, m.index))) continue;                 // a comment
        if (/(const|function)\s+$/.test(s.slice(Math.max(0, m.index - 20), m.index))) continue;   // a definition
        let i = m.index + m[0].length, d = 1;
        while (d && i < s.length) { if (s[i] === '(') d++; else if (s[i] === ')') d--; i++; }
        const args = split(s.slice(m.index + m[0].length, i - 1).replace(/\s+/g, ' '));
        const keys = args.slice(0, 2).map((a) => {
          const ks = [...a.matchAll(/\bt\(\s*['"]([^'"]+)['"]/g)].map((x) => q(x[1]));
          if (m[1] === 'showError' && /^['"][\w.:]+['"]$/.test(a)) ks.push(q(a.slice(1, -1)));   // OtpStep's wrapper takes the keys
          const tpl = a.match(/\bt\(\s*`([^`$]+)\$\{/);
          if (tpl) ks.push(...leaves(q(tpl[1])));
          if (!ks.length || /\|\||: err\./.test(a)) dynamic.push(`${rel} ${a}`);
          return ks;
        });
        pairs.push({ at: `${rel}:${s.slice(0, m.index).split('\n').length}`, titles: keys[0] || [], bodies: keys[1] || [] });
      }
    }
    return { pairs, dynamic };
  };

  test('every toast in the app (rendered toast, all en/fr/nl strings of every toast call in src): title and message within the toast\'s line caps — iPhone 15 / Android 360dp / iPad / 320pt / Pro Max, portrait + landscape, ×1 and ×1.35; the toast stays inside the screen, clear of the notch, and keeps its pill shape for one line', () => {
    const { pairs, dynamic } = scanToasts();
    assert.ok(pairs.length > 80, `found ${pairs.length} toast calls`);
    assert.deepStrictEqual([...new Set(dynamic)].sort(), [...TOAST_DYNAMIC].sort(), 'toast arguments that are not translations');
    const topOffset = Number(readRoot('App.tsx').match(/<Toast[\s\S]*?topOffset=\{(\d+)\}/)[1]);
    const { toastConfig } = load('../utils/toastConfig');
    const bad = [], missing = new Set();
    for (const name of Object.keys(SCREENS)) onScreen(name, (win, ins) => {
      const el = toastConfig.error({ text1: 'T', text2: 'B' });
      const tree = render(el.type, el.props);
      const all = walk(tree);
      const box = all.find(({ n }) => n.props && n.props.style && flat(n.props.style).some((x) => x.maxWidth !== undefined));
      const bs = Object.assign({}, ...flat(box.n.props.style));
      const [t1, t2] = all.filter(({ n }) => n.type === 'Text').map(({ n }) => ({ lines: n.props.numberOfLines, size: Object.assign({}, ...flat(n.props.style)).fontSize }));
      if (tree.props.pointerEvents !== 'none') bad.push(name + ': toast takes taps');
      const side = (win.width - bs.maxWidth) / 2;
      if (side < Math.max(ins.left, ins.right)) bad.push(`${name}: toast under the camera / nav bar (${side} < ${Math.max(ins.left, ins.right)})`);
      const oneLine = 2 * bs.paddingVertical + 2 * bs.borderWidth + Math.ceil(t1.size * 1.2);
      if (bs.borderRadius > oneLine / 2 + 1 || bs.borderRadius < oneLine / 2 - 4) bad.push(`${name}: radius ${bs.borderRadius} vs one-line height ${oneLine}`);
      const inner = bs.maxWidth - 2 * bs.paddingHorizontal - 2 * bs.borderWidth - 22 - 8;   // icon 22 + gap 8
      for (const lng of LANGS) for (const s of SCALES) for (const pr of pairs) {
        const titles = pr.titles.map((k) => tr(k, null, lng));
        const bodies = pr.bodies.map((k) => tr(k, null, lng));
        [...pr.titles, ...pr.bodies].forEach((k, i) => { if ([...titles, ...bodies][i] === k) missing.add(`${k} (${lng})`); });
        const tl = Math.max(0, ...titles.map((x) => lines(x, inner, 'Inter_500Medium', t1.size * s)));
        const bl = Math.max(0, ...bodies.map((x) => lines(x, inner, 'Inter_500Medium', t2.size * s)));
        if (tl > t1.lines) bad.push(`${pr.at} ${lng} ${name} ×${s}: title ${tl} lines > ${t1.lines}`);
        if (bl > t2.lines) bad.push(`${pr.at} ${lng} ${name} ×${s}: message ${bl} lines > ${t2.lines}`);
        const h = 2 * bs.paddingVertical + 2 * bs.borderWidth + tl * Math.ceil(t1.size * s * 1.2) + (bl ? 2 + bl * Math.ceil(t2.size * s * 1.2) : 0);
        if (topOffset + h > win.height - ins.bottom - 8) bad.push(`${pr.at} ${lng} ${name} ×${s}: toast ${h}pt runs off the screen`);
      }
      if (topOffset < ins.top) bad.push(`${name}: toast under the status bar / island`);
    });
    assert.deepStrictEqual([...missing], [], 'toast keys with no text');
    assert.deepStrictEqual([...new Set(bad)], []);
  });

  const r = await run('ui orientation — group 2');
  console.log(`\nUI ORIENTATION GROUP 2 TOTAL: ${r.pass} passed, ${r.fail} failed`);
  process.exit(r.fail ? 1 : 0);
})();
