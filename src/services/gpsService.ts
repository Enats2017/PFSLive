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
   * Request location permissions from user
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

      // Optional: Request background permission for continuous tracking
      const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
      
      if (backgroundStatus === 'granted') {
        console.log('✅ Background location permission granted');
      } else {
        console.warn('⚠️ Background location permission denied (foreground only)');
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
        accuracy: Location.Accuracy.High,
      });

      console.log('✅ GPS position obtained:', {
        lat: location.coords.latitude.toFixed(6),
        lon: location.coords.longitude.toFixed(6),
        accuracy: location.coords.accuracy,
      });

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
   * Start watching position (continuous updates)
   */
  async startWatchingPosition(
    callback: (position: GPSPosition) => void,
    errorCallback?: (error: Error) => void
  ): Promise<{ remove: () => void }> {
    try {
      console.log('🔄 Starting GPS position watching...');

      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000, // Update every 5 seconds
          distanceInterval: 10, // Or every 10 meters
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

          console.log('📍 GPS update:', {
            lat: position.latitude.toFixed(6),
            lon: position.longitude.toFixed(6),
          });

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