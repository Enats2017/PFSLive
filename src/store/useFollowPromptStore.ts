import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { notificationPermissionService } from '../services/notificationPermissionService';
import { analyticsService } from '../services/analyticsService';

/**
 * The fan's notification ask — after a follow, never on launch.
 *
 * useFollowManager lives in ~10 screens, each with its own hook instance, so
 * the sheet is ONE global component (FollowNotificationPrompt, mounted in
 * AppNavigator) driven by this store rather than a modal per screen.
 *
 * Shown only when the OS could still show its prompt (status not granted and
 * canAskAgain) — a sheet whose button can do nothing is worse than none; those
 * users have the Notifications screen. After "Not now", not again for 30 days.
 */
const DISMISSED_AT_KEY = '@PFSLive:followPromptDismissedAt';
const COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

interface FollowPromptState {
  visible: boolean;
  show: () => void;
  hide: () => void;
}

export const useFollowPromptStore = create<FollowPromptState>((set) => ({
  visible: false,
  show: () => set({ visible: true }),
  hide: () => set({ visible: false }),
}));

let checking = false;
// The sheet's own OS permission dialog is up: a follow finishing meanwhile
// must not open the sheet again (and log "shown" twice).
let asking = false;
export function setFollowPromptAsking(v: boolean): void { asking = v; }

/** Call after a follow succeeded. Cheap and silent when nothing should show. */
export async function maybePromptNotificationsAfterFollow(): Promise<void> {
  if (checking || asking || useFollowPromptStore.getState().visible) return;
  checking = true;
  try {
    if (!notificationPermissionService.isAvailable()) return;
    const perm = await notificationPermissionService.getState();
    if (perm.status === 'granted' || !perm.canAskAgain) return;

    const dismissedAt = Number(await AsyncStorage.getItem(DISMISSED_AT_KEY));
    if (dismissedAt && Date.now() - dismissedAt < COOLDOWN_MS) return;

    void analyticsService.logNotificationAsk('follow', 'shown');
    useFollowPromptStore.getState().show();
  } catch {
    /* never block a follow */
  } finally {
    checking = false;
  }
}

export async function markFollowPromptDismissed(): Promise<void> {
  try {
    await AsyncStorage.setItem(DISMISSED_AT_KEY, String(Date.now()));
  } catch { /* silent */ }
}
