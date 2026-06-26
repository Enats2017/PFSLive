import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { LocationData } from './locationService';
import { API_CONFIG } from '../constants/config';

const QUEUE_STORAGE_KEY = '@PFSLive:locationQueue';
const MAX_QUEUE_SIZE = 500;

// ✅ Exported so HomeScreen can subscribe to queue count changes via AsyncStorage.
export const QUEUE_COUNT_KEY = '@PFSLive:locationQueueCount';

// ✅ Queue-insert throttle. Read by addToQueue to space queued fixes at the
// interval rate. Must match the key gpsService uses elsewhere for cleanup.
const LAST_QUEUED_KEY = '@PFSLive:lastQueuedAt';
// gpsService writes the active tracking params (incl. intervalSeconds + the
// finish-approach flag) — addToQueue reads them to know the interval to throttle
// at. Kept as string literals here to avoid importing gpsService (circular dep).
const TRACKING_PARAMS_KEY = '@PFSLive:trackingParams';
const FINISH_APPROACH_KEY = '@PFSLive:finishApproach';
const FINISH_APPROACH_INTERVAL_SEC = 5;
const DEFAULT_INTERVAL_SEC = 30;

export interface QueuedLocation extends LocationData {
  participantId: string;
  eventId: string;
  queuedAt: string;
  retryCount: number;
}

// Resolve the interval (seconds) the offline queue should grow at. Mirrors
// gpsService's effectiveInterval: finish-approach (5s) when active, else the
// session's configured interval, else 30s.
const _resolveQueueIntervalSec = async (): Promise<number> => {
  try {
    if ((await AsyncStorage.getItem(FINISH_APPROACH_KEY)) === '1') {
      return FINISH_APPROACH_INTERVAL_SEC;
    }
    const paramsJson = await AsyncStorage.getItem(TRACKING_PARAMS_KEY);
    if (paramsJson) {
      const { intervalSeconds } = JSON.parse(paramsJson);
      const n = Number(intervalSeconds);
      if (!isNaN(n) && n > 0) return n;
    }
  } catch { /* silent */ }
  return DEFAULT_INTERVAL_SEC;
};

export const locationQueueService = {
  async hasNetwork(): Promise<boolean> {
    try {
      // NetInfo.fetch() runs an active reachability probe that can itself stall
      // for seconds in a dead-zone. Race it against a short timer so a hung probe
      // can't hold the send mutex — fall back to optimistic (attempt the send).
      const state = await Promise.race([
        NetInfo.fetch(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('NetInfo timeout')), 3000)
        ),
      ]);
      // ✅ isInternetReachable can be null on Android while still determining.
      // Treat null as true (optimistic) — better to attempt a send and fail
      // than to queue unnecessarily when connectivity is likely fine.
      return state.isConnected === true && state.isInternetReachable !== false;
    } catch (error) {
      if (API_CONFIG.DEBUG) {
        console.error('❌ Error checking network:', error);
      }
      return true; // optimistic fallback
    }
  },

  async addToQueue(location: QueuedLocation, throttle: boolean = true): Promise<void> {
    try {
      // ✅ QUEUE-INSERT THROTTLE — single chokepoint for offline-queue growth.
      //
      // The live SEND throttle (LAST_SENT_KEY in gpsService) spaces network
      // sends to the interval, but it does NOT bound what enters the queue:
      // during an outage fixes still reach the queue at the engine's raw fire
      // rate (~1 Hz while moving). At a 1-minute interval an 8-minute outage
      // then stored ~180 fixes instead of ~8, and the burst flooded the insert
      // rate-limit on reconnect. Gating HERE covers every path that grows the
      // queue — the live send-fail re-queue and any future caller — and can't be
      // bypassed. Full interval (not 0.75×): the 0.75 tolerance catches slightly-
      // EARLY live fixes so send cadence doesn't slip; the queue wants a strict
      // floor of one fix per interval so the offline backlog grows at the same
      // cadence as online sending.
      //
      // throttle=false bypasses this: the ORDER-GUARD re-queue in gpsService
      // queues the current live fix purely to keep it BEHIND the draining
      // backlog (so it can't overtake and trigger the server stale-drop /
      // false-finish). That's a correctness requirement, not outage capture, so
      // it must never be dropped — the outage-time inserts that grow the queue
      // are already throttled, which is what bounds the backlog size.
      if (throttle) {
        const now = Date.now();
        const intervalSec = await _resolveQueueIntervalSec();
        const gapMs = intervalSec * 1000;
        const lastQueuedStr = await AsyncStorage.getItem(LAST_QUEUED_KEY);
        const lastQueuedAt = lastQueuedStr ? parseInt(lastQueuedStr) : 0;
        const throttleValid = !(isNaN(lastQueuedAt) || lastQueuedAt > now);
        if (throttleValid && (now - lastQueuedAt < gapMs)) {
          if (API_CONFIG.DEBUG) {
            console.log(`⏭️ Queue-throttled — ${((now - lastQueuedAt) / 1000).toFixed(0)}s < ${intervalSec}s, fix dropped`);
          }
          return; // within the interval — drop this fix, keep queue at interval rate
        }
      }

      const queue = await this.getQueue();

      if (queue.length >= MAX_QUEUE_SIZE) {
        if (API_CONFIG.DEBUG) {
          console.warn('⚠️ Queue is full, removing oldest location');
        }
        queue.shift();
      }

      queue.push(location);
      await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
      await AsyncStorage.setItem(QUEUE_COUNT_KEY, String(queue.length));
      // ✅ Advance the throttle clock on EVERY real insert — throttled or
      // bypassed — so an order-guard insert still counts as "we just queued",
      // keeping the next throttled (outage) insert spaced correctly.
      await AsyncStorage.setItem(LAST_QUEUED_KEY, String(Date.now()));

      if (API_CONFIG.DEBUG) {
        console.log(`📦 Location queued (${queue.length} in queue)`);
      }
    } catch (error) {
      if (API_CONFIG.DEBUG) {
        console.error('❌ Error adding to queue:', error);
      }
    }
  },

  async getQueue(): Promise<QueuedLocation[]> {
    try {
      const queueData = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
      return queueData ? JSON.parse(queueData) : [];
    } catch (error) {
      if (API_CONFIG.DEBUG) {
        console.error('❌ Error getting queue:', error);
      }
      return [];
    }
  },

  async removeFromQueue(count: number): Promise<void> {
    try {
      const queue = await this.getQueue();
      queue.splice(0, count);
      await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
      await AsyncStorage.setItem(QUEUE_COUNT_KEY, String(queue.length));

      if (API_CONFIG.DEBUG) {
        console.log(`✅ Removed ${count} locations from queue (${queue.length} remaining)`);
      }
    } catch (error) {
      if (API_CONFIG.DEBUG) {
        console.error('❌ Error removing from queue:', error);
      }
    }
  },

  async clearQueue(): Promise<void> {
    try {
      await AsyncStorage.removeItem(QUEUE_STORAGE_KEY);
      await AsyncStorage.setItem(QUEUE_COUNT_KEY, '0');
      // ✅ Reset the throttle so the next outage starts clean (first fix of a
      // fresh backlog isn't throttled against a stale timestamp from before).
      await AsyncStorage.removeItem(LAST_QUEUED_KEY);

      if (API_CONFIG.DEBUG) {
        console.log('✅ Queue cleared');
      }
    } catch (error) {
      if (API_CONFIG.DEBUG) {
        console.error('❌ Error clearing queue:', error);
      }
    }
  },

  async getQueueSize(): Promise<number> {
    const queue = await this.getQueue();
    return queue.length;
  },
};