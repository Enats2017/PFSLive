import * as Location from 'expo-location';
import BackgroundGeolocation from 'react-native-background-geolocation';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundTask from 'expo-background-task';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import * as Battery from 'expo-battery';
import { LocationData } from './locationService';
import { API_CONFIG } from '../constants/config';

export interface GPSPosition {
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number | null;
  altitudeAccuracy: number | null;
  speed: number | null;
  heading: number | null;
  timestamp: number;
  mocked?: boolean;
}

// ✅ Keys used to pass tracking params into the background task via AsyncStorage.
// The background task has no access to React state, so we store what it needs here.
export const BACKGROUND_LOCATION_TASK = 'background-location-task';
const TRACKING_PARAMS_KEY = '@PFSLive:trackingParams';
const LAST_SENT_KEY = '@PFSLive:lastSentAt';
export const BACKGROUND_SENT_COUNT_KEY = '@PFSLive:bgSentCount';
const LAST_POSITION_KEY = '@PFSLive:lastPosition';
const LAST_ALTITUDE_KEY = '@PFSLive:lastAltitude';

// ✅ Finish-line approach: when ≤ 1km to finish, override interval to 5s
// for accurate plotting. Stored in AsyncStorage so the background task
// can read it without access to React state.
const FINISH_APPROACH_KEY      = '@PFSLive:finishApproach';   // '1' when active
// ✅ Race finished flag — set by background task when distance_to_finish_km === 0.
// Read by HomeScreen 1s timer to auto-stop tracking when participant crosses finish.
export const RACE_FINISHED_KEY = '@PFSLive:raceFinished';        // '1' when finished
// ✅ Near-finish flag — set when distance_to_finish_km ≤ 1km for the first time.
// Persists across sends so auto-stop works even for fast cyclists who skip from
// 1.5km directly to 0.02km in a single 30s interval (25 km/h covers ~208m/30s).
// Set BEFORE the auto-stop check so it works on the same send it is first activated.
const NEAR_FINISH_KEY = '@PFSLive:nearFinish';                   // '1' when ever within 1km
const FINISH_APPROACH_INTERVAL = 5;                            // seconds
const FINISH_APPROACH_THRESHOLD = 1.0;                         // km

// ✅ Movement thresholds per sport category.
// Must be LESS than (min_speed × timeInterval) so the check passes at minimum walking pace.
// Walking min ~0.5 km/h → moves 4.2m in 30s → threshold must be < 4.2m → use 3m
// Running min ~6 km/h   → moves 50m in 30s  → threshold must be < 50m  → use 15m
// Cycling min ~10 km/h  → moves 83m in 30s  → threshold must be < 83m  → use 30m
const MOVEMENT_THRESHOLD: Record<number, number> = {
  64: 3,   // Walking — 3m  (safe at 0.5 km/h min pace)
  59: 15,  // Running — 15m (safe at 6 km/h min pace)
  60: 30,  // Cycling — 30m (safe at 10 km/h min pace)
};
const DEFAULT_MOVEMENT_METRES = 5; // safe default for unknown category

// ✅ distanceInterval is now 0 for ALL categories and ALL modes.
// timeInterval: 5s handles all firing. distanceInterval > 0 causes Android's
// SMD to suppress GPS at slow speeds. All distance-based filtering is handled
// by the movement threshold inside the task — not by the OS trigger.
// DISTANCE_INTERVAL_METRES kept for reference but no longer used in task registration.
const DISTANCE_INTERVAL_METRES: Record<number, number> = {
  64: 0,   // Walking — 0m
  59: 0,   // Running — 0m
  60: 0,   // Cycling — 0m
};
const DEFAULT_DISTANCE_INTERVAL_METRES = 0;

// ✅ Tracking log — ring buffer of recent background task events.
// Written by background task, read by HomeScreen 1s timer for live display.
export const TRACKING_LOG_KEY = '@PFSLive:trackingLog';
const MAX_LOG_ENTRIES = 500; // keep last 500 events

export interface TrackingLogEntry {
  ts: number;        // Date.now() when event occurred
  icon: string;      // emoji for quick scanning
  msg: string;       // human-readable message
}

const addLog = async (icon: string, msg: string): Promise<void> => {
  try {
    const raw = await AsyncStorage.getItem(TRACKING_LOG_KEY);
    const entries: TrackingLogEntry[] = raw ? JSON.parse(raw) : [];
    entries.push({ ts: Date.now(), icon, msg });
    // Keep only last MAX_LOG_ENTRIES
    if (entries.length > MAX_LOG_ENTRIES) entries.splice(0, entries.length - MAX_LOG_ENTRIES);
    await AsyncStorage.setItem(TRACKING_LOG_KEY, JSON.stringify(entries));
  } catch { /* silent — log failure must never break tracking */ }
};

// ✅ Background task keepalive — fires every 15s via Android JobScheduler.
// Samsung One UI's Adaptive Battery throttles GPS foreground services during
// low-motion activities (walking). JobScheduler has a guaranteed execution
// exemption on One UI that bypasses this restriction.
// When this fires, any batched GPS updates are delivered to the location task.
const BACKGROUND_KEEPALIVE_TASK = 'background-keepalive';

TaskManager.defineTask(BACKGROUND_KEEPALIVE_TASK, async () => {
  if (API_CONFIG.DEBUG) console.log('⚡ Background keepalive fired');
  await addLog('⚡', 'Keepalive fired — waking JS context to unblock GPS');
});

