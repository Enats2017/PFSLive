import { useState, useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import { tokenService } from '../services/tokenService';
import {
  eventDetailService,
  Distance,
  RaceResultData,
} from '../services/eventDetailService';
import { getCurrentLanguageId } from '../i18n';
import { API_CONFIG } from '../constants/config';
import {
  savePendingRegistration,
  clearPendingRegistration,
} from '../hooks/usePendingRegistration';
import { useAuth } from '../context/AuthContext'; // ✅ NEW

interface UseRegistrationHandlerReturn {
  modalVisible: boolean;
  selectedItem: Distance | null;
  handleModalClose: () => void;
  confirmModalVisible: boolean;
  confirmData: RaceResultData | null;
  confirmItem: Distance | null;
  isFirstTracking: number;
  handleConfirmModalClose: () => void;
  handleConfirmRegister: () => Promise<void>;
  registerLoading: boolean;
  registerError: string | null;
  errorModalVisible: boolean;
  errorTitleKey: string;
  errorMessageKey: string;
  handleErrorModalClose: () => void;
  handleErrorRetry: (() => void) | undefined;
  handleRegister: (item: Distance, showConfirmPopup?: boolean) => Promise<void>;
  handleDelete: (item: Distance) => Promise<void>;
}

const SUCCESS_ACTIONS = ['registered', 'confirm_race_result'];

const isSuccessAction = (action: string): boolean => {
  return SUCCESS_ACTIONS.includes(action);
};

const useRegistrationHandler = (
  product_app_id: string | number,
  event_name: string,
  onRefresh?: () => void,
  onSuccess?: (product_option_value_app_id: number, participant_app_id?: number) => void,
  onDeleteSuccess?: (product_option_value_app_id: number) => void
): UseRegistrationHandlerReturn => {
  const navigation = useNavigation<any>();
  const { logout } = useAuth(); // ✅ NEW

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Distance | null>(null);
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [confirmData, setConfirmData] = useState<RaceResultData | null>(null);
  const [confirmItem, setConfirmItem] = useState<Distance | null>(null);
  const [isFirstTracking, setIsFirstTracking] = useState<number>(0);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);

  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorTitleKey, setErrorTitleKey] = useState('');
  const [errorMessageKey, setErrorMessageKey] = useState('');
  const [errorRetryAction, setErrorRetryAction] = useState<(() => void) | undefined>(
    undefined
  );

  const isTokenValid = async (): Promise<boolean> => {
    try {
      const token = await tokenService.getToken();
      return token !== null && token !== '';
    } catch {
      return false;
    }
  };

  const showErrorModal = useCallback(
    (titleKey: string, messageKey: string, retryAction?: () => void) => {
      setErrorTitleKey(titleKey);
      setErrorMessageKey(messageKey);
      setErrorRetryAction(() => retryAction);
      setErrorModalVisible(true);
    },
    []
  );

  const handleErrorModalClose = useCallback(() => {
    setErrorModalVisible(false);
    setErrorRetryAction(undefined);
  }, []);

  // ✅ INVALIDATE CACHE HELPER
  const invalidateEventCache = useCallback(async () => {
    try {
      if (API_CONFIG.DEBUG) {
        console.log('🗑️ Invalidating event detail cache for:', product_app_id);
      }

      await eventDetailService.getEventDetails(product_app_id, true);

      if (API_CONFIG.DEBUG) {
        console.log('✅ Event detail cache invalidated and refreshed');
      }

      onRefresh?.();
    } catch (error) {
      if (API_CONFIG.DEBUG) {
        console.error('⚠️ Failed to invalidate cache (non-critical):', error);
      }
      onRefresh?.();
    }
  }, [product_app_id, onRefresh]);

  // ✅ NEW: HANDLE UNAUTHORIZED — clears token and swaps navigator cleanly
  // Replaces all navigation.navigate('LoginScreen') calls.
  // logout() unmounts auth-required screens and mounts auth screens — no history.
  const handleUnauthorized = useCallback(async () => {
    await tokenService.removeToken();
    logout();
  }, [logout]);

  const callRegisterAPI = useCallback(
    async (item: Distance, showConfirmPopup?: boolean) => {
      if (registerLoading) return;

      try {
        setRegisterLoading(true);
        setRegisterError(null);

        if (API_CONFIG.DEBUG) {
          console.log('📝 Calling registerParticipant API for:', {
            product_option_value_app_id: item.product_option_value_app_id,
            distance_name: item.distance_name,
            show_confirm_popup: showConfirmPopup,
          });
        }

        const result = await eventDetailService.registerParticipant(
          item.product_option_value_app_id,
          undefined,
          undefined,
          showConfirmPopup
        );

        if (API_CONFIG.DEBUG) {
          console.log('✅ API Response:', {
            success: result.success,
            action: result.action,
          });
        }

        const action = result.action || 'unknown_error';

        if (!isSuccessAction(action)) {
          if (API_CONFIG.DEBUG) {
            console.log('⚠️ Non-success action received:', action);
          }

          switch (action) {
            case 'already_registered':
              setSelectedItem({ ...item, registration_status: 'registered' });
              setModalVisible(true);
              break;

            case 'membership_required':
              setSelectedItem({
                ...item,
                registration_status: 'membership_required',
              });
              setModalVisible(true);
              break;

            case 'limit_reached':
              setSelectedItem({
                ...item,
                registration_status: 'limit_reached',
                membership_limit: result.membership_limit,
              });
              setModalVisible(true);
              break;

            case 'membership_upcoming':
              setSelectedItem({
                ...item,
                registration_status: 'membership_upcoming',
                membership_start_date: result.membership_start_date,
              });
              setModalVisible(true);
              break;

            case 'not_found_in_race_result':
              await clearPendingRegistration();
              navigation.navigate('ParticipantResult', {
                product_app_id: product_app_id,
                product_option_value_app_id: item.product_option_value_app_id,
                event_name: event_name,
              });
              break;

            case 'bib_number_invalid':
              showErrorModal(
                'details:error.invalidBibTitle',
                'details:error.invalidBibMessage',
                () => callRegisterAPI(item, showConfirmPopup)
              );
              break;

            case 'distance_not_found':
              setSelectedItem({ ...item, registration_status: 'unavailable' });
              setModalVisible(true);
              break;

            case 'event_finished':
              showErrorModal(
                'details:error.eventFinishedTitle',
                'details:error.eventFinishedMessage'
              );
              break;

            case 'validation_error':
            case 'product_app_id_invalid':
            case 'language_id_invalid':
            case 'missing_parameters':
              showErrorModal(
                'details:error.validationErrorTitle',
                'details:error.validationErrorMessage',
                () => callRegisterAPI(item, showConfirmPopup)
              );
              break;

            case 'unauthorized':
            case 'token_invalid':
            case 'token_expired':
              await clearPendingRegistration();
              await savePendingRegistration(
                product_app_id,
                item.product_option_value_app_id,
                event_name
              );
              await handleUnauthorized(); // ✅ replaces navigation.navigate('LoginScreen')
              break;

            default:
              showErrorModal(
                'details:error.registrationFailedTitle',
                'details:error.registrationFailedMessage',
                () => callRegisterAPI(item, showConfirmPopup)
              );
              break;
          }
          return;
        }

        switch (action) {
          case 'confirm_race_result':
            if (API_CONFIG.DEBUG) {
              console.log('📋 Confirmation required');
            }
            setConfirmData(result.race_result_data ?? null);
            setConfirmItem(item);
            setIsFirstTracking(result.is_first_tracking || 0);
            setConfirmModalVisible(true);
            await clearPendingRegistration();
            break;

          case 'registered':
            if (API_CONFIG.DEBUG) {
              console.log('✅ Registration successful');
            }
            setSelectedItem({ ...item, registration_status: 'registered' });
            setModalVisible(true);
            await clearPendingRegistration();
            await invalidateEventCache();
            onSuccess?.(
              item.product_option_value_app_id,
              result.participant?.participant_app_id
            );
            break;

          default:
            if (API_CONFIG.DEBUG) {
              console.warn('⚠️ Unexpected success action:', action);
            }
            showErrorModal(
              'details:error.unexpectedTitle',
              'details:error.unexpectedMessage',
              () => callRegisterAPI(item, showConfirmPopup)
            );
            break;
        }
      } catch (error: any) {
        if (API_CONFIG.DEBUG) {
          console.error('❌ Network/Critical error:', error);
        }
        showErrorModal(
          'details:error.networkErrorTitle',
          'details:error.networkErrorMessage',
          () => callRegisterAPI(item, showConfirmPopup)
        );
      } finally {
        setRegisterLoading(false);
      }
    },
    [
      registerLoading,
      navigation,
      product_app_id,
      event_name,
      onSuccess,
      showErrorModal,
      invalidateEventCache,
      handleUnauthorized, // ✅ NEW
    ]
  );

  const callDeleteAPI = useCallback(
    async (item: Distance) => {
      if (registerLoading) return;

      if (!item.participant_app_id) {
        if (API_CONFIG.DEBUG) {
          console.error('❌ Cannot delete: missing participant_app_id');
        }
        showErrorModal(
          'details:error.cannotUnregisterTitle',
          'details:error.cannotUnregisterMessage',
          () => invalidateEventCache()
        );
        return;
      }

      try {
        setRegisterLoading(true);
        setRegisterError(null);

        if (API_CONFIG.DEBUG) {
          console.log('🗑️ Deleting participant:', {
            participant_app_id: item.participant_app_id,
            distance_name: item.distance_name,
          });
        }

        const result = await eventDetailService.deleteParticipant(item.participant_app_id);

        if (API_CONFIG.DEBUG) {
          console.log('📡 Delete result:', result);
        }

        const action = result.action || 'unknown_error';

        if (action !== 'deleted' && action !== 'success' && action !== 'participant_deleted') {
          if (API_CONFIG.DEBUG) {
            console.error('❌ Delete failed with action:', action);
          }

          switch (action) {
            case 'tracking_already_started':
              showErrorModal(
                'details:error.trackingAlreadyStartedTitle',
                'details:error.trackingAlreadyStartedMessage'
              );
              break;

            case 'event_in_progress':
              showErrorModal(
                'details:error.eventInProgressTitle',
                'details:error.eventInProgressMessage'
              );
              break;

            case 'unauthorized':
            case 'token_invalid':
            case 'token_expired':
              await handleUnauthorized(); // ✅ replaces navigation.navigate('LoginScreen')
              break;

            case 'participant_not_found':
            case 'already_deleted':
              await invalidateEventCache();
              onDeleteSuccess?.(item.product_option_value_app_id);
              break;

            default:
              showErrorModal(
                'details:error.unregisterFailedTitle',
                'details:error.unregisterFailedMessage',
                () => callDeleteAPI(item)
              );
              break;
          }
          return;
        }

        if (API_CONFIG.DEBUG) {
          console.log('✅ Delete successful');
        }

        await invalidateEventCache();
        onDeleteSuccess?.(item.product_option_value_app_id);
      } catch (error: any) {
        if (API_CONFIG.DEBUG) {
          console.error('❌ Network error:', error);
        }
        showErrorModal(
          'details:error.networkErrorTitle',
          'details:error.networkErrorMessage',
          () => callDeleteAPI(item)
        );
      } finally {
        setRegisterLoading(false);
      }
    },
    [
      registerLoading,
      onDeleteSuccess,
      showErrorModal,
      invalidateEventCache,
      handleUnauthorized, // ✅ NEW
    ]
  );

  const handleConfirmRegister = useCallback(async () => {
    if (!confirmItem || !confirmData?.bib_number) {
      if (API_CONFIG.DEBUG) {
        console.error('❌ Missing confirmation data');
      }
      showErrorModal(
        'confirmModal:error.invalidDataTitle',
        'confirmModal:error.invalidDataMessage'
      );
      return;
    }

    try {
      setRegisterLoading(true);
      setRegisterError(null);

      if (API_CONFIG.DEBUG) {
        console.log('✅ Confirming with bib:', confirmData.bib_number);
      }

      const result = await eventDetailService.registerParticipant(
        confirmItem.product_option_value_app_id,
        confirmData.bib_number,
        getCurrentLanguageId()
      );

      const action = result.action || 'unknown_error';

      if (!isSuccessAction(action)) {
        if (API_CONFIG.DEBUG) {
          console.error('❌ Confirmation failed with action:', action);
        }

        switch (action) {
          case 'bib_number_invalid':
            showErrorModal(
              'confirmModal:error.invalidBibTitle',
              'confirmModal:error.invalidBibMessage',
              handleConfirmRegister
            );
            break;

          case 'unauthorized':
          case 'token_invalid':
          case 'token_expired':
            await handleUnauthorized(); // ✅ replaces navigation.navigate('LoginScreen')
            break;

          default:
            showErrorModal(
              'confirmModal:error.confirmationFailedTitle',
              'confirmModal:error.confirmationFailedMessage',
              handleConfirmRegister
            );
            break;
        }
        return;
      }

      if (action === 'registered') {
        if (API_CONFIG.DEBUG) {
          console.log('✅ Confirmation successful');
        }

        setConfirmModalVisible(false);
        setConfirmData(null);
        setConfirmItem(null);
        setIsFirstTracking(0);
        await clearPendingRegistration();
        await invalidateEventCache();
        onSuccess?.(
          confirmItem.product_option_value_app_id,
          result.participant?.participant_app_id
        );
      } else {
        showErrorModal(
          'confirmModal:error.registrationFailedTitle',
          'confirmModal:error.registrationFailedMessage',
          handleConfirmRegister
        );
      }
    } catch (error: any) {
      if (API_CONFIG.DEBUG) {
        console.error('❌ Network error:', error);
      }
      showErrorModal(
        'confirmModal:error.networkErrorTitle',
        'confirmModal:error.networkErrorMessage',
        handleConfirmRegister
      );
    } finally {
      setRegisterLoading(false);
    }
  }, [
    confirmItem,
    confirmData,
    onSuccess,
    showErrorModal,
    invalidateEventCache,
    handleUnauthorized, // ✅ NEW
  ]);

  const handleRegister = useCallback(
    async (item: Distance, showConfirmPopup?: boolean) => {
      const hasToken = await isTokenValid();

      if (!hasToken) {
        if (API_CONFIG.DEBUG) {
          console.log('🔐 No token, redirecting to login');
        }

        await savePendingRegistration(
          product_app_id,
          item.product_option_value_app_id,
          event_name
        );

        await handleUnauthorized(); // ✅ replaces navigation.navigate('LoginScreen')
        return;
      }

      if (API_CONFIG.DEBUG) {
        console.log('📋 Registration status:', item.registration_status);
      }

      switch (item.registration_status) {
        case 'available':
          await callRegisterAPI(item, showConfirmPopup);
          return;
        case 'registered':
          return;
        case 'membership_required':
        case 'limit_reached':
        case 'membership_upcoming':
        case 'unavailable':
          setSelectedItem(item);
          setModalVisible(true);
          return;
        default:
          return;
      }
    },
    [callRegisterAPI, product_app_id, event_name, handleUnauthorized] // ✅ removed navigation
  );

  const handleModalClose = useCallback(() => {
    setModalVisible(false);
    setSelectedItem(null);
  }, []);

  const handleConfirmModalClose = useCallback(() => {
    setConfirmModalVisible(false);
    setConfirmData(null);
    setConfirmItem(null);
    setIsFirstTracking(0);
  }, []);

  return {
    modalVisible,
    selectedItem,
    handleModalClose,
    confirmModalVisible,
    confirmData,
    confirmItem,
    isFirstTracking,
    handleConfirmModalClose,
    handleConfirmRegister,
    registerLoading,
    registerError,
    errorModalVisible,
    errorTitleKey,
    errorMessageKey,
    handleErrorModalClose,
    handleErrorRetry: errorRetryAction,
    handleRegister,
    handleDelete: callDeleteAPI,
  };
};

export default useRegistrationHandler;