import * as Location from 'expo-location';
import BackgroundGeolocation from 'react-native-background-geolocation';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import * as Battery from 'expo-battery';
import { LocationData } from './locationService';
import { API_CONFIG } from '../constants/config';
import i18n from '../i18n'; // adjust to wherever your configured i18next instance lives

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

// ✅ AsyncStorage keys.
//
// ARCHITECTURE NOTE (Option B): As of this version, ALL location work — both
// background sends AND the foreground UI display — is handled by Transistor
// (react-native-background-geolocation). The expo-location TaskManager
// background task is no longer registered, and the separate expo-location
// foreground watch (watchPositionAsync) has been removed: running two
// CLLocationManager streams into JS at once doubled the native→JS callback
// pressure that destabilised Hermes under the New Architecture. Transistor's
// onLocation now drives the HomeScreen live display directly.
//
// BACKGROUND_LOCATION_TASK is kept exported for backward compatibility with
// older app installs that may still have a registered task — calling
// Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK) on those is the
// defensive cleanup that ensures we don't leave an orphaned foreground service.
export const BACKGROUND_LOCATION_TASK = 'background-location-task';

const TRACKING_PARAMS_KEY = '@PFSLive:trackingParams';
const LAST_SENT_KEY = '@PFSLive:lastSentAt';
export const BACKGROUND_SENT_COUNT_KEY = '@PFSLive:bgSentCount';
const LAST_POSITION_KEY = '@PFSLive:lastPosition';
const LAST_ALTITUDE_KEY = '@PFSLive:lastAltitude';

// ✅ Finish-line approach: when ≤ 1km to finish, drop interval to 5s for
// accurate plotting. Stored in AsyncStorage so the engine handlers can read
// it without React state.
const FINISH_APPROACH_KEY      = '@PFSLive:finishApproach';
// ✅ Race finished flag — set when distance_to_finish_km ≤ 50m.
// Read by HomeScreen 1s timer to auto-stop tracking from React context.
export const RACE_FINISHED_KEY = '@PFSLive:raceFinished';
// ✅ Near-finish flag — set when distance_to_finish_km ≤ 1km for the first
// time. Persists across sends so auto-stop works even for fast cyclists who
// skip from 1.5km directly to 0.02km in a single 30s interval.
const NEAR_FINISH_KEY = '@PFSLive:nearFinish';
// ✅ Transistor-active flag — set after BackgroundGeolocation.start() succeeds,
// cleared on stop / start failure. Defensive: with Option B, only Transistor
// sends, but this flag still prevents any leftover expo-location task path
// (from an old app install) from sending duplicate coordinates.
const TRANSISTOR_ACTIVE_KEY = '@PFSLive:transistorActive';
// ✅ Per-session latch — set to '1' once the tracking log has been uploaded for
// this session. The background auto-stop path sets it after a successful upload;
// HomeScreen.stopGPSTracking checks it and skips re-uploading. Cleared ONLY at
// session start (not in _doFullStop), so a finish-in-background upload survives
// until the user foregrounds and stops cleanly.
export const LOG_UPLOADED_KEY = '@PFSLive:logUploaded';
// ✅ Last onLocation/onMotionChange fire timestamp. Used by the freeze
// diagnostic to distinguish a real OS freeze (Transistor not firing at all)
// from a false-positive (Transistor firing normally but every event suppressed
// by the movement filter because the participant is stopped at a light).
const LAST_LOC_FIRE_KEY = '@PFSLive:lastLocFireAt';

const LAST_QUEUED_KEY = '@PFSLive:lastQueuedAt';

const FINISH_APPROACH_INTERVAL = 5;                            // seconds
const FINISH_APPROACH_THRESHOLD = 1.0;                         // km
const FINISH_LINE_THRESHOLD_KM = 0.05;                         // 50m for auto-stop
const FINISH_APPROACH_MIN_MOVE_METRES = 1;                     // require >=1m even in finish zone

// ✅ Movement thresholds per sport category.
// Must be LESS than (min_speed × timeInterval) so the check passes at minimum walking pace.
// Walking min ~0.5 km/h → moves 4.2m in 30s → threshold must be < 4.2m → use 3m
// Running min ~6 km/h   → moves 50m in 30s  → threshold must be < 50m  → use 15m
// Cycling min ~10 km/h  → moves 83m in 30s  → threshold must be < 83m  → use 30m
const MOVEMENT_THRESHOLD: Record<number, number> = {
  64: 3,   // Walking — 3m
  59: 15,  // Running — 15m
  60: 30,  // Cycling — 30m
};
const DEFAULT_MOVEMENT_METRES = 5;

// ✅ Tracking log — written by engine handlers, read by HomeScreen 1s timer for
// live display. TRACKING_LOG_KEY holds the CURRENT (unsealed) segment; older
// entries are archived into immutable numbered segment keys so the whole ride is
// retained on disk without holding it all in memory or rewriting one giant
// value. _readFullLog() stitches segments + current back together for upload.
export const TRACKING_LOG_KEY = '@PFSLive:trackingLog';
const TRACKING_LOG_SEG_PREFIX    = '@PFSLive:trackingLogSeg:';
const TRACKING_LOG_SEG_COUNT_KEY = '@PFSLive:trackingLogSegCount';
// Entries per archived segment. When the in-memory buffer reaches this it's
// sealed to its own key (written once, never rewritten) and the buffer resets.
const LOG_SEGMENT_SIZE = 500;
// Retention ceiling: LOG_SEGMENT_SIZE * MAX_LOG_SEGMENTS entries archived
// (20 000 here ≈ a very long event). Past this the current segment becomes a
// rolling window so memory/disk stay bounded; earlier segments are kept.
const MAX_LOG_SEGMENTS = 40;

export interface TrackingLogEntry {
  ts: number;
  icon: string;
  msg: string;
}

// ✅ In-memory log buffer (source of truth).
//
// Writing the 500-entry ring buffer to AsyncStorage on EVERY onLocation /
// onMotionChange fire (and many times per send) created a storm of
// multiSet / _writeManifest calls. Under the New Architecture this surfaced
// in release/TestFlight builds as an uncatchable NSException (SIGABRT) thrown
// from the AsyncStorage TurboModule, and as Hermes heap corruption (SIGSEGV)
// while draining the microtask queue. We now mutate an in-memory array
// synchronously and flush to AsyncStorage at most once every
// LOG_FLUSH_INTERVAL_MS, so HomeScreen's live-log reader still sees recent
// entries (with up to ~2s lag) without hammering disk.
let _logBuffer: TrackingLogEntry[] = [];      // current (unsealed) segment, in memory
let _logFlushTimer: ReturnType<typeof setTimeout> | null = null;
let _logDirty = false;
let _logSegCount = 0;                           // number of sealed segments on disk
let _segCountLoaded = false;                    // synced from disk on first seal (cold-relaunch safety)
const LOG_FLUSH_INTERVAL_MS = 2000;

// Sample ~3× per send window so the throttle always has a candidate near the
// target — keeps cadence at the interval (30s/60s/4min/5min) instead of doubling.
const fixIntervalMs = (sendIntervalSec?: number): number => {
  const s = sendIntervalSec ?? 30;
  const fix = Math.round(s / 4) * 1000;
  // /4 for race intervals; on long battery-saver intervals (>90s) don't sample
  // faster than ~half the interval, so 4-5min stays battery-light.
  const floor = s > 90 ? Math.round(s / 2) * 1000 : 0;
  return Math.max(10000, floor, fix);
};

const _flushLogsNow = async (): Promise<void> => {
  if (!_logDirty) return;
  _logDirty = false;
  try {
    await AsyncStorage.setItem(TRACKING_LOG_KEY, JSON.stringify(_logBuffer));
  } catch { /* silent — log persistence must never break tracking */ }
};

const _scheduleLogFlush = (): void => {
  if (_logFlushTimer) return;
  _logFlushTimer = setTimeout(() => {
    _logFlushTimer = null;
    void _flushLogsNow();
  }, LOG_FLUSH_INTERVAL_MS);
};