export const startBackgroundFetchKeepalive = async (): Promise<void> => {
  try {
    await BackgroundTask.registerTaskAsync(BACKGROUND_KEEPALIVE_TASK, {
      minimumInterval: 15,    // ✅ 15s — frequent enough to unblock batched GPS
    });
    await addLog('⚡', 'Background keepalive registered (15s interval)');
    if (API_CONFIG.DEBUG) console.log('✅ Background keepalive started');
  } catch (err: any) {
    // Already registered from previous session — unregister and re-register
    try {
      await BackgroundTask.unregisterTaskAsync(BACKGROUND_KEEPALIVE_TASK);
      await BackgroundTask.registerTaskAsync(BACKGROUND_KEEPALIVE_TASK, {
        minimumInterval: 15,
      });
      if (API_CONFIG.DEBUG) console.log('✅ Background keepalive re-registered');
    } catch (retryErr: any) {
      if (API_CONFIG.DEBUG) console.log('⚠️ Background keepalive failed:', retryErr?.message);
    }
  }
};

export const stopBackgroundFetchKeepalive = async (): Promise<void> => {
  try {
    await BackgroundTask.unregisterTaskAsync(BACKGROUND_KEEPALIVE_TASK);
    await addLog('⚡', 'Background keepalive stopped');
    if (API_CONFIG.DEBUG) console.log('✅ Background keepalive stopped');
  } catch { /* silent — may not have been registered */ }
};

