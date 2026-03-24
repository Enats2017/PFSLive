import { API_CONFIG, APP_CONFIG, getApiEndpoint, getDeviceId } from "../constants/config";
import { apiClient } from "./api";
import { getCurrentLanguageId } from "../i18n";
import { Platform } from "react-native";

// ✅ Interfaces
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

// ✅ Helper functions
const getDevicePlatform = (): "ios" | "android" | "" => {
  if (Platform.OS === "ios") return "ios";
  if (Platform.OS === "android") return "android";
  return "";
};

// ✅ API
export const followerApi = {
  /**
   * Register or update device as a follower
   * Uses UPSERT on backend - safe to call multiple times
   */
  registerFollower: async (
    expoToken: string,
    params: RegisterFollowerParams = {}
  ): Promise<RegisterFollowerResponse> => {
    try {
      const headers = await API_CONFIG.getHeaders();
      const device_id = await getDeviceId();
      const platform = getDevicePlatform();
      const app_version = APP_CONFIG.VERSION;
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
          expo_token_preview: `${expoToken.substring(0, 20)}...`,
        });
      }

      const response = await apiClient.post<RegisterFollowerResponse>(
        getApiEndpoint(API_CONFIG.ENDPOINTS.SAVE_PUSH_TOKEN),
        requestBody,
        {
          headers,
          timeout: API_CONFIG.TIMEOUT,
        }
      );

      if (API_CONFIG.DEBUG) {
        console.log("✅ Follower registered:", {
          follower_id: response.data.follower_id,
        });
      }

      return response.data;
    } catch (error: any) {
      if (API_CONFIG.DEBUG) {
        console.error("❌ Register follower error:", error?.response?.data || error?.message);
      }

      throw new Error(
        error?.response?.data?.error ??
        error?.message ??
        "Failed to register follower"
      );
    }
  },
};