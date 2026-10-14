// src/utils/deviceSettings.ts
//
// Settings routes shared by the start-time permission modal (HomeScreen), the
// home readiness card and the Get race-ready screen. Moved VERBATIM out of
// HomeScreen — the comments below record why each route is what it is.

import { Linking, Platform } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';

export const ANDROID_PACKAGE = 'eu.passionforsports.livio';

/**
 * Open system dialog to exempt app from battery optimization.
 * HomeScreen provides the visual background behind the system dialog.
 * Called once on first install â€” permanent, zero cost on non-event days.
 */
export const requestBatteryOptimizationExemption = async (): Promise<void> => {
  if (Platform.OS !== 'android') return;
  try {
    await IntentLauncher.startActivityAsync(
      IntentLauncher.ActivityAction.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
      { data: `package:${ANDROID_PACKAGE}` }
    );
  } catch {
    // Fallback â€” open battery optimization list directly
    await IntentLauncher.startActivityAsync(
      'android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS'
    );
  }
};

export type PermissionBlockReason = 'denied' | 'no_background_perm' | 'location_off';

/**
 * Take the runner to the page that fixes THEIR problem, and actually land on
 * it â€” not on App info with a list of instructions to follow.
 *
 * Android publishes an intent for the device Location toggle, so 'location_off'
 * is exact. The per-app permission page has no public intent, so:
 *   1. MANAGE_APP_PERMISSIONS -> Livio's permission list, one tap from Location.
 *   2. APPLICATION_DETAILS_SETTINGS -> App info. The old behaviour; always resolves.
 *
 * DELIBERATELY NOT USED: MANAGE_APP_PERMISSION (singular), which targets the
 * Location page itself. It requires Intent.EXTRA_USER, a Parcelable UserHandle,
 * and expo-intent-launcher can only carry plain JS values in `extra`. Without it
 * the activity still RESOLVES â€” so no exception is thrown and the ladder never
 * falls through â€” then finishes immediately. The runner sees a flash and lands
 * nowhere, which is worse than App info. It cannot be fixed from JS; reaching
 * that page needs a native module.
 *
 * Falling through is otherwise safe: IntentLauncherModule.kt wraps
 * startActivityForResult in try/catch(Throwable) -> promise.reject, so an OEM
 * that does not export a tier rejects rather than crashing. That promise only
 * settles when the user RETURNS, so a tier that does launch cannot fall through
 * and open a second screen behind it.
 *
 * iOS has no per-page deep link at all (the App-Prefs: schemes are private API
 * and get apps rejected), so openSettings() lands on Livio's own page, where
 * Location is a single row.
 */
export const openLocationSettingsFor = async (reason: PermissionBlockReason): Promise<void> => {
  if (Platform.OS !== 'android') {
    Linking.openSettings().catch(() => { /* silent */ });
    return;
  }

  if (reason === 'location_off') {
    try {
      await IntentLauncher.startActivityAsync(
        IntentLauncher.ActivityAction.LOCATION_SOURCE_SETTINGS
      );
      return;
    } catch {
      // OEM without the activity â€” fall through to App info.
    }
  } else {
    try {
      await IntentLauncher.startActivityAsync('android.intent.action.MANAGE_APP_PERMISSIONS', {
        extra: { 'android.intent.extra.PACKAGE_NAME': ANDROID_PACKAGE },
      });
      return;
    } catch {
      // Fall through to App info.
    }
  }

  try {
    await IntentLauncher.startActivityAsync(
      IntentLauncher.ActivityAction.APPLICATION_DETAILS_SETTINGS,
      { data: `package:${ANDROID_PACKAGE}` }
    );
  } catch {
    Linking.openSettings().catch(() => { /* silent */ });
  }
};
