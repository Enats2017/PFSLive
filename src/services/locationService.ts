import { apiClient } from './api';
import { API_CONFIG, getApiEndpoint } from '../constants/config';
import { locationQueueService, QueuedLocation } from './locationQueueService';
import { Platform } from 'react-native';
import { TrackingLogEntry, RACE_FINISHED_KEY } from './gpsService';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mirror of gpsService's BACKGROUND_SENT_COUNT_KEY — declared locally to avoid
// a circular import. processQueue bumps it per drained fix so the counter is
// LIVE before finishBackgroundStop reads it for the tracking-log upload.
const BACKGROUND_SENT_COUNT_KEY = '@PFSLive:bgSentCount';

// Mirror of gpsService's FINISH_LINE_THRESHOLD_KM (0.05 = 50m) — the distance
// under which a `finish_source: 'distance'` finish is believed.
const FINISH_LINE_THRESHOLD_KM = 0.05;

// How many times one queued fix may be rejected by the server before it is
// discarded to unblock everything behind it. Only counts CLIENT-side rejections
// (see the drain's catch) — transient failures never increment it.
const MAX_FIX_ATTEMPTS = 5;

// Codes from insert_participant_location_api.php that mean THIS FIX will never be
// accepted, no matter how many times it is retried. Anything NOT on this list —
// insert_failed (the DB write failed), unauthorized (token expired mid-race),
// unknown_error, a 429 rate-limit, or any code the backend adds later — is
// transient or recoverable and MUST stay queued.
//
// Allowlist, not denylist, ON PURPOSE. ApiSecurity::respondError() defaults to
// HTTP 400 and api.ts's handleError maps EVERY 4xx to type:'empty', so the app
// cannot tell "your fix is malformed" from "our database is down" — both arrive
// identically. Defaulting to discard deletes real GPS positions during a backend
// outage; defaulting to keep only risks a queue wedge that clears itself once the
// backend recovers. Keep the failure mode on the safe side.
const PERMANENT_REJECT_CODES = new Set([
  'participant_id_invalid',
  'event_id_invalid',
  'latitude_invalid',
  'latitude_out_of_range',
  'longitude_invalid',
  'longitude_out_of_range',
  'participant_not_found',
  'fix_not_object',
]);

// Absolute wall-clock timeout. axios's own `timeout` does NOT reliably fire on
// a half-open socket (cell drops mid-request, no FIN/RST) — the request can hang
// for minutes. Promise.race against a real timer guarantees the await resolves
// within `ms` no matter what the socket does, so the send/drain/mutex budgets
// downstream actually hold.
/**
 * Compact, bounded description of a send failure for the on-device log.
 * Bounded on purpose: this string ends up in every rejected-fix log line, and
 * the log is capped, so it must stay short and must never carry a server body.
 */
