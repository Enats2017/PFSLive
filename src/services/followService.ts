// services/followService.ts  ← create this new file

import { API_CONFIG, getApiEndpoint } from "../constants/config";
import { tokenService } from "./tokenService";

interface VerifyPasswordResponse {
  success: boolean;
  data: { verified: 1 };
  error: string | null;
}

export type VerifyPasswordError =
  | "wrong_password"
  | "password_required"
  | "password_not_configured"
  | "unknown_error";

class FollowService {
  async verifyTrackingPassword(
    customerAppId: number,
    password: string,
  ): Promise<boolean> {
    try {
      const token = await tokenService.getToken();

      const response = await fetch(
        getApiEndpoint(API_CONFIG.ENDPOINTS.VERIFY_TRACKING_PASSWORD),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            customer_app_id: customerAppId,
            password: password.trim(),
          }),
        },
      );

      let json: VerifyPasswordResponse | null = null;

      try {
        json = await response.json();
      } catch {
        throw new Error("invalid_response");
      }

      if (__DEV__) {
        console.log("🔍 FULL RESPONSE:", json);
      }

      // ✅ Backend-driven error handling
      if (!json?.success) {
        throw new Error(
          (json?.error as VerifyPasswordError) || "unknown_error",
        );
      }

      return Boolean(json.data?.verified === 1);
    } catch (error: any) {
      if (__DEV__) {
        console.error("❌ Verify error:", error.message);
      }
      throw error;
    }
  }
}

export const followService = new FollowService();
