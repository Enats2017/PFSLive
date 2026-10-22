# Livio growth work — test plan (2026-10-14)

App branch `growth_v0.1` (PFSLive) · API branch `growth_api_v0.1` (larssie) · web `livio_web` unchanged.

## A. Automated — run before every build

| Suite | Command | Result 2026-10-14 |
|---|---|---|
| Type check | `npx tsc --noEmit` (PFSLive) | clean |
| Design / i18n audit | `npm run design-check` | exit 0 |
| Tracking engine (regression) | `npm run test:tracking` | 188 / 188 |
| Profile activation (regression) | `npm run test:activation` | 19 / 19 |
| **Growth — app** | `npm run test:growth` | **466 / 466** |
| **Growth — API + crons + web** | `php tests/growth/growth_api_test.php` (larssie, local only) | **435 / 435** (+1 skipped on a local web build) |
| Segment distance (2026-10-22) | `php tests/rr_unranked/segment_distance_test.php` (larssie) | 10 / 10 |
| **Growth — web follow/login** | `npm run test:follow` (livio_web) | **97 / 97** |
| Web (other) | `npx vitest run` (livio_web) | 106 / 106 |

Proof the app suite catches regressions: run against the pre-change code
(`APP_SRC=<design_newv0.2 checkout>/src npm run test:growth`) → 64 of 67 fail; the 3 that pass
are the "existing flow untouched" checks, which must pass on both.

### What the automated suites cover
- **Share link:** exact URL; leading-zero bib; hidden without bib / with bib "0" / without distance; share sheet message; analytics for shared and dismissed.
- **Countdown:** same maths as the Start gate; independent of the phone's timezone; labels; hidden 30 min after the gun.
- **Readiness:** every permission combination on iOS and Android; the order fixes are listed in; battery read failure; power saving never blocks; report to the server only when something changes, with retry after failure.
- **Get race-ready:**
  - opens once per race; never when everything is set; power saving alone doesn't open it
  - never over another screen, and is not used up when skipped
  - 120-day memory; navigator not ready
- **Fan notification ask:** first follow; already allowed; OS won't ask again; 30-day cooldown; simulator; double follow shows one sheet.
- **Notification permission:**
  - never prompts on launch
  - silent registration; no repeat token calls
  - permission revoked or granted in Settings
  - asking: grant, deny, OS won't ask again
  - Android channel exists before the prompt
- **Following without push:**
  - one guest id even for parallel calls; offline follow kept and sent later
  - web follows merged on the first id; a pending follow is never overwritten
  - reinstall restore; no server row for a brand-new user; bib follows
- **Server:**
  - readiness endpoint, including validation, a hostile `device_id`, and not touching token / language / web-push
  - guest follower: app platform; web unchanged
  - guest row → push token on the same row with follows kept; follows restored by `device_id`
  - web push ↔ app sharing one row
  - `home_api` bib as text, empty bib, guest, existing fields unchanged
- **48h push:**
  - all 3 messages; French
  - window edges (30h / 60h); night in the event's timezone
  - no token; already sent; deactivated token
  - test mode writes nothing; the 1-hour race-start push is unchanged
- **48h email:**
  - who gets it: member; single activation for this event or another; no plan; unverified account; already connected
  - which entries count: cancelled or unpaid entry; email matched ignoring case and spaces; no app account
  - no repeat: already mailed for this event
  - no-push group: all 3 messages, and no mail when a token exists; window
  - Dutch text and store links; test mode writes nothing; test mode without `--id` / `--all` is refused
- **Web share page:** the built page exists under `/livio_website`; it reads the three link params; the API accepts `from_live`.

## B. Manual — on real phones (cannot be automated)

Use a **development/preview build of 1.1.0** (this branch is not an OTA to 1.0.9).
Test on **one iPhone + one Android 13+** (plus Android 11/12 if available for the background step).
Reset between runs = uninstall + reinstall.

### B1. First launch (fresh install)
- [ ] 1. No notification popup on launch (iOS and Android).
- [ ] 2. No battery-optimisation popup on launch (Android).
- [ ] 3. Logged out, no race: the home screen shows "No race coming up — Find a race" and the next events; tapping one opens it.

