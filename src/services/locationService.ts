import { apiClient } from './api';
import { API_CONFIG, getApiEndpoint } from '../constants/config';
import { locationQueueService, QueuedLocation } from './locationQueueService';

export interface LocationData {
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy?: number;
  altitudeAccuracy?: number;
  timestamp: string;
  speed?: number;
  heading?: number;
  speedAccuracy?: number;
  isMock?: boolean;
  elevation?: number;
}

export interface SendLocationResponse {
  success: boolean;
  message: string;
  locationId?: string;
}

// Standard backend response format
interface StandardApiResponse<T = any> {
  success: boolean;
  data: T;
  error: string | null;
}

export const locationService = {
  /**
   * Send location to API (with network check and queuing)
   */
  async sendLocation(
    participantId: string,
    eventId: string,
    location: LocationData,
    queueIfOffline: boolean = true
  ): Promise<SendLocationResponse> {
    // Check network connection
    const hasNetwork = await locationQueueService.hasNetwork();

    if (!hasNetwork) {
      if (queueIfOffline) {
        const queuedLocation: QueuedLocation = {
          ...location,
          participantId,
          eventId,
          queuedAt: new Date().toISOString(),
          retryCount: 0,
        };
        await locationQueueService.addToQueue(queuedLocation);
        if (API_CONFIG.DEBUG) console.log('📦 Location queued (offline)');
      }

      return {
        success: false,
        message: 'Location queued (offline)',
      };
    }

    if (API_CONFIG.USE_MOCK_DATA) {
      if (API_CONFIG.DEBUG) console.log('🎭 [MOCK] Location sent');
      
      return {
        success: true,
        message: 'Location sent successfully (mock)',
        locationId: `loc_${Date.now()}`,
      };
    }

    try {
      const url = getApiEndpoint(API_CONFIG.ENDPOINTS.PARTICIPANT_LOCATION);
      const headers = await API_CONFIG.getHeaders();

      const requestBody = {
        participantId,
        eventId,
        latitude: location.latitude,
        longitude: location.longitude,
        altitude: location.altitude,
        accuracy: location.accuracy,
        altitude_accuracy: location.altitudeAccuracy,
        timestamp: location.timestamp,
        speed: location.speed,
        heading: location.heading,
        speed_accuracy: location.speedAccuracy,
        is_mock: location.isMock || false,
      };

      const apiResponse = await apiClient.post<StandardApiResponse>(url, requestBody, { headers });

      // Extract from standard backend response format
      const success = apiResponse.success === true;
      const data = apiResponse.data || {};
      const error = apiResponse.error;

      // Normalize response
      const normalizedResponse: SendLocationResponse = {
        success: success,
        message: success 
          ? 'Location saved successfully' 
          : (error || 'Failed to save location'),
        locationId: data.coordinate_id || data.locationId,
      };

      if (API_CONFIG.DEBUG) {
        if (normalizedResponse.success) {
          console.log('✅ Location sent, ID:', normalizedResponse.locationId);
        } else {
          console.log('⚠️ Location failed:', error);
        }
      }

      return normalizedResponse;
    } catch (error: any) {
      if (API_CONFIG.DEBUG) {
        console.error('❌ Failed to send location:', error.message);
      }

      // Queue if failed and queuing is enabled
      if (queueIfOffline) {
        const queuedLocation: QueuedLocation = {
          ...location,
          participantId,
          eventId,
          queuedAt: new Date().toISOString(),
          retryCount: 0,
        };
        await locationQueueService.addToQueue(queuedLocation);
        if (API_CONFIG.DEBUG) console.log('📦 Location queued (error)');
      }

      throw error;
    }
  },

  /**
   * Process queued locations (send when network is back)
   */
  async processQueue(participantId: string, eventId: string): Promise<number> {
    const hasNetwork = await locationQueueService.hasNetwork();

    if (!hasNetwork) {
      return 0;
    }

    const queue = await locationQueueService.getQueue();

    if (queue.length === 0) {
      return 0;
    }

    if (API_CONFIG.DEBUG) {
      console.log(`📤 Processing ${queue.length} queued locations...`);
    }

    let sentCount = 0;
    const batchSize = 10;

    for (let i = 0; i < Math.min(queue.length, batchSize); i++) {
      const queuedLocation = queue[i];

      try {
        await this.sendLocation(
          queuedLocation.participantId,
          queuedLocation.eventId,
          {
            latitude: queuedLocation.latitude,
            longitude: queuedLocation.longitude,
            altitude: queuedLocation.altitude || queuedLocation.elevation, // ✅ FIX
            accuracy: queuedLocation.accuracy,
            timestamp: queuedLocation.timestamp,
            speed: queuedLocation.speed,
            heading: queuedLocation.heading,
          },
          false
        );

        sentCount++;
      } catch (error) {
        if (API_CONFIG.DEBUG) {
          console.error('❌ Failed to send queued location');
        }
        break;
      }
    }

    if (sentCount > 0) {
      await locationQueueService.removeFromQueue(sentCount);
      if (API_CONFIG.DEBUG) {
        console.log(`✅ Processed ${sentCount} queued locations`);
      }
    }

    return sentCount;
  },
};