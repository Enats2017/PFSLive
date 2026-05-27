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