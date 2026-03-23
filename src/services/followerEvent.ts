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
  is_participant?: string;
  page_participant?: number;
  filter_name_participant?: string;
}

// ✅ ADD PROFILE_PICTURE FIELD
export interface ParticipantItem {
  customer_app_id: number;
  firstname: string;
  lastname: string;
  city: string;
  country: string;
  profile_picture?: string; // ✅ NEW FIELD
  flag_url?: string | null;
}

export interface EventResponse {
  tabs: EventTabs;
  pagination: {
    past: Pagination;
    live: Pagination;
    upcoming: Pagination;
    participants: Pagination;
  };
  participants: ParticipantItem[];
}

interface EventsData {
  tabs?: EventTabs;
  pagination?: {
    past: Pagination;
    live: Pagination;
    upcoming: Pagination;
  };

  past?: EventItem[];
  live?: EventItem[];
  upcoming?: EventItem[];
  participants?: ParticipantItem[];
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
        is_participant: pagination.is_participant || "0",
        page_participant: pagination.page_participant || 1,
        filter_name_participant: pagination.filter_name_participant || "",
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
            pagination: eventsData.pagination as EventResponse["pagination"],
            participants: eventsData.participants || [],
          };
        }

        // Legacy format fallback
        if (eventsData.pagination) {
          if (API_CONFIG.DEBUG) {
            console.log("✅ Events loaded (legacy format)");
          }

          const flatPagination = eventsData.pagination as unknown as Pagination;

          return {
            tabs: {
              past: eventsData.past || [],
              live: eventsData.live || [],
              upcoming: eventsData.upcoming || [],
            },
            pagination: {
              past: flatPagination,
              live: flatPagination,
              upcoming: flatPagination,
              participants: flatPagination,
            },
            participants: eventsData.participants || [],
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