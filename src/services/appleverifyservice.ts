import { apiClient } from "./api";
import { API_CONFIG, getApiEndpoint } from "../constants/config";

export interface VerifyPurchaseResponse {
    action: 'purchase_queued' | 'upgrade_queued' | 'already_processed';
}

export const appleVerifyService = {
    async verifyPurchase(transactionId: string): Promise<VerifyPurchaseResponse> {
        try {
            if (API_CONFIG.DEBUG) {
                console.log('📡 Verifying Apple purchase:', transactionId);
            }

            const url = getApiEndpoint(API_CONFIG.ENDPOINTS.APPLE_VERIFY_PURCHASE);
            const headers = await API_CONFIG.getHeaders();

            const response = await apiClient.post<VerifyPurchaseResponse>(
                url,
                { transaction_id: transactionId },
                { headers }
            );
            console.log('🔍 Verify raw response:', JSON.stringify(response, null, 2));

            if (response.success && response.data) {
                if (API_CONFIG.DEBUG) {
                    console.log('✅ Purchase verified:', response.data.action);
                }
                return response.data;
            }

            throw new Error(response.error || 'Failed to verify purchase');
        } catch (error: any) {
            if (API_CONFIG.DEBUG) {
                console.error('❌ Error verifying purchase:', error.message);
console.error('❌ Full error:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
            }
            throw error;
        }
    },
};