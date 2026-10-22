// Cases added 2026-10-22 (confirmation pass over every client-feedback change):
// gaps the earlier rounds left — the other live-card modes rendered, the new
// "rank" key in every language, the header rendered in portrait / landscape,
// and fixed-size boxes that hold text after the 1pt bump.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { textOf } = require('./harness');

module.exports = ({ M, load, test, SRC }) => {
  const read = (rel) => fs.readFileSync(path.join(SRC, rel), 'utf8').replace(/\r/g, '');
  const lang = (ns, l) => JSON.parse(fs.readFileSync(path.join(SRC, 'i18n', ns, `${l}.json`), 'utf8'));
  const findAll = (n, f, out = []) => {
    if (!n || typeof n !== 'object') return out;
    if (f(n)) out.push(n);
    for (const c of n.children || []) findAll(c, f, out);
    return out;
  };
  const CPS = [
    { name: 'START', is_start: true, is_crossed: true, race_time: '', actual_time: '09:00:00', ranking: '' },
    { name: 'CP1', is_crossed: true, race_time: '01:00:00', actual_time: '10:00:00', ranking: '4' },
    { name: 'FIN', is_finish: true, is_crossed: true, race_time: '02:10:00', actual_time: '11:10:00', ranking: '5' },
  ];
  const item = (over = {}) => ({ bib: '12', name: 'Ann Runner', position: '5', gender: 'female', finish_rank_gender: '2',
    finish_rank_agegroup: '1', category_name: 'SE F', status: 'finished', checkpoints: CPS, utmb_index: '612',
    live_tracking_activated: 0, time: '02:10:00', diff: '00:03:00', ...over });
  const common = { product_app_id: 19, currentPovId: 78, raceStatus: 'in_progress', isFollowed: false, isLoading: false,
    onToggleFollow: () => {}, analyticsScreenName: 'result_list', analyticsRaceName: 'Race' };

  test('the new "rank" word exists in en / fr / nl (Rank / Rang / Plaats) beside "ranking"', () => {
    assert.deepStrictEqual(['en', 'fr', 'nl'].map((l) => lang('ResultList', l).race.rank), ['Rank', 'Rang', 'Plaats']);
    assert.deepStrictEqual(['en', 'fr', 'nl'].map((l) => lang('ResultList', l).race.ranking), ['RANKING', 'CLASSEMENT', 'KLASSEMENT']);
  });

  test('live card, "Results" type during the race (fromLive 0): race time · ranking + category with age-group and women\'s rank; whole card still opens the athlete', () => {
    const Card = load('screens/ResultList/ResultCardLive').default;
    const el = Card({ ...common, item: item(), fromLive: 0, showUtmbIndex: false });
    const txt = textOf(el);
    assert.ok(txt.includes('allrace:race.ranking SE F1 · F 2'), txt);
    assert.ok(!txt.includes('allrace:race.rank '), 'no finished gender-rank column in this mode: ' + txt);
    M.nav.navigations.length = 0;
    el.props.onPress();
    assert.strictEqual(M.nav.navigations[0].name, 'ResultDetails');
  });

  test('live card, checkpoint selected: that point and the next one, then FINISH — unchanged by the redesign of the card', () => {
    const Card = load('screens/ResultList/ResultCardLive').default;
    const el = Card({ ...common, item: item(), fromLive: 1, showUtmbIndex: false, isCheckpointMode: true, selectedCheckpointIndex: 1 });
    const txt = textOf(el);
    assert.ok(txt.includes('CP101:00:00') && txt.includes('FIN02:10:00') && txt.includes('allrace:race.finish11:10'), txt);
    assert.ok(!txt.includes('allrace:race.rank '), txt);
  });

  test('results card during the race (fromLive 1): race time + the UTMB column; no index → a dash, still one badge', () => {
    const Card = load('screens/ResultList/ResultCard').default;
    const withIdx = textOf(Card({ ...common, item: item(), fromLive: 1, showUtmbIndex: true }));
    assert.ok(withIdx.includes('allrace:race.raceTime02:10:00') && withIdx.includes('UTMBallrace:race.utmbIndex612'), withIdx);
    const noIdx = textOf(Card({ ...common, item: item({ utmb_index: '0' }), fromLive: 1, showUtmbIndex: true }));
    assert.ok(noIdx.includes('UTMBallrace:race.utmbIndex-'), noIdx);
    const past = textOf(Card({ ...common, item: item(), fromLive: 0, showUtmbIndex: false, raceStatus: 'finished' }));
    assert.ok(past.includes('allrace:race.diffFirst') && past.includes('allrace:race.ranking SE F') && past.includes('1 · F 2'), past);
  });

  test('header (rendered): portrait keeps the 20pt gutter; iPhone landscape adds the notch insets to the icon row and the band', () => {
    const { AppHeader } = load('components/common/AppHeader');
    const pad = (el) => {
      const bar = findAll(el, (n) => Array.isArray(n.props.style) && n.props.style[1] && 'paddingTop' in n.props.style[1])[0];
      const band = findAll(el, (n) => Array.isArray(n.props.style) && n.props.style[1] && 'paddingLeft' in n.props.style[1] && !('paddingTop' in n.props.style[1]))[0];
      return { top: bar.props.style[1].paddingTop, left: String(bar.props.style[1].paddingLeft), right: String(bar.props.style[1].paddingRight),
        bandLeft: String(band.props.style[1].paddingLeft), title: textOf(band) };
    };
    // the styles module is a stub in this harness: space.xl reads as a name, the inset is appended as a number
    M.window = { width: 393, height: 852 }; M.insets = { top: 59, bottom: 34, left: 0, right: 0 };
    const p = pad(AppHeader({ title: 'Live tracking & results', logoimg: true }));
    assert.strictEqual(p.top, 75, 'status bar + 16');
    assert.ok(/0$/.test(p.left) && /0$/.test(p.right) && /0$/.test(p.bandLeft), JSON.stringify(p));
    assert.strictEqual(p.title, 'Live tracking & results');
    M.window = { width: 852, height: 393 }; M.insets = { top: 0, bottom: 21, left: 59, right: 59 };
    const l = pad(AppHeader({ title: 'x' }));
    assert.strictEqual(l.top, 16);
    assert.ok(/59$/.test(l.left) && /59$/.test(l.right) && /59$/.test(l.bandLeft), JSON.stringify(l));
    M.window = { width: 800, height: 360 }; M.insets = { top: 0, bottom: 0, left: 0, right: 48 };   // Android 3-button
    const a = pad(AppHeader({ title: 'x' }));
    assert.ok(/0$/.test(a.left) && /0$/.test(a.right), 'SafeAreaView pads there — no double: ' + JSON.stringify(a));
  });

  test('fixed-size boxes that hold text still fit it after the 1pt bump (filter tab, rank circle, fix button, step number)', () => {
    const box = (file, name) => {
      const m = read(file).match(new RegExp('\\n\\s*' + name + ': \\{([^}]*)\\}'));
      assert.ok(m, name);
      return m[1];
    };
    const n = (b, p) => Number(b.match(new RegExp(p + ':\\s*(\\d+)'))[1]);
    for (const [file, outer, inner] of [
      ['styles/ResultList.styles.ts', 'filterTab', 'filterTabText'],
      ['styles/ResultList.styles.ts', 'rankCircle', 'rankText'],
      ['styles/readiness.styles.ts', 'fixButton', 'fixButtonText'],
      ['styles/forgetPassword.styles.ts', 'nextNum', 'nextNumText'],
    ]) {
      const h = n(box(file, outer), 'height');
      const size = n(box(file, inner), 'fontSize');
      assert.ok(Math.ceil(size * 1.25) <= h, `${outer} ${h}pt holds ${size}pt text (line ${Math.ceil(size * 1.25)})`);
    }
  });
};
