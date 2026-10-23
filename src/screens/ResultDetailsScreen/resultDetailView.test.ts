/**
 * Tests for resultDetailView.ts. Run: npm run test:result-detail-view
 *
 * No test framework in this repo - plain asserts, exit code 1 on failure.
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { resultDetailRaceStatus, resultDetailView, shouldPollResultDetail, raceLiveStatus } from './resultDetailView';

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

// The rule ResultDetails had inline before 2026-10-23, verbatim.
const oldInline = (raceStatus: string | undefined, participantStatus: string | undefined) =>
  raceStatus === 'in_progress' && (participantStatus === 'in_progress' || participantStatus === 'not_started') ? 'live'
    : raceStatus === 'finished' || (raceStatus === 'in_progress' && participantStatus !== 'not_started' && participantStatus !== 'in_progress') ? 'final'
      : raceStatus === 'not_started' || participantStatus === 'not_started' ? 'upcoming'
        : null;

const RACE = ['not_started', 'in_progress', 'finished', undefined];
const RUNNER = ['not_started', 'in_progress', 'finished', 'DNF', 'DNS', 'DSQ', '', undefined];

console.log('== result detail: which card, and polling ==');

test('opened before the gun, the gun passes → the next response switches the card to live (was: upcoming all race)', () => {
  const before = resultDetailRaceStatus('not_started', 'not_started');
  assert.strictEqual(resultDetailView(before, 'not_started'), 'upcoming');
  const after = resultDetailRaceStatus('not_started', 'in_progress');   // param still the tapped snapshot
  assert.strictEqual(after, 'in_progress');
  assert.strictEqual(resultDetailView(after, 'not_started'), 'live');
});
test('the param is only used until the first response arrives', () => {
  assert.strictEqual(resultDetailRaceStatus('in_progress', undefined), 'in_progress');
  assert.strictEqual(resultDetailRaceStatus('in_progress', ''), 'in_progress');
  assert.strictEqual(resultDetailRaceStatus('in_progress', 'finished'), 'finished');
});
test('a page open before the gun polls (was: never)', () => {
  assert.strictEqual(shouldPollResultDetail('not_started', 'not_started'), true);
});
test('after end_time, runner still on course → live card and polling go on (was: final card, polling stopped)', () => {
  assert.strictEqual(resultDetailView('finished', 'in_progress'), 'live');
  assert.strictEqual(shouldPollResultDetail('finished', 'in_progress'), true);
  assert.strictEqual(raceLiveStatus('finished', 'in_progress'), 'in_progress');
});
test('after end_time, finisher / DNF / never started → final card, no polling (unchanged)', () => {
  for (const ps of ['finished', 'DNF', 'DNS', 'DSQ', 'not_started']) {
    assert.strictEqual(resultDetailView('finished', ps), 'final', ps);
    assert.strictEqual(shouldPollResultDetail('finished', ps), false, ps);
  }
});
test('during the race: polling on for every runner; live header label is the distance status', () => {
  for (const ps of RUNNER) assert.strictEqual(shouldPollResultDetail('in_progress', ps), true);
  assert.strictEqual(raceLiveStatus('in_progress', 'in_progress'), 'in_progress');
  assert.strictEqual(raceLiveStatus(undefined, undefined), 'in_progress', 'old default kept');
});
test('every other status pair gives exactly the old inline rule (only the two intended cases change)', () => {
  const changed: string[] = [];
  for (const rs of RACE) for (const ps of RUNNER) {
    if (resultDetailView(rs, ps) !== oldInline(rs, ps)) changed.push(`${rs}/${ps}`);
  }
  assert.deepStrictEqual(changed, ['finished/in_progress']);
});

const read = (...p: string[]) => fs.readFileSync(path.join(process.cwd(), 'src', ...p), 'utf8');
test('ResultDetails picks the card through these helpers with the LIVE race status', () => {
  const src = read('screens', 'ResultDetailsScreen', 'ResultDetails.tsx');
  assert.ok(/raceStatus: raceStatusParam/.test(src), 'param renamed, not used directly');
  assert.ok(/const raceStatus = resultDetailRaceStatus\(raceStatusParam, data\?\.event\?\.race_status\)/.test(src));
  assert.ok(/resultDetailView\(raceStatus, data\?\.race_info\?\.participant_status\)/.test(src));
  assert.ok(!/raceStatus === 'in_progress' && \(participantStatus/.test(src), 'old inline rule gone');
});
test('useResultDetail polls through shouldPollResultDetail and re-evaluates on a runner status change', () => {
  const src = read('hooks', 'useResultDetail.ts');
  assert.ok(/shouldPollResultDetail\(data\?\.event\?\.race_status, data\?\.race_info\?\.participant_status\)/.test(src));
  assert.ok(/\[data\?\.event\?\.race_status, data\?\.race_info\?\.participant_status, fetchDetail\]/.test(src));
});
test('RaceLive labels a runner on course after end_time In progress and shows — without a server clock', () => {
  const src = read('screens', 'ResultDetailsScreen', 'RaceLive.tsx');
  assert.ok(/raceLiveStatus\(event\?\.race_status, raceInfo\?\.participant_status\)/.test(src));
  assert.ok(/status\.\$\{liveStatus\}/.test(src));
  assert.ok(/hasClock \? formatSeconds\(elapsedSeconds\) : '—'/.test(src));
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