// Archive the current in-memory segment to its own immutable key, then reset the
// buffer for the next segment. Written exactly once per segment and never
// rewritten, so cost stays flat no matter how long the ride runs.
const _sealCurrentSegment = async (): Promise<void> => {
  if (_logBuffer.length === 0) return;

  // Cold-relaunch safety: if the OS killed us mid-ride and Transistor restarted
  // this JS context, _logSegCount is 0 in memory while disk already holds sealed
  // segments — sync from disk first so we don't overwrite segment 0.
  if (!_segCountLoaded) {
    try {
      const cntStr = await AsyncStorage.getItem(TRACKING_LOG_SEG_COUNT_KEY);
      _logSegCount = cntStr ? (parseInt(cntStr) || 0) : 0;
    } catch { /* silent */ }
    _segCountLoaded = true;
  }

  try {
    await AsyncStorage.setItem(TRACKING_LOG_SEG_PREFIX + _logSegCount, JSON.stringify(_logBuffer));
    _logSegCount += 1;
    await AsyncStorage.setItem(TRACKING_LOG_SEG_COUNT_KEY, String(_logSegCount));
  } catch {
    // Seal failed (disk full / transient) — keep entries in memory and retry on
    // the next entry. Do NOT reset the buffer, so nothing is lost.
    return;
  }

  _logBuffer = [];
  _logDirty = false;
  if (_logFlushTimer) { clearTimeout(_logFlushTimer); _logFlushTimer = null; }
  try { await AsyncStorage.setItem(TRACKING_LOG_KEY, '[]'); } catch { /* silent */ }
};

// Stitch all sealed segments (in order) + the current in-memory segment back
// into one array for upload. Uses the in-memory buffer for the current part so
// it's current even if the last flush hasn't landed.
const _readFullLog = async (): Promise<TrackingLogEntry[]> => {
  const all: TrackingLogEntry[] = [];
  let segCount = _logSegCount;
  if (!_segCountLoaded) {
    try {
      const cntStr = await AsyncStorage.getItem(TRACKING_LOG_SEG_COUNT_KEY);
      segCount = cntStr ? (parseInt(cntStr) || 0) : 0;
    } catch { /* silent */ }
  }
  for (let i = 0; i < segCount; i++) {
    try {
      const segStr = await AsyncStorage.getItem(TRACKING_LOG_SEG_PREFIX + i);
      if (segStr) {
        const seg = JSON.parse(segStr);
        if (Array.isArray(seg)) all.push(...seg);
      }
    } catch { /* skip a corrupt/missing segment */ }
  }
  if (_logBuffer.length > 0) {
    all.push(..._logBuffer);
  } else {
    try {
      const curStr = await AsyncStorage.getItem(TRACKING_LOG_KEY);
      if (curStr) {
        const cur = JSON.parse(curStr);
        if (Array.isArray(cur)) all.push(...cur);
      }
    } catch { /* silent */ }
  }
  return all;
};

// Keeps its async signature so existing `await addLog(...)` call-sites are
// unchanged.
const addLog = async (icon: string, msg: string): Promise<void> => {
  _logBuffer.push({ ts: Date.now(), icon, msg });
  _logDirty = true;

  // Seal the segment once it fills so the whole ride is retained on disk in
  // bounded chunks. The seal persists, so it doubles as the flush.
  if (_logBuffer.length >= LOG_SEGMENT_SIZE) {
    if (_logSegCount < MAX_LOG_SEGMENTS) {
      await _sealCurrentSegment();
    } else {
      // Retention ceiling reached (very long session): keep the current segment
      // as a rolling window of the most recent entries. Earlier segments stay.
      _logBuffer.splice(0, _logBuffer.length - LOG_SEGMENT_SIZE);
      if (AppState.currentState !== 'active') await _flushLogsNow();
      else _scheduleLogFlush();
    }
    return;
  }

  // ✅ Background persistence. The 2s setTimeout flush only fires while the JS
  // runtime keeps running — i.e. foreground. Once the phone is pocketed the app
  // is backgrounded, each Transistor wake returns in well under 2s, and the OS
  // suspends the pending timer before _flushLogsNow runs — so during-race
  // entries never reached disk (the "439 sent but only the startup entries
  // logged" bug). When NOT active, write synchronously inside this wake.
  // Background log cadence is sparse, so this can't recreate the foreground
  // AsyncStorage write-storm the throttle was added to prevent.
  if (AppState.currentState !== 'active') {
    await _flushLogsNow();
  } else {
    _scheduleLogFlush();
  }
};

// Reset the in-memory log buffer + pending flush + any archived segments from a
// previous session (call at session start).
const _resetLogBuffer = async (): Promise<void> => {
  _logBuffer = [];
  _logDirty = false;
  if (_logFlushTimer) { clearTimeout(_logFlushTimer); _logFlushTimer = null; }
  try {
    const cntStr = await AsyncStorage.getItem(TRACKING_LOG_SEG_COUNT_KEY);
    const cnt = cntStr ? (parseInt(cntStr) || 0) : 0;
    const keys: string[] = [];
    for (let i = 0; i < cnt; i++) keys.push(TRACKING_LOG_SEG_PREFIX + i);
    if (keys.length) await AsyncStorage.multiRemove(keys);
    await AsyncStorage.removeItem(TRACKING_LOG_SEG_COUNT_KEY);
  } catch { /* silent */ }
  _logSegCount = 0;
  _segCountLoaded = true;   // we just authoritatively cleared — no disk sync needed
};

// ✅ Upload the tracking log from the BACKGROUND auto-stop path so it doesn't
// wait for the user to foreground the app. Runs inside the same Transistor wake
// that detected the finish.
//
// Dedup: on SUCCESS we set LOG_UPLOADED_KEY='1' so HomeScreen.stopGPSTracking
// skips its own upload. On failure (no network, etc.) we leave the flag unset
// and the log in place, so the foreground stop still retries — that's why the
// flag is only written after a successful saveTrackingLog.
const _uploadTrackingLogOnFinish = async (
  participantId: string,
  eventId: string,
  sentCount: number,
): Promise<void> => {
  try {
    if (!participantId || !eventId) return;
    // Only the BACKGROUND path needs this. When foregrounded, HomeScreen's 1s
    // timer reads RACE_FINISHED_KEY and runs stopGPSTracking, which uploads the
    // log — so skipping here avoids both uploaders racing on a foreground finish.
    if (AppState.currentState === 'active') return;
    // Persist the in-memory buffer first so the 🏆 / 🛑 finish entries are in it,
    // then stitch the whole ride (all sealed segments + current) for upload.
    await _flushLogsNow();
    const logs: TrackingLogEntry[] = await _readFullLog();
    if (!logs || logs.length === 0) return;

    let remaining = 0;
    try {
      const { QUEUE_COUNT_KEY } = require('./locationQueueService');
      const qStr = await AsyncStorage.getItem(QUEUE_COUNT_KEY);
      remaining = qStr ? (parseInt(qStr) || 0) : 0;
    } catch { /* silent */ }

    const { locationService } = require('./locationService');
    await locationService.saveTrackingLog(participantId, eventId, logs, sentCount, remaining);

    await AsyncStorage.setItem(LOG_UPLOADED_KEY, '1');
    if (API_CONFIG.DEBUG) console.log('📤 Tracking log uploaded from background after finish');
  } catch {
    // Silent — leave LOG_UPLOADED_KEY unset so the foreground stop retries.
  }
};

// ✅ Background fetch keepalive — REMOVED with Option B.
// The keepalive was specifically a wake-pulse for expo-location's TaskManager
// task on Samsung One UI's Adaptive Battery throttling. Transistor's native
// foreground service + WakeLock keeps itself alive without needing pulses.
// startBackgroundFetchKeepalive / stopBackgroundFetchKeepalive remain exported
// as no-ops so HomeScreen doesn't have to remove the calls in one go.
export const startBackgroundFetchKeepalive = async (): Promise<void> => {
  // No-op — kept for HomeScreen call-site compatibility.
};
export const stopBackgroundFetchKeepalive = async (): Promise<void> => {
  // No-op — kept for HomeScreen call-site compatibility.
};

