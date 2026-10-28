// ✅ TRACKING SAFETY NET (2026-10-24, Grizzly100 race-morning review).
//
// Five of ~139 runners pressed Start (start ping on the server, every permission
// right, current OTA) and then sent NOTHING: no fix, no 5-min interim log, no
// API call at all — the OS had suspended or killed Livio before or at the gun.
// RaceResult showed all five past the start mat and most past CP1. Three more
// went quiet mid-race. The server cannot reach a dead app, and every in-app
// warning (GPS health, Battery Saver, start failed) is sent BY the running app.
//
// What still works when the app is dead: notifications the OS has already
// SCHEDULED. So the app schedules them while it is alive and keeps pushing them
// back while it stays alive; if it dies, the last one fires and a tap reopens
// Livio, which restores the session (HomeScreen restore + rehydrateTracking).
//
//  1. CHECK    — at Start: "not tracking yet" for gun + 4 min (or now + 4 min
//                when started after the gun). Cancelled by the first sign of
//                life in the race. Catches the silent starts.
//  2. WATCHDOG — every sign of life in the race moves it to now + 15 min
//                (throttled to once a minute). Fires 15 min after the app died.
//                Catches the runners who go quiet mid-race.
//  6. EARLY    — Start pressed more than 30 min before the gun (the Android
//                silent starts pressed 40-53 min early): "open Livio once" at
//                gun - 10 min.
//  7. NOT SENDING — the app is alive and recording, but nothing has reached the
//                server for NOT_SENDING_MS while fixes wait in the offline queue:
//                "check mobile data / data roaming", shown at once (needs no
//                network). 08:20 review: bib 1269 (iOS) recorded the whole race
//                and sent NOTHING from 05:51 to 08:45 — 190 fixes in one burst
//                when Livio was opened; bib 410 the same 06:47-07:49. Neither
//                made a single request in that time although the 30 s probe
//                (locationQueueService.hasNetwork) tries the API whatever
//                NetInfo says, so the phone had no working data. The course runs
//                along the BE/NL border — data roaming off is a likely cause,
//                not proven. The watchdog cannot see it (queued fixes are life)
//                and the server push cannot reach a phone without data. 20 min:
//                replayed on the 08:20 prod copy, 15 min also flags three
//                16-18 min dead zones, 20 min only the real outages (410 62 min,
//                353 36 min, 501 30 min). Once per outage; withdrawn on the
//                first accepted send.
//
// "Sign of life" = a GPS event that reached the send path after the gun, OR an
// engine heartbeat after the gun. The heartbeat matters: it fires every 60 s
// even standing still (preventSuspend), so a runner in the start crowd (13
// phones had no fix yet at gun + 5 min on 2026-10-24) or at an aid station is
// alive and gets no false alarm.
//
// Fixed identifiers: scheduling again REPLACES the pending notification, so
// nothing stacks. Notifications denied → every call is a silent no-op; this
// must never affect tracking.
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '../i18n';

export const SAFETY_CHECK_ID = 'livio-tracking-check';
export const SAFETY_WATCHDOG_ID = 'livio-tracking-watchdog';
export const SAFETY_EARLY_ID = 'livio-early-start-reminder';
export const SAFETY_NOT_SENDING_ID = 'livio-not-sending';

export const CHECK_AFTER_GUN_MS = 4 * 60 * 1000;
export const WATCHDOG_MS = 15 * 60 * 1000;
export const WATCHDOG_MIN_RESCHEDULE_MS = 60 * 1000;
export const EARLY_START_MS = 30 * 60 * 1000;
export const EARLY_REMIND_BEFORE_GUN_MS = 10 * 60 * 1000;
export const NOT_SENDING_MS = 20 * 60 * 1000;
// One AsyncStorage write per accepted send at most every 30 s (5 s fixes near
// the finish); the 20-min rule does not need it finer.
const LAST_SENT_WRITE_MS = 30 * 1000;

// Persisted, not in memory: the headless task, the heartbeat and the UI each run
// in whichever JS context the OS gave them.
// ALIVE_SEEN holds the time of the first sign of life after the gun: the
// not-sending clock starts there when nothing has been sent yet (bib 1269).
const ALIVE_SEEN_KEY = '@PFSLive:safetyAliveSeen';
const WATCHDOG_AT_KEY = '@PFSLive:safetyWatchdogScheduledAt';
const LAST_SENT_KEY = '@PFSLive:safetyLastSentAt';
const NOT_SENDING_WARNED_KEY = '@PFSLive:safetyNotSendingWarnedFor';
// Same literal as locationQueueService's QUEUE_COUNT_KEY — re-declared, not
// imported, like the other cross-service keys (no import cycles).
const QUEUE_COUNT_KEY = '@PFSLive:locationQueueCount';
// gpsService's RACE_FINISHED_KEY / TRACKING_PARAMS_KEY, re-declared the same way.
const RACE_FINISHED_KEY = '@PFSLive:raceFinished';
const TRACKING_PARAMS_KEY = '@PFSLive:trackingParams';

