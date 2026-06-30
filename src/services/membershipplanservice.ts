import { apiClient } from "./api";
import { API_CONFIG, getApiEndpoint } from "../constants/config";

export type PlanAction = "subscribe" | "current" | "upgrade" | "locked" | "disabled" | "hidden";

export interface Entitlement {
  has_membership: boolean;
  source: string | null;
  tier: string;
  status: string;
  sessions_remaining: number | null;
  current_period_end: string | null;
}

export interface PlanItem {
  product_id: string;
  tier: string;
  rank: number;
  sessions: number;
  unlimited: boolean;
  action: PlanAction;
  message_code: string | null;
}

export interface MembershipPlansData {
  price_source: string;
  entitlement: Entitlement;
  global_message_code: string | null;
  plans: PlanItem[];
}

interface MembershipPlansApiResponse {
  success: boolean;
  data: MembershipPlansData;
  error: string | null;
}

export const membershipPlanService = {
  async getApplePlans(): Promise<MembershipPlansData> {
    try {
      if (API_CONFIG.DEBUG) {
        console.log("📡 Fetching apple membership plans");
      }

      const url = getApiEndpoint(API_CONFIG.ENDPOINTS.APPLE_MEMBERSHIP_PLANS);
      const headers = await API_CONFIG.getHeaders();

      const response = await apiClient.post<MembershipPlansData>(url, {}, {
        headers,
      });

      if (response.success && response.data) {
        if (API_CONFIG.DEBUG) {
          console.log("Membership plans loaded:", {
            tier: response.data.entitlement.tier,
            status: response.data.entitlement.status,
            globalMessage: response.data.global_message_code,
          });
        }

        return response.data;
      }

      throw new Error(response.error || "Failed to fetch membership plans");
    } catch (error: any) {
      if (API_CONFIG.DEBUG) {
        console.error("❌ Error fetching membership plans:", error.message);
      }
      throw error;
    }
  },
};