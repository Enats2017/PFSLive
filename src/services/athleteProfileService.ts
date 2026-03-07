import { apiClient } from './api';
import { API_CONFIG, getApiEndpoint } from '../constants/config';
import { getCurrentLanguageId } from '../i18n';
import { tokenService } from './tokenService';

// ✅ TYPES (SAME STRUCTURE AS eventService)
export interface AthleteProfile {
    firstname: string;
    lastname: string;
    profile_picture: string;
    is_own_profile: number;
}

export interface AthleteEvent {
    participant_app_id: number,
    id: number;
    name: string;
    race_date_formatted: string;
    race_time: string;
    event_source: string;
    race_status?: 'not_started' | 'in_progress' | 'finished';
}

export interface EventTabs {
    past: AthleteEvent[];
    live: AthleteEvent[];
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
}

export interface AthleteProfileResponse {
    profile: AthleteProfile;
    tabs: EventTabs;
    pagination: {
        past: Pagination;
        live: Pagination;
    };
}

// ✅ INTERNAL DATA STRUCTURE (HANDLES BOTH FORMATS)
interface EventsData {
    profile?: AthleteProfile;
    tabs?: EventTabs;
    pagination?: {
        past: Pagination;
        live: Pagination;
    };
    // Legacy format - flat structure
    past?: AthleteEvent[];
    live?: AthleteEvent[];
    // ✅ Legacy flat pagination (what your API actually returns for page 2+)
    pagination_flat?: Pagination;
}

export const eventService = {
    /**
     * Fetch athlete profile with pagination support for Past and Live tabs
     */
    async getAthleteProfile(
        pagination: PaginationParams = {
            page_past: 1,
            page_live: 1,
        }
    ): Promise<AthleteProfileResponse> {
        try {
            const language_id = getCurrentLanguageId();
            const customerId = (await tokenService.getCustomerId()) ?? 0;

            if (API_CONFIG.DEBUG) {
                console.log('📡 Fetching athlete profile:', { customerId, language_id, pagination });
            }

            const url = getApiEndpoint(API_CONFIG.ENDPOINTS.ATHLETE_PROFILE);
            const headers = await API_CONFIG.getHeaders();

            const requestBody = {
                customer_app_id: customerId,
                language_id: language_id,
                page_past: pagination.page_past || 1,
                page_live: pagination.page_live || 1,
            };

            const response = await apiClient.post<EventsData>(url, requestBody, {
                headers,
            });

            if (response.success && response.data) {
                const eventsData = response.data;

                // ✅ Modern format (initial load - has profile + tabs + pagination)
                if (eventsData.profile && eventsData.tabs && eventsData.pagination) {
                    if (API_CONFIG.DEBUG) {
                        console.log('✅ Profile loaded (modern format):', {
                            past: eventsData.tabs.past.length,
                            live: eventsData.tabs.live.length,
                        });
                    }

                    return {
                        profile: eventsData.profile,
                        tabs: eventsData.tabs,
                        pagination: eventsData.pagination,
                    };
                }

                // ✅ Legacy format fallback (page 2+ - flat structure)
                if (eventsData.pagination) {
                    if (API_CONFIG.DEBUG) {
                        console.log('✅ Profile loaded (legacy format)');
                    }

                    // ✅ API returns single flat pagination, apply it to all tabs
                    const flatPagination = eventsData.pagination as unknown as Pagination;

                    return {
                        profile: eventsData.profile || {
                            firstname: '',
                            lastname: '',
                            profile_picture: '',
                            is_own_profile: 0,
                        },
                        tabs: {
                            past: eventsData.past || [],
                            live: eventsData.live || [],
                        },
                        pagination: {
                            past: flatPagination, // ✅ same pagination for all tabs
                            live: flatPagination,
                        },
                    };
                }

                throw new Error('Invalid response format: missing pagination data');
            }

            throw new Error(response.error || 'Failed to fetch athlete profile');
        } catch (error: any) {
            if (API_CONFIG.DEBUG) {
                console.error('❌ Error fetching athlete profile:', error.message);
            }
            throw error;
        }
    },
};