// Session over (finished, or stopped: params removed)? A sign of life that
// lands after that must not re-arm the watchdog (2026-10-28: a heartbeat in
// flight while the finish disarmed rescheduled "Livio stopped tracking").
const sessionOver = async (): Promise<boolean> => {
  try {
    return (await AsyncStorage.getItem(RACE_FINISHED_KEY)) === '1'
        || (await AsyncStorage.getItem(TRACKING_PARAMS_KEY)) === null;
  } catch { return false; }
};

let _lastSentWriteAt = 0;   // per JS context; only throttles the write

export interface SafetyPlan { checkAt: number | null; earlyAt: number | null; }

/** What to schedule at Start. Pure — tested without a phone. */
export function planSafetyArm(gunMs: number | null, nowMs: number, manualStart: boolean): SafetyPlan {
  if (manualStart) return { checkAt: nowMs + CHECK_AFTER_GUN_MS, earlyAt: null };
  if (gunMs === null || !isFinite(gunMs)) return { checkAt: null, earlyAt: null };
  const checkAt = Math.max(gunMs, nowMs) + CHECK_AFTER_GUN_MS;
  const earlyAt = gunMs - nowMs > EARLY_START_MS ? gunMs - EARLY_REMIND_BEFORE_GUN_MS : null;
  return { checkAt, earlyAt };
}

/** Move the watchdog now? At most once a minute; a stamp in the future (clock change) re-arms. */
export function shouldRescheduleWatchdog(lastScheduledMs: number | null, nowMs: number): boolean {
  if (lastScheduledMs === null || !isFinite(lastScheduledMs)) return true;
  if (lastScheduledMs > nowMs) return true;
  return nowMs - lastScheduledMs >= WATCHDOG_MIN_RESCHEDULE_MS;
}

/**
 * Warn "recording but not sending"? Pure — tested without a phone. Fixes must be
 * waiting (an empty queue with no sends is a runner standing still, not an
 * outage); the clock runs from the last accepted send, or from the first sign
 * of life after the gun when nothing was ever sent. One warning per outage: an
 * outage is identified by its last send (0 = none yet).
 */
export function shouldWarnNotSending(queueCount: number, lastSentMs: number | null, aliveSinceMs: number | null,
                                     warnedFor: string | null, nowMs: number): boolean {
  if (!(queueCount > 0)) return false;
  const since = lastSentMs ?? aliveSinceMs;
  if (since === null || !isFinite(since)) return false;
  if (nowMs - since < NOT_SENDING_MS) return false;
  return warnedFor !== String(lastSentMs ?? 0);
}

/** A stored epoch-ms value, or null (missing, unparsable, or not a real time). */
const readMs = (v: string | null): number | null => {
  if (v === null) return null;
  const n = parseInt(v, 10);
  return isFinite(n) && n > 1e12 ? n : null;
};

const schedule = async (id: string, at: number, title: string, body: string): Promise<void> => {
  await Notifications.scheduleNotificationAsync({
    identifier: id,
    // No race_id / event_name: a tap must only OPEN Livio (useNotifications
    // routes to result details only when both are present).
    content: { title, body, data: { type: 'tracking_check' } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(at) },
  });
};

const cancel = async (id: string): Promise<void> => {
  try { await Notifications.cancelScheduledNotificationAsync(id); } catch { /* silent */ }
};

// Withdraw the not-sending warning from the notification centre (it was shown,
// not scheduled). Never throws.
const withdrawNotSending = async (): Promise<void> => {
  await cancel(SAFETY_NOT_SENDING_ID);
  try { await Notifications.dismissNotificationAsync(SAFETY_NOT_SENDING_ID); } catch { /* silent */ }
};

const checkNotSending = async (now: number): Promise<void> => {
  const queueCount = parseInt((await AsyncStorage.getItem(QUEUE_COUNT_KEY)) ?? '0', 10) || 0;
  const lastSent = readMs(await AsyncStorage.getItem(LAST_SENT_KEY));
  const aliveSince = readMs(await AsyncStorage.getItem(ALIVE_SEEN_KEY));
  const warnedFor = await AsyncStorage.getItem(NOT_SENDING_WARNED_KEY);
  if (!shouldWarnNotSending(queueCount, lastSent, aliveSince, warnedFor, now)) return;
  // Marked first: if notifications are denied the attempt is not repeated every minute.
  await AsyncStorage.setItem(NOT_SENDING_WARNED_KEY, String(lastSent ?? 0));
  await Notifications.scheduleNotificationAsync({
    identifier: SAFETY_NOT_SENDING_ID,
    content: { title: i18n.t('home:safety.notSendingTitle'), body: i18n.t('home:safety.notSendingBody'), data: { type: 'tracking_check' } },
    trigger: null,   // now — a phone without data still shows a local notification
  });
};

