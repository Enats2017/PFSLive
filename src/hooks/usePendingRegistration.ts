import { useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationProp } from '@react-navigation/native';
import { API_CONFIG } from '../constants/config';

const PENDING_PRODUCT_KEY = 'pending_product_app_id';
const PENDING_OPTION_KEY = 'pending_option_value_app_id';

export const usePendingRegistration = (navigation: NavigationProp<any>) => {
  const handleAfterAuth = useCallback(async () => {
    try {
      const [productId, optionId] = await Promise.all([
        AsyncStorage.getItem(PENDING_PRODUCT_KEY),
        AsyncStorage.getItem(PENDING_OPTION_KEY),
      ]);

      if (API_CONFIG.DEBUG) {
        console.log('📦 Pending registration:', {
          productId,
          optionId,
        });
      }

      if (productId && optionId) {
        // Clear pending data
        await Promise.all([
          AsyncStorage.removeItem(PENDING_PRODUCT_KEY),
          AsyncStorage.removeItem(PENDING_OPTION_KEY),
        ]);

        // Navigate to EventDetails with auto-register
        navigation.replace('EventDetails', {
          product_app_id: Number(productId),
          event_name: '',
          auto_register_id: Number(optionId),
        });
      } else {
        // No pending registration, go to Home
        navigation.reset({
          index: 0,
          routes: [{ name: 'Home' }],
        });
      }
    } catch (error) {
      if (API_CONFIG.DEBUG) {
        console.error('❌ Error checking pending registration:', error);
      }
      // Fallback to Home on error
      navigation.reset({
        index: 0,
        routes: [{ name: 'Home' }],
      });
    }
  }, [navigation]);

  return { handleAfterAuth };
};