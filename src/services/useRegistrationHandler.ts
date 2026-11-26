import { useState, useCallback, useRef } from 'react';
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
import { analyticsService } from './analyticsService';
import {
  classifyCallError,
  isRegisteredOutcome,
} from '../screens/EventDetails/registrationFlow';

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
  liveTrackingModalVisible: boolean;
  liveTrackingItem: Distance | null;
  handleConnectClick: (item: Distance) => void;
  handleLiveTrackingConfirm: () => void;
  handleLiveTrackingClose: () => void;
  registeringItemId: number | null; // NEW
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
  const [liveTrackingModalVisible, setLiveTrackingModalVisible] = useState(false);
  const [liveTrackingItem, setLiveTrackingItem] = useState<Distance | null>(null);
  const [registeringItemId, setRegisteringItemId] = useState<number | null>(null);

  // ✅ One register / confirm / unregister call at a time (audit 2026-11-26, L2).
  // The registerLoading checks read the value of the render the handler was
  // created in, and handleRegister awaits the token BEFORE callRegisterAPI sets
  // it - so two triggers in that window (a tap and the auto-register effect, a
  // double tap) both passed. A ref is set synchronously and seen by every
  // closure. The server now also refuses a second concurrent write
  // (RegistrationGuard), this keeps the app from sending one.
  const inFlightRef = useRef(false);

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
  //
  // ✅ `keepDistanceId`: the Connect to resume after the login, saved AFTER the
  // logout (audit 2026-11-26, H2) - logout clears any pending Connect, so a
  // runner who logs out cannot have it replayed on the next account's login;
  // saved before it, this one would be wiped too.
  const handleUnauthorized = useCallback(async (keepDistanceId?: number) => {
    await tokenService.removeToken();
    await logout();
    if (keepDistanceId !== undefined) {
      await savePendingRegistration(product_app_id, keepDistanceId, event_name);
    }
    setTimeout(() => {
      navigation.reset({ index: 0, routes: [{ name: 'LoginScreen' }] });
    }, 50);
  }, [logout, product_app_id, event_name]);

  const callRegisterAPI = useCallback(
    async (item: Distance, showConfirmPopup?: boolean) => {
      if (registerLoading) return;
      if (inFlightRef.current) return;
      inFlightRef.current = true;

      try {
        setRegisterLoading(true);
        setRegisteringItemId(item.product_option_value_app_id);
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
          // `action` is a server enum code, never a message and never user
          // input — safe to send as register_reason.
          void analyticsService.logRegisterStep('failed', action, event_name);

          switch (action) {
            case 'already_registered':
              setSelectedItem({ ...item, registration_status: 'registered' });
              setModalVisible(true);
              // ✅ The registration IS on the server (audit M2) - usually an
              // earlier request that timed out after the insert. The card kept
              // its Connect button (status 'available', no participant id, so
              // no Undo either) until the runner left and came back.
              await clearPendingRegistration();
              await invalidateEventCache();
              break;

            case 'registration_in_progress':
              // ✅ Server: another registration of this account is still
              // being written (RegistrationGuard). Retry then finds it.
              showErrorModal(
                'details:error.inProgressTitle',
                'details:error.inProgressMessage',
                () => callRegisterAPI(item, showConfirmPopup)
              );
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
              await handleUnauthorized(item.product_option_value_app_id); // ✅ replaces navigation.navigate('LoginScreen')
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
            void analyticsService.logRegisterStep('confirm_shown', undefined, event_name);
            setConfirmModalVisible(true);
            await clearPendingRegistration();
            break;

          case 'registered':
            if (API_CONFIG.DEBUG) {
              console.log('✅ Registration successful');
            }
            // ✅ No RegistrationModal here any more (audit L1): its 'registered'
            // status reads "You're already registered!", shown to a runner who
            // had just connected, on top of the success celebration below.
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
        // ✅ A 401 arrives HERE as a thrown session_expired, never as the
        // 'unauthorized' action above (audit H1). It read "Unable to connect"
        // with a Retry that could not work. Keep the Connect and log in again.
        const failure = classifyCallError(error);
        if (failure === 'session_expired') {
          await handleUnauthorized(item.product_option_value_app_id);
          return;
        }
        showErrorModal(
          failure === 'server' ? 'details:error.registrationFailedTitle' : 'details:error.networkErrorTitle',
          failure === 'server' ? 'details:error.registrationFailedMessage' : 'details:error.networkErrorMessage',
          () => callRegisterAPI(item, showConfirmPopup)
        );
      } finally {
        inFlightRef.current = false;
        setRegisterLoading(false);
        setRegisteringItemId(null); 
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

      if (inFlightRef.current) return;
      inFlightRef.current = true;

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
        // ✅ Session gone: log in again rather than a Retry that cannot work (audit H1).
        const failure = classifyCallError(error);
        if (failure === 'session_expired') {
          await handleUnauthorized();
          return;
        }
        showErrorModal(
          failure === 'server' ? 'details:error.unregisterFailedTitle' : 'details:error.networkErrorTitle',
          failure === 'server' ? 'details:error.unregisterFailedMessage' : 'details:error.networkErrorMessage',
          () => callDeleteAPI(item)
        );
      } finally {
        inFlightRef.current = false;
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

    if (inFlightRef.current) return;
    inFlightRef.current = true;

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
      // ✅ already_registered counts as done (audit M1): the Confirm before it
      // timed out after the server inserted, and this is the Retry. It fell to
      // "confirmation failed" + Retry, which answered the same, forever.
      const registered = isRegisteredOutcome(action);

      if (!isSuccessAction(action) && !registered) {
        if (API_CONFIG.DEBUG) {
          console.error('❌ Confirmation failed with action:', action);
        }
        // Failure on the confirm step, after the user already committed —
        // worth distinguishing from a failure on the initial register call.
        void analyticsService.logRegisterStep('failed', action, event_name);

        switch (action) {
          case 'bib_number_invalid':
            // ✅ details: keys - confirmModal has no invalidBib* text, the
            // popup printed the raw key.
            showErrorModal(
              'details:error.invalidBibTitle',
              'details:error.invalidBibMessage',
              handleConfirmRegister
            );
            break;

          case 'registration_in_progress':
            showErrorModal(
              'details:error.inProgressTitle',
              'details:error.inProgressMessage',
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

      if (registered) {
        if (API_CONFIG.DEBUG) {
          console.log('✅ Confirmation successful');
        }

        setConfirmModalVisible(false);
        setConfirmData(null);
        setConfirmItem(null);
        setIsFirstTracking(0);
        await clearPendingRegistration();
        await invalidateEventCache();
        await analyticsService.markAsParticipant('register');
        void analyticsService.logRegisterStep('completed', undefined, event_name);
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
      // ✅ Session gone (audit H1): keep the Connect for after the login and
      // close the sheet, instead of a Retry that cannot work.
      const failure = classifyCallError(error);
      if (failure === 'session_expired') {
        const keep = confirmItem.product_option_value_app_id;
        setConfirmModalVisible(false);
        setConfirmData(null);
        setConfirmItem(null);
        await handleUnauthorized(keep);
        return;
      }
      // ✅ details: keys - confirmModal has no networkError* text (raw key shown).
      showErrorModal(
        failure === 'server' ? 'confirmModal:error.confirmationFailedTitle' : 'details:error.networkErrorTitle',
        failure === 'server' ? 'confirmModal:error.confirmationFailedMessage' : 'details:error.networkErrorMessage',
        handleConfirmRegister
      );
    } finally {
      inFlightRef.current = false;
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
      // Registration funnel. The register_step event has existed since day one
      // but was never called from anywhere, so only the terminal
      // markAsParticipant('register') fired — meaning drop-off was invisible
      // and there was no way to see WHERE people abandon signing up.
      void analyticsService.logRegisterStep('started', undefined, event_name);

      const hasToken = await isTokenValid();

      if (!hasToken) {
        // Bounced to login mid-registration. Historically the single largest
        // silent drop-off point.
        void analyticsService.logRegisterStep('login_required', undefined, event_name);
        if (API_CONFIG.DEBUG) {
          console.log('🔐 No token, redirecting to login');
        }

        await handleUnauthorized(item.product_option_value_app_id); // ✅ replaces navigation.navigate('LoginScreen')
        return;
      }

      if (API_CONFIG.DEBUG) {
        console.log('📋 Registration status:', item.registration_status);
      }

      switch (item.registration_status) {
        case 'available':
        case 'membership_required':
          await callRegisterAPI(item, showConfirmPopup);
          return;
        case 'registered':
          return;
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

  const handleConnectClick = useCallback(
    (item: Distance) => {     
      const isEventFinished = item.countdown.status === 'finished';
      if (isEventFinished) {
        handleRegister(item);
        return;
      }
      const status = item.registration_status?.toString().trim(); // ✅ defensive normalize
      if (status === 'available') {
        setLiveTrackingItem(item);
        setLiveTrackingModalVisible(true);
        return;
      }

      handleRegister(item);
    },
    [handleRegister]
  );

  const handleLiveTrackingConfirm = useCallback(() => {
    setLiveTrackingModalVisible(false);
    if (liveTrackingItem) {
      handleRegister(liveTrackingItem); // reuses existing flow, no duplication
    }
    setLiveTrackingItem(null);
  }, [liveTrackingItem, handleRegister]);

  const handleLiveTrackingClose = useCallback(() => {
    setLiveTrackingModalVisible(false);
    setLiveTrackingItem(null);
  }, []);

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
    liveTrackingModalVisible,
    liveTrackingItem,
    handleConnectClick,
    handleLiveTrackingConfirm,
    handleLiveTrackingClose,
    registeringItemId, 
  };
};

export default useRegistrationHandler;