// Haversine — straight-line distance between two GPS coordinates in metres.
function distanceMetres(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Normalised location shape produced by the engine before handing off to the
// shared send pipeline. Lets us share processLocationForSend across engines.
interface NormalizedRawLocation {
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number | null;
  altitudeAccuracy: number | null;
  speed: number | null;
  heading: number | null;
  timestamp: number;
  mocked: boolean;
}

// ✅ SHARED SEND PIPELINE — single source of truth for: race-start gating,
// throttling, movement filtering, elevation/battery enrichment, send-gap
// diagnostics, the actual HTTP send, finish-approach activation, and
// auto-stop.
//
// With Option B in place, this is now called only by Transistor's onLocation
// handler. The TaskManager.defineTask block below is kept for backward
// compatibility but won't fire unless an old app install has a leftover task.
//
// ✅ CONCURRENCY GUARD: Transistor emits 1-2 onLocation fires very rapidly at
// session start (both from its own initial state detection AND from the
// changePace(true) we call right after start()). With concurrent JS execution
// and AsyncStorage being non-atomic (read-then-write), two fires within ~25ms
// can both:
//   - read LAST_POSITION_KEY as null (Fix 5 hasn't written yet)
//   - read LAST_SENT_KEY as 0 (throttle hasn't been updated)
//   - progress through every check
//   - both call HTTP send
// Server-side dedup catches the duplicate (same row ID returned), but the
// device still made 2 network requests it shouldn't have.
//

let _isProcessingSend = false;
let _sendStartedAt = 0;
// Hard ceiling on how long the mutex may stay held. A network send/drain that
// hangs (half-open TCP socket on flaky cell — no response, no error, just a
// stalled socket the OS won't kill for minutes) would otherwise keep the mutex
// locked, and EVERY onLocation fire during that window would be dropped at the
// guard below — silent total tracking loss until the app is next foregrounded.
// If the mutex has been held longer than this, a prior send is presumed hung;
// force-release so the current fire can proceed. 120s comfortably exceeds any
// legitimate send (which should itself be timeout-bounded — see note in
// locationService.sendLocation / processQueue).
const SEND_MUTEX_MAX_MS = 120000;

const processLocationForSend = async (
  raw: NormalizedRawLocation,
  source: 'task' | 'transistor',
): Promise<void> => {
  if (_isProcessingSend) {
    const heldFor = Date.now() - _sendStartedAt;
    if (heldFor < SEND_MUTEX_MAX_MS) {
      if (API_CONFIG.DEBUG) {
        console.log(`⏭️ processLocationForSend already running — skipping concurrent fire (${source})`);
      }
      return;
    }
    // Mutex stuck — the previous send/drain hung. Force-release and continue so
    // tracking can't be silently frozen by one stalled socket.
    await addLog('⚠️', `Send mutex held ${(heldFor / 1000).toFixed(0)}s — forcing release (prior send hung) [${source}]`);
    _isProcessingSend = false;
  }
  _isProcessingSend = true;
  _sendStartedAt = Date.now();
  try {
    return await _processLocationForSendInternal(raw, source);
  } finally {
    _isProcessingSend = false;
  }
};

const _processLocationForSendInternal = async (
  raw: NormalizedRawLocation,
  source: 'task' | 'transistor',
): Promise<void> => {
  const tag = source === 'transistor' ? ' [t]' : '';
  const now = Date.now();

  // ✅ Read previous fire-at BEFORE we overwrite it. The previous value is
  // what the freeze diagnostic uses to decide whether the engine was firing
  // during the gap (false freeze) or truly silent (real freeze).
  const prevFireAtStr = await AsyncStorage.getItem(LAST_LOC_FIRE_KEY);
  const prevFireAt = prevFireAtStr ? parseInt(prevFireAtStr) : 0;
  // Update fire-at for the NEXT call's diagnostic.
  await AsyncStorage.setItem(LAST_LOC_FIRE_KEY, String(now));

  try {
    const paramsJson = await AsyncStorage.getItem(TRACKING_PARAMS_KEY);
    if (!paramsJson) {
      // Session was stopped between this fire and processing. Silent return.
      return;
    }

    const { participantId, eventId, intervalSeconds, categoryId, raceStartTime, manualStart } = JSON.parse(paramsJson);

    // ✅ Race start check — block sends before race begins.
    if (manualStart !== 1) {
      if (!raceStartTime) {
        await addLog('⏳', `Race time not set — skipping send${tag}`);
        return;
      }
      const raceTimeMs = new Date(raceStartTime).getTime();
      if (isNaN(raceTimeMs) || now < raceTimeMs) {
        const minsLeft = isNaN(raceTimeMs) ? '?' : ((raceTimeMs - now) / 60000).toFixed(1);
        await addLog('⏳', `Race not started — ${minsLeft}min remaining${tag}`);
        return;
      }
    }

    // ── BOUNDED MULTI-BATCH DRAIN ──────────────────────────────────────────
    // processQueue drains at most batchSize (50) per call. After a long outage
    // the backlog can be hundreds deep; draining ONE batch per onLocation fire
    // meant ~30s of wall time per 50 fixes, so the live dot stayed frozen for
    // minutes after network returned (everything queued behind the backlog).
    // Loop the drain so a backlog clears within a single wake instead — but cap
    // it two ways so we never blow the iOS background-wake budget (~30s, often
    // less): MAX_DRAIN_BATCHES iterations AND DRAIN_TIME_BUDGET_MS wall time.
    // Whichever hits first stops the loop; the order guard below then queues the
    // current fix behind whatever's left, and the next wake / 10s processor
    // picks up the remainder. Nothing is lost; timestamps stay ascending.
    const MAX_DRAIN_BATCHES   = 5;       // 5 × batchSize(50) = up to 250 fixes/wake
    const DRAIN_TIME_BUDGET_MS = 12000;  // stay well under the iOS wake kill timer
    let _backlogRemains = false;
    try {
      const { QUEUE_COUNT_KEY } = require('./locationQueueService');
      const qCountStr = await AsyncStorage.getItem(QUEUE_COUNT_KEY);
      let qCount = qCountStr ? parseInt(qCountStr) : 0;
      if (qCount > 0) {
        const { locationService } = require('./locationService');
        const drainStart = Date.now();
        let totalFlushed = 0;

        for (let batch = 0; batch < MAX_DRAIN_BATCHES; batch++) {
          const flushed = await locationService.processQueue(participantId, eventId);
          if (flushed > 0) totalFlushed += flushed;

          const leftStr = await AsyncStorage.getItem(QUEUE_COUNT_KEY);
          qCount = leftStr ? parseInt(leftStr) : 0;

          // Stop when drained, when a batch made no progress (network failed
          // again — don't spin), or when the wake-time budget is spent.
          if (qCount === 0) break;
          if (flushed === 0) break;
          if (Date.now() - drainStart >= DRAIN_TIME_BUDGET_MS) break;
          // Finish was detected & the engine torn down inside processQueue —
          // stop draining; the session is over and params are already cleared.
          try {
            const fin = await AsyncStorage.getItem(RACE_FINISHED_KEY);
            if (fin === '1') break;
          } catch { /* silent */ }
        }

        if (totalFlushed > 0) {
          const cStr = await AsyncStorage.getItem(BACKGROUND_SENT_COUNT_KEY);
          const c = cStr ? parseInt(cStr) : 0;
          await AsyncStorage.setItem(BACKGROUND_SENT_COUNT_KEY, String(c + totalFlushed));
          let fin = '0';
          try { fin = (await AsyncStorage.getItem(RACE_FINISHED_KEY)) ?? '0'; } catch {}
          const pendingNote = fin === '1'
            ? `(${qCount} post-finish fix(es) discarded — race over)`
            : `(${qCount} still pending)`;
          await addLog('📤', `Drained ${totalFlushed} queued fix(es) ${pendingNote} before live send${tag}`);
        }

        _backlogRemains = qCount > 0;
      }
    } catch { /* silent — drain failure must never block the live send */ }

    // ✅ ORDER GUARD. The server snaps distance forward against the LATEST stored
    // device_timestamp and rejects anything older. So a newer live fix must NEVER
    // be stored while older fixes are still queued — that would advance the stored
    // timestamp past the backlog, and the server would stale-drop every remaining
    // queued fix (and the lone out-of-order fix mis-snaps off the large time gap:
    // the 13:18→13:40 / +12km false-finish bug). If the queue isn't empty yet, push
    // THIS fix to the tail and return — it flushes in order behind the older fixes
    // on a later fire / the 10s queue processor. Nothing is lost; timestamps stay
    // ascending. Only when the queue is empty do we send the live fix below.
    if (_backlogRemains) {
      try {
        const { locationQueueService } = require('./locationQueueService');
        await locationQueueService.addToQueue({
          latitude:         raw.latitude,
          longitude:        raw.longitude,
          altitude:         raw.altitude ?? undefined,
          accuracy:         raw.accuracy ?? undefined,
          altitudeAccuracy: raw.altitudeAccuracy ?? undefined,
          timestamp:        new Date(raw.timestamp).toISOString(),
          speed:            raw.speed ?? undefined,
          heading:          raw.heading ?? undefined,
          isMock:           raw.mocked || false,
          participantId,
          eventId,
          queuedAt:         new Date().toISOString(),
          retryCount:       0,
        }, false);
        await addLog('📥', `Backlog still draining — current fix queued behind it for order${tag}`);
      } catch { /* silent */ }
      return;
    }

    const categoryIdNum = Number(categoryId);
    const minMovementMetres = MOVEMENT_THRESHOLD[categoryIdNum] ?? DEFAULT_MOVEMENT_METRES;

    const finishApproach = await AsyncStorage.getItem(FINISH_APPROACH_KEY);
    const effectiveInterval = finishApproach === '1'
      ? FINISH_APPROACH_INTERVAL
      : (intervalSeconds ?? 30);
    // Tolerance scales with the interval instead of a flat 5s. Transistor's
    // background fire cadence is irregular — the OS stretches the requested rate,
    // so for a 60s target a fix often lands at ~50s. Under the old 55s gate that
    // fix was skipped and the send slipped to the next one ~100s out (the 1min/2min
    // mix). Accepting a fix from ~75% of the interval onward lets the ~50s fix
    // through and holds the cadence near the target.
    const minGapMs = Math.round(effectiveInterval * 0.75) * 1000;
    const lastSentStr = await AsyncStorage.getItem(LAST_SENT_KEY);
    const lastSentAt = lastSentStr ? parseInt(lastSentStr) : 0;

    // Guard against clock jumps (Samsung) or corrupted timestamp.
    if (isNaN(lastSentAt) || lastSentAt > now) {
      await AsyncStorage.setItem(LAST_SENT_KEY, '0');
      await addLog('⏰', `Clock jump detected — LAST_SENT reset${tag}`);
    } else if (now - lastSentAt < minGapMs) {
      const elapsed = ((now - lastSentAt) / 1000).toFixed(1);
      await addLog('⏭️', `Throttled — only ${elapsed}s since last send (min ${(minGapMs/1000).toFixed(0)}s)${tag}`);
      return;
    }

    const currentAltitude = raw.altitude;
    const speed = raw.speed;
    const isMoving = speed !== null ? speed > 0.5 : undefined;

    // ✅ Movement check — skip if participant hasn't moved enough since last send.
    //
    // FIX 5: When LAST_POSITION_KEY is missing (very first fire of the session),
    // we used to bypass this check entirely and send immediately. That caused an
    // unwanted send at session start while the user was still stationary (the
    // id:1002 issue from the home-to-office log). Now we store the position and
    // skip the send — the next fire compares against this stored position and
    // sends only if the participant has actually moved.
    //
    // FIX 3: During finish approach the movement threshold was bypassed entirely
    // to ensure every metre near the line is recorded. But Transistor's
    // fastestLocationUpdateInterval (5s) can fire sometimes faster than 5s, and
    // when the participant is in a queue at the line the same coords get sent
    // twice within 2s. We now require >=1m even in the finish zone — small
    // enough that real motion always passes, large enough to suppress
    // byte-identical re-fires.
    const lastPosStr = await AsyncStorage.getItem(LAST_POSITION_KEY);
    if (!lastPosStr) {
      // First fire of the session — just record the position, don't send.
      await AsyncStorage.setItem(LAST_POSITION_KEY, JSON.stringify({
        lat: raw.latitude,
        lon: raw.longitude,
      }));
      await addLog('📌', `First position recorded — waiting for movement${tag}`);
      return;
    }
    const lastPos = JSON.parse(lastPosStr);
    const moved = distanceMetres(lastPos.lat, lastPos.lon, raw.latitude, raw.longitude);
    const movementFloor = (finishApproach === '1') ? FINISH_APPROACH_MIN_MOVE_METRES : minMovementMetres;
    if (moved < movementFloor) {
      const label = (finishApproach === '1')
        ? `Skipped — identical position in finish approach (${moved.toFixed(1)}m)`
        : `Skipped — moved only ${moved.toFixed(1)}m (need ${minMovementMetres}m)`;
      await addLog('🚶', `${label}${tag}`);
      return;
    }

    // ✅ Enrichment AFTER the movement gate — elevation + battery reads only run
    // for a fix we're actually going to send, not on every suppressed fire.
    let elevationGain: number | undefined;
    if (currentAltitude !== null) {
      const lastAltStr = await AsyncStorage.getItem(LAST_ALTITUDE_KEY);
      if (lastAltStr) {
        const lastAlt = parseFloat(lastAltStr);
        if (!isNaN(lastAlt) && currentAltitude > lastAlt) {
          elevationGain = parseFloat((currentAltitude - lastAlt).toFixed(1));
        }
      }
      await AsyncStorage.setItem(LAST_ALTITUDE_KEY, String(currentAltitude));
    }

    let batteryLevel: number | undefined;
    let batteryCharging: boolean | undefined;
    try {
      const level = await Battery.getBatteryLevelAsync();
      const state = await Battery.getBatteryStateAsync();
      batteryLevel = Math.round(level * 100);
      batteryCharging = state === Battery.BatteryState.CHARGING ||
                        state === Battery.BatteryState.FULL;
    } catch { /* silent */ }

    const location: LocationData = {
      latitude: raw.latitude,
      longitude: raw.longitude,
      altitude: currentAltitude ?? undefined,
      accuracy: raw.accuracy ?? undefined,
      altitudeAccuracy: raw.altitudeAccuracy ?? undefined,
      timestamp: new Date(raw.timestamp).toISOString(),
      speed: speed ?? undefined,
      heading: raw.heading ?? undefined,
      isMock: raw.mocked || false,
      elevationGain,
      batteryLevel,
      batteryCharging,
      isMoving,
    };

    // ✅ Commit throttle + position BEFORE the network call. Future fires that
    // arrive before our network round-trip completes will see this timestamp
    // and throttle themselves correctly.
    await AsyncStorage.setItem(LAST_SENT_KEY, String(now));
    await AsyncStorage.setItem(LAST_POSITION_KEY, JSON.stringify({
      lat: location.latitude,
      lon: location.longitude,
    }));

    // ✅ FIX 4: Send-gap diagnostic, now with false-positive suppression.
    //
    // Old behaviour: warned "POSSIBLE FREEZE" whenever gapSec > expected+10s,
    // which lit up red whenever the participant stopped at a traffic light
    // long enough for the movement filter to suppress 2-3 fires (e.g. the
    // 85s and 45s "freezes" in the office-to-home log were actually false
    // positives — Transistor was firing every 5s, the movement filter was
    // doing its job).
    //
    // New behaviour: only mark as freeze if no engine fires happened between
    // the last send and now. If prevFireAt is well after lastSentAt, Transistor
    // was firing during the gap → this is a "long pause" not a freeze.
    const lastSentValid = (lastSentAt > 0 && !isNaN(lastSentAt) && lastSentAt <= now);
    if (lastSentValid) {
      const gapSec = (now - lastSentAt) / 1000;
      const expectedSec = effectiveInterval;
      // 5s tolerance for clock jitter
      const engineWasFiring = prevFireAt > lastSentAt + 5000;
      const isFreeze = gapSec > (expectedSec + 10) && !engineWasFiring;
      const longPause = gapSec > (expectedSec + 10) && engineWasFiring;
      const icon = isFreeze ? '⏱️🔴' : '⏱️';
      const suffix = isFreeze
        ? ' — POSSIBLE FREEZE/THROTTLE'
        : (longPause ? ' — long pause (engine alive, movement filter)' : '');
      await addLog(icon, `Send gap ${gapSec.toFixed(1)}s (expected ~${expectedSec}s)${suffix}${tag}`);
    }

    await addLog('📍', `Sending — lat:${location.latitude.toFixed(5)} lon:${location.longitude.toFixed(5)} spd:${location.speed?.toFixed(1) ?? '?'}m/s (${location.speed != null ? (location.speed * 3.6).toFixed(1) : '?'}km/h) bat:${location.batteryLevel ?? '?'}% ele:${location.altitude?.toFixed(0) ?? '?'}m${tag}`);

    // Import here to avoid circular deps at module level.
    const { locationService } = require('./locationService');

    // ✅ Queue-on-fail is always allowed here; the OFFLINE-QUEUE throttle now
    // lives in locationQueueService.addToQueue (single chokepoint), so a failed
    // send hands the fix to addToQueue, which drops it if we already queued one
    // this interval. That keeps the offline backlog at the interval rate without
    // this path needing its own throttle — and the order-guard re-queue above is
    // covered by the same chokepoint.
    let result: any = { success: false };
    try {
      result = await locationService.sendLocation(participantId, eventId, location, true);
    } catch (sendErr: any) {
      await addLog('📦', `Send failed — queued (subject to queue throttle). Error: ${sendErr?.message ?? 'unknown'}${tag}`);
      return;
    }

    if (!result.success) {
      await addLog('🔴', `API rejected — ${result.message ?? 'unknown'}${tag}`);
      return;
    }

    await addLog('✅', `Sent OK — id:${result.locationId ?? '?'} dist_to_finish:${result.distance_to_finish_km ?? '?'}km${tag}`);
    const countStr = await AsyncStorage.getItem(BACKGROUND_SENT_COUNT_KEY);
    const count = countStr ? parseInt(countStr) : 0;
    const sentCount = count + 1;
    await AsyncStorage.setItem(BACKGROUND_SENT_COUNT_KEY, String(sentCount));

    // ✅ Finish-line approach: activate 5s interval when ≤ 1km to finish.
    // Loop-course guard: skip finish approach for first 3 sends (~90s).
    const distToFinish = (sentCount < 3)
      ? null
      : (result.distance_to_finish_km ?? result.distance_to_next_cp ?? null);
    if (distToFinish !== null && distToFinish <= FINISH_APPROACH_THRESHOLD) {
      const wasActive = finishApproach === '1';
      await AsyncStorage.setItem(FINISH_APPROACH_KEY, '1');
      await AsyncStorage.setItem(NEAR_FINISH_KEY, '1');
      if (!wasActive) {
        try {
          await BackgroundGeolocation.setConfig({
            geolocation: {
              locationUpdateInterval:        FINISH_APPROACH_INTERVAL * 1000,  // 5000
              fastestLocationUpdateInterval: FINISH_APPROACH_INTERVAL * 1000,  // 5000
              distanceFilter:                0,
            },
          });
          try { await BackgroundGeolocation.changePace(true); } catch {}
        } catch { /* silent — config change must never break the send */ }
        await addLog('🏁', `Finish approach activated — ${distToFinish.toFixed(2)}km to finish, sending every 5s${tag}`);
      }
    } else if (distToFinish !== null && distToFinish > FINISH_APPROACH_THRESHOLD) {
      if (finishApproach === '1') {
        try {
          await BackgroundGeolocation.setConfig({
            geolocation: {
              locationUpdateInterval:        fixIntervalMs(intervalSeconds),
              fastestLocationUpdateInterval: 5000,
            },
          });
          try { await BackgroundGeolocation.changePace(true); } catch {}
        } catch { /* silent */ }
        await addLog('🔄', `Finish approach reset — now ${distToFinish.toFixed(2)}km from finish${tag}`);
      }
      await AsyncStorage.removeItem(FINISH_APPROACH_KEY);
    }

    // ✅ Auto-stop detection — RR vs distance authority split.
    const serverFinished = result.finished === 1 || result.finished === '1';
    const finishSource = result.finish_source ?? 'distance';
    const finishedRaw = result.distance_to_finish_km ?? null;
    const nearFinish = await AsyncStorage.getItem(NEAR_FINISH_KEY);

    const shouldStop = (finishSource === 'rr')
      ? serverFinished
      : (
          serverFinished &&
          finishedRaw !== null &&
          finishedRaw <= FINISH_LINE_THRESHOLD_KM &&
          sentCount >= 3 &&
          nearFinish === '1'
        );

    if (shouldStop) {
      await AsyncStorage.setItem(RACE_FINISHED_KEY, '1');
      await addLog(
        '🏆',
        finishSource === 'rr'
          ? `Finish confirmed by RaceResult (finished=1) — stopping GPS${tag}`
          : `Finish line crossed — ${finishedRaw?.toFixed(3)}km to finish, stopping GPS${tag}`
      );

      // Tear down both engines. With Option B only Transistor is running, but
      // we still call Location.stopLocationUpdatesAsync defensively in case an
      // old app install left a registered task.
      try { await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK); } catch { /* silent */ }
      try {
        await BackgroundGeolocation.stop();
        BackgroundGeolocation.removeListeners();
      } catch { /* silent */ }
      await addLog('🛑', `GPS engines stopped — finish line reached${tag}`);

      // ✅ Upload the tracking log NOW, in this same background wake, instead of
      // waiting for the app to be foregrounded. Done last so the log includes the
      // 🏆 / 🛑 finish entries above. LOG_UPLOADED_KEY prevents a double upload
      // when HomeScreen.stopGPSTracking later runs on foreground.
      await _uploadTrackingLogOnFinish(participantId, eventId, sentCount);
    }

  } catch (err: any) {
    await addLog('❌', `processLocationForSend crashed: ${err?.message ?? 'unknown error'}${tag}`);
  }
};

