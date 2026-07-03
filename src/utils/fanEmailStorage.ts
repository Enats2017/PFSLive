import AsyncStorage from '@react-native-async-storage/async-storage';

const FAN_EMAIL_PROMPTED_KEY = '@Livio:fanEmailPrompted';

export const fanEmailStorage = {
  async hasBeenPrompted(): Promise<boolean> {
    try {
      const value = await AsyncStorage.getItem(FAN_EMAIL_PROMPTED_KEY);
      return value === '1';
    } catch {
      // fail-safe: if read fails, treat as "not prompted" so modal can show
      return false;
    }
  },

  async markPrompted(): Promise<void> {
    try {
      await AsyncStorage.setItem(FAN_EMAIL_PROMPTED_KEY, '1');
    } catch {
      /* silent */
    }
  },
};

export default fanEmailStorage;