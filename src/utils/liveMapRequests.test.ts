/**
 * Tests for liveMapRequests.ts. Run: npm run test:live-map-requests
 *
 * No test framework in this repo - plain asserts, exit code 1 on failure.
 * Section 2 replays request orderings through a small model of
 * LiveTrackingScreen.loadLiveTrackingData that makes the same calls in the same
 * order (tag at start, check after the answer and after the GPX, clear the
 * spinners on a drop only when nothing else runs, errors only from the newest).
 * Section 3 checks the screen really is wired that way.
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { isCurrentLiveResponse, dropClearsLoading, ownsError, liveFollowsKey } from './liveMapRequests';

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

console.log('== rules ==');
test('a newer answer already shown → an older one is dropped', () => {
  assert.strictEqual(isCurrentLiveResponse({ seq: 3, distanceId: 85 }, { lastAppliedSeq: 4, wantedDistanceId: 85 }), false);
  assert.strictEqual(isCurrentLiveResponse({ seq: 5, distanceId: 85 }, { lastAppliedSeq: 4, wantedDistanceId: 85 }), true);
  assert.strictEqual(isCurrentLiveResponse({ seq: 4, distanceId: 85 }, { lastAppliedSeq: 4, wantedDistanceId: 85 }), true, 'itself (re-check after the GPX)');
});
test('an answer for a distance the user left is dropped, even if it is the newest', () => {
  assert.strictEqual(isCurrentLiveResponse({ seq: 9, distanceId: 85 }, { lastAppliedSeq: 1, wantedDistanceId: 86 }), false);
});
test('first load without a distance passes until a distance is chosen, not after', () => {
  assert.strictEqual(isCurrentLiveResponse({ seq: 1, distanceId: null }, { lastAppliedSeq: 0, wantedDistanceId: null }), true);
  assert.strictEqual(isCurrentLiveResponse({ seq: 2, distanceId: null }, { lastAppliedSeq: 1, wantedDistanceId: 85 }), false);
});
test('no distance chosen yet: any distance passes (route param on the first load)', () => {
  assert.strictEqual(isCurrentLiveResponse({ seq: 1, distanceId: 85 }, { lastAppliedSeq: 0, wantedDistanceId: null }), true);
});
test('spinners: a drop clears them only when nothing else runs', () => {
  assert.strictEqual(dropClearsLoading(0), true);
  assert.strictEqual(dropClearsLoading(1), false);
});
test('errors: hidden only behind a NEWER request that can still be shown', () => {
  assert.strictEqual(ownsError(4, [], 85), true, 'alone');
  assert.strictEqual(ownsError(3, [{ seq: 4, distanceId: 85 }], 85), false, 'newer, same distance');
  assert.strictEqual(ownsError(3, [{ seq: 4, distanceId: null }], 85), false, 'newer, distance not known yet');
  assert.strictEqual(ownsError(3, [{ seq: 4, distanceId: 85 }], 86), true, 'newer but for a distance the user left');
  assert.strictEqual(ownsError(5, [{ seq: 4, distanceId: 85 }], 85), true, 'only an OLDER one runs');
  assert.strictEqual(ownsError(3, [{ seq: 4, distanceId: 85 }], null), false, 'no distance chosen: any newer one');
});
test('follows key: accounts + bibs, order-free, duplicates once', () => {
  assert.strictEqual(liveFollowsKey(new Set([5404, 12]), ['450']), '12,5404|450');
  assert.strictEqual(liveFollowsKey([12, 5404, 12], ['450']), liveFollowsKey(new Set([5404, 12]), ['450']));
  assert.notStrictEqual(liveFollowsKey([12], ['450']), liveFollowsKey([12], []), 'an unfollowed bib changes the key');
  assert.notStrictEqual(liveFollowsKey([12], []), liveFollowsKey([12, 13], []), 'a new account follow changes the key');
  assert.strictEqual(liveFollowsKey([], []), '|');
});

// ── 2. orderings ───────────────────────────────────────────────────────────
console.log('== request orderings (model of loadLiveTrackingData) ==');
interface Req { seq: number; distanceId: number | null; manual: boolean; withGpx: boolean; }
class Screen {
  seq = 0; lastApplied = 0; wanted: number | null = null; inFlight = new Map<number, number | null>();
  shownDistance: number | null = null; shownSeq = 0; route: number | null = null;
  loading = true; participantsLoading = false; errors = 0;
  start(distanceId: number | null, manual: boolean, withGpx = false): Req {
    const r = { seq: ++this.seq, distanceId, manual, withGpx };
    this.inFlight.set(r.seq, distanceId);
    if (manual) this.loading = true;
    this.participantsLoading = true;
    return r;
  }
  switchTo(d: number): Req { this.wanted = d; this.route = null; return this.start(d, true, true); }
  private current(r: Req) { return isCurrentLiveResponse({ seq: r.seq, distanceId: r.distanceId }, { lastAppliedSeq: this.lastApplied, wantedDistanceId: this.wanted }); }
  private drop() { if (dropClearsLoading(this.inFlight.size - 1)) { this.loading = false; this.participantsLoading = false; } }
  /** The answer arrives. gpxDuring runs while this request downloads its GPX. */
  /** The label's distance reload a tab-bar open starts (see answer, labelPicks). */
  reload: Req | null = null;
  /**
   * The answer arrives. apiPicks = the distance the API answered with when the
   * request had none; labelPicks = the route-param label's distance (tab bar).
   * gpxDuring runs while this request downloads its GPX.
   */
  answer(r: Req, opts: { apiPicks?: number; labelPicks?: number; gpxDuring?: () => void } = {}) {
    try {
      if (!this.current(r)) { this.drop(); return; }
      this.lastApplied = r.seq;
      this.shownDistance = r.distanceId ?? opts.apiPicks ?? null; this.shownSeq = r.seq;
      if (r.manual && this.wanted === null && opts.labelPicks !== undefined) {
        // as the screen: the label wins; an answer for another distance reloads it
        this.wanted = opts.labelPicks;
        const answered = opts.apiPicks ?? r.distanceId;
        if (answered !== null && answered !== opts.labelPicks) {
          this.reload = this.start(opts.labelPicks, true, true);
          this.drop(); return;
        }
        r.distanceId = opts.labelPicks; this.inFlight.set(r.seq, opts.labelPicks);
      } else if (r.manual && r.distanceId === null && opts.apiPicks !== undefined && this.wanted === null) {
        // as the screen: the API's pick becomes the wanted distance AND this answer's own
        this.wanted = opts.apiPicks; r.distanceId = opts.apiPicks; this.inFlight.set(r.seq, opts.apiPicks);
      }
      if (r.manual && r.withGpx) {
        opts.gpxDuring?.();
        if (!this.current(r)) { this.drop(); return; }
        this.route = this.shownDistance;
      }
      this.loading = false;
      if (this.inFlight.size === 1) this.participantsLoading = false;   // the 200 ms timer: only when nothing else loads
    } finally { this.inFlight.delete(r.seq); }
  }
  fail(r: Req) {
    try {
      const others = [...this.inFlight.entries()].filter(([s]) => s !== r.seq).map(([s, d]) => ({ seq: s, distanceId: d }));
      if (!this.current(r) || !ownsError(r.seq, others, this.wanted)) { if (dropClearsLoading(others.length)) { this.loading = false; this.participantsLoading = false; } return; }
      this.errors++; this.loading = false; this.participantsLoading = false;
    } finally { this.inFlight.delete(r.seq); }
  }
}
function opened(): Screen { const s = new Screen(); s.answer(s.start(null, true, true), { apiPicks: 85 }); return s; }

