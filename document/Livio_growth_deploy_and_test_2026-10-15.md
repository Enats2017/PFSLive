# Livio growth work — deployment + test guide (2026-10-15)

Three branches, all pushed, none deployed:

| Repo | Branch | Base | Ships as |
|---|---|---|---|
| App `D:\react_native\PFSLive` | `growth_v0.1` @ `9aca494` | `design_newv0.2` | store build **1.1.0** (not OTA to 1.0.9) |
| Server `C:\xampp\htdocs\larssie` | `growth_api_v0.1` @ `4e7df57e8` | `design-api` | file upload + **1 SQL file** + 2 crons |
| Web `C:\xampp\htdocs\larssie\livio_web` | `growth_web_v0.1` @ `c615850` | `web-design` | rebuilt static export |

All three branches contain their main / master as of 2026-10-20 (app: start reminders, battery checks at Start,
iOS start window; server: checkpoint catch-up, expired sessions, event-page member price; web: race-day report only).
Deploying growth therefore also deploys those main changes — if main is already live, nothing extra.

`<LIVE>` below = the live larssie root (believed `/var/www/html/larssie/` — **confirm**).
Nothing here needs a change to the live `config.php` / `snippet_config.php`.

---

## 0. Before you start

1. **Back up** the live DB tables touched: `oc_follower_app`, `oc_follower_customer_app`, `oc_follower_bib_app`
   (+ a full dump if that is your routine).
2. **Back up** every live file listed in step 2 (copy to `*.bak-20261015`).
3. Confirm the live `service/snippets/snippet_config.php` has the current prices
   (`LITE_MEMBERSHIP 5.95`, `BASIC_MEMBERSHIP 19.95`, `PRO_MEMBERSHIP 24.95`) — they feed the refusal/upgrade mails.
4. Optional, recommended: add a dedicated secret to the live `config.php`:
   `define('LIVIO_MERGE_SECRET', '<64 random hex chars>');`
   (without it the web merge ticket is signed with a key derived from the DB credentials).
5. **How do requests reach live PHP?** Rate limits now use the forwarded client IP ONLY from Cloudflare
   or from a proxy on a private/loopback address (nginx / load balancer in front of Apache). Check once:
   put `<?php echo $_SERVER['REMOTE_ADDR'];` in a temporary file on live, open it, then delete it.
   - Your own public IP, or a Cloudflare IP → nothing to do.
   - A 10.x / 172.16–31.x / 192.168.x / 127.0.0.1 address → nothing to do (trusted proxy).
   - Any OTHER address (a proxy with a public IP) → add to the live `config.php`:
     `define('LIVIO_TRUSTED_PROXIES', '<that address>');` — otherwise every visitor shares one rate-limit bucket.

## 1. Database — run ONE SQL file (re-runnable; sections 1–4 additive, sections 5 and 6 one-off data fixes)

**`db_xml/migration_growth_all.sql`** — phpMyAdmin: select the live database first, then "SQL" tab → paste/import;
or CLI: `mysql db_larssie_live < db_xml/migration_growth_all.sql`. Tested through the real `mysql` client, twice.

It contains, in order (the per-feature files stay in the repo for reference — do not run them as well):

| # | Section | What it adds |
|---|---|---|
| 1 | readiness | `oc_follower_app`: `location_permission`, `notifications_enabled`, `tracking_ready`, `ready_checked_at` |
| 2 | 48 h mail | new table `oc_race_reminder_mail_app` (48 h mail dedupe) |
| 3 | follow order | `oc_follower_app.follow_seq` (order of follow uploads) |
| 4 | guest proof | `oc_follower_app.guest_secret_hash` (web guest proof) |
| 5 | data fix | follower rows switched off (`status = 0`) only because their Expo token died, but still holding web push → active again, dead token cleared |
| 6 | data fix | upcoming registrations (race on/after yesterday) whose copied start date / time / end time differs from their distance's current one, or whose timezone differs from the event's (organiser changed it) → brought in line; past races, cancelled registrations and memberships untouched |

