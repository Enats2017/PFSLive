// services/favourites.ts

import { API_CONFIG, getApiEndpoint } from "../constants/config";
import { apiClient } from "./api";
import { getCurrentLanguageId } from "../i18n";
import { getFollowedUsers, getFollowedBibs } from "../utils/followStorage";

export interface FavouriteItem {
  bib_number: string;
  firstname: string;
  lastname: string;
  distance_name: string;
  race_status: "not_started" | "in_progress" | "finished";
  profile_picture: string;
  live_tracking_activated: 0 | 1;
  customer_app_id: number | null;
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

      if (customer_app_id_string === "" && bib_number_string === "") {
        if (API_CONFIG.DEBUG) {
          console.log(
            "ℹ No favourites in local storage for product:",
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
      };

      console.log("11111requstbody", requestBody);

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
