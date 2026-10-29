"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Tests for distanceButton.ts. Run: npm run test:distance-button
 *
 * No test framework in this repo - plain asserts, exit code 1 on failure.
 * brusselsDate is checked against Node's own Europe/Brussels zone data, which
 * the app deliberately does not rely on (see distanceButton.ts).
 */
const assert_1 = __importDefault(require("assert"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const distanceButton_1 = require("./distanceButton");
let passed = 0;
let failed = 0;
function test(name, fn) {
    try {
        fn();
        passed++;
        console.log(`  PASS  ${name}`);
    }
    catch (e) {
        failed++;
        console.log(`  FAIL  ${name}\n        ${e.message}`);
    }
}
const at = (iso) => new Date(iso);
console.log('== Brussels date ==');
test('matches Europe/Brussels for every hour 2025-2030 (incl. all clock changes)', () => {
    const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Brussels' });
    const end = Date.UTC(2031, 0, 1);
    let mismatches = 0;
    let first = '';
    for (let t = Date.UTC(2025, 0, 1); t < end; t += 3600000) {
        const d = new Date(t);
        if ((0, distanceButton_1.brusselsDate)(d) !== fmt.format(d)) {
            mismatches++;
            if (!first)
                first = d.toISOString();
        }
    }
    assert_1.default.strictEqual(mismatches, 0, `first mismatch at ${first}`);
});
test('minute-exact around the 2026 changes (29 Mar, 25 Oct)', () => {
    // Spring: 01:00 UTC switches to UTC+2. Midnight Brussels = 23:00 UTC (CET) the night before.
    assert_1.default.strictEqual((0, distanceButton_1.brusselsDate)(at('2026-03-28T22:59:59Z')), '2026-03-28');
    assert_1.default.strictEqual((0, distanceButton_1.brusselsDate)(at('2026-03-28T23:00:00Z')), '2026-03-29');
    // Autumn: on 25 Oct midnight is still CEST (22:00 UTC on the 24th); the next midnight is CET.
    assert_1.default.strictEqual((0, distanceButton_1.brusselsDate)(at('2026-10-24T21:59:59Z')), '2026-10-24');
    assert_1.default.strictEqual((0, distanceButton_1.brusselsDate)(at('2026-10-24T22:00:00Z')), '2026-10-25');
    assert_1.default.strictEqual((0, distanceButton_1.brusselsDate)(at('2026-10-25T22:59:59Z')), '2026-10-25');
    assert_1.default.strictEqual((0, distanceButton_1.brusselsDate)(at('2026-10-25T23:00:00Z')), '2026-10-26');
});
console.log('== button label ==');
test('before race day → participants', () => {
    assert_1.default.strictEqual((0, distanceButton_1.distanceButtonKind)('2026-10-25', 'not_started', at('2026-10-20T10:00:00Z')), 'participants');
});
test('race day (Brussels midnight, summer time) → results', () => {
    assert_1.default.strictEqual((0, distanceButton_1.distanceButtonKind)('2026-10-25', 'not_started', at('2026-10-24T21:59:00Z')), 'participants');
    assert_1.default.strictEqual((0, distanceButton_1.distanceButtonKind)('2026-10-25', 'not_started', at('2026-10-24T22:00:00Z')), 'results');
});
test('race day (Brussels midnight, winter time) → results', () => {
    assert_1.default.strictEqual((0, distanceButton_1.distanceButtonKind)('2026-12-05', 'not_started', at('2026-12-04T22:59:00Z')), 'participants');
    assert_1.default.strictEqual((0, distanceButton_1.distanceButtonKind)('2026-12-05', 'not_started', at('2026-12-04T23:00:00Z')), 'results');
});
test('after race day → results', () => {
    assert_1.default.strictEqual((0, distanceButton_1.distanceButtonKind)('2026-10-25', 'not_started', at('2026-10-27T08:00:00Z')), 'results');
});
test('live or finished → results, whatever the date', () => {
    const before = at('2026-10-20T08:00:00Z');
    assert_1.default.strictEqual((0, distanceButton_1.distanceButtonKind)('2026-10-25', 'in_progress', before), 'results');
    assert_1.default.strictEqual((0, distanceButton_1.distanceButtonKind)('2026-10-25', 'finished', before), 'results');
});
test('unknown or empty status falls back to the date', () => {
    const before = at('2026-10-20T10:00:00Z');
    for (const s of ['', 'not_started', 'cancelled', null, undefined]) {
        assert_1.default.strictEqual((0, distanceButton_1.distanceButtonKind)('2026-10-25', s, before), 'participants', String(s));
    }
});
test('race_date with a time part is read by its date', () => {
    assert_1.default.strictEqual((0, distanceButton_1.distanceButtonKind)('2026-10-25 00:00:00', 'not_started', at('2026-10-20T10:00:00Z')), 'participants');
});
test('missing / unreadable date → results (the old label), never participants', () => {
    const before = at('2026-01-01T10:00:00Z');
    for (const d of ['', '   ', '25-10-2026', 'soon', null, undefined]) {
        assert_1.default.strictEqual((0, distanceButton_1.distanceButtonKind)(d, 'not_started', before), 'results', String(d));
    }
});
test('multi-day event: each distance flips on its own date', () => {
    const sat = at('2026-11-07T09:00:00Z'); // Saturday in Brussels
    assert_1.default.strictEqual((0, distanceButton_1.distanceButtonKind)('2026-11-07', 'not_started', sat), 'results');
    assert_1.default.strictEqual((0, distanceButton_1.distanceButtonKind)('2026-11-08', 'not_started', sat), 'participants');
});
test('a phone in another time zone does not matter (input is an instant)', () => {
    // 23:30 on the 24th in New York is 05:30 on the 25th in Brussels → race day.
    assert_1.default.strictEqual((0, distanceButton_1.distanceButtonKind)('2026-10-25', 'not_started', at('2026-10-25T03:30:00Z')), 'results');
});
test('live / finished win even with no date at all', () => {
    const before = at('2026-10-20T10:00:00Z');
    assert_1.default.strictEqual((0, distanceButton_1.distanceButtonKind)('', 'in_progress', before), 'results');
    assert_1.default.strictEqual((0, distanceButton_1.distanceButtonKind)(null, 'finished', before), 'results');
});
test('a date not at the start of the string is not trusted (leading space / prefix) → results', () => {
    const before = at('2026-10-20T10:00:00Z');
    assert_1.default.strictEqual((0, distanceButton_1.distanceButtonKind)(' 2026-10-25', 'not_started', before), 'results');
    assert_1.default.strictEqual((0, distanceButton_1.distanceButtonKind)('x2026-10-25', 'not_started', before), 'results');
});
test('a day still ahead stays participants however close the start', () => {
    // 23:59:59 Brussels the evening before (CEST)
    assert_1.default.strictEqual((0, distanceButton_1.distanceButtonKind)('2026-10-22', 'not_started', at('2026-10-21T21:59:59Z')), 'participants');
});
test('year boundary: 31 Dec evening → 1 Jan race', () => {
    assert_1.default.strictEqual((0, distanceButton_1.distanceButtonKind)('2027-01-01', 'not_started', at('2026-12-31T22:59:59Z')), 'participants');
    assert_1.default.strictEqual((0, distanceButton_1.distanceButtonKind)('2027-01-01', 'not_started', at('2026-12-31T23:00:00Z')), 'results');
});
test('default "now" is the current time (no third argument)', () => {
    assert_1.default.strictEqual((0, distanceButton_1.distanceButtonKind)('2999-01-01', 'not_started'), 'participants');
    assert_1.default.strictEqual((0, distanceButton_1.distanceButtonKind)('2000-01-01', 'not_started'), 'results');
});
console.log('== translations (RaceResult namespace) ==');
const i18nDir = path_1.default.join(process.cwd(), 'src', 'i18n', 'RaceResult');
const readLang = (lang) => JSON.parse(fs_1.default.readFileSync(path_1.default.join(i18nDir, `${lang}.json`), 'utf8'));
test('button.participants / button.results exist and are non-empty in en, fr, nl', () => {
    for (const lang of ['en', 'fr', 'nl']) {
        const b = readLang(lang).button;
        for (const key of ['participants', 'results']) {
            assert_1.default.ok(typeof b[key] === 'string' && b[key].trim().length > 0, `${lang}.button.${key}`);
        }
    }
});
test('agreed wording, uppercase like the other app buttons', () => {
    assert_1.default.deepStrictEqual(['en', 'nl', 'fr'].map((l) => readLang(l).button.participants), ['PARTICIPANTS', 'DEELNEMERS', 'PARTICIPANTS']);
    assert_1.default.deepStrictEqual(['en', 'nl', 'fr'].map((l) => readLang(l).button.results), ['RESULTS', 'RESULTATEN', 'RÉSULTATS']);
});
test('button.result is unchanged (RaceResultScreen still renders it)', () => {
    assert_1.default.deepStrictEqual(['en', 'nl', 'fr'].map((l) => readLang(l).button.result), ['RESULT', 'RESULTAAT', 'RÉSULTAT']);
});
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0)
    process.exit(1);
