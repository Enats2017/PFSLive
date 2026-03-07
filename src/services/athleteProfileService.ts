import { apiClient } from './api';
import { API_CONFIG, getApiEndpoint } from '../constants/config';
import { getCurrentLanguageId} from '../i18n';
import { tokenService } from './tokenService';
import i18n from '../i18n'


export interface AthleteProfile {
    firstname:       string;
    lastname:        string;
    profile_picture: string;
    is_own_profile:  number;
}

export interface AthleteEvent {
    id:           number;
    name:         string;
    race_date_formatted:    string;
    race_time:    string;
    event_source: string;
    race_status?: 'not_started' | 'in_progress' | 'finished';
}

export interface Pagination {
    page:        number;
    per_page:    number;
    total:       number;
    total_pages: number;
}

export interface AthleteProfileResponse {
    profile:    AthleteProfile;
    tabs: {
        past: AthleteEvent[];
        live: AthleteEvent[];
    };
    pagination: {
        past: Pagination;
        live: Pagination;
    };
}


const getRequestBase = async () => {
    const headers     = await API_CONFIG.getHeaders();
    const customerId  = await tokenService.getCustomerId() ?? 0;
    const languageId  = getCurrentLanguageId();
    return { headers, body: { customer_app_id: customerId, language_id: languageId } };
};

export const fetchAthleteProfileApi = async (): Promise<AthleteProfileResponse> => {
    const { headers, body } = await getRequestBase();
    const response = await apiClient.post<AthleteProfileResponse>(
        getApiEndpoint(API_CONFIG.ENDPOINTS.ATHLETE_PROFILE),
        body,
        { headers }
    );
    if (!response.success) throw new Error(response.error || i18n.t('profile:errors.load_profile_api_failed'));
    return response.data;
};

export const fetchMorePastEvents = async (
    page: number
): Promise<{ past: AthleteEvent[]; pagination: Pagination }> => {
    const { headers, body } = await getRequestBase();
    const response = await apiClient.post<{ past: AthleteEvent[]; pagination: Pagination }>(
        getApiEndpoint(API_CONFIG.ENDPOINTS.ATHLETE_PROFILE),
        { ...body, page_past: page },
        { headers }
    );
    if (!response.success) throw new Error(response.error || i18n.t('profile:errors.load_more_past_failed'));
    return response.data;
};

export const fetchMoreLiveEvents = async (
    page: number
): Promise<{ live: AthleteEvent[]; pagination: Pagination }> => {
    const { headers, body } = await getRequestBase();
    const response = await apiClient.post<{ live: AthleteEvent[]; pagination: Pagination }>(
        getApiEndpoint(API_CONFIG.ENDPOINTS.ATHLETE_PROFILE),
        { ...body, page_live: page },
        { headers }
    );
    if (!response.success) throw new Error(response.error || i18n.t('profile:errors.load_more_live_failed'));
    return response.data;
};