// Haversine formula — straight-line distance between two GPS coordinates in metres
function distanceMetres(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ✅ BACKGROUND TASK — defined at TOP LEVEL (required by expo-task-manager).
// Runs even when app is backgrounded or phone is locked.
// Reads participantId/eventId from AsyncStorage, sends or queues the location.
//
// IMPORTANT: This task runs in a SEPARATE JS context from the main app on Android.
// Module-level variables in this file are NOT shared with the main app context.
// All state must go through AsyncStorage.
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }: any) => {
  if (error) {
    if (API_CONFIG.DEBUG) console.error('❌ Background location task error:', error);
    return;
  }

  if (!data?.locations?.length) return;

  try {
    // Read tracking params stored when GPS was started
    const paramsJson = await AsyncStorage.getItem(TRACKING_PARAMS_KEY);
    if (!paramsJson) {
      if (API_CONFIG.DEBUG) console.log('⚠️ Background task: no tracking params found');
      await addLog('⚠️', 'Task fired but no params found — may have been killed by OS');
      return;
    }

    const { participantId, eventId, intervalSeconds, categoryId, raceStartTime, manualStart } = JSON.parse(paramsJson);

    await addLog('🔔', `Task fired — cat:${categoryId} interval:${intervalSeconds}s manualStart:${manualStart ?? 0}`);

    // ✅ Race start check — do not send coordinates before race begins.
    // manualStart === 1 means organiser controls start — skip time check entirely.
    // Otherwise raceStartTime must be set AND in the past before any send.
    if (manualStart !== 1) {
      if (!raceStartTime) {
        if (API_CONFIG.DEBUG) console.log('⏳ Background task: no race time configured — skipping send');
        await addLog('⏳', 'Race time not set — skipping send');
        return;
      }
      const raceTimeMs = new Date(raceStartTime).getTime();
      if (isNaN(raceTimeMs) || Date.now() < raceTimeMs) {
        const minsLeft = isNaN(raceTimeMs) ? '?' : ((raceTimeMs - Date.now()) / 60000).toFixed(1);
        if (API_CONFIG.DEBUG) {
          console.log(`⏳ Background task: race not started yet — ${minsLeft} min remaining`);
        }
        await addLog('⏳', `Race not started — ${minsLeft}min remaining`);
        return;
      }
    }

    // ✅ Parse to number — API returns category_id as string e.g. "59"
    const categoryIdNum = Number(categoryId);
    const minMovementMetres = MOVEMENT_THRESHOLD[categoryIdNum] ?? DEFAULT_MOVEMENT_METRES;
    const distInterval = DISTANCE_INTERVAL_METRES[categoryIdNum] ?? DEFAULT_DISTANCE_INTERVAL_METRES;

    if (API_CONFIG.DEBUG) {
      console.log(`📊 Background task config — categoryId: ${categoryId} (${categoryIdNum})`);
      console.log(`   MOVEMENT_THRESHOLD: ${minMovementMetres}m | DISTANCE_INTERVAL: ${distInterval}m`);
    }

    // ✅ Use finish-approach interval (5s) when runner is within 1km of finish.
    // FINISH_APPROACH_KEY is set by the background task itself after each
    // API response — no React state needed.
    const finishApproach = await AsyncStorage.getItem(FINISH_APPROACH_KEY);
    const effectiveInterval = finishApproach === '1'
        ? FINISH_APPROACH_INTERVAL
        : (intervalSeconds ?? 30);
    const minGapMs = (effectiveInterval - 5) * 1000; // ✅ 5s buffer for Doze timing variance
    const lastSentStr = await AsyncStorage.getItem(LAST_SENT_KEY);
    const lastSentAt = lastSentStr ? parseInt(lastSentStr) : 0;
    const now = Date.now();

    // ✅ Guard against clock jumps (Samsung) or corrupted timestamp
    if (isNaN(lastSentAt) || lastSentAt > now) {
      await AsyncStorage.setItem(LAST_SENT_KEY, '0');
      await addLog('⏰', `Clock jump detected — LAST_SENT reset (lastSentAt:${lastSentAt} now:${now})`);
    } else if (now - lastSentAt < minGapMs) {
      const elapsed = ((now - lastSentAt) / 1000).toFixed(1);
      if (API_CONFIG.DEBUG) {
        console.log(`⏭️ Background task throttled — ${elapsed}s since last send`);
      }
      await addLog('⏭️', `Throttled — only ${elapsed}s since last send (min ${(minGapMs/1000).toFixed(0)}s)`);
      return;
    }

    // Use the most recent location
    const raw = data.locations[data.locations.length - 1];

    // ✅ Calculate elevation gain from last known altitude
    let elevationGain: number | undefined;
    const currentAltitude = raw.coords.altitude ?? null;
    if (currentAltitude !== null) {
      const lastAltStr = await AsyncStorage.getItem(LAST_ALTITUDE_KEY);
      if (lastAltStr) {
        const lastAlt = parseFloat(lastAltStr);
        if (!isNaN(lastAlt) && currentAltitude > lastAlt) {
          elevationGain = parseFloat((currentAltitude - lastAlt).toFixed(1));
        }
      }
      await AsyncStorage.setItem(LAST_ALTITUDE_KEY, String(currentAltitude));
    }

    // ✅ Read battery info
    let batteryLevel: number | undefined;
    let batteryCharging: boolean | undefined;
    try {
      const level = await Battery.getBatteryLevelAsync();
      const state = await Battery.getBatteryStateAsync();
      batteryLevel = Math.round(level * 100);
      batteryCharging = state === Battery.BatteryState.CHARGING ||
                        state === Battery.BatteryState.FULL;
    } catch { /* silent */ }

    // ✅ Determine is_moving from speed
    const speed = raw.coords.speed ?? null;
    const isMoving = speed !== null ? speed > 0.5 : undefined;

    const location: LocationData = {
      latitude: raw.coords.latitude,
      longitude: raw.coords.longitude,
      altitude: currentAltitude ?? undefined,
      accuracy: raw.coords.accuracy ?? undefined,
      altitudeAccuracy: raw.coords.altitudeAccuracy ?? undefined,
      timestamp: new Date(raw.timestamp).toISOString(),
      speed: speed ?? undefined,
      heading: raw.coords.heading ?? undefined,
      isMock: raw.mocked || false,
      elevationGain,
      batteryLevel,
      batteryCharging,
      isMoving,
    };

    // ✅ Movement check — skip send if participant hasn't moved since last send.
    // ✅ FIX: checked BEFORE writing LAST_SENT_KEY so the throttle timestamp is
    // only committed when we actually intend to send. Previously the timestamp
    // was written first, causing the next invocation to be blocked even though
    // the current one was silently skipped due to insufficient movement.
    const lastPosStr = await AsyncStorage.getItem(LAST_POSITION_KEY);
    if (lastPosStr) {
      const lastPos = JSON.parse(lastPosStr);
      const moved = distanceMetres(lastPos.lat, lastPos.lon, location.latitude, location.longitude);
      // ✅ Skip movement check during finish approach — every metre counts near finish.
      // Runner may be slowing to a walk, crossing timing mats, or briefly stopped.
      // Movement threshold would suppress these critical final coordinates.
      if (finishApproach !== '1' && moved < minMovementMetres) {
        if (API_CONFIG.DEBUG) {
          console.log(`🚶 Background task: skipped — only moved ${moved.toFixed(1)}m (min ${minMovementMetres}m, category ${categoryId})`);
        }
        await addLog('🚶', `Skipped — moved only ${moved.toFixed(1)}m (need ${minMovementMetres}m)`);
        // ✅ Do NOT write LAST_SENT_KEY — let the next invocation try again
        // without waiting a full interval. This ensures queuing still happens
        // when network returns even if movement was below threshold.
        return;
      }
    }

    // ✅ Write timestamp NOW — after movement check passes, before send.
    // This prevents concurrent invocations from double-sending while still
    // allowing the next task to fire immediately if this one was skipped.
    await AsyncStorage.setItem(LAST_SENT_KEY, String(now));

    // ✅ Update last known position before send
    await AsyncStorage.setItem(LAST_POSITION_KEY, JSON.stringify({
      lat: location.latitude,
      lon: location.longitude,
    }));

    // ✅ SEND-GAP DIAGNOSTIC — log the actual elapsed time since the previous
    // send so freezes / OS throttling are obvious in the tracking log.
    // During a screen-off multi-app contention test this is the key signal:
    //   • gap ≈ effectiveInterval  → healthy, task firing on schedule
    //   • gap ≫ effectiveInterval  → JS context was frozen/throttled (Samsung
    //     One UI, Doze, or another GPS app starved us). A ⏱️ line with a big
    //     number = exactly the gap Transistor's WakeLock is meant to prevent.
    // lastSentAt === 0 means this is the first send of the session (no gap yet).
    // Also skip when lastSentAt was invalid (clock jump / NaN / future) — the
    // clock-jump guard above resets the stored key but this local still holds the
    // stale value, which would produce a misleading gap on that one cycle.
    const lastSentValid = (lastSentAt > 0 && !isNaN(lastSentAt) && lastSentAt <= now);
    if (lastSentValid) {
      const gapSec      = (now - lastSentAt) / 1000;
      const expectedSec = effectiveInterval; // 5s finish-approach, else interval (e.g. 30s)
      // Flag a gap as a freeze when it exceeds expected by > 2× the 5s task period
      // (i.e. more than ~2 missed task fires beyond the expected send interval).
      const isFreeze = gapSec > (expectedSec + 10);
      await addLog(
        isFreeze ? '⏱️🔴' : '⏱️',
        `Send gap ${gapSec.toFixed(1)}s (expected ~${expectedSec}s)${isFreeze ? ' — POSSIBLE FREEZE/THROTTLE' : ''}`
      );
    }

    await addLog('📍', `Sending — lat:${location.latitude.toFixed(5)} lon:${location.longitude.toFixed(5)} spd:${location.speed?.toFixed(1) ?? '?'}m/s bat:${location.batteryLevel ?? '?'}% ele:${location.altitude?.toFixed(0) ?? '?'}m`);

    if (API_CONFIG.DEBUG) {
      console.log('📍 Background task: sending location', {
        lat: location.latitude,
        lon: location.longitude,
        participantId,
        eventId,
      });
    }

    // Import here to avoid circular deps at module level
    const { locationService } = require('./locationService');

    // ✅ Wrap send in try/catch so a network error never throws out of the task.
    // If the task throws uncaught, Android marks it as crashed and may kill
    // the foreground service entirely — causing the "task fires 3 times then dies"
    // behaviour seen with unstable networks. Queuing handles the offline case.
    let result: any = { success: false };
    try {
      result = await locationService.sendLocation(participantId, eventId, location, true);
    } catch (sendErr: any) {
      if (API_CONFIG.DEBUG) console.log('⚠️ Background task: send failed, location queued:', sendErr?.message);
      await addLog('📦', `Send failed — queued. Error: ${sendErr?.message ?? 'unknown'}`);
      // sendLocation already queued it internally — task completes cleanly
      return;
    }

    // ✅ Increment background sent counter so HomeScreen can update its UI count
    if (!result.success) {
      await addLog('🔴', `API rejected — ${result.message ?? 'unknown'} (location queued if applicable)`);
    }

    if (result.success) {
      await addLog('✅', `Sent OK — id:${result.locationId ?? '?'} dist_to_finish:${result.distance_to_finish_km ?? '?'}km`);
      const countStr = await AsyncStorage.getItem(BACKGROUND_SENT_COUNT_KEY);
      const count = countStr ? parseInt(countStr) : 0;
      await AsyncStorage.setItem(BACKGROUND_SENT_COUNT_KEY, String(count + 1));

      // ✅ Finish-line approach: activate 5s interval when ≤ 1km to finish.
      // API returns distance_to_next_cp (km) in the response.
      // We check is_finish_next separately via the finish_distance field.
      // Simpler: if distance_to_next_cp <= threshold AND it's the last CP,
      // the API returns distance_to_next_cp = distance to finish.
      // We activate approach mode whenever distance_to_next_cp <= 1km
      // since at that point the runner is close enough that 5s matters.
      // ✅ Use distance_to_finish_km (specific to finish line) rather than
      // distance_to_next_cp (which could be any intermediate checkpoint).
      // Falls back to distance_to_next_cp only if finish distance unavailable.
      // ✅ Loop course guard: skip finish approach for first 3 sends (~90s).
      // Prevents false activation when GPS snaps to near-finish km on a loop
      // course start. 90s is safe for all sports — no race finishes in 90s.
      const sentCountStr = await AsyncStorage.getItem(BACKGROUND_SENT_COUNT_KEY);
      const sentCount = sentCountStr ? parseInt(sentCountStr) : 0;
      const distToFinish = (sentCount < 3)
        ? null
        : (result.distance_to_finish_km ?? result.distance_to_next_cp ?? null);
      if (distToFinish !== null && distToFinish <= FINISH_APPROACH_THRESHOLD) {
        const wasActive = finishApproach === '1';
        await AsyncStorage.setItem(FINISH_APPROACH_KEY, '1');
        if (API_CONFIG.DEBUG) {
          console.log(`🏁 Finish approach activated — ${distToFinish}km to finish (interval → ${FINISH_APPROACH_INTERVAL}s)`);
        }
        // ✅ No task restart needed — task already fires every 5s from the start.
        // minGapMs = 0 when finish approach active → every fire sends immediately.
        // Previously we called stop/start here which killed the task's own execution.
        if (!wasActive) {
          await addLog('🏁', `Finish approach activated — ${distToFinish.toFixed(2)}km to finish, sending every 5s`);
        }
      } else if (distToFinish !== null && distToFinish > FINISH_APPROACH_THRESHOLD) {
        // Reset if runner moves away (e.g. GPS error placed them near finish)
        if (finishApproach === '1') {
          await addLog('🔄', `Finish approach reset — now ${distToFinish.toFixed(2)}km from finish`);
        }
        await AsyncStorage.removeItem(FINISH_APPROACH_KEY);
      }

      // ✅ Auto-stop detection: participant has finished the race.
      //
      // The server now returns `finished` (1/0) for BOTH event types:
      //   • Partner events with RaceResult: finished = runner CROSSED the finish
      //     timing mat (RR is_finish && is_crossed).
      //   • Custom events & partner-without-RR: finished = 1 when the server's
      //     distance_to_finish_km <= 0.05 (50m).
      //
      // We require the server flag AND all the existing local guards — every
      // condition must be true to auto-stop. The server flag is the
      // authoritative "are they done" signal; the local guards remain as
      // safety against loop-course / GPS-snap edge cases:
      //
      // 1. finished === 1 — server confirms finished (both event types).
      //
      // 2. finishedRaw <= 0.05 — within 50m of finish line (local cross-check).
      //
      // 3. sentCount >= 3 — loop course guard (start == finish physically).
      //    First 3 sends (~90s) are ignored so a participant standing at the
      //    start/finish area of a loop course doesn't trigger auto-stop immediately.
      //
      // 4. nearFinish === '1' — participant must have been within 1km of finish
      //    at some point during this session (set just above, same send).
      //    Unlike finishApproach (read at task START = previous send state),
      //    NEAR_FINISH_KEY is SET then immediately READ in the same execution,
      //    so it works even when a fast cyclist (25 km/h) jumps from 1.5km
      //    directly to 0.02km in a single 30s interval — finish approach would
      //    never have been active in a previous send, but nearFinish is set
      //    and checked in the same send. Prevents false trigger from a GPS snap
      //    error mid-race that accidentally reports near-zero finish distance.

      // ✅ Server-authoritative finished flag (1/0). Accept number or string form.
      const serverFinished = result.finished === 1 || result.finished === '1';
      // ✅ Finish authority. 'rr' = RR recorded the crossing → trust finished alone
      // (GPS distance can lag far behind the timing mat). 'distance' = derived from
      // distance_to_finish_km ≤ 50m → apply the GPS guards below. Default 'distance'.
      const finishSource = result.finish_source ?? 'distance';

      const finishedRaw = result.distance_to_finish_km ?? null;
      // ✅ Set NEAR_FINISH_KEY the moment participant first comes within 1km of finish.
      // Done BEFORE the auto-stop check so cycling (fast sport) can trigger auto-stop
      // on the same send where they first enter the 1km zone — even if they jump from
      // 1.5km to 0.02km in a single 30s interval at 25 km/h.
      // finishApproach (read at task start) reflects PREVIOUS send — too late for cycling.
      // NEAR_FINISH_KEY is set HERE then immediately checked below — same-send detection.
      if (distToFinish !== null && distToFinish <= FINISH_APPROACH_THRESHOLD) {
        await AsyncStorage.setItem(NEAR_FINISH_KEY, '1');
      }
      const nearFinish = await AsyncStorage.getItem(NEAR_FINISH_KEY);

      // ✅ Auto-stop decision depends on the finish authority:
      //   • RR ('rr'): RR has recorded the finish-line crossing — this is
      //     definitive. Stop on finished=1 alone. We deliberately do NOT apply
      //     the GPS guards here, because the phone's GPS distance can lag far
      //     behind the timing mat (observed: finished=1 while GPS showed 16km
      //     remaining). Applying the ≤0.05km guard would wrongly block the stop.
      //   • Distance ('distance' — custom / partner-without-RR): finished was
      //     derived from GPS proximity, so keep the full guard set as a safety net
      //     against a mid-race GPS snap falsely reporting near-zero finish distance:
      //       finished=1 AND ≤50m AND sentCount≥3 AND was-within-1km-this-session.
      const shouldStop = (finishSource === 'rr')
        ? serverFinished
        : (
            serverFinished &&
            finishedRaw !== null &&
            finishedRaw <= 0.05 &&
            sentCount >= 3 &&
            nearFinish === '1'
          );

      if (shouldStop) {
        await AsyncStorage.setItem(RACE_FINISHED_KEY, '1');
        await addLog(
          '🏆',
          finishSource === 'rr'
            ? `Finish confirmed by RaceResult (finished=1) — stopping GPS`
            : `Finish line crossed — ${finishedRaw?.toFixed(3)}km to finish, stopping GPS`
        );

        // ✅ Stop GPS engines immediately from the background task.
        // This stops location updates RIGHT NOW without waiting for the app
        // to come to foreground. React state cleanup (intervals, UI, queue drain,
        // log upload) happens in stopGPSTracking() when user opens the app —
        // both the 1s timer and the AppState listener read RACE_FINISHED_KEY
        // and call stopGPSTracking() which safely no-ops the GPS stop calls
        // since they're already stopped here.
        try {
          await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
          await addLog('🛑', 'GPS engines stopped from background — finish line reached');
        } catch { /* silent — may already be stopped */ }
        try {
          await BackgroundGeolocation.stop();
          BackgroundGeolocation.removeListeners();
        } catch { /* silent */ }
      }
    }

  } catch (err: any) {
    if (API_CONFIG.DEBUG) console.error('❌ Background task failed:', err?.message);
    await addLog('❌', `Task crashed: ${err?.message ?? 'unknown error'}`);
  }
});

