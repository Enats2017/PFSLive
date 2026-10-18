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
  participantId?: string | number | null;
  eventId?: string | number | null;
  raceStartTime?: string | null;
  manualStart?: number;
}

export interface HomeRaceLike {
  participantId?: string | number | null;
  eventId?: string | number | null;
}

/**
 * True when a stored session must be stopped instead of resumed.
 * - gun more than STALE_SESSION_MS ago (manual-start sessions included: their
 *   stored gun is the real one when present);
 * - or home is offering a DIFFERENT race for this account (only checked when
 *   home's ids are known — an offline relaunch must still resume).
 */
export function isStaleSession(
  params: StoredSessionLike | null | undefined,
  nowMs: number,
  homeRace?: HomeRaceLike | null,
): boolean {
  if (!params) return false;
  if (params.raceStartTime) {
    const gun = new Date(params.raceStartTime).getTime();
    if (!isNaN(gun) && nowMs - gun > STALE_SESSION_MS) return true;
  }
  if (homeRace && homeRace.participantId && homeRace.eventId
      && params.participantId && params.eventId) {
    if (String(homeRace.participantId) !== String(params.participantId)
        || String(homeRace.eventId) !== String(params.eventId)) return true;
  }
  return false;
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
