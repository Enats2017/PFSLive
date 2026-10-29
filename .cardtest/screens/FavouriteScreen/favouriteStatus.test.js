"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Tests for favouriteStatus.ts. Run: npm run test:favourite-status
 *
 * No test framework in this repo - plain asserts, exit code 1 on failure.
 * The participant_status values are the ones get_favourite_api.php (the app's
 * GET_FAVOURITES) emits: DNF/DNS/DSQ from Pos., 'finished', 'in_progress', 'not_started'.
 */
const assert_1 = __importDefault(require("assert"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const favouriteStatus_1 = require("./favouriteStatus");
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
// The card passes the whole FavouriteItem; START always "crossed" with the gun
// time, as RR fills it for every entrant (rr_result_3_18: Started=0, "16:00:00").
const cp = (o) => ({
    name: o.start ? 'START' : o.finish ? 'FIN' : '8,3km', is_crossed: o.crossed, is_start: !!o.start, is_finish: !!o.finish,
});
const item = (ps, race, hasStarted) => ({ participant_status: ps, race_status: race, has_started: hasStarted,
    checkpoints: [cp({ start: true, crossed: true }), cp({ crossed: false }), cp({ finish: true, crossed: false })] });
console.log('== runner status on the Favourites card ==');
test('100 km finisher while the distance is still in progress → Finished (was: In progress until 23:59)', () => {
    assert_1.default.strictEqual((0, favouriteStatus_1.favouriteRunnerStatus)(item('finished', 'in_progress')), 'finished');
});
test('runner still on course after end_time (distance "finished") → In progress (was: Finished)', () => {
    assert_1.default.strictEqual((0, favouriteStatus_1.favouriteRunnerStatus)(item('in_progress', 'finished')), 'in_progress');
});
test('DNF / DNS / DSQ mid-race → shown as such (was: In progress)', () => {
    for (const s of ['DNF', 'DNS', 'DSQ'])
        assert_1.default.strictEqual((0, favouriteStatus_1.favouriteRunnerStatus)(item(s, 'in_progress')), s);
});
test('between the start and CP1 (API says not_started) → In progress while the distance runs (unchanged)', () => {
    assert_1.default.strictEqual((0, favouriteStatus_1.favouriteRunnerStatus)(item('not_started', 'in_progress')), 'in_progress');
});
test('no-show after the distance ended, START filled with the gun time by RR → Not started, not "In progress"', () => {
    assert_1.default.strictEqual((0, favouriteStatus_1.favouriteRunnerStatus)(item('not_started', 'finished', false)), 'not_started');
});
test('STARTED (RR Started=1) but no split yet → never "Not started", in every distance state', () => {
    for (const race of ['not_started', 'in_progress', 'finished']) {
        assert_1.default.strictEqual((0, favouriteStatus_1.favouriteRunnerStatus)(item('not_started', race, true)), 'in_progress', race);
    }
});
test('has_started never overrides a real status (finished / DNF stay as they are)', () => {
    assert_1.default.strictEqual((0, favouriteStatus_1.favouriteRunnerStatus)(item('finished', 'in_progress', true)), 'finished');
    assert_1.default.strictEqual((0, favouriteStatus_1.favouriteRunnerStatus)(item('DNF', 'finished', true)), 'DNF');
});
test('before the gun with START pre-filled → Not started (START is never trusted)', () => {
    assert_1.default.strictEqual((0, favouriteStatus_1.favouriteRunnerStatus)(item('not_started', 'not_started')), 'not_started');
});
test('before the gun → Not started (unchanged)', () => {
    assert_1.default.strictEqual((0, favouriteStatus_1.favouriteRunnerStatus)(item('not_started', 'not_started')), 'not_started');
});
test('distance over, runner never crossed anything → Not started (was: Finished)', () => {
    assert_1.default.strictEqual((0, favouriteStatus_1.favouriteRunnerStatus)(item('not_started', 'finished')), 'not_started');
});
test('participant_status missing or blank (older API, local row) → falls back to the distance status', () => {
    assert_1.default.strictEqual((0, favouriteStatus_1.favouriteRunnerStatus)(item(undefined, 'in_progress')), 'in_progress');
    assert_1.default.strictEqual((0, favouriteStatus_1.favouriteRunnerStatus)(item('  ', 'finished')), 'finished');
});
test('no checkpoints array → no crash', () => {
    assert_1.default.strictEqual((0, favouriteStatus_1.favouriteRunnerStatus)({ participant_status: 'not_started', race_status: 'not_started' }), 'not_started');
});
test('every status it can return has a label in resultdetails en/fr/nl', () => {
    const dir = path_1.default.join(process.cwd(), 'src', 'i18n', 'Resultdetails'); // folder is capitalised (case-sensitive on macOS/Linux)
    for (const l of ['en', 'fr', 'nl']) {
        const st = JSON.parse(fs_1.default.readFileSync(path_1.default.join(dir, `${l}.json`), 'utf8')).status;
        for (const s of ['not_started', 'in_progress', 'finished', 'DNF', 'DNS', 'DSQ'])
            assert_1.default.ok(st && st[s], `${l}: status.${s}`);
    }
});
test('FavouriteCard uses it for the badge colour, label and the not-started switch (not item.race_status)', () => {
    const src = fs_1.default.readFileSync(path_1.default.join(process.cwd(), 'src', 'screens', 'FavouriteScreen', 'FavouriteCard.tsx'), 'utf8');
    assert_1.default.ok(/favouriteRunnerStatus\(item\)/.test(src), 'helper called');
    assert_1.default.ok(/getStatusColors\(runnerStatus\)/.test(src), 'colour');
    assert_1.default.ok(/resultdetails:status\.\$\{runnerStatus\}/.test(src), 'label');
    assert_1.default.ok(/const isNotStarted = runnerStatus === 'not_started'/.test(src), 'not-started switch');
    assert_1.default.ok(!/getStatusColors\(item\.race_status\)|status\.\$\{item\.race_status\}/.test(src), 'no distance-status badge left');
    assert_1.default.ok(/prev\.item\.participant_status === next\.item\.participant_status/.test(src), 'memo re-renders on a status change');
    assert_1.default.ok(/prev\.item\.has_started === next\.item\.has_started/.test(src), 'memo re-renders when the runner starts');
    assert_1.default.ok(/\[item\.participant_status, item\.race_status, item\.has_started\]/.test(src), 'status recomputed when has_started changes');
});
// has_started must come from the endpoint the card is actually fed by. The
// 2026-10-23 server fix went into get_favourite_all_events_api.php (the web's),
// so the app card never received it (re-check 2026-10-24, larssie df4426e11).
test('the card is fed by GET_FAVOURITES = get_favourite_api.php — the PHP file that must send has_started', () => {
    const read = (...p) => fs_1.default.readFileSync(path_1.default.join(process.cwd(), 'src', ...p), 'utf8');
    assert_1.default.ok(/favouritesApi\.getFavourites\(/.test(read('screens', 'FavouriteScreen', 'FavouriteList.tsx')), 'FavouriteList loads through favouritesApi');
    assert_1.default.ok(/getApiEndpoint\(API_CONFIG\.ENDPOINTS\.GET_FAVOURITES\)/.test(read('services', 'favourites.ts')), 'favouritesApi posts to GET_FAVOURITES');
    assert_1.default.ok(/GET_FAVOURITES:\s*"\/get_favourite_api\.php"/.test(read('constants', 'config.ts')), 'GET_FAVOURITES is get_favourite_api.php');
    assert_1.default.ok(/has_started\?: boolean/.test(read('services', 'favourites.ts')), 'FavouriteItem declares has_started');
});
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0)
    process.exit(1);
