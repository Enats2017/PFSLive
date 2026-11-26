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

// ── Auto refresh: when to ask, and what a failure does (app audit 2026-11-26) ──

/**
 * A failed request shows the full-screen error only when there is nothing on
 * screen to keep. One failed 60 s / 10 s poll (a venue Wi-Fi blip, a 429) used
 * to replace a working map with the error screen for good: the later polls
 * that succeeded never cleared it, while they kept running behind it. Now an
 * auto refresh that fails after data was shown keeps the map and its last
 * positions (with a small "connection problem" banner) and the next success
 * clears it. The first load, a distance switch and Retry still show the error.
 */
export function failureShowsErrorScreen(autoRefresh: boolean, hasShownData: boolean): boolean {
  return !autoRefresh || !hasShownData;
}

export interface AutoRefreshGate {
  /** The map is the screen on top (useIsFocused). */
  focused: boolean;
  /** Auto / follow refreshes still waiting for their answer. */
  autoInFlight: number;
  /** Epoch ms before which the server asked us (429 Retry-After) to wait. */
  pausedUntil: number;
  now: number;
}

/**
 * May the timer fire a refresh now?
 *  - not while another screen is on top: the stack keeps this one mounted
 *    (tab bar, Result Details), and its polls used to keep running unseen;
 *  - not while the previous auto refresh is still out: at the 10 s finish
 *    cadence a slow venue network piled requests up on each other;
 *  - not while a 429's Retry-After is running.
 */
export function shouldRunAutoRefresh(g: AutoRefreshGate): boolean {
  return g.focused && g.autoInFlight <= 0 && g.now >= g.pausedUntil;
}

/** How long a 429 pauses polling: the server's Retry-After, else 60 s. */
export function rateLimitPauseMs(err: any): number {
  const s = Number(err?.data?.retryAfter);
  return (Number.isFinite(s) && s > 0 ? Math.min(s, 600) : 60) * 1000;
}

export interface RefreshCadenceParticipant {
  distance_to_finish_km?: number | string | null;
  distance_covered_km?: number | string | null;
  connection_status?: string | null;
  seconds_since_update?: number | null;
}

export const FINISH_APPROACH_KM = 1.0;
export const NORMAL_REFRESH_MS = 60000;
export const FAST_REFRESH_MS = 10000;
/** A position older than this is not "approaching" anything any more. */
export const FAST_REFRESH_MAX_AGE_S = 600;

const num = (v: any): number => {
  if (v === null || v === undefined) return 0;
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
};

/**
 * Refresh cadence: 10 s while a tracked runner is on the final kilometre,
 * otherwise 60 s (moved here from LiveTrackingScreen so it can be tested).
 *
 * ✅ A runner who is not MOVING towards the finish no longer counts (app audit
 * 2026-11-26): someone who abandoned 500 m out, or whose phone died there —
 * offline, finished, or no update for 10 min — held every viewer (the viewer
 * themself included, always in the request) at 6 requests a minute for as
 * long as the map stayed open.
 */
export function liveRefreshMs(
  participants: RefreshCadenceParticipant[],
  totalKm: number,
  trainingFree: boolean,
): number {
  const nearFinish = participants.some((p) => {
    if (p.connection_status === 'offline' || p.connection_status === 'finished') return false;
    if (typeof p.seconds_since_update === 'number' && p.seconds_since_update > FAST_REFRESH_MAX_AGE_S) return false;
    // Prefer the stored distance-to-finish from the API; fall back to
    // total − covered only when it's absent (e.g. an RR-only partner
    // runner with no stored GPS fix).
    let remaining: number | null = p.distance_to_finish_km != null ? num(p.distance_to_finish_km) : null;
    if (remaining == null) {
      // Training: there is no "remaining". total is the reference GPX
      // length and covered is an odometer, so total − covered is
      // meaningless — and lands in the 0-1km fast-refresh band exactly
      // when the session passes the GPX length.
      if (trainingFree) return false;
      if (totalKm <= 0) return false;
      const covered = num(p.distance_covered_km);
      if (covered <= 0) return false;
      remaining = totalKm - covered;
    }
    // 0 < remaining < 1km → final approach. Negative (mid-race overlap on a
    // looping route) and 0 (finished) both correctly stay at normal cadence.
    return remaining > 0 && remaining < FINISH_APPROACH_KM;
  });
  return nearFinish ? FAST_REFRESH_MS : NORMAL_REFRESH_MS;
}
