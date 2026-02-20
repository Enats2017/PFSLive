import * as Location from 'expo-location';
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
    intervalSeconds: number = 30
  ): Promise<{ remove: () => void }> {
    try {
      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: intervalSeconds * 1000,
          distanceInterval: 0,
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

          callback(position);
        }
      );

      return subscription;
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