import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { API_CONFIG } from '../constants/config';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_CONFIG.BASE_URL,
      timeout: API_CONFIG.TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        if (API_CONFIG.DEBUG) {
          console.log(`📡 ${config.method?.toUpperCase()} ${config.url}`);
        }
        return config;
      },
      (error) => {
        if (API_CONFIG.DEBUG) {
          console.error('❌ Request error:', error);
        }
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        if (API_CONFIG.DEBUG) {
          console.log(`✅ ${response.config.url} ${response.status}`);
        }
        return response;
      },
      (error) => {
       
        return Promise.reject(error);
      }
    );
  }

  async get<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.get<ApiResponse<T>>(url, config);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.post<ApiResponse<T>>(url, data, config);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.put<ApiResponse<T>>(url, data, config);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.delete<ApiResponse<T>>(url, config);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  private handleError(error: any): Error {
  if (axios.isAxiosError(error)) {
    if (API_CONFIG.DEBUG) {
      // ✅ now you can see exact backend response
      console.log('❌ Full backend response:', JSON.stringify(error.response?.data, null, 2));
      console.log('❌ Status code:', error.response?.status);
    }

    // ✅ FIX: read exact backend error code your PHP sends
    // your PHP sends: { "success": false, "error": "not_found_in_race_result" }
    const backendError =
      error.response?.data?.error ||    // ← exact PHP error code
      error.response?.data?.message ||  // ← alternate field
      error.message ||                   // ← fallback
      'unknown_error';

    // ✅ FIX: throw new Error with exact backend code
    // so switch case in useRegistrationHandler works correctly
    const err = new Error(backendError);
    (err as any).response = error.response; // ← preserve response just in case
    return err;
  }
  return error;
}
}

export const apiClient = new ApiClient();