// ✅ Module-level reference to the foreground watch AppState subscription.
// Stored here so it can be cleaned up if startWatchingPosition is called
// again without stop being called first (prevents listener leak).
let _fgAppStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;

// ✅ Watchdog: called when app returns to foreground to ensure background
// task is still alive. Android may silently kill it on aggressive OEMs
// (Xiaomi, Samsung) even with battery optimization exempt.
export const ensureBackgroundTaskAlive = async (
  participantId: string,
  eventId: string,
  intervalSeconds: number,
  categoryId: number | undefined,
  raceStartTime: string | null,
  manualStart: number | undefined,
  notificationTitle: string,
  notificationBody: string,
): Promise<boolean> => {
  try {
    const isRunning = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    if (isRunning) {
      await addLog('💚', 'Watchdog check — background task alive');
      return true;
    }

    if (API_CONFIG.DEBUG) {
      console.log('⚠️ Background task died — restarting...');
    }

    // Re-store params (may have been cleared when task died)
    await AsyncStorage.setItem(TRACKING_PARAMS_KEY, JSON.stringify({
      participantId,
      eventId,
      intervalSeconds,
      categoryId,
      raceStartTime,
      manualStart,
    }));

    await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
      accuracy: Location.Accuracy.High,
      // ✅ Always 5s timeInterval — same as initial start.
      // No need to check FINISH_APPROACH_KEY since task always fires every 5s.
      // minGapMs inside the task handles send rate (25s normal, 0s finish approach).
      timeInterval: 5000,
      distanceInterval: 0,
      foregroundService: {
        notificationTitle,
        notificationBody,
        notificationColor: '#1a73e8',
      },
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      deferredUpdatesInterval: 0,
      deferredUpdatesDistance: 0,
      // ✅ Same activityType as initial start — must match to avoid GPS priority drop
      activityType: Location.LocationActivityType.Fitness,
    });

    if (API_CONFIG.DEBUG) console.log('✅ Background task restarted');
    await addLog('♻️', 'Watchdog: background task was dead — restarted successfully');

    // ✅ [TRANSISTOR] Also restart transistor if it stopped
    try {
      const bgState = await BackgroundGeolocation.getState();
      if (!bgState.enabled) {
        await BackgroundGeolocation.start();
        await addLog('♻️', 'Watchdog: transistor also restarted');
      }
    } catch { /* silent */ }

    return true;
  } catch (err: any) {
    if (API_CONFIG.DEBUG) console.error('❌ Failed to restart background task:', err?.message);
    return false;
  }
};

