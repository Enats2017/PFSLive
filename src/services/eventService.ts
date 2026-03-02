import { apiClient } from "./api";
import { API_CONFIG, getApiEndpoint } from "../constants/config";
import { getCurrentLanguageId } from "../i18n";

export interface EventItem {
  product_app_id: string;
  name: string;
  race_date: string;
  race_time: string;
  country: string;
  city: string;
  result_url: string;
  race_result_api_url: string;
}

export interface EventTabs {
  past: EventItem[];
  live: EventItem[];
  upcoming: EventItem[];
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
  page_upcoming?: number;
  filter_name_past?: string;
}

export interface EventResponse {
  tabs: EventTabs;
  pagination: {
    past: Pagination;
    live: Pagination;
    upcoming: Pagination;
  };
}

interface EventsData {
  tabs?: EventTabs;
  pagination?: {
    past: Pagination;
    live: Pagination;
    upcoming: Pagination;
  };
  // Legacy format - flat pagination
  past?: EventItem[];
  live?: EventItem[];
  upcoming?: EventItem[];
  // ✅ Legacy flat pagination (what your API actually returns)
  pagination_flat?: Pagination;
}
interface EventApiResponse {
  success: boolean;
  data: EventsData;
  error: string | null;
}

export const eventService = {
  /**
   * Fetch events with pagination support for Past, Live, and Upcoming tabs
   */
  async getEvents(
    pagination: PaginationParams = {
      page_past: 1,
      page_live: 1,
      page_upcoming: 1,
    },
  ): Promise<EventResponse> {
    try {
      const language_id = getCurrentLanguageId();

      if (API_CONFIG.DEBUG) {
        console.log("📡 Fetching events:", { language_id, pagination });
      }

      const url = getApiEndpoint(API_CONFIG.ENDPOINTS.EVENTS_LIST);
      const headers = await API_CONFIG.getHeaders();

      const requestBody = {
        language_id: language_id,
        page_past: pagination.page_past || 1,
        page_live: pagination.page_live || 1,
        page_upcoming: pagination.page_upcoming || 1,
        filter_name_past: pagination.filter_name_past || "",
      };

      const response = await apiClient.post<EventsData>(url, requestBody, {
        headers,
      });

      if (response.success && response.data) {
        const eventsData = response.data;

        // Modern format (preferred)
        if (eventsData.tabs && eventsData.pagination) {
          if (API_CONFIG.DEBUG) {
            console.log("✅ Events loaded (modern format):", {
              past: eventsData.tabs.past.length,
              live: eventsData.tabs.live.length,
              upcoming: eventsData.tabs.upcoming.length,
            });
          }

          return {
            tabs: eventsData.tabs,
            pagination: eventsData.pagination,
          };
        }

        // Legacy format fallback
        // Legacy format fallback
        if (eventsData.pagination) {
          if (API_CONFIG.DEBUG) {
            console.log("✅ Events loaded (legacy format)");
          }

          // ✅ API returns single flat pagination, apply it to all tabs
          const flatPagination = eventsData.pagination as unknown as Pagination;

          return {
            tabs: {
              past: eventsData.past || [],
              live: eventsData.live || [],
              upcoming: eventsData.upcoming || [],
            },
            pagination: {
              past: flatPagination, // ✅ same pagination for all tabs
              live: flatPagination,
              upcoming: flatPagination,
            },
          };
        }

        throw new Error("Invalid response format: missing pagination data");
      }

      throw new Error(response.error || "Failed to fetch events");
    } catch (error: any) {
      if (API_CONFIG.DEBUG) {
        console.error("❌ Error fetching events:", error.message);
      }
      throw error;
    }
  },
};
