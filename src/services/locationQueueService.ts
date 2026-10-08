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

// ✅ Leftover ("orphan") fixes — queued fixes that outlived their session.
//
// A manual Stop drains what it can, but anything still queued after that sat in
// QUEUE_STORAGE_KEY with nothing left to send it, and the next fresh Start then
// wiped it. 2026-09-05 → 10-04: 540 real fixes lost this way across 4 runners
// (p1652, p1896, p2425, p2699 — 61 to 173 each, tracks ending 5-15 km early).
// Fixes are parked here instead and sent by locationService.drainOrphans() when
// no session is live, each with its OWN participantId/eventId and is_queued=1.
const ORPHAN_STORAGE_KEY = '@PFSLive:orphanQueue';
const MAX_ORPHANS = 2000;
// The server trusts a queued fix's timestamp for up to 48h, then clamps it to
// "now" — which would plant a stale position at the wrong time. Drop before that.
export const ORPHAN_MAX_AGE_MS = 47 * 60 * 60 * 1000;

// ✅ "Offline" probe state (module-level: one JS context = one engine).
//
// isInternetReachable comes from NetInfo's own HTTP probe, which can stick at
// false — notably while backgrounded. Treating that as gospel meant the app never
// even TRIED the API: on 2026-10-04 p2595 logged "Offline (no network)" from
// 10:06 to ~12:40 and p2664's entire 3.5h race arrived in one burst at 13:35,
// while ~200 runners around them sent normally. So "unreachable" (with the radio
// still connected) now allows a real attempt every PROBE_EVERY_MS, and a real
// send success overrides NetInfo for TRUST_AFTER_SUCCESS_MS. A truly dead network
// costs one timed-out request per 30s, and gpsService's wedge guard (2 dry drains
// → 60s cooldown) still caps the waste.
const PROBE_EVERY_MS = 30000;
const PROBE_WINDOW_MS = 15000;          // a probe covers the drain's several hasNetwork() calls
const TRUST_AFTER_SUCCESS_MS = 60000;
let _probeWindowUntil = 0;
let _lastProbeOpenedAt = 0;
let _trustedOnlineUntil = 0;

