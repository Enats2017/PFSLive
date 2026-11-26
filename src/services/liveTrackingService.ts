import { API_CONFIG, getApiEndpoint, getDeviceId } from '../constants/config';
import { tokenService } from './tokenService';
import { getCurrentLanguageId } from '../i18n';
import { liveTrackingBibsParam } from '../utils/liveMapBibs';
import { fetchWithTimeout, FetchTimeoutError, parseRetryAfter } from '../utils/fetchWithTimeout';
import { AppError } from './api';
import { rememberBibOwners } from '../utils/followStorage';

// ✅ Deadline for one live-map request (app audit 2026-11-26). Android fetch
// has no timeout of its own: a hung first load left the spinner up forever
// with no retry, and a hung auto refresh kept "Loading participants" over the
// map for good. Same order as API_CONFIG.TIMEOUT (15 s) plus headroom for the
// server's RaceResult call on a cache miss.
export const LIVE_TRACKING_TIMEOUT_MS = 20000;

/**
 * The fetch() failure → the AppError the rest of the app understands
 * (same types as api.ts's handleError), so useScreenError shows the right
 * copy and the screen can tell "rate limited, wait" from "offline".
 * Before, every failure was a plain Error → always the generic server error.
 */
export function liveTrackingError(status: number | null, body: any, retryAfterHeader?: string | null): AppError {
    const code = String(body?.error ?? body?.code ?? (status ? `http_${status}` : 'network_error')).toLowerCase();
    if (status === null) return new AppError('network', 'network_error');
    if (status === 401 || code === 'unauthorized' || code === 'session_expired') return new AppError('server', 'session_expired');
    if (status === 429) return new AppError('server', code, { rateLimited: true, retryAfter: parseRetryAfter(retryAfterHeader) });
    if (status === 404) return new AppError('empty', code);
    return new AppError('server', code);
}

export interface LiveTrackingCheckpoint {
    name: string;
    description: string;
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
    features?: string[]; 
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
    distance_to_finish_km: number | null;
    avg_speed_kmh: number;
    latitude: number;
    longitude: number;
    altitude: number;
    speed: number | null;
    battery_level: number | null;
    last_update: string;
    last_update_time: number;
    last_update_type: string;
    location_source: string;
    is_estimated?: boolean;
    connection_status?: 'live' | 'delayed' | 'offline' | 'finished' | null;
    seconds_since_update?: number | null;
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
        selected_distance: SelectedDistance | null ;
        distances: DistanceOption[];
        participants: LiveTrackingParticipant[];
        checkpoints: LiveTrackingCheckpoint[];
        race_result_status?: number;
        show_results?: number;
        /**
         * Where the race is in its own window, computed server-side from the
         * per-distance race_date + start_time + end_time in the EVENT's
         * timezone (get_live_tracking_data_api.php::buildCountdown), so it
         * handles multi-day events and starts that cross midnight.
         *
         * This is the authoritative race state. `sourceTab` is not: six of the
         * eight screens that open the map hardcode `sourceTab: 'live'`, because
         * it means "which tab I came from", not "what state the race is in".
         */
        countdown?: {
            status: 'not_started' | 'in_progress' | 'finished';
            days: number;
            hours: number;
            minutes: number;
        };
        race_date?: string | null;
        /**
         * Training event (custom, event_type 3): free-form session. Distance is an
         * odometer over the participant's own fixes, the GPX is a reference line
         * only, and distance_to_finish_km / distance_to_next_cp are always null.
         */
        training_free?: boolean;
        product_race_date?: string | null;
        rr_url?: string;
    };
    error: string | null;
}

class LiveTrackingService {
    async getLiveTrackingData(
        productAppId: number,
        customerAppIds: number[],
        productOptionValueAppId?: number,
        autoRefresh: boolean = false,
        eventSource?: string,
        followedBibs: string[] = [],
    ): Promise<LiveTrackingResponse> {
        try {
            const token = await tokenService.getToken();
            const languageId = getCurrentLanguageId();
            // ✅ X-Device-Id: the server's rate limit is per PHONE (ApiSecurity
            // rate_scope_field), not per venue IP, where it knows the device.
            // A header, not a body field: the response cache is keyed on the
            // body, so it stays exactly as shared as before (app audit 2026-11-26).
            // Never fail the map over it: no id → no header → today's per-IP bucket.
            const deviceId = await getDeviceId().catch(() => '');
            
            const requestBody: any = {
                language_id: languageId,
                product_app_id: productAppId.toString(),
                customer_app_ids: customerAppIds.join(','),
                auto_refresh: autoRefresh ? 1 : 0,
                event_source: eventSource ?? 'partner',
            };

            if (productOptionValueAppId && productOptionValueAppId > 0) {
                requestBody.product_option_value_app_id = productOptionValueAppId.toString();
            }

            // ✅ [#MAP-BIB-FOLLOWS] Runners followed BY BIB on this event — the API
            // resolves them to customers on the distance. Only sent when there are
            // any, so every other request (and its server cache key) is unchanged.
            // Partner only: custom events are a different id space.
            const bibsParam = liveTrackingBibsParam(followedBibs, eventSource);
            if (bibsParam !== null) {
                requestBody.bibs = bibsParam;
            }

            console.log('📡 Live tracking request:', requestBody);
            
            let response: Response;
            try {
                response = await fetchWithTimeout(getApiEndpoint(API_CONFIG.ENDPOINTS.GET_LIVE_TRACKING), {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                        ...(deviceId ? { 'X-Device-Id': deviceId } : {}),
                    },
                    body: JSON.stringify(requestBody),
                }, LIVE_TRACKING_TIMEOUT_MS);
            } catch (e) {
                // No answer at all (offline, DNS, timeout): a network error.
                if (e instanceof FetchTimeoutError) console.log('⏱️ Live tracking request timed out');
                throw liveTrackingError(null, null);
            }

            if (!response.ok) {
                let body: any = null;
                try { body = await response.json(); } catch { /* not JSON */ }
                throw liveTrackingError(response.status, body, response.headers?.get?.('Retry-After'));
            }

            const data: LiveTrackingResponse = await response.json();
            
            if (!data.success) {
                throw liveTrackingError(200, data);
            }

            // ✅ A success with no participants array (never sent today, but a
            // `null` would crash the screen on .length) reads as "nobody yet".
            if (data.data && !Array.isArray(data.data.participants)) {
                data.data.participants = [];
            }

            // ✅ The map resolves followed runners to their account: keep the
            // bib → athlete links (followStorage rememberBibOwners), so unfollowing
            // the athlete elsewhere drops this event's bib follow too (audit
            // 2026-11-26 FN1). Partner events only — custom events number their
            // products from another table (see liveTrackingBibsParam). Fire-and-forget.
            if ((eventSource ?? 'partner') === 'partner' && Array.isArray(data.data?.participants)) {
                void rememberBibOwners(productAppId, data.data.participants as any[]);
            }

            return data;
        } catch (error) {
            console.error('❌ Live tracking fetch error:', error);
            throw error;
        }
    }
}

export const liveTrackingService = new LiveTrackingService();