// Cases added 2026-10-29 for the developer's four reports on growth_v0.1:
//  1. Participant / Fan hub "Next events" blank on a slow network
//  2. Contact & Feedback: the read-only e-mail lost its first letter
//  3. Start popup: wrong time to the gun ("11 minutes" for a race 5-10 min away)
//  4. Event header image cut off in landscape
const assert = require('assert');
const fs = require('fs');
const path = require('path');

module.exports = ({ M, load, test, SRC }) => {
  const Module = require('module');
  const read = (rel) => fs.readFileSync(path.join(SRC, rel), 'utf8').replace(/\r/g, '');
  const walk = (n, out = []) => {
    if (!n || typeof n !== 'object') return out;
    if (Array.isArray(n)) { n.forEach((c) => walk(c, out)); return out; }
    out.push(n); walk(n.children || [], out); return out;
  };
  const textOf = (n) => (n == null || n === false ? '' : typeof n !== 'object' ? String(n)
    : Array.isArray(n) ? n.map(textOf).join('') : (n.children || []).map(textOf).join(''));
  const flush = async () => { for (let i = 0; i < 10; i++) await new Promise((r) => setImmediate(r)); };
  const nav = { navigate() {}, goBack() {}, addListener: () => () => {}, setOptions() {}, isFocused: () => true };
  const MIN = 60_000;

  // ── 1. "Next events": loading / failed states ────────────────────────────
  const ev = (id) => ({ product_app_id: String(id), name: 'E' + id, race_date: '2026-11-01', event_image: '' });

  // The real hook with its setters captured (the harness React keeps no state).
  const runHook = () => {
    const React = Module._load('react', { filename: path.join(SRC, 'hooks', 'x.ts') });
    const prev = React.useState;
    const state = { events: undefined, status: undefined, history: [] };
    let n = 0;
    React.useState = (v) => {
      const x = typeof v === 'function' ? v() : v;
      const i = n++;
      if (i === 0) state.events = x; else state.status = x;
      return [x, (nv) => { if (i === 0) state.events = nv; else { state.status = nv; state.history.push(nv); } }];
    };
    try { return { h: load('hooks/useNextEvents').useNextEvents(), state }; } finally { React.useState = prev; }
  };
  const mockEvents = (impl) => { load('services/followerEvent').eventService.getEvents = impl; };

  test('Next events: starts in "loading" (not an empty list) and stays there while a slow network answers', async () => {
    // Both pages of one load wait for the same slow answer.
    let release;
    const slow = new Promise((r) => { release = r; });
    mockEvents(() => slow);
    const { h, state } = runHook();
    assert.strictEqual(state.status, 'loading', 'initial state');
    const p = h.reload();
    await flush();
    assert.strictEqual(state.status, 'loading', 'still loading while the request hangs');
    release({ tabs: { live: [ev(1)], upcoming: [ev(2)], past: [] } });
    await p;
    assert.strictEqual(state.status, 'ready');
    assert.deepStrictEqual(state.events.map((e) => e.product_app_id), ['1', '2']);
  });
  test('…a failed load says so: no connection → "network", anything else → "server"; "no data" is an empty row, not an error', async () => {
    for (const [err, want] of [[{ type: 'network', code: 'network_error' }, 'network'], [{ type: 'server', code: 'x' }, 'server'],
      [new Error('boom'), 'server'], [{ type: 'empty', code: 'no_data' }, 'ready']]) {
      mockEvents(async () => { throw err; });
      const { h, state } = runHook();
      await h.reload();
      assert.strictEqual(state.status, want, JSON.stringify(err));
      if (want === 'ready') assert.deepStrictEqual(state.events, []);
    }
  });
  test('…a retry after a failure goes back to "loading" and shows the events; a late answer from an older load is ignored', async () => {
    mockEvents(async () => { throw { type: 'network' }; });
    const { h, state } = runHook();
    await h.reload();
    assert.strictEqual(state.status, 'network');
    let releaseOld;
    const slowOld = new Promise((r) => { releaseOld = r; });
    mockEvents(() => slowOld);
    const old = h.reload();                       // slow first retry
    await flush();
    mockEvents(async () => ({ tabs: { live: [ev(9)], upcoming: [], past: [] } }));
    await h.reload();                             // newer one answers first
    assert.deepStrictEqual(state.events.map((e) => e.product_app_id), ['9']);
    releaseOld({ tabs: { live: [ev(1)], upcoming: [], past: [] } });
    await old;
    assert.deepStrictEqual(state.events.map((e) => e.product_app_id), ['9'], 'older answer dropped');
    assert.deepStrictEqual(state.history.slice(-3), ['loading', 'loading', 'ready']);
  });
  test('…merge unchanged: live first, then upcoming, both pages, an event once, at most 6', () => {
    const { mergeNextEvents } = load('hooks/useNextEvents');
    const out = mergeNextEvents([{ live: [ev(1), ev(2)], upcoming: [ev(3), ev(1)] }, { live: [ev(2), ev(4)], upcoming: [ev(5), ev(6), ev(7)] }]);
    assert.deepStrictEqual(out.map((e) => e.product_app_id), ['1', '2', '4', '3', '5', '6']);
  });

  const renderHub = (mod, status, events = []) => {
    const Screen = load(mod).default;
    const prev = M.useStateMap;
    try {
      // the hook's state: [] events, then 'loading' status
      M.useStateMap = (x) => (x === 'loading' ? status : (Array.isArray(x) && x.length === 0 && events.length ? events : x));
      return walk(Screen({ navigation: nav, route: { params: {} } }));
    } finally { M.useStateMap = prev; }
  };
  for (const [name, mod] of [['Participant hub', 'screens/ParticipantScreen/ParticipantScreen'], ['Fan hub', 'screens/FollowerScreen/FanScreen']]) {
    test(`${name} (rendered): loading → 3 skeleton cards in the row, no blank; failed → message + "Try again" that reloads; loaded → the cards`, () => {
      const placeholder = (all) => all.find((n) => typeof n.type === 'function' && n.type.name === 'NextEventsPlaceholder');
      // loading
      let all = renderHub(mod, 'loading');
      let ph = placeholder(all);
      assert.ok(ph, 'placeholder in the row');
      assert.strictEqual(ph.props.status, 'loading');
      const inner = walk(ph.type(ph.props));
      const skel = inner.filter((n) => typeof n.type === 'function' && n.type.name === 'EventCardSkeleton');
      assert.strictEqual(skel.length, 3, 'three skeleton cards');
      assert.strictEqual(skel[0].props.label, 'common:loading.loading', 'announced to screen readers');
      const card = walk(skel[0].type(skel[0].props))[0];
      assert.strictEqual(card.props.accessibilityRole, 'progressbar');
      // failed
      all = renderHub(mod, 'network');
      ph = placeholder(all);
      const err = walk(ph.type(ph.props));
      assert.ok(textOf(err).includes('errorScreen:network.title'), 'message');
      const retry = err.find((n) => n.props && typeof n.props.onPress === 'function');
      assert.strictEqual(textOf(retry), 'errorScreen:network.button');
      assert.strictEqual(retry.props.onPress, ph.props.onRetry, 'Try again = the hook\'s reload');
      // loaded
      all = renderHub(mod, 'ready', [ev(1), ev(2)]);
      ph = placeholder(all);
      assert.strictEqual(ph.type(ph.props), null, 'nothing in place of the cards');
      const cards = all.filter((n) => typeof n.type === 'function' && n.type.name === 'EventCard');
      assert.strictEqual(cards.length, 2);
    });
  }
  test('…the skeleton card is the real card\'s size (160 wide, 112 image) so the row does not jump', () => {
    // Styles are stubbed in this harness: read the component and the style file.
    const c = read('components/EventCard.tsx');
    const sk = c.slice(c.indexOf('export const EventCardSkeleton'));
    assert.ok(sk.includes('style={fanstyle.eventCard}'), 'card style = EventCard\'s');
    assert.ok(sk.includes('style={[fanstyle.eventImg, '), 'image box style = EventCard\'s');
    assert.ok(c.includes('<View style={fanstyle.eventCard}>') && c.includes('<View style={fanstyle.eventImg}>'), 'the real card uses the same two');
    const st = read('styles/fan.styles.ts');
    assert.ok(/eventCard: \{\s*width: 160,/.test(st));
    assert.ok(/eventImg: \{\s*width: 160,\s*height: 112,/.test(st));
  });

  // ── 2. Read-only field shows the START of its text ───────────────────────
  const renderInput = (props) => {
    const C = load('components/FloatingLabelInput').default;
    return walk(C({ label: 'E-mail', value: 'aaron.fargose@example.invalid', onChangeText() {}, iconName: 'mail-outline', ...props }))
      .find((n) => n.props && n.props.value === 'aaron.fargose@example.invalid' && 'editable' in n.props);
  };
  test('Contact & Feedback e-mail (read-only FloatingLabelInput, rendered): cursor pinned at 0 so the start of the address shows', () => {
    const input = renderInput({ editable: false });
    assert.ok(input, 'TextInput rendered');
    assert.deepStrictEqual(input.props.selection, { start: 0, end: 0 });
  });
  test('…an editable field is untouched (no forced selection — typing and the cursor work as before); a caller\'s selection wins; multiline untouched', () => {
    assert.strictEqual(renderInput({ editable: true }).props.selection, undefined);
    assert.strictEqual(renderInput({}).props.selection, undefined, 'editable by default');
    assert.deepStrictEqual(renderInput({ editable: false, selection: { start: 3, end: 3 } }).props.selection, { start: 3, end: 3 });
    assert.strictEqual(renderInput({ editable: false, multiline: true }).props.selection, undefined);
  });
  test('…Contact & Feedback\'s name and e-mail fields are the read-only ones', () => {
    const s = read('screens/ProfileScreen/ContactFeedbackScreen.tsx');
    for (const f of ['fields.name.label', 'fields.email.label']) {
      const at = s.indexOf(`label={t('${f}')}`);
      assert.ok(/editable=\{false\}/.test(s.slice(at, at + 600)), f);
    }
  });

  // ── 3. Start popup: time to the gun measured at the tap ──────────────────
  test('Start popup time: Home loaded 11 min before the gun, Start tapped 6 min later → "5m" (was the stale "11m")', () => {
    const { msUntilStart, formatTimeToStart } = load('components/Home/PreRaceCountdown');
    const loadedAt = 1_000_000_000_000, gun = loadedAt + 11 * MIN;
    const left = msUntilStart(gun, loadedAt + 6 * MIN, 11 / 60 /* home_api's stale hours */);
    assert.strictEqual(left, 5 * MIN);
    assert.strictEqual(formatTimeToStart(left), '5m');
  });
  test('…rounded DOWN like the card\'s countdown (5 min 40 s → "5m", it said 6); never under 1m; hours and days', () => {
    const { formatTimeToStart } = load('components/Home/PreRaceCountdown');
    assert.strictEqual(formatTimeToStart(5 * MIN + 40_000), '5m');
    assert.strictEqual(formatTimeToStart(20_000), '1m');
    assert.strictEqual(formatTimeToStart(65 * MIN), '1h 5m');
    assert.strictEqual(formatTimeToStart(60 * MIN), '1h 0m');
    assert.strictEqual(formatTimeToStart((2 * 24 + 4) * 60 * MIN + 30 * MIN), '2d 4h');
  });
  test('…after the gun the time is ≤ 0, so Start goes straight on (no "not started yet" popup from stale data); no start instant → server hours as before', () => {
    const { msUntilStart } = load('components/Home/PreRaceCountdown');
    const gun = 2_000_000_000_000;
    assert.ok(msUntilStart(gun, gun + 30_000, 0.1) <= 0, 'past the gun: stale hours ignored');
    assert.strictEqual(msUntilStart(null, gun, 0.5), 30 * MIN, 'placeholder 00:00 start: server hours');
    assert.strictEqual(msUntilStart(null, gun, undefined), 0);
  });
  test('…HomeScreen decides AND words the popup from it, measured at the tap (not next_race_in_hours)', () => {
    const s = read('screens/HomeScreen.tsx');
    const fn = s.slice(s.indexOf('const startGPSTracking = useCallback('), s.indexOf('const confirmStartTracking = useCallback('));
    assert.ok(/const msLeft = msUntilStart\(raceStartMs, Date\.now\(\), homeData\?\.next_race_in_hours\);/.test(fn), 'measured at the tap');
    assert.ok(/homeData\?\.manual_start !== 1 && msLeft > 0\)/.test(fn), 'decision');
    assert.ok(/setEarlyMsLeft\(msLeft\);\s*setShowEarlyTrackingModal\(true\);/.test(fn), 'kept for the text');
    assert.ok(/raceStartMs, doStartGPSTracking/.test(fn), 'raceStartMs is a dependency (a new start time is seen)');
    assert.ok(/const hoursDisplay = formatTimeToStart\(earlyMsLeft\);/.test(s));
    assert.ok(!/const hoursUntilRace = homeData\?\.next_race_in_hours/.test(s), 'stale figure gone');
  });

  // ── 4. Header image: whole image in landscape ────────────────────────────
  test('event header image: portrait "cover" (the box has the image\'s shape), landscape "contain" — the whole image, not a ~118pt band through it', () => {
    const { detailsHeaderImageFit, detailsHeaderImageLandscape } = load('utils/screenFit');
    assert.strictEqual(detailsHeaderImageFit(false), 'cover');
    assert.strictEqual(detailsHeaderImageFit(true), 'contain');
    // why: an 852x393 landscape iPhone, 612:428 image scaled to cover 852 x 118
    const boxH = detailsHeaderImageLandscape(393), shownFraction = boxH / (852 * 428 / 612);
    assert.ok(shownFraction < 0.25, `cover showed only ${Math.round(shownFraction * 100)}% of the height`);
  });
  test('…all four screens with that header use it (event details, its participants tab, follower event details, race result)', () => {
    for (const [f, flag] of [['screens/EventDetails/DistanceTab.tsx', 'headerLandscape'], ['screens/EventDetails/ParticipantTab.tsx', 'headerLandscape'],
      ['screens/FollowerDetailsList/DistanceTab.tsx', 'headerLandscape'], ['screens/ParticipantEvent/RaceResultScreen.tsx', 'isLandscape']]) {
      const s = read(f);
      assert.ok(s.includes(`contentFit={detailsHeaderImageFit(${flag})}`), f);
      assert.ok(!/detailsHeaderImageLandscape[\s\S]*contentFit="cover"/.test(s.slice(s.indexOf('const renderListHeader'))), `${f}: no fixed cover left on the header`);
    }
  });
};
