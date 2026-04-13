import { API_CONFIG, getApiEndpoint } from '../constants/config';
import { apiClient } from './api';

// ✅ TYPES
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
  success: boolean;
  event: PersonalEvent;
}

interface UpdateEventResponse {
  success: boolean;
  message: string;
  event: PersonalEvent;
}

// ✅ UPDATE RESPONSE — includes optional fields array for API validation errors
export interface UpdateEventResult {
  success: boolean;
  message: string;
  fields?: string[]; // ✅ e.g. ['name_required', 'race_date_invalid']
}

// ✅ GET PERSONAL EVENT
export const getPersonalEvent = async (eventId: number): Promise<PersonalEvent> => {
  try {
    const headers = await API_CONFIG.getHeaders();

    if (API_CONFIG.DEBUG) {
      console.log('📡 GET Personal Event Request:', {
        eventId,
        endpoint: API_CONFIG.ENDPOINTS.GET_CUSTOM_EVENT,
      });
    }

    const { data } = await apiClient.post<GetEventResponse>(
      getApiEndpoint(API_CONFIG.ENDPOINTS.GET_CUSTOM_EVENT),
      { product_custom_app_id: eventId },
      { headers, timeout: API_CONFIG.TIMEOUT }
    );

    if (API_CONFIG.DEBUG) console.log('✅ GET Personal Event Response:', data);

    if (!data?.event) {
      if (API_CONFIG.DEBUG) console.error('❌ Unexpected response shape:', data);
      throw new Error('EVENT_DATA_MISSING');
    }

    return data.event;
  } catch (error: any) {
    if (API_CONFIG.DEBUG) console.error('❌ Get Personal Event Error:', error);
    throw error;
  }
};

// ✅ UPDATE PERSONAL EVENT
export const updatePersonalEvent = async (
  params: UpdatePersonalEventParams
): Promise<UpdateEventResult> => {
  try {
    const headers = await API_CONFIG.getMutiForm();
    const body = new FormData();

    body.append('product_custom_app_id', String(params.eventId));
    body.append('name', params.name.trim());
    body.append('race_date', params.date);
    body.append('timezone', params.timezone);

    // ✅ startTime optional — only append if non-empty
    if (params.startTime?.trim()) {
      body.append('start_hour', params.startTime);
    }

    if (params.eventTypeId !== null && params.eventTypeId !== undefined) {
      body.append('event_type', String(params.eventTypeId));
    }

    if (params.selectedFile) {
      const fileData: any = {
        uri: params.selectedFile.uri,
        name: params.selectedFile.name,
        type: params.selectedFile.mimeType || 'application/gpx+xml',
      };
      body.append('gpx_file', fileData);
      if (API_CONFIG.DEBUG) {
        console.log('📎 Uploading new GPX file:', {
          name: params.selectedFile.name,
          size: formatFileSize(params.selectedFile.size),
        });
      }
    } else if (params.removeGpx) {
      body.append('remove_gpx', '1');
      if (API_CONFIG.DEBUG) console.log('🗑️ Removing existing GPX file');
    }

    if (API_CONFIG.DEBUG) {
      console.log('📡 UPDATE Personal Event Request:', {
        eventId: params.eventId,
        name: params.name,
        eventTypeId: params.eventTypeId,
        date: params.date,
        startTime: params.startTime || '(not set)',
        hasFile: !!params.selectedFile,
        removeGpx: params.removeGpx,
      });
    }

    // ✅ Use postRaw so 4xx responses are returned (not swallowed by handleError)
    const response = await apiClient.postRaw<UpdateEventResponse>(
      getApiEndpoint(API_CONFIG.ENDPOINTS.UPDATE_CUSTOM_EVENT),
      body,
      { headers, timeout: API_CONFIG.TIMEOUT }
    );

    if (API_CONFIG.DEBUG) console.log('✅ UPDATE Personal Event Response:', response.data);

    const responseData = response.data as any;

    // ✅ Handle non-2xx — PHP returns { success: false, error: "...", fields: [...] }
    if (response.status !== 200 && response.status !== 201) {
      if (API_CONFIG.DEBUG) console.log('❌ API Error Response:', responseData);

      // Field-level validation errors
      if (Array.isArray(responseData.fields) && responseData.fields.length > 0) {
        return {
          success: false,
          message: responseData.error ?? 'validation_failed',
          fields: responseData.fields,
        };
      }

      // Top-level error code
      return {
        success: false,
        message: responseData.error ?? 'API_ERROR',
        fields: [],
      };
    }

    // ✅ API wraps payload in a 'data' key: { success: true, data: { message, event, ... } }
    const data = responseData.data ?? responseData;

    return {
      success: data.success ?? responseData.success ?? true,
      message: data.message ?? responseData.message ?? '',
    };
  } catch (error: any) {
    if (API_CONFIG.DEBUG) console.error('❌ Update Personal Event Error:', error);
    throw new Error('API_ERROR');
  }
};

// ✅ UTILITIES
export const formatFileSize = (bytes: number | undefined): string => {
  if (bytes === undefined) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
};

export const getDeviceTimezone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
};