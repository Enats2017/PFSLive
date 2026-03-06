import { API_CONFIG, getApiEndpoint } from "../constants/config";
import { apiClient } from "./api";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PersonalEvent {
  product_custom_app_id: number;
  name: string;
  event_type: string; 
  race_date: string; 
  start_hour: string; 
  timezone: string;
  gpx_path: string; 
}

export interface SelectedFile {
  uri: string;
  name: string;
  size: number;
  mimeType?: string;
}

export interface UpdatePersonalEventParams {
  eventId: number;
  name: string;
  eventTypeId: number | null;
  date: string;
  startTime: string;
  timezone: string;
  selectedFile?: SelectedFile;
  removeGpx?: boolean;
}

interface GetEventResponse {
  event: PersonalEvent;
}

interface UpdateEventResponse {
  message: string;
  event: PersonalEvent;
}
// ─── API calls 
export const getPersonalEvent = async (
  eventId: number,
): Promise<PersonalEvent> => {
  const headers = await API_CONFIG.getHeaders();

  const { data } = await apiClient.post<GetEventResponse>(
    getApiEndpoint(API_CONFIG.ENDPOINTS.GET_CUSTOM_EVENT),
    { product_custom_app_id: eventId },
    { headers },
  );

  if (!data?.event) {
    if (API_CONFIG.DEBUG)
      console.error("etPersonalEvent unexpected shape:", data);
    throw new Error("EVENT_DATA_MISSING");
  }

  return data.event;
};

export const updatePersonalEvent = async (
  params: UpdatePersonalEventParams,
): Promise<{ success: boolean; message: string }> => {
  const headers = await API_CONFIG.getMutiForm();
  const body = new FormData();
  body.append("product_custom_app_id", String(params.eventId));
  body.append("name", params.name);
  if (params.eventTypeId !== null) {
    body.append("event_type", String(params.eventTypeId));
  }
  body.append("race_date", params.date);
  body.append("start_hour", params.startTime);
  body.append("timezone", params.timezone);

  if (params.selectedFile) {
    body.append("gpx_file", {
      uri: params.selectedFile.uri,
      name: params.selectedFile.name,
      type: params.selectedFile.mimeType || "application/gpx+xml",
    } as any);
  } else if (params.removeGpx) {
    body.append("remove_gpx", "1");
  }

  const { data } = await apiClient.post<UpdateEventResponse>(
    getApiEndpoint(API_CONFIG.ENDPOINTS.UPDATE_CUSTOM_EVENT),
    body,
    {
      headers,
      timeout: API_CONFIG.TIMEOUT,
    },
  );
  if (API_CONFIG.DEBUG) {
    console.log(
      "updatePersonalEvent raw response:",
      JSON.stringify(data, null, 2),
    );
  }

  if (!data.message || !data.event) {
    if (API_CONFIG.DEBUG)
      console.error("❌ updatePersonalEvent unexpected shape:", data);
    throw new Error("UPDATE_FAILED");
  }

  return { success: true, message: data.message };
};

// ─── Utilities 
export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
};

export const getDeviceTimezone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
};
