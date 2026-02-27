import { useState, useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import { tokenService } from '../services/tokenService';
import { eventDetailService, Distance, RaceResultData } from '../services/eventDetailService';

interface UseRegistrationHandlerReturn {
  // status modal (registered, membership_required, limit_reached, unavailable)
  modalVisible: boolean;
  selectedItem: Distance | null;
  handleModalClose: () => void;

  // confirm race result modal (confirm_race_result)
  confirmModalVisible: boolean;
  confirmData: RaceResultData | null;
  confirmItem: Distance | null;
  isFirstTracking: number;
  handleConfirmModalClose: () => void;
  handleConfirmRegister: () => Promise<void>;  // user taps confirm button

  // register loading/error
  registerLoading: boolean;
  registerError: string | null;

  handleRegister: (item: Distance) => Promise<void>;
}

const useRegistrationHandler = (): UseRegistrationHandlerReturn => {
  const navigation = useNavigation<any>();
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Distance | null>(null);
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [confirmData, setConfirmData] = useState<RaceResultData | null>(null);
  const [confirmItem, setConfirmItem] = useState<Distance | null>(null);
  const [isFirstTracking, setIsFirstTracking] = useState<number>(0);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);

  //  Check token
  const isTokenValid = async (): Promise<boolean> => {
    try {
      const token = await tokenService.getToken();
      return token !== null && token !== '';
    } catch {
      return false;
    }
  };

  // Step 1: Call register API (no bib_number) 
  const callRegisterAPI = async (item: Distance) => {
    try {
      setRegisterLoading(true);
      setRegisterError(null);

      const result = await eventDetailService.registerParticipant(
        item.product_option_value_app_id
        // no bib_number in step 1
      );

      switch (result.action) {
        case 'confirm_race_result':
          setConfirmData(result.race_result_data ?? null);
          setConfirmItem(item);
          setIsFirstTracking(result.is_first_tracking);
          setConfirmModalVisible(true);  // ← open confirm modal
          break;

        case 'registered':
          // directly registered → go to success screen
        //   navigation.navigate('RegistrationSuccess', {
        //     participant: result.participant,
        //     is_first_tracking: result.is_first_tracking,
        //   });
          break;

        default:
          setRegisterError('Unexpected response from server');
          break;
      }
    } catch (error: any) {
      switch (error?.message) {
        case 'already_registered':
          setRegisterError('You are already registered for this distance.');
          break;
        case 'membership_required':
          setRegisterError('A membership is required to register.');
          break;
        case 'not_found_in_race_result':
          setRegisterError('Your email was not found in the race result. Please contact support.');
          break;
        case 'bib_number_invalid':
          setRegisterError('Invalid bib number. Please try again.');
          break;
        case 'distance_not_found':
          setRegisterError('This distance is no longer available.');
          break;
        default:
          setRegisterError(error?.message ?? 'Registration failed. Please try again.');
          break;
      }
    } finally {
      setRegisterLoading(false);
    }
  };

  //User taps Confirm in confirm modal
  const handleConfirmRegister = useCallback(async () => {
    if (!confirmItem || !confirmData?.bib_number) return;

    try {
      setRegisterLoading(true);
      setRegisterError(null);

      // send bib_number this time (step 2)
      const result = await eventDetailService.registerParticipant(
        confirmItem.product_option_value_app_id,
        confirmData.bib_number  // ← bib_number from step 1 response
      );

      console.log("11111",result);
      

      if (result.action === 'registered') {
        setConfirmModalVisible(false);
        setConfirmData(null);
        setConfirmItem(null);
      }
    } catch (error: any) {
      setRegisterError(error?.message ?? 'Confirmation failed. Please try again.');
    } finally {
      setRegisterLoading(false);
    }
  }, [confirmItem, confirmData, navigation]);

  //Handle register button press 
  const handleRegister = useCallback(async (item: Distance) => {
    const hasToken = await isTokenValid();

    if (!hasToken) {
      navigation.navigate('Register');
      return;
    }

    switch (item.registration_status) {
      case 'available':
        await callRegisterAPI(item);
        return;

      case 'registered':
      case 'membership_required':
      case 'limit_reached':
      case 'unavailable':
        setSelectedItem(item);
        setModalVisible(true);
        return;

      default:
        return;
    }
  }, [navigation]);

  //Close status modal 
  const handleModalClose = useCallback(() => {
    setModalVisible(false);
    setSelectedItem(null);
  }, []);

  //Close confirm modal 
  const handleConfirmModalClose = useCallback(() => {
    setConfirmModalVisible(false);
    setConfirmData(null);
    setConfirmItem(null);
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
    handleRegister,
  };
};

export default useRegistrationHandler;