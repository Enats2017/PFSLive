/**
 * Tests for activationCard.ts. Run: npm run test:activation
 *
 * The cases are the combinations checked against the live DB copy on
 * 2026-10-08 (customer ids in brackets), plus the ones that did not exist yet.
 * No test framework in this repo - plain asserts, exit code 1 on failure.
 */
import assert from 'assert';
import { resolveActivation, ActivationMembershipInfo } from './activationCard';

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  PASS  ${name}`);
  } catch (e) {
    failed++;
    console.log(`  FAIL  ${name}\n        ${(e as Error).message}`);
  }
}

const act = (event_name: string, remaining: number) => ({ event_name, remaining });
// A capped plan (Lite / Pro). Its remaining count does not change where the
// activation goes - 'extra' either way - so it is not an input.
const capped = (extra: Partial<ActivationMembershipInfo> = {}): ActivationMembershipInfo =>
  ({ unlimited: false, event_only: 0, ...extra });

console.log('== activation card ==');

test('no membership info → nothing', () => {
  assert.deepStrictEqual(resolveActivation(null), { placement: null, eventNames: null });
  assert.deepStrictEqual(resolveActivation(undefined), { placement: null, eventNames: null });
});

test('plan without activations → nothing (C, D, E, F)', () => {
  assert.deepStrictEqual(resolveActivation({ unlimited: true }), { placement: null, eventNames: null });
  assert.deepStrictEqual(resolveActivation(capped()), { placement: null, eventNames: null });
});

test('A. one activation, all their cover → primary with its event [3803]', () => {
  assert.deepStrictEqual(
    resolveActivation({ unlimited: false, event_only: 1, event_activations: [act('Limburg Wine Trail', 2)] }),
    { placement: 'primary', eventNames: 'Limburg Wine Trail' });
});

test('B. two activations for two events → BOTH named [3795]', () => {
  assert.deepStrictEqual(
    resolveActivation({ event_only: 1, event_activations: [act('Trail de Bruxelles', 1), act('GTLC Winter', 1)] }),
    { placement: 'primary', eventNames: 'Trail de Bruxelles & GTLC Winter' });
});

test('B2. one of two activations used → only the unused one named', () => {
  assert.deepStrictEqual(
    resolveActivation({ event_only: 1, event_activations: [act('Trail de Bruxelles', 0), act('GTLC Winter', 1)] }),
    { placement: 'primary', eventNames: 'GTLC Winter' });
});

test('activation used, nothing else → nothing (card falls through to "no sessions left")', () => {
  assert.deepStrictEqual(
    resolveActivation({ event_only: 1, event_activations: [act('Limburg Wine Trail', 0)] }),
    { placement: null, eventNames: null });
});

test('two activations for the SAME event → named once', () => {
  assert.strictEqual(
    resolveActivation({ event_only: 1, event_activations: [act('Limburg Wine Trail', 1), act('Limburg Wine Trail', 1)] }).eventNames,
    'Limburg Wine Trail');
});

test('blank event name is skipped, not rendered as " & "', () => {
  assert.deepStrictEqual(
    resolveActivation({ event_only: 1, event_activations: [act('  ', 1), act('GTLC Winter', 1)] }),
    { placement: 'primary', eventNames: 'GTLC Winter' });
});

test('G. unlimited + activation → nothing extra (unlimited already covers that event)', () => {
  assert.deepStrictEqual(
    resolveActivation({ unlimited: true, event_only: 0, event_activations: [act('Limburg Wine Trail', 1)] }),
    { placement: null, eventNames: null });
});

test('H. Pro with sessions left + activation → extra line', () => {
  assert.deepStrictEqual(
    resolveActivation(capped({ event_activations: [act('Limburg Wine Trail', 1)] })),
    { placement: 'extra', eventNames: 'Limburg Wine Trail' });
});

test('I. Pro USED UP + activation → extra line, so the card does not stop at "no sessions left"', () => {
  assert.deepStrictEqual(
    resolveActivation(capped({ event_activations: [act('Limburg Wine Trail', 1)] })),
    { placement: 'extra', eventNames: 'Limburg Wine Trail' });
});

test('older API without event_only / event_activations → nothing', () => {
  assert.deepStrictEqual(resolveActivation({ unlimited: false }), { placement: null, eventNames: null });
});

// ── The copy the card renders (row 8 of the device test plan) ──────────────
// Read from the real en/fr/nl files with i18next's {{placeholder}} rule, so a
// missing key or an unsubstituted placeholder fails here, not on a phone. Paths
// from the project root: `npm run` sets cwd there and the compiled copy of this
// file runs from .cardtest/.
console.log('\n== activation card copy (en / fr / nl) ==');
/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require('fs');
const path = require('path');
const dict = (l: string) =>
  JSON.parse(fs.readFileSync(path.join(process.cwd(), 'src', 'i18n', 'OwnProfile', `${l}.json`), 'utf8'));
const tr = (l: string, key: string, vars: Record<string, string> = {}): string => {
  let node: any = dict(l);
  for (const seg of key.split('.')) node = node?.[seg];
  if (typeof node !== 'string') return key;
  return node.replace(/\{\{(\w+)\}\}/g, (m: string, n: string) => (n in vars ? vars[n] : m));
};
// What OwnProfile.tsx renders for a decision: iOS card line, Android banner line.
const copy = (l: string, mi: ActivationMembershipInfo) => {
  const d = resolveActivation(mi);
  if (d.placement === 'primary') {
    return { ios: tr(l, 'membershipCard.eventOnly', { event: d.eventNames! }),
             android: tr(l, 'tracking.eventOnly', { event: d.eventNames! }) };
  }
  if (d.placement === 'extra') {
    const line = tr(l, 'membershipCard.alsoActivation', { event: d.eventNames! });
    return { ios: line, android: line };
  }
  return { ios: null, android: null };
};
const ONE = { event_only: 1, event_activations: [act('Limburg Wine Trail', 2)] };
const TWO = { event_only: 1, event_activations: [act('Trail de Bruxelles', 1), act('GTLC Winter', 1)] };
const PRO = capped({ event_activations: [act('Limburg Wine Trail', 1)] });

test('plan row "activation only" → "Valid for Limburg Wine Trail only."', () => {
  assert.deepStrictEqual(copy('en', ONE), {
    ios: 'Valid for Limburg Wine Trail only.',
    android: 'Your Livio activation is valid for Limburg Wine Trail.' });
});
test('plan row "two activations" → both events in the line', () => {
  assert.strictEqual(copy('en', TWO).ios, 'Valid for Trail de Bruxelles & GTLC Winter only.');
});
test('plan row "Pro (+ used up) + activation" → "Also valid: …" line', () => {
  assert.strictEqual(copy('en', PRO).ios, 'Also valid: your Livio activation for Limburg Wine Trail.');
});
for (const l of ['en', 'fr', 'nl']) {
  test(`${l}: every activation line resolves (no raw key, no {{placeholder}})`, () => {
    for (const mi of [ONE, TWO, PRO]) {
      for (const v of Object.values(copy(l, mi))) {
        assert.ok(v && !/^[a-zA-Z]+\.[a-zA-Z.]+$/.test(v) && !v.includes('{{'), `${l}: ${v}`);
      }
    }
  });
}
test('fr and nl are translated, not copies of en', () => {
  const en = copy('en', PRO).ios, fr = copy('fr', PRO).ios, nl = copy('nl', PRO).ios;
  assert.ok(fr !== en && nl !== en && fr !== nl, `${fr} | ${nl}`);
});

console.log(`\nACTIVATION TOTAL: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