export const gpsService = {
  /**
   * Request location permissions
   */
  async requestPermissions(): Promise<boolean> {
    try {
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      
      if (foregroundStatus !== 'granted') {
        if (API_CONFIG.DEBUG) {
          console.error('❌ Foreground location permission denied');
        }
        return false;
      }

      const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
      
      if (API_CONFIG.DEBUG) {
        if (backgroundStatus === 'granted') {
          console.log('✅ Background location permission granted');
        } else {
          console.warn('⚠️ Background location permission denied');
        }
      }

      return true;
    } catch (error) {
      if (API_CONFIG.DEBUG) {
        console.error('❌ Error requesting location permissions:', error);
      }
      return false;
    }
  },

  /**
   * Check if location permissions are granted
   */
  async hasPermissions(): Promise<boolean> {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      if (API_CONFIG.DEBUG) {
        console.error('❌ Error checking location permissions:', error);
      }
      return false;
    }
  },

  /**
   * Get current GPS position
   */
  async getCurrentPosition(): Promise<GPSPosition> {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        altitude: location.coords.altitude,
        accuracy: location.coords.accuracy,
        altitudeAccuracy: location.coords.altitudeAccuracy,
        speed: location.coords.speed,
        heading: location.coords.heading,
        timestamp: location.timestamp,
        mocked: location.mocked,
      };
    } catch (error) {
      if (API_CONFIG.DEBUG) {
        console.error('❌ Error getting GPS position:', error);
      }
      throw error;
    }
  },

  /**
   * Convert GPS position to LocationData format
   */
  convertToLocationData(gpsPosition: GPSPosition): LocationData {
    return {
      latitude: gpsPosition.latitude,
      longitude: gpsPosition.longitude,
      altitude: gpsPosition.altitude || undefined,
      accuracy: gpsPosition.accuracy || undefined,
      altitudeAccuracy: gpsPosition.altitudeAccuracy || undefined,
      timestamp: new Date(gpsPosition.timestamp).toISOString(),
      speed: gpsPosition.speed || undefined,
      heading: gpsPosition.heading || undefined,
      speedAccuracy: undefined,
      isMock: gpsPosition.mocked || false,
    };
  },

  /**
   * Start watching position
   */
  async startWatchingPosition(
    callback: (position: GPSPosition) => void,
    errorCallback?: (error: Error) => void,
    intervalSeconds: number = 30,
    participantId?: string,
    eventId?: string,
    notificationTitle?: string,
    notificationBody?: string,
    categoryId?: number,
    raceStartTime?: string | null,  // ISO string, null if no scheduled time
    manualStart?: number,            // 1 = organiser controls start
  ): Promise<{ remove: () => void }> {
    try {
      // ✅ Guard: foreground service cannot start when app is in background.
      // Wait up to 3s for app to come to foreground before throwing.
      // This handles the race condition where user taps "Start" just as the
      // app transitions to background (e.g. battery dialog closing).
      const appCurrentState = AppState.currentState;
      if (appCurrentState !== 'active') {
        if (API_CONFIG.DEBUG) {
          console.log(`⚠️ App state is '${appCurrentState}' — waiting for foreground...`);
        }
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            subscription.remove();
            reject(new Error('App did not return to foreground in time'));
          }, 3000);

          const subscription = AppState.addEventListener('change', (state) => {
            if (state === 'active') {
              clearTimeout(timeout);
              subscription.remove();
              resolve();
            }
          });
        });
      }

      // ✅ Always stop any existing background task before starting fresh.
      // This prevents duplicate registrations which cause rapid-fire wakes.
      // Also remove any existing AppState listener to prevent leaks if
      // startWatchingPosition is called again without stop() being called.
      if (_fgAppStateSubscription) {
        _fgAppStateSubscription.remove();
        _fgAppStateSubscription = null;
      }
      try {
        await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
        if (API_CONFIG.DEBUG) console.log('♻️ Stopped existing background task before restart');
      } catch {
        // Not running — that's fine, ignore the error
      }

      // ✅ Store tracking params for the background task
      await AsyncStorage.setItem(TRACKING_PARAMS_KEY, JSON.stringify({
        participantId,
        eventId,
        intervalSeconds,
        categoryId,     // ✅ used by background task to pick movement threshold
        raceStartTime,  // ✅ used by background task to block sends before race
        manualStart,    // ✅ 1 = skip race start check
      }));

      // ✅ Clear position + elevation + log from previous session
      await AsyncStorage.removeItem(TRACKING_LOG_KEY);
      await AsyncStorage.removeItem(LAST_POSITION_KEY);
      await AsyncStorage.removeItem(LAST_ALTITUDE_KEY);
      await AsyncStorage.removeItem(BACKGROUND_SENT_COUNT_KEY);
      await AsyncStorage.removeItem(FINISH_APPROACH_KEY);
      await AsyncStorage.removeItem(RACE_FINISHED_KEY);
      await AsyncStorage.removeItem(NEAR_FINISH_KEY);

      // ✅ Set LAST_SENT_KEY based on race state:
      // - Race not started yet → set to now → throttles first invocation so no
      //   coordinate leaks before race begins (race check in task handles rest)
      // - Race already started → set to 0 → first invocation sends immediately
      const raceAlreadyStarted = manualStart === 1 ||
        (raceStartTime !== null && raceStartTime !== undefined &&
         Date.now() >= new Date(raceStartTime).getTime());
      await AsyncStorage.setItem(LAST_SENT_KEY, raceAlreadyStarted ? '0' : String(Date.now()));

      // ✅ Start background location updates — works even when phone is locked
      await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
        // ✅ High accuracy — Balanced accuracy gets aggressively batched by Android
        // Doze mode. High accuracy uses GPS directly and fires more reliably at
        // the requested interval.
        accuracy: Location.Accuracy.High,
        // ✅ timeInterval: 5s always — task fires every 5s for ALL categories.
        // Actual send rate is controlled by minGapMs inside the task (default 25s).
        // This eliminates the need to restart the task for finish approach —
        // when dist ≤ 1km, minGapMs drops to 0 and every fire sends immediately.
        // Calling stop/start from within the task callback kills its own execution.
        timeInterval: 5000,
        // ✅ distanceInterval: 0 — time-only trigger for all categories.
        // Android's SMD suppresses GPS at slow speeds when distanceInterval > 0.
        // Running/Cycling fire frequently enough via timeInterval: 5s anyway.
        distanceInterval: 0,
        // ✅ Show foreground service notification on Android (required for background).
        // Strings passed from HomeScreen so they come from the language file.
        foregroundService: {
          notificationTitle: notificationTitle ?? 'Live Tracking Active',
          notificationBody: notificationBody ?? 'Your location is being tracked for the race.',
          notificationColor: '#1a73e8',
        },
        pausesUpdatesAutomatically: false,
        showsBackgroundLocationIndicator: true,
        // ✅ deferredUpdatesInterval: 0 — deliver location updates immediately,
        // do not defer/batch them. Critical for screen-off background tracking.
        // Without this Android batches updates during Doze maintenance windows.
        deferredUpdatesInterval: 0,
        deferredUpdatesDistance: 0,
        // ✅ activityType: Fitness — tells Android/iOS this is a fitness session.
        // Prevents the OS from throttling GPS when multiple fitness apps have
        // active GPS sessions simultaneously (e.g. StepSetGo walking session).
        // When StepSetGo starts a walking session it opens a High accuracy GPS
        // session — without Fitness activityType, Samsung One UI deprioritises
        // Livio's session as the newer consumer, causing background GPS gaps.
        // With Fitness activityType, both sessions get equal GPS priority.
        // Same flag used by Strava, Nike Run Club, Google Fit for this reason.
        activityType: Location.LocationActivityType.Fitness,
      });

      if (API_CONFIG.DEBUG) {
        console.log('✅ Background location task started');
      }
      await addLog('🚀', `Background task started — interval:${intervalSeconds}s distInterval:${categoryId !== undefined ? (DISTANCE_INTERVAL_METRES[Number(categoryId)] ?? DEFAULT_DISTANCE_INTERVAL_METRES) : DEFAULT_DISTANCE_INTERVAL_METRES}m cat:${categoryId}`);

      // ✅ [TRANSISTOR] react-native-background-geolocation: secondary GPS engine.
      // Transistor's native WakeLock prevents Samsung One UI from freezing the JS
      // context during cycling sessions (~6-10 min into background ride) — confirmed
      // over 4-5 sessions where expo-location alone had 87-278s random gaps.
      // Runs ALONGSIDE expo-location — expo-location remains the primary engine.
      // Non-fatal try/catch — if transistor fails, expo-location continues normally.
      // ⚠️ DEBUG builds work without license key (free to test).
      // RELEASE/PREVIEW builds need key from shop.transistorsoft.com in app.config.js.
      try {
        await BackgroundGeolocation.ready({
          // ✅ Geolocation config (GeoConfig) — all geo options nested here
          geolocation: {
            desiredAccuracy:              BackgroundGeolocation.DesiredAccuracy.High,
            locationAuthorizationRequest: 'Always',
            distanceFilter:               0,
            locationUpdateInterval:       intervalSeconds * 1000,
            fastestLocationUpdateInterval: 5000,
            disableStopDetection:         true,   // ✅ never auto-stop during race
            stopTimeout:                  5,
            pausesLocationUpdatesAutomatically: false,
            showsBackgroundLocationIndicator:   true,
            activityType:                 BackgroundGeolocation.ActivityType.Fitness,
            allowIdenticalLocations:      true,   // ✅ allow same coords at water stations
          },
          // ✅ Activity recognition config (ActivityConfig)
          // disableMotionActivityUpdates: we handle movement filtering ourselves
          // via minMovementMetres in the background task — transistor's motion
          // state machine would pause GPS delivery which we don't want.
          activity: {
            activityRecognitionInterval:  10000,
            disableMotionActivityUpdates: true,
          },
          // ✅ App config (AppConfig)
          // foregroundService is NOT listed here — it is enabled automatically
          // on Android when a notification is configured.
          app: {
            stopOnTerminate:   false,
            startOnBoot:       false,
            heartbeatInterval: 60,
            preventSuspend:    true,
            notification: {
              title: notificationTitle ?? 'Live Tracking Active',
              text:  notificationBody  ?? 'Your location is being tracked.',
              color: '#1a73e8',
            },
          },
          // ✅ Logger config (LoggerConfig)
          logger: {
            logLevel: API_CONFIG.DEBUG
              ? BackgroundGeolocation.LogLevel.Verbose
              : BackgroundGeolocation.LogLevel.Off,
          },
          reset: true,
        });

        // ✅ Transistor delivers locations independently of expo-location.
        // Both engines run in parallel — transistor's native WakeLock prevents
        // Samsung from freezing the JS context during cycling sessions.
        //
        // ✅ Transistor does NOT feed the foreground UI callback — expo-location's
        // foreground watch (started below) is the single source of truth for the
        // displayed position. Feeding callback from both engines caused the on-screen
        // lat/lon to jitter between the two providers (they fire at different rates
        // and through different GPS smoothing). Transistor's job here is to keep the
        // native WakeLock alive so expo-location's background task doesn't get frozen
        // by Samsung One UI — not to drive the UI.
        BackgroundGeolocation.onLocation((bgLoc) => {
          addLog('🛰️', `Transistor loc — lat:${bgLoc.coords.latitude.toFixed(5)} spd:${bgLoc.coords.speed?.toFixed(1) ?? '?'}m/s moving:${bgLoc.is_moving}`);
        });

        BackgroundGeolocation.onMotionChange((event) => {
          addLog(event.isMoving ? '🏃' : '🧍', `Motion: ${event.isMoving ? 'moving' : 'stationary'}`);
        });

        await BackgroundGeolocation.start();
        await addLog('🛰️', 'Transistor started — native WakeLock active, Samsung JS freeze prevented');
        if (API_CONFIG.DEBUG) console.log('✅ BackgroundGeolocation (transistor) started');
      } catch (transistorErr: any) {
        // ✅ Non-fatal — expo-location background task still running as primary.
        // ✅ Also clean up any onLocation/onMotionChange listeners that were
        // registered before .start() failed (e.g. license rejection on a release
        // build). Without this, a subsequent ready() with reset:true mostly
        // self-heals, but the orphaned listeners can still cause double-fires
        // until then. removeListeners() is safe to call even if none registered.
        try { BackgroundGeolocation.removeListeners(); } catch { /* silent */ }
        await addLog('⚠️', `Transistor start failed: ${transistorErr?.message ?? 'unknown'} — expo-location continues`);
        if (API_CONFIG.DEBUG) console.warn('⚠️ Transistor failed to start:', transistorErr?.message);
      }

      let fgSubscription: Location.LocationSubscription | null = null;
      let fgStarting = false; // ✅ Guard against concurrent async calls

      // ✅ Foreground watch — always High accuracy, always 5s.
      // Never stopped on screen-off — stopping it caused Android to renegotiate
      // the GPS session for the background task, batching all updates until the
      // next Doze maintenance window (causing 10-15 min gaps with screen off).
      // Both fg watch and bg task use High accuracy — Android merges into one
      // GPS session internally. No chip contention.
      const fgWatchOptions = {
        accuracy: Location.Accuracy.High,
        timeInterval: Math.min(intervalSeconds * 1000, 5000),
      };

      const startFgWatch = async () => {
        if (fgSubscription || fgStarting) return; // ✅ prevent double subscription
        fgStarting = true;
        try {
          addLog('👁️', 'Foreground watch started (High/5s)');
          fgSubscription = await Location.watchPositionAsync(fgWatchOptions, (location) => {
            callback({
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              altitude: location.coords.altitude,
              accuracy: location.coords.accuracy,
              altitudeAccuracy: location.coords.altitudeAccuracy,
              speed: location.coords.speed,
              heading: location.coords.heading,
              timestamp: location.timestamp,
              mocked: location.mocked,
            });
          });
        } finally {
          fgStarting = false; // ✅ always reset so next call can proceed
        }
      };

      const stopFgWatch = () => {
        if (fgSubscription) {
          fgSubscription.remove();
          fgSubscription = null;
          addLog('👁️', 'Foreground watch stopped');
        }
      };

      // ✅ Start foreground watch immediately (app is active)
      await startFgWatch();

      // ✅ Foreground watch stays running on screen-off — no stop/switch.
      // AppState listener only logs transitions and restarts watch if somehow stopped.
      _fgAppStateSubscription = AppState.addEventListener('change', (nextState) => {
        if (nextState === 'active') {
          addLog('📱', 'App foregrounded');
          startFgWatch(); // restart if somehow stopped
        } else if (nextState === 'background') {
          addLog('🌙', 'App backgrounded — fg watch continues (prevents GPS renegotiation)');
        } else if (nextState === 'inactive') {
          addLog('💤', 'App inactive (iOS transition)');
        }
      });

      return {
        remove: async () => {
          // Stop foreground subscription and AppState listener
          if (_fgAppStateSubscription) {
            _fgAppStateSubscription.remove();
            _fgAppStateSubscription = null;
          }
          stopFgWatch();
          // Stop background task
          try {
            await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
          } catch (err) {
            if (API_CONFIG.DEBUG) console.error('❌ Error stopping background task:', err);
          }
          // ✅ [TRANSISTOR] Stop transistor
          try {
            await BackgroundGeolocation.stop();
            BackgroundGeolocation.removeListeners();
          } catch { /* silent */ }
          // Clean up stored params
          await AsyncStorage.removeItem(TRACKING_PARAMS_KEY);
          await AsyncStorage.removeItem(LAST_SENT_KEY);
          await AsyncStorage.removeItem(LAST_POSITION_KEY);
          await AsyncStorage.removeItem(LAST_ALTITUDE_KEY);
          await AsyncStorage.removeItem(BACKGROUND_SENT_COUNT_KEY);
          await AsyncStorage.removeItem(FINISH_APPROACH_KEY);
          await AsyncStorage.removeItem(RACE_FINISHED_KEY);
          await AsyncStorage.removeItem(NEAR_FINISH_KEY);
          if (API_CONFIG.DEBUG) console.log('✅ Background location task stopped');
          await addLog('🛑', 'Background task stopped — tracking ended');
        },
      };
    } catch (error) {
      if (API_CONFIG.DEBUG) {
        console.error('❌ Error watching GPS position:', error);
      }
      if (errorCallback) {
        errorCallback(error as Error);
      }
      throw error;
    }
  },
};