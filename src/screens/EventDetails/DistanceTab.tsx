import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { commonStyles, colors } from '../../styles/common.styles';
import { detailsStyles } from '../../styles/details.styles';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { eventDetailService, Distance } from '../../services/eventDetailService';

interface DistanceTabProps {
  product_app_id: string | number;
}

const DistanceTab = ({ product_app_id }: DistanceTabProps) => {
  const { t } = useTranslation(['details']);
  const [distances, setDistances] = useState<Distance[]>([]);
  const [loading, setLoading] = useState(true);
  const [serverTime, setServerTime] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      fetchDistances();
    }, [product_app_id])
  );

  const fetchDistances = async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await eventDetailService.getEventDetails(product_app_id);

      setDistances(result.distances);
      setServerTime(result.server_datetime);
    } catch (error: any) {
      setError(error.message || t('details:error.title'));
    } finally {
      setLoading(false);
    }
  };

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

  const getButtonText = (item: Distance): string => {
    if (!serverTime) return t('details:button');

    try {
      const serverDate = new Date(serverTime.replace(' ', 'T'));
      const raceDateTime = new Date(`${item.race_date}T${item.race_time}`);
      const diffMs = raceDateTime.getTime() - serverDate.getTime();
      const diffMinutes = diffMs / (1000 * 60);

      if (diffMinutes <= 60 && diffMinutes >= 0) {
        return t('details:live');
      }
    } catch (error) {
      // Silent fail
    }

    return t('details:button');
  };

  if (loading) {
    return (
      <ActivityIndicator
        size="large"
        color="#f4a100"
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
    <FlatList
      data={distances}
      keyExtractor={(item, index) => `${item.product_option_value_app_id}-${index}`}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 20 }}
      renderItem={({ item }) => {
        const badge = getCountdownBadge(item);
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
            <TouchableOpacity style={[commonStyles.primaryButton, { borderRadius: 0 }]}>
              <Text style={commonStyles.primaryButtonText}>
                {getButtonText(item)}
              </Text>
            </TouchableOpacity>
          </View>
        );
      }}
    />
  );
};

export default DistanceTab;