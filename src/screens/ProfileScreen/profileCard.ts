/**
 * Which membership/tracking card the profile should show.
 *
 * Pulled out of OwnProfile.tsx so it can be tested. The six states of the
 * display matrix are all decided here, and getting one wrong is the kind of
 * bug that only shows up as wrong *copy* on a device - which is why the
 * decision is worth asserting rather than eyeballing.
 *
 * Deliberately pure and RN-free: no imports that run at require time, so a
 * plain node script can exercise it without a test framework (there is none in
 * this repo). The AthleteProfile import is type-only and erased at compile
 * time. Keep it that way.
 */

/** Shapes this module needs. Structural, so the real AthleteProfile satisfies
 *  them without this file importing anything that executes. */
export type CardFreeEvent = {
  event_id: number;
  event_name: string;
  race_date: string;
};

export type CardActivation = {
  event_name: string;
  remaining: number;
};

export type CardMembershipInfo = {
  has_membership: boolean;
  unlimited: boolean;
  remaining: number | null;
  event_only?: number;
  event_activations?: CardActivation[];
};

export type CardProfileInput = {
  membership_info?: CardMembershipInfo | null;
  free_events?: CardFreeEvent[];
  in_process_payment?: number | null;
};

export type CardState =
  /** Paid, Mollie's callback not landed yet. Nothing else is known. */
  | 'payment_processing'
  /** The EUR 5.95 single activation, and it is ALL the cover they have. */
  | 'event_activation'
  | 'unlimited'
  | 'sessions_left'
  | 'exhausted'
  /** A free race, and no membership of any kind. The free race IS the card. */
  | 'free_only'
  | 'no_membership';

/** The extra "it won't use a session" line, beside a real membership. */
export type CardExtraLine = null | 'alsoIncluded' | 'stillAvailable';

export type CardDecision = {
  state: CardState;
  remaining: number;
  freeEventCount: number;
  /** The event's name when there is exactly ONE free race, else null - the
   *  caller then renders a count, so the line cannot grow unbounded across a
   *  season of included races. */
  freeEventName: string | null;
  extraLine: CardExtraLine;
  activationEventName: string | null;
};

export function resolveProfileCard(profile?: CardProfileInput | null): CardDecision {
  const mi = profile?.membership_info ?? null;

  const freeEvents = profile?.free_events ?? [];
  const freeEventCount = freeEvents.length;
  const hasFreeEvents = freeEventCount > 0;

  const hasMembership = mi?.has_membership === true;
  const isUnlimited = mi?.unlimited === true;
  const remaining = mi?.remaining ?? 0;

  // The EUR 5.95 activation names its event instead of counting sessions, but
  // only when it is all the cover they have (event_only): somebody who also
  // holds a real membership should still see their session count. Spent
  // activations (remaining 0) fall through to the normal copy, which is then
  // accurate.
  const activation =
    mi?.event_only === 1
      ? (mi?.event_activations ?? []).find((a) => a.remaining > 0)
      : undefined;

  // Not shown for unlimited (no session to save, so it is only noise), and not
  // beside the activation copy (two event names in one card reads as a
  // contradiction).
  //
  // This departs from how the activation is treated, on purpose: the client's
  // requirement is precisely that a free race does NOT consume a session, and
  // saying nothing about that is what generates "did my free race use one of
  // mine?" tickets.
  const extraLine: CardExtraLine =
    hasFreeEvents && hasMembership && !isUnlimited && !activation
      ? remaining > 0
        ? 'alsoIncluded'
        : 'stillAvailable'
      : null;

  let state: CardState;
  if (profile?.in_process_payment === 1) {
    state = 'payment_processing';
  } else if (activation) {
    state = 'event_activation';
  } else if (hasMembership && isUnlimited) {
    state = 'unlimited';
  } else if (hasMembership && remaining > 0) {
    state = 'sessions_left';
  } else if (hasMembership) {
    state = 'exhausted';
  } else if (hasFreeEvents) {
    // Ahead of 'no_membership' because that branch is reached both by a spent
    // membership and by no membership at all - so without this, the one person
    // who should be reassured gets "you have no sessions left".
    state = 'free_only';
  } else {
    state = 'no_membership';
  }

  return {
    state,
    remaining,
    freeEventCount,
    freeEventName: freeEventCount === 1 ? freeEvents[0].event_name : null,
    extraLine,
    activationEventName: activation ? activation.event_name : null,
  };
}