export const locationQueueService = {
  /** Called by locationService after the API ACCEPTED a fix — proof of network. */
  markSendSucceeded(): void {
    _trustedOnlineUntil = Date.now() + TRUST_AFTER_SUCCESS_MS;
  },

  async hasNetwork(): Promise<boolean> {
    try {
      const now = Date.now();

      // NetInfo.fetch() runs an active reachability probe that can itself stall
      // for seconds in a dead-zone. Race it against a short timer so a hung probe
      // can't hold the send mutex — fall back to optimistic (attempt the send).
      const state = await Promise.race([
        NetInfo.fetch(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('NetInfo timeout')), 3000)
        ),
      ]);
      // No radio link at all (airplane mode, no signal) — that one is reliable.
      if (state.isConnected === false) return false;

      // A real request just went through — believe that over NetInfo's
      // reachability guess (but never over "no radio" above).
      if (now < _trustedOnlineUntil) return true;

      // ✅ isInternetReachable can be null on Android while still determining.
      // Treat null as true (optimistic) — better to attempt a send and fail
      // than to queue unnecessarily when connectivity is likely fine.
      if (state.isInternetReachable !== false) return true;

      // Connected but NetInfo says "unreachable": allow a periodic real attempt.
      if (now < _probeWindowUntil) return true;
      if (now - _lastProbeOpenedAt >= PROBE_EVERY_MS) {
        _lastProbeOpenedAt = now;
        _probeWindowUntil = now + PROBE_WINDOW_MS;
        try {
          const { addLog } = require('./gpsService');
          await addLog('🔎', 'NetInfo says unreachable — trying the API anyway (probe)');
        } catch { /* silent */ }
        return true;
      }
      return false;
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
        // Match gpsService's send gate (0.75 × interval). Using the FULL interval
        // here meant a fix that legitimately passed the 45s send throttle was then
        // dropped by a 60s queue gate, pushing the next capture out to ~90s. Same
        // factor on both gates → consistent ~interval spacing offline and online.
        const gapMs = Math.round(intervalSec * 0.75) * 1000;
        const lastQueuedStr = await AsyncStorage.getItem(LAST_QUEUED_KEY);
        const lastQueuedAt = lastQueuedStr ? parseInt(lastQueuedStr) : 0;
        const throttleValid = !(isNaN(lastQueuedAt) || lastQueuedAt > now);
        if (throttleValid && (now - lastQueuedAt < gapMs)) {
          // On-device panel, not console: this is where offline fixes are lost,
          // and console.log doesn't exist in a production build.
          try {
            const { addLog } = require('./gpsService');
            await addLog('⏭️', `Queue-throttled — ${((now - lastQueuedAt) / 1000).toFixed(0)}s < ${intervalSec}s, fix dropped`);
          } catch { /* silent */ }
          return; // within the interval — drop this fix, keep queue at interval rate
        }
      }

      const queue = await this.getQueue();

      if (queue.length >= MAX_QUEUE_SIZE) {
        if (API_CONFIG.DEBUG) {
          console.warn('⚠️ Queue is full, removing oldest location');
        }
        // Overflow DELETES the runner's oldest unsent fix. The console.warn above
        // is DEBUG-gated and Metro strips console.* from release builds, so in a
        // real race this happened with no trace whatsoever. At the 30s interval
        // the 500-slot buffer is ~4h; at the 5s finish-approach interval it is
        // only ~42 minutes, so this is reachable on a long outage near the line.
        try {
          const { addLog } = require('./gpsService');
          await addLog('🗑️', `Queue FULL (${MAX_QUEUE_SIZE}) — oldest fix discarded to make room`);
        } catch { /* silent */ }
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
      // A failed insert means a fix is LOST — silently, until now. console.error
      // doesn't exist in a production build, so this went to the on-device panel
      // instead: an AsyncStorage write failure during an outage is exactly the
      // kind of thing that leaves a backlog smaller than it should be.
      try {
        const { addLog } = require('./gpsService');
        await addLog('⚠️', `Queue insert FAILED — fix lost: ${String((error as any)?.message ?? error).slice(0, 80)}`);
      } catch { /* silent */ }
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

  /**
   * Increment retryCount on the fix at the HEAD of the queue and return the new
   * value. Returns 0 if the queue is empty.
   *
   * QueuedLocation.retryCount has existed since the beginning but was written as
   * 0 and never read or incremented, so a fix the server permanently rejects sat
   * at the head and blocked everything behind it for the rest of the race —
   * 101 of 149 sessions logged "Drain stalled" on 2026-08-23. The drain uses
   * this to give a rejected fix a bounded number of attempts before discarding
   * just that one fix.
   */
  async bumpHeadRetry(): Promise<number> {
    try {
      const queue = await this.getQueue();
      if (queue.length === 0) return 0;
      const next = (Number(queue[0].retryCount) || 0) + 1;
      queue[0] = { ...queue[0], retryCount: next };
      await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
      return next;
    } catch {
      return 0;
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

  // ── Orphans (see ORPHAN_STORAGE_KEY) ───────────────────────────────────

  async getOrphans(): Promise<QueuedLocation[]> {
    try {
      const raw = await AsyncStorage.getItem(ORPHAN_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  async setOrphans(list: QueuedLocation[]): Promise<void> {
    try {
      if (list.length === 0) await AsyncStorage.removeItem(ORPHAN_STORAGE_KEY);
      else await AsyncStorage.setItem(ORPHAN_STORAGE_KEY, JSON.stringify(list));
    } catch { /* silent */ }
  },

  /**
   * Fresh-start split: fixes belonging to the session being started stay in the
   * live queue (they are older than anything the new session will send, so the
   * order guard drains them first, in order); fixes from any OTHER
   * participant/event are parked as orphans. Replaces the old fresh-start
   * clearQueue(), which deleted both. Returns how many were parked.
   */
  async parkOtherSessions(participantId: string, eventId: string): Promise<number> {
    try {
      const isMine = (f: QueuedLocation) =>
        String(f.participantId) === String(participantId) && String(f.eventId) === String(eventId);
      const queue = await this.getQueue();
      const orphans = await this.getOrphans();
      // Orphans of THIS session (a Stop, then Start again on the same race) come
      // back into the live queue so they drain BEFORE any new live fix.
      const myOrphans = orphans.filter(isMine);
      if (queue.length === 0 && myOrphans.length === 0) {
        await this.clearQueue();   // keeps the old "reset throttle on fresh start"
        return 0;
      }
      const mine = queue.filter(isMine).concat(myOrphans);
      mine.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      const others = queue.filter((f) => !isMine(f));
      await this.setOrphans(orphans.filter((f) => !isMine(f)).concat(others).slice(-MAX_ORPHANS));
      const kept = mine.slice(-MAX_QUEUE_SIZE);
      await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(kept));
      await AsyncStorage.setItem(QUEUE_COUNT_KEY, String(kept.length));
      return others.length;
    } catch {
      return 0;
    }
  },

  /**
   * Move every fix in the live queue onto the orphan list, then clear the live
   * queue (which also resets the throttle keys). Oldest orphans are dropped
   * first if the list would exceed MAX_ORPHANS. Returns how many were parked.
   */
  async parkQueueAsOrphans(): Promise<number> {
    try {
      const queue = await this.getQueue();
      if (queue.length > 0) {
        const merged = (await this.getOrphans()).concat(queue);
        await this.setOrphans(merged.slice(-MAX_ORPHANS));
        try {
          const { addLog } = require('./gpsService');
          await addLog('📦', `Parked ${queue.length} unsent fix(es) from the previous session — they will upload later`);
        } catch { /* silent */ }
      }
      await this.clearQueue();
      return queue.length;
    } catch {
      return 0;
    }
  },
};