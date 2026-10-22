"use strict";
/**
 * Label of the per-distance results button on the follower event details
 * (DistanceTab): "Participants" on the days before the race, "Results" from
 * race day on. Pure - tested in distanceButton.test.ts (npm run test:distance-button).
 *
 * ✅ Same rule as livio_web's distanceButtonKind (src/lib/liveResultLogic.ts),
 * so the app and the website flip on the same day.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.brusselsDate = brusselsDate;
exports.distanceButtonKind = distanceButtonKind;
// Last Sunday of a month, 01:00 UTC - when EU summer time starts (March) or ends (October).
function lastSundayOneUtc(year, month) {
    const lastDay = new Date(Date.UTC(year, month + 1, 0));
    return Date.UTC(year, month, lastDay.getUTCDate() - lastDay.getUTCDay(), 1);
}
/**
 * Today's date in Brussels as 'Y-m-d', whatever the phone's own time zone.
 * ✅ The EU summer-time rule rather than Intl's timeZone option: Hermes'
 * support for that option differs between builds and platforms, and a wrong
 * zone here would flip the label a day early or late.
 */
function brusselsDate(now) {
    const t = now.getTime();
    const y = now.getUTCFullYear();
    const summer = t >= lastSundayOneUtc(y, 2) && t < lastSundayOneUtc(y, 9);
    const local = new Date(t + (summer ? 2 : 1) * 3600000);
    return local.toISOString().slice(0, 10);
}
/**
 * A live/finished countdown always means Results - it is the server's word.
 * Otherwise the distance's own race_date decides (per distance, so each day of
 * a multi-day event flips on its own day). An unreadable date keeps Results,
 * the label this button had before.
 */
function distanceButtonKind(raceDate, countdownStatus, now = new Date()) {
    var _a;
    if (countdownStatus === 'in_progress' || countdownStatus === 'finished')
        return 'results';
    const day = (_a = /^\d{4}-\d{2}-\d{2}/.exec(raceDate !== null && raceDate !== void 0 ? raceDate : '')) === null || _a === void 0 ? void 0 : _a[0];
    if (!day)
        return 'results';
    return brusselsDate(now) < day ? 'participants' : 'results';
}
