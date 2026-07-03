import axios from 'axios';
import { API_CONFIG, getApiEndpoint, getDeviceId } from '../constants/config';

// ==================== TYPES ====================

interface StandardApiResponse<T = any> {
    success: boolean;
    data: T;
    error: string | null;
}

interface UpdateFollowerEmailResult {
    success: boolean;
    follower_id?: number;
    email?: string;
    error?: string;
}

// ==================== SERVICE ====================

/**
 * Fan email capture — attaches an email to the follower's existing record
 * (matched server-side by device_id, same identity used for push/follow).
 *
 * NOTE: add the endpoint key below to API_CONFIG.ENDPOINTS, e.g.:
 *   UPDATE_FOLLOWER_EMAIL: '/update_follower_email_api.php'
 * (adjust the string to match your actual PHP filename/route).
 */
export const fanEmailApi = {
    /**
     * Save the fan's email. device_id is read automatically — no need to
     * pass it in from the screen.
     */
    async updateEmail(email: string): Promise<UpdateFollowerEmailResult> {
        try {
            const deviceId = await getDeviceId();

            const requestBody = {
                device_id: deviceId,
                email,
            };

            if (API_CONFIG.DEBUG) {
                console.log('📤 Sending fan email update:', requestBody);
            }

            const response = await axios.post<StandardApiResponse<UpdateFollowerEmailResult>>(
                getApiEndpoint(API_CONFIG.ENDPOINTS.UPDATE_FOLLOWER_EMAIL),
                requestBody,
                {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: API_CONFIG.TIMEOUT,
                },
            );

            if (API_CONFIG.DEBUG) {
                console.log('📡 Fan email API response:', response.data);
            }

            if (response.data.success) {
                return {
                    success: true,
                    follower_id: (response.data.data as any)?.follower_id,
                    email: (response.data.data as any)?.email,
                };
            }

            return {
                success: false,
                error: response.data.error ?? 'unknown_error',
            };
        } catch (error: any) {
            if (API_CONFIG.DEBUG) {
                console.error('❌ Error updating fan email:', error.message);
            }
            return {
                success: false,
                error: error?.response?.data?.error ?? 'network_error',
            };
        }
    },
};

export default fanEmailApi;