
import { API_CONFIG, getApiEndpoint } from '../constants/config';
import { getCurrentLanguageId } from '../i18n';

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
  product_option_value_app_id: number;
  from_live: 0 | 1;
  filter_category: string;
  page: number;
}

export interface EventRankingResponse {
  distances: Distance[];
  categories: Category[];
  results: RaceResult[];
  pagination: Pagination;
}

export const resultList = {
  getEventRanking: async (params: EventRankingParams): Promise<EventRankingResponse> => {
    const headers = await API_CONFIG.getHeaders();
    const language_id = getCurrentLanguageId();

    const res = await fetch(getApiEndpoint(API_CONFIG.ENDPOINTS.GET_EVENT_RANKING), {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ...params,
        language_id,
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (!json.success || !json.data) throw new Error(json.error ?? 'unknown_error');

    return json.data as EventRankingResponse;
  },
};