/**
 * Application Configuration
 * Uses environment variables for flexibility across environments
 */
import * as Application from "expo-application";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { tokenService } from "../services/tokenService";

export const getDeviceId = async (): Promise<string> => {
  try {
    // Check if already stored
    const stored = await AsyncStorage.getItem("device_id");
    if (stored) return stored;

    // Get from device
    let deviceId = "";
    if (Platform.OS === "android") {
      deviceId = Application.getAndroidId() ?? "";
    } else {
      deviceId = (await Application.getIosIdForVendorAsync()) ?? "";
    }

    // Fallback if empty
    if (!deviceId) {
      deviceId = `fallback_${Date.now()}`;
    }

    // Save for future use
    await AsyncStorage.setItem("device_id", deviceId);
    console.log("📱 Device ID:", deviceId);
    return deviceId;
  } catch (error) {
    console.log("❌ Device ID error:", error);
    return "unknown_device";
  }
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
    

    // Participants
    DELETE_PARTICIPANT: "/delete_participant_app_api.php",
    PARTICIPANT_LOCATION: "/insert_participant_location_api.php",
    PARTICIPANT_STATS: "/participants/:participantId/stats.php",
    VERSION_CHECK: '/check_update_api.php',

    GET_RESULT_DETAIL: '/get_result_detail_api.php',
    GET_LIVE_TRACKING: '/get_live_tracking_data_api.php',
    SYNC_FOLLOW_DATA: '/update_follower_favourites_api.php',
    update_customer_setting: '/update_customer_setting_api.php',
    VERIFY_TRACKING_PASSWORD: '/verify_tracking_password_api.php'
  },

  TIMEOUT: 15000,
  HOME_DATA_POLL_INTERVAL: 30000, // ✅ 5 minutes
  LOCATION_UPDATE_INTERVAL: 5000,
  FOLLOWER_POLL_INTERVAL: 3000,

  USE_MOCK_DATA: false,

  // ✅ Debug flag for development
  DEBUG: true, // true in development, false in production

  /**
   * Get request headers with current auth token
   */
  async getHeaders(): Promise<Record<string, string>> {
    const token = await tokenService.getToken();
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
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
  VERSION: "1.0.0",
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

// export const getImageUrl = (url?: string | null): string | null => {
//   if (!url) return null;

//   const baseUrl = process.env.EXPO_PUBLIC_IMAGE_URL;

//   // Replace localhost with your actual IP
//   return url.replace("http://localhost/larssie", baseUrl!);
// };
