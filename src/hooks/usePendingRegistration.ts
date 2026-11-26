import { useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationProp } from '@react-navigation/native';
import { API_CONFIG } from '../constants/config';
import { isPendingRegistrationFresh } from '../screens/EventDetails/registrationFlow';
import { shouldNoticeExpiredConnect } from '../services/authFlowGuards';
import { toastInfo } from '../../utils/toast';
import i18n from '../i18n';
import { PERSONAL_EVENT_DRAFT_KEY, hasPendingDraft } from '../screens/PersonalEventScreen/personalEventGuards';

const PENDING_PRODUCT_KEY = 'pending_product_app_id';
const PENDING_OPTION_KEY = 'pending_option_value_app_id';
const PENDING_EVENT_NAME_KEY = 'pending_event_name';
// ✅ When it was saved (audit 2026-11-26, H2): replayed only while fresh, see
// isPendingRegistrationFresh. Without it a Connect abandoned at the login
// screen registered the runner on their next login, weeks later.
const PENDING_SAVED_AT_KEY = 'pending_saved_at';

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
      safeSetItem(PENDING_SAVED_AT_KEY, String(Date.now())),
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
      safeRemoveItem(PENDING_SAVED_AT_KEY),
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
      const [productId, optionId, eventName, savedAt] = await Promise.all([
        safeGetItem(PENDING_PRODUCT_KEY),
        safeGetItem(PENDING_OPTION_KEY),
        safeGetItem(PENDING_EVENT_NAME_KEY),
        safeGetItem(PENDING_SAVED_AT_KEY),
      ]);

      if (API_CONFIG.DEBUG) {
        console.log('📦 Checking pending registration:', {
          productId,
          optionId,
          eventName,
        });
      }

      // ✅ Stale (or saved by an app version without the time): dropped, never
      // replayed - replaying registers and can spend a session (audit H2).
      const fresh = isPendingRegistrationFresh(savedAt, Date.now());

      if (productId && optionId && fresh) {
        // ✅ NOT cleared here any more (audit L4): DistanceTab clears it when it
        // consumes auto_register_id. Cleared here, a failed event load or an
        // app kill before the list arrived lost the runner's Connect silently.
        // The TTL above and logout clearing it bound how long it can live.

        // Navigate to EventDetails with auto-register.
        // ✅ reset, not navigate (audit L3): the stack was [LoginScreen(, Register,
        // OTP)] here, so Back from the event showed the login (or the used OTP)
        // screen to a runner who is now logged in. Home underneath instead.
        navigation.reset({
          index: 1,
          routes: [
            { name: 'HomeScreen' },
            {
              name: 'EventDetails',
              params: {
                product_app_id: Number(productId),
                event_name: eventName || 'Event', // Fallback if event_name missing
                auto_register_id: Number(optionId),
              },
            },
          ],
        });
      } else {
        if (productId || optionId) {
          await clearPendingRegistration(); // stale - see above
        }
        // ✅ Say so (re-audit AN3): the runner tapped Connect, logged in, and
        // landed on Home with no word of it - they believed they were connected.
        if (shouldNoticeExpiredConnect(productId, optionId, fresh)) {
          toastInfo(
            i18n.t('login:pendingConnectExpiredTitle'),
            i18n.t('login:pendingConnectExpired'),
          );
        }
        // ✅ A personal event left at the login (second audit 2026-11-26):
        // the 401 on Save kept the form as a draft; go back to it (Home
        // underneath) instead of Home. CreatePersonalEvent restores it.
        if (hasPendingDraft(await safeGetItem(PERSONAL_EVENT_DRAFT_KEY), Date.now())) {
          navigation.reset({
            index: 1,
            routes: [{ name: 'HomeScreen' }, { name: 'PersonalEvent' }],
          });
          return;
        }
        // No pending registration, go to Home
        if (API_CONFIG.DEBUG) {
          console.log('📍 No pending registration, going to Home');
        }
        navigation.reset({
          index: 0,
          routes: [{ name: 'HomeScreen' }],
        });
      }
    } catch (error) {
      if (API_CONFIG.DEBUG) {
        console.error('❌ Error handling pending registration:', error);
      }
      // Always fallback to Home on error
      navigation.reset({
        index: 0,
        routes: [{ name: 'HomeScreen' }],
      });
    }
  }, [navigation]);

  return { handleAfterAuth };
};