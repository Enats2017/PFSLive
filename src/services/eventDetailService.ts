import { apiClient } from "./api";
import { API_CONFIG, getApiEndpoint } from "../constants/config";
import { getCurrentLanguageId } from "../i18n";
import { toastSuccess } from "../../utils/toast";

export type RegistrationStatus =
  | "registered"
  | "membership_required"
  | "limit_reached"
  | "unavailable"
  | "available";

export interface Distance {
  product_option_value_app_id: number;
  product_option_app_id: number;
  distance_name: string;
  race_date: string;
  race_time: string;
  countdown_type: "minutes" | "hours" | "days" | "in_progress" | "finished";
  countdown_value: number;
  countdown_label: string;
  registration_status: RegistrationStatus;
}

export interface EventDetailResponse {
  distances: Distance[];
  server_datetime: string;
}

// ✅ FIX: made internal — never needed outside this file
interface EventDetailApiResponse {
  success: boolean;
  data: EventDetailResponse;
  error: string | null;
}

export interface RegisterParticipantRequest {
  product_option_value_app_id: number;
  language_id: number;
  bib_number?: string;
}

export interface RaceResultData {
  bib_number: string;
  firstname: string;
  lastname: string;
  dob: string;
  gender: string;
  city: string;
  country: string;
  nation: string;
  distance_name: string;
  email: string;
}

export interface ParticipantData {
  participant_app_id: number;
  race_id: number;
  race_name: string;
  race_distance: string;
  race_date: string;
  race_time: string;
  product_option_value_app_id: number;
}

export interface RegisterParticipantResponse {
  action: "confirm_race_result" | "registered";
  is_first_tracking: 0 | 1;
  race_result_data?: RaceResultData;
  participant?: ParticipantData;
}

// ✅ FIX: made internal — never needed outside this file
interface RegisterApiResponse {
  success: boolean;
  data: RegisterParticipantResponse;
  error: string | null;
}

const extractBackendError = (error: any): string => {
  return (
    error?.response?.data?.error || // ← exact backend error code e.g. 'not_found_in_race_result'
    error?.response?.data?.message || // ← alternate field
    error?.message || // ← fallback
    "unknown_error"
  );
};

// ─── Services ─────────────────────────────────────────────────────────────────

export const eventDetailService = {
  // ─── Get event distances ───────────────────────────────────────────────────
  async getEventDetails(
    product_app_id: string | number,
  ): Promise<EventDetailResponse> {
    try {
      const language_id = getCurrentLanguageId();

      if (API_CONFIG.DEBUG) {
        console.log("Fetching event details for:", product_app_id);
      }

      const url = getApiEndpoint(API_CONFIG.ENDPOINTS.EVENT_DETAIL);
      const headers = await API_CONFIG.getHeaders();

      const response = await apiClient.post<EventDetailApiResponse>(
        url,
        { language_id, product_app_id },
        { headers },
      );

      if (response.success && response.data) {
        if (API_CONFIG.DEBUG) {
          console.log(
            "Event details loaded:",
            response.data.distances?.length ?? 0,
            "distances",
          );
        }
        return {
          distances: response.data.distances ?? [],
          server_datetime: response.data.server_datetime ?? "",
        };
      }

      // ✅ FIX: was only throwing response.error
      // now throws exact backend error so UI can show correct message
      throw new Error(response.error ?? "Failed to fetch event details");
    } catch (error: any) {
      if (API_CONFIG.DEBUG) {
        console.error(
          "Error fetching event details:",
          extractBackendError(error),
        );
      }
      // ✅ FIX: re-throw with exact backend error code not HTTP message
      throw new Error(extractBackendError(error));
    }
  },

  // ─── Register participant ──────────────────────────────────────────────────
  async registerParticipant(
    product_option_value_app_id: number,
    bib_number?: string, // pass only on confirm step
    language_id?: number, 
  ): Promise<RegisterParticipantResponse> {
    try {
      const lang_id = language_id ?? getCurrentLanguageId();
      if (API_CONFIG.DEBUG) {
        console.log(
          "Registering participant for distance:",
          product_option_value_app_id,
        );
      }
      const url = getApiEndpoint(API_CONFIG.ENDPOINTS.REGISTER_PARTICIPANT);
      const headers = await API_CONFIG.getHeaders();
      const body: RegisterParticipantRequest = {
        product_option_value_app_id,
        language_id: lang_id,
      };
      // only add bib_number if provided (confirm step)
      if (bib_number && bib_number.trim() !== "") {
        body.bib_number = bib_number.trim();
      }

      if (API_CONFIG.DEBUG) {
        console.log("📡 Register request body:", body);
      }

      const response = await apiClient.post<RegisterApiResponse>(url, body, {
        headers,
      });

      if (response.success && response.data) {
         toastSuccess("Thank you for signing up for the live tracking of this event. Tell your your family and friends to follow you here and don't forget to activate your live tracking from 1h before the start of your race in this app !")
        if (API_CONFIG.DEBUG) {
          console.log("✅ Register response action:", response.data.action);
        }
        return response.data;
      }
      throw new Error(response.error ?? "Registration failed");
    } catch (error: any) {
      if (API_CONFIG.DEBUG) {
        // add this in your catch block temporarily
        console.log(
          "Full backend response:",
          JSON.stringify(error?.response?.data, null, 2),
        );
        console.log("Status code:", error?.response?.status);
      }
      throw new Error(extractBackendError(error));
    }
  },
};