Check afterwards:
```sql
SHOW COLUMNS FROM oc_follower_app WHERE Field IN
 ('location_permission','notifications_enabled','tracking_ready','ready_checked_at','follow_seq','guest_secret_hash');  -- 6 rows
SHOW TABLES LIKE 'oc_race_reminder_mail_app';                                                                        -- 1 row
SELECT COUNT(*) FROM oc_follower_app WHERE status = 0 AND wp_endpoint IS NOT NULL AND wp_endpoint <> '';             -- 0
-- section 6: counts exactly what that section changes
SELECT COUNT(*) FROM oc_participant_app p2
  JOIN oc_product_option_value_app pov ON pov.product_option_value_app_id = p2.product_option_value_app_id
  JOIN oc_product_option_app po ON po.product_option_app_id = pov.product_option_app_id
  JOIN oc_product_app ev ON ev.product_app_id = po.product_app_id
 WHERE p2.race_id = po.product_app_id AND p2.status = 1 AND p2.is_membership = 0
   AND p2.race_date >= DATE_SUB(CURDATE(), INTERVAL 1 DAY) AND pov.race_date > '1000-01-01'
   AND (NOT (p2.race_date <=> pov.race_date) OR NOT (p2.race_time <=> pov.race_time)
        OR NOT (p2.end_time <=> pov.end_time)
        OR (ev.timezone <> '' AND NOT (p2.timezone <=> ev.timezone)));                                             -- 0
```
Rollback lines are at the bottom of each section.

**Every year-end (not now):** right after the yearly archive moves `oc_participant_app` to
`<db>_<year>.oc_participant_app_<year>`, set `@archive_year` in
`db_xml/year_rollover_participant_app_ids.sql` to that year and run it — ideally on the new empty table
before it takes registrations. It continues the participant ids above the archive (never lowers the counter),
so this year's and last year's participants can never share an id (coordinates and stop detection are keyed
on participant + race). If the archive table doesn't exist it stops and changes nothing. MySQL 8.

## 2. Server files (larssie, branch `growth_api_v0.1`) — upload in this order

Every endpoint also works before its migration (it just skips the new behaviour), but run step 1 first anyway.

**2a. New helper + OpenCart controllers (before the new web build):**
- `api/MergeTicket.php` (new)
- `catalog/controller/account/whoami.php`
- `catalog/controller/account/logout.php`

**2b. Web build (step 3 below)** — deploy it now, before the new merge endpoint.
⚠ **2b and 2c go live together (minutes apart):** the new `register_web_push.php` refuses to attach a browser
to an account's row unless the request carries the account's `merge_ticket`, which only the NEW web build sends.
The old server simply ignores the extra field, so web first, then 2c, is safe; the other way round, logged-in web
users can't turn on push until the web build is up.
The same order matters for follows: the new `update_follower_favourites_api.php` asks a web guest row that holds a
secret for that secret, which only the NEW web build sends. (Rows only get a secret from the new web + new server,
so web first, then 2c, never hits this.) A browser tab left open on the OLD web build after the deploy should be reloaded.

