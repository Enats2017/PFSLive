// ✅ Pure rules for the tracking session — no React, no native modules, so the
// tracking test harness (tests/tracking) can exercise them directly.
// Added after the 2026-10-17 30km run/walk, where one bad server answer
// (RaceResult PREDICTED finish read as a crossing) stopped most runners for good,
// and the 2026-10-18 audit of what else could end or misplace a session.

// A session whose gun is older than this is not "the race in progress" any more:
// it was never stopped (DNF, finish missed, iOS force-quit) and must not come back
// to life on the next app open, sending today's fixes into yesterday's race and
// hiding today's Start button. 24h covers every single-day event; multi-day
// events re-start each day (the app's gun is per day).
export const STALE_SESSION_MS = 24 * 60 * 60 * 1000;

export interface StoredSessionLike {
  raceStartTime?: string | null;
}

/**
 * True when a stored session must be stopped instead of resumed: its gun was
 * more than STALE_SESSION_MS ago. A session without a stored gun (manual start)
 * is never judged stale here. Deliberately age only — no "home offers another
 * race" check: home_api drops a race once its end_time passes, so that check
 * would stop a runner still on course late (2026-10-18 review).
 */
export function isStaleSession(
  params: StoredSessionLike | null | undefined,
  nowMs: number,
  // When the session has no stored gun, judge it by when Start was pressed
  // (gpsService's SESSION_STARTED_AT_KEY). 0/undefined = unknown → never stale.
  sessionStartedAtMs?: number,
): boolean {
  if (!params) return false;
  if (params.raceStartTime) {
    const gun = new Date(params.raceStartTime).getTime();
    if (!isNaN(gun)) return nowMs - gun > STALE_SESSION_MS;
  }
  return !!sessionStartedAtMs && sessionStartedAtMs > 0 && nowMs - sessionStartedAtMs > STALE_SESSION_MS;
}

/**
 * Real (UTC) gun time from the event-local race date/time and the event-tz
 * offset captured WHEN the home data arrived (offset = serverFakeMs − Date.now()
 * at receipt). Using the offset instead of re-reading server_datetime keeps the
 * gun right however old the home data is: with the old
 * `Date.now() + (race − server_datetime)` a failed fresh fetch at Start fell back
 * to hours-old home data and pushed the gun late by exactly that age, so every
 * fix after the real gun was dropped as "race not started".
 */
export function computeRaceStartTime(
  raceDate: string | null | undefined,
  raceTime: string | null | undefined,
  eventTzOffsetMs: number,
): Date | null {
  if (!raceDate || !raceTime) return null;
  const raceFakeMs = new Date(`${raceDate}T${raceTime}Z`).getTime();
  if (isNaN(raceFakeMs)) return null;
  return new Date(raceFakeMs - eventTzOffsetMs);
}
