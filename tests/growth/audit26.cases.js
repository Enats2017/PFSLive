// Cases added 2026-10-22: client feedback on the iOS test build (home header,
// Dutch wording, result list / live result cards, landscape scrolling).
const assert = require('assert');
const fs = require('fs');
const path = require('path');

module.exports = ({ test, SRC }) => {
  const read = (rel) => fs.readFileSync(path.join(SRC, rel), 'utf8').replace(/\r/g, '');
  const lang = (ns, l) => JSON.parse(fs.readFileSync(path.join(SRC, 'i18n', ns, `${l}.json`), 'utf8'));
  const block = (src, name) => {
    const m = src.match(new RegExp('\\n  ' + name + ': \\{([^}]*)\\}'));
    assert.ok(m, 'style ' + name);
    return m[1];
  };
  // Evaluates `const <name> = <expr>;` from a source file with stand-ins.
  const expr = (src, name, args, values) => {
    const m = src.match(new RegExp('\\n\\s*const ' + name + ' = ([\\s\\S]*?);\\n'));
    assert.ok(m, name + ' found');
    // eslint-disable-next-line no-new-func
    return new Function(...args, 'return (' + m[1] + ');')(...values);
  };

  test('header logo: the box has the PNG\'s own ratio, so the mark fills the 44pt row (was drawn ~42x22)', () => {
    const png = fs.readFileSync(path.join(SRC, '..', 'assets', 'livio_logo_header.png'));
    const w = png.readUInt32BE(16);
    const h = png.readUInt32BE(20);
    const b = block(read('styles/header.styles.ts'), 'centerLogo');
    const bw = Number(b.match(/width: (\d+)/)[1]);
    const bh = Number(b.match(/height: (\d+)/)[1]);
    assert.ok(Math.abs(bw / bh - w / h) / (w / h) < 0.05, `box ${bw}x${bh} vs image ${w}x${h}`);
    assert.ok(bh >= 34 && bh <= 44, 'fits the 44pt row, clearly bigger than 22');
  });

  test('Dutch: "Live tracking" and "Results" stay English as feature / tab names', () => {
    assert.strictEqual(lang('common', 'nl').band.home, 'Live tracking & results');
    assert.strictEqual(lang('common', 'nl').nav.results, 'Results');
    assert.strictEqual(lang('ResultList', 'nl').filter.results, 'Results');
    assert.strictEqual(lang('EventDetails', 'nl').participant.results, 'Results');
    assert.strictEqual(lang('RaceResult', 'nl').button.results, 'Results');
    assert.strictEqual(lang('RaceResult', 'nl').button.result, 'Result');
    assert.strictEqual(lang('livetracking', 'nl').bar.label, 'Live tracking');
    // English and French untouched
    assert.strictEqual(lang('common', 'en').band.home, 'Live tracking & results');
    assert.strictEqual(lang('common', 'fr').nav.results, 'Résultats');
  });

  test('home hero: "Follow your race in real time" replaces "Your race is ready to track"', () => {
    assert.strictEqual(lang('HomeScreen', 'en').hero.title, 'Follow your race\nin real time');
    assert.strictEqual(lang('HomeScreen', 'nl').hero.title, 'Volg je wedstrijd\nin realtime');
    assert.strictEqual(lang('HomeScreen', 'fr').hero.title, 'Suivez votre course\nen temps réel');
  });

  test('Dutch: elevation since last point reads "Hoogtemeters sinds vorig punt" (standard Dutch, 2026-10-23)', () => {
    assert.strictEqual(lang('Resultdetails', 'nl').timingPoint.segmentElevation, 'Hoogtemeters sinds vorig punt');
  });

  test('rank circle grows with the rank (1000+ / DNF): minWidth, no fixed width, pill radius', () => {
    const b = block(read('styles/ResultList.styles.ts'), 'rankCircle');
    // minHeight since the larger-text fix (audit32): grows taller too, never shorter than 34
    assert.ok(/minWidth: 34,/.test(b) && /minHeight: 34,/.test(b), 'min 34pt, same height');
    assert.ok(!/(^|[^a-zA-Z])width:/.test(b), 'no fixed width');
    assert.ok(/borderRadius: radii\.pill,/.test(b), 'stays round at any width');
    assert.ok(/paddingHorizontal: space\.xs,/.test(b), 'breathing room once it grows');
  });

  for (const [file, label] of [['ResultCardLive', 'live'], ['ResultCard', 'results']]) {
    test(`${label} card: the WHOLE card opens the athlete (name / rank taps did nothing); the star keeps its own press`, () => {
      const s = read(`screens/ResultList/${file}.tsx`);
      const ret = s.slice(s.indexOf('    return ('));
      assert.ok(/^    return \(\n(?:\s*\/\/.*\n)*\s*<TouchableOpacity\n\s*style=\{\[resultListStyle\.cardWithLeftBorder/.test(ret), 'outer element is the touchable');
      assert.ok(/\n            onPress=\{handleCardPress\}/.test(ret), 'outer press = open the athlete');
      assert.strictEqual((ret.match(/onPress=\{handleCardPress\}/g) || []).length, 1, 'one card press, not a second strip');
      assert.ok(/onPress=\{handleStarPress\}/.test(ret), 'star still its own touchable');
      assert.ok(/\n        <\/TouchableOpacity>\n    \);\n\}, \(prev, next\)/.test(s), 'touchable closes the card');
    });
  }

  test('all three result cards show a chevron — the card is visibly tappable', () => {
    for (const f of ['ResultCardLive', 'ResultCard', 'ResultCardBeforeRace']) {
      const s = read(`screens/ResultList/${f}.tsx`);
      assert.ok(/<Ionicons name="chevron-forward" size=\{18\} color=\{palette\.placeholder\} style=\{resultListStyle\.cardChevron\} \/>\n            <\/View>/.test(s), f);
    }
  });

  test('live card, finished: middle column is the gender rank, not FIN again (same time of day as FINISH)', () => {
    const s = read('screens/ResultList/ResultCardLive.tsx');
    const rank = (finishCp, nextCp, item) => expr(s, 'finishedGenderRank', ['finishCp', 'nextCp', 'item'], [finishCp, nextCp, item]);
    const fin = { is_crossed: true };
    assert.strictEqual(rank(fin, null, { finish_rank_gender: '7' }), '7');
    assert.strictEqual(rank({ is_crossed: false }, { is_crossed: false }, { finish_rank_gender: '7' }), null, 'still racing');
    assert.strictEqual(rank(fin, null, { finish_rank_gender: '' }), null, 'no rank → old column');
    assert.strictEqual(rank(fin, null, { finish_rank_gender: 'DNF' }), null, 'status, not a rank');
    assert.strictEqual(rank(null, null, { finish_rank_gender: '3' }), null, 'no checkpoints');
    const tt = (k) => ({ 'common:gender.women': 'Women', 'common:gender.men': 'Men' }[k]);
    const word = (gender) => expr(s, 'genderWord', ['item', 't'], [{ gender }, tt]);
    assert.deepStrictEqual(['female', 'male', ''].map(word), ['Women', 'Men', '']);
    assert.ok(/\{finishedGenderRank \? \(\n\s*<View style=\{\[resultListStyle\.statCol, resultListStyle\.statColMid\]\}>\n\s*<Text style=\{resultListStyle\.statLabel\}[^>]*numberOfLines=\{3\}>\n\s*\{\[t\('allrace:race\.rank'\), genderWord\]\.filter\(Boolean\)\.join\(' '\)\}/.test(s), 'RANK WOMEN / MEN label (short word: fits the middle column — audit27)');
    assert.ok(/<Text style=\{resultListStyle\.statVal\}[^>]*>\{finishedGenderRank\}<\/Text>/.test(s), 'rank value (one line, shrinks to fit — audit33)');
    assert.ok(/prev\.item\.finish_rank_gender === next\.item\.finish_rank_gender/.test(s), 'repaints when the rank arrives');
  });

  test('live card: UTMB index is a compact line in the name column, not a 15pt row from the card edge', () => {
    const s = read('screens/ResultList/ResultCardLive.tsx');
    const top = s.indexOf('<View style={resultListStyle.cardTop}>');
    const star = s.indexOf('onPress={handleStarPress}');
    const utmb = s.indexOf('<View style={resultListStyle.utmbInline}>');
    assert.ok(top > 0 && utmb > top && utmb < star, 'inside the identity column');
    assert.ok(/\[resultListStyle\.utmbBadge, resultListStyle\.utmbBadgeCompact\]/.test(s), 'compact badge');
    assert.ok(/<Text style=\{resultListStyle\.utmbInlineValue\}>\{item\.utmb_index\}<\/Text>/.test(s));
    assert.ok(!/utmbValue/.test(s) && !/fontSize: 15 \}\]\}>\{item\.utmb_index\}/.test(s), 'old prominent value gone');
    const st = read('styles/ResultList.styles.ts');
    assert.ok(/fontSize: 13,/.test(block(st, 'utmbInlineValue')), 'small-text size (12 + the 1pt readability bump)');
  });

  test('result list, landscape: filters + statistics scroll with the list (the list had ~no height left)', () => {
    const s = read('screens/ResultList/ResultList.tsx');
    const inList = (isLandscapeView, initialLoad, hasError, n) =>
      expr(s, 'filtersInList', ['isLandscapeView', 'initialLoad', 'hasError', 'displayResults'], [isLandscapeView, initialLoad, hasError, new Array(n)]);
    assert.strictEqual(inList(true, false, false, 5), true, 'landscape with results');
    assert.strictEqual(inList(false, false, false, 5), false, 'portrait unchanged');
    assert.strictEqual(inList(true, true, false, 0), false, 'loading: filters stay on top');
    assert.strictEqual(inList(true, false, true, 5), false, 'error');
    assert.strictEqual(inList(true, false, false, 0), false, 'empty: filters stay so they can be changed');
    assert.ok(/const \{ width, height, (?:fontScale, )?isLandscape: isLandscapeView \} = useDimensions\(\);/.test(s), 'real orientation (width > height)');
    assert.ok(/\n            \{!filtersInList && !stateScrolls && filterHeader\}\n/.test(s), 'fixed above the list otherwise (landscape error / empty: scroll with the state, audit44)');
    assert.ok(/ListHeaderComponent=\{filtersInList \? filterHeader : null\}/.test(s), 'inside the list in landscape');
    const hdr = s.slice(s.indexOf('const filterHeader = ('), s.indexOf('    return (\n        <SafeAreaView'));
    for (const piece of ['filterRow1', 'filterRow2', 'statisticsContainer', 'onCheckpointSelect']) assert.ok(hdr.includes(piece), piece);
    assert.strictEqual((s.match(/resultListStyle\.filterRow1/g) || []).length, 1, 'filters rendered from one place');
  });
};
