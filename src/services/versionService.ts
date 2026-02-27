import { apiClient } from './api';
import { API_CONFIG, getApiEndpoint } from '../constants/config';
import { Platform, Linking } from 'react-native';
import Constants from 'expo-constants';
import { getCurrentLanguageId } from '../i18n';

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

export const versionService = {
  /**
   * Get current app version from expo config
   */
  getCurrentVersion(): string {
    return Constants.expoConfig?.version || '1.0.0';
  },

  /**
   * Compare two semantic versions (e.g., "1.2.3")
   * Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if equal
   */
  compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const num1 = parts1[i] || 0;
      const num2 = parts2[i] || 0;

      if (num1 > num2) return 1;
      if (num1 < num2) return -1;
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

      // ✅ FIX: Type the response correctly
      // apiClient.post returns the FULL response object
      const apiResponse = await apiClient.post<VersionData>(
        url,
        requestBody,
        { headers }
      );

      // ✅ The response IS the VersionApiResponse
      // Cast it properly
      const response = apiResponse as unknown as VersionApiResponse;

      // Check if response is successful and has data
      if (response.success && response.data) {
        const versionData = response.data;

        // Use API's flags directly
        const needsUpdate = versionData.update_available;
        const isForced = versionData.force_update;

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
          title: versionData.title,
          message: versionData.message,
        };
      }

      // No update needed if API doesn't return success
      if (API_CONFIG.DEBUG) {
        console.log('⚠️ Version check: No update needed');
      }

      return this.getNoUpdateResult(currentVersion);
    } catch (error: any) {
      if (API_CONFIG.DEBUG) {
        console.error('❌ Version check error:', error.message);
      }

      // Don't block app on version check failure
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
  async openStore(updateUrl: string): Promise<void> {
    try {
      if (!updateUrl || updateUrl.trim() === '') {
        if (API_CONFIG.DEBUG) {
          console.error('❌ No update URL provided');
        }
        return;
      }

      const canOpen = await Linking.canOpenURL(updateUrl);

      if (canOpen) {
        await Linking.openURL(updateUrl);

        if (API_CONFIG.DEBUG) {
          console.log('✅ Opened store:', updateUrl);
        }
      } else {
        if (API_CONFIG.DEBUG) {
          console.error('❌ Cannot open URL:', updateUrl);
        }
      }
    } catch (error: any) {
      if (API_CONFIG.DEBUG) {
        console.error('❌ Error opening store:', error.message);
      }
    }
  },
};