test('open without a distance in the link (BottomNavigation passes 0): the API picks it and its route IS drawn', () => {
  const s = opened();
  assert.strictEqual(s.wanted, 85);
  assert.strictEqual(s.route, 85, 'route drawn on the first answer');
  assert.strictEqual(s.loading, false);
});
test('tab bar open (id 0 + label 86), the API answers with its default 85 → 86 is loaded, its route drawn', () => {
  const s = new Screen();
  s.answer(s.start(null, true, true), { apiPicks: 85, labelPicks: 86 });
  assert.ok(s.reload, 'the labelled distance is loaded');
  assert.strictEqual(s.route, null, 'no 85 route drawn under the 86 name');
  assert.strictEqual(s.loading, true, 'spinner stays while 86 loads');
  s.answer(s.reload!);
  assert.strictEqual(s.shownDistance, 86); assert.strictEqual(s.route, 86); assert.strictEqual(s.loading, false);
});
test('tab bar open, the API answered with the labelled distance itself → no extra load', () => {
  const s = new Screen();
  s.answer(s.start(null, true, true), { apiPicks: 86, labelPicks: 86 });
  assert.strictEqual(s.reload, null); assert.strictEqual(s.route, 86); assert.strictEqual(s.loading, false);
});
test('an overtaken request fails AFTER a newer answer is shown → no error screen over the good map', () => {
  const s = opened();
  const slow = s.start(85, false), fast = s.start(85, false);
  s.answer(fast); s.fail(slow);
  assert.strictEqual(s.errors, 0); assert.strictEqual(s.shownSeq, fast.seq);
});
test('a request for a distance the user left fails with nothing else running → no error screen', () => {
  const s = opened();
  const staleAuto = s.start(85, false);
  const sw = s.switchTo(86); s.answer(sw);
  s.fail(staleAuto);
  assert.strictEqual(s.errors, 0); assert.strictEqual(s.shownDistance, 86); assert.strictEqual(s.loading, false);
});
test('an applied refresh does not end the runner spinner of another request still loading', () => {
  const s = opened();
  const a = s.start(85, false), b = s.start(85, false);
  s.answer(a);
  assert.strictEqual(s.participantsLoading, true, 'b still loading');
  s.answer(b);
  assert.strictEqual(s.participantsLoading, false);
});
test('a switch fails while the 60 s timer (old distance, newer) runs → the error is still shown', () => {
  const s = opened();
  const sw = s.switchTo(86);
  const staleAuto = s.start(85, false);
  s.fail(sw);
  assert.strictEqual(s.errors, 1, 'not hidden behind a request that will be dropped');
  s.answer(staleAuto);
  assert.strictEqual(s.shownDistance, 85, 'the old runners are not replaced by the dropped answer either');
});