function _describeSendError(error: any): string {
  if (!error) return 'network error';
  const status = error?.status ?? error?.response?.status;
  const type = error?.type;               // AppError: 'network' | 'server' | 'empty'
  const code = error?.code;               // AppError code, or axios ECONNABORTED etc
  // Rate limiting is the one we most need to spot at a glance: api.ts's
  // handleError throws away the HTTP status, but the server's 429 body text
  // survives in `code`, so match on that. 617 rejections on 2026-08-23 clustered
  // across runners in the same minute and we could not tell whether they were
  // 429s — this makes that answerable from the log alone.
  const codeStr = code ? String(code) : '';
  if (/rate limit/i.test(codeStr)) return 'HTTP 429 rate limited';

  const parts: string[] = [];
  if (status) parts.push(`http ${status}`);
  if (type) parts.push(String(type));
  if (codeStr && codeStr !== String(type)) parts.push(codeStr.slice(0, 40));
  if (!parts.length) {
    const m = String(error?.message ?? '').slice(0, 60);
    parts.push(m || 'network error');
  }
  return parts.join(' ');
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}

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
  /** ✅ Finish-line coordinates (once known) — cached client-side so the
   *  background task can activate the 5s finish-approach OFFLINE. */
  finish_lat?: number | null;
  finish_lon?: number | null;
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
    queueIfOffline: boolean = true,
    isQueued: boolean = false,          // ← NEW: true when drained from the offline queue
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
        is_queued: isQueued ? 1 : 0,
      };

      if (API_CONFIG.DEBUG) {
        console.log("🚀 API REQUEST BODY:", requestBody);
        console.log("📍 participantId:", participantId);
        console.log("🏁 eventId:", eventId);
        console.log("🌍 location object:", location);
      }

      // ✅ Short timeout — don't block GPS callback on slow race-day networks.
      // axios `timeout` is the first line, but it doesn't reliably fire on a
      // half-open socket, so withTimeout() enforces a HARD ceiling (10s) that
      // always rejects — keeping the send/drain/mutex budgets honest.
      const apiResponse = await withTimeout(
        apiClient.post<StandardApiResponse>(url, requestBody, { headers, timeout: 8000 }),
        10000,
        'sendLocation'
      );

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
        finish_lat: data.finish_lat ?? null,
        finish_lon: data.finish_lon ?? null,
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
        // Carry WHY it failed into the message. Every failure class — HTTP 429
        // rate-limit, 5xx, 404, DNS, socket timeout — used to collapse into the
        // single string "Location queued (network error)", which made the
        // 2026-08-23 race undiagnosable: 617 rejections and no way to tell a
        // server rate-limit from a runner losing signal. apiClient throws
        // AppError{type, code}; withTimeout throws a plain Error.
        return {
          success: false,
          message: `Location queued (${_describeSendError(error)})`,
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
    let alreadyRemoved = false; // set when the finish-during-drain path removes early
    let finishDetected = false; // finish seen mid-drain — teardown deferred until the backlog is empty
    // 50 (was 10): a multi-minute outage buffers >10 fixes; draining only 10 per
    // call let the live fix overtake the rest, which the server then stale-dropped.
    const batchSize = 50;

    try {
      for (let i = 0; i < Math.min(queue.length, batchSize); i++) {
        const queuedLocation = queue[i];

        try {
          const qResult = await this.sendLocation(
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
            false,
            true,          // ← this fix came from the offline queue
          );

          // ⚠️ DATA LOSS GUARD — do not remove. PREVENTATIVE, not a past fix.
          //
          // sendLocation RESOLVES with { success:false } (it does not throw) when
          // the network drops mid-drain or the API rejects the fix. Falling
          // through to sentCount++ lets removeFromQueue(sentCount) splice those
          // fixes out of the queue, so a cell dropout during a 50-fix drain could
          // delete up to 50 real positions while reporting them as sent.
          //
          // NOT observed on 2026-08-23 — that race lost nothing. An earlier
          // version of this comment cited a session with total_sent=604 against 7
          // "Sent OK" lines as proof. That was a misreading: drained fixes log once
          // per BATCH ("Drained N queued fix(es)"), not per fix, and the on-device
          // log is capped, so "Sent OK" can never be expected to match the counter.
          // The real evidence says the opposite — every one of the 149 sessions
          // ended with total_queued = 0, and the server accepted MORE fixes (27,822)
          // than the clients counted as sent (24,728 once duplicate uploads are
          // collapsed). The hazard below is real in code; it simply never fired.
          //
          // break, not continue: removeFromQueue() splices from the HEAD by count,
          // so the drained prefix must stay contiguous. Stopping here leaves this
          // fix and everything behind it in the queue for the next pass.
          if (!qResult || qResult.success !== true) {
            try {
              const { addLog } = require('./gpsService');
              await addLog('🔴', `Drain halted — fix not accepted (${qResult?.message ?? 'unknown'}); ${sentCount} sent, rest kept queued`);
            } catch { /* silent */ }
            break;
          }

          sentCount++;

          // ✅ Keep the cumulative session counter live AS WE DRAIN. finishBackgroundStop
          // (below, once the queue empties) reads BACKGROUND_SENT_COUNT_KEY for the log
          // upload — bumping it only in the callers after return meant the finish log
          // carried the pre-drain value (2 instead of 12).
          try {
            const _cStr = await AsyncStorage.getItem(BACKGROUND_SENT_COUNT_KEY);
            const _c = _cStr ? (parseInt(_cStr) || 0) : 0;
            await AsyncStorage.setItem(BACKGROUND_SENT_COUNT_KEY, String(_c + 1));
          } catch { /* silent */ }

          // ✅ FINISH-DURING-DRAIN — full background teardown.
          // A finish can cross while we're draining the offline backlog (runner
          // crossed the line with no signal; the queue flushes on reconnect in a
          // background Transistor wake). The live-path auto-stop in
          // processLocationForSend never sees this, and if the runner stopped at
          // the line no live fix will come to trigger it — so we must do the WHOLE
          // stop here, in the background, without waiting for foreground:
          //   1. set RACE_FINISHED_KEY  (so HomeScreen's poll is a no-op-safe
          //      second stop if/when it ever foregrounds, and the watchdog won't
          //      resurrect the engine),
          //   2. remove the fixes we've drained so far from the queue (BEFORE
          //      teardown — _doFullStop doesn't touch the queue, and we're about
          //      to break),
          //   3. upload the tracking log from the background (finishBackgroundStop),
          //   4. tear down the engine + listeners.
          // The finish may NOT land on the fix you'd expect (the server's
          // MIN_FIXES_FOR_FINISH guard can hold it to a later backlog fix), so we
          // check EVERY drained fix. Idempotent: if the foreground stop later runs,
          // LOG_UPLOADED_KEY prevents a double upload and _doFullStop is safe twice.
          // ✅ Same authority split as the live path (gpsService's shouldStop):
          // 'rr' is definitive and needs no GPS corroboration — that is exactly
          // the 4.5h-outage case described below, where RaceResult had already
          // recorded the finish. A 'distance' finish is only the server's read of
          // the GPS, so require the server to also say the runner is ON the line
          // (≤50m) and past the opening fixes. Before this, ANY finished=1 on any
          // drained fix tore the session down irreversibly with nothing to veto it.
          //
          // Deliberately NOT checking gpsService's nearFinish latch here, unlike
          // the live path: that latch tracks where the runner is NOW, while these
          // fixes are a replay of where they WERE. A runner who went offline at
          // km 10 and crossed the line offline never had a live ≤1km fix to set
          // it, so requiring it would veto exactly the finish this drain exists
          // to catch. sentCount is safe to use — the drain bumps it itself above.
          let qFinished = qResult && (qResult.finished === 1 || (qResult.finished as any) === '1');
          if (qFinished && (qResult!.finish_source ?? 'distance') !== 'rr') {
            const qDtf = qResult!.distance_to_finish_km ?? null;
            let qSent = 0;
            try {
              qSent = parseInt((await AsyncStorage.getItem(BACKGROUND_SENT_COUNT_KEY)) || '0', 10) || 0;
            } catch { /* silent — a storage failure must not fabricate a finish */ }
            if (!(qDtf !== null && qDtf <= FINISH_LINE_THRESHOLD_KM && qSent >= 3)) {
              if (API_CONFIG.DEBUG) {
                console.log(`⏭️ Drained fix reported finished=1 (source=distance) but failed the GPS guards — dtf=${qDtf}, sent=${qSent} — not finishing`);
              }
              qFinished = false;
            }
          }

          if (qFinished) {
            // ⚠️ DO NOT tear down or clear the queue here while a backlog remains.
            //
            // The fixes still queued are NOT "post-finish stragglers". On a long
            // outage they are the runner's ENTIRE RACE — recorded BEFORE the finish
            // and still waiting to upload. Tearing down + clearQueue() at this point
            // DELETED hours of real data: a runner with no signal for 4.5h had his
            // whole track wiped 3 seconds after reconnecting, because RaceResult had
            // already recorded his finish, so the very FIRST drained fix came back
            // finished=1 and everything behind it was thrown away.
            //
            // So: remember the finish and KEEP DRAINING. Teardown happens after the
            // loop, only once the queue is actually empty.
            if (API_CONFIG.DEBUG) console.log('🏆 Finish detected during drain — finishing only AFTER the backlog drains');
            finishDetected = true;
            // RACE_FINISHED_KEY is deliberately NOT set here — setting it now makes
            // the gpsService drain loop break out and the watchdog treat the session
            // as over while fixes are still pending. It's set at teardown below.
          }
        } catch (error: any) {
          if (API_CONFIG.DEBUG) {
            console.error('❌ Failed to send queued location');
          }

          // QUEUE WEDGE GUARD.
          //
          // A fix the server rejects OUTRIGHT throws on every pass, so it stayed
          // at the head of the queue and blocked every fix behind it for the rest
          // of the race — 101 of 149 sessions logged "Drain stalled" on
          // 2026-08-23. retryCount already existed on QueuedLocation but was
          // never incremented or read.
          //
          // Only a fix the backend will NEVER accept is discarded, and only when
          // its code is on the PERMANENT_REJECT_CODES allowlist above.
          //
          // This used to be a denylist — "discard anything type:'empty' that does
          // not look rate-limited" — which was backwards. respondError() defaults
          // to HTTP 400 and handleError maps every 4xx to 'empty', so insert_failed
          // (the DB INSERT failed) and unauthorized (token expired mid-race) both
          // landed as 'empty' and were deleted after MAX_FIX_ATTEMPTS. At the 10s
          // drain interval that is one real position destroyed every ~50s for the
          // rest of the race, from conditions that resolve on their own.
          //
          // A network drop ('network'), a 5xx ('server'), a 429 rate-limit and every
          // unrecognised code now break and retry instead.
          const codeStr = String(error?.code ?? '').toLowerCase();   // handleError already lowercases
          const permanentReject =
            error?.type === 'empty' && PERMANENT_REJECT_CODES.has(codeStr);

          if (permanentReject) {
            const attempts = await locationQueueService.bumpHeadRetry();
            if (attempts >= MAX_FIX_ATTEMPTS) {
              try {
                const { addLog } = require('./gpsService');
                await addLog('🗑️', `Fix rejected ${attempts}× (${codeStr.slice(0, 40)}) — discarded to unblock the queue`);
              } catch { /* silent */ }
              // Drop the sent prefix AND the one poison fix behind it.
              await locationQueueService.removeFromQueue(sentCount + 1);
              alreadyRemoved = true;
            }
          }
          break;
        }
      }

      if (sentCount > 0 && !alreadyRemoved) {
        await locationQueueService.removeFromQueue(sentCount);
        if (API_CONFIG.DEBUG) {
          console.log(`✅ Processed ${sentCount} queued locations`);
        }
      }

      // Finish was seen mid-drain: only tear down once the backlog is fully sent.
      // If fixes remain, leave the session alive so the next drain pass (the next
      // onLocation, or the 10s queue processor) keeps flushing them — we finish on
      // whichever pass finally empties the queue. This is what preserves a long
      // offline backlog instead of discarding it at the finish.
      if (finishDetected) {
        const remaining = await locationQueueService.getQueueSize();
        if (remaining === 0) {
          try { await AsyncStorage.setItem(RACE_FINISHED_KEY, '1'); } catch { /* silent */ }
          try {
            const { finishBackgroundStop } = require('./gpsService');
            await finishBackgroundStop(participantId, eventId);
          } catch { /* silent */ }
        } else if (API_CONFIG.DEBUG) {
          console.log(`🏆 Finish pending — ${remaining} fixes still queued, keeping session alive to drain them`);
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
    // Returns TRUE only on a confirmed save. It used to return void and swallow
    // every failure, so callers set their "already uploaded" flag even when the
    // upload had failed — the documented retry could never happen and the log was
    // lost. Still never throws: a log-upload failure must not block stop-tracking.
  ): Promise<boolean> {
    try {
      const url     = getApiEndpoint(API_CONFIG.ENDPOINTS.SAVE_TRACKING_LOG);
      const headers = await API_CONFIG.getHeaders();
      await withTimeout(
        apiClient.post(url, {
          participantId,
          eventId,
          logs,
          totalSent,
          totalQueued,
          deviceInfo: `${Platform.OS} ${Platform.Version}`,
        }, { headers, timeout: 10000 }),
        12000,
        'saveTrackingLog'
      );
      if (API_CONFIG.DEBUG) console.log('✅ Tracking log saved to server');
      return true;
    } catch (err: any) {
      if (API_CONFIG.DEBUG) console.log('⚠️ Tracking log save failed (non-fatal):', err?.message);
      // Silent — log upload failure must not block stop tracking, but the caller
      // needs to know so it can release its claim and let the other path retry.
      return false;
    }
  },

  // ✅ Lightweight liveness ping from the background heartbeat. Confirms
  // SERVER-SIDE that the iOS background heartbeat is still firing across a long
  // pocketed run — the device log can't be trusted for that (a suspended context
  // stops writing). Sends NO coordinate and never touches the queue/mutex; it
  // only stamps "this device's heartbeat is alive at T" so a frozen marker can be
  // told apart from a dead heartbeat. Fire-and-forget, hard-timeout-bounded.
  async sendHeartbeatPing(participantId: string, eventId: string): Promise<void> {
    try {
      const url     = getApiEndpoint(API_CONFIG.ENDPOINTS.HEARTBEAT_PING);
      const headers = await API_CONFIG.getHeaders();
      await withTimeout(
        apiClient.post(url, {
          participantId,
          eventId,
          ts: new Date().toISOString(),
          deviceInfo: `${Platform.OS} ${Platform.Version}`,
        }, { headers, timeout: 8000 }),
        10000,
        'heartbeatPing'
      );
    } catch {
      // Silent — a missed ping must never affect tracking.
    }
  }
};