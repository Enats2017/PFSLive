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

console.log(`\nACTIVATION TOTAL: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
