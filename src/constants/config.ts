// API Configuration
export const API_CONFIG = {
  BASE_URL: process.env.EXPO_PUBLIC_API_URL || 'https://api.yourbackend.com/v1',
  
  ENDPOINTS: {
    // Auth
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    
    // Events
    EVENTS_LIST: '/events',
    EVENT_DETAIL: '/events/:eventId',
    EVENT_GPX: '/events/:eventId/gpx',
    
    // Participants
    PARTICIPANT_LOCATION: '/participants/:participantId/location',
    PARTICIPANT_STATS: '/participants/:participantId/stats',
  },
  
  TIMEOUT: 15000,
  LOCATION_UPDATE_INTERVAL: 5000,
  FOLLOWER_POLL_INTERVAL: 3000,
  
  USE_MOCK_DATA: true,
};

// App Configuration
export const APP_CONFIG = {
  APP_NAME: 'PFSLive',
  VERSION: '1.0.0',
};

// Map Configuration
export const MAP_CONFIG = {
  DEFAULT_ZOOM: 12,
  FOLLOW_MODE_ZOOM: 14,
  ANIMATION_DURATION: 800,
};