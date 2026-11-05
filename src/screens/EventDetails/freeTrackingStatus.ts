/**
 * Which modal a distance should show, once "Livio tracking included" is in the
 * picture. Pure - tested in freeTrackingStatus.test.ts
 * (npm run test:free-tracking-status).
 *
 * event_detail_api sends TWO fields, and they are not the same question:
 *
 *   free_tracking_included   a fact about the RACE. Published to everyone,
 *                            signed-out callers included, so the distance can
 *                            be badged "Live tracking included" before anybody
 *                            logs in.
 *   free_tracking_entitled   a fact about the PERSON - they hold a live paid
 *                            website entry on this distance. Only sent to a
 *                            signed-in caller. The registration gate reads
 *                            exactly this.
 *
 * included = 1 with entitled = 0 is "this race includes tracking, but we
 * cannot find YOUR entry", and left alone the screen says the wrong thing
 * twice: it offers a membership on a distance it has just badged as included,
 * and it sells sessions for a race the reader is not in, where a session buys
 * them nothing because they have no bib.
 *
 * The person who actually reaches that state is usually a REAL entrant whose
 * app e-mail differs from the one they registered with. The two sides are
 * joined by e-mail and nothing else, and on 2026-11-05 968 of 6,277 app
 * accounts (15%) had no website account on the same address. So the
 * replacement message names that and says what to do about it.
 */

export type ServerRegistrationStatus =
  | 'available'
  | 'registered'
  | 'membership_required'
  | 'limit_reached'
  | 'membership_upcoming'
  | 'unavailable';

export type ModalStatus = ServerRegistrationStatus | 'free_not_registered';

export interface FreeTrackingDistanceLike {
  registration_status?: ServerRegistrationStatus | null;
  free_tracking_included?: number | null;
  free_tracking_entitled?: number | null;
}

/**
 * Only the two BLOCKED states are substituted.
 *
 * 'available' is deliberately left alone: somebody with a session to spend may
 * still connect tracking, exactly as they could on any distance before this
 * feature existed, and the connect modal already tells them it uses a session.
 * Substituting it here would take away behaviour this change has no business
 * touching.
 *
 * 'registered' and 'unavailable' are left alone too - already having tracking,
 * or registration being closed, matters more to the reader than the entry.
 *
 * An ABSENT free_tracking_entitled is not the same as a 0, and the difference
 * matters: this app can ship before the backend half is uploaded, and an API
 * that does not compute the entitlement yet sends `included` alone. Treating
 * that as "not entitled" would tell every blocked reader we cannot find their
 * registration, on a backend that never looked. So the substitution needs the
 * field to be actually present, and anything else keeps the server's own
 * status - which can only ever fall back to today's behaviour.
 */
export function freeTrackingModalStatus(
  d: FreeTrackingDistanceLike | null | undefined,
): ModalStatus | null {
  if (!d) return null;

  const included = (d.free_tracking_included ?? 0) === 1;
  const entitledKnown =
    d.free_tracking_entitled !== undefined && d.free_tracking_entitled !== null;
  const entitled = d.free_tracking_entitled === 1;
  const blocked =
    d.registration_status === 'membership_required' ||
    d.registration_status === 'limit_reached';

  if (included && entitledKnown && !entitled && blocked) return 'free_not_registered';

  return d.registration_status ?? null;
}
