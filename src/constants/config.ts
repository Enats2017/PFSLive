/**
 * Application Configuration
 * Uses environment variables for flexibility across environments
 */

import { tokenService } from '../services/tokenService';

// Get API URL from environment or use fallback
const getApiUrl = (): string => {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  
  if (envUrl) {
    console.log('✅ Using API URL from .env:', envUrl);
    return envUrl;
  }

  // Fallback for development
  console.warn('⚠️ EXPO_PUBLIC_API_URL not found in .env, using fallback');
  return 'http://192.168.0.199/larssie/api';
};

// Hardcoded fallback token (used until login is integrated)
const FALLBACK_TOKEN = '658db6a46bfbfc0aaa97a5241a3ed78a84df8f49c44d1f5f90ed2d520f75402f';

// API Configuration
export const API_CONFIG = {
  BASE_URL: getApiUrl(),
  
  // Hardcoded token for now (will be replaced by AsyncStorage after login)
  get TOKEN() {
    return process.env.EXPO_PUBLIC_API_TOKEN || FALLBACK_TOKEN;
  },
  
  ENDPOINTS: {
    // Auth
    LOGIN: '/login_api.php',
    REGISTER: '/register_api.php',
    
    // Home
    HOME: '/home_api.php',
    
    // Events
    EVENTS_LIST: '/events/list.php',
    EVENT_DETAIL: '/events/:eventId/detail.php',
    EVENT_GPX: '/events/:eventId/gpx.php',
    
    // Participants
    PARTICIPANT_LOCATION: '/insert_participant_location_api',
    PARTICIPANT_STATS: '/participants/:participantId/stats.php',
  },
  
  TIMEOUT: 15000,
  LOCATION_UPDATE_INTERVAL: 5000, // milliseconds
  FOLLOWER_POLL_INTERVAL: 3000, // milliseconds
  
  USE_MOCK_DATA: true, // Set to false when backend is ready
  
  /**
   * Get request headers with current auth token
   * This is async because it may need to fetch from AsyncStorage
   */
  async getHeaders(): Promise<Record<string, string>> {
    const token = await tokenService.getToken();
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };
  },
  
  /**
   * Get request headers synchronously (uses hardcoded token)
   * Use this only when you can't use async (e.g., in Axios defaults)
   */
  getHeadersSync(): Record<string, string> {
    const token = process.env.EXPO_PUBLIC_API_TOKEN || FALLBACK_TOKEN;
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };
  },
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

/**
 * Helper to get full API endpoint URL
 */
export const getApiEndpoint = (endpoint: string): string => {
  return `${API_CONFIG.BASE_URL}${endpoint}`;
};

/**
 * Helper to replace URL parameters (e.g., :eventId, :participantId)
 */
export const buildApiUrl = (endpoint: string, params: Record<string, string>): string => {
  let url = endpoint;
  
  Object.keys(params).forEach(key => {
    url = url.replace(`:${key}`, params[key]);
  });
  
  return getApiEndpoint(url);
};

/**
 * Detect environment and provide appropriate localhost URL
 */
export const getLocalApiUrl = (): string => {
  const Platform = require('react-native').Platform;
  
  // Android Emulator uses 10.0.2.2 to access host machine's localhost
  if (Platform.OS === 'android' && __DEV__) {
    return 'http://10.0.2.2/larssie/api';
  }
  
  // iOS Simulator can use localhost directly
  if (Platform.OS === 'ios' && __DEV__) {
    return 'http://localhost/larssie/api';
  }
  
  // Physical devices need the actual IP address
  return getApiUrl();
};