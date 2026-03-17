import React, { useCallback, useState } from 'react';
import {
  View, Text, FlatList, ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { colors, commonStyles, spacing } from '../../styles/common.styles';
import { detailsStyles } from '../../styles/details.styles';
import { eventDetailService, Distance } from '../../services/eventDetailService';
import { useNavigation } from '@react-navigation/native';

interface DistanceTabProps {
  product_app_id: number;
  sourceTab?: 'past' | 'live' | 'upcoming';
  event_name: string;
}

const DistanceTab = ({ product_app_id, sourceTab = 'past', event_name}: DistanceTabProps) => {
  const navigation = useNavigation<any>();
  const { t } = useTranslation(['result', 'details', 'common']);
  const [results, setResults] = useState<Distance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchResults = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await eventDetailService.getEventDetails(product_app_id);
      setResults(result.distances);
    } catch (err: any) {
      setError(err?.message ?? t('common:errors.generic'));
    } finally {
      setLoading(false);
    }
  }, [product_app_id, t]);

  useFocusEffect(useCallback(() => { fetchResults(); }, [fetchResults]));

  const getCountdownBadge = useCallback(
    (item: Distance) => {
      const { status, days, hours, minutes } = item.countdown;

      if (status === 'in_progress') {
        return { label: t('details:countdown.live'), color: colors.success };
      }

      if (status === 'finished') {
        return { label: t('details:countdown.finished'), color: colors.gray500 };
      }

      if (status === 'not_started') {
        const parts: string[] = [];
        let color = colors.gray500;

        if (days > 0) {
          parts.push(`${days} ${t('details:countdown.days')}`);
          color = colors.info;
        } else if (hours > 0) {
          parts.push(`${hours} ${t('details:countdown.hours')}`);
          if (minutes > 0) {
            parts.push(`${minutes} ${t('details:countdown.minutes')}`);
          }
          color = colors.success;
        } else if (minutes > 0) {
          parts.push(`${minutes} ${t('details:countdown.minutes')}`);
          color = colors.warning;
        }

        if (parts.length === 0) {
          return { label: t('details:countdown.startingSoon'), color: colors.warning };
        }

        return {
          label: `${t('details:countdown.startsIn')} ${parts.join(' ')}`,
          color,
        };
      }

      return { label: '', color: colors.gray500 };
    },
    [t]
  );

  const renderItem = useCallback(({ item }: { item: Distance }) => {
    const badge = getCountdownBadge(item);

    return (
      <View style={[commonStyles.card, { padding: 0, overflow: 'hidden', marginBottom: spacing.sm }]}>
        <View style={detailsStyles.distance}>
          <View style={{ flex: 1 }}>
            <Text style={[commonStyles.title, { marginBottom: 4 }]}>
              {item.distance_name}
            </Text>
            <Text style={commonStyles.subtitle}>{item.race_date_formatted}</Text>
            <Text style={commonStyles.subtitle}>{item.race_time}</Text>
          </View>
          <View style={[detailsStyles.count, { backgroundColor: badge.color }]}>
            <Text style={[commonStyles.text, { color: '#fff', fontWeight: '600' }]}>
              {badge.label}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 6 }}>
          <TouchableOpacity
            style={[commonStyles.favoriteButton, { borderRadius: 0 }]}
            onPress={() => navigation.navigate('ResultList', {
              product_app_id,
              product_option_value_app_id: Number(item.product_option_value_app_id),
              event_name: event_name,
              sourceScreen: 'FollowerDistanceScreen',
              sectionType: 'follower',
              sourceTab,
            })}
          >
            <Text style={commonStyles.primaryButtonText}>
              {t('button.result')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[commonStyles.livetracking, { borderRadius: 0 }]}
            onPress={() => navigation.navigate('Route', {
              product_app_id,
              product_option_value_app_id: item.product_option_value_app_id || '',
              event_name: item.distance_name,
              sectionType: 'follower',
            })}
          >
            <Text style={commonStyles.primaryButtonText}>
              {t('button.route')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }, [navigation, product_app_id, sourceTab, getCountdownBadge, t]);

  if (loading) {
    return (
      <View style={[commonStyles.centerContainer, { marginTop: 40 }]}>
        <ActivityIndicator size="large" color={colors.success} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={commonStyles.centerContainer}>
        <Text style={commonStyles.errorText}>{error}</Text>
        <TouchableOpacity
          style={[commonStyles.primaryButton, { marginTop: spacing.lg }]}
          onPress={fetchResults}
        >
          <Text style={commonStyles.primaryButtonText}>{t('common:buttons.retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {results.length === 0 ? (
        <View style={{ marginTop: 40, alignItems: 'center' }}>
          <Text style={commonStyles.errorText}>
            {t('result:noResults')}
          </Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item, index) => `${item.product_option_value_app_id}-${index}`}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1, padding: spacing.xs, paddingBottom: 10 }}
          renderItem={renderItem}
        />
      )}
    </View>
  );
};

export default DistanceTab;