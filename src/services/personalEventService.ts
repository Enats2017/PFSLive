import { API_CONFIG, getApiEndpoint } from '../constants/config';
import axios, { AxiosError } from 'axios';

// ✅ TYPES
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
  startTime: string;
  timezone?: string;
  selectedFile?: PersonalEventFile;
}

export interface PersonalEventResponse {
  success: boolean;
  action?: string;
  message?: string;
  data?: any;
  error?: string;
  is_first_tracking?: number;
}

// ✅ API WRAPPER RESPONSE (NESTED STRUCTURE)
interface PersonalEventApiResponse {
  success: boolean;
  data: PersonalEventResponse; // ✅ NESTED DATA
  error: string | null;
}

// ✅ CONSTANTS
const TIME_REGEX = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_MIME_TYPE = 'application/gpx+xml';
const API_TIMEOUT = 60000;
const VALID_EVENT_TYPES = [1, 2, 3] as const;

// ✅ VALIDATION FUNCTIONS
export const isValidDate = (date: string): boolean => {
  if (!date || !DATE_REGEX.test(date)) return false;
  const parsedDate = new Date(date);
  return !isNaN(parsedDate.getTime());
};

export const isValidTime = (time: string): boolean => {
  if (!time) return false;
  return TIME_REGEX.test(time);
};

export const isValidEventType = (eventTypeId: number | null): boolean => {
  return eventTypeId !== null && VALID_EVENT_TYPES.includes(eventTypeId as any);
};

export const isValidGPXFile = (fileName: string): boolean => {
  const lowerName = fileName.toLowerCase();
  return lowerName.endsWith('.gpx') || lowerName.endsWith('.xml');
};

export const isValidFileSize = (size: number, maxSize: number): boolean => {
  return size > 0 && size <= maxSize;
};

// ✅ UTILITY FUNCTIONS
export const formatTimeHHMM = (time: string): string => {
  if (!time) return '';
  
  const parts = time.split(':');
  
  if (parts.length === 2 && time.length === 5) {
    return time;
  }
  
  if (parts.length === 3) {
    return `${parts[0]}:${parts[1]}`;
  }
  
  return time;
};

export const formatFileSize = (bytes: number): string => {
  return `${(bytes / 1024).toFixed(2)} KB`;
};

/**
 * Get device timezone
 * @returns Timezone string (e.g., "Asia/Kolkata", "America/New_York")
 */
export const getDeviceTimezone = (): string => {
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return timezone || 'UTC';
  } catch (error) {
    return 'UTC';
  }
};

/**
 * Get timezone offset in minutes
 * @returns Offset in minutes (e.g., -330 for IST, 330 for PST)
 */
export const getTimezoneOffset = (): number => {
  return new Date().getTimezoneOffset();
};

/**
 * Get timezone offset as string
 * @returns Offset string (e.g., "+05:30", "-08:00")
 */
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
    const formattedTime = formatTimeHHMM(startTime);
    formData.append('start_hour', formattedTime);
  }
  
  if (timezone) {
    formData.append('timezone', timezone);
    
    if (API_CONFIG.DEBUG) {
      console.log('🌍 Timezone:', timezone);
      console.log('🕐 Offset:', getTimezoneOffsetString());
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

const extractErrorMessage = (error: AxiosError): string => {
  if (error.response?.data) {
    const data = error.response.data as any;
    return data.message || data.error || error.message;
  }
  return error.message || 'API_ERROR';
};

const validatePayload = (payload: PersonalEventPayload): void => {
  const { name, eventTypeId, date, startTime } = payload;
  
  if (!name?.trim()) {
    throw new Error('VALIDATION_ERROR: Event name is required');
  }
  
  if (!isValidEventType(eventTypeId)) {
    throw new Error('VALIDATION_ERROR: Event type is required');
  }
  
  if (!date?.trim()) {
    throw new Error('VALIDATION_ERROR: Event date is required');
  }
  
  if (!isValidDate(date)) {
    throw new Error('VALIDATION_ERROR: Invalid date format');
  }
  
  if (!startTime?.trim()) {
    throw new Error('VALIDATION_ERROR: Start time is required');
  }
  
  if (!isValidTime(startTime)) {
    throw new Error('VALIDATION_ERROR: Invalid start time format');
  }
};

// ✅ MAIN API FUNCTION
export const createPersonalEvent = async (
  payload: PersonalEventPayload
): Promise<PersonalEventResponse> => {
  try {
    if (API_CONFIG.DEBUG) {
      console.log('📤 Creating personal event:', {
        name: payload.name,
        eventTypeId: payload.eventTypeId,
        date: payload.date,
        startTime: payload.startTime,
        timezone: payload.timezone,
        hasFile: !!payload.selectedFile,
      });
    }
    
    validatePayload(payload);
    
    const formData = buildFormData(payload);
    const headers = await API_CONFIG.getMutiForm();
    
    const response = await axios.post<PersonalEventApiResponse>(
      getApiEndpoint(API_CONFIG.ENDPOINTS.Personal_Event),
      formData,
      {
        headers,
        timeout: API_TIMEOUT,
      }
    );
    
    if (API_CONFIG.DEBUG) {
      console.log('📡 Full API Response:', response.data);
      console.log('📡 Response Structure:', {
        outerSuccess: response.data.success,
        outerError: response.data.error,
        innerData: response.data.data,
      });
    }
    
    // ✅ EXTRACT INNER DATA (ACTION IS NESTED)
    const innerData = response.data.data || {};
    
    if (API_CONFIG.DEBUG) {
      console.log('✅ Inner Data:', {
        action: innerData.action,
        success: innerData.success,
        message: innerData.message,
        is_first_tracking: innerData.is_first_tracking,
      });
    }
    
    // ✅ RETURN FLATTENED RESPONSE WITH ACTION AT TOP LEVEL
    return {
      success: response.data.success,
      action: innerData.action,
      message: innerData.message || response.data.error,
      data: innerData.data,
      is_first_tracking: innerData.is_first_tracking,
    };
  } catch (error) {
    if (API_CONFIG.DEBUG) {
      console.error('❌ Error creating personal event:', error);
    }
    
    if (error instanceof Error && error.message.startsWith('VALIDATION_ERROR:')) {
      throw error;
    }
    
    if (axios.isAxiosError(error)) {
      const errorMessage = extractErrorMessage(error);
      throw new Error(errorMessage);
    }
    
    throw error;
  }
};

// ✅ EXPORT ALL UTILITIES
export const personalEventUtils = {
  isValidDate,
  isValidTime,
  isValidEventType,
  isValidGPXFile,
  isValidFileSize,
  formatFileSize,
  formatTimeHHMM,
  getDeviceTimezone,
  getTimezoneOffset,
  getTimezoneOffsetString,
};