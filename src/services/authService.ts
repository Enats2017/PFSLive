import axios from 'axios';
import { API_CONFIG, getApiEndpoint } from '../constants/config';
import { tokenService } from './tokenService';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  phone?: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data?: {
    token: string;
    user: {
      id: string;
      name: string;
      email: string;
    };
  };
}

export const authService = {
  /**
   * Login user
   */
  async login(email: string, password: string): Promise<AuthResponse> {
    try {
      const response = await axios.post<AuthResponse>(
        getApiEndpoint(API_CONFIG.ENDPOINTS.LOGIN),
        { email, password },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: API_CONFIG.TIMEOUT,
        }
      );

      if (response.data.success && response.data.data?.token) {
        // Save token to AsyncStorage
        await tokenService.saveToken(response.data.data.token);
        console.log('✅ Login successful, token saved');
      }

      return response.data;
    } catch (error) {
      console.error('❌ Login error:', error);
      throw error;
    }
  },

  /**
   * Register new user
   */
  async register(data: RegisterRequest): Promise<AuthResponse> {
    try {
      const response = await axios.post<AuthResponse>(
        getApiEndpoint(API_CONFIG.ENDPOINTS.REGISTER),
        data,
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: API_CONFIG.TIMEOUT,
        }
      );

      if (response.data.success && response.data.data?.token) {
        // Save token to AsyncStorage
        await tokenService.saveToken(response.data.data.token);
        console.log('✅ Registration successful, token saved');
      }

      return response.data;
    } catch (error) {
      console.error('❌ Registration error:', error);
      throw error;
    }
  },

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    try {
      await tokenService.removeToken();
      console.log('✅ Logout successful');
    } catch (error) {
      console.error('❌ Logout error:', error);
    }
  },

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    return await tokenService.isAuthenticated();
  },
};