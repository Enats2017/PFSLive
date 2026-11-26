import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import { API_CONFIG } from "../constants/config";

export type ErrorType = "network" | "server" | "empty";

export class AppError extends Error {
  constructor(
    public type: ErrorType,
    public code: string,
    // The error body's `data` (respondError's $extra) — structured detail a
    // caller needs, e.g. follow_conflict carries the row's current lists.
    public data?: any,
  ) {
    super(code);
    this.name = "AppError";
  }
}

/** Seconds from a 429's Retry-After header (ApiSecurity sends delta-seconds). */
export function retryAfterSeconds(headers: any): number | null {
  const raw = headers ? (headers["retry-after"] ?? headers["Retry-After"]) : undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.min(Math.ceil(n), 600) : null;
}

/**
 * Is this error a rate-limit (HTTP 429) answer? handleError marks it with
 * data.rateLimited; the code keeps the server's own text ("rate limit
 * exceeded. try again in 60s."), which locationService's send-failure log
 * already recognises — so that diagnostic is unchanged.
 */
export function isRateLimited(err: any): boolean {
  return !!err && (err.data?.rateLimited === true || /rate limit/i.test(String(err.code ?? "")));
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
  "permission_denied",
  "maintenance",
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

  // ✅ postRaw — like post() but returns the full AxiosResponse including
  // status and data on error responses (4xx). Use this when you need to
  // inspect error.response.data.fields for field-level validation errors
  // instead of having them swallowed by handleError().
  async postRaw<T>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> {
    try {
      return await this.client.post<T>(url, data, config);
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        if (API_CONFIG.DEBUG) {
          console.log(
            "❌ Full backend response:",
            JSON.stringify(error.response?.data, null, 2),
          );
          console.log("❌ Status code:", error.response?.status);
        }

        // Network error — no response at all
        if (
          !error.response ||
          error.code === "ERR_NETWORK" ||
          error.code === "ECONNABORTED" ||
          error.code === "ETIMEDOUT"
        ) {
          throw new AppError("network", "network_error");
        }

        // ✅ Return the error response as-is so callers can read
        // response.data.fields, response.data.error, etc.
        if (error.response) {
          return error.response as AxiosResponse<T>;
        }
      }
      throw new AppError("server", "unknown");
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
        error.response?.data?.code ||
        error.response?.data?.err ||
        error.code ||
        "unknown"
      )
        .toString()
        .toLowerCase();

      if (
        !error.response ||
        error.code === "ERR_NETWORK" ||
        error.code === "ECONNABORTED" ||
        error.code === "ETIMEDOUT"
      ) {
        return new AppError("network", "network_error");
      }

      // ✅ An expired or rejected token must never look like "no data".
      //
      // This branch has to sit AHEAD of the EMPTY_CODES / status >= 400 checks
      // below: a 401 is a 4xx, so it used to fall into `new AppError("empty")`
      // and every screen in the app rendered its empty state — "No Followers
      // Yet", "Not Following Anyone" — for a user whose session had simply run
      // out. Tokens are a hard 90-day expiry server-side (AuthToken.php,
      // TOKEN_LIFETIME_DAYS), so this is a path real users reach, not an edge
      // case.
      //
      // Type "server", NOT "empty": ErrorScreen hides its action button for
      // type="empty", and this is the one error the user can actually fix.
      if (status === 401 || code === "unauthorized" || code === "session_expired") {
        return new AppError("server", "session_expired");
      }

      // ✅ 429 = "too many requests from this address", never "no data"
      // (app audit 2026-11-26). It used to fall into the 4xx → "empty" branch
      // below, so a race-venue Wi-Fi over ApiSecurity's per-IP limit told every
      // fan "No data found" on the results list — with no Retry button, since
      // ErrorScreen hides it for type "empty". Type "server" keeps Retry, and
      // `data.retryAfter` (the Retry-After header, seconds) lets pollers back off.
      // Ahead of EMPTY_CODES: the body's error text is free-form.
      if (status === 429) {
        return new AppError("server", code, {
          rateLimited: true,
          retryAfter: retryAfterSeconds(error.response?.headers),
        });
      }

      if (EMPTY_CODES.has(code) || status === 404 || status === 204) {
        return new AppError("empty", code);
      }

      if (status && status >= 500) return new AppError("server", code);

      if (status && status >= 400) return new AppError("empty", code, error.response?.data?.data);
    }

    return new AppError("server", "unknown");
  }
}

export const apiClient = new ApiClient();