**2c. API endpoints + libraries:**
- `api/ApiSecurity.php`  (per-device rate limits — upload it FIRST in 2c, the endpoints below use its new options)
- `api/FollowerGuard.php` (new — upload together with ApiSecurity, before the endpoints below; they include it)
- `api/Cors.php`  ⚠ `http://localhost:3000` is now only allowed when the backend itself is localhost
- `api/merge_follower_api.php`
- `api/register_web_push.php`
- `api/register_guest_follower.php`
- `api/register_follower_api.php`
- `api/update_follower_favourites_api.php`
- `api/update_follower_email_api.php`, `api/update_follower_language_api.php`
- `api/update_customer_setting_api.php` (the follower language is now set only on the account's own device)
- `api/get_follow_data_by_device.php`, `api/get_follower_data_api.php`, `api/get_favourite_all_api.php`
  (downloads now carry `follow_seq`; `update_follower_favourites_api.php` answers 409 `follow_conflict` when a
  list is based on an older state — new app/web only; the 1.0.9 app doesn't send `base_seq` and works as before)
- `api/get_my_favourites_all_api.php`, `api/participant_profile_api.php` (follower lists/counts no longer drop rows whose push died)
- `api/verify_registration_api.php` (event name encoded in the app deep link)
- `api/update_device_readiness_api.php` (new)
- `api/home_api.php`
- `api/send_checkpoint_notifications.php`, `api/send_custom_checkpoint_notifications.php`, `api/send_race_start_notifications.php`
  (existing push crons — a dead Expo token now clears only the token, the row keeps its web push)
- `api/send_checkpoint_notifications_test.php`, `api/send_custom_checkpoint_notifications_test.php`, `api/send_race_start_notifications_test.php`
  (their test copies — same rule)
- `api/ParticipantYearHelper.php`
- `api/RaceReminder48hLib.php` (new)
- `api/send_race_reminder_48h.php` (new — push cron)
- `api/language/en/notification.php`, `api/language/fr/notification.php`, `api/language/nl/notification.php`
- `service/snippets/send_race_reminder_48h_mail.php` (new — email cron)
- `service/snippets/language/en/race_reminder_48h_mail.php`, `.../fr/...`, `.../nl/...` (new)
- `.gitignore` (only matters if live deploys via git; the mail cron also writes `system/storage/logs/race_reminder_48h_mail_skips.json`)

**2d. Organiser panel:**
- `eventpanel/model/catalog/event_app.php` — saving an event now also moves the start date / time / end time (and the
  event timezone) of its upcoming registrations when the organiser changed them (section 6 of the SQL did it once for
  the changes made before this release).

Make sure `<LIVE>system/storage/logs/` exists and is writable by the cron user (both 48 h cron logs go there).
The 48 h push cron reads `oc_follower_app.notifications_enabled` — run the SQL file (step 1) before enabling it.

## 3. Web (livio_web, branch `growth_web_v0.1`)

```bash
cd livio_web
git checkout growth_web_v0.1
npm ci
npm run test:follow    # 96 behavioural tests of the follow/login logic — must all pass
npm run build          # your usual static export
```
Upload the export the way you normally do (it lives at `my.liviolive.com/livio_website`).
Changed: `src/hooks/useAuth.tsx`, `src/hooks/useFollowManager.ts`, `src/services/allFavouritesService.ts`,
`src/services/authService.ts`, `src/services/tokenService.ts`, `src/utils/followAuthSync.ts`, `src/utils/followStorage.ts`,
`src/services/followService.ts`, `src/utils/webPush.ts`, `package.json` (test script); new `tests/follow.test.js`;
deleted (unused) `src/utils/guestId.ts`.

## 4. Crons (both every 15 minutes)

**First a dry run on live** (sends nothing, writes nothing):
```bash
php <LIVE>api/send_race_reminder_48h.php test
php <LIVE>service/snippets/send_race_reminder_48h_mail.php test --all
```
Read the logs (push: `<LIVE>system/storage/logs/race_reminder_48h_cron.txt`, rotated monthly to `.<YYYY-MM>`;
mail: `<LIVE>system/storage/logs/race_reminder_48h_mail.txt`).
If the people/texts look right, add to crontab:
```
0,15,30,45 * * * * /usr/bin/php <LIVE>api/send_race_reminder_48h.php
5,20,35,50 * * * * /usr/bin/php <LIVE>service/snippets/send_race_reminder_48h_mail.php
```
(Both only act 36–50 h before a partner race start, 08:00–21:59 event time; each person gets one push / one mail per race.)

## 5. App (PFSLive, branch `growth_v0.1`)

This branch is cut from `design_newv0.2`, so it ships with the **1.1.0 store build** (no OTA to 1.0.9).
1. Merge `growth_v0.1` into the branch you release 1.1.0 from (your normal flow).
2. `npx tsc --noEmit` and `npm run test:growth` / `test:tracking` / `test:activation` — all must pass.
3. `eas build --profile production --platform all`, then submit to both stores.
4. Release the app **after** steps 1–4 above are live (the app expects the new home_api fields,
   readiness endpoint and follow-upload ordering; it degrades safely if they are missing, but you lose the features).

---

## 6. How to test after deploying

### Automated tests — run locally BEFORE deploying (all must pass)
| Repo | Command | Expected |
|---|---|---|
| App | `npx tsc --noEmit` · `npm run test:growth` · `npm run test:tracking` · `npm run test:activation` · `npm run design-check` | clean · 330 · 186 · 19 passed · exit 0 |
| Server | `php tests/growth/growth_api_test.php` (local DB only — self-cleaning test rows; the local DB needs the step 1 SQL) | 425 passed, 0 failed, leftover rows 0 |
| Server (main's suites, must still pass on growth) | `php tests/rr_unranked/rr_unranked_test.php` · `checkpoint_catchup_test.php` · `audit_2026_10_18_test.php` · `php tests/tracking_api/dbconnect_test.php` · `event19_review_http_test.php` | 68 · 12 · 12 · 4 · 13 passed |
| Web | `npm run test:follow` · `npx vitest run` · `node_modules/.bin/tsc --noEmit -p .` · `npx eslint .` | 96 passed · 77 passed · clean · clean |

### Server (quick checks with curl / phpMyAdmin)
| Check | Expected |
|---|---|
| `POST api/merge_follower_api.php` with only `guest_device_id` + `device_id` | HTTP 401 `unauthorized` |
| `GET index.php?route=account/whoami` while logged in to an **app** account in the browser | JSON contains `merge_ticket` |
| `POST api/update_follower_favourites_api.php` for a test follower with 1001 ids | `list_too_large` |
| Same endpoint with `client_seq` 100 then `client_seq` 90 | second answer `data.stale = true`, list unchanged |
| `php send_race_reminder_48h_mail.php test --all` | log lists people, "mailed" lines, nothing recorded in `oc_race_reminder_mail_app` |
| `php api/send_race_reminder_48h.php --test` (also `test`) | dry run: log at `system/storage/logs/race_reminder_48h_cron.txt`, tokens shown only as last 6 chars, nothing sent |
| `GET api/home_api.php` for a runner with an upcoming race | JSON has `next_race_start_ts` (unix seconds of the start) and `server_now_ts` |
| Test follower row: set `status = 0` in phpMyAdmin, then follow from that phone/browser | follow still saved (status no longer blocks follows); `get_follow_data_by_device` still returns its list |
| 61 quick requests to `get_follow_data_by_device.php` with ONE `device_id` | that phone gets 429; a request with ANOTHER `device_id` from the same IP still gets 200 |
| Follower row at `status = 0` (dead push token) with follows | the app/web "Following" list and home "followed live" still show them |
| 48 h: a runner who was already MAILED the reminder for a race | gets no 48 h push for it as well |
| FR race-start push title | ends "… %s !" with a real space (no visible "\u00a0") |
| After a push run that hit a dead Expo token (log line "DeviceNotRegistered") | that row: `expo_token = ''`; `status` stays 1 if the row has a `wp_endpoint` (web push keeps working), 0 otherwise |
| Merge where the login row doesn't exist yet (relabel) with a guest that had web push | relabelled row has `wp_endpoint` NULL until the browser re-registers it |
| `oc_follower_app` row of an app account's device created from the web | `guest_secret_hash = 'acct'` → merging it as a "guest" answers `guest_proof_invalid` |
| 48 h mail: a runner whose 48 h push was delivered (row in `oc_notification_sent_app`, key `race_reminder_48h`) | gets no 48 h mail as well |
| 48 h: a connected runner whose phone reports `notifications_enabled = 0` | no push; gets the mail instead |
| `POST api/register_web_push.php` with an app account's `device_id` + a `subscription`, no `merge_ticket` | HTTP 401 `unauthorized`; the row's `wp_endpoint` unchanged |
| Same with the `merge_ticket` from whoami (logged in as that account) | `success: true`, `wp_endpoint` saved |
| `update_follower_language_api.php` (get) for a row with `language_id` NULL | `found: false` |
| `php api/send_race_reminder_48h.php test` on 1 January (or any year whose previous-year archive is missing) | runs to the end (no crash) |
| Open `api/send_race_reminder_48h.php` in a browser | 404, nothing runs |
| `update_follower_favourites_api.php` with `base_seq` lower than the row's `follow_seq` | HTTP 409 `follow_conflict` with the row's lists; lists unchanged |
| Two runs of the 48 h push for a runner with two distances of one race on consecutive days | one push in total |
| `send_race_reminder_48h.php test` while the live cron runs | the live run is NOT skipped (test run has its own lock) |
| `register_follower_api.php` with a browser guest's id (a lower-case UUID from the web's Local Storage `guest_id`) + any Expo token | HTTP 401 `unauthorized`; that row keeps `platform = 'web'`, `expo_token` empty |
| `update_follower_favourites_api.php` for that guest row (its `follower_id` + `device_id`) without `guest_secret` | HTTP 401 `unauthorized`; its follows unchanged (the website itself sends the secret) |
| Event panel: move the start time of a distance of an upcoming event and save | phpMyAdmin: that distance's upcoming `oc_participant_app` rows show the new `race_time`; past races unchanged |
| Event panel: change an upcoming event's timezone and save | its upcoming `oc_participant_app` rows show the new `timezone`; the app's countdown moves accordingly |
| `update_customer_setting_api.php` (logged-in app token) with `language_id` + ANOTHER device's `device_id` | `success: true`, but only the account's own follower row gets the language; the other row is unchanged |
| 200 quick requests to `register_guest_follower.php` from one IP, each with a new `device_id` | the ones over 180 per minute get 429 with a short `Retry-After`; the IP is not blocked for a whole minute (new devices get through again as soon as the minute rolls) |
| Registration confirmed for an event whose name has `&` or `#` | the `livio://` link in the answer has the name encoded (`%26`, `%23`) |

### Web (browser, logged out first)
1. Open the site logged out, follow 2 athletes (guest). In DevTools → Application → Local Storage: `guest_id` and `guest_secret` exist.
2. Log in (OpenCart) with an app account that already follows 1 other athlete.
3. Back on the site: following list shows **all 3**. `guest_id`, `guest_secret`, `follow_union_owed` are gone.
4. In phpMyAdmin the guest's `oc_follower_app` row is gone (merged) and the login row has the 3 follows.
5. Enable web push as guest before logging in → after login the subscription is on the login row only (`wp_endpoint` of the old guest row is NULL).
6. Log out → follows are cleared locally; log in again → they come back from the server.
7. Guest follows 1 athlete, then logs in with an app account that has **never followed anything** → the athlete is on the account afterwards (a follower row is created for it).
8. Guest follows, then the login happens while offline (DevTools → Network → Offline, then back Online and refocus the tab) → the follows arrive on the next refresh; `follow_union_owed` disappears once they did.
9. Logged in, with follows: block the whoami URL (DevTools → Network → right-click → Block request URL), refocus the tab → you stay logged in and the follows stay (a failed check is not a logout). Unblock.
10. Account switch: logged in as A in the site tab; in another tab log out of OpenCart and log in as B; come back to the site tab → only B's follows show, none of A's.
11. Two tabs: tab 1 logs out; in tab 2 follow an athlete as guest; log in as B in tab 2 → the athlete is added to B (not lost, no errors in the console).
12. Logged in with web push on → in-app logout → DevTools → Application → Service workers / push: no subscription left; the account row's `wp_endpoint` is cleared on the next registration. (An OpenCart session that merely EXPIRES does not unsubscribe — push keeps working after the next login.)
13. Network throttled to "Slow 3G": reload while logged in and follow an athlete within 1–2 s → after it settles the athlete is still followed (on the server too).
14. DevTools → Network: every `update_follower_favourites_api.php` request body contains `client_seq` (a rising number).
15. Logged in, leave the tab open and untouched for 20 min, then follow someone and allow push → push is saved (Network: one `register_web_push` 401, a `whoami`, then a second `register_web_push` 200).
16. Follow an athlete and close/reload the tab within a second (DevTools → Network → Slow 3G) → after reload the follow is on the server too (`follow_pending_sync` in Local Storage disappears once it is).
17. Logged in with push on → let the OpenCart session expire (or delete the OpenCart session cookie) and reload → push still arrives (the subscription moved to the guest id); log in again → it moves back to the account row.
18. Logged in, every `register_web_push` request body contains `merge_ticket`; as a guest it contains `guest_secret` instead.
19. **Phone + web on one account:** follow athlete A on the website, then (without reopening the app) follow B on the phone → after both sync the account has A and B (web and phone). Same the other way round, and with an unfollow on one side.
20. Log in on the website and follow someone within 1 second (Slow 3G) → the account's earlier follows are all still there.
21. Two tabs logged in: follow in tab 1, quickly switch to tab 2 and refocus → the follow stays in both tabs.
22. Logged out (guest): DevTools → Network → every `update_follower_favourites_api.php` request body contains `guest_secret` (the same value as Local Storage `guest_secret`); logged in it does not.
23. Guest: in DevTools → Local Storage delete only `guest_secret`, then follow an athlete → after a moment `guest_id` is a NEW value, the follow is saved (Network: one 401, then a `register_web_push` and a 200 upload); the athlete still shows as followed.

### App (device, on the 1.1.0 build)
**Notifications / permissions**
1. Fresh install → **no** notification prompt at first launch.
2. Follow an athlete as a fan → explanation sheet first, then the OS prompt. Deny it → following still works (athlete stays followed after app restart).
3. Settings → Notifications screen shows the state and opens the phone's settings page in one tap.
4. Open a live map as a fan → **no** location prompt.

**Runner flow**
5. Connect to an upcoming race → "Get race-ready" opens (location "Always", notifications, battery on Android) with one tap per step.
6. Home: readiness card for the upcoming race; countdown to your start before you press Start; "Share my tracking link" opens the share sheet with the live result page link (contains `bib=` and `from_live=1`).
7. Press Start with location denied → popup titled "Let your family and friends follow you live"; grant from the popup → tracking starts once (not twice), popup closes.
   - iOS with "While using" only: tap the popup button → iOS asks "Change to Always Allow?" → the popup does NOT flash in between; answer "Keep Only While Using" → the Start popup comes back.
   - iOS where iOS no longer shows that question (declined before): one tap on the popup button goes straight to Settings (not a second tap).
8. Mid-race switch Location off → popup "Location is switched off"; switch back on → tracking resumes.
9. No upcoming race → the new idle home (not the empty logo screen).
10. Open `livio://event?product_app_id=<id>&pov=<pov id>` from Notes/Messages → event opens with that distance selected, **not** registered.

**Follow sync (two devices / web)**
11. Follow on the phone with airplane mode on → turn it off → follow arrives on the server (check web).
12. Follow quickly 5 athletes on a slow network → server ends with all 5.

**48 h reminder (staging or a test race)**
13. Create a partner test race ~44 h ahead (daytime in its timezone); connect with a test phone that has notifications OFF → after the next cron run an email arrives; with notifications ON → a push arrives instead; a web entrant who never connected → email inviting them to connect.

**Final-audit fixes**
14. iOS: Settings → Privacy → Location Services OFF (whole phone) → press Start → popup says Location is **switched off** (not "permission"); turn it on and come back → tracking starts by itself.
15. Precise location OFF (Android: app location permission → "Use precise location" off; iOS: Livio → Location → Precise Location off) → readiness card lists "Precise location" (not "all set"); Get race-ready shows that step and its button opens the settings page.
16. Countdown across the clock change: a test race on/after 25 Oct (EU DST end), viewed before → countdown equals the real time left (not 1 h off).
17. While tracking runs, make the race drop from home (e.g. past its end time) → no "No race coming up" card over the running session.
18. Reinstall: phone with follows + notifications was uninstalled, reinstall WITHOUT allowing notifications → Following shows the old follows (no new follow needed first).
19. Android: restore the app on a NEW phone from a backup (or copy `FOLLOWER_ID` to a fresh install) → after launch the local follows are saved to a new follower row; fan email and language save work.
20. Notifications blocked at system level (Android: app notifications off in system settings while the permission is granted) → Settings → Notifications "Turn on" opens the phone's settings page (it used to do nothing); same in Get race-ready.
21. Guest (not logged in) with the app in French or Dutch → open Live tracking settings → the app stays in French/Dutch (it used to switch to English).
22. Android phone without a battery-optimisation page (some OEMs) → Get race-ready battery step: tapping it never gets stuck (the step is skipped).
23. Popup copy: Location switched off at Start says tracking starts when you come back (no "press Start again"); mid-race "no GPS" banner says tracking keeps running.

**Third-audit fixes**
24. Precise location OFF → press Start → popup "precise location" with a settings button and **"Start anyway"**; "Start anyway" starts tracking; turning precise on from Settings and coming back starts it too.
25. Airplane mode on → follow / unfollow an athlete → the button switches instantly (no spinner waiting for the network); turn airplane mode off → the change reaches the server.
26. Follow sheet: deny notifications in the OS (iOS "Don't Allow") → follow again later → tapping "Turn on" opens the phone's settings (no dead tap).
27. Get race-ready → location step when iOS no longer shows the question → the button opens Settings.
28. Notifications screen on Android 13+ after one "Don't allow" → the text matches the button, and a double tap opens only one dialog.
29. Press Start while location is missing, leave the app for more than 15 min, come back with location on → tracking does NOT start by itself (press Start again); within 15 min it does.
30. Countdown: lock the phone for a few minutes, unlock → the countdown shows the right time immediately.
31. Open `livio://event` without `event_name` → opens with a normal title (no blank header).
32. French and Dutch text of the new precise-location popup → have a native speaker check it.
33. Fan follows an athlete with no signal (airplane mode), keeps the app open, turns airplane mode off → within seconds the follow is on the server (no new follow or restart needed).
34. Double-tap Follow quickly → one toast, followed once.
35. Press Start, then Start again quickly / double-tap "Start anyway" → tracking starts once.
36. Pull down Control Center (iOS) while a Start popup is waiting → nothing happens; going to Settings and back does.

---

## 7. Status of everything discussed (client "livio improvements" message + plan)

Legend: ✅ done in these branches · 🟡 done, needs your confirmation/action on live · ⛔ not done (reason)

### 1. The invitation email
| Item | Status |
|---|---|
| Rewrite campaign email (optional wording, buttons to stores, account contradiction, payoff first, race date) | ⛔ owned by you — campaign template + sending platform are outside the app/API. Copy can be drafted on request (C1). |
| A/B on the next event | ⛔ same — your sending platform (C2). |

### 2. The 114 who connected and never started
| Item | Status |
|---|---|
| Log Start attempts + permission outcome (measurement first) | ✅ A1 — Start funnel events (tap / permission result / started) in analytics |
| Readiness card on home (location, battery, notifications, one-tap fix) | ✅ A7 + "Get race-ready" flow A12 |
| Live countdown before pressing Start | ✅ A6 |
| Reframe the permission screen ("let your family and friends follow you live") | ✅ A8 (separate mid-race wording) |
| 48 h reminder — push to connected runners | ✅ S3 `send_race_reminder_48h.php` (needs crontab, step 4) |
| 48 h reminder — email to entrants not connected | ✅ S3 mail cron, only people allowed to track (needs crontab) |
| Email for app users with notifications off | ✅ same mail cron, "no push" group (ready / not ready variants via S6) |
| Race-morning reminder | ✅ already existed (1 h before gun) — unchanged |

### 3. Notifications (45 % off)
| Item | Status |
|---|---|
| Stop asking at first launch; ask when following / registering, explain first | ✅ A3 (fans at first follow, runners in race-ready flow) |
| Notifications screen with state + one-tap settings link | ✅ A4 |
| Stop asking fans for location on the live map | ✅ A5 |
| Defect: denying notifications breaks following | ✅ A2 — follows work without push (token-less follower) |
| Store each device's notification/location state (KPI) | ✅ S6 readiness endpoint + migration 1 |

### 4. Worth opening / bring an audience
| Item | Status |
|---|---|
| "Share my tracking link" (+ server returns own bib) | ✅ A9 + S2 (home_api bib + distance) |
| Fill the empty home for users with no upcoming race | ✅ A10 idle home |

### 5. Groundwork
| Item | Status |
|---|---|
| Auto-create Livio account for web customers | ⛔ by your decision (2026-10-10): left as is |
| Email opens the event with the distance preselected (runner still taps connect) | ✅ A11 `livio://event?...&pov=` — the campaign email must use it |
| Proper web links (universal / app links) | ⛔ S5 needs a store release + Apple Team ID + Android SHA-256 + files on my.liviolive.com root — not started |
| Email the refused users (the 31) | 🟡 S4 — mail already exists (`tracking_access_upgrade_mail.php`); prices come from live `snippet_config.php` → confirm (step 0.3) and that it is scheduled on live |

### Corrections to send the client (from the plan) — 🟡 yours to send
"199 tracked" = connected (77 tracked); connected > clicked; open rate inflated by Apple Mail privacy; refusal mail exists;
"31 refused" is a floor; permission screen only the icon is red; email deep link needed a new preselect param.
The sequencing request is moot — the free session is already off on live (2026-09-18).

### Extra work done along the way (not in the client list)
- home_api stop detection fixed (year-table id collision) — keyed on participant + race + customer.
- Follow sync hardened (app): ordered uploads (`client_seq`), no lost follows on slow / timed-out / out-of-order uploads, merge safety, push token re-registration after a lost follower row.
- Security: `merge_follower_api.php` now requires the logged-in account (app token or web merge ticket) and proof of the guest side; `localhost:3000` CORS only on a local backend; follow list cap 1000.
- Web: guest follows are kept at login (held, then added to the account).

### Earlier open points — now closed
- iOS Start popup flash during the two-step permission question — **fixed** (the popup's own request owns the outcome; "did the OS show a dialog" is now read from the app leaving the foreground, not a 700 ms guess).
- Coordinates of two runners mixing across year tables — **cannot happen today** (the 2025 archive is empty; no shared id + race). Prevented for the future by the year-end SQL file (step 1).
- `wp_endpoint` index — **already exists** (`idx_wp_endpoint`, 191-char prefix) on the live copy.

### Known, not done
- S1 (verify the live result page shows the live position for `from_live=1`) — not checked by me on live; please open one share link on live.
- Test suites are local only: app 330/330 (+ tracking 186, activation 19), server 425/425 (self-cleaning) + main's server suites, web 96/96 (`npm run test:follow`) + 77 vitest + type-check + lint.
- Verified by reading only (need a live SendGrid / Expo call): the 48 h mail record upsert and its Throwable catch. (The push per-message retry and the single-message 400 are tested with a stand-in for Expo.)

### Audit status (fourth exhaustive audit 2026-10-16 — everything fixable is fixed)
Four full audits; every medium and low item that code can fix is fixed, each with a test that fails on the old code, plus one review pass per batch (its findings fixed and tested too).
Main fixes of the fourth audit: phone and web on one account can no longer erase each other's follows (server `follow_conflict` + merge), a follow made right after a web login can't replace the account's list, offline follows on the phone are sent as soon as the network returns, Start can't run twice, the 48 h push goes once per phone per race (multi-day), rate limits can't be bypassed with a forged IP header and no longer lose hits.
Not code — your action / decision:
- Step 0.5: how live receives requests (Cloudflare / proxy) — one check.
- `LIVIO_MERGE_SECRET` in the live `config.php` (step 0.4) — recommended.
- Check on live: `SELECT COUNT(*) FROM oc_tracking_logs_app WHERE customer_app_id IS NULL OR customer_app_id = 0;` (stop detection ignores those rows).
- Confirm the live root path (`<LIVE>`), and open one share link on live (S1).
- Real-device checks (App steps 1–36, Web 1–23).
- FR/NL copy of the new precise-location popup — native-speaker check.
- Locally `config.php` prints "Undefined array key HTTP_HOST" warnings when a cron runs from the command line; check the live crons' mail/output for the same (harmless, but noisy).
Merge of main into the growth branches — checked 2026-10-21:
- Every main change is in its growth branch; the merges kept both sides (no lost lines), and every suite of both sides passes.
- The step 1 SQL was run on a fresh copy of live (imported 2026-10-19, strict sql_mode): 29 statements, no error, 6 columns added,
  sections 5 and 6 found nothing to change; a second run changed nothing.
- Fixed where main's new start code met growth rules (app): start reminders skip a placeholder start time (00:00 / 00:01 — they
  rang at 23:50 the night before); the Start funnel now logs the two new gates (battery-optimisation popup cancelled,
  Battery Saver on a resumed start) like every other gate. Checked, no change needed: the new local notifications
  (start reminders, start not started, Battery Saver) never open the race popup or navigate; the new battery popup
  holds back Get race-ready like the other popups; a dual-transport follower (phone + web on one row) gets one push
  per transport for the furthest checkpoint only.
- `tests/tracking_api/audit_2026_10_18_http_test.php` (main) needs event 19 to have a RaceResult URL with
  race_result_status = 1 in the local DB; the fresh live copy has it switched off after the race, so it was not run.

Product-decision items — round 25 (2026-10-18):
- FIXED: someone who knew a web guest's private id could switch its row to "app" (blocking that guest's merge and web push), put their own Expo token on it, or set its email/language. App-only endpoints now refuse any browser-guest id (`api/FollowerGuard.php`); phones and the website are unaffected (no phone ever has a browser-shaped id — checked on the live copy: 2,139 browser ids, all web rows).
- FIXED (website half): a web guest's follow list can no longer be replaced with its id alone — its row needs the browser's secret, which the website now sends. If a browser ever lost the secret but kept the id, it starts a fresh guest once and keeps its follows.
- FIXED: one busy shared IP (race-venue Wi-Fi, carrier NAT) is no longer locked out for 60 s by the per-IP ceiling; only requests above the ceiling are refused, and new phones get through again as the minute rolls. One phone over its own limit is still locked out (unchanged).
- FIXED: a start moved by the organiser now reaches the registrations already made (event panel save + one-off SQL section 6), so home's countdown, the 1 h race-start push and the 48 h reminder use the new time.
- STILL OPEN (phone half): anyone who knows a PHONE's device id can replace its Expo push token or follow list. Device ids are never shown or returned to others (checked), so this needs the id to leak first. A real fix needs a per-device secret in a future app release AND a product decision: on Android a reinstall keeps the device id but wipes the secret, so a guest phone would lose access to its own follows after reinstalling (logged-in phones could recover with their login).
Accepted limits (by design, not bugs):
- The 48 h mail's group A uses the race's start time: `oc_participant` doesn't store the distance, so a distance with a later start can't be looked up.
- Web: keepalive on tab close may be refused by some browsers for a cross-origin API; the pending change is then sent on the next visit (persisted).
- Web: a guest list over the 1000 limit reverts only once that browser has had one accepted upload after this release.
- A row whose `follow_seq` was never set (only old clients ever wrote it) can't raise a conflict until a new client uploads once; the web login union covers that first step.
