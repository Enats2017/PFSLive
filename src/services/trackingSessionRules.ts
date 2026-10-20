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
/**
 * A backgrounded Android start (start_backgrounded) is re-armed in memory, but
 * Samsung / Doze can kill the backgrounded process, and then opening Livio
 * started nothing (2026-10-20 re-check). The re-arm is persisted too; this
 * decides whether a cold start should finish it: only recent (the runner tapped
 * Start minutes ago, not yesterday) and only for the race home still offers.
 */
export const PENDING_BG_START_MAX_AGE_MS = 10 * 60 * 1000;

export function shouldResumePendingStart(
  pending: { participantId?: unknown; eventId?: unknown; at?: unknown } | null | undefined,
  home: { show_start_track?: number; next_race_participant_app_id?: unknown; next_race_id?: unknown } | null | undefined,
  nowMs: number,
): boolean {
  if (!pending || typeof pending.at !== 'number' || !isFinite(pending.at)) return false;
  const age = nowMs - pending.at;
  if (age < 0 || age > PENDING_BG_START_MAX_AGE_MS) return false;
  if (!home || home.show_start_track !== 1) return false;
  if (pending.participantId == null || pending.eventId == null) return false;
  return String(home.next_race_participant_app_id) === String(pending.participantId)
    && String(home.next_race_id) === String(pending.eventId);
}

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
