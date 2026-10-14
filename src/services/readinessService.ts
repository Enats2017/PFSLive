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
    if (notif.status !== 'granted') missing.push('notifications');
    if (!perm.foreground) missing.push('location');
    else if (!perm.background) missing.push('background');
    if (!servicesOn) missing.push('locationServices');
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
    try {
      const signature = `${state.location}|${state.notifications}|${state.trackingReady ? 1 : 0}`;
      const previous = await AsyncStorage.getItem(LAST_REPORTED_KEY);
      if (previous === signature) return;

      const headers = await API_CONFIG.getHeaders();
      await apiClient.post(
        getApiEndpoint(API_CONFIG.ENDPOINTS.UPDATE_DEVICE_READINESS),
        {
          device_id: await getDeviceId(),
          location_permission: state.location,
          notifications_enabled: state.notifications === 'granted' ? 1 : 0,
          tracking_ready: state.trackingReady ? 1 : 0,
          platform: Platform.OS,
          app_version: APP_CONFIG.VERSION,
        },
        { headers, timeout: API_CONFIG.TIMEOUT },
      );
      await AsyncStorage.setItem(LAST_REPORTED_KEY, signature);
    } catch {
      // Silent — retried on the next state change / next getState().
    }
  },
};
