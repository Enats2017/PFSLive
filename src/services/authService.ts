import axios from "axios";
import { API_CONFIG, getApiEndpoint } from "../constants/config";
import { tokenService } from "./tokenService";
import { getCurrentLanguageId } from "../i18n";
import { getDeviceId } from "../constants/config";

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

export interface AuthResponse {
  success: boolean;
  error: string | null;
  fields?: string[];
  data?: {
    token: string;
    customer: {
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
    };
    email?: string;
    message?: string;
    verification_token?: string;
  };
}

export const authService = {
  /**
   * Login user
   */
  async login(email: string, password: string): Promise<AuthResponse> {
    console.log(email);
    console.log(password);

    try {
      const deviceId = await getDeviceId();
      const requestBody = {
        email: email,
        password: password,
        device_id: deviceId,
      };
      console.log(requestBody);

      const headers = await API_CONFIG.getHeaders();
      const response = await axios.post<AuthResponse>(
        getApiEndpoint(API_CONFIG.ENDPOINTS.LOGIN),
        requestBody,
        {
          headers,
          timeout: API_CONFIG.TIMEOUT,
        },
      );
      console.log("📥 Login response:", response.data.data?.token);
      if (response.data.success && response.data.data?.token) {
        await tokenService.saveToken(response.data.data.token);
        console.log(" OTP verified, token saved");
      }

      return response.data;
    } catch (error) {
      console.error("❌ Login error:", JSON.stringify(error, null, 2));
      throw error;
    }
  },

  /**
   * Register new user
   *
   */
  async register(data: RegisterRequest): Promise<AuthResponse> {
    try {
      const deviceId = await getDeviceId();
      console.log(deviceId);

      // 2. Build FormData (multipart for profile picture support)
      const language_id = getCurrentLanguageId();
      const formData = new FormData();
      formData.append("firstname", data.firstname.trim());
      formData.append("lastname", data.lastname.trim());
      formData.append("email", data.email.trim().toLowerCase());
      formData.append("password", data.password);
      formData.append("country_id", data.country_id);
      formData.append("city", data.city.trim());
      formData.append("dob", data.dob); // YYYY-MM-DD
      formData.append("language_id", String(language_id));
      formData.append("gender", data.gender.toLowerCase());
      formData.append("i_agree", "1");
      formData.append("device_id", deviceId);
      //formData.append("device_info", `${Platform.OS} ${Platform.Version}`);

      // 3. Attach profile picture if provided
      if (data.profileImage) {
        const filename = data.profileImage.split("/").pop() ?? "profile.jpg";
        const extension = filename.split(".").pop()?.toLowerCase() ?? "jpg";
        const mimeType = extension === "png" ? "image/png" : "image/jpeg";

        formData.append("profile_picture", {
          uri: data.profileImage,
          name: filename,
          type: mimeType,
        } as any);
      }
      console.log("Register Request Data:", {
        firstname: data.firstname.trim(),
        lastname: data.lastname.trim(),
        email: data.email.trim().toLowerCase(),
        password: data.password,
        country_id: data.country_id,
        city: data.city.trim(),
        dob: data.dob,
        gender: data.gender.toLowerCase(),
        i_agree: "1",
        profileImage: data.profileImage ?? "none",
      });

      const headers = {
        "Content-Type": "multipart/form-data",
      };

      const response = await axios.post<AuthResponse>(
        getApiEndpoint(API_CONFIG.ENDPOINTS.REGISTER),
        formData,
        { headers, timeout: API_CONFIG.TIMEOUT },
      );

      if (response.data.success && response.data.data?.verification_token) {
        console.log(response.data.data);
      }
      console.log("📥 Register Response:", response.data);

      return response.data;
    } catch (error: any) {
      console.log("❌ Status:", error.response?.status);
      console.log("❌ Data:", JSON.stringify(error.response?.data));
      throw error;
    }
  },

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    try {
      await tokenService.removeToken();
      console.log("✅ Logout successful");
    } catch (error) {
      console.error("❌ Logout error:", error);
    }
  },

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    return await tokenService.isAuthenticated();
  },
};