test('auto refresh for the OLD distance lands after the switch → the new distance stays on the map', () => {
  const s = opened();
  const auto = s.start(85, false);
  const sw = s.switchTo(86);
  s.answer(sw);
  s.answer(auto);
  assert.strictEqual(s.shownDistance, 86); assert.strictEqual(s.route, 86); assert.strictEqual(s.loading, false);
});
test('the old refresh lands FIRST → dropped, and the switch keeps its spinner until its own answer', () => {
  const s = opened();
  const auto = s.start(85, false);
  const sw = s.switchTo(86);
  s.answer(auto);
  assert.strictEqual(s.loading, true, 'still loading 86');
  assert.strictEqual(s.shownDistance, 85, 'old runners not replaced by a newer old answer');
  s.answer(sw);
  assert.strictEqual(s.shownDistance, 86); assert.strictEqual(s.loading, false);
});
test('the 60 s timer fires after the switch but before the re-render (old closure, NEWEST request) → dropped', () => {
  const s = opened();
  const sw = s.switchTo(86);
  const staleAuto = s.start(85, false);      // newest seq, old distance
  s.answer(staleAuto);
  assert.strictEqual(s.loading, true, 'the switch is still loading');
  s.answer(sw);
  assert.strictEqual(s.shownDistance, 86); assert.strictEqual(s.loading, false);
});
test('two refreshes for the same distance, answers swapped → the newer data stays', () => {
  const s = opened();
  const a = s.start(85, false), b = s.start(85, false);
  s.answer(b); s.answer(a);
  assert.strictEqual(s.shownSeq, b.seq);
});
test('the user switches again while the first switch downloads its GPX → that GPX is not drawn', () => {
  const s = opened();
  const first = s.switchTo(86);
  let second: Req | null = null;
  s.answer(first, { gpxDuring: () => { second = s.switchTo(87); } });
  assert.strictEqual(s.route, null, 'no 86 route over the 87 screen');
  assert.strictEqual(s.loading, true, '87 still loading');
  s.answer(second!);
  assert.strictEqual(s.route, 87); assert.strictEqual(s.loading, false);
});
test('first load picks the distance from the API → later refreshes for it are applied', () => {
  const s = opened();
  assert.strictEqual(s.wanted, 85);
  const auto = s.start(85, false); s.answer(auto);
  assert.strictEqual(s.shownSeq, auto.seq);
});
test('an older request fails while a newer one runs → no error; the newer one decides', () => {
  const s = opened();
  const old = s.start(85, false), newer = s.start(85, false);
  s.fail(old);
  assert.strictEqual(s.errors, 0); assert.strictEqual(s.participantsLoading, true, 'newer still running');
  s.answer(newer);
  assert.strictEqual(s.participantsLoading, false);
});
test('the newest request fails → its error is shown and the spinners end', () => {
  const s = opened();
  const sw = s.switchTo(86); s.fail(sw);
  assert.strictEqual(s.errors, 1); assert.strictEqual(s.loading, false);
});
test('a dropped answer with nothing else running never leaves a spinner on', () => {
  const s = opened();
  s.wanted = 86;                              // switched; its request already finished
  const stale = s.start(85, false); s.answer(stale);
  assert.strictEqual(s.participantsLoading, false); assert.strictEqual(s.inFlight.size, 0);
});

