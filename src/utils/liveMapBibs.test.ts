/**
 * Tests for liveMapBibs.ts. Run: npm run test:live-map-bibs
 *
 * No test framework in this repo - plain asserts, exit code 1 on failure.
 * The map is the shape useFollowManager builds from followStorage's
 * 'followed_bibs_by_product' (product_app_id → bibs).
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { followedBibsForEvent, liveTrackingBibsParam } from './liveMapBibs';

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
test('a bib stored as a NUMBER (raw JSON from storage) is sent as text', () => {
  const raw = new Map([[20, new Set([450 as unknown as string, '1A'])]]);
  assert.deepStrictEqual(followedBibsForEvent(raw, 20, 'partner'), ['1A', '450']);
});
test('blank bibs are dropped', () => {
  assert.deepStrictEqual(followedBibsForEvent(new Map([[20, new Set([' ', '450 '])]]), 20, 'partner'), ['450']);
});
test('the same bib with and without spaces is sent once', () => {
  assert.deepStrictEqual(followedBibsForEvent(new Map([[20, new Set([' 450', '450', '450 ', '12'])]]), 20, 'partner'), ['12', '450']);
});

console.log('== the `bibs` request field ==');

test('bibs followed → comma list (what the API sanitises and resolves)', () => {
  assert.strictEqual(liveTrackingBibsParam(['170C', '1A', '450'], 'partner'), '170C,1A,450');
  assert.strictEqual(liveTrackingBibsParam(['450'], undefined), '450');
});
test('none followed → field left out, so the request is exactly the old one', () => {
  assert.strictEqual(liveTrackingBibsParam([], 'partner'), null);
});
test('custom event → field left out even if bibs were passed', () => {
  assert.strictEqual(liveTrackingBibsParam(['450'], 'custom'), null);
});

// The screen and the hook need React / Expo to run, so their wiring is checked
// in the source: a refactor that drops it fails here, not silently on a race day.
console.log('== wiring (source) ==');
const src = (p: string) => fs.readFileSync(path.join(process.cwd(), 'src', p), 'utf8');

test('LiveTrackingScreen sends this event\'s followed bibs with every live-tracking request', () => {
  const s = src('screens/LiveTrackingScreen.tsx');
  assert.ok(/const \{ followedUsers, followedBibs \} = useFollowManager\(t\)/.test(s), 'reads followedBibs from useFollowManager');
  assert.ok(/followedBibsForEvent\(followedBibs, product_app_id, event_source\)/.test(s), 'filters them to this event');
  assert.ok(/getLiveTrackingData\([^)]*event_source,\s*eventBibs\s*\)/.test(s), 'passes eventBibs to getLiveTrackingData');
  assert.ok(/usersArray\.length > 0 \|\| eventBibs\.length > 0/.test(s), 'first load also starts for a bib-only follower');
  assert.ok(/\}, \[followedUsers, eventBibsKey, product_option_value_app_id\]\)/.test(s), 'first-load effect re-arms when the bibs arrive');
  assert.ok(/\}, \[eventBibsKey, loading\]\)/.test(s), 'a bib follow change refreshes the map, also once a load in flight ends');
  assert.ok(/sentBibsKey\.current === eventBibsKey\) return;/.test(s), 'no extra request when the bibs were already sent');
  const set = s.indexOf('sentBibsKey.current = eventBibsKey;');
  assert.ok(set > 0 && set < s.indexOf('await liveTrackingService.getLiveTrackingData('), 'every request records the bibs it carries');
});
test('liveTrackingService puts the field on the request via liveTrackingBibsParam', () => {
  const s = src('services/liveTrackingService.ts');
  assert.ok(/followedBibs: string\[\] = \[\]/.test(s), 'optional last parameter, old callers unchanged');
  assert.ok(/liveTrackingBibsParam\(followedBibs, eventSource\)/.test(s));
  assert.ok(/requestBody\.bibs = bibsParam/.test(s));
});
test('useFollowManager sets followed users AFTER the bib read (one render with both)', () => {
  const s = src('hooks/useFollowManager.ts');
  const read = s.indexOf('AsyncStorage.getItem("followed_bibs_by_product")');
  const setUsers = s.indexOf('setFollowedUsers(new Set(customers))');
  const setBibs = s.indexOf('setFollowedBibs(bibMap)');
  assert.ok(read > 0 && setUsers > read && setBibs > setUsers, `read ${read} < setUsers ${setUsers} < setBibs ${setBibs}`);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
