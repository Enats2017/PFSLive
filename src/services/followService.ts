// services/followService.ts  ← create this new file

import { API_CONFIG, getApiEndpoint } from '../constants/config';
import { tokenService } from './tokenService';

interface VerifyPasswordResponse {
    success: boolean;
    data: { verified: 1 };
    error: string | null;
}

export type VerifyPasswordError =
    | 'wrong_password'
    | 'password_required'
    | 'password_not_configured'
    | 'unknown_error';

class FollowService {

    async verifyTrackingPassword(
        customerAppId: number,
        password: string
    ): Promise<boolean> {
        try {
            const token = await tokenService.getToken();

            const response = await fetch(
                getApiEndpoint(API_CONFIG.ENDPOINTS.VERIFY_TRACKING_PASSWORD),
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                        customer_app_id: customerAppId,
                        password,
                    }),
                }
            );

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const json: VerifyPasswordResponse = await response.json();
            console.log('✅ [FollowService] Verify response:', JSON.stringify(json, null, 2));
            return json.success === true && json.data?.verified === 1;

        } catch (error) {
            console.error('❌ [FollowService] Verify error:', error);
            throw error;
        }
    }
}

export const followService = new FollowService();