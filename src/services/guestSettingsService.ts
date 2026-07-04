import { API_CONFIG, getApiEndpoint, getDeviceId } from '../constants/config';

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
        const response = await fetch(
            getApiEndpoint(API_CONFIG.ENDPOINTS.follower_language), // adjust key to your config
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            }
        );
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const json = await response.json();
        if (!json.success) {
            throw new Error(json.error ?? 'Request failed');
        }
        return json;
    }

    async getLanguage(): Promise<{ languageId: number }> {
        const deviceId = await getDeviceId();
        const json = await this.request<GetFollowerLanguageResponse>({
            action: 'get',
            device_id: deviceId,
        });
        return { languageId: json.data.language_id };
    }

    async updateLanguage(languageId: number): Promise<{ languageId: number }> {
        const deviceId = await getDeviceId();
        const json = await this.request<UpdateFollowerLanguageResponse>({
            action: 'update',
            device_id: deviceId,
            language_id: languageId,
        });
        return { languageId: json.data.language_id };
    }
}

export const guestSettingsService = new GuestSettingsService();