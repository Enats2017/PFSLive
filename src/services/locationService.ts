import { apiClient } from './api';
import { API_CONFIG, getApiEndpoint } from '../constants/config';
import { locationQueueService, QueuedLocation } from './locationQueueService';
import { Platform } from 'react-native';
import { TrackingLogEntry } from './gpsService';

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
  elevationGain?: number;
  batteryLevel?: number;
  batteryCharging?: boolean;
  isMoving?: boolean;
}

export interface SendLocationResponse {
  success: boolean;
  message: string;
  locationId?: string;
  /** Route km remaining to next checkpoint. */
  distance_to_next_cp?: number | null;
  /** Route km remaining to finish line — used by background task
   *  to activate 5s finish-approach interval when ≤ 1km to finish.
   *  More reliable than distance_to_next_cp which points to any CP. */
  distance_to_finish_km?: number | null;
  /** ✅ Finished flag (1/0) from the API. Background task uses this
   *  (AND-ed with the local distance / sentCount / nearFinish guards) to
   *  auto-stop tracking. Partner+RR: finish timing mat crossed.
   *  Custom / non-RR: server saw distance_to_finish_km ≤ 50m. */
  finished?: number;
  /** ✅ How `finished` was determined:
   *   'rr'       → RR recorded the finish crossing (authoritative — trust
   *                finished=1 alone, GPS distance can lag).
   *   'distance' → derived from distance_to_finish_km ≤ 50m (apply GPS guards). */
  finish_source?: 'rr' | 'distance';
}

// Standard backend response format
interface StandardApiResponse<T = any> {
  success: boolean;
  data: T;
  error: string | null;
}

// ✅ Mutex — prevents concurrent processQueue() calls from sending duplicates.
// Race condition confirmed in client ride data (2026-05-27):
//   ids 693/695, 696/697 etc — same coord sent twice, same recorded_at second.
// Cause: AppState listener (app foregrounded) AND 10s interval timer BOTH
// call processQueue() simultaneously when network recovers after a gap.
// Without this lock each queued item is read by both calls → double send.
// Module-level so it persists across all calls within the same JS context.
let _isProcessingQueue = false;

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
        elevation_gain: location.elevationGain,
        battery_level: location.batteryLevel,
        battery_charging: location.batteryCharging,
        is_moving: location.isMoving,
      };

      if (API_CONFIG.DEBUG) {
        console.log("🚀 API REQUEST BODY:", requestBody);
        console.log("📍 participantId:", participantId);
        console.log("🏁 eventId:", eventId);
        console.log("🌍 location object:", location);
      }

      // ✅ Short timeout — don't block GPS callback on slow race-day networks
      const apiResponse = await apiClient.post<StandardApiResponse>(url, requestBody, { headers, timeout: 8000 });

      if (API_CONFIG.DEBUG) console.log("📥 API RAW RESPONSE:", apiResponse);

      // Extract from standard backend response format
      const success = apiResponse.success === true;
      const data: any = apiResponse.data || {};
      const error = apiResponse.error;

      // Normalize response
      const normalizedResponse: SendLocationResponse = {
        success: success,
        message: success
          ? 'Location saved successfully'
          : (error || 'Failed to save location'),
        locationId: data.coordinate_id || data.locationId,
        // ✅ Pass through finish-line distances so the background task can
        // detect finish-line proximity and switch to 5s interval.
        // distance_to_finish_km is preferred — it targets the finish specifically.
        // distance_to_next_cp is kept as legacy / fallback.
        distance_to_next_cp: data.distance_to_next_cp ?? null,
        distance_to_finish_km: data.distance_to_finish_km ?? null,
        // ✅ Pass through finished flag (1/0) so the background task can auto-stop.
        // Coerce to number; default 0 when absent so the gpsService AND-condition
        // (serverFinished === 1) simply stays false on older API responses.
        finished: Number(data.finished ?? 0),
        // ✅ Finish authority — tells the background task whether to trust `finished`
        // alone ('rr') or apply its GPS guards ('distance'). Default 'distance' when
        // absent (older API) so guards are applied conservatively.
        finish_source: (data.finish_source === 'rr') ? 'rr' : 'distance',
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

      // ✅ Queue if failed and queuing is enabled.
      // Do NOT re-throw after queuing — location is safely stored in queue,
      // and re-throwing crashes the background task causing Android to apply
      // exponential backoff and stop scheduling it entirely.
      // Only re-throw when queueIfOffline=false (processQueue calls) so the
      // caller can break its retry loop correctly.
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
        return {
          success: false,
          message: 'Location queued (network error)',
        };
      }

      throw error;  // only re-throw when not queuing (processQueue path)
    }
  },

  /**
   * Process queued locations (send when network is back).
   *
   * ✅ MUTEX PROTECTED — only one processQueue() runs at a time.
   * Called concurrently from:
   *   1. AppState listener — when app returns to foreground
   *   2. 10s interval timer — queueProcessorRef in HomeScreen
   *   3. stopGPSTracking() — drain on session end
   * Without the mutex, all three can overlap on network recovery,
   * reading the same queue snapshot and sending each item 2-3 times.
   */
  async processQueue(participantId: string, eventId: string): Promise<number> {
    // ✅ Mutex check — bail immediately if another call is in progress.
    // Use _isProcessingQueue flag at module level so it persists across
    // all callers within the same JS context.
    if (_isProcessingQueue) {
      if (API_CONFIG.DEBUG) console.log('⏭️ processQueue: already running — skipping to prevent duplicates');
      return 0;
    }

    const hasNetwork = await locationQueueService.hasNetwork();
    if (!hasNetwork) return 0;

    const queue = await locationQueueService.getQueue();
    if (queue.length === 0) return 0;

    // ✅ Acquire lock AFTER early exits — no point locking if there's nothing to do
    _isProcessingQueue = true;

    if (API_CONFIG.DEBUG) {
      console.log(`📤 Processing ${queue.length} queued locations...`);
    }

    let sentCount = 0;
    const batchSize = 10;

    try {
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
              elevationGain: queuedLocation.elevationGain,
              batteryLevel: queuedLocation.batteryLevel,
              batteryCharging: queuedLocation.batteryCharging,
              isMoving: queuedLocation.isMoving,
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
    } finally {
      // ✅ Always release the lock — even if an unexpected error is thrown.
      // Without finally, a thrown error would leave _isProcessingQueue = true
      // permanently, blocking all future queue processing for the session.
      _isProcessingQueue = false;
    }

    return sentCount;
  },

  async saveTrackingLog(
    participantId: string,
    eventId: string,
    logs: TrackingLogEntry[],
    totalSent: number,
    totalQueued: number,
  ): Promise<void> {
    try {
      const url     = getApiEndpoint(API_CONFIG.ENDPOINTS.SAVE_TRACKING_LOG);
      const headers = await API_CONFIG.getHeaders();
      await apiClient.post(url, {
        participantId,
        eventId,
        logs,
        totalSent,
        totalQueued,
        deviceInfo: `${Platform.OS} ${Platform.Version}`,
      }, { headers, timeout: 10000 });
      if (API_CONFIG.DEBUG) console.log('✅ Tracking log saved to server');
    } catch (err: any) {
      if (API_CONFIG.DEBUG) console.log('⚠️ Tracking log save failed (non-fatal):', err?.message);
      // Silent — log upload failure must never block stop tracking
    }
  }
};