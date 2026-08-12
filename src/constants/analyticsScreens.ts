

export const ANALYTICS_SCREENS = {
  HOME: 'home',
  EVENT_LIST: 'event_list',
  EVENT_DETAILS: 'event_details',
  FOLLOWER_EVENT_LIST: 'follower_event_list',
  RESULT_LIST: 'result_list',                     
  FOLLOWER_RESULT_LIST: 'follower_result_list',
  PARTICIPANT_LIST: 'participant_list', 
  TRACKING_SETTINGS: 'tracking_settings'
} as const;

export const ANALYTICS_BUTTONS = {
  PAST_EVENT: 'past_event',
  LIVE_EVENT: 'live_event',
  UPCOMING_EVENT: 'upcoming_event',

  // Event Details screen
  CONNECT: 'connect',
  DOWNLOAD_GPX: 'download_gpx',
  MAP: 'map',

  // Follower actions
  FOLLOW: 'follow',
  ROUTE: 'route',
  RESULT: 'result',
  PARTICIPANT_PROFILE: 'participant_profile', 
  VIEW_PROFILE: 'view_profile',
  PARTICIPANT_MODE: 'participant_mode',
  FAN_MODE: 'fan_mode',
  VISIBILITY_SAVE: 'visibility_save',
} as const;

export const ANALYTICS_PARAMS = {
  PARTICIPANT_ID: 'customer_id',
  BIB_NUMBER: 'bib_number',
  TAB_NAME: 'tab_name',
  EVENT_NAME: 'event_name', // ✅ added
} as const;