import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
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

// ✅ distanceInterval per category — Android Doze keep-alive.
// Must fire WITHIN the timeInterval (30s) at minimum speed so time trigger dominates.
// Walking min 0.5 km/h → 2m every 14s ✅ well under 30s
// Running min 6 km/h   → 8m every 5s  ✅ well under 30s
// Cycling min 10 km/h  → 15m every 5s ✅ well under 30s
const DISTANCE_INTERVAL_METRES: Record<number, number> = {
  64: 2,   // Walking — 2m  (fires every ~14s at 0.5 km/h minimum pace)
  59: 8,   // Running — 8m  (fires every ~5s at 6 km/h minimum pace)
  60: 15,  // Cycling — 15m (fires every ~5s at 10 km/h minimum pace)
};
const DEFAULT_DISTANCE_INTERVAL_METRES = 5; // safe default for unknown category

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
      return;
    }

    const { participantId, eventId, intervalSeconds, categoryId, raceStartTime, manualStart } = JSON.parse(paramsJson);

    // ✅ Race start check — do not send coordinates before race begins.
    // manualStart === 1 means organiser controls start — skip time check entirely.
    // Otherwise raceStartTime must be set AND in the past before any send.
    if (manualStart !== 1) {
      if (!raceStartTime) {
        if (API_CONFIG.DEBUG) console.log('⏳ Background task: no race time configured — skipping send');
        return;
      }
      const raceTimeMs = new Date(raceStartTime).getTime();
      if (isNaN(raceTimeMs) || Date.now() < raceTimeMs) {
        if (API_CONFIG.DEBUG) {
          const minsLeft = isNaN(raceTimeMs) ? '?' : ((raceTimeMs - Date.now()) / 60000).toFixed(1);
          console.log(`⏳ Background task: race not started yet — ${minsLeft} min remaining`);
        }
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
    const minGapMs = (effectiveInterval - 2) * 1000;
    const lastSentStr = await AsyncStorage.getItem(LAST_SENT_KEY);
    const lastSentAt = lastSentStr ? parseInt(lastSentStr) : 0;
    const now = Date.now();

    // ✅ Guard against clock jumps (Samsung) or corrupted timestamp
    if (isNaN(lastSentAt) || lastSentAt > now) {
      await AsyncStorage.setItem(LAST_SENT_KEY, '0');
    } else if (now - lastSentAt < minGapMs) {
      if (API_CONFIG.DEBUG) {
        console.log(`⏭️ Background task throttled — ${((now - lastSentAt) / 1000).toFixed(1)}s since last send`);
      }
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
      if (moved < minMovementMetres) {
        if (API_CONFIG.DEBUG) {
          console.log(`🚶 Background task: skipped — only moved ${moved.toFixed(1)}m (min ${minMovementMetres}m, category ${categoryId})`);
        }
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
      // sendLocation already queued it internally — task completes cleanly
      return;
    }

    // ✅ Increment background sent counter so HomeScreen can update its UI count
    if (result.success) {
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
      const distToFinish = result.distance_to_finish_km ?? result.distance_to_next_cp ?? null;
      if (distToFinish !== null && distToFinish <= FINISH_APPROACH_THRESHOLD) {
        await AsyncStorage.setItem(FINISH_APPROACH_KEY, '1');
        if (API_CONFIG.DEBUG) {
          console.log(`🏁 Finish approach activated — ${distToFinish}km to finish (interval → ${FINISH_APPROACH_INTERVAL}s)`);
        }
      } else if (distToFinish !== null && distToFinish > FINISH_APPROACH_THRESHOLD) {
        // Reset if runner moves away (e.g. GPS error placed them near finish)
        await AsyncStorage.removeItem(FINISH_APPROACH_KEY);
      }
    }

  } catch (err: any) {
    if (API_CONFIG.DEBUG) console.error('❌ Background task failed:', err?.message);
  }
});

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
    if (isRunning) return true;

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
      timeInterval: intervalSeconds * 1000,
      distanceInterval: (categoryId !== undefined
        ? (DISTANCE_INTERVAL_METRES[Number(categoryId)] ?? DEFAULT_DISTANCE_INTERVAL_METRES)
        : DEFAULT_DISTANCE_INTERVAL_METRES),
      foregroundService: {
        notificationTitle,
        notificationBody,
        notificationColor: '#1a73e8',
      },
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      deferredUpdatesInterval: 0,
      deferredUpdatesDistance: 0,
    });

    if (API_CONFIG.DEBUG) console.log('✅ Background task restarted');
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

      // ✅ Clear position + elevation from previous session
      await AsyncStorage.removeItem(LAST_POSITION_KEY);
      await AsyncStorage.removeItem(LAST_ALTITUDE_KEY);
      await AsyncStorage.removeItem(BACKGROUND_SENT_COUNT_KEY);
      await AsyncStorage.removeItem(FINISH_APPROACH_KEY);

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
        timeInterval: intervalSeconds * 1000,
        // ✅ distanceInterval: category-based small value for Android Doze keep-alive.
        // Android on some versions requires BOTH timeInterval AND distanceInterval
        // to be satisfied before firing the task. A large value (50m) at walking
        // speed means the task fires every 50s instead of every 30s — causing
        // missed coordinates. Small values ensure timeInterval is the limiter.
        // The movement threshold inside the task prevents actual double-sends.
        distanceInterval: (categoryId !== undefined ? (DISTANCE_INTERVAL_METRES[Number(categoryId)] ?? DEFAULT_DISTANCE_INTERVAL_METRES) : DEFAULT_DISTANCE_INTERVAL_METRES),
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
      });

      if (API_CONFIG.DEBUG) {
        console.log('✅ Background location task started');
      }

      // ✅ Foreground watch — UI position updates ONLY, no sends.
      // Background task handles all API sends.
      // Uses a longer interval (5x) so it doesn't wake the CPU frequently —
      // just enough to keep the position dot moving on screen.
      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: Math.min(intervalSeconds * 1000, 5000), // max 5s for smooth UI
        },
        (location) => {
          // ✅ UI only — background task handles sends
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
        }
      );

      return {
        remove: async () => {
          // Stop foreground subscription
          subscription.remove();
          // Stop background task
          try {
            await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
          } catch (err) {
            if (API_CONFIG.DEBUG) console.error('❌ Error stopping background task:', err);
          }
          // Clean up stored params
          await AsyncStorage.removeItem(TRACKING_PARAMS_KEY);
          await AsyncStorage.removeItem(LAST_SENT_KEY);
          await AsyncStorage.removeItem(LAST_POSITION_KEY);
          await AsyncStorage.removeItem(LAST_ALTITUDE_KEY);
          await AsyncStorage.removeItem(BACKGROUND_SENT_COUNT_KEY);
          await AsyncStorage.removeItem(FINISH_APPROACH_KEY);
          if (API_CONFIG.DEBUG) console.log('✅ Background location task stopped');
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