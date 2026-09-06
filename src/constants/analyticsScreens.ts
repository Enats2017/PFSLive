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
  // Added so follow_toggle can report a real screen. Previously the follow
  // type ('customer'/'bib') was written into ui_screen instead, and these
  // screens had no value at all.
  ATHLETE_SEARCH: 'athlete_search',
  USER_FAVOURITES: 'user_favourites',
  FAVOURITE_LIST: 'favourite_list',
  ALL_PARTICIPANTS: 'all_participants',
  PROFILE: 'profile',
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
  LANGUAGE_SELECT: 'language_select',
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
  // Renamed from PARTICIPANT_ID / 'customer_id' to match web exactly. Both
  // platforms carry the same customer_app_id here, and one shared GA4 property
  // cannot report on it while the two send different key names.
  //
  // 'athlete_id' rather than 'customer_id' because web already sets GA4's
  // reserved user_id from this same value — a param called customer_id would be
  // a second name for something GA4 already tracks, which is exactly the kind of
  // ambiguity that makes a dimension unusable.
  ATHLETE_ID: 'athlete_id',
  BIB_NUMBER: 'bib_number',

  // Intent of a follow-button press, kept OFF ui_action so that stays a pure
  // gesture ('tap' / 'swipe' / 'select'). Same registered dimension
  // follow_toggle uses — and needed separately because follow_toggle only fires
  // AFTER the API call succeeds, so a failed follow would lose its direction.
  // Mirrors the web constant of the same name.
  FOLLOW_ACTION: 'follow_action',

  // Which language was chosen. Web has sent this since changeover 1; mobile
  // tracked language changes not at all, so the breakdown was web-only.
  LANGUAGE: 'language',

  // Registered event-scope dimension. Was sent as a raw key at the one call
  // site, so it bypassed ANALYTICS_PARAMS like product_app_id used to.
  DISTANCE_NAME: 'distance_name',
  // What the event actually IS, as opposed to which tab it was tapped from.
  // The Live tab is a MIXED list — the API returns event_status 'live' or
  // 'finished' for its rows — so tab_name alone reported a finished event as
  // live. tab_name now means "where the user was", event_status means "what the
  // thing is". Web has sent this since changeover 1; mobile never did, so every
  // event-status breakdown was web-only.
  EVENT_STATUS: 'event_status',

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
//                  role_at_time, follow_scope  (all Event scope)
//   follow_scope is shared with the web app — same dimension, one property.
//   Registration is NOT retroactive: register before shipping, never after.
//                  has_followed, user_role  (User scope)
//   Do NOT register: bib_number, customer_id
//     Both are unbounded. GA4 collapses anything past roughly 500 unique
//     values per day into an "(other)" bucket, which degrades reports built on
//     the same table. Keep sending them (useful in BigQuery), just leave them
//     unregistered.
/**
 * The API says 'finished'; web has always sent 'past' for the same thing, and
 * both platforms report into one GA4 property on one registered dimension. Map
 * here rather than at the call sites, or the dimension splits in two.
 *
 * Returns undefined when the API sends null — the Past and Upcoming tabs are
 * homogeneous so the API leaves event_status empty there, and those call sites
 * pass their own literal instead. Undefined is dropped by omitEmptyParams.
 */
export function normaliseEventStatus(
  raw?: string | null,
): 'live' | 'upcoming' | 'past' | undefined {
  if (!raw) return undefined;
  if (raw === 'finished') return 'past';
  if (raw === 'live' || raw === 'upcoming' || raw === 'past') return raw;
  return undefined;
}

/**
 * Button name derived from the true status, mirroring web's EVENT_STATUS_ELEMENT.
 * Without this a finished event tapped in the Live tab reports ui_button
 * 'live_event', which is what made the two platforms disagree.
 */
export const EVENT_STATUS_BUTTON: Record<string, string> = {
  live: ANALYTICS_BUTTONS.LIVE_EVENT,
  upcoming: ANALYTICS_BUTTONS.UPCOMING_EVENT,
  past: ANALYTICS_BUTTONS.PAST_EVENT,
};
