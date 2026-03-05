import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_STORAGE_KEY = '@PFSLive:authToken';
const CUSTOMER_KEY = '@PFSLive:customer_app_id';

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

  async getToken(): Promise<string | null> {
    try {
      const token = await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
      console.log('🔑 Token from storage:', token);
      return token;
    } catch (error) {
      console.error('❌ Error loading token:', error);
      return null;
    }
  },

  async saveCustomerId(id: number | string): Promise<void> {
        try {
            await AsyncStorage.setItem(CUSTOMER_KEY, String(id));
        } catch (error) {
            console.error('❌ Error saving customer id:', error);
        }
    },

    async getCustomerId(): Promise<number | null> {
        try {
            const id = await AsyncStorage.getItem(CUSTOMER_KEY);
              console.log('🔑 customer_app_id from storage:', id);
            return id ? Number(id) : null;            
        } catch (error) {
            console.error('❌ Error loading customer id:', error);
            return null;
        }
    },


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