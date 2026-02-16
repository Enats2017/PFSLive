import { apiClient } from './api';
import { API_CONFIG } from '../constants/config';

export interface LocationData {
  latitude: number;
  longitude: number;
  elevation?: number;
  accuracy?: number;
  timestamp: string;
  speed?: number;
  heading?: number;
}

export interface SendLocationResponse {
  success: boolean;
  message: string;
  locationId?: string;
}

export const locationService = {
  /**
   * Send participant location to API
   */
  async sendLocation(
    participantId: string,
    eventId: string,
    location: LocationData
  ): Promise<SendLocationResponse> {
    if (API_CONFIG.USE_MOCK_DATA) {
      console.log('📡 [MOCK] Sending location to API:', {
        participantId,
        eventId,
        location: {
          lat: location.latitude.toFixed(6),
          lon: location.longitude.toFixed(6),
          elevation: location.elevation,
          accuracy: location.accuracy,
          speed: location.speed,
          timestamp: location.timestamp,
        },
      });
      
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Mock successful response
      return {
        success: true,
        message: 'Location sent successfully (mock)',
        locationId: `loc_${Date.now()}`,
      };
    }

    try {
      // Build the API endpoint URL
      const url = API_CONFIG.ENDPOINTS.PARTICIPANT_LOCATION
        .replace(':participantId', participantId);

      console.log('📡 Sending location to API:', url);

      // Send location data to API
      const response = await apiClient.post<SendLocationResponse>(url, {
        eventId,
        latitude: location.latitude,
        longitude: location.longitude,
        elevation: location.elevation,
        accuracy: location.accuracy,
        timestamp: location.timestamp,
        speed: location.speed,
        heading: location.heading,
      });

      console.log('✅ Location sent successfully:', response);
      return response.data;
    } catch (error) {
      console.error('❌ Failed to send location:', error);
      throw error;
    }
  },

  /**
   * Send batch of locations (for offline sync)
   */
  async sendLocationBatch(
    participantId: string,
    eventId: string,
    locations: LocationData[]
  ): Promise<SendLocationResponse> {
    if (API_CONFIG.USE_MOCK_DATA) {
      console.log('📡 [MOCK] Sending location batch to API:', {
        participantId,
        eventId,
        count: locations.length,
      });
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      return {
        success: true,
        message: `Batch of ${locations.length} locations sent successfully (mock)`,
      };
    }

    try {
      const url = `${API_CONFIG.ENDPOINTS.PARTICIPANT_LOCATION.replace(':participantId', participantId)}/batch`;

      const response = await apiClient.post<SendLocationResponse>(url, {
        eventId,
        locations,
      });

      console.log('✅ Location batch sent successfully');
      return response.data;
    } catch (error) {
      console.error('❌ Failed to send location batch:', error);
      throw error;
    }
  },

  /**
   * Start continuous location tracking (polling/interval based)
   * This is a fallback method - prefer using GPS watch
   */
  startLocationTracking(
    participantId: string,
    eventId: string,
    getLocation: () => LocationData,
    interval: number = 5000 // 5 seconds default
  ): () => void {
    console.log('🔄 Starting interval-based location tracking for participant:', participantId);

    const trackingInterval = setInterval(async () => {
      try {
        const location = getLocation();
        await this.sendLocation(participantId, eventId, location);
        console.log('📍 Location update sent via interval');
      } catch (error) {
        console.error('❌ Location tracking error:', error);
      }
    }, interval);

    // Return cleanup function
    return () => {
      console.log('⏹️ Stopping interval-based location tracking');
      clearInterval(trackingInterval);
    };
  },
};