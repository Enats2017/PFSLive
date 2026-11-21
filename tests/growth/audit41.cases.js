// Cases added 2026-10-23: the 8 client questions, decided while the client is on
// leave (best option kept in code; each is a small change to revert):
//  1-5  unchanged (KLASSEMENT, RANK WOMEN, Dutch actions / French terms, +1pt,
//       home sub-line) — already covered by audit26 / audit27 / audit28.
//  6    Dutch "sinds vorig punt" (standard Dutch: het punt → vorig).
//  7    dates on the distance / profile event cards in the app's language.
//  8    register: birth date and gender each on their own full-width line.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { textWidth } = require('../../scripts/text-width.cjs');

module.exports = ({ load, test, SRC }) => {
  const read = (rel) => fs.readFileSync(path.join(SRC, rel), 'utf8').replace(/\r/g, '');
  const lang = (ns, l) => JSON.parse(fs.readFileSync(path.join(SRC, 'i18n', ns, `${l}.json`), 'utf8'));
  const tFor = (l) => {
    const common = lang('common', l);
    return (key) => {
      const m = key.match(/^common:months\.(\w+)$/);
      return m ? common.months[m[1]] : key;
    };
  };
  // Hermes (the phone's JS engine) does not parse "25 September 2026"; Node does.
  // Run the formatter with a Date that only understands ISO dates, like the phone.
  const asOnPhone = (fn) => {
    const RealDate = global.Date;
    function PhoneDate(...a) {
      if (a.length === 1 && typeof a[0] === 'string' && !/^\d{4}-\d{2}-\d{2}/.test(a[0])) return new RealDate(NaN);
      return new RealDate(...a);
    }
    PhoneDate.prototype = RealDate.prototype;
    PhoneDate.now = RealDate.now;
    global.Date = PhoneDate;
    try { return fn(); } finally { global.Date = RealDate; }
  };

  test('Q6: Dutch "since last point" labels read "vorig punt" (het punt), no "vorige punt" left anywhere in Dutch', () => {
    const tp = lang('Resultdetails', 'nl').timingPoint;
    assert.strictEqual(tp.segmentDistance, 'Sinds vorig punt');
    assert.strictEqual(tp.segmentElevation, 'Hoogtemeters sinds vorig punt');
    const left = [];
    for (const d of fs.readdirSync(path.join(SRC, 'i18n'))) {
      const f = path.join(SRC, 'i18n', d, 'nl.json');
      if (fs.existsSync(f) && /vorige punt/i.test(fs.readFileSync(f, 'utf8'))) left.push(d);
    }
    assert.deepStrictEqual(left, []);
  });

  test('Q7: the API\'s English "25 September 2026" shows in the app\'s language — "25 septembre 2026" / "25 september 2026" — read without the phone\'s date parser', () => {
    const { formatEventDate } = load('utils/dateFormatter');
    const got = asOnPhone(() => ({
      fr: formatEventDate('25 September 2026', tFor('fr')),
      nl: formatEventDate('25 September 2026', tFor('nl')),
      en: formatEventDate('25 September 2026', tFor('en')),
      lead0: formatEventDate('05 March 2027', tFor('fr')),
      iso: formatEventDate('2026-08-01', tFor('nl')),
      junk: formatEventDate('TBA', tFor('fr')),
    }));
    assert.deepStrictEqual(got, {
      fr: '25 septembre 2026', nl: '25 september 2026', en: '25 September 2026',
      lead0: '5 mars 2027', iso: '1 augustus 2026', junk: 'TBA',
    });
  });

  test('Q7: French and Dutch month names are lower case (they sit inside a date); English keeps capitals', () => {
    for (const l of ['fr', 'nl']) {
      const m = lang('common', l).months;
      assert.deepStrictEqual(Object.values(m).filter((x) => x !== x.toLowerCase()), [], l);
    }
    assert.strictEqual(lang('common', 'en').months.september, 'September');
  });

  test('Q7: every server-formatted date the app shows goes through the translation (distance cards ×3, profile event cards ×2)', () => {
    const bad = [];
    const walk = (dir) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) { if (e.name !== 'i18n') walk(p); continue; }
        if (!/\.tsx$/.test(e.name)) continue;
        const s = fs.readFileSync(p, 'utf8').replace(/\r/g, '').replace(/\/\/[^\n]*|\{\/\*[\s\S]*?\*\/\}/g, '');
        for (const m of s.matchAll(/race_date_formatted/g)) {
          const before = s.slice(Math.max(0, m.index - 40), m.index);
          if (!/formatEventDate\(item\.$/.test(before) && !/item\.race_date_formatted \? formatEventDate\(/.test(s.slice(m.index - 5, m.index + 60))) {
            bad.push(`${path.relative(SRC, p)}:${s.slice(0, m.index).split('\n').length}`);
          }
        }
      }
    };
    walk(SRC);
    assert.deepStrictEqual(bad, []);
    for (const f of ['screens/EventDetails/DistanceTab.tsx', 'screens/FollowerDetailsList/DistanceTab.tsx', 'screens/ParticipantEvent/RaceResultScreen.tsx',
      'screens/ProfileScreen/EventCardLive.tsx', 'screens/ProfileScreen/EventCardPast.tsx']) {
      assert.ok(/formatEventDate\(item\.race_date_formatted, t\)/.test(read(f)), f);
    }
  });

  test('Q8: register — birth date and gender each take the full width (French "Date de naissance" fits whole), the name pair still shares a row', () => {
    const r = read('screens/AuthScreens/RegisterScreen.tsx');
    const dob = r.slice(r.lastIndexOf('<View', r.indexOf("label={t('dateOfBirth')}")) - 40, r.indexOf("label={t('register:Gender.gender')}"));
    assert.ok(!/pairRowStyle|pairHalfStyle/.test(dob), 'birth date / gender not in a pair row');
    assert.strictEqual((r.match(/<View style=\{pairRowStyle\}>/g) || []).length, 1, 'the name pair still pairs');
    // resting label room: field − 44 (calendar icon) − 40 (right icon), 20pt gutters, 12pt between halves
    const label = textWidth('Date de naissance', 'fonts.body', 15);
    const room = (field) => field - 44 - 40;
    assert.ok(label > room((393 - 40 - 12) / 2), 'side by side at 393pt it was cut ("…")');
    for (const W of [320, 360, 393, 430]) {
      for (const s of [1, 1.12]) assert.ok(label * s <= room(W - 40), `full width ${W}pt ×${s}`);
    }
  });
};
