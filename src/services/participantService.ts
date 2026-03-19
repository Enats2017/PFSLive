import { apiClient } from './api';
import { API_CONFIG, getApiEndpoint } from '../constants/config';

export interface Participant {
  participant_app_id: string;
  customer_app_id: number | null;
  firstname: string | null;
  lastname: string | null;
  bib_number: string;
  bib?: string;
  city: string;
  country: string;
  race_distance: string;
  live_tracking_activated: number;
  source?: string;
  profile_picture?: string;
}

export interface ParticipantPagination {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

export interface ParticipantResponse {
  participants: Participant[];
  pagination: ParticipantPagination;
}

interface GetParticipantsParams {
  product_app_id: string | number;
  page?: number;
  filter_name?: string;
  product_option_value_app_id?: string | number;
}

export const participantService = {
  async getParticipants(params: GetParticipantsParams): Promise<ParticipantResponse> {
    try {
      const {
        product_app_id,
        page = 1,
        filter_name = '',
        product_option_value_app_id,
      } = params;

      if (API_CONFIG.DEBUG) {
        console.log('📡 Fetching participants:', params);
      }

      const url = getApiEndpoint(API_CONFIG.ENDPOINTS.PARTICIPANTS);
      const headers = await API_CONFIG.getHeaders();

      const requestBody: Record<string, any> = {
        product_app_id,
        page,
        filter_name,
      };

      if (product_option_value_app_id !== undefined && product_option_value_app_id !== null && product_option_value_app_id !== '') {
        requestBody.product_option_value_app_id = product_option_value_app_id;
      }

      // ✅ DON'T specify generic type - let apiClient handle it
      const response = await apiClient.post(
        url,
        requestBody,
        { headers }
      );

      // ✅ Check if response is successful and has data
      if (response.success && response.data) {
        // ✅ Cast to any to bypass TypeScript errors, then extract data
        const apiData = response.data as any;
        
        if (API_CONFIG.DEBUG) {
          console.log('✅ Participants loaded:', apiData.participants?.length || 0);
        }

        return {
          participants: apiData.participants || [],
          pagination: apiData.pagination || {
            page: 1,
            per_page: 10,
            total: 0,
            total_pages: 1,
          },
        };
      }

      throw new Error(response.error || 'Failed to fetch participants');
    } catch (error: any) {
      if (API_CONFIG.DEBUG) {
        console.error('❌ Error fetching participants:', error.message);
      }
      throw error;
    }
  },

  getParticipantId(participant: Participant): string {
    if (participant.source === 'local') {
      return participant.participant_app_id;
    }
    return participant.bib_number || participant.participant_app_id;
  },
};