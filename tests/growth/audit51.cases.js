// Cases added 2026-11-13 from the EAS simulator tour of preview build cff559da:
//  1. Home "Upcoming events" listed races that are LIVE today with no hint —
//     event_list_api.php's upcoming tab is `race_date >= today`, so today's
//     races sit in it; the live tab of the same response carries event_status.
//  2. EventDetails info box said Tap "Live Tracking" while the button reads
//     "Live tracking" (en only; fr/nl already quote their own button label).
const assert = require('assert');
const fs = require('fs');
const path = require('path');

module.exports = ({ M, load, test, SRC }) => {
  const read = (rel) => fs.readFileSync(path.join(SRC, rel), 'utf8').replace(/\r/g, '');
  const json = (rel) => JSON.parse(fs.readFileSync(path.join(SRC, rel), 'utf8'));
  const walk = (n, out = []) => {
    if (!n || typeof n !== 'object') return out;
    if (Array.isArray(n)) { n.forEach((c) => walk(c, out)); return out; }
    out.push(n); walk(n.children || [], out); return out;
  };

  // ── 1. live races on Home's upcoming row ──────────────────────────────────
  const withEvents = async (tabs, fn) => {
    const ev = load('services/eventService').eventService;
    const orig = ev.getEvents;
    ev.getEvents = async () => ({ tabs });
    try { return await fn(load('components/Home/IdleHome')); } finally { ev.getEvents = orig; }
  };

  test('IdleHome loader: an upcoming race the live tab calls live is tagged live; others untouched', async () => {
    await withEvents({
      live: [
        { product_app_id: 2, event_status: 'live' },
        { product_app_id: 3, event_status: 'upcoming' },
        { product_app_id: 9, event_status: 'finished' },
      ],
      upcoming: [{ product_app_id: '2' }, { product_app_id: 3 }, { product_app_id: 4 }],
    }, async (mod) => {
      const out = await mod.loadUpcomingEvents(10);
      assert.deepStrictEqual(out, [
        { product_app_id: '2', event_status: 'live' }, // id type differs (string vs number) — still matched
        { product_app_id: 3 },                          // live tab says 'upcoming' → no tag
        { product_app_id: 4 },                          // not in the live window → no tag
      ]);
    });
  });
  test('…no live tab in the response → upcoming list returned as before; still capped at 5', async () => {
    const up = [1, 2, 3, 4, 5, 6].map((id) => ({ product_app_id: id }));
    await withEvents({ upcoming: up }, async (mod) => {
      assert.deepStrictEqual(await mod.loadUpcomingEvents(10), up.slice(0, 5));
    });
    await withEvents({}, async (mod) => assert.deepStrictEqual(await mod.loadUpcomingEvents(10), []));
  });
  test('…the API input is not mutated (tagging copies the row)', async () => {
    const row = { product_app_id: 2 };
    await withEvents({ live: [{ product_app_id: 2, event_status: 'live' }], upcoming: [row] }, async (mod) => {
      await mod.loadUpcomingEvents(10);
      assert.deepStrictEqual(row, { product_app_id: 2 });
    });
  });

  test('IdleHome (rendered): LIVE badge (lime, caps) on the live tile only', () => {
    const prev = M.useStateMap;
    M.useStateMap = (x) => (Array.isArray(x) && x.length === 0
      ? [{ product_app_id: 2, name: 'Live one', event_status: 'live', race_date: '2026-11-13', city: 'Charleroi' },
         { product_app_id: 4, name: 'Later one', race_date: '2026-11-20', city: 'Gent' }]
      : x);
    try {
      const mod = load('components/Home/IdleHome');
      const C = mod.IdleHome.type || mod.IdleHome;
      const nodes = walk(C({}));
      const tiles = nodes.filter((n) => n.props && typeof n.props.onPress === 'function' && n.props.accessibilityRole === 'button');
      const badges = (tile) => walk(tile.children).filter((n) => n.props && n.props.label === 'livetracking:raceState_live');
      // tiles[0] is "Find a race"; the event tiles follow
      assert.strictEqual(tiles.length, 3, 'find-a-race + 2 event tiles');
      assert.strictEqual(badges(tiles[1]).length, 1, 'live tile badged');
      assert.strictEqual(badges(tiles[1])[0].props.tone, 'lime');
      assert.strictEqual(badges(tiles[1])[0].props.caps, true);
      assert.strictEqual(badges(tiles[2]).length, 0, 'upcoming tile not badged');
    } finally { M.useStateMap = prev; }
  });
  test('…badge label key exists in en / fr / nl livetracking', () => {
    for (const l of ['en', 'fr', 'nl']) assert.ok(json(`i18n/livetracking/${l}.json`).raceState_live, l);
    assert.ok(/useTranslation\(\['readiness', 'common', 'livetracking'\]\)/.test(read('components/Home/IdleHome.tsx')));
  });

  // ── 2. connect info quotes the real button label ─────────────────────────
  test('EventDetails connectInfo quotes the Live tracking button label exactly (en / fr / nl)', () => {
    for (const l of ['en', 'fr', 'nl']) {
      const j = json(`i18n/EventDetails/${l}.json`);
      assert.ok(j.connectInfo.includes(j.button), `${l}: "${j.button}" not quoted in connectInfo`);
    }
  });

  // ── 3. result card race time: readable colour ────────────────────────────
  test('ResultCardLive: race-time value is ink on the white card, never lime text', () => {
    const s = read('screens/ResultList/ResultCardLive.tsx');
    const at = s.indexOf('{lastCrossed?.race_time || item.time ||');
    const val = s.slice(s.lastIndexOf('<Text', at), at);
    assert.ok(/lastCrossed\?\.race_time \? palette\.ink : palette\.placeholder/.test(val), 'value is ink');
    assert.ok(!/palette\.lime/.test(val), 'no lime text');
  });

  // ── 4. "FIN (RACE / TIME)": the label is not split mid-phrase ───────────────
  // Same column model as audit27 (card margin xl + padding lg each side, 3
  // columns with gap md; side column paddingLeft sm + 1 rule), measured with the
  // app's own font. Breaks ONLY at ordinary spaces — U+00A0 glues, as on the phone.
  const { textWidth } = require('../../scripts/text-width.cjs');
  const SPACE = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20 };
  const block = (src, name) => src.match(new RegExp('\\n\\s*' + name + ': \\{([^}]*)\\}'))[1];
  const num = (b, prop) => {
    const m = b.match(new RegExp('(?:^|[\\s,{])' + prop + ':\\s*(space\\.\\w+|[\\d.]+)'));
    return m[1].startsWith('space.') ? SPACE[m[1].slice(6)] : Number(m[1]);
  };
  const sideCol = (W) => {
    const st = read('styles/ResultList.styles.ts');
    const card = block(st, 'cardWithLeftBorder');
    const col = (W - 2 * num(card, 'marginHorizontal') - 2 * num(card, 'padding') - 2 * num(block(st, 'statsRow'), 'gap')) / 3;
    return col - num(block(st, 'statColLeft'), 'paddingLeft') - 1;
  };
  const lb = block(read('styles/ResultList.styles.ts'), 'statLabel');
  const LBL = ['Inter_600SemiBold', num(lb, 'fontSize'), { letterSpacing: num(lb, 'letterSpacing'), upper: true }];
  assert.strictEqual(lb.match(/fontFamily:\s*(fonts\.\w+)/)[1], 'fonts.bodySemi', 'statLabel font is Inter SemiBold');
  const wrap = (text, w) => {
    const lines = []; let cur = '';
    for (const word of text.split(/ +/).filter(Boolean)) {
      if (textWidth(word, ...LBL) > w) return null; // would break mid-word
      const next = cur ? cur + ' ' + word : word;
      if (textWidth(next, ...LBL) <= w) cur = next; else { lines.push(cur); cur = word; }
    }
    lines.push(cur); return lines;
  };
  const WIDTHS = [360, 375, 393, 430, 440, 480, 600, 744, 834, 1024];
  const raceTime = (l) => json(`i18n/ResultList/${l}.json`).race.raceTime;

  test('race-time label (en / nl): words glued with U+00A0 so "(RACE TIME)" never splits', () => {
    assert.strictEqual(raceTime('en'), 'Race time');
    assert.strictEqual(raceTime('nl'), 'Race tijd');
  });
  test('…at 360-1024pt "FIN (RACE TIME)" is ≤ 2 lines and the bracket phrase is whole on one line (en / nl)', () => {
    const bad = [];
    for (const W of WIDTHS) for (const l of ['en', 'nl']) {
      const rt = raceTime(l);
      for (const cp of ['FIN', 'KM 10', 'Start']) {
        const lines = wrap(`${cp} (${rt})`, sideCol(W));
        if (!lines) { bad.push(`${W} ${l} "${cp}" breaks mid-word`); continue; }
        if (lines.length > (cp === 'FIN' ? 2 : 3)) bad.push(`${W} ${l} "${cp}" → ${lines.length} lines`);
        if (!lines.some((x) => x.includes(`(${rt})`))) bad.push(`${W} ${l} "${cp}" bracket split: ${JSON.stringify(lines)}`);
      }
      // the label alone (no checkpoint crossed yet) still fits in one line
      if ((wrap(rt, sideCol(W)) || []).length !== 1) bad.push(`${W} ${l} "${rt}" alone not 1 line`);
    }
    assert.deepStrictEqual(bad, []);
  });
  test('…fr keeps ordinary spaces: "(TEMPS DE COURSE)" is wider than the 360pt column, glued it would break mid-word', () => {
    assert.ok(!raceTime('fr').includes(' '));
    assert.ok(textWidth('(Temps de course)'.replace(/ /g, ' '), ...LBL) > sideCol(360));
    assert.ok(wrap(`FIN (${raceTime('fr')})`, sideCol(360)).length <= 3, 'fr still within its 3 lines');
  });
};
