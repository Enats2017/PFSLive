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

export const CHECK_AFTER_GUN_MS = 4 * 60 * 1000;
export const WATCHDOG_MS = 15 * 60 * 1000;
export const WATCHDOG_MIN_RESCHEDULE_MS = 60 * 1000;
export const EARLY_START_MS = 30 * 60 * 1000;
export const EARLY_REMIND_BEFORE_GUN_MS = 10 * 60 * 1000;

// Persisted, not in memory: the headless task, the heartbeat and the UI each run
// in whichever JS context the OS gave them.
const ALIVE_SEEN_KEY = '@PFSLive:safetyAliveSeen';
const WATCHDOG_AT_KEY = '@PFSLive:safetyWatchdogScheduledAt';

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

export const trackingSafetyService = {
  /** At Start, once the engine runs. Never throws. */
  async arm(opts: { raceStartTime: string | null | undefined; manualStart: boolean; now?: number }): Promise<SafetyPlan> {
    const now = opts.now ?? Date.now();
    const gun = opts.raceStartTime ? new Date(opts.raceStartTime).getTime() : null;
    const plan = planSafetyArm(gun !== null && isNaN(gun) ? null : gun, now, opts.manualStart);
    try {
      await AsyncStorage.multiRemove([ALIVE_SEEN_KEY, WATCHDOG_AT_KEY]);
      await cancel(SAFETY_WATCHDOG_ID);
      await cancel(SAFETY_CHECK_ID);
      await cancel(SAFETY_EARLY_ID);
      if (plan.checkAt !== null) {
        await schedule(SAFETY_CHECK_ID, plan.checkAt, i18n.t('home:safety.checkTitle'), i18n.t('home:safety.checkBody'));
      }
      if (plan.earlyAt !== null) {
        await schedule(SAFETY_EARLY_ID, plan.earlyAt, i18n.t('home:safety.earlyTitle'), i18n.t('home:safety.earlyBody'));
      }
    } catch { /* notifications denied / unavailable — never block tracking */ }
    return plan;
  },

  /** A sign of life after the gun (send path or heartbeat). Cheap on every fix. Never throws. */
  async onAlive(now: number = Date.now()): Promise<void> {
    try {
      if ((await AsyncStorage.getItem(ALIVE_SEEN_KEY)) !== '1') {
        await AsyncStorage.setItem(ALIVE_SEEN_KEY, '1');
        await cancel(SAFETY_CHECK_ID);
        await cancel(SAFETY_EARLY_ID);
      }
      const lastStr = await AsyncStorage.getItem(WATCHDOG_AT_KEY);
      const last = lastStr === null ? null : parseInt(lastStr, 10);
      if (!shouldRescheduleWatchdog(last === null || isNaN(last) ? null : last, now)) return;
      await AsyncStorage.setItem(WATCHDOG_AT_KEY, String(now));
      await schedule(SAFETY_WATCHDOG_ID, now + WATCHDOG_MS, i18n.t('home:safety.watchdogTitle'), i18n.t('home:safety.watchdogBody'));
    } catch { /* never affect tracking */ }
  },

  /** Session over (Stop, finish, stale stop). Never throws. */
  async disarm(): Promise<void> {
    await cancel(SAFETY_CHECK_ID);
    await cancel(SAFETY_WATCHDOG_ID);
    await cancel(SAFETY_EARLY_ID);
    try { await AsyncStorage.multiRemove([ALIVE_SEEN_KEY, WATCHDOG_AT_KEY]); } catch { /* silent */ }
  },
};
