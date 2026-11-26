/**
 * Application Configuration
 * Uses environment variables for flexibility across environments
 */
import * as Application from "expo-application";
import * as SecureStore from 'expo-secure-store';
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { tokenService } from "../services/tokenService";
import { readStoredDeviceIdFrom, resolveUnstoredDeviceId, StoredRead } from "../services/deviceIdStore";

const DEVICE_ID_KEY = 'secure_device_id';

// ✅ Resolved once per app session. This is read on ~15 code paths (auth,
// favourites, push registration, tracking); without the cache each one redoes
// the OS call and the Keychain read.
let cachedDeviceId: string | null = null;
// ✅ Generated stand-in while the Keychain is unreadable AND there is no IDFV:
// stable for the session, memory only (never cachedDeviceId, never persisted).
let sessionFallbackDeviceId: string | null = null;

// ✅ Second copy of the same id, written readable-while-locked. See
// services/deviceIdStore.ts for why the legacy key is kept and never rewritten.
const DEVICE_ID_KEY_V2 = 'secure_device_id_v2';
const DEVICE_ID_V2_OPTS = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK } as const;

const readStoredDeviceId = async (): Promise<StoredRead> => {
  // SecureStore defaults to WHEN_UNLOCKED (the legacy key). Push registration
  // and background tasks can run while the phone is locked, where the read
  // throws rather than returning null - and a throw must not be mistaken for
  // "nothing stored" (audit 2026-11-26, finding 7).
  const result = await readStoredDeviceIdFrom({
    readV2: () => SecureStore.getItemAsync(DEVICE_ID_KEY_V2, DEVICE_ID_V2_OPTS),
    readLegacy: () => SecureStore.getItemAsync(DEVICE_ID_KEY),
    writeV2: async (value) => { await SecureStore.setItemAsync(DEVICE_ID_KEY_V2, value, DEVICE_ID_V2_OPTS); },
  });
  if (result.kind === 'failed' && API_CONFIG.DEBUG) console.log('⚠️ Device ID read failed (locked Keychain?)');
  return result;
};

const writeStoredDeviceId = async (value: string): Promise<void> => {
  // Legacy key as well: an OTA rollback to a bundle without the v2 key must
  // still find the id the account was locked to.
  try {
    await SecureStore.setItemAsync(DEVICE_ID_KEY, value);
  } catch (error) {
    if (API_CONFIG.DEBUG) console.log('⚠️ Device ID write failed:', error);
  }
  try {
    await SecureStore.setItemAsync(DEVICE_ID_KEY_V2, value, DEVICE_ID_V2_OPTS);
  } catch (error) {
    if (API_CONFIG.DEBUG) console.log('⚠️ Device ID v2 write failed:', error);
  }
};

/**
 * Stable per-device identifier. The account is locked to this value server-side
 * (oc_customer_app.device_id), so a value that changes is a lockout — the user
 * has to run the device transfer flow to get back in.
 *
 * Each platform keeps the source it already used, so upgrading the app does not
 * change the id of any working device:
 *   - Android: SSAID first. It survives uninstall/reinstall for a given signing
 *     key, which SecureStore does not (Android wipes app data on uninstall), so
 *     SecureStore would be a downgrade as the primary here.
 *   - iOS: the Keychain copy first. Raw IDFV resets once every app from this
 *     vendor is removed, so the first value seen is the one we keep.
 *
 * Neither survives a factory reset — the OS regenerates its identifier and
 * wipes the Keychain — and nothing client-side can change that. That case is
 * covered by the device transfer flow instead.
 */
