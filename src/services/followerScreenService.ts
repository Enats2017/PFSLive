import { apiClient } from "./api";
import { API_CONFIG, getApiEndpoint, getDeviceId } from "../constants/config";
import { getCurrentLanguageId } from "../i18n";

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface SuggestionItem {
  product_app_id: number;
  name: string;
  race_date: string;
  race_time: string | null;
  country: string;
  city: string;
  event_image:string,
  tab?: "past" | "live" | "upcoming";
}



interface SuggestionParams {
  filter_name?: string;
  filter_name_past_suggestion?: string;
}

type SuggestionResponse = {
  suggestions?: SuggestionItem[];
  participants?: SuggestionItem[];
};

// ─── Service ──────────────────────────────────────────────────────────────────

export const suggestionService = {
  async getSuggestions(params: SuggestionParams): Promise<SuggestionItem[]> {
    try {
      const url = getApiEndpoint(API_CONFIG.ENDPOINTS.EVENTS_LIST);
      // ✅ X-Device-Id: per-phone rate limit on the server (ApiSecurity
      // rate_scope_field) instead of per venue IP; a header, so the response
      // cache (keyed on the body) is unchanged (app audit 2026-11-26).
      const deviceId = await getDeviceId().catch(() => '');
      const headers = { ...(await API_CONFIG.getHeaders()), ...(deviceId ? { 'X-Device-Id': deviceId } : {}) };

      const requestBody = {
        language_id: getCurrentLanguageId(),
        page_past: 0,
        page_live: 0,
        page_upcoming: 0,
        is_participant: "0",
        filter_name_past: "",
        filter_name_live: "",
        filter_name_upcoming: "",
        page_participant: 0,
        filter_name: params.filter_name ?? "",
        filter_name_past_suggestion: params.filter_name_past_suggestion ?? "",
      };

      if (API_CONFIG.DEBUG) {
        console.log("📡 Fetching suggestions:", requestBody);
      }

      const response = await apiClient.post<SuggestionResponse>(
        url,
        requestBody,
        { headers },
      );

      

      if (response.success && response.data) {
        const results = response.data.suggestions ?? [];

        return results;
      }

      return [];
    } catch (error: any) {
      if (API_CONFIG.DEBUG) {
        console.error("❌ Error fetching suggestions:", error.message);
      }
      return [];
    }
  },
};