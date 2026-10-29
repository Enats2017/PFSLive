"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Tests for resultDetailView.ts. Run: npm run test:result-detail-view
 *
 * No test framework in this repo - plain asserts, exit code 1 on failure.
 */
const assert_1 = __importDefault(require("assert"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const resultDetailView_1 = require("./resultDetailView");
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
// The rule ResultDetails had inline before 2026-10-23, verbatim.
const oldInline = (raceStatus, participantStatus) => raceStatus === 'in_progress' && (participantStatus === 'in_progress' || participantStatus === 'not_started') ? 'live'
    : raceStatus === 'finished' || (raceStatus === 'in_progress' && participantStatus !== 'not_started' && participantStatus !== 'in_progress') ? 'final'
        : raceStatus === 'not_started' || participantStatus === 'not_started' ? 'upcoming'
            : null;
const RACE = ['not_started', 'in_progress', 'finished', undefined];
const RUNNER = ['not_started', 'in_progress', 'finished', 'DNF', 'DNS', 'DSQ', '', undefined];
console.log('== result detail: which card, and polling ==');
test('opened before the gun, the gun passes → the next response switches the card to live (was: upcoming all race)', () => {
    const before = (0, resultDetailView_1.resultDetailRaceStatus)('not_started', 'not_started');
    assert_1.default.strictEqual((0, resultDetailView_1.resultDetailView)(before, 'not_started'), 'upcoming');
    const after = (0, resultDetailView_1.resultDetailRaceStatus)('not_started', 'in_progress'); // param still the tapped snapshot
    assert_1.default.strictEqual(after, 'in_progress');
    assert_1.default.strictEqual((0, resultDetailView_1.resultDetailView)(after, 'not_started'), 'live');
});
test('the param is only used until the first response arrives', () => {
    assert_1.default.strictEqual((0, resultDetailView_1.resultDetailRaceStatus)('in_progress', undefined), 'in_progress');
    assert_1.default.strictEqual((0, resultDetailView_1.resultDetailRaceStatus)('in_progress', ''), 'in_progress');
    assert_1.default.strictEqual((0, resultDetailView_1.resultDetailRaceStatus)('in_progress', 'finished'), 'finished');
});
test('a page open before the gun polls (was: never)', () => {
    assert_1.default.strictEqual((0, resultDetailView_1.shouldPollResultDetail)('not_started', 'not_started'), true);
});
test('after end_time, runner still on course → live card and polling go on (was: final card, polling stopped)', () => {
    assert_1.default.strictEqual((0, resultDetailView_1.resultDetailView)('finished', 'in_progress'), 'live');
    assert_1.default.strictEqual((0, resultDetailView_1.shouldPollResultDetail)('finished', 'in_progress'), true);
    assert_1.default.strictEqual((0, resultDetailView_1.raceLiveStatus)('finished', 'in_progress'), 'in_progress');
});
test('after end_time, finisher / DNF / never started → final card, no polling (unchanged)', () => {
    for (const ps of ['finished', 'DNF', 'DNS', 'DSQ', 'not_started']) {
        assert_1.default.strictEqual((0, resultDetailView_1.resultDetailView)('finished', ps), 'final', ps);
        assert_1.default.strictEqual((0, resultDetailView_1.shouldPollResultDetail)('finished', ps), false, ps);
    }
});
test('during the race: polling on for every runner; live header label is the distance status', () => {
    for (const ps of RUNNER)
        assert_1.default.strictEqual((0, resultDetailView_1.shouldPollResultDetail)('in_progress', ps), true);
    assert_1.default.strictEqual((0, resultDetailView_1.raceLiveStatus)('in_progress', 'in_progress'), 'in_progress');
    assert_1.default.strictEqual((0, resultDetailView_1.raceLiveStatus)(undefined, undefined), 'in_progress', 'old default kept');
});
test('every other status pair gives exactly the old inline rule (only the two intended cases change)', () => {
    const changed = [];
    for (const rs of RACE)
        for (const ps of RUNNER) {
            if ((0, resultDetailView_1.resultDetailView)(rs, ps) !== oldInline(rs, ps))
                changed.push(`${rs}/${ps}`);
        }
    assert_1.default.deepStrictEqual(changed, ['finished/in_progress']);
});
test('started (has_started) but no split → In progress, never Not started', () => {
    assert_1.default.strictEqual((0, resultDetailView_1.effectiveParticipantStatus)('not_started', true), 'in_progress');
    assert_1.default.strictEqual((0, resultDetailView_1.effectiveParticipantStatus)('not_started', false), 'not_started');
    assert_1.default.strictEqual((0, resultDetailView_1.effectiveParticipantStatus)('not_started', undefined), 'not_started', 'older API without the field');
    for (const s of ['finished', 'in_progress', 'DNF', 'DNS', 'DSQ'])
        assert_1.default.strictEqual((0, resultDetailView_1.effectiveParticipantStatus)(s, true), s, s);
});
test('started runner with no split after the distance ended → live card + polling (was: final card "Not Started")', () => {
    const ps = (0, resultDetailView_1.effectiveParticipantStatus)('not_started', true);
    assert_1.default.strictEqual((0, resultDetailView_1.resultDetailView)('finished', ps), 'live');
    assert_1.default.strictEqual((0, resultDetailView_1.shouldPollResultDetail)('finished', ps), true);
    assert_1.default.strictEqual((0, resultDetailView_1.raceLiveStatus)('finished', ps), 'in_progress');
});
test('real no-show (Started=0) after the end keeps the final card, no polling (unchanged)', () => {
    const ps = (0, resultDetailView_1.effectiveParticipantStatus)('not_started', false);
    assert_1.default.strictEqual((0, resultDetailView_1.resultDetailView)('finished', ps), 'final');
    assert_1.default.strictEqual((0, resultDetailView_1.shouldPollResultDetail)('finished', ps), false);
});
const read = (...p) => fs_1.default.readFileSync(path_1.default.join(process.cwd(), 'src', ...p), 'utf8');
test('ResultDetails picks the card through these helpers with the LIVE race status', () => {
    const src = read('screens', 'ResultDetailsScreen', 'ResultDetails.tsx');
    assert_1.default.ok(/raceStatus: raceStatusParam/.test(src), 'param renamed, not used directly');
    assert_1.default.ok(/const raceStatus = resultDetailRaceStatus\(raceStatusParam, data\?\.event\?\.race_status\)/.test(src));
    assert_1.default.ok(/resultDetailView\(\s*raceStatus,\s*effectiveParticipantStatus\(data\?\.race_info\?\.participant_status, data\?\.race_info\?\.has_started\)/.test(src));
    assert_1.default.ok(!/raceStatus === 'in_progress' && \(participantStatus/.test(src), 'old inline rule gone');
});
test('useResultDetail polls through shouldPollResultDetail and re-evaluates on a runner status change', () => {
    const src = read('hooks', 'useResultDetail.ts');
    assert_1.default.ok(/shouldPollResultDetail\(\s*data\?\.event\?\.race_status,\s*effectiveParticipantStatus\(data\?\.race_info\?\.participant_status, data\?\.race_info\?\.has_started\)/.test(src));
    assert_1.default.ok(/\[data\?\.event\?\.race_status, data\?\.race_info\?\.participant_status, data\?\.race_info\?\.has_started, fetchDetail\]/.test(src));
});
test('RaceLive labels a runner on course after end_time In progress and shows — without a server clock', () => {
    const src = read('screens', 'ResultDetailsScreen', 'RaceLive.tsx');
    assert_1.default.ok(/raceLiveStatus\(\s*event\?\.race_status,\s*effectiveParticipantStatus\(raceInfo\?\.participant_status, raceInfo\?\.has_started\)/.test(src));
    assert_1.default.ok(/status\.\$\{liveStatus\}/.test(src));
    assert_1.default.ok(/hasClock \? formatSeconds\(elapsedSeconds\) : '—'/.test(src));
});
test('RaceInfoTab (final card) labels through effectiveParticipantStatus — a started runner never reads "Not Started"', () => {
    const src = read('screens', 'ResultDetailsScreen', 'RaceInfoTab.tsx');
    assert_1.default.ok(/statusText\(effectiveParticipantStatus\(raceInfo\?\.participant_status, raceInfo\?\.has_started\)\)/.test(src));
});
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0)
    process.exit(1);
