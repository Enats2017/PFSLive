// src/services/readinessService.ts
//
// ✅ "Am I ready to race?" — read-only state + one-tap fixes.
//
// Shared by the home readiness card and the Get race-ready screen so both show
// the same truth. The point is TIMING: until now every one of these problems
// surfaced only when the runner pressed Start on race morning — the worst
// moment to ask anyone to read a permission dialog. This lets them find and fix
// it days before.
//
// Nothing here starts, configures or touches the Transistor tracking engine:
//  - location reads/requests go through gpsService.getPermissionState() /
//    requestPermissionsDetailed() (expo-location only — the same calls the
//    start-time modal already makes);
//  - isIgnoringBatteryOptimizations() is a read on Transistor's DeviceSettings
//    and needs no ready().
// The start gate in HomeScreen is unchanged and remains the last safety net.

import { Platform } from 'react-native';
import * as Battery from 'expo-battery';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BackgroundGeolocation from 'react-native-background-geolocation';
import { gpsService } from './gpsService';
import {
  notificationPermissionService,
  NotificationPermissionStatus,
} from './notificationPermissionService';
import { apiClient } from './api';
import { API_CONFIG, APP_CONFIG, getApiEndpoint, getDeviceId } from '../constants/config';

export type ReadinessItem = 'notifications' | 'location' | 'background' | 'locationServices' | 'battery' | 'powerSaving';

export interface ReadinessState {
  /** 'always' is the only level that tracks with the phone in a pocket. */
  location: 'always' | 'when_in_use' | 'denied';
  /** false = the OS will not ask again; the fix is a Settings trip. */
  locationCanAskAgain: boolean;
  locationServicesOn: boolean;
  notifications: NotificationPermissionStatus;
  notificationsCanAskAgain: boolean;
  /** Android only. null on iOS / when unreadable — never shown as a problem. */
  batteryExempt: boolean | null;
  powerSaving: boolean;
  /** Items that still need the runner, in the order they should be fixed. */
  missing: ReadinessItem[];
  /** True when nothing blocks tracking. Notifications/power saving don't block. */
  trackingReady: boolean;
}

async function readBatteryExempt(): Promise<boolean | null> {
  if (Platform.OS !== 'android') return null;
  try {
    return await BackgroundGeolocation.deviceSettings.isIgnoringBatteryOptimizations();
  } catch {
    return null;
  }
}

async function readPowerSaving(): Promise<boolean> {
  try {
    if (Platform.OS === 'android') {
      // Same read HomeScreen's start gate uses — more reliable on MIUI.
      const state = await Battery.getPowerStateAsync();
      return state.lowPowerMode === true;
    }
    return await Battery.isLowPowerModeEnabledAsync();
  } catch {
    return false;
  }
}

const LAST_REPORTED_KEY = '@PFSLive:readinessReported';

// The card and Get race-ready can call getState() at the same moment; the
// read-then-write signature check alone would let both POST.
let reportInFlight: string | null = null;

/** Server answers that mean "this exact request will never be accepted". */
const REJECTED_FOR_GOOD = new Set([
  'session_expired', 'unauthorized',
  'device_mismatch', 'device_id_invalid', 'location_permission_invalid',
]);

