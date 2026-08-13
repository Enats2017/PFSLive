export const ANALYTICS_SCREENS = {
  HOME: 'home',
  EVENT_LIST: 'event_list',
  EVENT_DETAILS: 'event_details',
  // Follower-side event details. Without this, a live-map view from the
  // follower section and one from the participant section both report as
  // `event_details` and can't be told apart — same reason RESULT_LIST and
  // FOLLOWER_RESULT_LIST are separate.
  FOLLOWER_EVENT_DETAILS: 'follower_event_details',
  FOLLOWER_EVENT_LIST: 'follower_event_list',
  RESULT_LIST: 'result_list',
  FOLLOWER_RESULT_LIST: 'follower_result_list',
  PARTICIPANT_LIST: 'participant_list',
  TRACKING_SETTINGS: 'tracking_settings',
  // Live map, split the same way as RESULT_LIST / FOLLOWER_RESULT_LIST —
  // both sections reach this screen and drive it for different reasons.
  LIVE_TRACKING: 'live_tracking',
  RESULT_DETAILS: 'result_details',
  // Shared bottom bars. Given their own screen values rather than the host
  // route's name: they appear on many screens, and route names are PascalCase
  // ('ResultList') which would mix two naming vocabularies in ui_screen.
  BOTTOM_NAV: 'bottom_nav',
  BOTTOM_NAV_FOLLOWER: 'bottom_nav_follower',
  FOLLOWER_DETAILS: 'follower_details',
  FOLLOWER_LIVE_TRACKING: 'follower_live_tracking',
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

  // Live map screen
  DISTANCE_SELECT: 'distance_select',
  MAP_PARTICIPANT: 'map_participant',
  MAP_AID_STATION: 'map_aid_station',
  ELEVATION_TOGGLE: 'elevation_toggle',

  // Tabbed detail screens
  TAB: 'tab',

  // Bottom-bar destinations
  NAV_HOME: 'nav_home',
  NAV_FAVORITES: 'nav_favorites',
  NAV_RESULTS: 'nav_results',
  NAV_MAP: 'nav_map',
} as const;

export const ANALYTICS_PARAMS = {
  PARTICIPANT_ID: 'customer_id',
  BIB_NUMBER: 'bib_number',
  TAB_NAME: 'tab_name',

  // The KEY stays EVENT_NAME so no call site needs editing, but the VALUE
  // sent to GA4 is now `race_name`.
  //
  // Why: `event_name` is GA4's own built-in field for the name of the event
  // itself — it is the primary dimension in reports and a top-level column in
  // BigQuery export. A custom parameter of the same name either gets rejected
  // when you try to register it as a custom dimension, or produces reports
  // where "event_name" means two different things depending on where you look.
  EVENT_NAME: 'race_name',
} as const;

// NOTE ON REGISTERING CUSTOM DIMENSIONS IN GA4:
//   Register:      tab_name, race_name, ui_screen, ui_button, ui_action,
//                  role_at_time  (all Event scope)
//                  has_followed, user_role  (User scope)
//   Do NOT register: bib_number, customer_id
//     Both are unbounded. GA4 collapses anything past roughly 500 unique
//     values per day into an "(other)" bucket, which degrades reports built on
//     the same table. Keep sending them (useful in BigQuery), just leave them
//     unregistered.