export const getDeviceId = async (): Promise<string> => {
  if (cachedDeviceId) return cachedDeviceId;

  if (Platform.OS === 'android') {
    // Was: this fell through to getIosIdForVendorAsync() when getAndroidId()
    // returned falsy — an iOS-only call that throws on Android, landing every
    // such device on the shared 'unknown_device' string below.
    try {
      const androidId = Application.getAndroidId();
      if (androidId) {
        cachedDeviceId = androidId;
        return androidId;
      }
    } catch (error) {
      if (API_CONFIG.DEBUG) console.log('⚠️ getAndroidId failed:', error);
    }
  }

  const stored = await readStoredDeviceId();
  if (stored.kind === 'found') {
    cachedDeviceId = stored.value;
    return stored.value;
  }
  // ✅ The store could not be READ (locked Keychain) - not the same as empty.
  // Answer this one call with the OS id but neither cache nor persist it:
  // caching it is what made a whole background-started session send the wrong
  // device_id. The next call after unlock reads the real one.
  const readFailed = stored.kind === 'failed';

  let id = '';
  try {
    if (Platform.OS === 'ios') {
      id = (await Application.getIosIdForVendorAsync()) ?? '';
    }
  } catch (error) {
    if (API_CONFIG.DEBUG) console.log('⚠️ getIosIdForVendorAsync failed:', error);
  }

  // Was: 'unknown_device' — one literal shared by every device that failed,
  // so the first account to claim it locked out all the others, and the
  // server had no way to tell them apart. A random id is at least unique.
  // Not from expo-crypto: it is not installed and adding it forces a native
  // rebuild. This is an identifier, not a secret, and it is persisted on
  // first use (only when the store was readable - see resolveUnstoredDeviceId).
  const generate = () => {
    const g = `gen_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`;
    if (API_CONFIG.DEBUG) console.log('⚠️ No OS device id available, generated:', g);
    return g;
  };
  const decision = resolveUnstoredDeviceId({ readFailed, osId: id, sessionFallback: sessionFallbackDeviceId, generate });
  sessionFallbackDeviceId = decision.sessionFallback;
  id = decision.id;

  if (!decision.persistAndCache) return id;

  await writeStoredDeviceId(id);
  cachedDeviceId = id;
  return id;
};

const getApiUrl = (): string => {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;

  if (envUrl) {
    console.log("✅ Using API URL from .env:", envUrl);
    return envUrl;
  }

  console.warn("⚠️ EXPO_PUBLIC_API_URL not found in .env, using fallback");
  return "http://192.168.1.209/larssie/api";
};

 export const getImageBaseUrl = (): string => {
  const envUrl = process.env.EXPO_PUBLIC_IMAGE_URL;

  if (envUrl) {
    return envUrl;
  }

  return "http://192.168.0.199/larssie";
};



// Hardcoded fallback token (used until login is integrated)
const FALLBACK_TOKEN = "";

// API Configuration
export const API_CONFIG = {
  BASE_URL: getApiUrl(),

  get TOKEN() {
    return process.env.EXPO_PUBLIC_API_TOKEN || FALLBACK_TOKEN;
  },

  ENDPOINTS: {
    // Auth
    LOGIN: "/login_api.php",
    REGISTER: "/register_api.php",
    VERIFY_OTP: "/verify_otp_api.php", // ← add
    RESEND_OTP: "/resent_otp_api.php",
    // Step 1 of a device transfer: verifies the password, emails a 6-digit
    // code. Step 2 is VERIFY_OTP with purpose 'device_change'.
    DEVICE_CHANGE_REQUEST: "/device_change_request_api.php",


    // Home
    HOME: "/home_api.php",
    Personal_Event: "/create_custom_event_api.php",
    Edit_profile: "/get_profile_api.php",
    upadte_profile: "/edit_profile_api.php",
    ATHLETE_PROFILE:"/participant_profile_api.php",
    GET_EVENT_RANKING:"/get_event_ranking_api.php",
    GET_CUSTOM_EVENT:"/get_custom_event_api.php",
    UPDATE_CUSTOM_EVENT:"/edit_custom_event_api.php",
    // Events
    EVENTS_LIST: "/event_list_api.php",
    EVENT_DETAIL: "/event_detail_api.php",
    REGISTER_PARTICIPANT: "/insert_participant_app_api.php",
    PARTICIPANTS: "/participant_by_event_api.php",
    EVENT_GPX: "/events/:eventId/gpx.php",
    COUNTRIES: "/country_api.php",

    FORGOT_PASSWORD: "/forgot_password_api.php",
    RESET_PASSWORD: "/reset_password_api.php",
    GET_FAVOURITES: "/get_favourite_api.php",
    SAVE_PUSH_TOKEN: "/register_follower_api.php",
    GET_ALL_FAVOURITES: "/get_favourite_all_api.php",
    GET_MY_FOLLOWERS: "/get_my_favourites_all_api.php",
    
    // Participants
    DELETE_PARTICIPANT: "/delete_participant_app_api.php",
    PARTICIPANT_LOCATION: "/insert_participant_location_api.php",
    PARTICIPANT_STATS: "/participants/:participantId/stats.php",
    VERSION_CHECK: '/check_update_api.php',

    GET_RESULT_DETAIL: '/get_result_detail_api.php',
    GET_LIVE_TRACKING: '/get_live_tracking_data_api.php',
    SYNC_FOLLOW_DATA: '/update_follower_favourites_api.php',
    update_customer_setting: '/update_customer_setting_api.php',
    VERIFY_TRACKING_PASSWORD: '/verify_tracking_password_api.php',
    GET_FOLLOWER_DATA: '/get_follower_data_api.php',
    // Token-less follower identity. Both already exist server-side (livio_web
    // uses them); the app now calls them so a user who denied notifications
    // still gets a follower_id and their follows reach the server.
    REGISTER_GUEST_FOLLOWER: '/register_guest_follower.php',
    GET_FOLLOW_DATA_BY_DEVICE: '/get_follow_data_by_device.php',
    // Per-device permission state (location / notifications) — feeds the
    // T-48h reminder's "finish your setup" variant. Server endpoint is part of
    // the growth_v0.1 API work; until it exists the call fails silently.
    UPDATE_DEVICE_READINESS: '/update_device_readiness_api.php',
    SAVE_TRACKING_LOG: '/save_tracking_log_api.php',
    SAVE_TRACKING_START: '/save_tracking_start_api.php',
    HEARTBEAT_PING: '/heartbeat_ping_api.php',
    APPLE_MEMBERSHIP_PLANS: '/apple_get_plans_api.php',
    APPLE_VERIFY_PURCHASE: '/apple_verify_purchase_api.php',
    UPDATE_FOLLOWER_EMAIL: '/update_follower_email_api.php',
    follower_language: '/update_follower_language_api.php',
    DELETE_CUSTOM_EVENT: '/delete_custom_event_api.php',
     SUBMIT_FEEDBACK: '/feedback_api.php', 
  },

  TIMEOUT: 15000,
  HOME_DATA_POLL_INTERVAL: 300000, // ✅ 5 minutes
  LOCATION_UPDATE_INTERVAL: 5000,
  FOLLOWER_POLL_INTERVAL: 3000,

  USE_MOCK_DATA: false,

  // ✅ Debug flag for development
  DEBUG: process.env.EXPO_PUBLIC_ENV !== 'production', // true in development, false in production

  /**
   * Get request headers with current auth token
   */
  async getHeaders(): Promise<Record<string, string>> {
    const token = await tokenService.getToken();
    if(token) {
      return {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      };
    } else {
      return {
        "Content-Type": "application/json"
      };
    }
  },

  async getMutiForm(): Promise<Record<string, string>> {
    const token = await tokenService.getToken();
    return {
      "Content-Type": "multipart/form-data",
       Authorization: `Bearer ${token}`,
    };
  },

  /**
   * Get request headers synchronously
   */
  getHeadersSync(): Record<string, string> {
    const token = process.env.EXPO_PUBLIC_API_TOKEN || FALLBACK_TOKEN;
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  },
};

