// Cases added 2026-10-22 after the device test: with the 1pt bigger text, labels
// ended in "…" on the event detail cards (fr / nl), the result-list filters and
// the profile counts. Every fixed label in those places is measured with the
// app's own fonts at real phone widths, from the values in the styles.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { textWidth } = require('../../scripts/text-width.cjs');

const WIDTHS = [360, 375, 393, 430];
const LANGS = ['en', 'fr', 'nl'];
const SPACE = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 };

module.exports = ({ test, SRC }) => {
  const read = (rel) => fs.readFileSync(path.join(SRC, rel), 'utf8').replace(/\r/g, '');
  const lang = (ns, l) => JSON.parse(fs.readFileSync(path.join(SRC, 'i18n', ns, `${l}.json`), 'utf8'));
  const get = (o, k) => k.split('.').reduce((a, b) => a && a[b], o);
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
  const lineCount = (text, w, f, size) => {
    let n = 1;
    let cur = '';
    for (const word of String(text).split(/\s+/).filter(Boolean)) {
      if (textWidth(word, f, size) > w) return Infinity;
      const next = cur ? cur + ' ' + word : word;
      if (textWidth(next, f, size) <= w) cur = next;
      else { n++; cur = word; }
    }
    return n;
  };

  // ── event detail / past-race distance cards ───────────────────────────
  test('distance cards: buttons are capped (min 130, max 140, 16pt padding) and centre a label that wraps', () => {
    const d = read('styles/details.styles.ts');
    for (const name of ['resultsButton', 'routeButton']) {
      const b = block(d, name);
      assert.deepStrictEqual([num(b, 'minWidth'), num(b, 'maxWidth'), num(b, 'paddingHorizontal')], [130, 140, 16], name);
    }
    for (const name of ['resultsButtonText', 'routeButtonText']) assert.ok(/textAlign: 'center'/.test(block(d, name)), name);
  });

  test('distance cards at 360-430pt: every button label fits in ≤ 2 lines, every date / athlete-count line beside them too — none ends in "…" (en / fr / nl)', () => {
    const d = read('styles/details.styles.ts');
    const rb = block(d, 'resultsButton');
    const pad = num(rb, 'paddingHorizontal');
    const min = num(rb, 'minWidth');
    const max = num(rb, 'maxWidth');
    const BORDER = 3;   // routeButton's 1.5 border, both sides (worst case)
    const btnW = (s) => Math.min(max, Math.max(min, textWidth(s, 'fonts.display', 14) + 2 * pad + BORDER));
    const bad = [];
    for (const W of WIDTHS) for (const l of LANGS) {
      const ev = lang('EventDetails', l);
      const rr = lang('RaceResult', l);
      const cards = {
        'event (not registered)': [[ev.button, ev.gpx, ev.map], 'fonts.bodyMedium', 14],
        'event (registered)': [[ev.undo, ev.gpx, ev.map], 'fonts.bodyMedium', 14],
        'event (register mode)': [[ev.register, ev.gpx, ev.map], 'fonts.bodyMedium', 14],
        'follower': [[get(rr, 'button.participants'), get(rr, 'button.results'), get(rr, 'button.route'), ev.gpx], 'fonts.body', 13],
        'past race': [[get(rr, 'button.result')], 'fonts.bodyMedium', 14],
      };
      for (const [name, [labels, font, size]] of Object.entries(cards)) {
        const col = Math.max(...labels.map(btnW));
        for (const s of labels) {
          const n = lineCount(s, btnW(s) - 2 * pad - BORDER, 'fonts.display', 14);
          if (n > 2) bad.push(`${W} ${l} ${name} button "${s}" → ${n}`);
        }
        // card margin 20 + padding 12 each side, gap 12 · divider 1 · gap 12, icon 16 + gap 8
        const text = W - 40 - 24 - 12 - 1 - 12 - col - 16 - 8;
        for (const s of ['25 September 2026', '01 November 2026', `1234 ${ev.athletes}`, `1234 ${ev.finished}`, `1234 ${ev.dnf}`]) {
          const n = lineCount(s, text, font, size);
          if (n > 2) bad.push(`${W} ${l} ${name} "${s}" → ${n} in ${Math.round(text)}pt`);
        }
      }
    }
    assert.deepStrictEqual(bad, []);
  });

  test('distance cards: the date and the athlete counts have NO line limit on all three screens (1 → "…", and 2 was still cut at larger iOS text)', () => {
    for (const [f, st, red] of [['screens/EventDetails/DistanceTab.tsx', 'detailsStyles.metaText', 'detailsStyles.metaTextRed'],
      ['screens/ParticipantEvent/RaceResultScreen.tsx', 'detailsStyles.metaText', 'detailsStyles.metaTextRed'],
      ['screens/FollowerDetailsList/DistanceTab.tsx', 'commonStyles.subtitle', 'commonStyles.subtitlered']]) {
      const s = read(f);
      // the <Text …> line right before each value: its style, and no numberOfLines
      const openTag = (value) => {
        const i = s.indexOf(value);
        assert.ok(i > 0, f + ' has ' + value);
        const before = s.slice(0, i).trimEnd();
        return before.slice(before.lastIndexOf('<Text'));
      };
      assert.strictEqual(openTag('{item.race_date_formatted}'), '<Text style={' + st + '}>', f + ' date');
      assert.strictEqual(openTag("{item.participant_started_count} {t('details:athletes')}"), '<Text style={' + st + '}>', f + ' started');
      assert.strictEqual(openTag("{item.finished_count} {t('details:finished')}"), '<Text style={' + st + '}>', f + ' finished');
      assert.strictEqual(openTag("{item.dnf_count} {t('details:dnf')}"), '<Text style={' + red + '}>', f + ' dnf');
    }
  });

  // ── result-list filters ────────────────────────────────────────────────
  test('result-list filters: two per row (distance + type, then category + checkpoint)', () => {
    const s = read('screens/ResultList/ResultList.tsx');
    const r1 = s.slice(s.indexOf('<View style={resultListStyle.filterRow1}>'), s.indexOf('<View style={resultListStyle.filterRow2}>'));
    const r2 = s.slice(s.indexOf('<View style={resultListStyle.filterRow2}>'), s.indexOf('<View style={resultListStyle.statisticsContainer}>'));
    assert.ok(/onSelect=\{onDistanceSelect\}\s*style=\{resultListStyle\.filterTabWide\}/.test(r1) && /onSelect=\{onTypeSelect\}/.test(r1), 'row 1');
    assert.ok(/onSelect=\{onCategorySelect\}/.test(r2) && /onSelect=\{onCheckpointSelect\}/.test(r2) && !/onTypeSelect/.test(r2), 'row 2');
    const d = read('components/FilterDropdown.tsx');
    assert.ok(/style=\{\[resultListStyle\.filterTab, style\]\}/.test(d), 'dropdown takes a style');
  });

  test('result-list filters at 360-430pt: every fixed filter label fits on its one line (en / fr / nl)', () => {
    const st = read('styles/ResultList.styles.ts');
    const tab = block(st, 'filterTab');
    const pad = num(tab, 'paddingHorizontal');
    const arrowGap = num(block(st, 'filterArrow'), 'marginLeft');
    const chevron = Number(read('components/FilterDropdown.tsx').match(/name="chevron-down"\s*size=\{(\d+)\}/)[1]);
    const wide = num(block(st, 'filterTabWide'), 'flex');
    const textFont = 'fonts.bodyMedium';
    const size = num(block(st, 'filterTabText'), 'fontSize');
    const inner = (w) => w - 2 * pad - 2 - chevron - arrowGap;   // 1pt border each side
    const bad = [];
    for (const W of WIDTHS) {
      const row = W - 2 * SPACE.xl - SPACE.sm;                       // 20 gutters, gap 8
      const typeW = inner(row / (1 + wide));
      const halfW = inner(row / 2);
      for (const l of LANGS) {
        const f = lang('ResultList', l).filter;
        for (const s of [f.results, f.live]) if (textWidth(s, textFont, size) > typeW) bad.push(`${W} ${l} type "${s}" > ${Math.round(typeW)}`);
        for (const s of [f.favourite, f.liveTracking, f.checkpoint, f.all]) if (textWidth(s, textFont, size) > halfW) bad.push(`${W} ${l} "${s}" > ${Math.round(halfW)}`);
      }
    }
    assert.deepStrictEqual(bad, []);
  });

  // ── profile counts ─────────────────────────────────────────────────────
  test('profile card: races · followers · following wrap to a second row instead of ending in "…"; each count stays whole', () => {
    const s = read('components/ProfileCard.tsx');
    assert.ok(/<View style=\{profileStyles\.identityMetaRow\}>/.test(s), 'wrapping row');
    assert.ok(!/\{'   '\}/.test(s), 'no space-string spacers');
    const row = block(read('styles/Profile.styles.ts'), 'identityMetaRow');
    assert.ok(/flexWrap: 'wrap'/.test(row) && /columnGap: space\.md/.test(row));
    const bad = [];
    for (const W of WIDTHS) {
      const col = W - 2 * SPACE.xl - 72 - SPACE.lg;   // card padding, avatar, gap
      for (const l of LANGS) {
        const p = lang('OwnProfile', l).profile;
        for (const k of ['races', 'followers', 'following']) {
          const t = `12345 ${p[k]}`;
          if (textWidth(t, 'fonts.body', 13) > col) bad.push(`${W} ${l} "${t}"`);
        }
      }
    }
    assert.deepStrictEqual(bad, []);
  });

  test('favourites card: middle stat column matches the result cards (8pt padding, 0.3 letter spacing)', () => {
    const f = read('styles/favourite.style.ts');
    assert.strictEqual(num(block(f, 'statColMid'), 'paddingHorizontal'), 8);
    assert.strictEqual(num(block(f, 'statLabel'), 'letterSpacing'), 0.3);
  });
};
