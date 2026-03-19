import { API_CONFIG, getApiEndpoint } from '../constants/config';
import { apiClient } from './api';
import { getCurrentLanguageId } from '../i18n';

// ── interfaces ─────────────────────────────────────────────

export interface CheckpointDetail {
    name: string;
    day_name: string;
    distance: string;
    segment_distance: string;
    race_time: string;
    actual_time: string;
    ranking: string;
    rank_gender: string;
    rank_agegroup: string;
    speed: string;
    pace: string;
     is_crossed: boolean;
    is_start: boolean;       // ✅ added
    is_finish: boolean;      // ✅ added
    elevation: string;       // ✅ added
    elevation_gain: string;  // ✅ added
    predicted_minutes: number | null;
}

export interface PreviousCp {
    name: string;
    day_name: string;
    actual_time: string;
    race_time: string;
}

export interface NextCp {
    name: string;
    day_name: string;
    predicted_time: string;
    predicted_minutes: number | null;
}

export interface ResultDetailEvent {
    product_app_id: number;
    race_name: string;
    product_option_value_app_id: number;
    distance_name: string;
    race_date: string;
    day_name: string;
    timezone: string;
    server_datetime: string;
    from_live: 0 | 1;
     race_status: string;   // ✅ added
    gpx_url: string; 
}

export interface RaceInfo {
    bib: string;
    name: string;
    gender: string;
    age: string;
    time: string;
    diff: string;
    position: string;
    category_name: string;
    category_rank: string;
    gender_ranking: string;
    last_cp_distance: string;
    distance_completed: string;
    elevation_gain: string; 
    race_time_display: string;
    previous_cp: PreviousCp | null;
    next_cp: NextCp | null;
    live_tracking_activated: number;
    participant_app_id: number | null;
    customer_app_id: number | null;
}

export interface RunnerInfo {
    bib: string;
    name: string;
    nation: string;
    nation_code: string;
    nation_flag: string;
    club: string;
    category_name: string;
    utmb_index: string;
    age: string;
    gender: string;
    profile_picture: string;
}

export interface ResultDetailResponse {
    event: ResultDetailEvent;
    race_info: RaceInfo;
    checkpoints: CheckpointDetail[];
    runner_info: RunnerInfo;
     location: null | object;
}

export interface ResultDetailParams {
    product_app_id: number;
    product_option_value_app_id: number;
    bib: string;
    from_live?: 0 | 1;
}

export const resultDetail = {
    getResultDetail: async (
        params: ResultDetailParams,
    ): Promise<ResultDetailResponse> => {
        try {
            const headers = await API_CONFIG.getHeaders();
            const language_id = getCurrentLanguageId();

            if (API_CONFIG.DEBUG) {
                console.log('📡 Fetching result detail:', {
                    product_app_id: params.product_app_id,
                    product_option_value_app_id: params.product_option_value_app_id,
                    bib: params.bib,
                    from_live: params.from_live ?? 0,
                });
            }

            // ── build request body ─────────────────────────
            const requestBody = {
                product_app_id: params.product_app_id,
                product_option_value_app_id: params.product_option_value_app_id,
                bib: params.bib,
                from_live: params.from_live ?? 0,
                language_id,
            };

            const response = await apiClient.post<ResultDetailResponse>(
                getApiEndpoint(API_CONFIG.ENDPOINTS.GET_RESULT_DETAIL),
                requestBody,
                {
                    headers,
                    timeout: API_CONFIG.TIMEOUT,
                },
            );

            const data = response.data;

            if (API_CONFIG.DEBUG) {
                console.log('✅ Result detail loaded:', {
                    bib: data.race_info?.bib,
                    name: data.race_info?.name,
                    checkpoints: data.checkpoints?.length,
                });
            }

            return data;

        } catch (error: any) {
            if (API_CONFIG.DEBUG) {
                console.error('❌ Result detail error:', error);
            }
            throw new Error(
                error?.response?.data?.error ?? 
                error?.message ?? 
                'Failed to load result detail'
            );
        }
    },
};