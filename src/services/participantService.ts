import { apiClient } from './api';
import { API_CONFIG, getApiEndpoint } from '../constants/config';

export interface Participant {
  participant_app_id: string;
  firstname: string | null;
  lastname: string | null;
  bib_number: string;
  city: string;
  country: string;
  race_distance: string;
  live_tracking_activated: number;
  source?: string; // ✅ ADD THIS (e.g., "local" or "external")
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

interface ParticipantApiResponse {
  success: boolean;
  data: ParticipantResponse;
  error: string | null;
}

export const participantService = {
  /**
   * Fetch participants for an event with pagination and search
   */
  async getParticipants(
    product_app_id: string | number,
    page: number = 1,
    filter_name: string = ''
  ): Promise<ParticipantResponse> {
    try {
      if (API_CONFIG.DEBUG) {
        console.log('📡 Fetching participants:', { product_app_id, page, filter_name });
      }

      const url = getApiEndpoint(API_CONFIG.ENDPOINTS.PARTICIPANTS);
      const headers = await API_CONFIG.getHeaders();

      const requestBody = {
        product_app_id,
        page,
        filter_name
      };

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
            total_pages: 1
          }
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
    // ✅ If source is "local", use participant_app_id
    // ✅ Otherwise, use bib_number
    if (participant.source === 'local') {
      return participant.participant_app_id;
    }
    return participant.bib_number || participant.participant_app_id;
  }
};