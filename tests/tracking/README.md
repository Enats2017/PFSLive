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

To prove a test really catches its bug, run it against an older checkout:

```bash
git worktree add ../pfs-old <old-commit>
APP_SRC=../pfs-old/src npm run test:tracking     # expected: failures
git worktree remove ../pfs-old
```

These tests do not replace one real tracking session on a preview build — they
cannot exercise the OS (background limits, permission dialogs, GPS hardware).
