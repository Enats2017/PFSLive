import { apiClient } from "./api";
import { API_CONFIG, getApiEndpoint } from "../constants/config";
import { getCurrentLanguageId } from "../i18n";

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface SuggestionItem {
  product_app_id: number;
  name: string;
  race_date: string;
  race_time: string | null;
  country: string;
  city: string;
  tab?: "past" | "live" | "upcoming";
}

export interface AthleteSuggestionItem {
  customer_app_id: number;
  firstname: string;
  lastname: string;
  city: string;
  country: string;
  profile_picture?: string;
  flag_url?: string | null;
  password_protected?: 0 | 1;
}

interface SuggestionParams {
  filter_name?: string;
  filter_name_past_suggestion?: string;
  filter_name_participant?: string;
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
      const headers = await API_CONFIG.getHeaders();

      const requestBody = {
        language_id: getCurrentLanguageId(),
        page_past: 0,
        page_live: 0,
        page_upcoming: 0,
        is_participant: "1",
        filter_name_past: "",
        filter_name_live: "",
        filter_name_upcoming: "",
        page_participant: 0,
        filter_name: params.filter_name ?? "",
        filter_name_past_suggestion: params.filter_name_past_suggestion ?? "",
        filter_name_participant: params.filter_name_participant ?? "",
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
        const results = response.data.suggestions ?? response.data.participants ?? [];
       if (API_CONFIG.DEBUG) {
        console.log("✅ Suggestions loaded:", results.length);
        console.log("✅ Raw response.data:", JSON.stringify(response.data, null, 2));  // ← add this
        console.log("✅ Results array:", JSON.stringify(results, null, 2));             // ← add this
    }
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