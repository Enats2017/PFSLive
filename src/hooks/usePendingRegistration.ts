import { useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationProp } from '@react-navigation/native';
import { API_CONFIG } from '../constants/config';

const PENDING_PRODUCT_KEY = 'pending_product_app_id';
const PENDING_OPTION_KEY = 'pending_option_value_app_id';
const PENDING_EVENT_NAME_KEY = 'pending_event_name';

// ✅ SAFE GET - RETURNS NULL IF NOT EXISTS
const safeGetItem = async (key: string): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(key);
  } catch (error) {
    if (API_CONFIG.DEBUG) {
      console.error(`❌ Failed to get ${key}:`, error);
    }
    return null;
  }
};

// ✅ SAFE SET - HANDLES ERRORS GRACEFULLY
const safeSetItem = async (key: string, value: string): Promise<boolean> => {
  try {
    await AsyncStorage.setItem(key, value);
    return true;
  } catch (error) {
    if (API_CONFIG.DEBUG) {
      console.error(`❌ Failed to set ${key}:`, error);
    }
    return false;
  }
};

// ✅ SAFE REMOVE - HANDLES ERRORS GRACEFULLY
const safeRemoveItem = async (key: string): Promise<boolean> => {
  try {
    await AsyncStorage.removeItem(key);
    return true;
  } catch (error) {
    if (API_CONFIG.DEBUG) {
      console.error(`❌ Failed to remove ${key}:`, error);
    }
    return false;
  }
};

// ✅ SAVE PENDING REGISTRATION WITH EVENT NAME
export const savePendingRegistration = async (
  product_app_id: string | number,
  product_option_value_app_id: number,
  event_name: string
): Promise<boolean> => {
  try {
    const results = await Promise.all([
      safeSetItem(PENDING_PRODUCT_KEY, String(product_app_id)),
      safeSetItem(PENDING_OPTION_KEY, String(product_option_value_app_id)),
      safeSetItem(PENDING_EVENT_NAME_KEY, event_name),
    ]);

    const allSuccess = results.every((result) => result === true);

    if (allSuccess && API_CONFIG.DEBUG) {
      console.log('💾 Saved pending registration:', {
        product_app_id,
        product_option_value_app_id,
        event_name,
      });
    } else if (!allSuccess && API_CONFIG.DEBUG) {
      console.warn('⚠️ Some pending registration values failed to save');
    }

    return allSuccess;
  } catch (error) {
    if (API_CONFIG.DEBUG) {
      console.error('❌ Failed to save pending registration:', error);
    }
    return false;
  }
};

// ✅ CLEAR PENDING REGISTRATION (ALWAYS SUCCEEDS)
export const clearPendingRegistration = async (): Promise<void> => {
  try {
    // Try to remove all, but don't fail if some don't exist
    await Promise.allSettled([
      safeRemoveItem(PENDING_PRODUCT_KEY),
      safeRemoveItem(PENDING_OPTION_KEY),
      safeRemoveItem(PENDING_EVENT_NAME_KEY),
    ]);

    if (API_CONFIG.DEBUG) {
      console.log('🗑️ Cleared pending registration (if existed)');
    }
  } catch (error) {
    // Even if clearing fails, we continue
    if (API_CONFIG.DEBUG) {
      console.error('❌ Error clearing pending registration:', error);
    }
  }
};

// ✅ CHECK IF PENDING REGISTRATION EXISTS
export const hasPendingRegistration = async (): Promise<boolean> => {
  try {
    const [productId, optionId] = await Promise.all([
      safeGetItem(PENDING_PRODUCT_KEY),
      safeGetItem(PENDING_OPTION_KEY),
    ]);

    return !!(productId && optionId);
  } catch (error) {
    if (API_CONFIG.DEBUG) {
      console.error('❌ Error checking pending registration:', error);
    }
    return false;
  }
};

// ✅ HOOK FOR HANDLING AFTER AUTH
export const usePendingRegistration = (navigation: NavigationProp<any>) => {
  const handleAfterAuth = useCallback(async () => {
    try {
      const [productId, optionId, eventName] = await Promise.all([
        safeGetItem(PENDING_PRODUCT_KEY),
        safeGetItem(PENDING_OPTION_KEY),
        safeGetItem(PENDING_EVENT_NAME_KEY),
      ]);

      if (API_CONFIG.DEBUG) {
        console.log('📦 Checking pending registration:', {
          productId,
          optionId,
          eventName,
        });
      }

      if (productId && optionId) {
        // Clear pending data (always succeeds)
        await clearPendingRegistration();

        // Navigate to EventDetails with auto-register
        navigation.replace('EventDetails', {
          product_app_id: Number(productId),
          event_name: eventName || 'Event', // Fallback if event_name missing
          auto_register_id: Number(optionId),
        });
      } else {
        // No pending registration, go to Home
        if (API_CONFIG.DEBUG) {
          console.log('📍 No pending registration, going to Home');
        }
        navigation.reset({
          index: 0,
          routes: [{ name: 'Home' }],
        });
      }
    } catch (error) {
      if (API_CONFIG.DEBUG) {
        console.error('❌ Error handling pending registration:', error);
      }
      // Always fallback to Home on error
      navigation.reset({
        index: 0,
        routes: [{ name: 'Home' }],
      });
    }
  }, [navigation]);

  return { handleAfterAuth };
};