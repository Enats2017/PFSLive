import { apiClient } from "./api";
import { API_CONFIG, getApiEndpoint, getDeviceId } from "../constants/config";

export interface FavouriteItem {
  customer_app_id: number;
  firstname: string;
  lastname: string;
  email: string;
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
}

export interface GetFavouritesParams {
  search?: string;
  page?: number;
}

interface FavouritesData {
  favourites?: FavouriteItem[];
  pagination?: FavouritePagination;
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
      const deviceId = await getDeviceId();

      if (API_CONFIG.DEBUG) {
        console.log("📡 Fetching favourites:", { deviceId, params });
      }

      const url = getApiEndpoint(API_CONFIG.ENDPOINTS.GET_ALL_FAVOURITES);
      const headers = await API_CONFIG.getHeaders();

      const requestBody = {
        device_id: deviceId,
        search: params.search ?? "",
        page: params.page ?? 1,
      };

      const response = await apiClient.post<FavouritesData>(url, requestBody, {
        headers,
      });

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
