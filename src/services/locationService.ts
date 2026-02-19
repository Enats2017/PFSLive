import { apiClient } from './api';
import { API_CONFIG, buildApiUrl } from '../constants/config';
import { locationQueueService, QueuedLocation } from './locationQueueService';

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
      console.log('📶 No network, queuing location...');
      
      if (queueIfOffline) {
        const queuedLocation: QueuedLocation = {
          ...location,
          participantId,
          eventId,
          queuedAt: new Date().toISOString(),
          retryCount: 0,
        };
        await locationQueueService.addToQueue(queuedLocation);
      }

      return {
        success: false,
        message: 'Location queued (offline)',
      };
    }

    if (API_CONFIG.USE_MOCK_DATA) {
      console.log('📡 [MOCK] Sending location to API:', {
        participantId,
        eventId,
        location: {
          lat: location.latitude.toFixed(6),
          lon: location.longitude.toFixed(6),
        },
      });
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      return {
        success: true,
        message: 'Location sent successfully (mock)',
        locationId: `loc_${Date.now()}`,
      };
    }

    try {
      const url = buildApiUrl(API_CONFIG.ENDPOINTS.PARTICIPANT_LOCATION, {
        participantId: participantId
      });

      // Get headers with token from AsyncStorage
      const headers = await API_CONFIG.getHeaders();

      console.log('📡 Sending location to API:', url);

      const response = await apiClient.post<SendLocationResponse>(url, {
        eventId,
        latitude: location.latitude,
        longitude: location.longitude,
        elevation: location.elevation,
        accuracy: location.accuracy,
        timestamp: location.timestamp,
        speed: location.speed,
        heading: location.heading,
      }, { headers });

      console.log('✅ Location sent successfully');
      return response.data;
    } catch (error) {
      console.error('❌ Failed to send location:', error);

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
      console.log('📶 Still offline, skipping queue processing');
      return 0;
    }

    const queue = await locationQueueService.getQueue();

    if (queue.length === 0) {
      return 0;
    }

    console.log(`📤 Processing ${queue.length} queued locations...`);

    let sentCount = 0;
    const batchSize = 10; // Send 10 at a time to avoid overwhelming API

    // Send locations in batches
    for (let i = 0; i < Math.min(queue.length, batchSize); i++) {
      const queuedLocation = queue[i];

      try {
        await this.sendLocation(
          queuedLocation.participantId,
          queuedLocation.eventId,
          {
            latitude: queuedLocation.latitude,
            longitude: queuedLocation.longitude,
            elevation: queuedLocation.elevation,
            accuracy: queuedLocation.accuracy,
            timestamp: queuedLocation.timestamp,
            speed: queuedLocation.speed,
            heading: queuedLocation.heading,
          },
          false // Don't re-queue if it fails again
        );

        sentCount++;
      } catch (error) {
        console.error('❌ Failed to send queued location:', error);
        break; // Stop processing if one fails
      }
    }

    // Remove sent locations from queue
    if (sentCount > 0) {
      await locationQueueService.removeFromQueue(sentCount);
      console.log(`✅ Processed ${sentCount} queued locations`);
    }

    return sentCount;
  },

  /**
   * Send batch of locations
   */
  async sendLocationBatch(
    participantId: string,
    eventId: string,
    locations: LocationData[]
  ): Promise<SendLocationResponse> {
    if (API_CONFIG.USE_MOCK_DATA) {
      console.log('📡 [MOCK] Sending location batch:', locations.length);
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
};