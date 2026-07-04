import { API_CONFIG, getApiEndpoint, getDeviceId } from '../constants/config';
import { getCurrentLanguageId } from '../i18n';
import { tokenService } from './tokenService';

// ── Interfaces ────────────────────────────────────────────────────
export interface Settings {
    live_tracking_visibility: 'public' | 'private';
    live_tracking_password: string;

}

interface GetSettingsResponse {
    success: boolean;
    data: { settings: Settings; account_deletion_url?: string,  language_id: number; };
    error: string | null;
}

interface UpdateSettingsResponse {
    success: boolean;
    data: {
        updated: number;
        settings: Settings;
        account_deletion_url?: string;
        language_id: number;
    };
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
    async getSettings(): Promise<{ settings: Settings; accountDeletionUrl: string, languageId: number }> {
        const json = await this.request<GetSettingsResponse>({ action: 'get' });
        return {
            settings: json.data.settings,
            accountDeletionUrl: json.data.account_deletion_url ?? '',
            languageId: json.data.language_id,
        };
    }

    // ✅ Returns Settings directly — public always gets empty password
   async updateSettings(settings: Settings, languageId?: number): Promise<{ settings: Settings; languageId: number }> {
        const deviceId = await getDeviceId();
        const language_id = languageId ?? getCurrentLanguageId();
        const body: Record<string, unknown> = {
            action: 'update',
            settings: {
                live_tracking_visibility: settings.live_tracking_visibility,
                live_tracking_password:
                    settings.live_tracking_visibility === 'public'
                        ? ''
                        : settings.live_tracking_password.trim(),
            },
        };

        // top-level, siblings of `action`/`settings` — backend reads these
        // directly off $post_data, not from inside settings
        if (language_id) {
            body.language_id = language_id;
        }
        if (deviceId) {
            body.device_id = deviceId;
        }
         console.log('[SettingsService.updateSettings] Outgoing body:', JSON.stringify(body, null, 2))

        const json = await this.request<UpdateSettingsResponse>(body);
        console.log('[SettingsService.updateSettings] Response json:', JSON.stringify(json, null, 2));
        return {
            settings: json.data.settings,
            languageId: json.data.language_id,
        };
    }
}

export const settingsService = new SettingsService();