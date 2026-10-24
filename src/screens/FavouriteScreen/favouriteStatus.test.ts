/**
 * Tests for favouriteStatus.ts. Run: npm run test:favourite-status
 *
 * No test framework in this repo - plain asserts, exit code 1 on failure.
 * The participant_status values are the ones get_favourite_api.php (the app's
 * GET_FAVOURITES) emits: DNF/DNS/DSQ from Pos., 'finished', 'in_progress', 'not_started'.
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { favouriteRunnerStatus, FavouriteStatusInput } from './favouriteStatus';

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

// The card passes the whole FavouriteItem; START always "crossed" with the gun
// time, as RR fills it for every entrant (rr_result_3_18: Started=0, "16:00:00").
const cp = (o: { start?: boolean; finish?: boolean; crossed: boolean }) => ({
  name: o.start ? 'START' : o.finish ? 'FIN' : '8,3km', is_crossed: o.crossed, is_start: !!o.start, is_finish: !!o.finish,
});
const item = (ps: string | undefined, race: 'not_started' | 'in_progress' | 'finished', hasStarted?: boolean): FavouriteStatusInput =>
  ({ participant_status: ps as string, race_status: race, has_started: hasStarted,
     checkpoints: [cp({ start: true, crossed: true }), cp({ crossed: false }), cp({ finish: true, crossed: false })] } as FavouriteStatusInput);

console.log('== runner status on the Favourites card ==');

test('100 km finisher while the distance is still in progress → Finished (was: In progress until 23:59)', () => {
  assert.strictEqual(favouriteRunnerStatus(item('finished', 'in_progress')), 'finished');
});
test('runner still on course after end_time (distance "finished") → In progress (was: Finished)', () => {
  assert.strictEqual(favouriteRunnerStatus(item('in_progress', 'finished')), 'in_progress');
});
test('DNF / DNS / DSQ mid-race → shown as such (was: In progress)', () => {
  for (const s of ['DNF', 'DNS', 'DSQ']) assert.strictEqual(favouriteRunnerStatus(item(s, 'in_progress')), s);
});
test('between the start and CP1 (API says not_started) → In progress while the distance runs (unchanged)', () => {
  assert.strictEqual(favouriteRunnerStatus(item('not_started', 'in_progress')), 'in_progress');
});
test('no-show after the distance ended, START filled with the gun time by RR → Not started, not "In progress"', () => {
  assert.strictEqual(favouriteRunnerStatus(item('not_started', 'finished', false)), 'not_started');
});
test('STARTED (RR Started=1) but no split yet → never "Not started", in every distance state', () => {
  for (const race of ['not_started', 'in_progress', 'finished'] as const) {
    assert.strictEqual(favouriteRunnerStatus(item('not_started', race, true)), 'in_progress', race);
  }
});
test('has_started never overrides a real status (finished / DNF stay as they are)', () => {
  assert.strictEqual(favouriteRunnerStatus(item('finished', 'in_progress', true)), 'finished');
  assert.strictEqual(favouriteRunnerStatus(item('DNF', 'finished', true)), 'DNF');
});
test('before the gun with START pre-filled → Not started (START is never trusted)', () => {
  assert.strictEqual(favouriteRunnerStatus(item('not_started', 'not_started')), 'not_started');
});
test('before the gun → Not started (unchanged)', () => {
  assert.strictEqual(favouriteRunnerStatus(item('not_started', 'not_started')), 'not_started');
});
test('distance over, runner never crossed anything → Not started (was: Finished)', () => {
  assert.strictEqual(favouriteRunnerStatus(item('not_started', 'finished')), 'not_started');
});
test('participant_status missing or blank (older API, local row) → falls back to the distance status', () => {
  assert.strictEqual(favouriteRunnerStatus(item(undefined, 'in_progress')), 'in_progress');
  assert.strictEqual(favouriteRunnerStatus(item('  ', 'finished')), 'finished');
});
test('no checkpoints array → no crash', () => {
  assert.strictEqual(favouriteRunnerStatus({ participant_status: 'not_started', race_status: 'not_started' }), 'not_started');
});
test('every status it can return has a label in resultdetails en/fr/nl', () => {
  const dir = path.join(process.cwd(), 'src', 'i18n', 'Resultdetails');   // folder is capitalised (case-sensitive on macOS/Linux)
  for (const l of ['en', 'fr', 'nl']) {
    const st = JSON.parse(fs.readFileSync(path.join(dir, `${l}.json`), 'utf8')).status;
    for (const s of ['not_started', 'in_progress', 'finished', 'DNF', 'DNS', 'DSQ']) assert.ok(st && st[s], `${l}: status.${s}`);
  }
});
test('FavouriteCard uses it for the badge colour, label and the not-started switch (not item.race_status)', () => {
  const src = fs.readFileSync(path.join(process.cwd(), 'src', 'screens', 'FavouriteScreen', 'FavouriteCard.tsx'), 'utf8');
  assert.ok(/favouriteRunnerStatus\(item\)/.test(src), 'helper called');
  assert.ok(/getStatusColors\(runnerStatus\)/.test(src), 'colour');
  assert.ok(/resultdetails:status\.\$\{runnerStatus\}/.test(src), 'label');
  assert.ok(/const isNotStarted = runnerStatus === 'not_started'/.test(src), 'not-started switch');
  assert.ok(!/getStatusColors\(item\.race_status\)|status\.\$\{item\.race_status\}/.test(src), 'no distance-status badge left');
  assert.ok(/prev\.item\.participant_status === next\.item\.participant_status/.test(src), 'memo re-renders on a status change');
  assert.ok(/prev\.item\.has_started === next\.item\.has_started/.test(src), 'memo re-renders when the runner starts');
  assert.ok(/\[item\.participant_status, item\.race_status, item\.has_started\]/.test(src), 'status recomputed when has_started changes');
});

// has_started must come from the endpoint the card is actually fed by. The
// 2026-10-23 server fix went into get_favourite_all_events_api.php (the web's),
// so the app card never received it (re-check 2026-10-24, larssie df4426e11).
test('the card is fed by GET_FAVOURITES = get_favourite_api.php — the PHP file that must send has_started', () => {
  const read = (...p: string[]) => fs.readFileSync(path.join(process.cwd(), 'src', ...p), 'utf8');
  assert.ok(/favouritesApi\.getFavourites\(/.test(read('screens', 'FavouriteScreen', 'FavouriteList.tsx')), 'FavouriteList loads through favouritesApi');
  assert.ok(/getApiEndpoint\(API_CONFIG\.ENDPOINTS\.GET_FAVOURITES\)/.test(read('services', 'favourites.ts')), 'favouritesApi posts to GET_FAVOURITES');
  assert.ok(/GET_FAVOURITES:\s*"\/get_favourite_api\.php"/.test(read('constants', 'config.ts')), 'GET_FAVOURITES is get_favourite_api.php');
  assert.ok(/has_started\?: boolean/.test(read('services', 'favourites.ts')), 'FavouriteItem declares has_started');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
