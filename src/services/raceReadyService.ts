// src/services/raceReadyService.ts
//
// ✅ WHEN to show the "Get race-ready" flow.
//
// The permission moment for runners is right after they connect to a race —
// usually days before it, relaxed, with time to read. Never at the start line:
// a runner pressing Start on race morning taps through or says no.
//
// Shown at most ONCE per race, and only when something is actually missing.
// After that the home readiness card and the T-48h reminder do the nudging —
// no repeated popups.
//
// Triggers (all call maybeOpen):
//  - EventDetails/DistanceTab — in-app connect succeeded
//  - App.tsx livio://registration-confirmed — the email-verified connect
//  - PersonalEvent — a custom event was created
//  - HomeScreen — fallback once per race for anyone connected before this
//    shipped, or whose email link never opened the app

import AsyncStorage from '@react-native-async-storage/async-storage';
import { readinessService, ReadinessItem } from './readinessService';
import { navigationRef } from '../navigation/navigationRef';
import { analyticsService } from './analyticsService';
import { isTracking } from './gpsService';

const SHOWN_KEY = '@PFSLive:raceReadyShown';
// Keep the map small — races older than this can never trigger again anyway.
const MAX_AGE_MS = 120 * 24 * 60 * 60 * 1000;

// Keys with a maybeOpen() still running. Two triggers close together (Home
// refetch + connect, focus + poll) must not push the screen twice.
const inFlight = new Set<string>();
let markChain: Promise<void> = Promise.resolve();

/** Steps the flow can fix. Power saving is excluded: it's a race-morning toggle, not a setup step. */
export const RACE_READY_ITEMS: ReadinessItem[] = [
  'notifications',
  'location',
  'background',
  'locationServices',
  'battery',
];

/**
 * "Step x of y" for the flow. Counted from the steps actually SEEN, not a
 * snapshot at open: location and background are never missing together
 * (background only appears once location is granted), so a fixed total
 * showed "Step 2 of 2" twice. `seen` = every step that has been current.
 */
export function stepProgress(seen: ReadonlySet<string>, remaining: readonly string[]): { index: number; total: number } {
  let done = 0;
  seen.forEach((s) => { if (!remaining.includes(s)) done++; });
  return { index: done + 1, total: Math.max(done + remaining.length, 1) };
}

/**
 * Finish-screen outcome. Only a skipped step that is STILL missing counts:
 * a step skipped and then fixed in Settings (AppState refresh) is done.
 */
export function raceReadyOutcome(skipped: Iterable<string>, missing: readonly string[]): 'done' | 'skipped' {
  for (const s of skipped) if (missing.includes(s)) return 'skipped';
  return 'done';
}

/**
 * Background step: does the button open Settings instead of asking?
 * After a "the OS showed nothing" round trip, or on Android when the OS has
 * already said it won't ask again (runner once chose "While using" on the
 * system page). Not on iOS: canAskAgain can be false there before the
 * "Change to Always Allow" upgrade prompt was ever shown.
 */
export function backgroundOpensSettings(os: string, locationCanAskAgain: boolean | undefined, sentBefore: boolean): boolean {
  return sentBefore || (os === 'android' && locationCanAskAgain === false);
}

export type RaceReadySource = 'connect' | 'email_confirm' | 'custom_event' | 'home' | 'card';

async function readShown(): Promise<Record<string, number>> {
  try {
    const raw = await AsyncStorage.getItem(SHOWN_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    const now = Date.now();
    for (const k of Object.keys(map)) if (now - map[k] > MAX_AGE_MS) delete map[k];
    return map;
  } catch {
    return {};
  }
}

export const raceReadyService = {
  async wasShown(raceKey: string): Promise<boolean> {
    const map = await readShown();
    return !!map[raceKey];
  },

  markShown(raceKey: string): Promise<void> {
    // Serialised: two races marked at the same moment (Home all-set for one,
    // a connect for another) each read-modify-write the same map.
    markChain = markChain.then(async () => {
      try {
        const map = await readShown();
        map[raceKey] = Date.now();
        await AsyncStorage.setItem(SHOWN_KEY, JSON.stringify(map));
      } catch { /* silent — worst case it shows once more */ }
    });
    return markChain;
  },

  /** What the flow would ask for right now, in order. Empty = nothing to do. */
  async pendingItems(): Promise<ReadinessItem[]> {
    const state = await readinessService.getState();
    return state.missing.filter((m) => RACE_READY_ITEMS.includes(m));
  },

  /**
   * Opens the flow if this race hasn't had it and something is missing.
   * `raceKey` is the product_app_id; custom events use `custom_<id>` (their
   * ids come from another table and can collide). Safe to call
   * from anywhere — it waits for the navigator like App.tsx's GPX handler.
   */
  async maybeOpen(params: {
    raceKey: string | number | null | undefined;
    raceName?: string | null;
    source: RaceReadySource;
    /**
     * Navigate only if the user is still on this route when the checks finish.
     * The checks are async, and in the meantime a push-notification tap or a
     * deep link may have taken them elsewhere — never yank them off it. Not
     * marked shown when skipped, so a later visit can still trigger it.
     */
    onlyFromRoute?: string;
    /**
     * Last-moment veto, checked right before navigating (the checks before it
     * are async): e.g. Home returns false once one of its popups opened or
     * the runner started the Start sequence. Not marked shown when vetoed.
     */
    stillAllowed?: () => boolean;
  }): Promise<boolean> {
    try {
      // 0 / '0' / '' are "no race" (server defaults), never a key.
      const key = params.raceKey != null && params.raceKey !== '' && String(params.raceKey) !== '0'
        ? String(params.raceKey) : null;
      if (!key || inFlight.has(key)) return false;
      inFlight.add(key);
      try {
        return await this.openIfNeeded(key, params);
      } finally {
        inFlight.delete(key);
      }
    } catch {
      return false;
    }
  },

  async openIfNeeded(key: string, params: {
    raceName?: string | null;
    source: RaceReadySource;
    onlyFromRoute?: string;
    stillAllowed?: () => boolean;
  }): Promise<boolean> {
    if (await this.wasShown(key)) return false;
    // Never over a running session (manual/early start, or Home remounting
    // before it has restored isGPSActive).
    if (await isTracking()) return false;

    const pending = await this.pendingItems();
    if (pending.length === 0) {
      // Already ready — remember it, so a later revoke isn't popped up at
      // them; the readiness card covers that case.
      await this.markShown(key);
      return false;
    }

    // Wait up to 5s for the navigator (deep-link cold starts).
    for (let i = 0; i < 50 && !navigationRef.isReady(); i++) {
      await new Promise((r) => setTimeout(r, 100));
    }
    if (!navigationRef.isReady()) return false;
    const routeNow = navigationRef.getCurrentRoute()?.name;
    if (routeNow === 'RaceReady') return false;
    if (params.onlyFromRoute && routeNow !== params.onlyFromRoute) {
      return false;
    }
    if (params.stillAllowed && !params.stillAllowed()) return false;

    // Navigate in the SAME tick as the checks above: awaiting the storage
    // write first let a Start tap in between put this screen behind the
    // Start confirmation.
    const marking = this.markShown(key);
    void analyticsService.logRaceReadyStep('shown', undefined, params.source);
    navigationRef.navigate('RaceReady', {
      race_name: params.raceName ?? undefined,
      source: params.source,
    });
    await marking;
    return true;
  },
};
