import { API_CONFIG, getApiEndpoint, getDeviceId } from "../constants/config";
import { apiClient } from "./api";
import { getCurrentLanguageId } from "../i18n";
import { getFollowedUsers, getFollowedBibs } from "../utils/followStorage";

// ── Checkpoint (same shape as RaceResult['checkpoints'] from resultList) ──
export interface FavouriteCheckpoint {
  name: string;
  day_name: string;
  distance: string;
  segment_distance: string;
  race_time: string;
  actual_time: string;
  ranking: string;
  rank_gender: string;
  rank_agegroup: string;
  speed: string;
  pace: string;
  is_crossed: boolean;
  is_start: boolean;
  is_finish: boolean;
}

// ── Previous / next CP summary (derived server-side from checkpoints) ──
export interface FavouritePreviousCp {
  name: string;
  day_name: string;
  distance: string;
  race_time: string;
  actual_time: string;
  ranking: string;
}

export interface FavouriteNextCp {
  name: string;
  day_name: string;
  distance: string;
  actual_time: string;
}

export interface FavouriteItem {
  bib_number: string;
  firstname: string;
  lastname: string;
  name: string; // ✅ full RR name (single column); firstname mirrors it for RR rows
  club: string; // ✅ added
  gender: "male" | "female" | ""; // ✅ added
  nation: string; // ✅ added
  nation_code: string; // ✅ added
  nation_flag: string; // ✅ added (SVG url)
  age: string; // ✅ added
  position: string; // ✅ added (overall rank)
  participant_status: "not_started" | "in_progress" | "finished" | string; // ✅ added (DNF/DNS/DSQ possible)
  time: string; // ✅ added
  diff: string; // ✅ added
  category_name: string; // ✅ added
  category_rank: string; // ✅ added
  finish_rank_gender: string; // ✅ added
  finish_rank_agegroup: string; // ✅ added
  last_cp_distance: string; // ✅ added
  checkpoints: FavouriteCheckpoint[]; // ✅ added (full array)
  previous_cp: FavouritePreviousCp | null; // ✅ added
  next_cp: FavouriteNextCp | null; // ✅ added
  distance_name: string;
  product_option_value_app_id: number | null;
  sort_order: number;
  race_status: "not_started" | "in_progress" | "finished";
  finish_time: string;
  profile_picture: string;
  live_tracking_activated: 0 | 1;
  participant_app_id: number | null; // ✅ added
  customer_app_id: number | null;
  password_protected: 0 | 1; // ✅ added (1 = private tracking)
  source: "race_result" | "local";
}

export interface FavouritesPagination {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

export interface FavouritesResponse {
  favourites: FavouriteItem[];
  pagination: FavouritesPagination;
}

export interface FavouritesParams {
  product_app_id: number;
  page?: number;
}

const emptyResponse = (page = 1): FavouritesResponse => ({
  favourites: [],
  pagination: {
    page,
    per_page: 20,
    total: 0,
    total_pages: 0,
  },
});

export const favouritesApi = {
  getFavourites: async (
    params: FavouritesParams,
  ): Promise<FavouritesResponse> => {
    try {
      const headers = await API_CONFIG.getHeaders();
      const language_id = getCurrentLanguageId();
      const followedUserIds = await getFollowedUsers();
      const followedBibsMap = await getFollowedBibs(params.product_app_id);
      const customer_app_id_string = followedUserIds.join(",");
      const bib_number_string = followedBibsMap.join(",");

      const deviceId = await getDeviceId();

      if (customer_app_id_string === "" && bib_number_string === "") {
        if (API_CONFIG.DEBUG) {
          console.log(
            "ℹ️ No favourites in local storage for product:",
            params.product_app_id,
          );
        }
        return emptyResponse(params.page ?? 1);
      }

      const requestBody = {
        product_app_id: params.product_app_id,
        bib_number_string,
        customer_app_id_string,
        language_id,
        page: params.page ?? 1,
         device_id: deviceId,
      };

      if (API_CONFIG.DEBUG) {
        console.log("📡 Fetching favourites:", {
          product_app_id: params.product_app_id,
          customer_ids: customer_app_id_string,
          bibs: bib_number_string,
          page: params.page ?? 1,
        });
      }

      const response = await apiClient.post<FavouritesResponse>(
        getApiEndpoint(API_CONFIG.ENDPOINTS.GET_FAVOURITES),
        requestBody,
        {
          headers,
          timeout: API_CONFIG.TIMEOUT,
        },
      );

      const data = response.data;

      if (API_CONFIG.DEBUG) {
        console.log("✅ Favourites loaded:", {
          total: data.pagination?.total,
          count: data.favourites?.length,
          page: data.pagination?.page,
        });
      }

      return data;
    } catch (error: any) {
      if (API_CONFIG.DEBUG) {
        console.error("❌ Favourites error:", error);
      }
      throw new Error(
        error?.response?.data?.error ??
          error?.message ??
          "Failed to load favourites",
      );
    }
  },
};