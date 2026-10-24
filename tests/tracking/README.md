# Tracking regression tests

Run before every `eas update` / store build that touches tracking:

```bash
npm run test:tracking
```

Plain Node, no test framework. `harness.js` transpiles the **real** source in
`src/` on the fly and replaces native / Expo modules (AsyncStorage, NetInfo,
Transistor, expo-location, axios, the API client) with controllable mocks, so
the queue, drain, start-ping and diagnostics logic runs exactly as shipped.

Written after the 2026-10-07 tracking audit (8 events, 2026-09-05 → 10-04).
What each group guards:

| Group | Guards against |
|---|---|
| 1. hasNetwork / probe | a phone stuck "offline" for hours because NetInfo said unreachable and the API was never tried |
| 2. queue parking | a fresh Start deleting the previous session's unsent fixes (540 lost in Sep-Oct) |
| 3. drainOrphans | leftover fixes never uploaded, uploaded twice, out of order, or into a live session |
| 4. processQueue | regressions in the live backlog drain |
| 5. start ping | no `oc_tracking_starts_app` row when the first request fails; missing diagnostics |
| 6. interim log | "silent" sessions (start ping, then nothing) leaving no device log at all |
| 7. version / i18n / wiring | hard-coded app version; missing translations; HomeScreen not calling the above |
| 8. drainForStop | Stop sending only the first 50 queued fixes (p1652 stopped with 173 queued) |
| 9. gpsService wiring | the REAL startWatchingPosition still wiping the queue, or the heartbeat not triggering the interim log |
| 10. incident replays | end-to-end replays of p2699, p1652, p2595 (stuck "offline"), the Dinant DB outage and a silent session |
| 11. device test plan | rows 1, 2, 6 of the checklist below, run against the real code: `deviceInfo` on a normal Stop upload, HomeScreen's own Stop-before-gun dialog, the 🩺 line with location off / permission denied |
| 12. 2026-10-18 audit | a RaceResult finish not stopping tracking; sessions >24h after the gun resuming; gun from stale home data; watchdog re-pointing the session |
| 13. event 19 review (2026-10-19) | iOS Start failing when the phone is pocketed at once (p4537/p4807/p4826); the start ping lost in a pocket (p4566); iOS killing the idle engine before the gun (p4823); zombie sessions sending for weeks (p2525, p1601); 7 concurrent interim uploads (p4536); repeated log blocks (p4848) |
| 14. Grizzly100 pre-race | an 18 h offline queue (1500 fixes) surviving Stop, restarts and the full-log write throttle |
| 15. tracking safety net (2026-10-24) | silent starts (OS killed Livio after Start): "not tracking" check at gun + 4, 15-min watchdog, early-Start reminder; start ping battery / device diag; Start popup line |
| 16. recording but not sending (2026-10-24 08:20) | a phone with no working data for hours (bib 1269, bib 410) never told: one local notification 20 min after the last accepted send, withdrawn on the next; dead zones of 15-18 min, standing still and before the gun stay silent |
| 17. no side effects | a hung battery read losing the start ping; heartbeat / orphan sends counted as "sent"; Start / Stop touching the start reminders; a safety notification opening a result; a stale send stamp warning the next race; a normal online race showing any safety notification |

Groups 8-11 fail on the pre-fix commit `ebfec46` (except the DB-outage replay,
which the app already survived — that fix was server-side — and two group-11
guards for behaviour that was already right).

## Device test plan → automated test

The manual checklist for a preview build on the demo server (2026-10-08). Each
row is also covered here or in the larssie repo's `tests/tracking_api`
(`server.test.sh` section N), so a failure on the phone that these all pass
points at the OS / device, not the code.

| # | On the phone | Automated |
|---|---|---|
| 1 | normal session, Stop → coordinates + `deviceInfo` `android 14 app:… upd:…` | group 11 #1; server §8 |
| 2 | Stop before the gun → confirmation; after the gun → stops at once | group 11 #2; group 7 strings |
| 3 | airplane mode mid-session, Stop offline, back online → nothing missing | group 8; replay p2699; group 3 |
| 4 | same, but Start again (same race) while offline → leftovers first | group 2; group 9; replay p1652 |
| 5 | start ping → one `oc_tracking_starts_app` row, diagnostics in the log | group 5; server §5 |
| 6 | location off / permission denied → 🩺 device log 5 min after the gun | group 6; group 11 #6; replay silent session |
| 7 | rejected fix → `LOCATION FAIL <code>` in the API log | server §3 |
| 8 | profile card: activation / two / Pro + activation / Pro used up + activation | `npm run test:activation` (decision + en/fr/nl copy); server §9 |
| 9 | forgot password → no code in the API log | server §7 |

To prove a test really catches its bug, run it against an older checkout:

```bash
git worktree add ../pfs-old <old-commit>
APP_SRC=../pfs-old/src npm run test:tracking     # expected: failures
git worktree remove ../pfs-old
```

These tests do not replace one real tracking session on a preview build — they
cannot exercise the OS (background limits, permission dialogs, GPS hardware).