// ✅ DEFENSIVE: TaskManager.defineTask is still called at module load even
// though we no longer register the task. If a user upgrades from an older
// version of the app that DID register the task, the OS will continue to
// invoke it at the old cadence until we explicitly stop it. Without this
// defineTask call here, expo-task-manager would throw "Task not defined"
// errors and the OS would keep retrying. The task body itself is now a no-op
// because TRANSISTOR_ACTIVE_KEY is set whenever Transistor is running.
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }: any) => {
  if (error) return;
  if (!data?.locations?.length) return;

  // If Transistor is the active sender (normal case in this version), no-op.
  try {
    const transistorActive = await AsyncStorage.getItem(TRANSISTOR_ACTIVE_KEY);
    if (transistorActive === '1') return;
  } catch { /* silent */ }

  // Fallback path — only reached if Transistor failed to start.
  try {
    const paramsJson = await AsyncStorage.getItem(TRACKING_PARAMS_KEY);
    if (!paramsJson) return;
    const { categoryId, intervalSeconds, manualStart } = JSON.parse(paramsJson);
    await addLog('🔔', `Task fired (fallback) — cat:${categoryId} interval:${intervalSeconds}s manualStart:${manualStart ?? 0}`);
  } catch { /* silent */ }

  const raw = data.locations[data.locations.length - 1];
  if (!raw?.coords || typeof raw.coords.latitude !== 'number') return;
  await processLocationForSend({
    latitude:         raw.coords.latitude,
    longitude:        raw.coords.longitude,
    altitude:         raw.coords.altitude ?? null,
    accuracy:         raw.coords.accuracy ?? null,
    altitudeAccuracy: raw.coords.altitudeAccuracy ?? null,
    speed:            raw.coords.speed ?? null,
    heading:          raw.coords.heading ?? null,
    timestamp:        raw.timestamp,
    mocked:           raw.mocked || false,
  }, 'task');
});

