import axios from "axios";
import { API_CONFIG, getApiEndpoint, getDeviceId } from "../constants/config";
import { tokenService } from "./tokenService";
import { getCurrentLanguageId } from "../i18n";

// ✅ TYPES
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  firstname: string;
  lastname: string;
  email: string;
  password: string;
  country_id: string;
  city: string;
  dob: string;
  gender: string;
  profileImage?: string;
}

export interface Customer {
  customer_app_id: number;
  firstname: string;
  lastname: string;
  email: string;
  city: string;
  country: string;
  country_id: number;
  dob: string;
  gender: string;
  profile_picture: string;
}

export interface AuthResponse {
  success: boolean;
  error?: string;
  fields?: string[];
  data?: {
    token?: string;
    email?: string;
    message?: string;
    verification_token?: string;
    customer?: Customer;
  };
}

export interface ForgotPasswordResponse {
  success: boolean;
  error?: string | null;
  data?: {
    action: string; // 'otp_sent'
    verification_token?: string;
  };
}

export interface ResetPasswordResponse {
  success: boolean;
  error?: string | null;
  data?: {
    action: string; // 'password_reset'
  };
}

// ✅ CONSTANTS
const I_AGREE_VALUE = "1";

// ✅ HELPER FUNCTIONS
const getImageMimeType = (filename: string): string => {
  const extension = filename.split(".").pop()?.toLowerCase() ?? "jpg";
  return extension === "png" ? "image/png" : "image/jpeg";
};

const buildRegisterFormData = async (
  data: RegisterRequest,
): Promise<FormData> => {
  const deviceId = await getDeviceId();
  const languageId = getCurrentLanguageId();

  const formData = new FormData();
  formData.append("firstname", data.firstname.trim());
  formData.append("lastname", data.lastname.trim());
  formData.append("email", data.email.trim().toLowerCase());
  formData.append("password", data.password);
  formData.append("country_id", data.country_id);
  formData.append("city", data.city.trim());
  formData.append("dob", data.dob);
  formData.append("language_id", String(languageId));
  formData.append("gender", data.gender.toLowerCase());
  formData.append("i_agree", I_AGREE_VALUE);
  formData.append("device_id", deviceId);

  // Attach profile picture if provided
  if (data.profileImage) {
    const filename = data.profileImage.split("/").pop() ?? "profile.jpg";
    const mimeType = getImageMimeType(filename);

    formData.append("profile_picture", {
      uri: data.profileImage,
      name: filename,
      type: mimeType,
    } as any);
  }

  return formData;
};

// ✅ AUTH SERVICE
export const authService = {
  /**
   * Login user
   */
  async login(email: string, password: string): Promise<AuthResponse> {
    try {
      const deviceId = await getDeviceId();
      const headers = await API_CONFIG.getHeaders();

      const requestBody = {
        email: email.trim().toLowerCase(),
        password,
        device_id: deviceId,
      };

      if (API_CONFIG.DEBUG) {
        console.log("📤 Login request:", {
          email: requestBody.email,
          device_id: deviceId,
        });
      }

      const response = await axios.post<AuthResponse>(
        getApiEndpoint(API_CONFIG.ENDPOINTS.LOGIN),
        requestBody,
        {
          headers,
          timeout: API_CONFIG.TIMEOUT,
        },
      );

      if (response.data.success && response.data.data?.token) {
        await tokenService.saveToken(response.data.data.token);
        await tokenService.saveCustomerId(
          response.data.data?.customer?.customer_app_id ?? 0,
        );

        if (API_CONFIG.DEBUG) {
          console.log("✅ Login successful, token saved");
        }
      }

      return response.data;
    } catch (error) {
      if (API_CONFIG.DEBUG) {
        console.error("❌ Login error:", error);
      }
      throw error;
    }
  },

  /**
   * Register new user
   */
  async register(data: RegisterRequest): Promise<AuthResponse> {
    try {
      const formData = await buildRegisterFormData(data);

      if (API_CONFIG.DEBUG) {
        console.log("📤 Register request:", {
          firstname: data.firstname,
          lastname: data.lastname,
          email: data.email,
          country_id: data.country_id,
          city: data.city,
          dob: data.dob,
          gender: data.gender,
          hasProfileImage: !!data.profileImage,
        });
      }

      const headers = {
        "Content-Type": "multipart/form-data",
      };

      const response = await axios.post<AuthResponse>(
        getApiEndpoint(API_CONFIG.ENDPOINTS.REGISTER),
        formData,
        {
          headers,
          timeout: API_CONFIG.TIMEOUT,
        },
      );

      if (API_CONFIG.DEBUG) {
        console.log("✅ Register response:", {
          success: response.data.success,
          hasVerificationToken: !!response.data.data?.verification_token,
        });
      }

      return response.data;
    } catch (error) {
      if (API_CONFIG.DEBUG) {
        console.error("❌ Register error:", error);
      }
      throw error;
    }
  },

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    try {
      await tokenService.removeToken();
      if (API_CONFIG.DEBUG) {
        console.log("✅ Logout successful");
      }
    } catch (error) {
      if (API_CONFIG.DEBUG) {
        console.error("❌ Logout error:", error);
      }
    }
  },

  async forgotPassword(email: string): Promise<ForgotPasswordResponse> {
    try {
      const headers = await API_CONFIG.getHeaders();
      const requestBody = {
        email: email.trim().toLowerCase(),
      };
      if (API_CONFIG.DEBUG) {
        console.log("📤 Forgot password request:", requestBody);
      }
      const response = await axios.post<ForgotPasswordResponse>(
        getApiEndpoint(API_CONFIG.ENDPOINTS.FORGOT_PASSWORD),
        requestBody,
        {
          headers,
          timeout: API_CONFIG.TIMEOUT,
        },
      );

      if (API_CONFIG.DEBUG) {
        console.log("📥 Forgot password response:", response.data);
      }

      return response.data;
    } catch (error: any) {
      if (API_CONFIG.DEBUG) {
        console.log(
          "❌ Forgot password error:",
          JSON.stringify(error.response?.data),
        );
      }
      throw error;
    }
  },

  async resetPassword(
    passwordResetToken: string,
    password: string,
    confirmPassword: string,
  ): Promise<ResetPasswordResponse> {
    try {
      const headers = await API_CONFIG.getHeaders();

      const requestBody = {
        password_reset_token: passwordResetToken,
        password: password,
        confirm_password: confirmPassword,
      };

      if (API_CONFIG.DEBUG) {
        console.log("📤 Reset password request:", {
          password_reset_token: passwordResetToken,
        });
      }

      const response = await axios.post<ResetPasswordResponse>(
        getApiEndpoint(API_CONFIG.ENDPOINTS.RESET_PASSWORD),
        requestBody,
        {
          headers,
          timeout: API_CONFIG.TIMEOUT,
        },
      );

      if (API_CONFIG.DEBUG) {
        console.log("📥 Reset password response:", response.data);
      }

      return response.data;
    } catch (error: any) {
      if (API_CONFIG.DEBUG) {
        console.log(
          "❌ Reset password error:",
          JSON.stringify(error.response?.data),
        );
      }
      throw error;
    }
  },

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    return await tokenService.isAuthenticated();
  },
};
