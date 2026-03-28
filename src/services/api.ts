import axios, { AxiosInstance, AxiosRequestConfig } from "axios";
import { API_CONFIG } from "../constants/config";

export type ErrorType = "network" | "server" | "empty";

export class AppError extends Error {
  constructor(
    public type: ErrorType,
    public code: string,
  ) {
    super(code);
    this.name = "AppError";
  }
}

const EMPTY_CODES = new Set([
  "not_found",
  "not_found_in_race_result",
  "no_data",
  "no_results",
  "empty",
  "record_not_found",
  "distance_not_found",
  "results_not_available",
  "participant_not_found",
  "event_not_found",
  "registration_closed",
  "session_expired",
  "permission_denied",
  "maintenance", // ← was missing, your backend sends this
]);

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
        "Content-Type": "application/json",
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
          console.error("❌ Request error:", error);
        }
        return Promise.reject(error);
      },
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
      },
    );
  }

  async get<T>(
    url: string,
    config?: AxiosRequestConfig,
  ): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.get<ApiResponse<T>>(url, config);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async post<T>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig,
  ): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.post<ApiResponse<T>>(
        url,
        data,
        config,
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async put<T>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig,
  ): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.put<ApiResponse<T>>(url, data, config);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async delete<T>(
    url: string,
    config?: AxiosRequestConfig,
  ): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.delete<ApiResponse<T>>(url, config);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  private handleError(error: any): AppError {
    if (axios.isAxiosError(error)) {
      if (API_CONFIG.DEBUG) {
        console.log(
          "❌ Full backend response:",
          JSON.stringify(error.response?.data, null, 2),
        );
        console.log("❌ Status code:", error.response?.status);
      }

      const status = error.response?.status;
      const code = (
        error.response?.data?.error ||
        error.response?.data?.message ||
        error.response?.data?.code || // ← add more field names your backend might use
        error.response?.data?.err ||
        error.code ||
        "unknown"
      )
        .toString()
        .toLowerCase();

      // Network — no response at all
      if (
        !error.response ||
        error.code === "ERR_NETWORK" ||
        error.code === "ECONNABORTED" ||
        error.code === "ETIMEDOUT"
      ) {
        return new AppError("network", "network_error");
      }

      if (EMPTY_CODES.has(code) || status === 404 || status === 204) {
        return new AppError("empty", code);
      }

      if (status && status >= 500) return new AppError("server", code);

      if (status && status >= 400) return new AppError("empty", code);
    }

    // Unknown
    return new AppError("server", "unknown");
  }
}

export const apiClient = new ApiClient();
