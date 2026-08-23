# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Livio** (package name `livio`, historically "PFSLive" — that name still appears in storage keys and `APP_CONFIG`) is an Expo/React Native app for live race tracking. Two audiences share one app:

- **Participants** stream GPS while racing (foreground + background), and can create custom/personal events from GPX files.
- **Followers/fans** watch participants move on a live Mapbox map, follow athletes, and browse results.

Bundle id `eu.passionforsports.livio` (both platforms). The backend is a PHP API — every endpoint is a `*_api.php` file listed in `src/constants/config.ts`.

## Commands

```bash
npm start                 # expo start --dev-client (a dev client build is REQUIRED — Expo Go will not work)
npm run android           # expo run:android
npm run ios               # expo run:ios
npm run prebuild          # generate-assets + expo prebuild --clean (regenerates ios/ and android/)
npm run generate-assets   # regenerate icon/splash/adaptive-icon/notification-icon from assets/livio_logo.png via sharp
npm run clean             # remove node_modules, android, ios, .expo, package-lock.json
npx tsc --noEmit          # type check
eas build --profile development|preview|production --platform android|ios
```

There are **no tests, no ESLint, and no Prettier config** in this repo. `npx tsc --noEmit` is the only automated check.

## Native builds

`ios/` and `android/` are **gitignored and generated** — never edit them directly, and expect them to be absent on a fresh clone. Native behavior is expressed through `app.config.js` plugins:

- `plugins/withGpxShareIntent.js` — patches `MainActivity.kt` / `MainApplication.kt` / `AndroidManifest.xml` to add a `GpxShare` native module that receives GPX `VIEW`/`SEND` intents.
- `plugins/withFirebaseDisableSPM.js` — prepends `$RNFirebaseDisableSPM` / `$RNFirebaseAsStaticFramework` to the iOS Podfile (Firebase requires `useFrameworks: "static"`, set via `expo-build-properties`).

Any change to `app.config.js` or these plugins needs a rebuild (`npm run prebuild` plus a native build), not a Metro reload. New Architecture is **on** (`newArchEnabled: true`, Hermes).

`.env` is gitignored and required. Keys: `EXPO_PUBLIC_MAPBOX_TOKEN`, `RNMAPBOX_MAPS_DOWNLOAD_TOKEN`, `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_IMAGE_URL`, `EXPO_PUBLIC_API_TOKEN`, `EXPO_PUBLIC_ENV`, `TRANSISTOR_LICENSE_KEY`, `TSLOCATIONMANAGER_LICENSE`. `EXPO_PUBLIC_ENV` gates cleartext traffic, ATS, the APNs environment, and `API_CONFIG.DEBUG` — anything other than `"production"` is treated as dev.

## Architecture

### Layering

`screens/` → `hooks/` → `services/` → `services/api.ts` → PHP API. Screens do not call axios directly.

- **`src/services/api.ts`** — the single axios client. Its `handleError` normalizes every failure into an `AppError` with `type: 'network' | 'server' | 'empty'` plus the backend `code`. A curated `EMPTY_CODES` set (plus 404/204/4xx) maps "no data" responses to `'empty'` rather than a real error. Use `postRaw()` when you need field-level validation errors out of a 4xx body instead of the normalized throw.
- **`src/hooks/useApiError.ts` (`useScreenError`)** + **`src/components/ErrorScreen.tsx`** — the standard screen-level error pattern: catch → `handleApiError(err)` → render `<ErrorScreen type={...} onRetry={...} />`. Only codes listed in `CODE_MESSAGES` get bespoke copy; everything else falls back to generic network/server/empty text in the `errorScreen` i18n namespace.
- **`src/constants/config.ts`** — `API_CONFIG` holds the base URL, *all* endpoint paths, timeouts, poll intervals, and async `getHeaders()`/`getMutiForm()` that attach the bearer token. Add new endpoints here, not inline in services.
- **`src/services/*Service.ts`** — one module per feature area, exported as a plain object literal (not a class), each owning its own request/response interfaces. Most send `language_id` from `getCurrentLanguageId()`.

### Auth

