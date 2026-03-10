import { apiClient } from "./api";
import { API_CONFIG, getApiEndpoint } from "../constants/config";
import { getCurrentLanguageId } from "../i18n";
import { tokenService } from "./tokenService";

export interface AthleteProfile {
  firstname: string;
  lastname: string;
  profile_picture: string;
  is_own_profile: number;
}

export interface AthleteEvent {
  participant_app_id: number;
  product_option_value_app_id: number;
  id: number;
  name: string;
  race_date_formatted: string;
  race_time: string;
  event_source: string;
  race_status?: "not_started" | "in_progress" | "finished";
}

export interface EventTabs {
  past: AthleteEvent[];
  live: AthleteEvent[];
}

export interface Pagination {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

export interface PaginationParams {
  page_past?: number;
  page_live?: number;
}

export interface AthleteProfileResponse {
  profile: AthleteProfile;
  tabs: EventTabs;
  pagination: {
    past: Pagination;
    live: Pagination;
  };
}

interface EventsData {
  profile?: AthleteProfile;
  tabs?: EventTabs;
  pagination?: {
    past: Pagination;
    live: Pagination;
  };
  // Legacy format - flat structure
  past?: AthleteEvent[];
  live?: AthleteEvent[];
  // ✅ Legacy flat pagination (what your API actually returns for page 2+)
  pagination_flat?: Pagination;
}

export const eventService = {
  /**
   * Fetch athlete profile with events
   * @param pagination - Page numbers for past and live events
   * @param targetId - Optional customer ID (defaults to current user)
   * @param bustCache - If true, adds timestamp to bypass cache
   */
  async getAthleteProfile(
    pagination: PaginationParams = {
      page_past: 1,
      page_live: 1,
    },
    targetId?: number,
    bustCache: boolean = false // ✅ CACHE BUSTING PARAMETER
  ): Promise<AthleteProfileResponse> {
    try {
      const language_id = getCurrentLanguageId();
      const customerId = targetId
        ? Number(targetId)
        : ((await tokenService.getCustomerId()) ?? 0);

      if (API_CONFIG.DEBUG) {
        console.log("📡 Fetching athlete profile:", {
          customerId,
          language_id,
          pagination,
          bustCache, // ✅ LOG CACHE BUST FLAG
        });
      }

      const url = getApiEndpoint(API_CONFIG.ENDPOINTS.ATHLETE_PROFILE);
      const headers = await API_CONFIG.getHeaders();

      // ✅ BUILD REQUEST BODY
      const requestBody: any = {
        customer_app_id: customerId,
        language_id: language_id,
        page_past: pagination.page_past || 1,
        page_live: pagination.page_live || 1,
      };

      // ✅ ADD CACHE BUSTING TIMESTAMP
      if (bustCache) {
        requestBody._t = Date.now();
        
        if (API_CONFIG.DEBUG) {
          console.log("🔄 Cache busting enabled with timestamp:", requestBody._t);
        }
      }

      const response = await apiClient.post<EventsData>(url, requestBody, {
        headers,
        timeout: API_CONFIG.TIMEOUT,
      });

      if (response.success && response.data) {
        const eventsData = response.data;

        // ✅ MODERN FORMAT (initial load - has profile + tabs + pagination)
        if (eventsData.profile && eventsData.tabs && eventsData.pagination) {
          if (API_CONFIG.DEBUG) {
            console.log("✅ Profile loaded (modern format):", {
              past: eventsData.tabs.past.length,
              live: eventsData.tabs.live.length,
              pagination: {
                past: eventsData.pagination.past,
                live: eventsData.pagination.live,
              },
            });
          }

          return {
            profile: eventsData.profile,
            tabs: eventsData.tabs,
            pagination: eventsData.pagination,
          };
        }

        // ✅ LEGACY FORMAT (pagination requests - flat structure)
        if (eventsData.pagination) {
          if (API_CONFIG.DEBUG) {
            console.log("✅ Profile loaded (legacy format):", {
              past: eventsData.past?.length || 0,
              live: eventsData.live?.length || 0,
            });
          }

          const flatPagination = eventsData.pagination as unknown as Pagination;

          return {
            profile: eventsData.profile || {
              firstname: "",
              lastname: "",
              profile_picture: "",
              is_own_profile: 0,
            },
            tabs: {
              past: eventsData.past || [],
              live: eventsData.live || [],
            },
            pagination: {
              past: flatPagination, // ✅ Same pagination for all tabs
              live: flatPagination,
            },
          };
        }

        // ✅ ERROR: Invalid response
        if (API_CONFIG.DEBUG) {
          console.error("❌ Invalid response format:", eventsData);
        }
        throw new Error("Invalid response format: missing pagination data");
      }

      // ✅ ERROR: API returned error
      if (API_CONFIG.DEBUG) {
        console.error("❌ API error:", response.error);
      }
      throw new Error(response.error || "Failed to fetch athlete profile");
    } catch (error: any) {
      if (API_CONFIG.DEBUG) {
        console.error("❌ Error fetching athlete profile:", {
          message: error.message,
          response: error.response?.data,
        });
      }
      throw error;
    }
  },
};