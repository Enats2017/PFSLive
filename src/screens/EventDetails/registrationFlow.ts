/**
 * Registration ("Connect") decisions, pure so they can be tested without React.
 * Tested in registrationFlow.test.ts (command in that file's header).
 *
 * App audit 2026-11-26 - each rule below closes one finding of that audit.
 */

/**
 * ✅ How a failed register / confirm / unregister call ended (audit H1).
 *
 * api.ts turns a 401 into a THROWN AppError('server', 'session_expired') -
 * the server never answers `action: 'unauthorized'`. The screens only looked
 * for that action, so a revoked or expired token fell into the catch and read
 * "Unable to connect to the server" with a Retry that could never work: the
 * runner was stuck until they logged out by hand.
 */
export type CallFailure = 'session_expired' | 'network' | 'server';

export function classifyCallError(err: unknown): CallFailure {
  const e = err as { code?: unknown; type?: unknown } | null | undefined;
  if (e && e.code === 'session_expired') return 'session_expired';
  if (e && e.type === 'network') return 'network';
  // A 4xx/5xx with a body (validation codes, rate limit): the request reached
  // the server, so "check your internet connection" would be the wrong advice.
  if (e && (e.type === 'server' || e.type === 'empty')) return 'server';
  return 'network';
}

/**
 * ✅ 'already_registered' after the runner pressed Connect / Confirm means the
 * registration IS on the server (audit M1/M2) - typically the first request
 * timed out at 15 s after the server had inserted, and this is the Retry. It
 * is an outcome to show as registered, not a failure: the confirm step used to
 * answer it with "confirmation failed" + Retry, forever, and the card kept its
 * Connect button.
 */
export function isRegisteredOutcome(action: string | undefined | null): boolean {
  return action === 'registered' || action === 'already_registered';
}

/**
 * ✅ How long a "connect after login" survives (audit H2).
 *
 * It was kept with no time limit and was not cleared on logout, so a Connect
 * tapped while logged out and abandoned at the login screen was replayed on
 * the NEXT login - weeks later, from any screen - and registered the runner
 * (spending a session) on an event they had long forgotten. The login it is
 * meant for happens right away.
 */
export const PENDING_REGISTRATION_TTL_MS = 30 * 60 * 1000;

/**
 * A saved pending registration is replayed only when it carries the time it
 * was saved and that time is recent. A missing or unreadable time (an entry
 * written by an app version before this rule) is treated as stale: the safe
 * direction, since replaying registers and can spend a session.
 */
export function isPendingRegistrationFresh(
  savedAt: string | number | null | undefined,
  now: number,
  ttlMs: number = PENDING_REGISTRATION_TTL_MS,
): boolean {
  if (savedAt === null || savedAt === undefined || savedAt === '') return false;
  const t = Number(savedAt);
  if (!Number.isFinite(t) || t <= 0) return false;
  // A time in the future (clock changed) is not trusted either.
  return t <= now && now - t <= ttlMs;
}

/**
 * ✅ After "This is me" in ParticipantResult (audit M4): which popup an answer
 * needs. membership_required / limit_reached / membership_upcoming used to
 * show "You are already registered for this event" - the opposite of the
 * truth - and the screen then closed. They need the membership popup.
 */
export type ThisIsMeOutcome =
  | 'confirm'
  | 'registered'
  | 'email_sent'
  | 'membership'
  | 'already_registered'
  | 'invalid_bib'
  | 'validation'
  | 'failed';

export function thisIsMeOutcome(action: string): ThisIsMeOutcome {
  switch (action) {
    case 'confirm_race_result':
      return 'confirm';
    // ✅ Real successes (review 2026-11-26). On an event without Race Result /
    // table match the server inserts straight away and answers 'registered'
    // even with show_confirm_popup; with the e-mail flag it answers
    // 'verification_email_sent'. Mapped to 'failed' they showed
    // "registration failed" for a registration that had worked.
    case 'registered':
      return 'registered';
    case 'verification_email_sent':
      return 'email_sent';
    case 'membership_required':
    case 'limit_reached':
    case 'membership_upcoming':
      return 'membership';
    case 'already_registered':
      return 'already_registered';
    case 'bib_number_invalid':
    case 'not_found_in_race_result':
      return 'invalid_bib';
    case 'validation_error':
    case 'missing_parameters':
      return 'validation';
    default:
      return 'failed';
  }
}
