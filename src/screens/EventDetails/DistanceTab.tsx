import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { commonStyles, colors, spacing } from '../../styles/common.styles';
import { detailsStyles } from '../../styles/details.styles';
import { eventDetailService, Distance } from '../../services/eventDetailService';
import RegistrationModal from '../../components/RegistrationModal';
import ConfirmRaceResultModal from './ConfirmRaceResultModal';
import SuccessCelebrationModal from '../../components/SuccessCelebrationModal';
import UndoConfirmModal from '../../components/UndoConfirmModal';
import ErrorModal from '../../components/ErrorModal';
import useRegistrationHandler from '../../services/useRegistrationHandler';
import { useNavigation } from '@react-navigation/native';
import { API_CONFIG } from '../../constants/config';
import { toastSuccess } from '../../../utils/toast';
import ErrorScreen from '../../components/ErrorScreen';
import { useScreenError } from '../../hooks/useApiError';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader } from '../../components/common/AppHeader';
import CountdownBadge from '../../components/CountdownBadge';

interface DistanceTabProps {
  product_app_id: string | number;
  event_name: string;
  auto_register_id?: number | null;
  onRefresh?: () => void;
}

const DistanceTab = ({
  product_app_id,
  event_name,
  auto_register_id,
  onRefresh,
}: DistanceTabProps) => {
  const { t } = useTranslation(['details']);
  const navigation = useNavigation<any>();
  const [distances, setDistances] = useState<Distance[]>([]);
  const [loading, setLoading] = useState(true);
  const [serverTime, setServerTime] = useState<string>('');
  const [successVisible, setSuccessVisible] = useState(false);
  const [undoModalVisible, setUndoModalVisible] = useState(false);
  const [selectedUndoItem, setSelectedUndoItem] = useState<Distance | null>(null);
  const [pendingRefresh, setPendingRefresh] = useState(false);

  const { error, hasError, handleApiError, clearError } = useScreenError();

  const fetchDistances = useCallback(
    async (bustCache: boolean = false) => {
      try {
        setLoading(true);
        clearError();

        if (API_CONFIG.DEBUG) {
          console.log('📡 Fetching distances for product:', product_app_id, { bustCache });
        }

        const result = await eventDetailService.getEventDetails(product_app_id, bustCache);

        setDistances(result.distances);
        setServerTime(result.server_datetime);

        if (API_CONFIG.DEBUG) {
          console.log('✅ Distances loaded:', result.distances.length);
        }
      } catch (err: any) {
        if (API_CONFIG.DEBUG) {
          console.error('❌ Error fetching distances:', err);
        }
        handleApiError(err);
      } finally {
        setLoading(false);
      }
    },
    [product_app_id, t]
  );

  // ✅ OPTIMISTICALLY UPDATE DISTANCE STATUS
  const updateDistanceStatus = useCallback(
    (
      product_option_value_app_id: number,
      newStatus: Distance['registration_status'],
      participant_app_id?: number
    ) => {
      setDistances((prev) =>
        prev.map((d) =>
          d.product_option_value_app_id === product_option_value_app_id
            ? {
              ...d,
              registration_status: newStatus,
              participant_app_id: participant_app_id ?? d.participant_app_id,
            }
            : d
        )
      );

      if (API_CONFIG.DEBUG) {
        console.log('🔄 Optimistically updated distance status:', {
          product_option_value_app_id,
          newStatus,
        });
      }
    },
    []
  );

  // ✅ SUCCESS CALLBACK
  const handleSuccess = useCallback(
    async (product_option_value_app_id: number, participant_app_id?: number) => {
      if (API_CONFIG.DEBUG) {
        console.log('🎉 Registration successful');
      }

      updateDistanceStatus(product_option_value_app_id, 'registered', participant_app_id);
      setSuccessVisible(true);
      setPendingRefresh(true);
    },
    [updateDistanceStatus]
  );

  // ✅ DELETE SUCCESS CALLBACK WITH TOAST
  const handleDeleteSuccess = useCallback(
    async (product_option_value_app_id: number) => {
      if (API_CONFIG.DEBUG) {
        console.log('✅ Unregister successful');
      }

      updateDistanceStatus(product_option_value_app_id, 'available');

      toastSuccess(
        t('details:unregister.successTitle'),
        t('details:unregister.successMessage')
      );

      setPendingRefresh(true);

      setTimeout(() => {
        fetchDistances(true);
        onRefresh?.();
        setPendingRefresh(false);
      }, 500);
    },
    [updateDistanceStatus, t, fetchDistances, onRefresh]
  );

  // ✅ HANDLE SUCCESS MODAL CLOSE
  const handleSuccessModalClose = useCallback(() => {
    setSuccessVisible(false);

    if (pendingRefresh) {
      if (API_CONFIG.DEBUG) {
        console.log('🔄 Refreshing after modal close');
      }

      setTimeout(() => {
        fetchDistances(true);
        onRefresh?.();
        setPendingRefresh(false);
      }, 300);
    }
  }, [pendingRefresh, fetchDistances, onRefresh]);

  const {
    modalVisible,
    selectedItem,
    handleModalClose,
    confirmModalVisible,
    confirmData,
    confirmItem,
    handleConfirmModalClose,
    handleConfirmRegister,
    registerLoading,
    errorModalVisible,
    errorTitleKey,
    errorMessageKey,
    handleErrorModalClose,
    handleErrorRetry,
    handleRegister,
    handleDelete,
  } = useRegistrationHandler(
    product_app_id,
    event_name,
    () => fetchDistances(true),
    handleSuccess,
    handleDeleteSuccess
  );

  useFocusEffect(
    useCallback(() => {
      fetchDistances(false);
    }, [fetchDistances])
  );

  // ✅ AUTO-REGISTER LOGIC
  useEffect(() => {
    if (!auto_register_id || distances.length === 0 || loading) return;

    if (API_CONFIG.DEBUG) {
      console.log('🔍 Looking for auto-register distance:', auto_register_id);
    }

    const distanceItem = distances.find(
      (d) => d.product_option_value_app_id === auto_register_id
    );

    if (!distanceItem) {
      if (API_CONFIG.DEBUG) {
        console.log('⚠️ Auto-register distance not found');
      }
      return;
    }

    if (API_CONFIG.DEBUG) {
      console.log('✅ Auto-registering for:', distanceItem.distance_name);
    }

    navigation.setParams({ auto_register_id: null });
    handleRegister(distanceItem);
  }, [auto_register_id, distances, loading, handleRegister, navigation]);

  // ✅ UNDO HANDLER
  const handleUndoClick = useCallback((item: Distance) => {
    if (API_CONFIG.DEBUG) {
      console.log('🔄 Undo clicked for:', item.distance_name);
    }
    setSelectedUndoItem(item);
    setUndoModalVisible(true);
  }, []);

  // ✅ CONFIRM UNDO
  const handleConfirmUndo = useCallback(async () => {
    if (!selectedUndoItem) return;

    if (API_CONFIG.DEBUG) {
      console.log('✅ Confirming undo for:', selectedUndoItem.distance_name);
    }

    setUndoModalVisible(false);
    await handleDelete(selectedUndoItem);
    setSelectedUndoItem(null);
  }, [selectedUndoItem, handleDelete]);

  // ✅ GET COUNTDOWN BADGE (SMART UNIT DISPLAY)


  const renderItem = useCallback(
    ({ item }: { item: Distance }) => {
      const isRegistering =
        registerLoading &&
        (confirmItem?.product_option_value_app_id === item.product_option_value_app_id ||
          selectedItem?.product_option_value_app_id === item.product_option_value_app_id);

      return (
        <View style={[commonStyles.card, { padding: 0, marginBottom: 16 }]}>
          <View style={detailsStyles.distance}>
            <View style={{ flex: 1 }}>
              <Text style={[commonStyles.title, { marginBottom: 4 }]}>
                {item.distance_name}
              </Text>
              <Text style={commonStyles.subtitle}>{item.race_date_formatted}</Text>
              <Text style={commonStyles.subtitle}>{item.race_time}</Text>
              <Text style={commonStyles.subtitle}>
                {item.participant_count} {t('details:athletes')}
              </Text>
            </View>
            <CountdownBadge
              days={item.countdown.days}
              hours={item.countdown.hours}
              minutes={item.countdown.minutes}
              status={item.countdown.status}
            />
          </View>
          <TouchableOpacity
            style={[commonStyles.primaryButton, {
              borderRadius: 0, opacity: isRegistering ? 0.7 : 1, borderBottomLeftRadius: 12,
              borderBottomRightRadius: 12,
            }]}
            onPress={() =>
              item.registration_status === 'registered'
                ? handleUndoClick(item)
                : handleRegister(item)
            }
            disabled={isRegistering}
            activeOpacity={0.8}
          >
            {isRegistering ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={commonStyles.primaryButtonText}>
                {item.registration_status === 'registered'
                  ? t('details:undo')
                  : t('details:button')}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      );
    },
    [CountdownBadge, handleRegister, handleUndoClick, registerLoading, confirmItem, selectedItem, t]
  );

  if (loading) {
    return (
      <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
    );
  }

  if (hasError && !loading) {
    return (
      <SafeAreaView style={commonStyles.container} edges={['top']}>
        <StatusBar barStyle="dark-content" />
        <ErrorScreen
          type={error!.type}
          title={error!.title}
          message={error!.message}
          onRetry={() => { clearError(); fetchDistances(); }}
        />
      </SafeAreaView>
    );
  }

  if (distances.length === 0) {
    return (
      <View style={{ marginTop: 40, alignItems: 'center' }}>
        <Text style={commonStyles.errorText}>{t('details:distance.empty')}</Text>
      </View>
    );
  }

  return (
    <>
      <FlatList
        data={distances}
        keyExtractor={(item, index) => `${item.product_option_value_app_id}-${index}`}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 50, paddingTop: spacing.md }}
        renderItem={renderItem}
      />

      <RegistrationModal
        visible={modalVisible}
        status={selectedItem?.registration_status ?? null}
        distanceName={selectedItem?.distance_name ?? ''}
        membershipLimit={selectedItem?.membership_limit}
        membershipStartDate={selectedItem?.membership_start_date}
        onClose={handleModalClose}
      />

      <ConfirmRaceResultModal
        visible={confirmModalVisible}
        data={confirmData}
        distanceName={confirmItem?.distance_name ?? ''}
        registerLoading={registerLoading}
        onConfirm={handleConfirmRegister}
        onClose={handleConfirmModalClose}
      />

      <SuccessCelebrationModal
        visible={successVisible}
        message={t('details:success.message')}
        onClose={handleSuccessModalClose}
        title={t('details:success.label')}
      />

      <UndoConfirmModal
        visible={undoModalVisible}
        distanceName={selectedUndoItem?.distance_name ?? ''}
        onConfirm={handleConfirmUndo}
        onClose={() => {
          setUndoModalVisible(false);
          setSelectedUndoItem(null);
        }}
      />

      <ErrorModal
        visible={errorModalVisible}
        titleKey={errorTitleKey}
        messageKey={errorMessageKey}
        onClose={handleErrorModalClose}
        onRetry={handleErrorRetry}
      />
    </>
  );
};

export default DistanceTab;