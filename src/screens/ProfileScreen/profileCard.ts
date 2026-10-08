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
 * time; activationCard.ts is the one runtime import, and it is pure in the same
 * way. Keep it that way.
 */

import { resolveActivation } from './activationCard';

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
  /** Every unused activation's event ("A & B") when the activation IS the
   *  card (state 'event_activation'), else null. */
  activationEventName: string | null;
  /** The same, when the activation sits BESIDE a capped plan - its own
   *  "Also valid" line, also when the plan is used up. Null beside unlimited. */
  activationExtra: string | null;
};

export function resolveProfileCard(profile?: CardProfileInput | null): CardDecision {
  const mi = profile?.membership_info ?? null;

  const freeEvents = profile?.free_events ?? [];
  const freeEventCount = freeEvents.length;
  const hasFreeEvents = freeEventCount > 0;

  const hasMembership = mi?.has_membership === true;
  const isUnlimited = mi?.unlimited === true;
  const remaining = mi?.remaining ?? 0;

  // The EUR 5.95 activation names its event(s) instead of counting sessions
  // when it is all the cover they have (event_only); beside a capped plan it
  // gets its own line instead - see activationCard.ts. Spent activations
  // (remaining 0) say nothing.
  const act = resolveActivation(mi);
  const activation = act.placement === 'primary';

  // Not shown for unlimited (no session to save, so it is only noise), and not
  // beside the activation copy (two event names in one card reads as a
  // contradiction).
  //
  // Same rule as the activation's own extra line (activationExtra): beside a
  // capped plan, say it. The client's requirement is precisely that a free race
  // does NOT consume a session, and saying nothing about that is what generates
  // "did my free race use one of mine?" tickets.
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
    activationEventName: act.placement === 'primary' ? act.eventNames : null,
    activationExtra: act.placement === 'extra' ? act.eventNames : null,
  };
}