// ── 3. wiring ──────────────────────────────────────────────────────────────
console.log('== wiring (source) ==');
const screen = fs.readFileSync(path.join(process.cwd(), 'src', 'screens/LiveTrackingScreen.tsx'), 'utf8').replace(/\r\n/g, '\n');
const at = (needle: string) => { const i = screen.indexOf(needle); assert.ok(i >= 0, `missing: ${needle}`); return i; };
test('each request is tagged at the start, registered in flight with its distance, and removed in finally', () => {
  const seq = at('const seq = ++requestSeq.current;');
  const inc = at('inFlightDistance.current.set(seq, null);');
  const dist = at('inFlightDistance.current.set(seq, requestedDistanceId);');
  const fin = at('} finally {\n            inFlightDistance.current.delete(seq);');
  assert.ok(seq < inc && inc < dist && dist < fin);
});
test('when the API picks the distance, this answer becomes an answer FOR that distance (its GPX is drawn)', () => {
  for (const v of ['matchedDistance', 'apiSelectedDistance']) {
    const w = at(`wantedDistanceId.current = ${v}.product_option_value_app_id;`);
    const r = at(`requestedDistanceId = ${v}.product_option_value_app_id;`);
    assert.ok(r > w && r - w < 1500, v);
  }
  assert.ok(at('requestedDistanceId = apiSelectedDistance.product_option_value_app_id;') < at('const applied = await loadGPX(newGpxUrl, isCurrent);'));
});
test('a label match for another distance than the one answered loads the labelled distance instead', () => {
  const ans = at('const answeredId = response.data.selected_distance?.product_option_value_app_id ?? requestedDistanceId;');
  const re = at('void loadLiveTrackingData(false, matchedDistance);');
  assert.ok(ans < re && re < at('requestedDistanceId = matchedDistance.product_option_value_app_id;'));
});
test('the distance a request is for is known before its first wait', () => {
  assert.ok(at('inFlightDistance.current.set(seq, requestedDistanceId);') < at('const selfId = await tokenService.getCustomerId();'));
});
test('the runner spinner ends after an answer only when nothing else loads', () => {
  at('if (inFlightDistance.current.size === 0) setParticipantsLoading(false);');
});
test('the answer is checked before anything is set, then marked applied', () => {
  const req = at('await liveTrackingService.getLiveTrackingData(');
  const chk = at('if (!isCurrent()) { dropStale(); return; }');
  const mark = at('lastAppliedSeq.current = seq;');
  const setP = at('setParticipants(response.data.participants);');
  assert.ok(req < chk && chk < mark && mark < setP);
  assert.ok(at('requestedDistanceId = optionValueId ?? null;') < req, 'the distance it asks for is recorded first');
});
test('the GPX is drawn only while its answer is still current', () => {
  at('const applied = await loadGPX(newGpxUrl, isCurrent);');
  at('if (!applied) { dropStale(); return; }');
  const guard = at('if (!stillCurrent()) {');
  assert.ok(guard < at('setRouteData(gpxData);'));
});
test('the wanted distance is set synchronously on a switch and when the API picks one', () => {
  const w = at('wantedDistanceId.current = distance.product_option_value_app_id;');
  assert.ok(w < at('await loadLiveTrackingData(false, distance);'));
  at('wantedDistanceId.current = matchedDistance.product_option_value_app_id;');
  at('wantedDistanceId.current = apiSelectedDistance.product_option_value_app_id;');
});
test('an error is hidden only behind a newer request that can still be shown', () => {
  assert.ok(at('if (!isCurrent() || !ownsError(seq, others, wantedDistanceId.current)) {') < at('handleApiError(err);'), 'an overtaken / left-distance failure never shows its error');
});
test('follows are re-read on focus (not on the first one), and a change refreshes the map', () => {
  at('useFocusEffect(');
  at('if (!focusedOnce.current) { focusedOnce.current = true; return; }');
  at('void refreshFollowedUsers();');
  at('}, [followsKey, loading]);');
  at('}, [hasLoadedInitialData.current, loading, selectedDistance, followsKey, refreshMs]);');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
