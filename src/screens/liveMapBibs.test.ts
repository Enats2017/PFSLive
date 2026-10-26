/**
 * Tests for liveMapBibs.ts. Run: npm run test:live-map-bibs
 *
 * No test framework in this repo - plain asserts, exit code 1 on failure.
 * The map is the shape useFollowManager builds from followStorage's
 * 'followed_bibs_by_product' (product_app_id → bibs).
 */
import assert from 'assert';
import { followedBibsForEvent } from './liveMapBibs';

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

const follows = new Map<number, Set<string>>([
  [20, new Set(['450', '1A', '170C'])],   // Grizzly100: feedback #31 followed bib 450
  [13, new Set(['450'])],
]);

console.log('== followed bibs sent by the live map ==');

test('partner event: its own bibs, sorted (stable cache key / effect dep)', () => {
  assert.deepStrictEqual(followedBibsForEvent(follows, 20, 'partner'), ['170C', '1A', '450']);
});
test('event_source missing = partner (the route param is optional)', () => {
  assert.deepStrictEqual(followedBibsForEvent(follows, 20, undefined), ['170C', '1A', '450']);
});
test('only this event: bib 450 on event 13 is not sent for event 20 and vice versa', () => {
  assert.deepStrictEqual(followedBibsForEvent(follows, 13, 'partner'), ['450']);
  assert.deepStrictEqual(followedBibsForEvent(new Map([[13, new Set(['9'])]]), 20, 'partner'), []);
});
test('custom event with the same number → nothing (other id space)', () => {
  assert.deepStrictEqual(followedBibsForEvent(follows, 20, 'custom'), []);
});
test('string product id from a route param still matches', () => {
  assert.deepStrictEqual(followedBibsForEvent(follows, '20', 'partner'), ['170C', '1A', '450']);
});
test('no follows / bad id → nothing', () => {
  assert.deepStrictEqual(followedBibsForEvent(new Map(), 20, 'partner'), []);
  assert.deepStrictEqual(followedBibsForEvent(follows, 0, 'partner'), []);
  assert.deepStrictEqual(followedBibsForEvent(follows, NaN, 'partner'), []);
  assert.deepStrictEqual(followedBibsForEvent(follows, null, 'partner'), []);
});
test('blank bibs are dropped', () => {
  assert.deepStrictEqual(followedBibsForEvent(new Map([[20, new Set([' ', '450 '])]]), 20, 'partner'), ['450']);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
