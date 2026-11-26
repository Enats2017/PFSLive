import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG } from '../constants/config';

// ✅ START REMINDERS (2026-10-20 re-check of races 18/19).
//
// 22 registered runners opened Livio before the gun (home answered "upcoming"),
// had a membership that allowed tracking, and never pressed START TRACKING —
// their followers polled an empty map all race (bib 113: 94 of 94 requests had
// no coordinate). The server's T-60 min push is the only nudge, it comes an hour
// early, and nothing tells a runner who still is not tracking at the gun.
//
// Two LOCAL notifications are scheduled from the home data the app already has:
// 10 min before the gun and 2 min after it. Local, so they need no server cron
// and reach exactly the runners who opened the app. They are re-planned on every
// home answer (an organiser can move the gun) and cancelled as soon as tracking
// runs, the race leaves home, or the runner logs out.
//
// Fixed identifiers: scheduling again REPLACES the pending one, so repeated
// syncs never stack duplicates.

export const START_REMINDER_PRE_ID = 'livio-start-reminder-pre';
export const START_REMINDER_POST_ID = 'livio-start-reminder-post';
export const START_REMINDER_PRE_MS = 10 * 60 * 1000;
export const START_REMINDER_POST_MS = 2 * 60 * 1000;

// Session params key (gpsService's TRACKING_PARAMS_KEY), re-declared locally to
// avoid importing gpsService — same convention as locationQueueService.
const TRACKING_PARAMS_KEY_LOCAL = '@PFSLive:trackingParams';

// ✅ Which participant the pending reminders are for (re-audit 2026-11-26).
// Deleting / editing ANY personal event cancelled both reminders, including
// those of the real next race. Written by sync() when it schedules, removed
// when nothing is pending; cancelIfFor() only cancels on a match.
export const START_REMINDER_PARTICIPANT_KEY = '@PFSLive:startReminderParticipant';

export interface StartReminderPlanItem {
  id: string;
  kind: 'pre' | 'post';
  at: Date;
}

/**
 * Pure: which reminders should be pending right now. Nothing when the runner is
 * not eligible (no Start offered, already tracking) or the gun is unknown;
 * otherwise each reminder whose time is still in the future.
 */
export function planStartReminders(
  gun: Date | null,
  nowMs: number,
  eligible: boolean,
): StartReminderPlanItem[] {
  if (!eligible || !gun || isNaN(gun.getTime())) return [];
  const plan: StartReminderPlanItem[] = [];
  const pre = gun.getTime() - START_REMINDER_PRE_MS;
  const post = gun.getTime() + START_REMINDER_POST_MS;
  if (pre > nowMs) plan.push({ id: START_REMINDER_PRE_ID, kind: 'pre', at: new Date(pre) });
  if (post > nowMs) plan.push({ id: START_REMINDER_POST_ID, kind: 'post', at: new Date(post) });
  return plan;
}

const cancelBoth = async (): Promise<void> => {
  for (const id of [START_REMINDER_PRE_ID, START_REMINDER_POST_ID]) {
    try { await Notifications.cancelScheduledNotificationAsync(id); } catch { /* silent */ }
  }
};

// ✅ One sync at a time (2026-11-26 audit). Each sync is read params → cancel
// both → schedule, all awaits. Start fires two syncs back to back (the fresh
// home answer with isGPSActive still false, then isGPSActive true): the steps
// interleaved, and the first one's schedule could land after the second one's
// cancels — a "you are not tracking" reminder left pending for a runner who
// is. Chained, the later sync always runs last and has the final word.
let _chain: Promise<unknown> = Promise.resolve();
const serial = <T,>(job: () => Promise<T>): Promise<T> => {
  const run = _chain.then(job, job);
  _chain = run.catch(() => undefined);
  return run;
};

export const startReminderService = {
  /**
   * Re-plan the reminders for the race home currently offers. `eligible` is the
   * screen's view (Start offered, not tracking); a stored live session overrides
   * it — right after a cold start the screen has not restored isGPSActive yet,
   * and a "you are not tracking" reminder must never reach a runner who is.
   */
  async sync(opts: {
    gun: Date | null;
    eligible: boolean;
    texts: { preTitle: string; preBody: string; postTitle: string; postBody: string };
    participantId?: number | string | null;   // home's next_race_participant_app_id
  }): Promise<StartReminderPlanItem[]> {
    // Not `this`: a detached call (const { sync } = …) must still work.
    return serial(() => startReminderService._syncNow(opts));
  },

  async _syncNow(opts: {
    gun: Date | null;
    eligible: boolean;
    texts: { preTitle: string; preBody: string; postTitle: string; postBody: string };
    participantId?: number | string | null;
  }): Promise<StartReminderPlanItem[]> {
    try {
      let eligible = opts.eligible;
      try {
        if ((await AsyncStorage.getItem(TRACKING_PARAMS_KEY_LOCAL)) !== null) eligible = false;
      } catch { /* unreadable — trust the screen */ }

      const plan = planStartReminders(opts.gun, Date.now(), eligible);
      await cancelBoth();
      for (const item of plan) {
        await Notifications.scheduleNotificationAsync({
          identifier: item.id,
          content: {
            title: item.kind === 'pre' ? opts.texts.preTitle : opts.texts.postTitle,
            body: item.kind === 'pre' ? opts.texts.preBody : opts.texts.postBody,
            data: { type: 'start_reminder' },
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: item.at },
        });
      }
      try {
        if (plan.length > 0 && opts.participantId != null && String(opts.participantId) !== '') {
          await AsyncStorage.setItem(START_REMINDER_PARTICIPANT_KEY, String(opts.participantId));
        } else {
          await AsyncStorage.removeItem(START_REMINDER_PARTICIPANT_KEY);
        }
      } catch { /* silent — cancelIfFor then leaves the reminders alone */ }
      return plan;
    } catch (e: any) {
      // Notifications denied / unavailable — a reminder must never break home.
      if (API_CONFIG.DEBUG) console.log('⚠️ start reminder sync failed:', e?.message);
      return [];
    }
  },

  /**
   * Cancel both reminders only when they belong to this participant row (a
   * personal event that was deleted or re-dated). Another race's reminders —
   * or reminders whose owner is unknown — are left for Home's next sync.
   * Never throws.
   */
  async cancelIfFor(participantId: number | string | null | undefined): Promise<boolean> {
    if (participantId == null || String(participantId) === '') return false;
    return serial(async () => {
      try {
        const owner = await AsyncStorage.getItem(START_REMINDER_PARTICIPANT_KEY);
        if (owner === null || owner !== String(participantId)) return false;
        await cancelBoth();
        await AsyncStorage.removeItem(START_REMINDER_PARTICIPANT_KEY);
        return true;
      } catch {
        return false;
      }
    });
  },

  /** Cancel both reminders (tracking started, logout). Never throws. */
  async cancel(): Promise<void> {
    // In the same queue as sync(): a cancel must not be overtaken by a sync
    // that started before it.
    await serial(() => cancelBoth());
  },
};
