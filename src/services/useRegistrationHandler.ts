import { useState, useCallback } from "react";
import { useNavigation } from "@react-navigation/native";
import { tokenService } from "../services/tokenService";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  eventDetailService,
  Distance,
  RaceResultData,
} from "../services/eventDetailService";
import { getCurrentLanguageId } from "../i18n";


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
  handleRegister: (item: Distance) => Promise<void>;
}

const useRegistrationHandler = (
  product_app_id: string | number,
  onRefresh?: () => void , 
  onSuccess?: () => void
): UseRegistrationHandlerReturn => {
  const navigation = useNavigation<any>();
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Distance | null>(null);
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [confirmData, setConfirmData] = useState<RaceResultData | null>(null);
  const [confirmItem, setConfirmItem] = useState<Distance | null>(null);
  const [isFirstTracking, setIsFirstTracking] = useState<number>(0);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);

  //Check token
  const isTokenValid = async (): Promise<boolean> => {
    try {
      const token = await tokenService.getToken();
      return token !== null && token !== "";
    } catch {
      return false;
    }
  };

   const savePending = async (item: Distance): Promise<void> => {
    try {
      await AsyncStorage.setItem("pending_product_app_id", String(product_app_id));
      await AsyncStorage.setItem("pending_option_value_app_id", String(item.product_option_value_app_id));
    } catch (error) {
      console.error("❌ Failed to save pending registration:", error);
    }
  };

  // ─── Clear pending registration ────────────────────────────────────────────
  const clearPending = async (): Promise<void> => {
    try {
      await AsyncStorage.removeItem("pending_product_app_id");
      await AsyncStorage.removeItem("pending_option_value_app_id");
    } catch (error) {
      console.error("❌ Failed to clear pending registration:", error);
    }
  };

  const callRegisterAPI = useCallback(async (item: Distance) => {
    console.log("hiiii");
     if (registerLoading) return; // prevent double tap
    try {
      setRegisterLoading(true);
      setRegisterError(null);

      const result = await eventDetailService.registerParticipant(
        item.product_option_value_app_id
      );

      switch (result.action) {
        case "confirm_race_result":
          setConfirmData(result.race_result_data ?? null);
          setConfirmItem(item);
          setIsFirstTracking(result.is_first_tracking);
          setConfirmModalVisible(true);
          await clearPending();
          break;
        case "registered":
            setSelectedItem({ ...item, registration_status: "registered" });
          setModalVisible(true);
          break;
        default:
          setRegisterError("Unexpected response from server");
          break;
      }
    } catch (error: any) {
      switch (error?.message) {
        case "already_registered":
          setSelectedItem({ ...item, registration_status: "registered" });
          setModalVisible(true);
          break;

        case "membership_required":
          setSelectedItem({ ...item, registration_status: "membership_required" });
          setModalVisible(true);
          break;

        case "not_found_in_race_result":
           await clearPending();
          navigation.navigate("ParticipantResult", {
            product_app_id: product_app_id,
            item: item,
          });
          break;

        case "bib_number_invalid":
          setRegisterError("Invalid bib number. Please try again.");
          break;

        case "distance_not_found":
          setSelectedItem({ ...item, registration_status: "unavailable" });
          setModalVisible(true);
          break;

        default:
          setRegisterError(
            error?.message ?? "Registration failed. Please try again."
          );
          break;
      }
    } finally {
      setRegisterLoading(false);
    }
  }, [navigation, product_app_id, onRefresh]);
 
  const callDeleteAPI = useCallback(async (item: Distance) => {
     if (registerLoading) return;  
    if (!item.participant_app_id) {
      setRegisterError("Cannot unregister. Participant ID is missing.");
      return;
    }
    console.log("3hiii");
    
    try {
      setRegisterLoading(true);
      setRegisterError(null);

      await eventDetailService.deleteParticipant(item.participant_app_id);

      onRefresh?.();

    } catch (error: any) {
      setRegisterError(
        error?.message ?? "Failed to unregister. Please try again."
      );
    } finally {
      setRegisterLoading(false);
    }
  }, [registerLoading,onRefresh]);

  //Confirm register
  const handleConfirmRegister = useCallback(async () => {
    console.log("2hiiii");
    
    if (!confirmItem || !confirmData?.bib_number) return;

    try {
      setRegisterLoading(true);
      setRegisterError(null);
      const result = await eventDetailService.registerParticipant(
        confirmItem.product_option_value_app_id,
        confirmData.bib_number,
        getCurrentLanguageId()
      );

      onRefresh?.();

      if (result.action === "registered") {

        setConfirmModalVisible(false);
        setConfirmData(null);
        setConfirmItem(null);
        setIsFirstTracking(0);
         await clearPending();
  onRefresh?.();
  onSuccess?.(); 

      }
    } catch (error: any) {
      setRegisterError(
        error?.message ?? "Confirmation failed. Please try again."
      );
    } finally {
      setRegisterLoading(false);
    }
  }, [confirmItem, confirmData,  onRefresh]);

  // ─── Handle register button press ─────────────────────────────────────────
  const handleRegister = useCallback(async (item: Distance) => {
    const hasToken = await isTokenValid();

    if (!hasToken) {// ✅ FIX: was navigating to 'Register' — fixed to 'Login'
      await savePending(item);
      navigation.navigate("LoginScreen");
      return;
    }

    switch (item.registration_status) {
      case "available":
        await callRegisterAPI(item);
     
        return;

      case "registered":
        await callDeleteAPI(item);
        return;

      case "membership_required":
      case "limit_reached":
      case "unavailable":
        setSelectedItem(item);
        setModalVisible(true);
        return;

      default:
        return;
    }
  }, [navigation, callRegisterAPI, callDeleteAPI,registerLoading]);

  
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
    handleRegister,
  };
};

export default useRegistrationHandler;