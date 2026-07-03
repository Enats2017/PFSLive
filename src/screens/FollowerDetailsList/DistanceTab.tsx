import React, { useCallback, useState } from 'react';
import {
  View, Text, FlatList, ActivityIndicator,
  TouchableOpacity,
  StatusBar,
  Dimensions,
  Image
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { colors, commonStyles, spacing } from '../../styles/common.styles';
import { detailsStyles } from '../../styles/details.styles';
import { eventDetailService, Distance } from '../../services/eventDetailService';
import { useNavigation } from '@react-navigation/native';
import ErrorScreen from '../../components/ErrorScreen';
import { useScreenError } from '../../hooks/useApiError';
import { SafeAreaView } from 'react-native-safe-area-context';
import CountdownBadge from '../../components/CountdownBadge';
import { Ionicons, Feather,MaterialCommunityIcons } from '@expo/vector-icons';
import { formatClockTime } from '../../utils/timeFormat';
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isTablet = SCREEN_WIDTH >= 768;


interface DistanceTabProps {
  product_app_id: number;
  sourceTab?: 'past' | 'live' | 'upcoming';
  event_name: string;
  event_image?: string;

}

const DistanceTab = ({
  product_app_id,
  sourceTab = 'past',
  event_name,
  event_image
}: DistanceTabProps) => {
  const navigation = useNavigation<any>();
  const { t } = useTranslation(['result', 'details', 'common']);
  const [results, setResults] = useState<Distance[]>([]);
  const [loading, setLoading] = useState(true);
  //const [error, setError] = useState<string | null>(null);
  const { error, hasError, handleApiError, clearError } = useScreenError();

  const fetchResults = useCallback(async () => {
    try {
      setLoading(true);
      clearError();
      const result = await eventDetailService.getEventDetails(product_app_id);
      setResults(result.distances);
    } catch (err: any) {
      handleApiError(err);
    } finally {
      setLoading(false);
    }
  }, [product_app_id, t]);

  useFocusEffect(useCallback(() => { fetchResults(); }, [fetchResults]));

  const renderListHeader = useCallback(() => (
    <>
      {event_image ? (
      <Image
        source={{ uri: event_image }}
        style={{ width: '100%', aspectRatio: 612 / 300 }}
        resizeMode="cover"
      />
    ) : null}
      
    </>
  ), [event_image]);

  const renderItem = useCallback(({ item }: { item: Distance }) => {
    const isPast = sourceTab === 'past';
    const isLiveOrUpcoming = sourceTab === 'live' || sourceTab === 'upcoming';

    return (
      <View style={[commonStyles.card, { minHeight: 110, marginBottom: spacing.sm }]}>
        <View style={[detailsStyles.distance]}>
          <View style={detailsStyles.distanceInfo}>
            <Text style={[commonStyles.title, { marginBottom: spacing.xs }]} numberOfLines={2}>
              {item.distance_name}
            </Text>

            <View style={detailsStyles.metaRow}>
              <Ionicons name="calendar-outline" size={14} color={colors.gray600} />
              <Text style={commonStyles.subtitle} numberOfLines={1}>
                {item.race_date_formatted}
              </Text>
            </View>

            <View style={detailsStyles.metaRow}>
              <Ionicons name="time-outline" size={15} color={colors.gray600} />
              <Text style={commonStyles.subtitle} numberOfLines={1}>
                {formatClockTime(item.race_time)} 
              </Text>
            </View>

            <View style={detailsStyles.metaRow}>
              <Feather name="users" size={16} color={colors.gray500} />
              <Text style={commonStyles.subtitle} numberOfLines={1}>
                {item.participant_started_count} {t('details:athletes')}
              </Text>
            </View>
            <View style={detailsStyles.metaRow}>
              <Ionicons name="ribbon-outline" size={15} color={colors.gray600} />
              <Text style={commonStyles.subtitle} numberOfLines={1}>
                {item.finished_count} {t('details:finished')}
              </Text>
            </View>
            <View style={detailsStyles.metaRow}>
              <Ionicons name="close-circle-outline" size={15} color={colors.gray600} />
              <Text style={detailsStyles.metaText} numberOfLines={1}>
                {item.dnf_count} {t('details:dnf')}
              </Text>
            </View>
            {!isPast && (
              <View style={detailsStyles.metaRow}>
                <MaterialCommunityIcons name="timer-sand" size={15} color={colors.gray600} />
                <CountdownBadge
                  days={item.countdown.days}
                  hours={item.countdown.hours}
                  minutes={item.countdown.minutes}
                  status={item.countdown.status}
                />
              </View>
            )}
          </View>
          <View style={detailsStyles.verticalDivider} />

          <View style={{ gap:spacing.md}}>
            <TouchableOpacity
              style={detailsStyles.resultsButton}
              onPress={() => navigation.navigate('ResultList', {
                product_app_id,
                product_option_value_app_id: Number(item.product_option_value_app_id),
                event_name: event_name,
                event_image: event_image,
                sourceScreen: 'FollowerDistanceScreen',
                sectionType: 'follower',
                sourceTab,
              })}
              activeOpacity={0.8}
            >
              <Text style={commonStyles.primaryButtonText}>
                {t('button.result')}
              </Text>
            </TouchableOpacity>
            {isLiveOrUpcoming && (
              <TouchableOpacity
                style={detailsStyles.routeButton}
                onPress={() => navigation.navigate('LiveTracking', {
                  product_app_id,
                  product_option_value_app_id: item.product_option_value_app_id || '',
                  event_name: event_name,
                  event_image: event_image,
                  sourceScreen: 'FollowerDistanceScreen',
                  sectionType: 'follower',
                  sourceTab,
                })}
                activeOpacity={0.8}
              >
                <Text style={commonStyles.primaryButtonText}>
                  {t('button.route')}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  }, [navigation, product_app_id, sourceTab,  t]);

  if (loading) {
    return (
      <View style={[commonStyles.centerContainer, { marginTop: 40 }]}>
        <ActivityIndicator size="large" color={colors.success} />
      </View>
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
          onRetry={() => { clearError(); fetchResults(); }}
        />
      </SafeAreaView>
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
          nestedScrollEnabled={true}
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: spacing.md, paddingBottom: spacing.xxxl, paddingTop: spacing.md }}
          renderItem={renderItem}
          ListHeaderComponent={renderListHeader}
        />
      )}
    </View>
  );
};

export default DistanceTab;