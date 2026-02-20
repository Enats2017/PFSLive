/**
 * Standard API response format used across all endpoints
 */
export interface StandardApiResponse<T = any> {
  success: boolean;
  data: T;
  error: string | null;
}

/**
 * Home API response data
 */
export interface HomeApiData {
  show_start_track: number;
  next_race_id?: number;
  next_race_participant_app_id?: number;
  next_race_name?: string;
  next_race_date?: string;
  next_race_time?: string;
  next_race_interval_for_location?: number;
  manual_start?: number;
}

/**
 * Location API response data
 */
export interface LocationApiData {
  coordinate_id: number;
  recorded_at: string;
}