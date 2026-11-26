import axios from 'axios';
import { API_CONFIG, getApiEndpoint } from '../constants/config';
import { tokenIssueGate } from './authFlowGuards';

// ✅ TYPES
export type OtpPurpose = 'registration' | 'forgot_password' | 'device_change' | 'email_change';

export interface VerifyOtpPayload {
  verification_token: string;
  otp: string;
    purpose: OtpPurpose;
  // ✅ device_change only. The server binds the target device at request time
  // and refuses to complete on any other handset, so a code read out of the
  // owner's mailbox is useless on a stranger's phone.
  device_id?: string;
}

export interface ResendOtpPayload {
  verification_token: string;
  purpose: OtpPurpose;
}

export interface OtpResponse {
  success: boolean;
  error?:  string | null;
  // ✅ Client-side only - see otpService.verify.
  superseded?: boolean;
  data?: {
    purpose?:              string;       // ✅ both flows
    token?:                string;       // ✅ registration only
    password_reset_token?: string;       // ✅ forgot password only
    customer?: {                         // ✅ registration only
      customer_app_id: number;
      firstname:       string;
      lastname:        string;
      email:           string;
      city:            string;
      country:         string;
      country_id:      number;
      dob:             string;
      gender:          string;
      profile_picture: string;
      email_verified?: number;
    };
  };
}

// ✅ OTP SERVICE
export const otpService = {
  /**
   * Verify OTP code
   */
  async verify(payload: VerifyOtpPayload): Promise<OtpResponse> {
    // ✅ registration / device_change issue the account's single token, exactly
    // like login - same newest-wins ticket (see authService.login, audit
    // 2026-11-26 findings 1-2). Forgot password and email change issue none.
    const issuesToken = payload.purpose === 'registration' || payload.purpose === 'device_change';
    const ticket = issuesToken ? tokenIssueGate.begin() : 0;
    try {
      const headers = await API_CONFIG.getHeaders();

      if (API_CONFIG.DEBUG) {
        console.log('📤 Verify OTP request');
      }

      const response = await axios.post<OtpResponse>(
        getApiEndpoint(API_CONFIG.ENDPOINTS.VERIFY_OTP),
        payload,
        {
          headers,
          timeout: API_CONFIG.TIMEOUT,
        }
      );

      if (API_CONFIG.DEBUG) {
        console.log('✅ OTP verified:', response.data.success);
      }

      if (issuesToken && response.data?.data?.token && !tokenIssueGate.isLatest(ticket)) {
        // Overtaken by a newer token-issuing request: this token is already
        // revoked server-side. The caller must not save it or log in on it.
        return { ...response.data, superseded: true };
      }

      return response.data;
    } catch (error) {
      if (API_CONFIG.DEBUG) {
        console.error('❌ Verify OTP error:', error);
      }
      throw error;
    }
  },

  /**
   * Resend OTP code
   */
  async resend(payload: ResendOtpPayload): Promise<OtpResponse> {
    try {
      const headers = await API_CONFIG.getHeaders();

      if (API_CONFIG.DEBUG) {
        console.log('📤 Resend OTP request');
      }
    
      const response = await axios.post<OtpResponse>(
        getApiEndpoint(API_CONFIG.ENDPOINTS.RESEND_OTP),
        payload,
        {
          headers,
          timeout: API_CONFIG.TIMEOUT,
        }
      );

      if (API_CONFIG.DEBUG) {
        console.log('✅ OTP resent:', response.data.success);
      }

      return response.data;
    } catch (error) {
      if (API_CONFIG.DEBUG) {
        console.error('❌ Resend OTP error:', JSON.stringify(error));
      }
      throw error;
    }
  },
};

// ✅ BACKWARD COMPATIBILITY (deprecated, use otpService instead)
export const verifyOtp = otpService.verify;
export const resendOtp = otpService.resend;