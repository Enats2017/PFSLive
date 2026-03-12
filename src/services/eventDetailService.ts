import { apiClient } from './api';
import { API_CONFIG, getApiEndpoint } from '../constants/config';
import { getCurrentLanguageId } from '../i18n';

export interface Distance {
  product_option_value_app_id: number;
  distance_name: string;
  race_date: string;
  race_date_formatted: string;
  race_time: string;
  countdown_type: string;
  countdown_value: number;
  registration_status: 'available' | 'registered' | 'membership_required' | 'limit_reached' | 'unavailable';
  participant_app_id?: number;
}

export interface RaceResultData {
  bib_number: string;
  firstname: string;
  lastname: string;
  dob: string;
  gender: string;
  city: string;
  country: string;
  nation: string;
  distance_name: string;
  email: string;
  contest_id: string;
}

export interface RegisterParticipantResponse {
  success: boolean;
  action: string;
  is_first_tracking?: number;
  race_result_data?: RaceResultData;
  participant?: {
    participant_app_id: number;
    race_id: number;
    race_name: string;
    race_distance: string;
    race_date: string;
    race_time: string;
    product_option_value_app_id: number;
  };
}

export interface DeleteParticipantResponse {
  success: boolean;
  action: string;
  message?: string;
}

export interface EventDetail {
  product_app_id: number;
  name: string;
  race_date: string;
  manufacturer_name: string;
  location: string;
  image_url: string;
  distances: Distance[];
  server_datetime: string;
}

interface RegisterParticipantApiResponse {
  success: boolean;
  data: RegisterParticipantResponse;
  error: string | null;
}

interface DeleteParticipantApiResponse {
  success: boolean;
  data: DeleteParticipantResponse;
  error: string | null;
}

interface EventDetailApiResponse {
  success: boolean;
  data: EventDetail;
  error: string | null;
}

export const eventDetailService = {
  /**
   * Get event details
   * 
   * @param product_app_id - Event/Product ID
   * @param bustCache - Add timestamp to bypass server/CDN cache
   */
  async getEventDetails(
    product_app_id: string | number,
    bustCache: boolean = false
  ): Promise<EventDetail> {
    try {
      if (API_CONFIG.DEBUG) {
        console.log('📡 Fetching event details for:', product_app_id, {
          bustCache,
        });
      }

      // ✅ CORRECT ENDPOINT NAME (no 'S')
      const url = getApiEndpoint(API_CONFIG.ENDPOINTS.EVENT_DETAIL);
      const headers = await API_CONFIG.getHeaders();

      // ✅ BUILD REQUEST BODY
      const requestBody: Record<string, any> = {
        product_app_id,
        language_id: await getCurrentLanguageId(),
      };

      // ✅ ADD TIMESTAMP TO BUST API/SERVER/CDN CACHE
      if (bustCache) {
        requestBody._t = Date.now();
        
        if (API_CONFIG.DEBUG) {
          console.log('🔥 Cache busting with timestamp:', requestBody._t);
        }
      }

      const response = await apiClient.post<EventDetailApiResponse>(
        url,
        requestBody,
        { headers }
      );

      if (response.success && response.data) {
        if (API_CONFIG.DEBUG) {
          console.log('✅ Event details loaded:', response.data.name);
        }

        return response.data;
      }

      throw new Error(response.error || 'Failed to fetch event details');
    } catch (error: any) {
      if (API_CONFIG.DEBUG) {
        console.error('❌ Error fetching event details:', error.message);
      }
      throw error;
    }
  },

  /**
   * Register participant for an event
   * 
   * @param product_option_value_app_id - Distance ID
   * @param bib_number - Optional bib number for confirmation
   * @param language_id - Optional language ID
   * @param show_confirm_popup - Optional flag to force confirmation popup (skip Race Result lookup)
   */
  async registerParticipant(
    product_option_value_app_id: number,
    bib_number?: string,
    language_id?: number,
    show_confirm_popup?: boolean
  ): Promise<RegisterParticipantResponse> {
    try {
      if (API_CONFIG.DEBUG) {
        console.log('📡 Registering participant:', {
          product_option_value_app_id,
          bib_number: bib_number || '(none)',
          language_id: language_id || '(default)',
          show_confirm_popup: show_confirm_popup || false,
        });
      }

      // ✅ CORRECT ENDPOINT NAME
      const url = getApiEndpoint(API_CONFIG.ENDPOINTS.REGISTER_PARTICIPANT);
      const headers = await API_CONFIG.getHeaders();

      // ✅ BUILD REQUEST BODY
      const requestBody: Record<string, any> = {
        product_option_value_app_id,
        language_id: language_id || (await getCurrentLanguageId()),
      };

      // ✅ ADD OPTIONAL PARAMS
      if (bib_number) {
        requestBody.bib_number = bib_number;
      }

      if (show_confirm_popup !== undefined) {
        requestBody.show_confirm_popup = show_confirm_popup ? 1 : 0;
      }

      const response = await apiClient.post<RegisterParticipantApiResponse>(
        url,
        requestBody,
        { headers }
      );

      if (API_CONFIG.DEBUG) {
        console.log('✅ Register response:', {
          success: response.success,
          action: response.data?.action,
        });
      }

      if (response.success && response.data) {
        return response.data;
      }

      throw new Error(response.error || 'Registration failed');
    } catch (error: any) {
      if (API_CONFIG.DEBUG) {
        console.error('❌ Registration error:', error.message);
      }
      throw error;
    }
  },

  /**
   * Delete/unregister participant from an event
   */
  async deleteParticipant(
    participant_app_id: number
  ): Promise<DeleteParticipantResponse> {
    try {
      if (API_CONFIG.DEBUG) {
        console.log('📡 Deleting participant:', participant_app_id);
      }

      // ✅ CORRECT ENDPOINT NAME
      const url = getApiEndpoint(API_CONFIG.ENDPOINTS.DELETE_PARTICIPANT);
      const headers = await API_CONFIG.getHeaders();

      const requestBody = {
        participant_app_id,
      };

      const response = await apiClient.post<DeleteParticipantApiResponse>(
        url,
        requestBody,
        { headers }
      );

      if (API_CONFIG.DEBUG) {
        console.log('✅ Delete response:', {
          success: response.success,
          action: response.data?.action,
        });
      }

      if (response.success && response.data) {
        return response.data;
      }

      throw new Error(response.error || 'Delete failed');
    } catch (error: any) {
      if (API_CONFIG.DEBUG) {
        console.error('❌ Delete error:', error.message);
      }
      throw error;
    }
  },
};