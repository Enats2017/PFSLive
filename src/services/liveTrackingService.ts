import { API_CONFIG, getApiEndpoint } from '../constants/config';
import { tokenService } from './tokenService';
import { getCurrentLanguageId } from '../i18n';

export interface LiveTrackingCheckpoint {
    name: string;
    day_name: string;
    distance: number | string;
    segment_distance: string;
    race_time: string;
    actual_time: string;
    ranking: string;
    rank_gender: string;
    rank_agegroup: string;
    speed: string;
    pace: string;
    is_crossed: boolean;
    is_start: boolean;
    is_finish: boolean;
    predicted_minutes: number | null;
    elevation: string;
    elevation_gain: string;
    latitude: number;
    longitude: number;
    accessible_by_car: boolean;
}

export interface LiveTrackingParticipant {
    participant_app_id: number;
    customer_app_id: number;
    bib_number: number;
    firstname: string;
    lastname: string;
    profile_picture: string | null;
    source: string;
    position: string;
    position_gender: string;
    position_category: string;
    gender: 'm' | 'f';
    category: string;
    race_time: string;
    race_time_display: string;
    race_time_seconds: number;
    status: string;
    last_checkpoint: number;
    last_checkpoint_name: string;
    distance_covered_km: number;
    distance_to_next_cp: number | null;
    avg_speed_kmh: number;
    latitude: number;
    longitude: number;
    altitude: number;
    speed: number | null;
    last_update: string;
    location_source: string;
    checkpoints: LiveTrackingCheckpoint[];
}

export interface DistanceOption {
    product_option_value_app_id: number;
    distance_name: string;
    sort_order: number;
    is_selected: number;
}

export interface SelectedDistance extends DistanceOption {
    gpx_url: string;
}

export interface LiveTrackingResponse {
    success: boolean;
    data: {
        source: string;
        auto_refresh: number;
        selected_distance: SelectedDistance;
        distances: DistanceOption[];
        participants: LiveTrackingParticipant[];
    };
    error: string | null;
}

class LiveTrackingService {
    async getLiveTrackingData(
        productAppId: number,
        customerAppIds: number[],
        productOptionValueAppId?: number,
        autoRefresh: boolean = false
    ): Promise<LiveTrackingResponse> {
        try {
            const token = await tokenService.getToken();
            const languageId = getCurrentLanguageId();
            
            // ✅ Build request body
            const requestBody: any = {
                language_id: languageId,
                product_app_id: productAppId.toString(),
                customer_app_ids: customerAppIds.join(','),
                auto_refresh: autoRefresh ? 1 : 0,
            };

            // ✅ Only add product_option_value_app_id if it's valid (not 0 or undefined)
            if (productOptionValueAppId && productOptionValueAppId > 0) {
                requestBody.product_option_value_app_id = productOptionValueAppId.toString();
            }

            console.log('📡 Live tracking request:', requestBody);
            
            const response = await fetch(getApiEndpoint(API_CONFIG.ENDPOINTS.GET_LIVE_TRACKING), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data: LiveTrackingResponse = await response.json();
            
            if (!data.success) {
                throw new Error(data.error || 'Failed to fetch live tracking data');
            }

            return data;
        } catch (error) {
            console.error('❌ Live tracking fetch error:', error);
            throw error;
        }
    }
}

export const liveTrackingService = new LiveTrackingService();