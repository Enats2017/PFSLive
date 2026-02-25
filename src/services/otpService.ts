import axios from 'axios';
import { API_CONFIG, getApiEndpoint } from '../constants/config';

export interface VerifyOtpPayload {
  verification_token: string;
  otp: string;
}

export interface ResendOtpPayload {
  verification_token: string;
}

export const verifyOtp = async (payload: VerifyOtpPayload) => {
  const { verification_token, otp } = payload;
  const headers = await API_CONFIG.getHeaders();
  const response = await axios.post(
    getApiEndpoint(API_CONFIG.ENDPOINTS.VERIFY_OTP),
    { verification_token, otp },
    { headers }
  );
  return response.data;
};

export const resendOtp = async (payload: ResendOtpPayload) => {
  const { verification_token } = payload;
  const headers = await API_CONFIG.getHeaders();
  const response = await axios.post(
    getApiEndpoint(API_CONFIG.ENDPOINTS.RESEND_OTP),
    { verification_token },
    { headers, timeout: API_CONFIG.TIMEOUT }
  );
  return response.data;
};