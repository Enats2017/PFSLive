import { API_CONFIG, getApiEndpoint, getDeviceId } from '../constants/config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ensureFollowerId } from '../utils/followStorage';

interface GetFollowerLanguageResponse {
    success: boolean;
    data: { language_id: number; found?: boolean };
    error: string | null;
}

interface UpdateFollowerLanguageResponse {
    success: boolean;
    data: { follower_id: number; language_id: number };
    error: string | null;
}

class GuestSettingsService {

    private async request<T>(body: object): Promise<T> {
        // fetch has no timeout of its own: a hung request left the settings
        // screen loading (and the language picker's save spinning) for good.
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT);
        let response: Response;
        try {
            response = await fetch(
                getApiEndpoint(API_CONFIG.ENDPOINTS.follower_language), // adjust key to your config
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                    signal: controller.signal,
                }
            );
        } finally {
            clearTimeout(timer);
        }
        // The error code travels in the body (respondError, HTTP 400) — keep
        // it: follower_not_found has to be told apart (updateLanguage).
        let json: any = null;
        try { json = await response.json(); } catch { /* no JSON body */ }
        if (!response.ok || !json?.success) {
            const code = json?.error ?? undefined;
            throw Object.assign(new Error(code ?? (response.ok ? 'Request failed' : `HTTP error! status: ${response.status}`)), { code });
        }
        return json;
    }

    async getLanguage(): Promise<{ languageId: number; found: boolean }> {
        const deviceId = await getDeviceId();
        const json = await this.request<GetFollowerLanguageResponse>({
            action: 'get',
            device_id: deviceId,
        });
        // found:false = no row / no stored language: the id is the server's
        // DEFAULT (English) — not the user's choice.
        return { languageId: json.data.language_id, found: json.data.found !== false };
    }

    async updateLanguage(languageId: number): Promise<{ languageId: number }> {
        const deviceId = await getDeviceId();
        // 'update' needs an existing follower row (follower_not_found
        // otherwise) — previously only devices with push permission had one.
        await ensureFollowerId();
        const body = { action: 'update', device_id: deviceId, language_id: languageId };
        // The id read BEFORE the request — only that one may be dropped.
        const idBefore = await AsyncStorage.getItem('FOLLOWER_ID');
        let json: UpdateFollowerLanguageResponse;
        try {
            json = await this.request<UpdateFollowerLanguageResponse>(body);
        } catch (e: any) {
            if (e?.code !== 'follower_not_found') throw e;
            // A stored id whose row is gone: ensureFollowerId returned it without
            // registering. Drop it (unless replaced meanwhile), register, retry once.
            if ((await AsyncStorage.getItem('FOLLOWER_ID')) === idBefore) {
                await AsyncStorage.removeItem('FOLLOWER_ID');
            }
            await ensureFollowerId();
            json = await this.request<UpdateFollowerLanguageResponse>(body);
        }
        return { languageId: json.data.language_id };
    }
}

export const guestSettingsService = new GuestSettingsService();