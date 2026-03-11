import { apiClient } from './api';
import { API_CONFIG, getApiEndpoint } from '../constants/config';

export interface Participant {
  participant_app_id: string;
   customer_app_id:number| null;
  firstname: string | null;
  lastname: string | null;
  bib_number: string;
  city: string;
  country: string;
  race_distance: string;
  live_tracking_activated: number;
  source?: string; // e.g., "local" or "external"
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

// ✅ CLEAN INTERFACE FOR OPTIONAL PARAMS
interface GetParticipantsParams {
  product_app_id: string | number;
  page?: number;
  filter_name?: string;
  product_option_value_app_id?: string | number; // ✅ NEW OPTIONAL PARAM
}

interface ParticipantApiResponse {
  success: boolean;
  data: ParticipantResponse;
  error: string | null;
}

export const participantService = {
  /**
   * Fetch participants for an event with pagination and search
   */
  async getParticipants(params: GetParticipantsParams): Promise<ParticipantResponse> {
    try {
      // ✅ DESTRUCTURE WITH DEFAULTS
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

      // ✅ BUILD REQUEST BODY - ONLY INCLUDE NON-EMPTY VALUES
      const requestBody: Record<string, any> = {
        product_app_id,
        page,
        filter_name,
      };

      // ✅ CONDITIONALLY ADD OPTIONAL PARAM
      if (product_option_value_app_id !== undefined && product_option_value_app_id !== null && product_option_value_app_id !== '') {
        requestBody.product_option_value_app_id = product_option_value_app_id;
      }

      const response = await apiClient.post<ParticipantApiResponse>(
        url,
        requestBody,
        { headers }
      );

      if (response.success && response.data) {
        if (API_CONFIG.DEBUG) {
          console.log('✅ Participants loaded:', response.data.participants?.length || 0);
        }

        return {
          participants: response.data.participants || [],
          pagination: response.data.pagination || {
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

  /**
   * Get unique identifier for participant based on source
   */
  getParticipantId(participant: Participant): string {
    if (participant.source === 'local') {
      return participant.participant_app_id;
    }
    return participant.bib_number || participant.participant_app_id;
  },
};