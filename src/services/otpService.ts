import axios from 'axios';
import { API_CONFIG, getApiEndpoint } from '../constants/config';

// ✅ TYPES
export interface VerifyOtpPayload {
  verification_token: string;
  otp: string;
}

export interface ResendOtpPayload {
  verification_token: string;
}

export interface OtpResponse {
  success: boolean;
  error?: string;
  data?: {
    token?: string;
    message?: string;
  };
}

// ✅ OTP SERVICE
export const otpService = {
  /**
   * Verify OTP code
   */
  async verify(payload: VerifyOtpPayload): Promise<OtpResponse> {
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
        console.error('❌ Resend OTP error:', error);
      }
      throw error;
    }
  },
};

// ✅ BACKWARD COMPATIBILITY (deprecated, use otpService instead)
export const verifyOtp = otpService.verify;
export const resendOtp = otpService.resend;