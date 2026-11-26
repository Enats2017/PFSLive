import { apiClient } from "./api";
import { API_CONFIG, getApiEndpoint } from "../constants/config";

export interface VerifyPurchaseResponse {
    // renewal_queued / expired / revoked were already sent by
    // apple_verify_purchase_api.php, 'upgraded' is new (audit #12); the type
    // just had not caught up.
    action:
        | 'purchase_queued'
        | 'upgrade_queued'
        | 'renewal_queued'
        | 'already_processed'
        | 'expired'
        | 'revoked'
        | 'upgraded'
        // re-audit PN7: credited to the account the purchase was made for
        | 'credited_other_account';
}

// ✅ Longer than API_CONFIG.TIMEOUT (15 s) on purpose (payments audit
// 2026-11-26 #2): the server asks Apple's API (up to 15 s per environment,
// production then sandbox) and builds the order before it answers. At 15 s the
// app gave up on calls the server then completed, showed "please try again"
// for a purchase that was charged AND credited, and a retry bought a second one.
const VERIFY_TIMEOUT_MS = 45000;

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
                { headers, timeout: VERIFY_TIMEOUT_MS }
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