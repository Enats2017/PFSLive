import { apiClient } from './api';
import { API_CONFIG, getApiEndpoint } from '../constants/config';
import { getCurrentLanguageId } from '../i18n';

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
  // Legacy format
  past?: EventItem[];
  live?: EventItem[];
  upcoming?: EventItem[];
}

export const eventService = {
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
        console.log('📡 Fetching events with language ID:', language_id);
        console.log('📄 Pagination:', pagination);
      }

      const url = getApiEndpoint(API_CONFIG.ENDPOINTS.EVENTS_LIST);
      const headers = await API_CONFIG.getHeaders();

      const requestBody = {
        language_id: language_id,
        page_past: pagination.page_past,
        page_live: pagination.page_live,
        page_upcoming: pagination.page_upcoming,
      };

      // apiClient.post<EventsData> returns ApiResponse<EventsData>
      // which is { success: boolean, data: EventsData, message?, error? }
      const response = await apiClient.post<EventsData>(
        url,
        requestBody,
        { headers }
      );

      if (response.success && response.data) {
        const eventsData = response.data;

        // Modern format
        if (eventsData.tabs && eventsData.pagination) {
          return {
            tabs: eventsData.tabs,
            pagination: eventsData.pagination,
          };
        }

        // Legacy format
        if (eventsData.pagination) {
          return {
            tabs: {
              past: eventsData.past || [],
              live: eventsData.live || [],
              upcoming: eventsData.upcoming || [],
            },
            pagination: eventsData.pagination,
          };
        }

        throw new Error('Invalid response format');
      }

      throw new Error(response.error || 'Failed to fetch events');
    } catch (error: any) {
      if (API_CONFIG.DEBUG) {
        console.error('❌ Error fetching events:', error.message);
      }
      throw error;
    }
  },
};