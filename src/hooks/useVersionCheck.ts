import { useState, useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { versionService, VersionCheckResult } from '../services/versionService';
import { API_CONFIG } from '../constants/config';

const LAST_CHECK_KEY = 'version_check_last_ts';
const MIN_INTERVAL_MS = 60 * 60 * 1000; // 1h — foreground toggling shouldn't spam the API

// ⚠️ VERIFY THIS KEY against gpsService. It's the same key the watchdog is guarded
// on (TRACKING_PARAMS_KEY) — its presence means a tracking session is live.
// If gpsService exports an isTracking() helper, call that instead.
const TRACKING_PARAMS_KEY = '@PFSLive:trackingParams';


async function isTrackingActive(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(TRACKING_PARAMS_KEY);
    return !!raw;
  } catch {
    return false;
  }
}

/**
 * App-wide version check: cold start plus every background→foreground
 * transition, throttled to once an hour.
 *
 * Lives at the root rather than on HomeScreen. The old useFocusEffect only fired
 * when Home gained focus, so someone who opened the app onto LiveTracking and
 * left it there for a day was never checked — exactly the session a forced
 * update most needs to reach.
 */
export function useVersionCheck() {
  const [updateInfo, setUpdateInfo] = useState<VersionCheckResult | null>(null);
  const [visible, setVisible] = useState(false);
  const appState = useRef(AppState.currentState);
  const inFlight = useRef(false);

  const check = useCallback(async (force = false) => {
    if (inFlight.current) return;

    if (!force) {
      const last = await AsyncStorage.getItem(LAST_CHECK_KEY);
      if (last && Date.now() - Number(last) < MIN_INTERVAL_MS) return;
    }

    inFlight.current = true;
    try {
      const result = await versionService.checkVersion();
      await AsyncStorage.setItem(LAST_CHECK_KEY, String(Date.now()));

      if (!result.needsUpdate) {
        if (API_CONFIG.DEBUG) console.log('✅ App is up to date');
        return;
      }

      // Never interrupt a live tracking session with a modal the runner can't
      // dismiss — updating means leaving the app mid-race, and the GPS session
      // would be torn down. Optional updates are deferred too: any modal over
      // the map during a race is the wrong call. The next foreground after they
      // stop tracking picks it up.
      if (await isTrackingActive()) {
        if (API_CONFIG.DEBUG) console.log('⏸️ Update available but deferred — tracking session active');
        return;
      }

      setUpdateInfo(result);
      setVisible(true);

      if (API_CONFIG.DEBUG) {
        console.log('⚠️ Update available:', {
          forced: result.isForced,
          current: result.currentVersion,
          latest: result.latestVersion,
        });
      }
    } catch (e) {
      if (API_CONFIG.DEBUG) console.error('❌ Version check failed:', e);
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    check(true);   // cold start always checks, ignoring the throttle

    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && next === 'active') {
        check();   // throttled
      }
      appState.current = next;
    });

    // AppState only fires on background→foreground. A user who opens the app and
    // moves between screens for hours never backgrounds it, so without this they'd
    // never be re-checked. The tick is frequent; check() itself is throttled to
    // MIN_INTERVAL_MS, so this just means the throttle is picked up promptly once
    // it expires rather than waiting for the next foreground.
    const POLL_MS = 5 * 60 * 1000;
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') check();
    }, POLL_MS);

    return () => {
      sub.remove();
      clearInterval(timer);
    };
  }, [check]);

  const dismiss = useCallback(() => {
    if (!updateInfo?.isForced) setVisible(false);   // forced updates can't be dismissed
  }, [updateInfo?.isForced]);

  return { updateInfo, visible, dismiss, recheck: () => check(true) };
}