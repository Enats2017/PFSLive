import axios from "axios";
import { API_CONFIG, getApiEndpoint } from "../constants/config";
import i18n, { LANGUAGES } from '../i18n'; 
import AsyncStorage from '@react-native-async-storage/async-storage';

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

const getLanguageId = (): number => {
  const lang = i18n.language?.split('-')[0] as keyof typeof LANGUAGES;
  return LANGUAGES[lang]?.id ?? 1;
};
console.log(getLanguageId);


export const eventService = {
  async getEvents(
    pagination: PaginationParams = {
      page_past: 1,
      page_live: 1,
      page_upcoming: 1,
    },
  ): Promise<EventResponse> {
    const language_id = await getLanguageId();
    console.log("languge_id",language_id);
    
    const formData = new FormData();
    formData.append("language_id", String(language_id));
    if (pagination.page_past !== undefined)
      formData.append("page_past", String(pagination.page_past));
    if (pagination.page_live !== undefined)
      formData.append("page_live", String(pagination.page_live));
    if (pagination.page_upcoming !== undefined)
      formData.append("page_upcoming", String(pagination.page_upcoming));
    const headers = await API_CONFIG.getMutiForm();
    const response = await axios.post(
      getApiEndpoint(API_CONFIG.ENDPOINTS.EVENTS_LIST),
      formData,
      {
        headers,
        timeout: API_CONFIG.TIMEOUT,
      },
    );

    if (response.data.success) {
      const data = response.data.data;
      if (data.tabs) {
        return {
          tabs: data.tabs,
          pagination: data.pagination,
        };
      }

      return {
        tabs: {
          past: data.past || [],
          live: data.live || [],
          upcoming: data.upcoming || [],
        },
        pagination: data.pagination,
      };
    }
    throw new Error(response.data.error || "Failed to fetch events");
  },
};
