import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { commonStyles, colors } from '../../styles/common.styles';
import { detailsStyles } from '../../styles/details.styles';
import { eventDetailService, Distance } from '../../services/eventDetailService';
import RegistrationModal from '../../components/RegistrationModal';
import ConfirmRaceResultModal from './ConfirmRaceResultModal';
import useRegistrationHandler from '../../services/useRegistrationHandler';

interface DistanceTabProps {
  product_app_id: string | number;
}

const DistanceTab = ({ product_app_id }: DistanceTabProps) => {
  const { t } = useTranslation(['details']);

  const [distances, setDistances] = useState<Distance[]>([]);
  const [loading, setLoading] = useState(true);
  const [serverTime, setServerTime] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

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
    registerError,
    handleRegister,
  } = useRegistrationHandler();

  useEffect(() => {
    if (registerError) {
      Alert.alert('Registration Failed', registerError);
    }
  }, [registerError]);


  const fetchDistances = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await eventDetailService.getEventDetails(product_app_id);
      setDistances(result.distances);
      setServerTime(result.server_datetime);
    } catch (err: any) {
      setError(err?.message ?? t('details:error.title'));
    } finally {
      setLoading(false);
    }
  }, [product_app_id, t]);

  useFocusEffect(
    useCallback(() => {
      fetchDistances();
    }, [fetchDistances])
  );

  const getCountdownBadge = useMemo(() => {
    return (item: Distance) => {
      switch (item.countdown_type) {
        case 'in_progress':
          return { label: t('details:countdown.in_progress'), color: colors.success };
        case 'finished':
          return { label: t('details:countdown.finished'), color: colors.gray500 };
        case 'hours':
          return { label: `${item.countdown_value} ${t('details:countdown.hours')}`, color: colors.success };
        case 'minutes':
          return { label: `${item.countdown_value} ${t('details:countdown.minutes')}`, color: colors.warning };
        case 'days':
          return { label: `${item.countdown_value} ${t('details:countdown.days')}`, color: colors.info };
        default:
          return { label: '', color: colors.gray500 };
      }
    };
  }, [t]);

  const renderItem = useCallback(({ item }: { item: Distance }) => {
    const badge = getCountdownBadge(item);
    const isRegistering =
      registerLoading && (
        confirmItem?.product_option_value_app_id === item.product_option_value_app_id ||
        selectedItem?.product_option_value_app_id === item.product_option_value_app_id
      );

    return (
      <View style={[commonStyles.card, { padding: 0, overflow: 'hidden', marginBottom: 16 }]}>
        <View style={detailsStyles.distance}>
          <View style={{ flex: 1 }}>
            <Text style={[commonStyles.title, { marginBottom: 4 }]}>
              {item.distance_name}
            </Text>
            <Text style={commonStyles.subtitle}>{item.race_date}</Text>
            <Text style={commonStyles.subtitle}>{item.race_time}</Text>
          </View>
          <View style={[detailsStyles.count, { backgroundColor: badge.color }]}>
            <Text style={[commonStyles.text, { color: '#fff', fontWeight: '600' }]}>
              {badge.label}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[commonStyles.primaryButton, { borderRadius: 0, opacity: isRegistering ? 0.7 : 1 }]}
          onPress={() => handleRegister(item)}
          disabled={isRegistering}
        >
          {isRegistering ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={commonStyles.primaryButtonText}>
              {/* ✅ FIX: was 'undo for Sign Up' — fixed to correct text */}
              {item.registration_status === 'available' ? t('details:undo') :t('details:button')}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    );
  // ✅ FIX: added all missing dependencies
  }, [getCountdownBadge,  handleRegister, registerLoading, confirmItem, selectedItem]);

  if (loading) {
    return (
      <ActivityIndicator size="large" color="#f4a100" style={{ marginTop: 40 }} />
    );
  }

  if (error) {
    return (
      <View style={commonStyles.centerContainer}>
        <Text style={commonStyles.errorText}>{error}</Text>
        <TouchableOpacity
          style={[commonStyles.primaryButton, { marginTop: 16 }]}
          onPress={fetchDistances}
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
      <View style={{ marginTop: 40 }}>
        <Text style={commonStyles.errorText}>
          {t('details:distance.empty')}
        </Text>
      </View>
    );
  }

  return (
    <>
      <FlatList
        data={distances}
        keyExtractor={(item, index) => `${item.product_option_value_app_id}-${index}`}
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
    </>
  );
};

export default DistanceTab;