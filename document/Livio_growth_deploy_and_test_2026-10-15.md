# Livio growth release — deploy guide (updated 2026-10-27)

Do the whole list on the **demo server first**, test, then repeat it on **live**.
Never skip a step and keep the order: database → server files → web → crons → app.

| Part | Repo / branch | What you deploy |
|---|---|---|
| Server | larssie `growth_api_v0.1` | 1 SQL file + PHP files + 2 crons |
| Web | livio_web `growth_web_v0.1` | a new static build at `/livio_website` |
| App | PFSLive `growth_v0.1` | store build **1.1.1** (not an OTA update) |

The growth branches already contain the design branches and master / main.
This guide assumes main (larssie) is already live. If it is not, deploy main first the normal way.

`<ROOT>` = the server's larssie folder (live: believed `/var/www/html/larssie/` — confirm).
You do NOT need to change `config.php` or `snippet_config.php` (step 1.4 is optional).

---

## Step 1 — Before you start

1. Back up the database tables `oc_follower_app`, `oc_follower_customer_app`, `oc_follower_bib_app`
   (or make a full dump).
2. Back up every server file listed in step 3 (copy each to `<name>.bak-<date>`).
3. Check `service/snippets/snippet_config.php` has the prices 5.95 / 19.95 / 24.95
   (`LITE_MEMBERSHIP`, `BASIC_MEMBERSHIP`, `PRO_MEMBERSHIP`).
4. Optional (recommended): add one line to `config.php`:
   `define('LIVIO_MERGE_SECRET', '<64 random hex characters>');`
5. Make sure `<ROOT>system/storage/logs/` exists and the cron user can write to it.

## Step 2 — Database (one SQL file)

Run `db_xml/migration_growth_all.sql` once:
phpMyAdmin → select the database → SQL tab → import the file, or
`mysql <database> < db_xml/migration_growth_all.sql`.
It is safe to run twice. Do NOT also run the other `migration_*.sql` files; they are already inside it.
Already ran it on this server before 2026-10-27 (e.g. demo)? Run it AGAIN: it adds `event_source` to
`oc_race_reminder_mail_app` (needed since the 48 h reminder also covers custom events).

Check:
```sql
SHOW COLUMNS FROM oc_follower_app WHERE Field IN
 ('location_permission','notifications_enabled','tracking_ready','ready_checked_at','follow_seq','guest_secret_hash');  -- 6 rows
SHOW TABLES LIKE 'oc_race_reminder_mail_app';                                                                        -- 1 row
```

## Step 3 — Server files (larssie `growth_api_v0.1`), in this order

**3a. Upload first:**
- `api/MergeTicket.php` (new)
- `catalog/controller/account/whoami.php`
- `catalog/controller/account/logout.php`

**3b. Now deploy the web (step 4), then come back for 3c.**
Web first, then 3c, a few minutes apart: the new server refuses web push and guest follows
from the OLD web build.

**3c. API — upload these two first:**
- `api/ApiSecurity.php`
- `api/FollowerGuard.php` (new)

**Then the rest:**
- `api/Cors.php`
- `api/ParticipantYearHelper.php`
- `api/RaceReminder48hLib.php` (new)
- `api/home_api.php`
- `api/event_list_api.php`, `api/event_list_web_api.php`
- `api/merge_follower_api.php`
- `api/register_web_push.php`, `api/register_guest_follower.php`, `api/register_follower_api.php`
- `api/update_follower_favourites_api.php`, `api/update_follower_email_api.php`, `api/update_follower_language_api.php`
- `api/update_customer_setting_api.php`
- `api/update_device_readiness_api.php` (new)
- `api/get_follow_data_by_device.php`, `api/get_follower_data_api.php`
- `api/get_favourite_api.php`, `api/get_favourite_all_api.php`, `api/get_favourite_all_events_api.php`, `api/get_my_favourites_all_api.php`
- `api/participant_profile_api.php`
- `api/get_result_detail_api.php`, `api/get_result_detail_test_api.php`
- `api/get_live_tracking_data_api.php`, `api/get_live_tracking_data_test_api.php`
- `api/verify_registration_api.php`
- `api/send_checkpoint_notifications.php`, `api/send_checkpoint_notifications_test.php`
- `api/send_custom_checkpoint_notifications.php`, `api/send_custom_checkpoint_notifications_test.php`
- `api/send_race_start_notifications.php`, `api/send_race_start_notifications_test.php`
- `api/send_race_reminder_48h.php` (new, push cron)
- `api/language/en/notification.php`, `api/language/fr/notification.php`, `api/language/nl/notification.php`
- `service/snippets/send_race_reminder_48h_mail.php` (new, mail cron)
- `service/snippets/language/en/race_reminder_48h_mail.php`, `.../fr/...`, `.../nl/...` (new)

