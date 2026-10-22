// Cases added 2026-10-22 (confirmation pass, screen sizes): every place that was
// measured at 360-1024pt is measured again at 320pt (iPhone SE 2/3 and 12/13 mini
// with Display Zoom, the first SE, small Android phones) and at 100-135% iOS
// text (Settings → Accessibility → Larger Text: ×1.12 / ×1.24 / ×1.35 per step).
// "Fits" = no word broken in the middle and nothing cut, measured with the app's
// own fonts from the values in the styles.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { textWidth } = require('../../scripts/text-width.cjs');

// phones 320-1024pt, then large phones (iPhone Pro Max 440, big Android 480),
// small tablets / foldables (600) and iPads in portrait (744 mini, 834 Air, 1024 Pro)
const WIDTHS = [320, 360, 375, 393, 430, 440, 480, 600, 744, 834, 1024];
const SCALES = [1, 1.12, 1.24, 1.35];
const LANGS = ['en', 'fr', 'nl'];
const SPACE = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 };

module.exports = ({ M, load, test, SRC }) => {
  const read = (rel) => fs.readFileSync(path.join(SRC, rel), 'utf8').replace(/\r/g, '');
  const lang = (ns, l) => JSON.parse(fs.readFileSync(path.join(SRC, 'i18n', ns, `${l}.json`), 'utf8'));
  const block = (src, name) => {
    const m = src.match(new RegExp('\\n\\s*' + name + ': \\{([^}]*)\\}'));
    assert.ok(m, 'style ' + name);
    return m[1];
  };
  const num = (b, prop) => {
    const m = b.match(new RegExp('(?:^|[\\s,{])' + prop + ':\\s*(space\\.\\w+|[\\d.]+)'));
    if (!m) return null;
    return m[1].startsWith('space.') ? SPACE[m[1].slice(6)] : Number(m[1]);
  };
  const font = (b) => b.match(/fontFamily:\s*(fonts\.\w+)/)[1];
  // Greedy word wrap as the phone does it → lines; a word wider than the box is
  // broken mid-word → Infinity.
  const lineCount = (text, w, f, size, opt) => {
    let n = 1;
    let cur = '';
    for (const word of String(text).split(/\s+/).filter(Boolean)) {
      if (textWidth(word, f, size, opt) > w) return Infinity;
      const next = cur ? cur + ' ' + word : word;
      if (textWidth(next, f, size, opt) <= w) cur = next;
      else { n++; cur = word; }
    }
    return n;
  };
  const longestWord = (labels, f, size) => Math.max(...labels.flatMap((s) => s.split(/\s+/)).map((w) => textWidth(w, f, size)));

  // ── distance cards (event details, follower distances, past races) ────
  const fit = () => load('utils/screenFit');
  const d = read('styles/details.styles.ts');
  // card margin + commonStyles.card padding (space.lg), both sides — per screen
  const CARD = {
    event: { file: 'screens/EventDetails/DistanceTab.tsx', chrome: 2 * SPACE.xl + 2 * SPACE.lg, meta: ['fonts.bodyMedium', 14] },
    follower: { file: 'screens/FollowerDetailsList/DistanceTab.tsx', chrome: 2 * SPACE.md + 2 * SPACE.lg, meta: ['fonts.body', 13] },
    past: { file: 'screens/ParticipantEvent/RaceResultScreen.tsx', chrome: 2 * SPACE.md + 2 * SPACE.lg, meta: ['fonts.bodyMedium', 14] },
  };
  const buttonLabels = (l) => {
    const ev = lang('EventDetails', l);
    const rr = lang('RaceResult', l).button;
    return {
      event: [ev.button, ev.undo, ev.register, ev.gpx, ev.map],
      follower: [rr.participants, rr.results, rr.route, ev.gpx],
      past: [rr.result],
    };
  };
  const metaLines = (l) => {
    const ev = lang('EventDetails', l);
    return ['25 September 2026', '01 November 2026', '30 December 2026', `1234 ${ev.athletes}`, `1234 ${ev.finished}`, `1234 ${ev.dnf}`];
  };

  test('distance cards: buttons stay BESIDE the details on every 360-440pt phone at the default text size (layout unchanged), go under them at 320pt', () => {
    const { distanceButtonsBelow } = fit();
    for (const [name, c] of Object.entries(CARD)) {
      for (const W of [360, 375, 390, 393, 402, 414, 428, 430, 440]) assert.strictEqual(distanceButtonsBelow(W - c.chrome, 1), false, `${name} ${W}`);
      assert.strictEqual(distanceButtonsBelow(320 - c.chrome, 1), true, `${name} 320`);
      assert.strictEqual(distanceButtonsBelow(430 - c.chrome, 1.24), true, `${name} 430 at ×1.24: "Participants" no longer fits 140pt`);
      assert.strictEqual(distanceButtonsBelow(430 - c.chrome, 1.12), false, `${name} 430 at ×1.12 still beside`);
    }
    assert.strictEqual(distanceButtonsBelow(375 - CARD.event.chrome, 1.12), false);
    assert.strictEqual(distanceButtonsBelow(360 - CARD.event.chrome, 1.12), true, '360 at ×1.12: the date column would be < "25 September"');
    assert.strictEqual(distanceButtonsBelow(375 - CARD.event.chrome, undefined), false, 'no fontScale → 1');
  });

  test('distance cards: the helper\'s constants are the real widths (app fonts) and the real styles', () => {
    const f = fit();
    let words = [];
    for (const l of LANGS) words = words.concat(...Object.values(buttonLabels(l)));
    const btnFont = font(block(d, 'resultsButtonText'));
    const btnSize = num(block(d, 'resultsButtonText'), 'fontSize');
    const widest = longestWord(words, btnFont, btnSize);
    assert.ok(f.DISTANCE_LONGEST_BUTTON_WORD >= widest && f.DISTANCE_LONGEST_BUTTON_WORD - widest < 2, String(widest));
    const date = textWidth('25 September', 'fonts.bodyMedium', 14);
    assert.ok(f.DISTANCE_LONGEST_META >= date && f.DISTANCE_LONGEST_META - date < 2, String(date));
    for (const name of ['resultsButton', 'routeButton']) {
      const b = block(d, name);
      assert.strictEqual(num(b, 'maxWidth'), f.DISTANCE_BUTTON_COLUMN, name);
      assert.strictEqual(num(b, 'paddingHorizontal'), SPACE.lg, name);
    }
    assert.ok(/borderWidth: 1\.5,/.test(block(d, 'routeButton')));
    assert.ok(/const DISTANCE_BUTTON_INSET = 2 \* 16 \+ 3;/.test(read('utils/screenFit.ts')));
    // row: gap md · divider 1 · gap md, then the meta icon (≤ 16) + gap sm
    assert.ok(/gap:\s*spacing\.md,/.test(block(d, 'distance')));
    assert.strictEqual(num(block(d, 'verticalDivider'), 'width'), 1);
    assert.strictEqual(num(block(d, 'metaRow'), 'gap'), SPACE.sm);
    assert.ok(/const DISTANCE_ROW_CHROME = 12 \+ 1 \+ 12 \+ 16 \+ 8;/.test(read('utils/screenFit.ts')));
    assert.ok(/\n  card: \{\n\s*backgroundColor: palette\.surface,\n\s*borderRadius: radii\.md,\n\s*padding: space\.lg,/.test(read('styles/common.styles.ts')), 'card padding 16 (the old model said 12)');
  });

  test('distance cards at 320-1024pt and 100-135% text: no button label and no date / athlete count breaks mid-word, in either layout (en / fr / nl)', () => {
    const { distanceButtonsBelow } = fit();
    const btnFont = font(block(d, 'resultsButtonText'));
    const bad = [];
    for (const [name, c] of Object.entries(CARD)) for (const W of WIDTHS) for (const s of SCALES) for (const l of LANGS) {
      const inner = W - c.chrome;
      const below = distanceButtonsBelow(inner, s);
      const btnInner = below ? inner - 35 : 140 - 35;
      const textCol = below ? inner - 16 - 8 : inner - 49 - 140;
      for (const t of buttonLabels(l)[name]) if (lineCount(t, btnInner, btnFont, 14 * s) === Infinity) bad.push(`${name} ${W} ×${s} ${l} button "${t}"`);
      for (const t of metaLines(l)) if (lineCount(t, textCol, c.meta[0], c.meta[1] * s) === Infinity) bad.push(`${name} ${W} ×${s} ${l} "${t}"`);
    }
    assert.deepStrictEqual(bad, []);
    // the old layout (always beside): broken at 320pt and with larger text
    const old = (name, W, s, l) => {
      const c = CARD[name];
      return buttonLabels(l)[name].some((t) => lineCount(t, 105, btnFont, 14 * s) === Infinity)
        || metaLines(l).some((t) => lineCount(t, W - c.chrome - 49 - 140, c.meta[0], c.meta[1] * s) === Infinity);
    };
    assert.ok(old('event', 320, 1, 'en'), '320: "September" in ~59pt');
    assert.ok(old('follower', 430, 1.24, 'en'), '×1.24: "Participants" in the 140pt button');
    assert.ok(old('event', 375, 1.35, 'fr'), '×1.35 on a 375pt phone');
  });

  test('distance cards: all three screens wire the layout — width from the screen, chrome = their own card margin, every button full width when below, divider hidden', () => {
    const cases = [
      [CARD.event.file, 'windowWidth - 2 \\* space\\.xl - 2 \\* space\\.lg', 'marginHorizontal: space\\.xl', 'useWindowDimensions\\(\\)'],
      [CARD.follower.file, 'windowWidth - 2 \\* spacing\\.md - 2 \\* spacing\\.lg', 'marginHorizontal: spacing\\.md', 'useWindowDimensions\\(\\)'],
      [CARD.past.file, 'windowWidth - 2 \\* spacing\\.md - 2 \\* spacing\\.lg', 'marginHorizontal: spacing\\.md', 'useDimensions\\(\\)'],
    ];
    for (const [f, inner, margin, hook] of cases) {
      const s = read(f);
      assert.ok(new RegExp('const buttonsBelow = distanceButtonsBelow\\(' + inner + ', fontScale\\);').test(s), f + ' inner width');
      assert.ok(new RegExp('\\{ minHeight: 110, [^}]*' + margin).test(s), f + ' card margin matches');
      assert.ok(new RegExp('fontScale \\} = ' + hook).test(s), f + ' reads fontScale');
      assert.ok(/<View style=\{\[detailsStyles\.distance, buttonsBelow && detailsStyles\.distanceStacked\]\}>/.test(s), f + ' stacked row');
      assert.ok(/<View style=\{\[detailsStyles\.distanceInfo, buttonsBelow && detailsStyles\.distanceInfoStacked\]\}>/.test(s), f + ' details sized by content');
      assert.ok(/\{!buttonsBelow && <View style=\{detailsStyles\.verticalDivider\} \/>\}/.test(s), f + ' divider');
      const buttons = s.match(/style=\{\[?detailsStyles\.(?:resultsButton|routeButton)(?![A-Za-z])[^\n]*/g) || [];
      assert.ok(buttons.length > 0, f);
      for (const b of buttons) assert.ok(/buttonsBelow && detailsStyles\.distanceButtonFull/.test(b), f + ': ' + b);
      assert.ok(/buttonsBelow\]\);/.test(s), f + ' renderItem re-runs when the layout flips');
    }
    assert.ok(/flex: 0,/.test(block(d, 'distanceInfoStacked')));
    assert.ok(/maxWidth: '100%',/.test(block(d, 'distanceButtonFull')));
    assert.ok(/flexDirection: "column",/.test(block(d, 'distanceStacked')));
  });

  // ── result cards ───────────────────────────────────────────────────────
  const st = read('styles/ResultList.styles.ts');
  const lb = block(st, 'statLabel');
  const LABEL = [font(lb), num(lb, 'fontSize'), { letterSpacing: num(lb, 'letterSpacing'), upper: true }];
  const cardCols = (W, n) => {
    const narrow = W < 360;
    const card = block(st, narrow ? 'cardNarrow' : 'cardWithLeftBorder');
    const gap = num(block(st, narrow ? 'statsRowNarrow' : 'statsRow'), 'gap');
    const inner = W - 2 * num(card, 'marginHorizontal') - 2 * num(card, 'padding');
    const col = (inner - (n - 1) * gap) / n;
    return {
      plain: col,
      mid: col - 2 * num(block(st, 'statColMid'), 'paddingHorizontal') - 2,
      left: col - num(block(st, 'statColLeft'), 'paddingLeft') - 1,
    };
  };
  // the headings in each column of each card (statLabel is capped at ×1)
  const columns = (l) => {
    const a = lang('ResultList', l).race;
    const g = lang('common', l).gender;
    return [
      // ResultCard, results: RACE TIME · DIFF 1ST (mid) · RANKING + category (plain)
      [3, 'plain', [a.raceTime]], [3, 'mid', [a.diffFirst]], [3, 'plain', [`${a.ranking} M40-49`, `${a.ranking} Senioren`, `${a.ranking} Masters`]],
      // ResultCardLive, live: CP (RACE TIME) · RANK WOMEN / ETA FIN (mid) · FINISH / ETA FINISH (plain)
      [3, 'plain', [`FIN (${a.raceTime})`]], [3, 'mid', [`${a.rank} ${g.women}`, `${a.rank} ${g.men}`, `${a.eta} FIN`]], [3, 'plain', [a.finish, a.etaFinish]],
      // ResultCardLive, results during the race: RACE TIME · RANKING + category (left rule)
      [2, 'left', [`${a.ranking} M40-49`, `${a.ranking} Senioren`]],
    ];
  };

  test('result cards at 320-1024pt: every heading keeps its words whole in ≤ 2 lines — at 320pt with the compact spacing (en / fr / nl)', () => {
    const bad = [];
    for (const W of WIDTHS) for (const l of LANGS) for (const [n, kind, labels] of columns(l)) {
      const w = cardCols(W, n)[kind];
      for (const t of labels) { const k = lineCount(t, w, ...LABEL); if (k > 2) bad.push(`${W} ${l} ${kind}/${n} "${t}" → ${k} in ${Math.round(w)}pt`); }
    }
    assert.deepStrictEqual(bad, []);
    // without the compact spacing (20 + 16, gap 12) at 320pt: broken mid-word
    const oldSide = (320 - 40 - 32 - 24) / 3;
    assert.strictEqual(lineCount('CLASSEMENT M40-49', oldSide, ...LABEL), Infinity);
    assert.strictEqual(lineCount('KLASSEMENT Senioren', oldSide, ...LABEL), Infinity);
  });

  test('result cards: compact spacing only below 360pt (12 + 12, gap 8) — wired into all three cards, re-read on every render (rotation / Display Zoom)', () => {
    const { isNarrowWidth, NARROW_WIDTH } = fit();
    assert.strictEqual(NARROW_WIDTH, 360);
    assert.deepStrictEqual([320, 359, 360, 375, 430, undefined, 0].map(isNarrowWidth), [true, true, false, false, false, false, false]);
    assert.ok(/marginHorizontal: space\.md,/.test(block(st, 'cardNarrow')) && /padding: space\.md,/.test(block(st, 'cardNarrow')));
    assert.ok(/gap: space\.sm,/.test(block(st, 'statsRowNarrow')));
    for (const f of ['ResultCard', 'ResultCardBeforeRace', 'ResultCardLive']) {
      const s = read(`screens/ResultList/${f}.tsx`);
      assert.ok(/const narrow = isNarrowWidth\(useWindowDimensions\(\)\.width\);/.test(s), f + ' hook');
      assert.ok(/style=\{\[resultListStyle\.cardWithLeftBorder, narrow && resultListStyle\.cardNarrow, /.test(s), f + ' card');
      assert.strictEqual((s.match(/resultListStyle\.statsRow,\n\s*narrow && resultListStyle\.statsRowNarrow,/g) || []).length, 1, f + ' stats row');
    }
  });

  const flat = (st0) => (Array.isArray(st0) ? st0.flat(Infinity) : [st0]).filter(Boolean);
  const find = (n, f) => {
    if (!n || typeof n !== 'object') return null;
    if (f(n)) return n;
    for (const c of n.children || []) { const r = find(c, f); if (r) return r; }
    return null;
  };
  const liveCard = () => load('screens/ResultList/ResultCardLive').default({
    item: { bib: '12', name: 'Ann Runner', position: '5', gender: 'female', finish_rank_gender: '2', status: 'finished', utmb_index: '',
      live_tracking_activated: 0, checkpoints: [
        { name: 'START', is_start: true, is_crossed: true, race_time: '', actual_time: '09:00:00' },
        { name: 'FIN', is_finish: true, is_crossed: true, race_time: '10:23:45', actual_time: '19:23:45' }] },
    product_app_id: 19, currentPovId: 78, raceStatus: 'in_progress', fromLive: 1, isFollowed: false, isLoading: false,
    onToggleFollow: () => {}, showUtmbIndex: false, analyticsScreenName: 'result_list', analyticsRaceName: 'Race',
  });

  test('live card (rendered): 320pt → compact card + stats row; 393pt → the normal spacing', () => {
    // the harness stands in for the style sheets with named stubs: compare names
    const names = (n) => flat(n.props.style).map((x) => String(x));
    const prev = M.window;
    try {
      M.window = { width: 320, height: 568 };
      let el = liveCard();
      assert.deepStrictEqual(names(el), ['styles.resultListStyle.cardWithLeftBorder', 'styles.resultListStyle.cardNarrow']);
      const row = find(el, (n) => n.props && names(n).includes('styles.resultListStyle.statsRow'));
      assert.ok(row && names(row).includes('styles.resultListStyle.statsRowNarrow'), 'compact stats row');
      M.window = { width: 393, height: 852 };
      el = liveCard();
      assert.deepStrictEqual(names(el), ['styles.resultListStyle.cardWithLeftBorder']);
      const row2 = find(el, (n) => n.props && names(n).includes('styles.resultListStyle.statsRow'));
      assert.ok(row2 && !names(row2).includes('styles.resultListStyle.statsRowNarrow'), 'normal stats row');
    } finally { M.window = prev; }
  });

  test('stat values (times, ranks) never break inside the number: one line, shrink only when it does not fit — every value in the result cards, favourites and the statistics strip', () => {
    const files = { 'screens/ResultList/ResultCard.tsx': 4, 'screens/ResultList/ResultCardLive.tsx': 8,
      'screens/FavouriteScreen/FavouriteCard.tsx': 3, 'screens/ResultList/ResultList.tsx': 1 };
    for (const [f, n] of Object.entries(files)) {
      const s = read(f);
      const tags = s.match(/<Text style=\{\[?\s*(?:resultListStyle|favstyle)\.(?:statVal|statValue)\b[^>]*>/g) || [];
      assert.strictEqual(tags.length, n, f);
      for (const t of tags) assert.ok(/numberOfLines=\{1\} adjustsFontSizeToFit minimumFontScale=\{0\.5\}/.test(t), f + ': ' + t);
    }
  });

  test('stat values at 320-1024pt and 100-135% text: the worst value needs ≥ 0.5 shrink (so it is never cut); without the fix "10:23:45" broke one step up on a 375pt phone', () => {
    const vs = block(st, 'statVal');
    const fav = read('styles/favourite.style.ts');
    const fv = block(fav, 'statVal');
    const fcard = block(fav, 'card');
    let worst = Infinity;
    for (const W of WIDTHS) for (const s of SCALES) {
      const c3 = cardCols(W, 3);
      for (const [v, w] of [['10:23:45', c3.plain], ['1234 · 5678', c3.plain], ['+10:23:45', c3.mid], ['10:23:45', c3.mid]]) {
        worst = Math.min(worst, w / (textWidth(v, font(vs), num(vs, 'fontSize')) * s));
      }
      // favourites: list gutter xl, card padding lg + 3pt lime edge, gap md
      const fcol = (W - 2 * SPACE.xl - 2 * num(fcard, 'padding') - 3 - 2 * SPACE.md) / 3;
      for (const [v, w] of [['10:23:45', fcol], ['23:59', fcol - 2 * SPACE.sm - 2]]) {
        worst = Math.min(worst, w / (textWidth(v, font(fv), num(fv, 'fontSize')) * s));
      }
    }
    assert.ok(worst >= 0.5, String(worst));
    const fcol375 = (375 - 40 - 32 - 3 - 24) / 3;
    assert.ok(textWidth('10:23:45', font(fv), num(fv, 'fontSize')) * 1.12 > fcol375, 'old: wrapped inside the time');
  });

  test('statistics strip: one-word labels on one line — shrink (≥ 0.8) only below 360pt ("Gepasseerd" at 320pt), full size from 360pt', () => {
    const s = read('screens/ResultList/ResultList.tsx');
    assert.ok(/<Text style=\{resultListStyle\.statLabel\} maxFontSizeMultiplier=\{1\} numberOfLines=\{1\} adjustsFontSizeToFit minimumFontScale=\{0\.8\}>\{label\}<\/Text>/.test(s));
    const box = block(st, 'statisticsContainer');
    let at320 = Infinity;
    for (const W of WIDTHS) {
      const item = (W - 2 * num(box, 'marginHorizontal') - 2 * num(box, 'paddingHorizontal')) / 4;
      for (const l of LANGS) {
        const f = lang('ResultList', l).filter;
        for (const k of ['stat_started', 'stat_crossed', 'stat_expected', 'stat_dnf', 'isFinished']) {
          const need = item / textWidth(f[k], ...LABEL);
          if (W >= 360) assert.ok(need >= 1, `${W} ${l} ${f[k]} shrinks`);
          else at320 = Math.min(at320, need);
        }
      }
    }
    assert.ok(at320 < 1 && at320 >= 0.8, String(at320));
  });

  // ── result-list filters ────────────────────────────────────────────────
  test('result-list filters: one per row when the narrowest filter cannot hold its longest word (320pt + larger text, 360pt at ×1.35); two per row otherwise', () => {
    const { filtersOnePerRow, FILTER_LONGEST_TYPE_WORD, FILTER_LONGEST_WORD } = fit();
    let typeWords = [];
    let otherWords = [];
    for (const l of LANGS) {
      const f = lang('ResultList', l).filter;
      typeWords = typeWords.concat(f.results, f.live);
      otherWords = otherWords.concat(f.favourite, f.liveTracking, f.checkpoint, f.all);
    }
    const tw = longestWord(typeWords, 'fonts.bodyMedium', 14);
    const ow = longestWord(otherWords, 'fonts.bodyMedium', 14);
    assert.ok(FILTER_LONGEST_TYPE_WORD >= tw && FILTER_LONGEST_TYPE_WORD - tw < 2, String(tw));
    assert.ok(FILTER_LONGEST_WORD >= ow && FILTER_LONGEST_WORD - ow < 2, String(ow));
    const tab = block(st, 'filterTab');
    assert.strictEqual(num(tab, 'paddingHorizontal'), SPACE.sm);
    assert.strictEqual(num(block(st, 'filterTabWide'), 'flex'), 1.6);
    assert.ok(/name="chevron-down"\s*size=\{18\}/.test(read('components/FilterDropdown.tsx')));
    for (const W of [360, 375, 393, 430]) assert.strictEqual(filtersOnePerRow(W, 1), false, String(W));
    for (const W of [375, 393, 430]) assert.strictEqual(filtersOnePerRow(W, 1.35), false, `${W} ×1.35`);
    assert.strictEqual(filtersOnePerRow(320, 1), false, '320 at 100%: still two per row');
    assert.strictEqual(filtersOnePerRow(320, 1.12), true);
    assert.strictEqual(filtersOnePerRow(360, 1.35), true);
    assert.strictEqual(filtersOnePerRow(undefined, 1.35), false);
  });

  test('result-list filters at 320-1024pt and 100-135% text: every fixed label fits in its 2 lines with no broken word, in either layout (en / fr / nl)', () => {
    const { filtersOnePerRow } = fit();
    assert.ok(/numberOfLines=\{2\}/.test(read('components/FilterDropdown.tsx').match(/<Text\s+style=\{resultListStyle\.filterTabText\}[^>]*>/)[0]));
    const inner = (w) => w - 2 * SPACE.sm - 2 - 18 - SPACE.xs;
    const bad = [];
    let oldBroken = 0;
    for (const W of WIDTHS) for (const s of SCALES) {
      const one = filtersOnePerRow(W, s);
      const row = W - 2 * SPACE.xl - SPACE.sm;
      const typeW = one ? inner(W - 2 * SPACE.xl) : inner(row / 2.6);
      const halfW = one ? inner(W - 2 * SPACE.xl) : inner(row / 2);
      for (const l of LANGS) {
        const f = lang('ResultList', l).filter;
        for (const t of [f.results, f.live]) {
          if (lineCount(t, typeW, 'fonts.bodyMedium', 14 * s) > 2) bad.push(`${W} ×${s} ${l} type "${t}"`);
          if (lineCount(t, inner(row / 2.6), 'fonts.bodyMedium', 14 * s) > 2) oldBroken++;
        }
        for (const t of [f.favourite, f.liveTracking, f.checkpoint, f.all]) {
          if (lineCount(t, halfW, 'fonts.bodyMedium', 14 * s) > 2) bad.push(`${W} ×${s} ${l} "${t}"`);
          if (lineCount(t, inner(row / 2), 'fonts.bodyMedium', 14 * s) > 1) oldBroken++;
        }
      }
    }
    assert.deepStrictEqual(bad, []);
    assert.ok(oldBroken > 0, 'the old one-line, two-per-row filters cut or broke a label');
  });

  test('result-list filters: wired — both rows stack, every dropdown drops flex 1 when stacked (it would not size by its label)', () => {
    const s = read('screens/ResultList/ResultList.tsx');
    assert.ok(/const \{ width, height, fontScale, isLandscape: isLandscapeView \} = useDimensions\(\);\n\s*const filtersStacked = filtersOnePerRow\(width, fontScale\);/.test(s));
    assert.ok(/<View style=\{\[resultListStyle\.filterRow1, filtersStacked && resultListStyle\.filterRowStacked\]\}>/.test(s));
    assert.ok(/<View style=\{\[resultListStyle\.filterRow2, filtersStacked && resultListStyle\.filterRowStacked\]\}>/.test(s));
    const hdr = s.slice(s.indexOf('const filterHeader = ('), s.indexOf('<View style={resultListStyle.statisticsContainer}>'));
    const drops = hdr.split('<Dropdown').slice(1);
    assert.strictEqual(drops.length, 4);
    for (const dd of drops) assert.ok(/style=\{(?:\[resultListStyle\.filterTabWide, stackedTab\]|stackedTab)\}/.test(dd), dd.slice(0, 80));
    assert.ok(/flex: 0,/.test(block(st, 'filterTabStacked')) && /flexDirection: "column",/.test(block(st, 'filterRowStacked')));
  });

  test('screen sizes still covered elsewhere at 320pt too: bottom bar labels and the home band / hero fit', () => {
    const lbl = block(read('styles/bottomNav.styles.ts'), 'label');
    const bt = block(read('styles/header.styles.ts'), 'bandText');
    const title = block(read('styles/home.styles.ts'), 'title');
    const bad = [];
    for (const l of LANGS) {
      const nav = lang('common', l).nav;
      for (const k of ['home', 'favorites', 'results', 'participants', 'map']) if (textWidth(nav[k], 'fonts.bodySemi', num(lbl, 'fontSize')) > 320 / 4) bad.push(`tab ${l} ${nav[k]}`);
      if (textWidth(lang('common', l).band.home, font(bt), num(bt, 'fontSize'), { letterSpacing: num(bt, 'letterSpacing'), upper: true }) > 320 - 2 * SPACE.xl) bad.push(`band ${l}`);
      for (const line of lang('HomeScreen', l).hero.title.split('\n')) if (textWidth(line, font(title), num(title, 'fontSize')) > 320 - 2 * SPACE.xl) bad.push(`hero ${l} ${line}`);
    }
    assert.deepStrictEqual(bad, []);
  });
};
