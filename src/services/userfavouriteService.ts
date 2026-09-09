import { apiClient } from "./api";
import { API_CONFIG, getApiEndpoint, getDeviceId } from "../constants/config";
import { tokenService } from "./tokenService";

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
      const customer_app_id = params.customer_app_id ?? await tokenService.getCustomerId();

      if (API_CONFIG.DEBUG) {
        console.log("📡 Fetching favourites:", { customer_app_id, params });
      }

      const url = getApiEndpoint(API_CONFIG.ENDPOINTS.GET_ALL_FAVOURITES);
      const headers = await API_CONFIG.getHeaders();

      const requestBody = {
        customer_app_id,
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
