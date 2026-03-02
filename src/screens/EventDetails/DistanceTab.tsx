import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { commonStyles, colors } from '../../styles/common.styles';
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
  const [error, setError] = useState<string | null>(null);
  const [successVisible, setSuccessVisible] = useState(false);
  const [undoModalVisible, setUndoModalVisible] = useState(false);
  const [selectedUndoItem, setSelectedUndoItem] = useState<Distance | null>(null);
  
  // ✅ NEW: Track if we need to refresh after modal closes
  const [pendingRefresh, setPendingRefresh] = useState(false);

  // ✅ FETCH DISTANCES WITH CACHE BUSTING
  const fetchDistances = useCallback(
    async (bustCache: boolean = false) => {
      try {
        setLoading(true);
        setError(null);

        if (API_CONFIG.DEBUG) {
          console.log('📡 Fetching distances for product:', product_app_id, {
            bustCache,
          });
        }

        const result = await eventDetailService.getEventDetails(
          product_app_id,
          bustCache
        );
        
        setDistances(result.distances);
        setServerTime(result.server_datetime);

        if (API_CONFIG.DEBUG) {
          console.log('✅ Distances loaded:', result.distances.length);
        }
      } catch (err: any) {
        if (API_CONFIG.DEBUG) {
          console.error('❌ Error fetching distances:', err);
        }
        setError(err?.message ?? t('details:error.title'));
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
                participant_app_id:
                  participant_app_id ?? d.participant_app_id,
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

  // ✅ SUCCESS CALLBACK (DON'T REFRESH IMMEDIATELY)
  const handleSuccess = useCallback(
    async (
      product_option_value_app_id: number,
      participant_app_id?: number
    ) => {
      if (API_CONFIG.DEBUG) {
        console.log('🎉 Registration successful');
      }

      // ✅ OPTIMISTICALLY UPDATE UI
      updateDistanceStatus(
        product_option_value_app_id,
        'registered',
        participant_app_id
      );

      // ✅ SHOW SUCCESS MODAL
      setSuccessVisible(true);

      // ✅ MARK THAT WE NEED TO REFRESH AFTER MODAL CLOSES
      setPendingRefresh(true);
    },
    [updateDistanceStatus]
  );

  // ✅ DELETE SUCCESS CALLBACK (DON'T REFRESH IMMEDIATELY)
  const handleDeleteSuccess = useCallback(
    async (product_option_value_app_id: number) => {
      if (API_CONFIG.DEBUG) {
        console.log('✅ Unregister successful');
      }

      // ✅ OPTIMISTICALLY UPDATE UI
      updateDistanceStatus(product_option_value_app_id, 'available');

      // ✅ MARK THAT WE NEED TO REFRESH AFTER MODAL CLOSES
      setPendingRefresh(true);
    },
    [updateDistanceStatus]
  );

  // ✅ HANDLE SUCCESS MODAL CLOSE (REFRESH AFTER CLOSING)
  const handleSuccessModalClose = useCallback(() => {
    setSuccessVisible(false);

    // ✅ NOW REFRESH AFTER MODAL IS CLOSED
    if (pendingRefresh) {
      if (API_CONFIG.DEBUG) {
        console.log('🔄 Refreshing after modal close');
      }

      setTimeout(() => {
        fetchDistances(true); // Bust cache
        onRefresh?.(); // Refresh parent
        setPendingRefresh(false);
      }, 300); // Small delay for smooth transition
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

  const getCountdownBadge = useMemo(() => {
    return (item: Distance) => {
      switch (item.countdown_type) {
        case 'in_progress':
          return {
            label: t('details:countdown.in_progress'),
            color: colors.success,
          };
        case 'finished':
          return {
            label: t('details:countdown.finished'),
            color: colors.gray500,
          };
        case 'hours':
          return {
            label: `${item.countdown_value} ${t('details:countdown.hours')}`,
            color: colors.success,
          };
        case 'minutes':
          return {
            label: `${item.countdown_value} ${t('details:countdown.minutes')}`,
            color: colors.warning,
          };
        case 'days':
          return {
            label: `${item.countdown_value} ${t('details:countdown.days')}`,
            color: colors.info,
          };
        default:
          return { label: '', color: colors.gray500 };
      }
    };
  }, [t]);

  const renderItem = useCallback(
    ({ item }: { item: Distance }) => {
      const badge = getCountdownBadge(item);
      const isRegistering =
        registerLoading &&
        (confirmItem?.product_option_value_app_id ===
          item.product_option_value_app_id ||
          selectedItem?.product_option_value_app_id ===
            item.product_option_value_app_id);

      return (
        <View
          style={[
            commonStyles.card,
            { padding: 0, overflow: 'hidden', marginBottom: 16 },
          ]}
        >
          <View style={detailsStyles.distance}>
            <View style={{ flex: 1 }}>
              <Text style={[commonStyles.title, { marginBottom: 4 }]}>
                {item.distance_name}
              </Text>
              <Text style={commonStyles.subtitle}>{item.race_date}</Text>
              <Text style={commonStyles.subtitle}>{item.race_time}</Text>
            </View>
            <View style={[detailsStyles.count, { backgroundColor: badge.color }]}>
              <Text
                style={[commonStyles.text, { color: '#fff', fontWeight: '600' }]}
              >
                {badge.label}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[
              commonStyles.primaryButton,
              { borderRadius: 0, opacity: isRegistering ? 0.7 : 1 },
            ]}
            onPress={() =>
              item.registration_status === 'registered'
                ? handleUndoClick(item)
                : handleRegister(item)
            }
            disabled={isRegistering}
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
    [
      getCountdownBadge,
      handleRegister,
      handleUndoClick,
      registerLoading,
      confirmItem,
      selectedItem,
      t,
    ]
  );

  if (loading) {
    return (
      <ActivityIndicator
        size="large"
        color={colors.primary}
        style={{ marginTop: 40 }}
      />
    );
  }

  if (error) {
    return (
      <View style={commonStyles.centerContainer}>
        <Text style={commonStyles.errorText}>{error}</Text>
        <TouchableOpacity
          style={[commonStyles.primaryButton, { marginTop: 16 }]}
          onPress={() => fetchDistances(true)}
        >
          <Text style={commonStyles.primaryButtonText}>
            {t('details:error.retry')}
          </Text>
        </TouchableOpacity>
      </View>
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
        keyExtractor={(item, index) =>
          `${item.product_option_value_app_id}-${index}`
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 50 }}
        renderItem={renderItem}
      />

      <RegistrationModal
        visible={modalVisible}
        status={selectedItem?.registration_status ?? null}
        distanceName={selectedItem?.distance_name ?? ''}
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

      {/* ✅ SUCCESS MODAL - REFRESH AFTER CLOSE */}
      <SuccessCelebrationModal
        visible={successVisible}
        message={t('details:success.message')}
        onClose={handleSuccessModalClose}
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