// Module-level reference to the AppState subscription so we can clean it up if
// startWatchingPosition is called twice without stop in between. (With the
// expo-location foreground watch removed this listener no longer restarts a
// watch — it remains only for lightweight lifecycle logging and is torn down
// cleanly on stop.)
let _fgAppStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;

// Module-level UI callback. Transistor's onLocation handler always invokes
// _uiCallback (rather than a captured closure), so HomeScreen can swap in a
// new callback on remount via attachUi without restarting tracking. When
// _uiCallback is null, location fires simply aren't mirrored to the UI.
let _uiCallback: ((position: GPSPosition) => void) | null = null;
let _uiIntervalMs: number = 5000;

// ✅ Foreground UI updates are now driven directly by Transistor's onLocation
// handler (see startWatchingPosition) instead of a second expo-location
// watchPositionAsync. Running two CLLocationManager streams into JS at once
// doubled the native→JS callback pressure that destabilised Hermes under the
// New Architecture. These remain as no-ops so the existing call-sites
// (attachUi, the AppState listener, _doFullStop, startWatchingPosition) don't
// need to change.
const _startFgWatch = async (): Promise<void> => {
  // No-op — Transistor onLocation drives the UI now.
};

const _stopFgWatch = async (): Promise<void> => {
  // No-op — nothing to stop; Transistor owns the location stream.
};

// ✅ Internal: register a lightweight AppState listener. Removes any previous
// listener first so callers can re-register safely (idempotent). With the
// second location engine gone this no longer manages a watch — it just keeps
// the lifecycle log honest.
const _registerFgAppStateListener = (): void => {
  if (_fgAppStateSubscription) {
    _fgAppStateSubscription.remove();
    _fgAppStateSubscription = null;
  }
  _fgAppStateSubscription = AppState.addEventListener('change', (nextState) => {
    if (nextState === 'active') {
      addLog('📱', 'App foregrounded — UI driven by Transistor onLocation');
    } else if (nextState === 'background') {
      addLog('🌙', 'App backgrounded — Transistor continues in background');
    } else if (nextState === 'inactive') {
      addLog('💤', 'App inactive (iOS transition)');
    }
  });
};