Token and `customer_app_id` live in AsyncStorage via `src/services/tokenService.ts` (keys prefixed `@PFSLive:`). `AppNavigator` reads the token once at startup and provides `AuthContext` (`isLoggedIn`, `login`, `logout`) — flipping `isLoggedIn` swaps which screen group is mounted in the stack, so login/logout is a navigator remount rather than a redirect. Login/logout must also call `analyticsService.setUserIdentity` / `clearUserIdentity` (the navigator's `login`/`logout` callbacks do this). Most of the app works logged out; only profile/edit screens are gated.

### Navigation

Single native stack in `src/navigation/AppNavigator.tsx`, typed by `RootStackParamList` in `src/types/navigation.ts`. `src/navigation/navigationRef.ts` exposes a ref for navigating from outside React — used by the GPX share-intent handlers in `App.tsx`, which poll `navigationRef.isReady()` for up to 5s. Screen views are logged to Firebase Analytics from `onStateChange`.

### GPS tracking (the most intricate subsystem)

`src/services/gpsService.ts` (~2200 lines) is the core. Read its header comments before touching it — they document decisions that are not obvious from the code:

- **"Option B"**: *all* location work — background sends *and* the foreground UI feed — goes through Transistor (`react-native-background-geolocation`). The `expo-location` TaskManager background task and the foreground `watchPositionAsync` were deliberately removed; two concurrent `CLLocationManager` streams destabilized Hermes under the New Architecture. `BACKGROUND_LOCATION_TASK` is still exported only so orphaned tasks from older installs can be stopped defensively.
- **Cross-context state is AsyncStorage, not React state.** Headless/background handlers cannot see React state, so session state (`@PFSLive:trackingParams`, `bgSentCount`, `raceFinished`, `nearFinish`, `finishApproach`, `logUploaded`, `transistorActive`, …) is persisted and re-read. `locationQueueService` and `locationService` re-declare some of these key strings **locally on purpose** to avoid circular imports with `gpsService` — if you rename a key, grep for the literal string across `src/services/`.
- **The send interval is adaptive**: the session's configured interval normally, dropping to 5s within 1km of the finish (`FINISH_APPROACH`), with auto-stop once the API reports `finished`. See `finish_source: 'rr' | 'distance'` in `locationService.ts` for which GPS guards apply to each case.
- **Offline**: `locationQueueService` buffers up to 500 fixes in AsyncStorage when NetInfo reports no reachability, throttled to the same effective interval; `locationService.processQueue` drains it. Network calls use an explicit `withTimeout` wrapper because axios's own timeout does not reliably fire on a half-open socket.
- `HomeScreen.tsx` (~2000 lines) drives the participant tracking UI, attaching to the engine via `attachUi`/`detachUi` and running queue-drain and race-start interval timers. `LiveTrackingScreen.tsx` is the follower view and polls `liveTrackingService.getLiveTrackingData`.

`App.tsx` installs a **global `ErrorUtils` handler that swallows uncaught JS errors in production** — under the New Architecture an uncaught error becomes a fatal SIGABRT. Stray errors are therefore logged, not crashed; don't assume a silent failure surfaced anywhere.

### i18n

`src/i18n/index.ts` initializes i18next with three languages (`en`/`fr`/`nl`) and ~27 **namespaces** — one folder per screen under `src/i18n/`, each holding `en.json`/`fr.json`/`nl.json`. Adding a namespace means: create the folder and three files, import all three, add them to each language block in `resources`, and add the name to the `ns` array. `defaultNS` is `common`. Each language also has a numeric `id` sent to the API as `language_id` (`getCurrentLanguageId()`). Language choice persists through `useLanguageStore` (zustand) plus AsyncStorage.

### Styling

No styling library. `src/styles/*.styles.ts` holds per-screen `StyleSheet` objects; `common.styles.ts` exports the shared `colors` palette (brand accent `#D5DA28`). Fonts are Poppins via `@expo-google-fonts/poppins`.

## Conventions

- TypeScript `strict: true`.
- Services export object literals; hooks own screen state and side effects; components stay presentational.
- Comments here are heavy and decision-oriented (`// ✅ ...`), and frequently explain *why* a workaround exists. Preserve them when editing — they are the only design docs in the repo.
- Debug logging goes through `console.log` guarded by `API_CONFIG.DEBUG` or `__DEV__`. Metro's release minifier sets `drop_console: true`, so logs vanish in production builds.




## What this is
- React Native / Expo app for Livio live race tracking. Ships to App Store
  and Play Store. Followers and participants both use it.
- Sibling projects, NOT in this repo: livio_web (Next.js follower webapp)
  and larssie (OpenCart registration + standalone PHP APIs).

## API layer
- Standalone PHP endpoints, not OpenCart controllers.
- ApiSecurity.php (IP rate limiting, file cache, standard JSON envelope) +
  AuthToken.php (Bearer tokens, sha256-hashed, in oc_customer_app_token).
- Auth is against oc_customer_app with per-account device_id locking.

## Push
- Expo tokens live in oc_follower_app (device_id + expo_token).
- A logged-in web session reuses the SAME device_id as the phone, so one
  oc_follower_app row can be dual-transport (expo_token + wp_* columns).
  Send logic is presence-based, never platform-branch.

## iOS build gotchas
- react-native-firebase SPM vs static linkage — check useFrameworks and the
  Podfile plugins before changing anything Firebase-related.
- iOS does not resume background tracking after a force-quit; the app
  rehydrates state on relaunch instead.

## Data quirks (shared with the backend)
- oc_product_app.race_date is DAY 1 only for multi-day events. The real span
  is per-distance on oc_product_option_value_app (race_date/race_time/end_time).
- race_time and end_time are TIME columns — never NULLIF(x, '').

## Working style
- Find/replace against exact code, not whole files.
- Read the actual file before proposing changes.
- Minimal targeted fixes, match existing conventions.
- Flag anything unverified rather than stating it as certain.
