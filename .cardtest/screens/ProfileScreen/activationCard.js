"use strict";
/**
 * What the profile card should say about the EUR 5.95 single activation.
 *
 * An activation is valid at ONE event, so it is never part of the session
 * count - the server keeps it out of membership_info.remaining and sends it
 * separately as event_activations. This decides where it shows up:
 *
 *   'primary' - it is ALL the cover they have (event_only), so it IS the
 *               card's message: "Valid for {event} only."
 *   'extra'   - they also hold a capped plan. The plan's count stays the
 *               message and the activation gets its own line under it - also
 *               when the plan is used up, because "no sessions left" alone is
 *               wrong for someone who can still track at that event.
 *   null      - nothing to say: no unused activation, or an unlimited plan
 *               (which already covers that event, so the line is only noise).
 *
 * Every unused activation is named, not just the first: somebody with two
 * (two events) used to see only the soonest one.
 *
 * Deliberately pure and RN-free, like profileCard.ts, so a plain node script
 * can test it (activationCard.test.ts). Keep it that way.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveActivation = resolveActivation;
function resolveActivation(mi) {
    var _a, _b;
    const names = [];
    for (const a of (_a = mi === null || mi === void 0 ? void 0 : mi.event_activations) !== null && _a !== void 0 ? _a : []) {
        const name = ((_b = a === null || a === void 0 ? void 0 : a.event_name) !== null && _b !== void 0 ? _b : '').trim();
        // Spent activations (remaining 0) say nothing; the API keeps returning
        // them until their end_date.
        if (a && a.remaining > 0 && name !== '' && !names.includes(name))
            names.push(name);
    }
    if (names.length === 0)
        return { placement: null, eventNames: null };
    const eventNames = names.join(' & ');
    if ((mi === null || mi === void 0 ? void 0 : mi.event_only) === 1)
        return { placement: 'primary', eventNames };
    if ((mi === null || mi === void 0 ? void 0 : mi.unlimited) === true)
        return { placement: null, eventNames: null };
    return { placement: 'extra', eventNames };
}
