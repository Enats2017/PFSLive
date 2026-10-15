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

export interface GetFollowerDataResponse {
  follower_id: number;
  followed_customers: number[];
  followed_bibs: Record<string, string[]>;
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

  /**
   * Token-less follower row for this device (expo_token = ''). Returns the
   * existing follower_id if the device already has a row. A later
   * registerFollower() UPSERTs on device_id, so the id — and every follow
   * attached to it — survives the user switching notifications on.
   */
  registerGuestFollower: async (): Promise<RegisterFollowerResponse> => {
    const headers = await API_CONFIG.getHeaders();
    const device_id = await getDeviceId();
    const response = await apiClient.post<RegisterFollowerResponse>(
      getApiEndpoint(API_CONFIG.ENDPOINTS.REGISTER_GUEST_FOLLOWER),
      // language_id: the server stores it on the row (push copy language).
      { device_id, platform: getDevicePlatform(), app_version: APP_CONFIG.VERSION, language_id: getCurrentLanguageId() },
      { headers, timeout: API_CONFIG.TIMEOUT }
    );
    return response.data;
  },

  /** Same shape as getFollowerData, keyed on device_id — no token needed. */
  getFollowerDataByDevice: async (): Promise<GetFollowerDataResponse> => {
    const headers = await API_CONFIG.getHeaders();
    const device_id = await getDeviceId();
    const response = await apiClient.post<GetFollowerDataResponse>(
      getApiEndpoint(API_CONFIG.ENDPOINTS.GET_FOLLOW_DATA_BY_DEVICE),
      { device_id },
      { headers, timeout: API_CONFIG.TIMEOUT }
    );
    return response.data;
  },

  getFollowerData: async (
    expoToken: string,
  ): Promise<GetFollowerDataResponse> => {
    try {
      const headers = await API_CONFIG.getHeaders();
      const device_id = await getDeviceId();

      if (API_CONFIG.DEBUG) {
        console.log('📡 Getting follower data from server');
      }

      const response = await apiClient.post<GetFollowerDataResponse>(
        getApiEndpoint(API_CONFIG.ENDPOINTS.GET_FOLLOWER_DATA),
        { expo_token: expoToken, device_id },
        { headers, timeout: API_CONFIG.TIMEOUT }
      );

      if (API_CONFIG.DEBUG) {
        console.log('✅ Follower data received:', {
          customers: response.data.followed_customers?.length ?? 0,
          products: Object.keys(response.data.followed_bibs ?? {}).length,
        });
      }

      return response.data;
    } catch (error: any) {
      if (API_CONFIG.DEBUG) {
        console.error('❌ Get follower data error:', error?.response?.data || error?.message);
      }
      throw error;
    }
  },
};