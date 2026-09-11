import { apiClient, AppError } from "./api";
import { API_CONFIG, getApiEndpoint, getDeviceId } from "../constants/config";
import { tokenService } from "./tokenService";

export interface FavouriteItem {
  customer_app_id: number;
  firstname: string;
  lastname: string;
  // No email: the API stopped returning it (see buildParticipantEntries in
  // get_favourite_all_api.php) — no card ever rendered it.
  city: string;
  country: string;
  profile_picture?: string;
  flag_url?: string | null;
  password_protected: 0 | 1;
}

export interface FavouritePagination {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

export interface FavouritesResponse {
  favourites: FavouriteItem[];
  pagination: FavouritePagination;
  is_own: number; 
}

export interface GetFavouritesParams {
  search?: string;
  page?: number;
  customer_app_id?: number;
  
}

interface FavouritesData {
  favourites?: FavouriteItem[];
  pagination?: FavouritePagination;
  is_own?: number;
  // get_favourite_all_api.php answers a token it cannot verify with
  // HTTP 200 + success:true + action:"unauthorized" — not an error status —
  // so this never reaches apiClient.handleError. See getFavourites().
  action?: string;
}

interface FavouritesApiResponse {
  success: boolean;
  data: FavouritesData;
  error: string | null;
}

export const userfavouriteService = {
  async getFavourites(
    params: GetFavouritesParams = {},
  ): Promise<FavouritesResponse> {
    try {
      // Two identities, because two kinds of user reach this screen.
      // customer_app_id is null for a logged-out fan, and the fan flow
      // (FanScreen / FollowerScreen) is not gated behind login — device_id is
      // the fan identity the API falls back to. Sending both keeps the
      // logged-out list working without changing the logged-in behaviour:
      // server-side customer_app_id wins whenever it resolves.
      //
      // params.customer_app_id names ANOTHER athlete when this screen was
      // opened from their profile. It has to win over the logged-in id, and
      // the device_id sent alongside is harmless: the API treats device_id as
      // a fallback, never an override, so a target never resolves to the
      // viewer's own list.
      const customer_app_id = params.customer_app_id ?? await tokenService.getCustomerId();
      const device_id = await getDeviceId();

      if (API_CONFIG.DEBUG) {
        console.log("📡 Fetching favourites:", { customer_app_id, device_id, params });
      }

      const url = getApiEndpoint(API_CONFIG.ENDPOINTS.GET_ALL_FAVOURITES);
      const headers = await API_CONFIG.getHeaders();

      const requestBody = {
        customer_app_id,
        device_id,
        search: params.search ?? "",
        page: params.page ?? 1,
      };

      const response = await apiClient.post<FavouritesData>(url, requestBody, {
        headers,
      });

      // ✅ An unusable token comes back as a 200, not a 401.
      //
      // get_favourite_all_api.php sets $has_token_attempt on ANY non-empty
      // Authorization header, then answers respondSuccess(action:"unauthorized")
      // when AuthToken::verify() rejects it. Without this branch the payload
      // falls through with no `favourites` key, we return an empty array, and
      // the screen tells a logged-out user they are "Not Following Anyone".
      //
      // Throwing the same code api.ts emits for a real 401 keeps both paths on
      // one handler in the screens.
      if (response.success && (response.data as FavouritesData)?.action === "unauthorized") {
        if (API_CONFIG.DEBUG) {
          console.log("🔐 Favourites: token rejected by server (action: unauthorized)");
        }
        throw new AppError("server", "session_expired");
      }

      if (response.success && response.data) {
        if (API_CONFIG.DEBUG) {
          console.log("✅ Favourites loaded:", {
            total: response.data.pagination?.total ?? 0,
            page: response.data.pagination?.page ?? 1,
          });
        }

        return {
          favourites: response.data.favourites ?? [],
          pagination: response.data.pagination ?? {
            page: 1,
            per_page: 0, // unknown — API didn't return it
            total: 0,
            total_pages: 1,
            
          },
          is_own: response.data.is_own ?? 0,
        };
      }

      throw new Error(response.error || "Failed to fetch favourites");
    } catch (error: any) {
      if (API_CONFIG.DEBUG) {
        console.error("❌ Error fetching favourites:", error.message);
      }
      throw error;
    }
  },
};
