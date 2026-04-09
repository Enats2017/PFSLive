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

// ✅ BACKGROUND TASK — defined at TOP LEVEL (required by expo-task-manager).
// Runs even when app is backgrounded or phone is locked.
// Reads participantId/eventId from AsyncStorage, sends or queues the location.
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

    const { participantId, eventId, intervalSeconds } = JSON.parse(paramsJson);

    // ✅ Throttle — enforce minimum gap between sends
    // ✅ 2s buffer — AsyncStorage write latency means elapsed can read as
    // slightly under intervalSeconds even when the full interval has passed.
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
  ): Promise<{ remove: () => void }> {
    try {
      // ✅ Store tracking params for the background task
      await AsyncStorage.setItem(TRACKING_PARAMS_KEY, JSON.stringify({
        participantId,
        eventId,
        intervalSeconds,
      }));
      await AsyncStorage.removeItem(LAST_SENT_KEY);

      // ✅ Start background location updates — works even when phone is locked
      await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: intervalSeconds * 1000,
        distanceInterval: 50,
        // ✅ Show foreground service notification on Android (required for background).
        // Strings passed from HomeScreen so they come from the language file.
        foregroundService: {
          notificationTitle: notificationTitle ?? 'Live Tracking Active',
          notificationBody: notificationBody ?? 'Your location is being tracked for the race.',
          notificationColor: '#1a73e8',
        },
        // ✅ iOS: pause updates when stationary to save battery
        pausesUpdatesAutomatically: false,
        showsBackgroundLocationIndicator: true,
      });

      if (API_CONFIG.DEBUG) {
        console.log('✅ Background location task started');
      }

      // ✅ Foreground watch — UI position updates only.
      // The background task handles ALL actual sends (both foreground and background).
      // The foreground callback only calls back for UI updates (current position dot),
      // never for sending — this completely eliminates the double-send race condition.
      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: intervalSeconds * 1000,
          distanceInterval: 50,
        },
        (location) => {
          const position: GPSPosition = {
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

          // ✅ Only update UI — background task handles the actual API send
          callback(position);
        }
      );

      return {
        remove: async () => {
          subscription.remove();
          try {
            const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
            if (isRegistered) {
              await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
            }
          } catch (err) {
            if (API_CONFIG.DEBUG) console.error('❌ Error stopping background task:', err);
          }
          // Clean up stored params
          await AsyncStorage.removeItem(TRACKING_PARAMS_KEY);
          await AsyncStorage.removeItem(LAST_SENT_KEY);
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