/** Short, non-reversible fingerprint of the login header (djb2). */
function loginFingerprint(authorization: string): string {
  let h = 5381;
  for (let i = 0; i < authorization.length; i++) h = ((h << 5) + h + authorization.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export const readinessService = {
  async getState(): Promise<ReadinessState> {
    const [perm, servicesOn, notif, batteryExempt, powerSaving] = await Promise.all([
      gpsService.getPermissionState(),
      gpsService.isLocationServiceEnabled().catch(() => true),
      notificationPermissionService.getState(),
      readBatteryExempt(),
      readPowerSaving(),
    ]);

    const missing: ReadinessItem[] = [];
    // Phone-wide location switch FIRST: with it off, iOS reports the app's
    // permission as unusable, and sending the runner to Livio's own settings
    // page (the location step) can't fix that — the switch has to come first.
    if (!servicesOn) missing.push('locationServices');
    if (notif.status !== 'granted') missing.push('notifications');
    if (!perm.foreground) missing.push('location');
    else if (!perm.background) missing.push('background');
    if (batteryExempt === false) missing.push('battery');
    if (powerSaving) missing.push('powerSaving');

    const state: ReadinessState = {
      location: perm.level,
      locationCanAskAgain: perm.canAskAgain,
      locationServicesOn: servicesOn,
      notifications: notif.status,
      notificationsCanAskAgain: notif.canAskAgain,
      batteryExempt,
      powerSaving,
      missing,
      trackingReady: perm.foreground && perm.background && servicesOn,
    };

    void this.reportToServer(state);
    return state;
  },

  /**
   * FOREGROUND only — the Get race-ready "location" step. Background is its
   * own step with its own explanation, because on Android 11+ the background
   * request jumps straight to a settings page and the OS grants that routing
   * roughly once; asking it before the runner has read why would waste it.
   * The background step then uses gpsService.requestPermissionsDetailed(),
   * exactly as the start-time modal does.
   */
  async requestForegroundLocation(): Promise<{ granted: boolean; canAskAgain: boolean }> {
    try {
      const res = await Location.requestForegroundPermissionsAsync();
      return { granted: res.status === 'granted', canAskAgain: res.canAskAgain !== false };
    } catch {
      return { granted: false, canAskAgain: false };
    }
  },

  /**
   * Tell the server this device's readiness, so the T-48h reminder can say
   * "finish your setup" to the right people. Only sent when it CHANGES.
   * Best effort: the endpoint ships with the growth API work; until then this
   * fails silently and is retried on the next change.
   */
  async reportToServer(state: ReadinessState): Promise<void> {
    const stateSig = `${state.location}|${state.notifications}|${state.trackingReady ? 1 : 0}`;
    // Claimed synchronously, before any await — a second caller in the same
    // tick sees it. Only the claimer releases it (finally, below).
    if (reportInFlight === stateSig) return;
    reportInFlight = stateSig;
    try {
      const headers = await API_CONFIG.getHeaders();
      // Runners only: the endpoint requires the runner's login token and only
      // accepts that account's own device (readiness feeds the runner's T-48h
      // reminder). Logged out = fan → nothing to report; nothing is stored
      // either, so it reports as soon as they log in.
      if (!headers.Authorization) return;

      // What was last reported is per DEVICE + LOGIN + state: a backup
      // restored onto a new phone (new device id) reports again, and so does
      // a fresh login after the server rejected an expired one.
      const deviceId = await getDeviceId();
      const signature = `${deviceId}|${loginFingerprint(headers.Authorization)}|${stateSig}`;
      const previous = await AsyncStorage.getItem(LAST_REPORTED_KEY);
      if (previous === signature) return;

      try {
        await apiClient.post(
          getApiEndpoint(API_CONFIG.ENDPOINTS.UPDATE_DEVICE_READINESS),
          {
            device_id: deviceId,
            location_permission: state.location,
            notifications_enabled: state.notifications === 'granted' ? 1 : 0,
            tracking_ready: state.trackingReady ? 1 : 0,
            platform: Platform.OS,
            app_version: APP_CONFIG.VERSION,
          },
          { headers, timeout: API_CONFIG.TIMEOUT },
        );
      } catch (error: any) {
        // Rejected for a reason that the SAME request will hit again (expired
        // login, device not this account's, invalid values) → remember it; it
        // is retried once the login, device or state changes. Everything else
        // — offline, 5xx, 429 rate limit, 404 not deployed yet, maintenance —
        // is temporary: retried on the next getState(). (api.ts maps every
        // 4xx to type 'empty', so the type alone can't tell them apart.)
        const rejected = REJECTED_FOR_GOOD.has(String(error?.code ?? ''));
        if (!rejected) return;
      }
      await AsyncStorage.setItem(LAST_REPORTED_KEY, signature);
    } catch {
      // Silent — retried on the next state change / next getState().
    } finally {
      if (reportInFlight === stateSig) reportInFlight = null;
    }
  },
};
