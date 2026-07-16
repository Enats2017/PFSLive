import axios from 'axios';
import { Platform } from 'react-native';
import { API_CONFIG, APP_CONFIG, getApiEndpoint } from '../constants/config';

// ==================== TYPES ====================

interface StandardApiResponse<T = any> {
    success: boolean;
    data: T;
    error: string | null;
}

export type TopicKey = 'bug' | 'feature' | 'event' | 'billing' | 'other';

export interface SubmitFeedbackPayload {
    topic: TopicKey;
    message: string;
    name?: string;
    email?: string;
    event_id?: number;
}

interface SubmitFeedbackResult {
    success: boolean;
    feedback_id?: number;
    error?: string;
}

// ==================== CONSTANTS ====================

// ✅ Mirrors backend private $allowed_topics — keep in sync with the PHP array
export const ALLOWED_TOPICS: TopicKey[] = ['bug', 'feature', 'event', 'billing', 'other'];

const MESSAGE_MIN_LENGTH = 3;
const MESSAGE_MAX_LENGTH = 500; // UI cap shown in char-count; backend allows up to 5000

// ==================== VALIDATION ====================
// Client-side mirror of backend rules — fails fast before the network call.
// Backend re-validates independently (message length, topic whitelist);
// this is purely for immediate UX feedback.

export function validateFeedback(payload: SubmitFeedbackPayload): string | null {
    const msg = payload.message?.trim() ?? '';

    if (!msg || msg.length < MESSAGE_MIN_LENGTH) return 'message_required';
    if (msg.length > MESSAGE_MAX_LENGTH) return 'message_too_long';
    if (!payload.topic || !ALLOWED_TOPICS.includes(payload.topic)) return 'topic_required';
    if (payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) return 'invalid_email';

    return null; // null = valid
}

// ==================== SERVICE ====================

/**
 * Feedback submission — attaches to the logged-in customer via the
 * Bearer token in API_CONFIG.getHeaders() (server resolves customer_app_id
 * from it via AuthToken::verify).
 */
export const feedbackApi = {
    async submit(payload: SubmitFeedbackPayload): Promise<SubmitFeedbackResult> {
        try {
            const headers = await API_CONFIG.getHeaders();

            const requestBody = {
                ...payload,
                message: payload.message.trim(),
                name: payload.name?.trim() || undefined,
                email: payload.email?.trim() || undefined,
                app_version: APP_CONFIG.VERSION,
                platform: Platform.OS,
                device_info: `${Platform.OS} ${Platform.Version}`,
            };

            if (API_CONFIG.DEBUG) {
                console.log('📤 Sending feedback:', requestBody);
            }

            const response = await axios.post<StandardApiResponse<SubmitFeedbackResult>>(
                getApiEndpoint(API_CONFIG.ENDPOINTS.SUBMIT_FEEDBACK),
                requestBody,
                {
                    headers,
                    timeout: API_CONFIG.TIMEOUT,
                },
            );

            if (API_CONFIG.DEBUG) {
                console.log('📡 Feedback API response:', response.data);
            }

            if (response.data.success) {
                return {
                    success: true,
                    feedback_id: (response.data.data as any)?.feedback_id,
                };
            }

            return {
                success: false,
                error: response.data.error ?? 'unknown_error',
            };
        } catch (error: any) {
            if (API_CONFIG.DEBUG) {
                console.error('❌ Error submitting feedback:', error.message);
            }
            return {
                success: false,
                error: error?.response?.data?.error ?? 'network_error',
            };
        }
    },
};

export default feedbackApi;