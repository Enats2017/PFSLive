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
