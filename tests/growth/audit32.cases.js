// Cases added 2026-10-22 (confirmation pass after the device-test fixes): an
// app-wide scan for text that cannot grow or is cut, at the default size and
// with larger iOS text (Settings → Accessibility → Larger Text, ×1.12 per step).
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { textWidth } = require('../../scripts/text-width.cjs');

module.exports = ({ test, SRC }) => {
  const read = (rel) => fs.readFileSync(path.join(SRC, rel), 'utf8').replace(/\r/g, '');
  const files = [];
  (function walk(d) {
    for (const f of fs.readdirSync(d)) {
      const p = path.join(d, f);
      if (fs.statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(f) && !/\.test\./.test(f)) files.push(p);
    }
  })(SRC);
  const src = Object.fromEntries(files.map((p) => [p, fs.readFileSync(p, 'utf8').replace(/\r/g, '')]));
  const rel = (p) => path.relative(SRC, p).replace(/\\/g, '/');

  test('no element that holds text has a fixed height anywhere in the app (stylesheet var.key resolved, OTP digit boxes excepted)', () => {
    // stylesheet variable → { key: fixed height } (16-120pt, not a square icon box)
    const sheets = {};
    for (const [p, s] of Object.entries(src)) {
      const creates = [...s.matchAll(/const\s+(\w+)(?:\s*:[^=]+)?\s*=\s*StyleSheet\.create\(/g)];
      creates.forEach((c, i) => {
        const body = s.slice(c.index, i + 1 < creates.length ? creates[i + 1].index : s.length);
        const map = {};
        for (const m of body.matchAll(/\n\s*([A-Za-z0-9_]+):\s*\{([^{}]*)\}/g)) {
          const h = m[2].match(/(?:^|[\s,])height:\s*(\d+)/);
          if (!h || +h[1] < 16 || +h[1] > 120) continue;
          const w = m[2].match(/(?:^|[\s,])width:\s*(\d+)/);
          if (w && w[1] === h[1]) continue;
          map[m[1]] = +h[1];
        }
        sheets[`${p}|${c[1]}`] = map;
      });
    }
    const resolve = (file, v) => {
      if (sheets[`${file}|${v}`]) return sheets[`${file}|${v}`];
      const s = src[file];
      const im = s.match(new RegExp('import\\s*\\{[^}]*\\b(\\w+)\\s+as\\s+' + v + '\\b[^}]*\\}\\s*from\\s*[\'"]([^\'"]+)[\'"]'))
        || s.match(new RegExp('import\\s*\\{[^}]*\\b(' + v + ')\\b[^}]*\\}\\s*from\\s*[\'"]([^\'"]+)[\'"]'));
      if (!im) return null;
      let target = path.resolve(path.dirname(file), im[2]);
      for (const ext of ['.ts', '.tsx']) if (src[target + ext]) { target += ext; break; }
      return sheets[`${target}|${im[1]}`] || null;
    };
    const found = [];
    for (const [p, s] of Object.entries(src)) {
      if (!/\.tsx$/.test(p)) continue;
      for (const m of s.matchAll(/style=\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/g)) {
        for (const ref of m[1].matchAll(/\b([A-Za-z_]\w*)\.([A-Za-z_]\w*)\b/g)) {
          const sheet = resolve(p, ref[1]);
          if (!sheet || !(ref[2] in sheet)) continue;
          const start = s.lastIndexOf('<', m.index);
          const tag = (s.slice(start + 1).match(/^([A-Za-z.]+)/) || [])[1];
          if (!tag) continue;
          const openEnd = s.indexOf('>', m.index + m[0].length - 1);
          const close = s[openEnd - 1] === '/' ? -1 : s.indexOf('</' + tag + '>', openEnd);
          const inner = close > 0 ? s.slice(openEnd, close) : '';
          if (tag === 'Text' || tag === 'TextInput' || /<Text\b|<TextInput\b/.test(inner)) found.push(`${rel(p)} ${ref[1]}.${ref[2]}`);
        }
      }
    }
    // one digit in a 56pt box: room even at the largest text size
    const allowed = ['screens/AuthScreens/ForgotPasswordScreen/OtpStep.tsx forgotStyles.otpInput', 'screens/AuthScreens/OTPVerificationScreen.tsx optStyles.otpInput'];
    assert.deepStrictEqual([...new Set(found)].sort(), allowed.sort());
  });

  test('country field and rank circle grow too (minHeight)', () => {
    assert.ok(/minHeight: 56,\s*paddingVertical: 4,/.test(read('components/CountrySelector.tsx')), 'country field');
    const rc = read('styles/ResultList.styles.ts').match(/\n\s*rankCircle: \{([^}]*)\}/)[1];
    assert.ok(/minHeight: 34,/.test(rc) && !/(?:^|[\s,])height:/.test(rc), 'rank circle');
  });

  test('result cards: the bib and start-wave lines take 2 lines — "Numéro de dossard 12345" lost the number at larger text', () => {
    for (const f of ['ResultCard', 'ResultCardBeforeRace', 'ResultCardLive']) {
      const s = read(`screens/ResultList/${f}.tsx`);
      assert.ok(/<Text style=\{resultListStyle\.bibText\} numberOfLines=\{2\}>\n\s*\{`\$\{t\('allrace:race\.bibNumber'\)\}/.test(s), f + ' bib');
      assert.ok(/<Text style=\{resultListStyle\.bibTextTight\} numberOfLines=\{2\}>\n\s*\{formatWave\(/.test(s), f + ' wave');
    }
    // the bib line at ×1.35 needs two lines of the ~174pt name column on a 360pt phone, never three
    const w = textWidth('Numéro de dossard 12345', 'fonts.body', 13) * 1.35;
    assert.ok(w > 174 && w <= 2 * 174, String(w));
    assert.ok(/<Text style=\{\[favstyle\.nationText, favstyle\.metaLine\]\} numberOfLines=\{2\}>/.test(read('screens/FavouriteScreen/FavouriteCard.tsx')), 'favourites bib line');
  });

  test('FINISH / ETA FINISH headings may take 2 lines (live card ×2, favourites)', () => {
    const live = read('screens/ResultList/ResultCardLive.tsx');
    assert.strictEqual((live.match(/numberOfLines=\{3\}>\n\s*\{finishCp\?\.is_crossed \? t\('allrace:race\.finish'\)/g) || []).length, 2);   // 3 since the full audit
    assert.ok(/<Text style=\{favstyle\.statLabel\} maxFontSizeMultiplier=\{1\} numberOfLines=\{3\}>\n\s*\{finishCp\?\.is_crossed/.test(read('screens/FavouriteScreen/FavouriteCard.tsx')));
  });

  test('3-column stat grids: headings keep their size (maxFontSizeMultiplier 1) — at ×1.12 CLASSEMENT / KLASSEMENT broke mid-word; values still scale', () => {
    let n = 0;
    for (const f of ['screens/ResultList/ResultCard.tsx', 'screens/ResultList/ResultCardBeforeRace.tsx', 'screens/ResultList/ResultCardLive.tsx',
      'screens/ResultList/ResultList.tsx', 'screens/FavouriteScreen/FavouriteCard.tsx']) {
      const s = read(f);
      const all = s.match(/<Text style=\{(resultListStyle|favstyle)\.statLabel\}[^>]*>/g) || [];
      assert.ok(all.length > 0, f);
      for (const tag of all) assert.ok(/maxFontSizeMultiplier=\{1\}/.test(tag), f + ': ' + tag);
      n += all.length;
      assert.ok(!/statVal\}[^>]*maxFontSizeMultiplier/.test(s), f + ': values are not capped');
    }
    assert.strictEqual(n, 17);
    // why: one step up (×1.12) the heading no longer fits the column on a 375pt phone
    const side375 = (375 - 72 - 24) / 3 - 9;
    assert.ok(textWidth('KLASSEMENT', 'fonts.bodySemi', 11, { letterSpacing: 0.3, upper: true }) * 1.12 > side375);
    assert.ok(textWidth('KLASSEMENT', 'fonts.bodySemi', 11, { letterSpacing: 0.3, upper: true }) <= side375);
  });

  test('one-line texts that carry a translated label: only the reviewed ones (data lines where "…" on a long value is fine)', () => {
    const found = [];
    for (const [p, s] of Object.entries(src)) {
      if (!/\.tsx$/.test(p)) continue;
      for (const m of s.matchAll(/<Text\b([^>]*?)numberOfLines=\{1\}([^>]*)>([\s\S]*?)<\/Text>/g)) {
        if (/\bt\(/.test(m[3])) found.push(`${rel(p)}:${s.slice(0, m.index).split('\n').length}`);
      }
    }
    const reviewed = [
      // each count is its own item in a wrapping row — the row wraps, the item never needs "…"
      'components/ProfileCard.tsx:90', 'components/ProfileCard.tsx:98', 'components/ProfileCard.tsx:112',
      // nation · age under the favourite's name (the name / bib lines take 2 since the full audit)
      'screens/FavouriteScreen/FavouriteCard.tsx:157',
      // one line that SHRINKS to fit (adjustsFontSizeToFit), never "…": tab pills, the distance figure
      'screens/FollowerEventList/FollowerEvent.tsx:403', 'screens/ParticipantEvent/ParticipantEvent.tsx:367',
      'screens/HomeScreen.tsx:2999',
      // a checkpoint's km or name in a label / value row
      'screens/ResultDetailsScreen/RaceInfoTab.tsx:264',
      // status value ("In progress" / "Bezig" / "En cours") in a full-width row
      'screens/ResultDetailsScreen/RaceLive.tsx:116', 'screens/ResultDetailsScreen/UpcomingRace.tsx:30',
    ];
    assert.deepStrictEqual(found.sort(), reviewed.sort());
  });
};