export const trackingSafetyService = {
  /** At Start, once the engine runs. Never throws. */
  async arm(opts: { raceStartTime: string | null | undefined; manualStart: boolean; now?: number }): Promise<SafetyPlan> {
    const now = opts.now ?? Date.now();
    const gun = opts.raceStartTime ? new Date(opts.raceStartTime).getTime() : null;
    const plan = planSafetyArm(gun !== null && isNaN(gun) ? null : gun, now, opts.manualStart);
    try {
      _lastSentWriteAt = 0;
      await AsyncStorage.multiRemove([ALIVE_SEEN_KEY, WATCHDOG_AT_KEY, LAST_SENT_KEY, NOT_SENDING_WARNED_KEY]);
      await cancel(SAFETY_WATCHDOG_ID);
      await cancel(SAFETY_CHECK_ID);
      await cancel(SAFETY_EARLY_ID);
      await withdrawNotSending();
      if (plan.checkAt !== null) {
        await schedule(SAFETY_CHECK_ID, plan.checkAt, i18n.t('home:safety.checkTitle'), i18n.t('home:safety.checkBody'));
      }
      if (plan.earlyAt !== null) {
        await schedule(SAFETY_EARLY_ID, plan.earlyAt, i18n.t('home:safety.earlyTitle'), i18n.t('home:safety.earlyBody'));
      }
      // The engine already runs: a fix after the gun can reach onAlive while
      // this was scheduling. It then set ALIVE_SEEN and cancelled a check that
      // did not exist yet, and no later onAlive cancels it any more ("not
      // tracking yet" for a healthy runner, 2026-10-28 review). Alive → take
      // both back now.
      if ((await AsyncStorage.getItem(ALIVE_SEEN_KEY)) !== null) {
        await cancel(SAFETY_CHECK_ID);
        await cancel(SAFETY_EARLY_ID);
      }
    } catch { /* notifications denied / unavailable — never block tracking */ }
    return plan;
  },

  /** A sign of life after the gun (send path or heartbeat). Cheap on every fix. Never throws. */
  async onAlive(now: number = Date.now()): Promise<void> {
    try {
      if (await sessionOver()) return;
      if ((await AsyncStorage.getItem(ALIVE_SEEN_KEY)) === null) {
        await AsyncStorage.setItem(ALIVE_SEEN_KEY, String(now));
        await cancel(SAFETY_CHECK_ID);
        await cancel(SAFETY_EARLY_ID);
      }
      const lastStr = await AsyncStorage.getItem(WATCHDOG_AT_KEY);
      const last = lastStr === null ? null : parseInt(lastStr, 10);
      if (!shouldRescheduleWatchdog(last === null || isNaN(last) ? null : last, now)) return;
      await AsyncStorage.setItem(WATCHDOG_AT_KEY, String(now));
      await schedule(SAFETY_WATCHDOG_ID, now + WATCHDOG_MS, i18n.t('home:safety.watchdogTitle'), i18n.t('home:safety.watchdogBody'));
      // The finish may have disarmed while we were scheduling: take it back.
      if (await sessionOver()) { await cancel(SAFETY_WATCHDOG_ID); return; }
      // Same once-a-minute cadence as the watchdog (fixes and the 60 s heartbeat).
      await checkNotSending(now);
    } catch { /* never affect tracking */ }
  },

  /** The API accepted a fix (live or drained from the queue). Never throws. */
  async onSent(now: number = Date.now()): Promise<void> {
    try {
      if (now - _lastSentWriteAt < LAST_SENT_WRITE_MS && now >= _lastSentWriteAt) return;
      _lastSentWriteAt = now;
      await AsyncStorage.setItem(LAST_SENT_KEY, String(now));
      if ((await AsyncStorage.getItem(NOT_SENDING_WARNED_KEY)) !== null) {
        await AsyncStorage.removeItem(NOT_SENDING_WARNED_KEY);
        await withdrawNotSending();
      }
    } catch { /* never affect tracking */ }
  },

  /** Session over (Stop, finish, stale stop). Never throws. */
  async disarm(): Promise<void> {
    await cancel(SAFETY_CHECK_ID);
    await cancel(SAFETY_WATCHDOG_ID);
    await cancel(SAFETY_EARLY_ID);
    await withdrawNotSending();
    _lastSentWriteAt = 0;
    try { await AsyncStorage.multiRemove([ALIVE_SEEN_KEY, WATCHDOG_AT_KEY, LAST_SENT_KEY, NOT_SENDING_WARNED_KEY]); } catch { /* silent */ }
  },
};
