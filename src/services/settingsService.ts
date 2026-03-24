import { API_CONFIG, getApiEndpoint } from '../constants/config';
import { tokenService } from './tokenService';

// ── Interfaces ────────────────────────────────────────────────────
export interface Settings {
    live_tracking_visibility: 'public' | 'private';
    live_tracking_password: string;
}

interface GetSettingsResponse {
    success: boolean;
    data: { settings: Settings };
    error: string | null;
}

interface UpdateSettingsResponse {
    success: boolean;
    data: { updated: number; settings: Settings };
    errors?: string[];
    error: string | null;
}

// ── Service ───────────────────────────────────────────────────────
class SettingsService {

    // Single private fetch — no duplication
    private async request<T>(body: object): Promise<T> {
        const token = await tokenService.getToken();
        const response = await fetch(
            getApiEndpoint(API_CONFIG.ENDPOINTS.update_customer_setting),
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
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

    // ✅ Returns Settings directly — screen doesn't need to dig into response
    async getSettings(): Promise<Settings> {
        const json = await this.request<GetSettingsResponse>({ action: 'get' });
        return json.data.settings;
    }

    // ✅ Returns Settings directly — public always gets empty password
    async updateSettings(settings: Settings): Promise<Settings> {
        const json = await this.request<UpdateSettingsResponse>({
            action: 'update',
            settings: {
                live_tracking_visibility: settings.live_tracking_visibility,
                live_tracking_password:
                    settings.live_tracking_visibility === 'public'
                        ? ''
                        : settings.live_tracking_password.trim(),
            },
        });
        return json.data.settings;
    }
}

export const settingsService = new SettingsService();