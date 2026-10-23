// Cases added 2026-10-22 (round 2 of the client's iOS feedback): the font-size
// review, every client point measured at real phone widths with the app's own
// font files (scripts/text-width.cjs), the landscape results list, rendered
// result cards, and "Share result" linking to the public result page.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { textOf } = require('./harness');
const { textWidth } = require('../../scripts/text-width.cjs');

// Portrait widths of the phones in use: 360 (small Android), 375 (iPhone SE 2/3,
// 12/13 mini), 393 (iPhone 14-16, Pixel), 430 (Plus / Pro Max).
// phones 320-1024pt, then large phones (iPhone Pro Max 440, big Android 480),
// small tablets / foldables (600) and iPads in portrait (744 mini, 834 Air, 1024 Pro)
const WIDTHS = [360, 375, 393, 430, 440, 480, 600, 744, 834, 1024];
// Landscape heights: iPhone SE 375, iPhone 15 393, Pro Max 430, Android 360.
const LANDSCAPE = [
  { h: 360, bottomInset: 0, name: 'Android 360' },
  { h: 375, bottomInset: 21, name: 'iPhone SE' },
  { h: 393, bottomInset: 21, name: 'iPhone 15' },
  { h: 430, bottomInset: 21, name: 'iPhone Pro Max' },
];
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
  // A numeric style value: literal or space.* token.
  const num = (b, prop) => {
    const m = b.match(new RegExp('(?:^|[\\s,{])' + prop + ':\\s*(space\\.\\w+|[\\d.]+)'));
    if (!m) return null;
    return m[1].startsWith('space.') ? SPACE[m[1].slice(6)] : Number(m[1]);
  };
  const font = (b) => b.match(/fontFamily:\s*(fonts\.\w+)/)[1];
  // Greedy word wrap as the phone does it → lines; a single word wider than the
  // box would be broken mid-word → Infinity.
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
  const find = (n, f) => {
    if (!n || typeof n !== 'object') return null;
    if (f(n)) return n;
    for (const c of n.children || []) { const r = find(c, f); if (r) return r; }
    return null;
  };
  const findAll = (n, f, out = []) => {
    if (!n || typeof n !== 'object') return out;
    if (f(n)) out.push(n);
    for (const c of n.children || []) findAll(c, f, out);
    return out;
  };

  // ── 4. font size ───────────────────────────────────────────────────────
  test('font size: the shared type ramp is 1pt bigger up to 13pt (labels 11, captions 12, small 13, body 14); 15pt+ unchanged', () => {
    const s = read('styles/common.styles.ts');
    const size = (k) => Number(s.match(new RegExp('\\n  ' + k + ':\\s*\\{[^}]*fontSize: (\\d+)'))[1]);
    assert.deepStrictEqual(
      ['label', 'microMedium', 'caption', 'small', 'smallMedium', 'smallSemi', 'numeral', 'body', 'bodyMedium', 'h3', 'h2', 'h1', 'display'].map(size),
      [11, 11, 12, 13, 13, 13, 13, 14, 14, 15, 20, 26, 40]);
  });

  test('font size: no text below 11pt anywhere (Apple\'s minimum) except the elevation-chart marker inside its fixed 22pt badge', () => {
    const small = [];
    (function walk(d) {
      for (const f of fs.readdirSync(d)) {
        const p = path.join(d, f);
        if (fs.statSync(p).isDirectory()) walk(p);
        else if (/\.(ts|tsx)$/.test(f) && !/\.test\./.test(f)) {
          const src = fs.readFileSync(p, 'utf8');
          for (const m of src.matchAll(/\{[^{}]*fontSize:\s*(\d+)[^{}]*\}/g)) {
            if (Number(m[1]) < 11) small.push(path.relative(SRC, p).replace(/\\/g, '/') + ' ' + m[1]);
          }
        }
      }
    })(SRC);
    assert.deepStrictEqual(small, ['components/ElevationProfile/LiveElevationProfile.tsx 10']);
    assert.ok(/left: t\.sx - 22,\s*top: t\.sy - 7,\s*width: 44,[^}]*fontSize: 10,/.test(read('components/ElevationProfile/LiveElevationProfile.tsx')), 'the marker label over the 22pt dot (44 wide since the full audit: a bib fallback wrapped in 22)');
  });

  test('font size: every text style with a lineHeight still has room for its glyphs (lineHeight ≥ 1.2 × size) — nothing clipped by the bump', () => {
    const bad = [];
    (function walk(d) {
      for (const f of fs.readdirSync(d)) {
        const p = path.join(d, f);
        if (fs.statSync(p).isDirectory()) walk(p);
        else if (/\.(ts|tsx)$/.test(f) && !/\.test\./.test(f)) {
          for (const m of fs.readFileSync(p, 'utf8').matchAll(/\{[^{}]*fontSize:\s*(\d+)[^{}]*\}/g)) {
            const lh = m[0].match(/lineHeight:\s*(\d+)/);
            if (lh && Number(lh[1]) < Number(m[1]) * 1.2) bad.push(`${path.relative(SRC, p)} ${m[1]}/${lh[1]}`);
          }
        }
      }
    })(SRC);
    assert.deepStrictEqual(bad, []);
    const st = block(read('styles/ResultList.styles.ts'), 'statLabel');
    assert.strictEqual(num(st, 'minHeight'), 2 * num(st, 'lineHeight'), 'two-line stat label box = 2 × lineHeight');
  });

  test('font size: the design checks accept the new 14pt step (design-report + design-audit ramps)', () => {
    for (const f of ['scripts/design-report.mjs', 'scripts/design-audit.mjs']) {
      assert.ok(/\['10', '11', '12', '13', '14', '15', '20', '26', '40'\]/.test(fs.readFileSync(path.join(SRC, '..', f), 'utf8')), f);
    }
  });

  // ── fit at real phone widths ───────────────────────────────────────────
  // Result-card stat columns, from ResultList.styles: card margin xl + padding lg
  // each side, 3 flex columns with gap md, middle column padded both sides +2
  // rules, side columns padded left +1 rule.
  const cardCols = (W) => {
    const st = read('styles/ResultList.styles.ts');
    const card = block(st, 'cardWithLeftBorder');
    const row = block(st, 'statsRow');
    const inner = W - 2 * num(card, 'marginHorizontal') - 2 * num(card, 'padding');
    const col = (inner - 2 * num(row, 'gap')) / 3;
    const mid = col - 2 * num(block(st, 'statColMid'), 'paddingHorizontal') - 2;
    const side = col - num(block(st, 'statColLeft'), 'paddingLeft') - 1;
    const lb = block(st, 'statLabel');
    return { mid, side, label: [font(lb), num(lb, 'fontSize'), { letterSpacing: num(lb, 'letterSpacing'), upper: true }] };
  };

  test('result cards at 360-1024pt: every fixed column label fits in its 2 lines without breaking a word (en / fr / nl)', () => {
    const bad = [];
    for (const W of WIDTHS) {
      const { mid, side, label } = cardCols(W);
      for (const l of LANGS) {
        const a = lang('ResultList', l).race;
        const g = lang('common', l).gender;
        const midLabels = [`${a.rank} ${g.women}`, `${a.rank} ${g.men}`, a.diffFirst, a.eta];
        const sideLabels = [a.raceTime, a.finish, a.etaFinish, `${a.ranking} M40-49`, `${a.ranking} Senioren`];
        for (const t of midLabels) { const n = lineCount(t, mid, ...label); if (n > 2) bad.push(`${W} ${l} middle "${t}" → ${n}`); }
        for (const t of sideLabels) { const n = lineCount(t, side, ...label); if (n > 2) bad.push(`${W} ${l} side "${t}" → ${n}`); }
      }
    }
    assert.deepStrictEqual(bad, []);
  });

  test('result list statistics strip at 360-1024pt: each label on one line (4 boxes in checkpoint mode)', () => {
    const st = read('styles/ResultList.styles.ts');
    const box = block(st, 'statisticsContainer');
    const lb = block(st, 'statLabel');
    const bad = [];
    for (const W of WIDTHS) {
      const item = (W - 2 * num(box, 'marginHorizontal') - 2 * num(box, 'paddingHorizontal')) / 4;
      for (const l of LANGS) {
        const f = lang('ResultList', l).filter;
        for (const k of ['stat_started', 'stat_crossed', 'stat_expected', 'stat_dnf', 'isFinished']) {
          const n = lineCount(f[k], item, font(lb), num(lb, 'fontSize'), { letterSpacing: num(lb, 'letterSpacing'), upper: true });
          if (n > 1) bad.push(`${W} ${l} ${f[k]} → ${n}`);
        }
      }
    }
    assert.deepStrictEqual(bad, []);
  });

  test('Dutch: "KLASSEMENT" — "RANGSCHIKKING" (~100pt) broke mid-word in the ranking column on every phone narrower than 430pt', () => {
    assert.strictEqual(lang('ResultList', 'nl').race.ranking, 'KLASSEMENT');
    const { side, label } = cardCols(375);
    assert.strictEqual(lineCount('RANGSCHIKKING', side, ...label), Infinity, 'old word does not fit');
    assert.strictEqual(lineCount('KLASSEMENT', side, ...label), 1);
  });

  test('bottom bar at 360-1024pt: every tab label fits its quarter of the width (en / fr / nl)', () => {
    const lb = block(read('styles/bottomNav.styles.ts'), 'label');
    const bad = [];
    for (const W of WIDTHS) for (const l of LANGS) {
      const nav = lang('common', l).nav;
      for (const k of ['home', 'favorites', 'results', 'participants', 'map']) {
        // the active tab is semibold — the wider of the two
        if (textWidth(nav[k], 'fonts.bodySemi', num(lb, 'fontSize')) > W / 4) bad.push(`${W} ${l} ${nav[k]}`);
      }
    }
    assert.deepStrictEqual(bad, []);
  });

  test('home at 360-1024pt: band "LIVE TRACKING & RESULTS" on one line, hero title lines fit, logo inside the 44pt row', () => {
    const bt = block(read('styles/header.styles.ts'), 'bandText');
    const hs = read('styles/home.styles.ts');
    const title = block(hs, 'title');
    const bad = [];
    for (const W of WIDTHS) for (const l of LANGS) {
      const band = lang('common', l).band.home;
      if (textWidth(band, font(bt), num(bt, 'fontSize'), { letterSpacing: num(bt, 'letterSpacing'), upper: true }) > W - 2 * SPACE.xl) bad.push(`${W} ${l} band`);
      for (const line of lang('HomeScreen', l).hero.title.split('\n')) {
        if (textWidth(line, font(title), num(title, 'fontSize')) > W - 2 * SPACE.xl) bad.push(`${W} ${l} hero "${line}"`);
      }
    }
    assert.deepStrictEqual(bad, []);
    const logo = block(read('styles/header.styles.ts'), 'centerLogo');
    assert.ok(num(logo, 'height') <= num(block(read('styles/header.styles.ts'), 'row'), 'height'));
  });

  test('distance buttons: labels measured with the button font fit the ~90pt button (en / fr / nl)', () => {
    const d = read('styles/details.styles.ts');
    const tb = block(d, 'resultsButtonText');
    for (const l of LANGS) {
      const b = lang('RaceResult', l).button;
      for (const k of ['participants', 'results', 'result', 'route']) {
        assert.ok(textWidth(b[k], font(tb), num(tb, 'fontSize')) <= 90, `${l} ${b[k]}`);
      }
    }
  });

  test('hero: the line under "Follow your race in real time" no longer repeats "Follow your race"', () => {
    assert.strictEqual(lang('HomeScreen', 'en').hero.subtitle, 'And keep up with the athletes you follow');
    assert.strictEqual(lang('HomeScreen', 'nl').hero.subtitle, 'En blijf op de hoogte van de atleten die je volgt');
    assert.strictEqual(lang('HomeScreen', 'fr').hero.subtitle, 'Et ne manquez rien des athlètes que vous suivez');
    for (const l of LANGS) {
      const h = lang('HomeScreen', l).hero;
      const first = h.title.split(/\s+/).slice(0, 2).join(' ').toLowerCase();
      assert.ok(!h.subtitle.toLowerCase().includes(first), `${l}: subtitle repeats "${first}"`);
    }
  });

  test('Dutch: the two "since last point" labels side by side read the same way (standard "vorig punt", 2026-10-23)', () => {
    const tp = lang('Resultdetails', 'nl').timingPoint;
    assert.strictEqual(tp.segmentDistance, 'Sinds vorig punt');
    assert.strictEqual(tp.segmentElevation, 'Hoogtemeters sinds vorig punt');
  });

  // ── 5. landscape ───────────────────────────────────────────────────────
  // Heights from the styles: header bar = 16 + 44 row + lg (status bar inset is
  // 0 in landscape), band = 2 × sm + band text line, bottom bar = sm + (icon 26
  // + 2 × xs) + xs + label line + lg + home-indicator inset; filters = two 38pt
  // rows with their paddings; statistics strip = marginTop + 2 × lg + label box
  // (2 lines) + value line. A card is at least padding + name/bib lines + stats.
  test('results list, landscape: with the filters scrolling, a full card is visible on every phone; fixed (old) the list had no room at all', () => {
    const st = read('styles/ResultList.styles.ts');
    const hd = read('styles/header.styles.ts');
    const line = (size) => Math.ceil(size * 1.25);
    const header = 16 + num(block(hd, 'row'), 'height') + SPACE.lg;
    const band = 2 * SPACE.sm + line(num(block(hd, 'bandText'), 'fontSize'));
    const navLabel = num(block(read('styles/bottomNav.styles.ts'), 'label'), 'fontSize');
    const tab = num(block(st, 'filterTab'), 'height');
    const filters = (SPACE.lg + tab) + (SPACE.sm + tab + SPACE.lg + 1);
    const lb = block(st, 'statLabel');
    const stats = SPACE.lg + 2 * SPACE.lg + num(lb, 'minHeight') + 4 + line(20);
    const card = 2 * SPACE.lg + line(15) + 2 * 17 + SPACE.md + SPACE.lg + num(lb, 'minHeight') + 4 + line(15);
    for (const d of LANDSCAPE) {
      const bottom = SPACE.sm + (26 + 2 * SPACE.xs) + SPACE.xs + line(navLabel) + SPACE.lg + d.bottomInset;
      const now = d.h - header - band - bottom;                // filters scroll inside the list
      const before = now - filters - stats;                      // filters fixed above it
      assert.ok(now >= card, `${d.name}: ${now}pt visible ≥ one card (${card}pt)`);
      assert.ok(before < card / 2, `${d.name}: fixed filters left ${before}pt — not even half a card (the bug)`);
    }
    // and the screen really does put them in the list in landscape
    const s = read('screens/ResultList/ResultList.tsx');
    assert.ok(/ListHeaderComponent=\{filtersInList \? filterHeader : null\}/.test(s));
    assert.ok(/const \{ isLandscape \} = \{ isLandscape: dims\.width > dims\.height \}|isLandscape: dims\.width > dims\.height/.test(read('hooks/useDimensions.ts')), 'landscape = width > height');
  });

  // ── 9 / 10 / 12: rendered result cards ─────────────────────────────────
  const CPS = (finished) => [
    { name: 'START', is_start: true, is_crossed: true, race_time: '', actual_time: '09:00:00' },
    { name: 'CP1', is_crossed: true, race_time: '01:00:00', actual_time: '10:00:00' },
    { name: 'FIN', is_finish: true, is_crossed: finished, race_time: finished ? '02:10:00' : '', actual_time: '11:10:00' },
  ];
  const liveCard = (over = {}, props = {}) => {
    const Card = load('screens/ResultList/ResultCardLive').default;
    const item = { bib: '12', name: 'Ann Runner', position: '5', gender: 'female', finish_rank_gender: '2',
      status: 'finished', checkpoints: CPS(true), utmb_index: '612', live_tracking_activated: 0, ...over };
    let toggled = 0;
    const el = Card({ item, product_app_id: 19, currentPovId: 78, raceStatus: 'in_progress', fromLive: 1,
      isFollowed: false, isLoading: false, onToggleFollow: () => { toggled++; }, showUtmbIndex: true,
      analyticsScreenName: 'result_list', analyticsRaceName: 'Race', ...props });
    return { el, toggled: () => toggled };
  };

  test('live card (rendered): finished → FIN race time · RANK WOMEN 2 · FINISH 11:10 — the finish time of day only once', () => {
    const { el } = liveCard();
    const txt = textOf(el);
    assert.ok(txt.includes('allrace:race.rank common:gender.women2'), txt);
    assert.strictEqual(txt.split('11:10').length - 1, 1, 'finish clock time shown once: ' + txt);
    assert.ok(txt.includes('FIN (allrace:race.raceTime)02:10:00'));
    const men = textOf(liveCard({ gender: 'male', finish_rank_gender: '9' }).el);
    assert.ok(men.includes('allrace:race.rank common:gender.men9'), men);
  });

  test('live card (rendered): still racing → the middle column stays the ETA of the next point; no usable gender rank → old column', () => {
    const racing = textOf(liveCard({ status: 'in_progress', checkpoints: CPS(false) }).el);
    assert.ok(racing.includes('allrace:race.eta FIN') && !racing.includes('allrace:race.rank'), racing);
    const noRank = textOf(liveCard({ finish_rank_gender: '' }).el);
    assert.ok(!noRank.includes('allrace:race.rank'), noRank);
  });

  test('live card (rendered): UTMB index is a small line under the name, before the star and the stats', () => {
    const { el } = liveCard();
    const txt = textOf(el);
    const iName = txt.indexOf('Ann Runner');
    const iUtmb = txt.indexOf('UTMBallrace:race.utmbIndex612');
    assert.ok(iName >= 0 && iUtmb > iName && iUtmb < txt.indexOf('FIN ('), txt);
  });

  for (const [file, label] of [['ResultCardLive', 'live'], ['ResultCard', 'results'], ['ResultCardBeforeRace', 'before-race']]) {
    test(`${label} card (rendered): pressing the card opens that athlete; the star only toggles follow; a › chevron is drawn`, () => {
      const Card = load(`screens/ResultList/${file}`).default;
      let toggled = 0;
      const el = Card({ item: { bib: '77', name: 'Bob', position: '1234', gender: 'male', finish_rank_gender: '1',
        status: 'finished', checkpoints: CPS(true), utmb_index: '', live_tracking_activated: 0, time: '02:00:00' },
      product_app_id: 19, currentPovId: 78, raceStatus: 'finished', fromLive: 0, isFollowed: false, isLoading: false,
      onToggleFollow: () => { toggled++; }, showUtmbIndex: false, analyticsScreenName: 'result_list', analyticsRaceName: 'Race' });
      assert.strictEqual(el.type, 'TouchableOpacity', 'the card itself is the touchable');
      M.nav.navigations.length = 0;
      el.props.onPress();
      assert.deepStrictEqual(M.nav.navigations.map((n) => [n.name, n.params.bib, n.params.product_app_id]), [['ResultDetails', '77', 19]]);
      const star = find(el, (n) => n.type === 'TouchableOpacity' && n !== el);
      star.props.onPress();
      assert.strictEqual(toggled, 1);
      assert.strictEqual(M.nav.navigations.length, 1, 'star does not open the athlete');
      assert.strictEqual(findAll(el, (n) => n.type === 'Ionicons' && n.props.name === 'chevron-forward').length, 1);
      // 12: a 4-digit rank is drawn in full (the circle grows — see audit26)
      if (file !== 'ResultCardBeforeRace') assert.ok(textOf(el).startsWith('1234'), textOf(el));
    });
  }

  test('rank circle: "1234" / "12345" / "DNF" fit inside the grown pill; 1-3 digits keep the 34pt circle', () => {
    const st = read('styles/ResultList.styles.ts');
    const c = block(st, 'rankCircle');
    const rt = block(st, 'rankText');
    const box = (s) => Math.max(num(c, 'minWidth'), textWidth(s, font(rt), num(rt, 'fontSize')) + 2 * num(c, 'paddingHorizontal'));
    for (const s of ['1', '12', '123']) assert.ok(box(s) <= 36, `${s}: ${box(s)}`);
    for (const s of ['1234', '12345', 'DNF']) {
      assert.ok(box(s) >= textWidth(s, font(rt), num(rt, 'fontSize')) + 2 * num(c, 'paddingHorizontal') - 0.01, s);
      assert.ok(box(s) < 80, `${s} pill stays modest: ${box(s)}`);
    }
  });

  // ── 11. Share result → public result page ──────────────────────────────
  const shareFrom = async (raceInfo, event) => {
    const Tab = load('screens/ResultDetailsScreen/RaceInfoTab').default;
    const el = Tab({ raceInfo: { name: 'Ann Runner', time: '02:10:00', position: '5', position_total: '100', average_pace: '5:12', ...raceInfo },
      event: { race_name: 'Trail', distance_name: '25km', product_app_id: 19, product_option_value_app_id: 78, ...event }, checkpoints: [] });
    const btn = find(el, (n) => n.props && n.props.label === 'raceInfo.shareResult');
    assert.ok(btn, 'share button rendered');
    M.shares.length = 0;
    await btn.props.onPress();
    assert.strictEqual(M.shares.length, 1);
    return M.shares[0];
  };

  test('share result: the message carries the runner\'s public result page on my.liviolive.com', async () => {
    const sh = await shareFrom({ bib: '12' }, {});
    const [text, url] = sh.message.split('\n');
    assert.ok(text.startsWith('raceInfo.shareBody{'), text);
    assert.ok(text.includes('"position":"5 / 100"'));
    assert.strictEqual(url, 'https://my.liviolive.com/livio_website/result_detail/?product_app_id=19&product_option_value_app_id=78&bib=12');
    assert.strictEqual(sh.url, undefined, 'link only inside message (iOS would add a second copy)');
  });

  test('share result: no usable bib / ids → text only, never a dead link', async () => {
    for (const [ri, ev] of [[{ bib: '' }, {}], [{ bib: '0' }, {}], [{ bib: '12' }, { product_app_id: 0 }], [{ bib: '12' }, { product_option_value_app_id: undefined }]]) {
      const sh = await shareFrom(ri, ev);
      assert.ok(!sh.message.includes('http'), JSON.stringify([ri, ev]) + ' ' + sh.message);
    }
    const { buildResultLink } = load('utils/resultLink');
    assert.strictEqual(buildResultLink('19', '78', ' A 12 '), 'https://my.liviolive.com/livio_website/result_detail/?product_app_id=19&product_option_value_app_id=78&bib=A%2012');
  });

  test('share result: the link is the webapp\'s own result page route and query (livio_web, when checked out beside larssie)', () => {
    const web = 'C:/xampp/htdocs/larssie/livio_web';
    if (!fs.existsSync(web)) return;
    const page = fs.readFileSync(path.join(web, 'src/screens/AthleteDetails/AthleteDetails.tsx'), 'utf8');
    for (const p of ['product_app_id', 'product_option_value_app_id', 'bib']) assert.ok(page.includes(`searchParams.get("${p}")`), p);
    assert.ok(fs.existsSync(path.join(web, 'app/result_detail/page.tsx')), 'route /result_detail exists');
    assert.ok(/trailingSlash:\s*true/.test(fs.readFileSync(path.join(web, 'next.config.ts'), 'utf8')), 'static export with trailing slash → "/result_detail/"');
  });
};