// ════════════════════════════════════════════════════════════════════════
// ✅ TRANSISTOR LISTENER REGISTRATION — single source of truth.
//
// The native engine (start/stop) and these JS listeners have SEPARATE
// lifecycles. A running engine with NO listeners attached still samples GPS but
// never calls into JS — processLocationForSend never runs, nothing is sent, and
// getState().enabled still reads true, so it looks healthy while being
// functionally deaf. Registering only inside startWatchingPosition left two
// paths exposed to exactly that:
//   1. Watchdog restart after a full stop (stop() also calls removeListeners()).
//   2. Cold relaunch onto an active session — a fresh JS context where
//      startWatchingPosition never ran, so zero listeners, while the native
//      service survived (stopOnTerminate:false) and getState().enabled === true.
//
// This helper registers all three listeners in one place so EVERY path that
// brings the engine up can (re)attach them. removeListeners() first makes it
// idempotent: calling it again detaches the old handlers and attaches fresh
// ones instead of double-firing.
// ════════════════════════════════════════════════════════════════════════
const _registerTransistorListeners = (): void => {
  try { BackgroundGeolocation.removeListeners(); } catch { /* silent */ }

  BackgroundGeolocation.onLocation((bgLoc) => {
    try {
      // ✅ GUARD: a location event can arrive without a valid coords object
      // (sample/heartbeat events or a malformed payload). Reading
      // bgLoc.coords.latitude on undefined threw a TypeError — and under the New
      // Architecture (RN 0.81+) an uncaught JS error inside a native callback is
      // FATAL (it was silently swallowed on the old architecture). Bail out
      // safely instead of crashing.
      if (!bgLoc?.coords || typeof bgLoc.coords.latitude !== 'number') {
        addLog('⚠️', 'onLocation fired without valid coords — skipped');
        return;
      }

      const ts = typeof bgLoc.timestamp === 'string'
        ? new Date(bgLoc.timestamp).getTime()
        : (bgLoc.timestamp as unknown as number);

      // ✅ Drive the HomeScreen live display straight from Transistor.
      if (_uiCallback) {
        _uiCallback({
          latitude:         bgLoc.coords.latitude,
          longitude:        bgLoc.coords.longitude,
          altitude:         bgLoc.coords.altitude ?? null,
          accuracy:         bgLoc.coords.accuracy ?? null,
          altitudeAccuracy: (bgLoc.coords as any).altitude_accuracy ?? null,
          speed:            bgLoc.coords.speed ?? null,
          heading:          bgLoc.coords.heading ?? null,
          timestamp:        isNaN(ts) ? Date.now() : ts,
          mocked:           false,
        });
      }

      addLog('🛰️', `Transistor loc — lat:${bgLoc.coords.latitude.toFixed(5)} spd:${bgLoc.coords.speed?.toFixed(1) ?? '?'}m/s moving:${bgLoc.is_moving}`);

      // Fire-and-forget — onLocation must return quickly. processLocationForSend
      // has its own try/catch so errors are contained.
      processLocationForSend({
        latitude:         bgLoc.coords.latitude,
        longitude:        bgLoc.coords.longitude,
        altitude:         bgLoc.coords.altitude ?? null,
        accuracy:         bgLoc.coords.accuracy ?? null,
        altitudeAccuracy: (bgLoc.coords as any).altitude_accuracy ?? null,
        speed:            bgLoc.coords.speed ?? null,
        heading:          bgLoc.coords.heading ?? null,
        timestamp:        isNaN(ts) ? Date.now() : ts,
        mocked:           false,
      }, 'transistor');
    } catch (cbErr: any) {
      // Never let an error escape a native callback — that would be a fatal
      // uncaught exception under the New Architecture.
      addLog('❌', `onLocation handler error: ${cbErr?.message ?? 'unknown'}`);
    }
  });

  BackgroundGeolocation.onMotionChange((event) => {
    addLog(event.isMoving ? '🏃' : '🧍', `Motion: ${event.isMoving ? 'moving' : 'stationary'}`);
  });

  // ✅ HEARTBEAT — the ONLY non-foreground wake path while stationary.
  //
  // disableStopDetection:true is supposed to keep the SDK moving, but on Android
  // it can still drop to stationary when the device is genuinely motionless for
  // a while (OS-level location batching). Once stationary, onLocation goes quiet
  // AND — because activity.disableMotionActivityUpdates:true removes the
  // motion-sensor wake — nothing brings it back until the app is foregrounded.
  // That is exactly the long silent gap we saw after a runner stopped.
  //
  // heartbeatInterval:60 + preventSuspend:true fire this every 60s even while
  // stationary/asleep (battery unrestricted). We pull a fresh fix;
  // getCurrentPosition fires onLocation, so it flows through the same
  // onLocation → processLocationForSend pipeline (throttle + movement filter
  // still apply, so a genuinely-stopped runner produces NO send — only real
  // movement gets through).
  BackgroundGeolocation.onHeartbeat(async () => {
    try {
      const hbState = await BackgroundGeolocation.getState();
      // ✅ Log EVERY beat so the panel confirms the heartbeat is alive — even
      // while moving, when onLocation is already doing the work and a heartbeat
      // fix would just be a redundant network call.
      if (hbState.isMoving) {
        await addLog('💓', 'Heartbeat — moving, onLocation active (no extra fix)');
        return;
      }

      await addLog('💓', 'Heartbeat — stationary, pulling keepalive fix');
      const hbLoc = await BackgroundGeolocation.getCurrentPosition({
        samples:         2,
        timeout:         30,
        desiredAccuracy: 10,
        persist:         false,   // we send via our own pipeline, not the SDK DB
      });

      // ✅ Re-wake the MOVING stream if the "stationary" rider is actually moving.
      // With disableMotionActivityUpdates:true the SDK can sit in STATIONARY for a
      // whole ride (observed: moving:false at 44km/h on a client ride), so the
      // locationUpdateInterval onLocation stream never runs and every fix comes
      // from this 60s heartbeat — which the OS stretches to ~100s (the 1min/2min
      // cadence). changePace(true) flips it to MOVING so the dense onLocation
      // stream takes over and the send throttle holds ~60s. Speed guard so a
      // genuinely stopped rider stays stationary (no false wake / battery burn).
      
      // In the finish zone we want the dense 5s stream regardless of speed — a
      // sub-7km/h finisher walking across the line would otherwise stay on the
      // 60s heartbeat and lose plotting precision exactly where it matters most.
      const hbFinishApproach = await AsyncStorage.getItem(FINISH_APPROACH_KEY);
      const hbSpeed = hbLoc?.coords?.speed ?? 0;
      if (hbSpeed > 2 || hbFinishApproach === '1') {
        try { await BackgroundGeolocation.changePace(true); } catch { /* silent */ }
        await addLog('🏃', hbFinishApproach === '1'
          ? `Heartbeat — finish approach active, re-waking 5s stream`
          : `Heartbeat — moving (${hbSpeed.toFixed(1)}m/s), re-waking onLocation stream`);
      }
    } catch (hbErr: any) {
      // Heartbeat must never throw — a beat with no fix is fine; retry next beat.
      addLog('💓', `Heartbeat fix failed: ${hbErr?.message ?? 'unknown'}`);
    }
  });
};

// ✅ Internal: full teardown — stops Transistor, the AppState listener, and
// clears all session-scoped AsyncStorage keys. Called by stopWatching() below
// and indirectly by the remove() handle returned from startWatchingPosition.
// Idempotent — safe to call multiple times.
const _doFullStop = async (): Promise<void> => {
  if (_fgAppStateSubscription) {
    _fgAppStateSubscription.remove();
    _fgAppStateSubscription = null;
  }
  await _stopFgWatch();
  _uiCallback = null;

  // Defensive: stop expo-location task if older app version registered one.
  try { await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK); } catch { /* silent */ }
  try {
    await BackgroundGeolocation.stop();
    BackgroundGeolocation.removeListeners();
  } catch { /* silent */ }
  // Clean up all session-scoped keys.
  await AsyncStorage.removeItem(TRACKING_PARAMS_KEY);
  await AsyncStorage.removeItem(LAST_SENT_KEY);
  await AsyncStorage.removeItem(LAST_POSITION_KEY);
  await AsyncStorage.removeItem(LAST_ALTITUDE_KEY);
  await AsyncStorage.removeItem(BACKGROUND_SENT_COUNT_KEY);
  await AsyncStorage.removeItem(FINISH_APPROACH_KEY);
  await AsyncStorage.removeItem(RACE_FINISHED_KEY);
  await AsyncStorage.removeItem(NEAR_FINISH_KEY);
  await AsyncStorage.removeItem(LAST_LOC_FIRE_KEY);
  await AsyncStorage.removeItem(TRANSISTOR_ACTIVE_KEY);
  await AsyncStorage.removeItem(LAST_QUEUED_KEY);
  if (API_CONFIG.DEBUG) console.log('✅ Tracking stopped');
  await addLog('🛑', 'Tracking stopped');
  await _flushLogsNow();
};

