import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

// ✅ Movement thresholds per sport category.
// Used to skip sends when participant is standing still.
const MOVEMENT_THRESHOLD: Record<number, number> = {
  64: 0,  // Walking  — 10m (slow pace ~1-2 km/h)
  59: 0,  // Running  — 25m (moderate pace ~8-12 km/h)
  60: 0,  // Cycling  — 50m (fast pace ~20-30 km/h)
};
const DEFAULT_MOVEMENT_METRES = 15; // safe default for unknown category

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
    // Applies in both DEBUG and production — race must have started.
    // Only the movement check is bypassed in DEBUG (allows testing while stationary).
    if (manualStart !== 1) {
      if (!raceStartTime) {
        // No scheduled time and not manual — race not configured, skip send
        if (API_CONFIG.DEBUG) console.log('⏳ Background task: no race time configured — skipping send');
        return;
      }
      const raceTime = new Date(raceStartTime).getTime();
      if (Date.now() < raceTime) {
        if (API_CONFIG.DEBUG) {
          const minsLeft = ((raceTime - Date.now()) / 60000).toFixed(1);
          console.log(`⏳ Background task: race not started yet — ${minsLeft} min remaining`);
        }
        return;
      }
    }

    // ✅ Parse to number — API returns category_id as string e.g. "59"
    // ✅ In DEBUG mode skip movement check — allows testing while stationary
    const minMovementMetres = API_CONFIG.DEBUG
      ? 0
      : (MOVEMENT_THRESHOLD[Number(categoryId)] ?? DEFAULT_MOVEMENT_METRES);

    // ✅ THROTTLE — write LAST_SENT_KEY BEFORE the send to block any concurrent
    // task invocations immediately. Android can fire the task multiple times
    // in quick succession; writing first prevents double-sends.
    const minGapMs = ((intervalSeconds ?? 30) - 2) * 1000;
    const lastSentStr = await AsyncStorage.getItem(LAST_SENT_KEY);
    const lastSentAt = lastSentStr ? parseInt(lastSentStr) : 0;
    const now = Date.now();

    if (now - lastSentAt < minGapMs) {
      if (API_CONFIG.DEBUG) {
        console.log(`⏭️ Background task throttled — ${((now - lastSentAt) / 1000).toFixed(1)}s since last send`);
      }
      return;
    }

    // ✅ Write timestamp IMMEDIATELY — before any async work — so concurrent
    // task invocations see it and exit via the throttle check above.
    await AsyncStorage.setItem(LAST_SENT_KEY, String(now));

    // Use the most recent location
    const raw = data.locations[data.locations.length - 1];
    const location: LocationData = {
      latitude: raw.coords.latitude,
      longitude: raw.coords.longitude,
      altitude: raw.coords.altitude ?? undefined,
      accuracy: raw.coords.accuracy ?? undefined,
      altitudeAccuracy: raw.coords.altitudeAccuracy ?? undefined,
      timestamp: new Date(raw.timestamp).toISOString(),
      speed: raw.coords.speed ?? undefined,
      heading: raw.coords.heading ?? undefined,
      isMock: raw.mocked || false,
    };

    // ✅ Movement check — skip send if participant hasn't moved since last send.
    // This avoids sending repeated identical coordinates during warm-up or
    // while standing at the start line before the race begins.
    const lastPosStr = await AsyncStorage.getItem(LAST_POSITION_KEY);
    if (lastPosStr) {
      const lastPos = JSON.parse(lastPosStr);
      const moved = distanceMetres(lastPos.lat, lastPos.lon, location.latitude, location.longitude);
      if (moved < minMovementMetres) {
        if (API_CONFIG.DEBUG) {
          console.log(`🚶 Background task: skipped — only moved ${moved.toFixed(1)}m (min ${minMovementMetres}m, category ${categoryId})`);
        }
        return;
      }
    }

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
    const result = await locationService.sendLocation(participantId, eventId, location, true);

    // ✅ Increment background sent counter so HomeScreen can update its UI count
    if (result.success) {
      const countStr = await AsyncStorage.getItem(BACKGROUND_SENT_COUNT_KEY);
      const count = countStr ? parseInt(countStr) : 0;
      await AsyncStorage.setItem(BACKGROUND_SENT_COUNT_KEY, String(count + 1));
    }

  } catch (err: any) {
    if (API_CONFIG.DEBUG) console.error('❌ Background task failed:', err?.message);
  }
});

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
        accuracy: Location.Accuracy.Balanced,
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
      // ✅ Always stop any existing background task before starting fresh.
      // This prevents duplicate registrations which cause rapid-fire wakes.
      // isTaskRegisteredAsync is checked but we attempt stop regardless
      // because some Android versions return stale registration state.
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

      // ✅ Clear all state from any previous session
      await AsyncStorage.removeItem(LAST_SENT_KEY);
      await AsyncStorage.removeItem(LAST_POSITION_KEY);
      await AsyncStorage.removeItem(BACKGROUND_SENT_COUNT_KEY);

      // ✅ Start background location updates — works even when phone is locked
      await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
        // ✅ High accuracy — Balanced accuracy gets aggressively batched by Android
        // Doze mode. High accuracy uses GPS directly and fires more reliably at
        // the requested interval.
        accuracy: Location.Accuracy.Balanced,
        timeInterval: intervalSeconds * 1000,
        // ✅ distanceInterval: 50 — keeps the task firing reliably on Android.
        // Without a distance trigger, Android Doze mode batches timeInterval
        // updates freely, causing 2-3min gaps. The distance trigger acts as
        // a keep-alive that prevents Doze batching. The throttle inside the
        // task ensures we never actually send more than once per intervalSeconds.
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
          accuracy: Location.Accuracy.Balanced,
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
          await AsyncStorage.removeItem(BACKGROUND_SENT_COUNT_KEY);
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