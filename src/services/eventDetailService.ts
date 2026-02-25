import { apiClient } from './api';
import { API_CONFIG, getApiEndpoint } from '../constants/config';
import { getCurrentLanguageId } from '../i18n';

export interface Distance {
  product_option_value_app_id: number;
  product_option_app_id: number;
  distance_name: string;
  race_date: string;
  race_time: string;
  countdown_type: 'minutes' | 'hours' | 'days' | 'in_progress' | 'finished';
  countdown_value: number;
  countdown_label: string;
}

export interface EventDetailResponse {
  distances: Distance[];
  server_datetime: string;
}

interface EventDetailApiResponse {
  success: boolean;
  data: EventDetailResponse;
  error: string | null;
}

export const eventDetailService = {
  /**
   * Fetch event distances (max 8 records, no pagination)
   */
  async getEventDetails(product_app_id: string | number): Promise<EventDetailResponse> {
    try {
      const language_id = getCurrentLanguageId();
      
      if (API_CONFIG.DEBUG) {
        console.log('📡 Fetching event details for:', product_app_id);
      }

      const url = getApiEndpoint(API_CONFIG.ENDPOINTS.EVENT_DETAIL);
      const headers = await API_CONFIG.getHeaders();

      const requestBody = {
        language_id: language_id,
        product_app_id: product_app_id
      };

      const response = await apiClient.post<EventDetailApiResponse>(
        url,
        requestBody,
        { headers }
      );

      if (response.success && response.data) {
        if (API_CONFIG.DEBUG) {
          console.log('✅ Event details loaded:', response.data.distances?.length || 0, 'distances');
        }

        return {
          distances: response.data.distances || [],
          server_datetime: response.data.server_datetime || ''
        };
      }

      throw new Error(response.error || 'Failed to fetch event details');
    } catch (error: any) {
      if (API_CONFIG.DEBUG) {
        console.error('❌ Error fetching event details:', error.message);
      }
      throw error;
    }
  }
};