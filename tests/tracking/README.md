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
| 18. Android headless relaunch | `ready()` called while headless, so no event reached JS until Livio was opened (bibs 151 / 353 / 2 / 459) |
| 20. GTLC Winter post-race (2026-11-08) | p6755: a finish answer on a backlog leaving the session open until the queue was empty (it only moved while Livio was on screen — no device log, engine left on, "stopped tracking" pushes); the heartbeat draining only through a fresh fix (none indoors); a hung battery read holding the whole beat; no `queue_left` on queued fixes; heartbeat pings without the phone's state, and none at all from a headless beat |
| 21. GTLC Winter day 2 (2026-11-08) | the engine heartbeat firing only while stationary (kept moving since 10-20 → no liveness ping, no `[#HB-DIAG]`, no interim log for 3 weeks): `[#HB-PULSE]` does that bookkeeping from fixes, at most once a minute; `[#TRACK-WAKE]` the watch cron's silent push re-attaches a phone the server hears nothing from (p7136 / p7071 / p7276 never sent a fix, p7337 / p6468 silent 40 / 98 min) — payload shapes, engine restart, fix, backlog, device log once per 30 min, Android headless gate, nothing after Stop / finish; `[#SAME-FIX-ONCE]` the engine replaying a fix already sent / queued (p6622, p6679) is not sent again, a merely late new fix still is |
| 22. Start/Stop lifecycle (2026-11-26 audit) | a Stop running twice (double tap, finish tick + foreground) or letting a Start in while it drains (old Stop writing into the new session); a Stop during the engine start leaving a hidden running engine; the Stop log lost when Livio is killed during the Stop; an unclosed Saturday session taking over Sunday (`[#PREV-DAY]`, Soupe Challenge, gun 19.5 h / 21 h apart); a silent logout mid-race on a 401; a restore kept over a session rehydrate had just ended; a Start finishing on an unmounted Home; a leaked home poll; interleaved start-reminder syncs. All 14 fail on c8b1901 |

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

## GT80 end-to-end (2026-11-08, local only)

`e2e_gt80_server.js` runs the REAL app code against the REAL larssie APIs of a
local checkout, on a copy of the GTLC Winter GT80 distance with its real GPX
(78.909 km), a fake RaceResult feed the test moves on during the race, and then
the REAL watch cron (Expo replaced). Seven runners: p6755's offline backlog after
the RR finish (S1), a phone dead at km 74 after the finish (S2), an RR DNF (S3),
an indoor backlog with no GPS fix (S4), the network lost during the leftover
upload (S5), Livio killed during it (S6, no duplicate rows), a live finish (S7).

```bash
# larssie checkout with a test config.php whose DIR_STORAGE is a scratch folder
php -S 127.0.0.1:8099 -t <larssie>
php -S 127.0.0.1:8097 -t <larssie>/tests/tracking_api/fixtures/rr_fake
LARSSIE_DIR=<larssie> E2E_STORAGE=<that DIR_STORAGE> node tests/tracking/e2e_gt80_server.js
# ONLY=S1,S6 for some scenarios; APP_SRC / API_BASE + RR_URL for older app / server code
```

Writes fixtures 99xxxx to the local DB and removes them. About 8 minutes: the API
allows 600 requests a minute, so the run paces itself. Clear the scratch
`api_rate_limits` folder between runs. On 2026-11-08: 7/7; Saturday's app
(`dc7d69a`) fails S1, S4, S5, S6.

These tests do not replace one real tracking session on a preview build — they
cannot exercise the OS (background limits, permission dialogs, GPS hardware).

## Trail de la Soupe end-to-end (2026-11-25, local only)

`e2e_soupe_server.js` runs the REAL app code against the REAL larssie APIs of a local
checkout on the six real Trail de la Soupe day routes (event 24, 2026-11-28 / 29; every
route a loop whose start is 25-36 m from its finish), with fake RaceResult lists the test
moves on as the race goes, and then the REAL watch cron (Expo replaced). The server half
is larssie `tests/tracking_api/e2e_soupe_fixture.php` (database independent: the event is
built from the seeded app event 24, MySQL-assigned ids deleted by id) and
`tests/tracking_api/fixtures/rr_fake_soupe/`.

| # | Scenario |
|---|---|
| S1 | 14 km online, RaceResult finish at the mat stops tracking at the line; no push |
| S2 | Challenge 7A Saturday 32 km: offline from km 15, RR finish meanwhile, back online indoors → one heartbeat delivers every fix and closes the session |
| S3 | Challenge 8B Sunday 57 km: network lost during the leftover upload → rest kept, delivered on the next open, no duplicates |
| S4 | 26 km: Livio killed during the leftover upload → every fix stored exactly once |
| S5 | 38 km: RaceResult DNF, phone quiet → "stopped tracking" push still goes out |
| S6 | 21 km: RaceResult finished, phone died → no push (control: not finished → push) |
| S7 | 14 km: Start 10 min before the gun at the start area → no finish, session open |
| S8 | Challenge 7B: Sunday session on the phone that finished Saturday → Saturday's finish flag cleared, tracks normally |
| S9 | 57 km live through the Sunday village hairpin (course 9-25 m from itself) → distance never back, no finish |
| S10 | 21 km, bib not on the RaceResult list → GPS finish at the line stops tracking |
| S11 | 32 km, RaceResult finish 3 min after the line → keeps tracking until it arrives, then stops |

```bash
# larssie checkout served by Apache (default http://localhost/larssie_soupe), on a fresh test database
php -S 127.0.0.1:8098 -t <larssie>/tests/tracking_api/fixtures/rr_fake_soupe
LARSSIE_DIR=<larssie> API_BASE=<its URL> E2E_STORAGE=<its DIR_STORAGE> node tests/tracking/e2e_soupe_server.js
# ONLY=S1,S8 for some scenarios
```

About 15 minutes; it paces itself under the API's 600 requests a minute, and keeps >= 1.1 s
of real time between live fixes (the server stamps them to the second: two in one second
are an exact duplicate). On 2026-11-25 on db_larssie_tsoupe: 11/11.
