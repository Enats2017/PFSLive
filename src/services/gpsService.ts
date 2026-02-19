import * as Location from 'expo-location';
import { LocationData } from './locationService';

export interface GPSPosition {
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  timestamp: number;
}

export const gpsService = {
  /**
   * Request location permissions
   */
  async requestPermissions(): Promise<boolean> {
    try {
      console.log('📍 Requesting location permissions...');
      
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      
      if (foregroundStatus !== 'granted') {
        console.error('❌ Foreground location permission denied');
        return false;
      }

      console.log('✅ Foreground location permission granted');

      const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
      
      if (backgroundStatus === 'granted') {
        console.log('✅ Background location permission granted');
      } else {
        console.warn('⚠️ Background location permission denied');
      }

      return true;
    } catch (error) {
      console.error('❌ Error requesting location permissions:', error);
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
      console.error('❌ Error checking location permissions:', error);
      return false;
    }
  },

  /**
   * Get current GPS position
   */
  async getCurrentPosition(): Promise<GPSPosition> {
    try {
      console.log('📍 Getting current GPS position...');
      
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced, // Battery optimized
      });

      console.log('✅ GPS position obtained');

      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        altitude: location.coords.altitude,
        accuracy: location.coords.accuracy,
        speed: location.coords.speed,
        heading: location.coords.heading,
        timestamp: location.timestamp,
      };
    } catch (error) {
      console.error('❌ Error getting GPS position:', error);
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
      elevation: gpsPosition.altitude || undefined,
      accuracy: gpsPosition.accuracy || undefined,
      timestamp: new Date(gpsPosition.timestamp).toISOString(),
      speed: gpsPosition.speed || undefined,
      heading: gpsPosition.heading || undefined,
    };
  },

  /**
   * Start watching position with battery optimization
   */
  async startWatchingPosition(
    callback: (position: GPSPosition) => void,
    errorCallback?: (error: Error) => void,
    intervalSeconds: number = 30 // Default 30 seconds for battery efficiency
  ): Promise<{ remove: () => void }> {
    try {
      console.log(`🔄 Starting GPS watching (interval: ${intervalSeconds}s, battery optimized)...`);

      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced, // Battery optimized (not Highest)
          timeInterval: intervalSeconds * 1000, // Convert to milliseconds
          distanceInterval: 50, // Update every 50 meters (battery optimized)
        },
        (location) => {
          const position: GPSPosition = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            altitude: location.coords.altitude,
            accuracy: location.coords.accuracy,
            speed: location.coords.speed,
            heading: location.coords.heading,
            timestamp: location.timestamp,
          };

          callback(position);
        }
      );

      return subscription;
    } catch (error) {
      console.error('❌ Error watching GPS position:', error);
      if (errorCallback) {
        errorCallback(error as Error);
      }
      throw error;
    }
  },
};