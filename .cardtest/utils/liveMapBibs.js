"use strict";
// Which followed bibs the live map sends for one event, and the request field
// that carries them. Pure, so it can be tested without React or the API
// client: npm run test:live-map-bibs
//
// [#MAP-BIB-FOLLOWS] (2026-10-26, Grizzly100 feedback #31): a fan who followed a
// runner BY BIB saw them on Result Details (bib-keyed) but never on the map — the
// map only sent customer ids (self + followed athletes). 110 of 133 event-20 bib
// follows had no customer follow. get_live_tracking_data_api.php now also takes
// `bibs` and resolves them to that distance's runners.
//
// Bib follows are stored per oc_product_app id (followStorage
// 'followed_bibs_by_product'). Custom events number from a different table
// (product_custom_app_id), so the same id would name an unrelated race: never
// send bibs for a custom event. The API ignores them there too.
Object.defineProperty(exports, "__esModule", { value: true });
exports.followedBibsForEvent = followedBibsForEvent;
exports.liveTrackingBibsParam = liveTrackingBibsParam;
function followedBibsForEvent(followedBibs, productAppId, eventSource) {
    if (eventSource === 'custom')
        return [];
    const id = Number(productAppId);
    if (!Number.isFinite(id) || id <= 0)
        return [];
    const bibs = followedBibs.get(id);
    if (!bibs)
        return [];
    // Sorted, so the joined string is a stable effect dependency and the API's
    // response-cache key does not change with Set order. Deduped after the trim:
    // '450' and ' 450' are one runner.
    return [...new Set([...bibs].map(b => String(b).trim()))]
        .filter(b => b !== '')
        .sort();
}
// The `bibs` value for the get_live_tracking_data request, or null to leave the
// field out. Left out when there are none, so every other request — and its
// server response-cache key — is exactly what it was before.
function liveTrackingBibsParam(followedBibs, eventSource) {
    if (eventSource === 'custom' || followedBibs.length === 0)
        return null;
    return followedBibs.join(',');
}