// ✅ PUBLIC: full stop — equivalent to calling .remove() on the handle returned
// from startWatchingPosition, but doesn't require holding the handle. Useful
// when the screen that started tracking has been unmounted and remounted
// (losing the JS handle), and the user now taps Stop. Idempotent.
export const stopWatching = (): Promise<void> => _doFullStop();

// ✅ PUBLIC: background finish-and-stop. Called from locationService.processQueue
// when a finish is detected WHILE DRAINING the offline backlog — i.e. the runner
// crossed the line with no signal and the queue flushed in a background wake.
// Unlike stopWatching(), this UPLOADS the tracking log first (so the whole ride,
// including the 🏆 finish marker, reaches the server without waiting for the user
// to foreground the app), THEN tears the engine down. Order matters: the log must
// be assembled and sent before _doFullStop() flushes-and-clears session state.
//
// Reuses _uploadTrackingLogOnFinish (which sets LOG_UPLOADED_KEY on success so the
// later foreground stop in HomeScreen.stopGPSTracking skips a duplicate upload) and
// _doFullStop (idempotent — safe even if the foreground poll also fires later).
export const finishBackgroundStop = async (
  participantId?: string,
  eventId?: string,
): Promise<void> => {
  try {
    await addLog('🏆', 'Finish detected during background queue drain — stopping');
  } catch { /* silent */ }

  // Read the real sent-count for the log payload before we clear it.
  let sentCount = 0;
  try {
    const cStr = await AsyncStorage.getItem(BACKGROUND_SENT_COUNT_KEY);
    sentCount = cStr ? (parseInt(cStr) || 0) : 0;
  } catch { /* silent */ }

  // Upload first (no-op if foregrounded — HomeScreen's stop will handle it then).
  try {
    await _uploadTrackingLogOnFinish(participantId ?? '', eventId ?? '', sentCount);
  } catch { /* silent */ }

  // Then full teardown: stops Transistor, removes listeners, clears session keys,
  // appends "🛑 Tracking stopped", flushes the log buffer.
  await _doFullStop();

  // The runner finished — any fixes still queued are post-finish stragglers
  // that belong to a session that's now over. Clear them so they can't be
  // drained into the server by the Retry-Queue button (which would record
  // points past the finish line), nor carried into a later race.
  try {
    const { locationQueueService } = require('./locationQueueService');
    await locationQueueService.clearQueue();
  } catch { /* silent */ }
};

// ✅ PUBLIC: full tracking log (all sealed segments + current) and a direct
// flush, for HomeScreen's foreground stop. It must read via getFullTrackingLog()
// instead of AsyncStorage.getItem(TRACKING_LOG_KEY) — the key now holds only the
// current segment, so a raw read would miss the archived ones.
export const getFullTrackingLog = async (): Promise<TrackingLogEntry[]> => _readFullLog();
export const flushTrackingLog   = async (): Promise<void> => _flushLogsNow();

// ✅ PUBLIC: check whether a tracking session is currently active.
// Returns true if TRACKING_PARAMS_KEY exists in AsyncStorage. Used by
// HomeScreen on mount to detect tracking-in-progress after screen unmount.
export const isTracking = async (): Promise<boolean> => {
  try {
    const params = await AsyncStorage.getItem(TRACKING_PARAMS_KEY);
    return params !== null;
  } catch {
    return false;
  }
};

// ✅ PUBLIC: read the current tracking params (if any). Returns null when no
// session is active. HomeScreen uses this to restore UI state (race start
// time, interval, etc.) when remounting onto an in-progress session.
export const getTrackingParams = async (): Promise<{
  participantId: string;
  eventId: string;
  intervalSeconds: number;
  categoryId?: number;
  raceStartTime?: string | null;
  manualStart?: number;
} | null> => {
  try {
    const json = await AsyncStorage.getItem(TRACKING_PARAMS_KEY);
    return json ? JSON.parse(json) : null;
  } catch {
    return null;
  }
};

// ✅ PUBLIC: attach a UI callback so live lat/lon updates from Transistor's
// onLocation are mirrored to the screen. HomeScreen calls this on mount when
// restoring an in-progress session. Because onLocation reads the module-level
// _uiCallback, this just swaps in the new callback — no GPS restart.
//
// NOTE: within a single app process (navigate away → back), Transistor's
// onLocation listener registered by startWatchingPosition is still alive, so
// the display resumes immediately. On a COLD relaunch onto an already-active
// session, onLocation isn't re-registered yet (that path also affects
// background sends and is handled separately), so the live display may not
// tick until tracking is re-initialised.
export const attachUi = async (
  callback: (position: GPSPosition) => void,
  intervalSeconds: number = 30,
): Promise<void> => {
  _uiCallback = callback;
  _uiIntervalMs = Math.min(intervalSeconds * 1000, 5000);
  await _startFgWatch();
  _registerFgAppStateListener();
};

// ✅ PUBLIC: detach the UI callback and AppState listener. Does NOT stop
// Transistor — background tracking continues. HomeScreen calls this on unmount
// so location fires aren't mirrored into a defunct component's callback while
// the user is on another screen.
export const detachUi = async (): Promise<void> => {
  if (_fgAppStateSubscription) {
    _fgAppStateSubscription.remove();
    _fgAppStateSubscription = null;
  }
  await _stopFgWatch();
  _uiCallback = null;
};

// ✅ Watchdog: called when app returns to foreground to ensure Transistor is
// still alive. Aggressive OEMs (Xiaomi, Samsung, OnePlus) may kill the
// foreground service even with battery-optimisation exempt.
//
// FIX 2 contributes here: the AppState handler in HomeScreen now checks
// RACE_FINISHED_KEY BEFORE calling this function, so we don't accidentally
// resurrect Transistor after auto-stop has already torn it down.
export const ensureBackgroundTaskAlive = async (
  participantId: string,
  eventId: string,
  intervalSeconds: number,
  categoryId: number | undefined,
  raceStartTime: string | null,
  manualStart: number | undefined,
  notificationTitle: string,
  notificationBody: string,
): Promise<boolean> => {
  try {
    // ✅ Always (re)attach the JS listeners FIRST. The native engine and these
    // listeners have separate lifecycles: on a cold relaunch the engine can be
    // alive (enabled===true) while THIS JS context has none attached, so it
    // samples GPS but never calls processLocationForSend. Re-registering is
    // idempotent (removeListeners first), so it's safe on a healthy session too.
    _registerTransistorListeners();

    const bgState = await BackgroundGeolocation.getState();
    if (bgState.enabled) {
      // ✅ Engine alive — but it may have dropped to STATIONARY mid-ride (nothing
      // wakes it back with motion-activity updates disabled). Re-assert MOVING on
      // this foreground check so the onLocation stream resumes instead of leaning
      // on the 60s heartbeat. Skipped after finish so we don't resurrect tracking.
      const wdFinished = await AsyncStorage.getItem(RACE_FINISHED_KEY);
      if (wdFinished !== '1' && !bgState.isMoving) {
        try { await BackgroundGeolocation.changePace(true); } catch { /* silent */ }
        await addLog('🏃', 'Watchdog — engine was stationary, re-asserted moving');
      }
      await addLog('💚', 'Watchdog check — transistor alive (listeners re-attached)');
      return true;
    }

    if (API_CONFIG.DEBUG) console.log('⚠️ Transistor was stopped — restarting...');

    // Re-store params in case they were cleared.
    await AsyncStorage.setItem(TRACKING_PARAMS_KEY, JSON.stringify({
      participantId,
      eventId,
      intervalSeconds,
      categoryId,
      raceStartTime,
      manualStart,
    }));

    await BackgroundGeolocation.start();
    try { await BackgroundGeolocation.changePace(true); } catch { /* silent */ }
    await AsyncStorage.setItem(TRANSISTOR_ACTIVE_KEY, '1');
    await addLog('♻️', 'Watchdog: transistor was dead — restarted successfully');
    return true;
  } catch (err: any) {
    if (API_CONFIG.DEBUG) console.error('❌ Failed to restart transistor:', err?.message);
    return false;
  }
};

