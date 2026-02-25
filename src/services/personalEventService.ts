import { API_CONFIG, getApiEndpoint } from "../constants/config";
import axios from "axios";

export interface PersonalEventPayload {
  name: string;
  eventTypeId: number | null; // ✅ proper type instead of any
  date: string;
  startTime: string;
  endTime: String;
  selectedFile?: {
    // ✅ typed instead of any
    uri: string;
    name: string;
    mimeType: string;
    size: number;
  };
}

export const createPersonalEvent = async (payload: PersonalEventPayload) => {
  const { name, eventTypeId, date, startTime, endTime, selectedFile } = payload;

  const formData = new FormData();
  formData.append("name", name);

  if (eventTypeId !== null && eventTypeId !== undefined) {
    formData.append("event_type", String(eventTypeId)); // ✅ safely convert to string
  }

  formData.append("race_date", date);

  // ✅ normalize startTime to HH:MM:SS format
  formData.append(
    "start_hour",
    startTime.length === 5 ? `${startTime}:00` : startTime,
  );
//   if (endTime && endTime.trim()) {
//     formData.append(
//       "end_hour",
//       endTime.length === 5 ? `${endTime}:00` : endTime,
//     );
//   } // ✅ add this

  if (selectedFile) {
    formData.append("gpx_file", {
      uri: selectedFile.uri,
      name: selectedFile.name,
      type: selectedFile.mimeType ?? "application/gpx+xml", // ✅ fallback mime type
    } as any);
  }

  const headers = await API_CONFIG.getMutiForm(); // consider fixing typo: getMutiForm → getMultipartForm
  const response = await axios.post(
    getApiEndpoint(API_CONFIG.ENDPOINTS.Personal_Event),
    formData,
    { headers },
  );

  return response.data;
};
