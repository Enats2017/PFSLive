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

// ✅ PREVIOUS-DAY SESSION (2026-11-26 audit, Trail de la Soupe Challenge).
//
// The 24 h rule above is too long for a two-day event with one registration per
// day: Explorer 14 km Sat 13:00 -> 26 km Sun 08:30 (19.5 h), Ultra 32 km Sat
// 10:00 -> 57 km Sun 07:00 (21 h). A Saturday session that never closed (iOS
// force-quit or a flat battery before the finish answer, a DNF without Stop)
// was NOT stale on Sunday morning: the engine came back, Home showed "Tracking
// active" with Stop instead of Sunday's Start, and Sunday's fixes went into
// Saturday's registration (same race id 24, the server has no time window).
//
// Deliberately NOT the rejected "home offers another race" rule (2026-10-18):
// home_api drops a race once its end_time passes, so that rule stopped runners
// still on course late. This one needs ALL of:
//   - the session's OWN gun was on an earlier EVENT-LOCAL day than today, and
//   - home answered, offers Start, and offers a DIFFERENT participant, and
//   - that participant's race is TODAY (event-local).
// A runner still on course on the gun's own day is never touched (same day),
// nor on Saturday evening when home already offers Sunday (not today). An
// overnight race (gun 22:00, still running at 06:00) is only stopped if home
// offers that runner a different registration for today. Without home data
// (cold boot, Android headless relaunch) nothing is decided here — the screen
// decides once home answers. The stop itself keeps every queued fix (Stop
// drains, leftovers go to drainOrphans), so a late backlog still uploads.
//
// eventTzOffsetMs: the event-tz offset HomeScreen captured from server_datetime
// (serverTimeOffsetRef) — event-local wall clock = UTC ms + offset.
//
// ✅ AND the session must have gone quiet (review of the fix, 2026-11-26): a
// runner on an overnight course (gun 22:00, still out after midnight) whose
// account ALSO holds another registration for today (a kids' run) matched the
// day + participant test and was stopped mid-race. A previous-day session that
// still matters is still SENDING; a stale one went quiet overnight. `activity`
// (gpsService.getSessionActivity) gives the last live send attempt and when the
// session last came back from a gap of PREVIOUS_DAY_QUIET_MS without one:
//   - quiet now (no send attempt for PREVIOUS_DAY_QUIET_MS, or never), or
//   - it came back from such a gap TODAY (event-local) — Sunday morning the
//     cold boot restarted Saturday's engine and it already sends again (the
//     drive to the start), after a whole night without a send.
// A runner sending steadily on course meets neither. No activity → false.
export const PREVIOUS_DAY_QUIET_MS = 30 * 60 * 1000;

export interface SessionActivity {
  /** Last live send attempt (ms), 0 = none since Start. */
  lastSentAt: number;
  /** When a send attempt last followed a gap of >= PREVIOUS_DAY_QUIET_MS (ms), 0 = never. */
  quietGapEndedAt: number;
}

export function eventLocalDay(ms: number, eventTzOffsetMs: number): string {
  return new Date(ms + eventTzOffsetMs).toISOString().slice(0, 10);
}

export function isPreviousDaySession(
  params: { participantId?: unknown; raceStartTime?: string | null } | null | undefined,
  home: { show_start_track?: number; next_race_participant_app_id?: unknown; next_race_date?: string | null } | null | undefined,
  nowMs: number,
  eventTzOffsetMs: number | null | undefined,
  activity?: SessionActivity | null,
): boolean {
  if (!params || !home || !activity) return false;
  if (typeof eventTzOffsetMs !== 'number' || !isFinite(eventTzOffsetMs)) return false;
  if (!params.raceStartTime) return false;
  const gun = new Date(params.raceStartTime).getTime();
  if (isNaN(gun)) return false;
  if (home.show_start_track !== 1) return false;
  const homePid = home.next_race_participant_app_id;
  if (homePid == null || homePid === '' || params.participantId == null || params.participantId === '') return false;
  if (String(homePid) === String(params.participantId)) return false;
  const today = eventLocalDay(nowMs, eventTzOffsetMs);
  if (!(eventLocalDay(gun, eventTzOffsetMs) < today)) return false;
  if (String(home.next_race_date ?? '').trim().slice(0, 10) !== today) return false;
  const last = Number(activity.lastSentAt) || 0;
  const quietNow = last <= 0 || nowMs - last >= PREVIOUS_DAY_QUIET_MS;
  const gapEnd = Number(activity.quietGapEndedAt) || 0;
  const cameBackToday = gapEnd > 0 && eventLocalDay(gapEnd, eventTzOffsetMs) === today;
  return quietNow || cameBackToday;
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
