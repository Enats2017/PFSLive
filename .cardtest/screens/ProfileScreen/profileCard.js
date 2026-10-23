"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveProfileCard = resolveProfileCard;
const activationCard_1 = require("./activationCard");
function resolveProfileCard(profile) {
    var _a, _b, _c;
    const mi = (_a = profile === null || profile === void 0 ? void 0 : profile.membership_info) !== null && _a !== void 0 ? _a : null;
    const freeEvents = (_b = profile === null || profile === void 0 ? void 0 : profile.free_events) !== null && _b !== void 0 ? _b : [];
    const freeEventCount = freeEvents.length;
    const hasFreeEvents = freeEventCount > 0;
    const hasMembership = (mi === null || mi === void 0 ? void 0 : mi.has_membership) === true;
    const isUnlimited = (mi === null || mi === void 0 ? void 0 : mi.unlimited) === true;
    const remaining = (_c = mi === null || mi === void 0 ? void 0 : mi.remaining) !== null && _c !== void 0 ? _c : 0;
    // The EUR 5.95 activation names its event(s) instead of counting sessions
    // when it is all the cover they have (event_only); beside a capped plan it
    // gets its own line instead - see activationCard.ts. Spent activations
    // (remaining 0) say nothing.
    const act = (0, activationCard_1.resolveActivation)(mi);
    const activation = act.placement === 'primary';
    // Not shown for unlimited (no session to save, so it is only noise), and not
    // beside the activation copy (two event names in one card reads as a
    // contradiction).
    //
    // Same rule as the activation's own extra line (activationExtra): beside a
    // capped plan, say it. The client's requirement is precisely that a free race
    // does NOT consume a session, and saying nothing about that is what generates
    // "did my free race use one of mine?" tickets.
    const extraLine = hasFreeEvents && hasMembership && !isUnlimited && !activation
        ? remaining > 0
            ? 'alsoIncluded'
            : 'stillAvailable'
        : null;
    let state;
    if ((profile === null || profile === void 0 ? void 0 : profile.in_process_payment) === 1) {
        state = 'payment_processing';
    }
    else if (activation) {
        state = 'event_activation';
    }
    else if (hasMembership && isUnlimited) {
        state = 'unlimited';
    }
    else if (hasMembership && remaining > 0) {
        state = 'sessions_left';
    }
    else if (hasMembership) {
        state = 'exhausted';
    }
    else if (hasFreeEvents) {
        // Ahead of 'no_membership' because that branch is reached both by a spent
        // membership and by no membership at all - so without this, the one person
        // who should be reassured gets "you have no sessions left".
        state = 'free_only';
    }
    else {
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
