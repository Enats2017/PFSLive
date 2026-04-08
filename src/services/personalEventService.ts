import { API_CONFIG, getApiEndpoint } from '../constants/config';
import { apiClient } from './api';

export interface PersonalEventFile {
  uri: string;
  name: string;
  mimeType?: string;
  size: number;
}

export interface PersonalEventPayload {
  name: string;
  eventTypeId: number | null;
  date: string;
  startTime: string; // empty string = not set (optional)
  timezone?: string;
  selectedFile?: PersonalEventFile;
}

export interface PersonalEventResponse {
  success: boolean;
  action?: string;
  message?: string;
  data?: any;
  error?: string;
  fields?: string[]; // ✅ API validation field errors e.g. ['name_required', 'race_date_invalid']
  is_first_tracking?: number;
  membership_limit?: number;
  membership_start_date?: string;
  event?: any;
}

const TIME_REGEX = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_MIME_TYPE = 'application/gpx+xml';
const VALID_EVENT_TYPES = [1, 2, 3] as const;

export const isValidDate = (date: string): boolean => {
  if (!date || !DATE_REGEX.test(date)) return false;
  return !isNaN(new Date(date).getTime());
};

export const isValidTime = (time: string): boolean => {
  if (!time) return false;
  return TIME_REGEX.test(time);
};

export const isValidEventType = (eventTypeId: number | null): boolean =>
  eventTypeId !== null && VALID_EVENT_TYPES.includes(eventTypeId as any);

export const isValidGPXFile = (fileName: string): boolean => {
  const lower = fileName.toLowerCase();
  return lower.endsWith('.gpx') || lower.endsWith('.xml');
};

export const isValidFileSize = (size: number, maxSize: number): boolean =>
  size > 0 && size <= maxSize;

export const formatTimeHHMM = (time: string): string => {
  if (!time) return '';
  const parts = time.split(':');
  if (parts.length === 2 && time.length === 5) return time;
  if (parts.length === 3) return `${parts[0]}:${parts[1]}`;
  return time;
};

export const formatFileSize = (bytes: number): string => {
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

export const getTimezoneOffset = (): number => new Date().getTimezoneOffset();

export const getTimezoneOffsetString = (): string => {
  const offset = -getTimezoneOffset();
  const hours = Math.floor(Math.abs(offset) / 60);
  const minutes = Math.abs(offset) % 60;
  const sign = offset >= 0 ? '+' : '-';
  return `${sign}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const buildFormData = (payload: PersonalEventPayload): FormData => {
  const { name, eventTypeId, date, startTime, timezone, selectedFile } = payload;
  const formData = new FormData();

  formData.append('name', name.trim());
  formData.append('race_date', date);

  if (eventTypeId !== null && eventTypeId !== undefined) {
    formData.append('event_type', String(eventTypeId));
  }

  if (startTime?.trim()) {
    formData.append('start_hour', formatTimeHHMM(startTime));
  }

  if (timezone) {
    formData.append('timezone', timezone);
    if (API_CONFIG.DEBUG) {
      console.log('🌍 Timezone:', timezone, '| Offset:', getTimezoneOffsetString());
    }
  }

  if (selectedFile) {
    const fileData: any = {
      uri: selectedFile.uri,
      name: selectedFile.name,
      type: selectedFile.mimeType || DEFAULT_MIME_TYPE,
    };
    formData.append('gpx_file', fileData);
    if (API_CONFIG.DEBUG) {
      console.log('📎 GPX file:', {
        name: selectedFile.name,
        size: formatFileSize(selectedFile.size),
        type: fileData.type,
      });
    }
  }

  return formData;
};

export const createPersonalEvent = async (
  payload: PersonalEventPayload
): Promise<PersonalEventResponse> => {
  try {
    if (API_CONFIG.DEBUG) {
      console.log('📤 Creating personal event:', {
        name: payload.name,
        eventTypeId: payload.eventTypeId,
        date: payload.date,
        startTime: payload.startTime || '(not set)',
        timezone: payload.timezone,
        hasFile: !!payload.selectedFile,
      });
    }

    const formData = buildFormData(payload);
    const headers = await API_CONFIG.getMutiForm();

    // ✅ Use postRaw so 4xx responses are returned (not swallowed by handleError)
    // This lets us read response.data.fields for field-level validation errors
    const response = await apiClient.postRaw<PersonalEventResponse>(
      getApiEndpoint(API_CONFIG.ENDPOINTS.Personal_Event),
      formData,
      { headers, timeout: API_CONFIG.TIMEOUT }
    );

    if (API_CONFIG.DEBUG) console.log('📡 Full API Response:', response.data);

    const responseData = response.data as any;

    // ✅ Handle non-2xx — PHP returns { success: false, error: "...", fields: [...] }
    if (response.status !== 200 && response.status !== 201) {
      if (API_CONFIG.DEBUG) console.log('❌ API Error Response:', responseData);
      return {
        success: false,
        action: responseData.error || 'error',
        message: responseData.message || responseData.error,
        error: responseData.error,
        fields: Array.isArray(responseData.fields) ? responseData.fields : [],
      };
    }

    // ✅ API wraps payload in a 'data' key: { success: true, data: { action, event, ... } }
    const data = responseData.data ?? responseData;

    if (API_CONFIG.DEBUG) {
      console.log('✅ Response Data:', {
        action: data.action,
        is_first_tracking: data.is_first_tracking,
        event: data.event,
      });
    }

    return {
      success: true,
      action: data.action,
      event: data.event,
      is_first_tracking: data.is_first_tracking,
      membership_limit: data.membership_limit,
      membership_start_date: data.membership_start_date,
      data: data,
    };
  } catch (error: any) {
    if (API_CONFIG.DEBUG) console.error('❌ Error creating personal event:', error);
    throw new Error('API_ERROR');
  }
};

export const personalEventUtils = {
  isValidDate, isValidTime, isValidEventType,
  isValidGPXFile, isValidFileSize, formatFileSize,
  formatTimeHHMM, getDeviceTimezone, getTimezoneOffset, getTimezoneOffsetString,
};