### B2. Fan flow (logged out)
- [ ] 4. Follow an athlete → the explanation sheet appears → "Turn on" → OS prompt → Allow → push token row appears in `oc_follower_app` with the same `follower_id` as before.
- [ ] 5. Fresh install, follow → sheet → "Not now" → no OS prompt. Follow someone else → no sheet (30-day pause).
- [ ] 6. Fresh install, follow → sheet → "Turn on" → **Don't allow** → the follow still shows on the web for this device (`get_follow_data_by_device`).
- [ ] 7. Settings gear → Notifications row → screen says "Off" → button opens phone Settings → switch on → return to the app → the screen says "On" without a restart.
- [ ] 8. Open the live map of any race → **no location popup**. If location was allowed before, your blue "you" dot still shows.
- [ ] 9. Reinstall with push off → follows come back after opening Home.

### B3. Runner — connect and get race-ready (logged in, race 3+ days ahead)
- [ ] 10. Connect to a distance in the app → success modal → close → "Get race-ready" opens, "Step 1 of N".
- [ ] 11. Walk through: notifications → location (When in use) → **background ("Allow all the time")**:
  - [ ] iOS: second popup or Settings.
  - [ ] Android 11+: the system settings page opens. Choose "Allow all the time", come back, and the step completes.
- [ ] 12. Location services switched off on the phone → that step appears → opens the location toggle page.
- [ ] 13. Android: battery step → system dialog → allow → step completes.
- [ ] 14. Tap "Later" on a step → the end screen says "Almost ready" (not "You're ready").
- [ ] 15. Connect to the same race again or reopen the app → race-ready does **not** open a second time.
- [ ] 16. Verification-email route: connect via the website/email link → the `livio://registration-confirmed` link opens the event → race-ready appears on top.
- [ ] 17. Create a custom event → race-ready appears (if anything is missing).
- [ ] 18. A runner connected **before** this build, with a race 3+ days ahead → opening Home shows race-ready once. If the race is ≤3h away → it does **not** show.
- [ ] 19. Open the app from a push notification while race-ready would trigger → you stay on the screen the push opened.

### B4. Runner — home screen before the race
- [ ] 20. The race card shows "Starts in 2 d 4 h" before Start is pressed, counts down, and disappears once tracking starts. For a manual-start race: no countdown.
- [ ] 21. The "Ready to race?" card lists only what is missing; Fix opens race-ready; with everything set it says "all set".
- [ ] 22. Power saving on → the card shows it; Fix opens power-saving settings (Android). No Fix button on iOS.
- [ ] 23. "Share my live link" → share sheet → open the link on another phone → the runner's result page opens on my.liviolive.com/livio_website.
- [ ] 24. Runner without a bib yet → no share button.

### B5. Race morning — Start (regression)
- [ ] 25. Everything allowed → Start works exactly as before; tracking on the map.
- [ ] 26. Deny-everything install → Start → permission modal (new text "Let your family and friends follow you live", navy icon) → allow → tracking starts.
- [ ] 27. Android 11+: "Only while using" → Start → the modal sends you to settings → choose "Allow all the time" → tracking starts on return.
- [ ] 28. Power saving on → the existing power-saving gate still shows.
- [ ] 29. While tracking, open the live map → no second location stream (the you-dot doesn't need it; check the tracking log for no errors).

### B6. Email deep link (preselected distance)
- [ ] 30. `livio://event?product_app_id=<id>&event_name=<name>&pov=<distance>` opens the event with that distance highlighted and scrolled into view. **Nothing is registered** until you tap connect.

### B7. Server, live (after deploy, in this order)
- [ ] 31. Run both migrations on live. `SHOW COLUMNS FROM oc_follower_app LIKE '%ready%'` → 3 rows; `oc_race_reminder_mail_app` exists.
- [ ] 32. Check `snippet_config.php` on live has 5.95 / 19.95 / 24.95.
- [ ] 33. `php service/snippets/send_race_reminder_48h_mail.php test --all` → read `race_reminder_48h_mail.txt` and `livio_run_mode_test.log` for real names and texts.
- [ ] 34. `php api/send_race_reminder_48h.php test` → read `storage/logs/race_reminder_48h_cron.txt`.
- [ ] 35. A real push 48h before with your own phone connected to a test race: arrives in daytime, the text matches your readiness, and tapping it opens Home.
- [ ] 36. A real email: your own account, web entry, not connected → the connect mail arrives from "Livio". Run again → no second mail.
- [ ] 37. Add both crontab lines (every 15 min). After the first day: no duplicates in `oc_notification_sent_app` (`race_reminder_48h`) or `oc_race_reminder_mail_app`.

### B8. Analytics (Firebase DebugView, production build)
- [ ] 38. `start_step`: screen_ready, tap, blocked (with reason), permission_result.
- [ ] 39. `race_ready_step`: shown, each step result, done/skipped.
- [ ] 40. `notification_ask` (follow / race_ready / settings_screen) and `share_live_link`.
