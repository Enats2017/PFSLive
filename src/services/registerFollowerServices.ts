// services/followerApi.ts

import { API_CONFIG, APP_CONFIG, getApiEndpoint, getDeviceId } from "../constants/config";
import { apiClient } from "./api";
import { getCurrentLanguageId } from "../i18n";
import * as Application from "expo-application";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface RegisterFollowerParams {
  language_id?: number;
}

export interface RegisterFollowerRequest {
  device_id: string;
  expo_token: string;
  platform: "ios" | "android" | "";
  app_version: string;
  language_id: number | null;
}

export interface RegisterFollowerResponse {
  follower_id: number;
}

const getDevicePlatform = (): "ios" | "android" | "" => {
  if (Platform.OS === "ios") return "ios";
  if (Platform.OS === "android") return "android";
  return "";
};

const getAppVersion = (): string => {
  const version = Application.nativeApplicationVersion ?? "";
  return version.slice(0, 20);
};

const currentVersion = APP_CONFIG.VERSION;
console.log("11111",currentVersion);



export const followerApi = {
  /**
   * Register (or update) this device as a follower.
   * Uses an UPSERT on the server — safe to call on every app launch.
   *
   * @param expoToken  - Expo push token (ExponentPushToken[…] or ExpoPushToken[…])
   * @param params     - Optional overrides (language_id)
   * @returns          follower_id assigned by the server
   */
  registerFollower: async (
    expoToken: string,
    params: RegisterFollowerParams = {},
  ): Promise<RegisterFollowerResponse> => {
    try {
      const headers = await API_CONFIG.getHeaders();
      const device_id = await getDeviceId();
      const platform = getDevicePlatform();
      const app_version =  APP_CONFIG.VERSION;
      const language_id = params.language_id ?? getCurrentLanguageId() ?? null;

      const requestBody: RegisterFollowerRequest = {
        device_id,
        expo_token: expoToken,
        platform,
        app_version,
        language_id,
      };

      if (API_CONFIG.DEBUG) {
        console.log("📡 Registering follower:", {
          device_id,
          platform,
          app_version,
          language_id,
          expo_token: expoToken,
        });
      }

      const response = await apiClient.post<RegisterFollowerResponse>(
        getApiEndpoint(API_CONFIG.ENDPOINTS.SAVE_PUSH_TOKEN),
        requestBody,
        {
          headers,
          timeout: API_CONFIG.TIMEOUT,
        },
      );

      const data = response.data;

      if (data.follower_id) {
         await AsyncStorage.setItem("follower_app_id", String(data.follower_id));
      }

      if (API_CONFIG.DEBUG) {
        console.log("✅ Follower registered:", {
          follower_id: data.follower_id,
        });
      }

      return data;
    } catch (error: any) {
      if (API_CONFIG.DEBUG) {
        console.error("❌ Register follower error:", error);
      }
      throw new Error(
        error?.response?.data?.error ??
          error?.message ??
          "Failed to register follower",
      );
    }
  },
};