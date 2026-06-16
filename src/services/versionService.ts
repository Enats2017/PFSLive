import { apiClient } from './api';
import { API_CONFIG, getApiEndpoint } from '../constants/config';
import { Platform, Linking } from 'react-native';
import Constants from 'expo-constants';
import { getCurrentLanguageId } from '../i18n';
import * as Application from 'expo-application';

/**
 * Version data returned from API
 */
interface VersionData {
  latest_version: string;
  minimum_required_version: string;
  force_update: boolean;
  update_available: boolean;
  update_url: string;
  title: string;
  message: string;
}

/**
 * Standard API response wrapper
 */
interface VersionApiResponse {
  success: boolean;
  data: VersionData;
  error: string | null;
}

/**
 * Result returned by checkVersion function
 */
export interface VersionCheckResult {
  needsUpdate: boolean;
  isForced: boolean;
  currentVersion: string;
  latestVersion: string;
  updateUrl: string;
  title: string;
  message: string;
}

// ✅ OPTIMIZATION: Cache version to avoid repeated reads
let cachedVersion: string | null = null;

export const versionService = {
  /**
   * Get current app version from expo config (cached)
   */
  getCurrentVersion(): string {
    if (cachedVersion) return cachedVersion;
    cachedVersion =
    // Native app version: CFBundleShortVersionString on iOS, versionName on Android
    Application.nativeApplicationVersion ??
    // JS fallback (Expo Go / unlinked native module) — both platforms
    Constants.expoConfig?.version ??
    '1.0.0';
    return cachedVersion;
  },

  /**
   * Compare two semantic versions (e.g., "1.2.3")
   * Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if equal
   */
  compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    const maxLength = Math.max(parts1.length, parts2.length);

    for (let i = 0; i < maxLength; i++) {
      const num1 = parts1[i] || 0;
      const num2 = parts2[i] || 0;

      if (num1 !== num2) {
        return num1 > num2 ? 1 : -1;
      }
    }

    return 0;
  },

  /**
   * Check if app needs update
   */
  async checkVersion(): Promise<VersionCheckResult> {
    const currentVersion = this.getCurrentVersion();

    try {
      const platform = Platform.OS;
      const language_id = getCurrentLanguageId();

      if (API_CONFIG.DEBUG) {
        console.log('📱 Checking version:', {
          current: currentVersion,
          platform,
          language_id,
        });
      }

      const url = getApiEndpoint(API_CONFIG.ENDPOINTS.VERSION_CHECK);
      const headers = await API_CONFIG.getHeaders();

      const requestBody = {
        language_id,
        current_version: currentVersion,
        platform,
      };

      // ✅ IMPROVED: Better type handling
      const apiResponse = await apiClient.post<VersionData>(
        url,
        requestBody,
        { headers }
      );

      // ✅ Type assertion with validation
      const response = apiResponse as unknown as VersionApiResponse;

      // ✅ IMPROVED: Explicit validation
      if (!response || typeof response !== 'object') {
        throw new Error('Invalid response format');
      }

      if (response.success && response.data) {
        const versionData = response.data;

        // ✅ IMPROVED: Validate required fields
        if (!versionData.latest_version || !versionData.update_url) {
          if (API_CONFIG.DEBUG) {
            console.warn('⚠️ Missing required version data');
          }
          return this.getNoUpdateResult(currentVersion);
        }

        const needsUpdate = Boolean(versionData.update_available);
        const isForced = Boolean(versionData.force_update);

        if (API_CONFIG.DEBUG) {
          console.log('✅ Version check result:', {
            currentVersion,
            latestVersion: versionData.latest_version,
            minimumVersion: versionData.minimum_required_version,
            needsUpdate,
            isForced,
            title: versionData.title,
          });
        }

        return {
          needsUpdate,
          isForced,
          currentVersion,
          latestVersion: versionData.latest_version,
          updateUrl: versionData.update_url,
          title: versionData.title || '',
          message: versionData.message || '',
        };
      }

      if (API_CONFIG.DEBUG) {
        console.log('⚠️ Version check: No update needed');
      }

      return this.getNoUpdateResult(currentVersion);
    } catch (error: any) {
      if (API_CONFIG.DEBUG) {
        console.error('❌ Version check error:', error?.message || error);
      }

      // ✅ Don't block app on version check failure
      return this.getNoUpdateResult(currentVersion);
    }
  },

  /**
   * Helper: Return "no update needed" result
   */
  getNoUpdateResult(currentVersion: string): VersionCheckResult {
    return {
      needsUpdate: false,
      isForced: false,
      currentVersion,
      latestVersion: currentVersion,
      updateUrl: '',
      title: '',
      message: '',
    };
  },

  /**
   * Open app store for update
   */
  async openStore(updateUrl: string): Promise<boolean> {
    try {
      // ✅ IMPROVED: Better validation
      if (!updateUrl?.trim()) {
        if (API_CONFIG.DEBUG) {
          console.error('❌ No update URL provided');
        }
        return false;
      }

      const canOpen = await Linking.canOpenURL(updateUrl);

      if (canOpen) {
        await Linking.openURL(updateUrl);

        if (API_CONFIG.DEBUG) {
          console.log('✅ Opened store:', updateUrl);
        }
        return true;
      } else {
        if (API_CONFIG.DEBUG) {
          console.error('❌ Cannot open URL:', updateUrl);
        }
        return false;
      }
    } catch (error: any) {
      if (API_CONFIG.DEBUG) {
        console.error('❌ Error opening store:', error?.message || error);
      }
      return false;
    }
  },

  /**
   * Clear cached version (useful for testing)
   */
  clearVersionCache(): void {
    cachedVersion = null;
  },
};