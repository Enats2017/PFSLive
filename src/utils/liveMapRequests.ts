// Which live-map answer may still be shown, and what the follows look like as a
// stable key. Pure, so it is tested without React or the API client:
// npm run test:live-map-requests
//
// (2026-10-28 review) LiveTrackingScreen has three request sources: the full
// load (first load, distance switch), the 60 s auto refresh and the follow
// refresh. They overlap, and each used to apply its own answer whenever it
// arrived — an auto refresh that left with the OLD distance could land after
// the switch and put that distance's runners back on the map. The interval's
// closure can even fire after the switch but before the re-render, so it is the
// NEWEST request and still asks for the old distance: "newest wins" alone is
// not enough, the distance has to match too.

export interface LiveRequestTag {
  /** Increasing per request (start order). */
  seq: number;
  /** product_option_value_app_id the request asked for; null = API default. */
  distanceId: number | null;
}

export interface LiveRequestState {
  /** seq of the newest answer already applied (0 = none yet). */
  lastAppliedSeq: number;
  /** Distance the screen wants now (set on a switch); null = not chosen yet. */
  wantedDistanceId: number | null;
}

/** May this answer still be applied? */
export function isCurrentLiveResponse(req: LiveRequestTag, state: LiveRequestState): boolean {
  // An older request than one already shown: its data is older too.
  if (req.seq < state.lastAppliedSeq) return false;
  // Asked for a distance the user has left. A request without a distance (the
  // first load, API default) only predates any choice, so it passes until one
  // is made.
  if (state.wantedDistanceId !== null && req.distanceId !== null && req.distanceId !== state.wantedDistanceId) return false;
  if (state.wantedDistanceId !== null && req.distanceId === null) return false;
  return true;
}

/**
 * A dropped answer clears the spinners only when no other request is still
 * running — that one will clear them (or show its error). Clearing earlier
 * would end the spinner of a distance switch that is still loading.
 */
export function dropClearsLoading(othersInFlight: number): boolean {
  return othersInFlight <= 0;
}

/**
 * A failing request shows its error unless a NEWER request that can still be
 * shown is running — that one decides the screen. A newer request for a
 * distance the user has left does not count: it will be dropped, and hiding the
 * error for it left a blank map with no error and no retry (2026-10-28 review:
 * the 60 s timer firing right after a switch, still holding the old distance).
 * A running request whose distance is not known yet (null) counts as showable.
 */
export function ownsError(seq: number, othersInFlight: LiveRequestTag[], wantedDistanceId: number | null): boolean {
  return !othersInFlight.some((o) =>
    o.seq > seq
    && (wantedDistanceId === null || o.distanceId === null || o.distanceId === wantedDistanceId));
}

/**
 * Stable key of what the map asks for: followed accounts + followed bibs.
 * Sorted, so a reload that returns the same follows in another order is no
 * change (no extra request).
 */
export function liveFollowsKey(customerIds: Iterable<number | string>, bibs: string[]): string {
  const ids = [...new Set([...customerIds].map((c) => String(c)))].sort();
  return `${ids.join(',')}|${bibs.join(',')}`;
}