export const gpsService = {
  async requestPermissions(): Promise<boolean> {
    try {
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      if (foregroundStatus !== 'granted') {
        if (API_CONFIG.DEBUG) console.error('❌ Foreground location permission denied');
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
      if (API_CONFIG.DEBUG) console.error('❌ Error requesting location permissions:', error);
      return false;
    }
  },

  async hasPermissions(): Promise<boolean> {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      if (API_CONFIG.DEBUG) console.error('❌ Error checking location permissions:', error);
      return false;
    }
  },

  async getCurrentPosition(): Promise<GPSPosition> {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
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
      if (API_CONFIG.DEBUG) console.error('❌ Error getting GPS position:', error);
      throw error;
    }
  },

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

  async startWatchingPosition(
    callback: (position: GPSPosition) => void,
    errorCallback?: (error: Error) => void,
    intervalSeconds: number = 30,
    participantId?: string,
    eventId?: string,
    notificationTitle?: string,
    notificationBody?: string,
    categoryId?: number,
    raceStartTime?: string | null,
    manualStart?: number,
  ): Promise<{ remove: () => void }> {
    try {
      // ✅ Guard: foreground service cannot start when app is backgrounded.
      // Wait up to 3s for app to come to foreground.
      const appCurrentState = AppState.currentState;
      if (appCurrentState !== 'active') {
        if (API_CONFIG.DEBUG) console.log(`⚠️ App state is '${appCurrentState}' — waiting for foreground...`);
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            subscription.remove();
            reject(new Error('App did not return to foreground in time'));
          }, 3000);
          const subscription = AppState.addEventListener('change', (state) => {
            if (state === 'active') {
              clearTimeout(timeout);
              subscription.remove();
              resolve();
            }
          });
        });
      }

      // ✅ Clean up any leftover state from a previous session.
      if (_fgAppStateSubscription) {
        _fgAppStateSubscription.remove();
        _fgAppStateSubscription = null;
      }

      // Defensive: stop any leftover expo-location task from an older app
      // version that may still have one registered. Always silent on failure
      // because the normal case is that no task is registered.
      try {
        await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
        if (API_CONFIG.DEBUG) console.log('♻️ Stopped leftover expo-location task from previous session/install');
      } catch { /* not running */ }

      // Snapshot whether a session was already active BEFORE we overwrite params.
      // A fresh start (no prior session) means any queued fixes are stale
      // post-finish stragglers — safe to clear. A relaunch onto an existing
      // session may have a real mid-race offline backlog — must NOT be wiped.
      const _hadPriorSession = (await AsyncStorage.getItem(TRACKING_PARAMS_KEY)) !== null;

      // ✅ Store tracking params for the engine handlers.
      await AsyncStorage.setItem(TRACKING_PARAMS_KEY, JSON.stringify({
        participantId,
        eventId,
        intervalSeconds,
        categoryId,
        raceStartTime,
        manualStart,
      }));

      // ✅ Clear all session-scoped state.
      await AsyncStorage.removeItem(TRACKING_LOG_KEY);
      await _resetLogBuffer();
      await AsyncStorage.removeItem(LAST_POSITION_KEY);
      await AsyncStorage.removeItem(LAST_ALTITUDE_KEY);
      await AsyncStorage.removeItem(BACKGROUND_SENT_COUNT_KEY);
      await AsyncStorage.removeItem(FINISH_APPROACH_KEY);
      await AsyncStorage.removeItem(RACE_FINISHED_KEY);
      await AsyncStorage.removeItem(NEAR_FINISH_KEY);
      await AsyncStorage.removeItem(LAST_LOC_FIRE_KEY);
      await AsyncStorage.removeItem(LOG_UPLOADED_KEY);
      await AsyncStorage.removeItem(LAST_QUEUED_KEY);
      // Clear stale queue ONLY on a fresh start. On a fresh start any queued
      // fixes are post-finish stragglers from a prior offline finish — safe to
      // wipe. On a relaunch onto an existing session the queue may hold a real
      // mid-race offline backlog the user recorded in a tunnel, so we must NOT
      // delete it — it has to drain into this race.
      if (!_hadPriorSession) {
        try {
          const { locationQueueService } = require('./locationQueueService');
          await locationQueueService.clearQueue();
        } catch { /* silent */ }
      }
      // ✅ Critical: clear stale flag so this session's task path acts as
      // fallback until Transistor.start() succeeds.
      await AsyncStorage.removeItem(TRANSISTOR_ACTIVE_KEY);

      // ✅ Always reset LAST_SENT_KEY to '0'. FIX 5 ensures the first fire
      // stores position without sending, so we no longer need the
      // "raceAlreadyStarted ? '0' : now" conditional — the race-start gate
      // inside processLocationForSend handles pre-race blocking.
      await AsyncStorage.setItem(LAST_SENT_KEY, '0');

      // ✅ TRANSISTOR — sole GPS engine for both background sends AND the
      // foreground UI display. Native foreground service + WakeLock keeps the
      // SDK alive on Samsung One UI without the expo-location task or
      // background-fetch keepalive that earlier versions needed. Non-fatal
      // try/catch — if Transistor fails, the no-op task above still acts as a
      // safety net for older app installs.
      try {
        // Defensive: clear any listeners left over from a previous start.
        try { BackgroundGeolocation.removeListeners(); } catch { /* silent */ }

        await BackgroundGeolocation.ready({
          geolocation: {
            desiredAccuracy:              BackgroundGeolocation.DesiredAccuracy.High,
            locationAuthorizationRequest: 'Always',
            distanceFilter:               0,
            locationUpdateInterval:       fixIntervalMs(intervalSeconds),
            fastestLocationUpdateInterval: 5000,
            disableStopDetection:         true,
            stopTimeout:                  5,
            pausesLocationUpdatesAutomatically: false,
            showsBackgroundLocationIndicator:   true,
            activityType:                 BackgroundGeolocation.ActivityType.Fitness,
            allowIdenticalLocations:      true,
          },
          activity: {
            activityRecognitionInterval:  10000,
            disableMotionActivityUpdates: false,
          },
          app: {
            stopOnTerminate:   false,
            startOnBoot:       false,
            heartbeatInterval: 60,
            preventSuspend:    true,
            notification: {
              title: notificationTitle ?? 'Live Tracking Active',
              text:  notificationBody  ?? 'Your location is being tracked.',
              color: '#1a73e8',
            },
            // ✅ rationale goes here, in the app (AppConfig) domain
            backgroundPermissionRationale: {
              title:          i18n.t('home:tracking.bgPermission.title'),
              message:        i18n.t('home:tracking.bgPermission.message'),
              positiveAction: i18n.t('home:tracking.bgPermission.positiveAction'),
              negativeAction: i18n.t('home:tracking.bgPermission.negativeAction'),
            },
          },
          logger: {
            logLevel: API_CONFIG.DEBUG
              ? BackgroundGeolocation.LogLevel.Verbose
              : BackgroundGeolocation.LogLevel.Off,
            debug: false,
          },
          reset: true,
        });

        // ✅ Register onLocation / onMotionChange / onHeartbeat via the shared
        // helper so the watchdog + cold-relaunch paths can re-attach them too.
        // (ready() above already cleared listeners; the helper does too — safe.)
        _registerTransistorListeners();

        await BackgroundGeolocation.start();

        // ✅ Force MOVING state immediately after start. Required because we set
        // activity.disableMotionActivityUpdates: true — without changePace(true)
        // the SDK stays in STATIONARY state and onLocation never fires.
        try { await BackgroundGeolocation.changePace(true); } catch { /* already moving */ }

        // Mark Transistor as the active sender.
        await AsyncStorage.setItem(TRANSISTOR_ACTIVE_KEY, '1');

        await addLog('🛰️', 'Transistor started — native WakeLock active');
        if (API_CONFIG.DEBUG) console.log('✅ Transistor started');
      } catch (transistorErr: any) {
        // Non-fatal — clean up any partially registered listeners.
        try { BackgroundGeolocation.removeListeners(); } catch { /* silent */ }
        try { await AsyncStorage.removeItem(TRANSISTOR_ACTIVE_KEY); } catch { /* silent */ }
        await addLog('⚠️', `Transistor start failed: ${transistorErr?.message ?? 'unknown'}`);
        if (API_CONFIG.DEBUG) console.warn('⚠️ Transistor failed to start:', transistorErr?.message);
      }

      // ✅ Wire up the UI callback. Transistor's onLocation handler above reads
      // _uiCallback on every fix to drive the HomeScreen live display — no
      // separate expo-location watch. _registerFgAppStateListener is kept for
      // lightweight lifecycle logging and idempotent teardown.
      _uiCallback = callback;
      _uiIntervalMs = Math.min(intervalSeconds * 1000, 5000);
      await _startFgWatch();
      _registerFgAppStateListener();

      return {
        remove: async () => {
          // ✅ Delegate to the module-level _doFullStop so the handle returned
          // here and the standalone stopWatching() export do exactly the
          // same thing. Idempotent.
          await _doFullStop();
        },
      };
    } catch (error) {
      if (API_CONFIG.DEBUG) console.error('❌ Error watching GPS position:', error);
      if (errorCallback) errorCallback(error as Error);
      throw error;
    }
  },
};