**3d. Organiser panel:**
- `eventpanel/model/catalog/event_app.php`

Do not upload: `tests/`, `document/`, `db_xml/` (already run in step 2), `service/snippets/Mail_normal.docx`.
`.gitignore` matters only if the server deploys with git.

## Step 4 — Web (livio_web `growth_web_v0.1`)

```bash
cd livio_web
git checkout growth_web_v0.1
npm ci
npm run test:follow                                  # must all pass
NEXT_PUBLIC_BASE_PATH=/livio_website npm run build
```
(Windows Git Bash: put `MSYS_NO_PATHCONV=1` in front of the build line.)
Upload the `out/` folder the way you always do (`my.liviolive.com/livio_website`).
Then go back to step 3c.

## Step 5 — Crons (48-hour reminders)

1. Dry run (sends nothing, writes nothing):
   ```bash
   php <ROOT>api/send_race_reminder_48h.php test
   php <ROOT>service/snippets/send_race_reminder_48h_mail.php test --all
   ```
2. Read the logs: `<ROOT>system/storage/logs/race_reminder_48h_cron.txt` (push) and
   `<ROOT>system/storage/logs/race_reminder_48h_mail.txt` (mail). The names and texts must look right.
3. Add to the crontab:
   ```
   0,15,30,45 * * * * /usr/bin/php <ROOT>api/send_race_reminder_48h.php
   5,20,35,50 * * * * /usr/bin/php <ROOT>service/snippets/send_race_reminder_48h_mail.php
   ```
They only act 36-50 h before a race (partner events and custom events, never training sessions),
between 08:00 and 21:59 event time, once per person per race.

## Step 6 — App (PFSLive `growth_v0.1`, version 1.1.1)

1. Check locally; all must pass:
   ```bash
   npx tsc --noEmit
   npm run design-check
   npm run test:growth
   npm run test:tracking
   npm run test:activation
   ```
2. Demo test build: `eas build --profile preview --platform android` (APK for testers) and an iOS build
   for TestFlight. The build's server comes from the Expo dashboard env vars, not your local `.env`:
   check `EXPO_PUBLIC_API_URL` points to the demo server.
3. Testers run `Growth-test-case.txt` (30 tests: app, web, 48 h reminders).
4. Live: only after steps 2-5 are live,
   `eas build --profile production --platform all`, then submit to both stores.

## Step 7 — Quick check after each deploy (10 minutes)

| Check | Expected |
|---|---|
| Open `api/send_race_reminder_48h.php` in a browser | 404 |
| `POST api/merge_follower_api.php` with only `guest_device_id` + `device_id` | 401 `unauthorized` |
| Logged in on the website: `index.php?route=account/whoami` | JSON contains `merge_ticket` |
| Website, logged out: follow 2 athletes, then log in with an account that follows 1 | all 3 in the list |
| App: fresh install | no notification / location / battery popup |
| App: follow an athlete | "Know when they pass each checkpoint?" popup |
| App: runner with an upcoming race | countdown, "Share my live link", "Ready to race?" card |
| App: "Share my live link" → open the link on another phone | the runner's result page on my.liviolive.com/livio_website |
| App: one tracking Start → Stop on a test race | works as before |

## If something goes wrong

- Server: put the `.bak` files back. The SQL only adds columns and a table; old code ignores them,
  so the database does not need to be rolled back (rollback lines are at the end of each SQL section).
- Web: upload the previous `out/` folder again.
- App: do not release the store build; 1.0.9 keeps working with the new server.

## Still to do / decide (not code)

- Confirm the live `<ROOT>` path.
- Optional `LIVIO_MERGE_SECRET` (step 1.4).
- The 8 client questions were decided in code while the client is on leave. Check them with him when he is back.

The previous long version of this guide (all audit notes and 102 device checks) is in git history,
commit `ae3c649` (PFSLive).