// App Configuration
export const APP_CONFIG = {
  APP_NAME: "PFSLive",
  // ✅ The installed binary's real version. Was the literal "1.0.2", never
  // bumped, so oc_follower_app.app_version said 1.0.2 for 5,000+ devices
  // running 1.0.9 and no failure could ever be tied to a build (2026-10-07
  // tracking audit). Same source as versionService.getCurrentVersion().
  VERSION: Application.nativeApplicationVersion ?? "unknown",
  // ✅ Public follower webapp (livio_web). The app lives under /livio_website —
  // liviolive.com itself is marketing-only and 404s these routes.
  // Overridable per environment (demo server) without a code change.
  WEB_BASE_URL: process.env.EXPO_PUBLIC_WEB_URL || "https://my.liviolive.com/livio_website",
};

// Map Configuration
export const MAP_CONFIG = {
  DEFAULT_ZOOM: 12,
  FOLLOW_MODE_ZOOM: 14,
  ANIMATION_DURATION: 800,
};

/**
 * Helper to get full API endpoint URL
 */
export const getApiEndpoint = (endpoint: string): string => {
  return `${API_CONFIG.BASE_URL}${endpoint}`;
};

/**
 * Helper to replace URL parameters (e.g., :eventId, :participantId)
 */
export const buildApiUrl = (
  endpoint: string,
  params: Record<string, string>,
): string => {
  let url = endpoint;

  Object.keys(params).forEach((key) => {
    url = url.replace(`:${key}`, params[key]);
  });

  return getApiEndpoint(url);
};

/**
 * Detect environment and provide appropriate localhost URL
 * 
 */
export const getLocalApiUrl = (): string => {
  const Platform = require("react-native").Platform;

  if (Platform.OS === "android" && __DEV__) {
    return "http://192.168.1.209/larssie/api";
  }

  if (Platform.OS === "ios" && __DEV__) {
    return "http://192.168.1.209/larssie/api";
  }

  return getApiUrl();
};

export const getImageUrl = (url?: string | null): string | null => {
  if (!url) return null;

  const baseUrl = process.env.EXPO_PUBLIC_IMAGE_URL;

  // Replace localhost with your actual IP
  return url;
  // return url.replace("http://localhost/larssie", baseUrl!);
};
