import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_STORAGE_KEY = '@PFSLive:authToken';

export const tokenService = {
  /**
   * Save auth token to AsyncStorage
   */
  async saveToken(token: string): Promise<void> {
    try {
      await AsyncStorage.setItem(TOKEN_STORAGE_KEY, token);
      console.log('✅ Token saved to storage');
    } catch (error) {
      console.error('❌ Error saving token:', error);
    }
  },

  /**
   * Get auth token from AsyncStorage
   * Falls back to hardcoded token if not found
   */
  async getToken(): Promise<string> {
    try {
      const token = await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
      
      if (token) {
        return token;
      }

      // Fallback to hardcoded token (until login is integrated)
      const fallbackToken = process.env.EXPO_PUBLIC_API_TOKEN || 
        '6582fc2b8b28d077860ebbf00edadbbf99364e930d908e14ccc63e39e3bfb0d2';
      
      return fallbackToken;
    } catch (error) {
      console.error('❌ Error loading token:', error);
      
      // Return fallback token on error
      return process.env.EXPO_PUBLIC_API_TOKEN || 
        'e17b571d5e4859ec7584756e8d2d23a85c050b075bc798c73183b772833984ad';
    }
  },

  /**
   * Remove auth token from AsyncStorage (logout)
   */
  async removeToken(): Promise<void> {
    try {
      await AsyncStorage.removeItem(TOKEN_STORAGE_KEY);
      console.log('✅ Token removed from storage');
    } catch (error) {
      console.error('❌ Error removing token:', error);
    }
  },

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      const token = await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
      return token !== null;
    } catch (error) {
      console.error('❌ Error checking authentication:', error);
      return false;
    }
  },
};