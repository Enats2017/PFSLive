import { API_CONFIG, getApiEndpoint } from "../constants/config";
import { apiClient } from "./api";
import { getCurrentLanguageId } from "../i18n";

export interface RaceResult {
  position: string;
  bib: string;
  name: string;
  club: string;
  gender: string;
  nation: string;
  nation_code: string;
  nation_flag: string;
  age: string;
  time: string;
  diff: string;
  category_name: string;
  category_rank: string;
  live_tracking_activated: number;
  participant_app_id: number | null;
  customer_app_id: number | null;
  checkpoints: Checkpoint[];
  utmb_index?: string;
  finish_rank_agegroup?: number | null;
  password_protected: 0|1,
}

export interface Checkpoint {
  name: string;
  race_time: string;
  actual_time: string;
  ranking: string;
  rank_gender: string;
  rank_agegroup: string;
  day_name: string;
  is_crossed: boolean;
}

export interface FilterOption {
  label: string;
  value: string;
}

export interface FiltersState {
  distance: FilterOption;
  type: FilterOption;
  category: FilterOption;
}

export interface Distance {
  product_option_value_app_id: number;
  distance_name: string;
  is_selected: number;
}

export interface Category {
  key: string;
  label: string;
}

export interface Pagination {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

export interface EventRankingParams {
  product_app_id: number;
  product_option_value_app_id?: number;
  from_live: 0 | 1;
  filter_category: string;
  page: number;
}

export interface EventRankingResponse {
  distances: Distance[];
  categories: Category[];
  results: RaceResult[];
  pagination: Pagination;
  event?: {
    race_name: string;
    distance_name: string;
    product_app_id: number;
    product_option_value_app_id: number;
    from_live: 0 | 1;
    race_status: string;
    race_progress_status?: string;  // ✅ 'not_started' | 'in_progress' | 'finished'
    show_utmb_index?: number;
  };
}

export const resultList = {
  /**
   * Get event ranking with filters
   */
  getEventRanking: async (
    params: EventRankingParams,
  ): Promise<EventRankingResponse> => {
    try {
      const headers = await API_CONFIG.getHeaders();
      const language_id = getCurrentLanguageId();

      if (API_CONFIG.DEBUG) {
        console.log("📡 Fetching event ranking:", {
          product_app_id: params.product_app_id,
          product_option_value_app_id: params.product_option_value_app_id,
          from_live: params.from_live,
          filter_category: params.filter_category,
          page: params.page,
        });
      }

      const requestBody: any = {
        product_app_id: params.product_app_id,
        from_live: params.from_live,
        filter_category: params.filter_category,
        page: params.page,
        language_id,
      };

      if (params.product_option_value_app_id !== undefined && params.product_option_value_app_id != 0) {
        requestBody.product_option_value_app_id =
          params.product_option_value_app_id;
      }

      const response = await apiClient.post<EventRankingResponse>(
        getApiEndpoint(API_CONFIG.ENDPOINTS.GET_EVENT_RANKING),
        requestBody,
        {
          headers,
          timeout: API_CONFIG.TIMEOUT,
        },
      );

      const data = response.data;

      if (API_CONFIG.DEBUG) {
        console.log("✅ Event ranking loaded:", {
          distances: data.distances?.length || 0,
          categories: data.categories?.length || 0,
          results: data.results?.length || 0,
          pagination: data.pagination,
          event: data.event,
          show_utmb_index: data.event?.show_utmb_index,
        });
      }

      if (
        !data.distances ||
        !data.categories ||
        !data.results ||
        !data.pagination
      ) {
        if (API_CONFIG.DEBUG) {
          console.error("❌ Invalid response structure:", data);
        }
        throw new Error("Invalid response structure");
      }

      return data;
    } catch (error: any) {
      if (API_CONFIG.DEBUG) {
        console.error("❌ Get event ranking error:", error);
        if (error.response?.data) {
          console.error("❌ Error response data:", error.response.data);
        }
      }

      if (error.response?.data?.error) {
        throw new Error(error.response.data.error);
      }

      throw error;
    }
  },
};