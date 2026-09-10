import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, ActivityIndicator,
  TouchableOpacity,
  StatusBar,
  Dimensions
} from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { commonStyles, spacing, palette } from '../../styles/common.styles';
import { detailsStyles } from '../../styles/details.styles';
import { eventDetailService, Distance } from '../../services/eventDetailService';
import { useNavigation } from '@react-navigation/native';
import ErrorScreen from '../../components/ErrorScreen';
import { useScreenError } from '../../hooks/useApiError';
import CountdownBadge from '../../components/CountdownBadge';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { formatClockTime } from '../../utils/timeFormat';
import { analyticsService } from '../../services/analyticsService';
import { ANALYTICS_SCREENS, ANALYTICS_BUTTONS, ANALYTICS_PARAMS } from '../../constants/analyticsScreens';
import useGpxDownload, { canShowGpxButton } from '../../hooks/useGpxDownload';
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isTablet = SCREEN_WIDTH >= 768;


interface DistanceTabProps {
  product_app_id: number;
  sourceTab?: 'past' | 'live' | 'upcoming';
  event_name: string;
  event_image?: string;
  onResultsAvailability?: (show: boolean) => void;
  onRaceDateAvailable?: (date: string | null) => void; 
}

const DistanceTab = ({
  product_app_id,
  sourceTab = 'past',
  event_name,
  event_image,
  onResultsAvailability,
  onRaceDateAvailable,
}: DistanceTabProps) => {
  const navigation = useNavigation<any>();
  const { t } = useTranslation(['result', 'details', 'common']);
  const [results, setResults] = useState<Distance[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [showResultsStats, setShowResultsStats] = useState(false);
  const [loading, setLoading] = useState(true);
  const [imageLoading, setImageLoading] = useState(true);
  //const [error, setError] = useState<string | null>(null);
  const { error, hasError, handleApiError, clearError } = useScreenError();

  // ✅ GPX download — same flow as the participant distance tab
  // (screens/EventDetails/DistanceTab.tsx). The hook owns the download,
  // permissions and its own alerts; this screen only decides when to allow it.
  const { downloadGpx } = useGpxDownload();

  const fetchResults = useCallback(async () => {
    try {
      setLoading(true);
      clearError();
      const result = await eventDetailService.getEventDetails(product_app_id);
      setResults(result.distances);
      // Results button/tab only when RR results are published (status 1) AND a URL exists.
      const canShowResults =
          result.event?.show_results === 1;
      
      setShowResults(canShowResults);
      onResultsAvailability?.(canShowResults);

      const canShowResultsStats =
        result.event?.show_results === 1;
      setShowResultsStats(canShowResultsStats);

      onRaceDateAvailable?.(result.event?.product_race_date ?? null);

    } catch (err: any) {
      handleApiError(err);
    } finally {
      setLoading(false);
    }
  }, [product_app_id, t]);

  useFocusEffect(useCallback(() => { fetchResults(); }, [fetchResults]));

  useEffect(() => {
    setImageLoading(true);
  }, [event_image]);

  // No rr_url gate: that is the Race Result results feed, not a statement about
  // whether a route file exists. canShowGpxButton already requires gpx_url, so
  // by the time this runs there is a file to fetch.
  const handleDownloadGpx = useCallback(
    (item: Distance) => {
      downloadGpx(item);
      analyticsService.logInteraction(
        ANALYTICS_SCREENS.FOLLOWER_EVENT_DETAILS,
        ANALYTICS_BUTTONS.DOWNLOAD_GPX,
        'tap',
        { [ANALYTICS_PARAMS.EVENT_NAME]: event_name },
      );
    },
    [downloadGpx, event_name],
  );

  const renderListHeader = useCallback(() => (
    <>
      <View style={{ paddingTop: 2 }}>
        {event_image ? (
          <View
            style={{
              width: '100%',
              aspectRatio: 612 / 428,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            {imageLoading && (
              <ActivityIndicator
                size="large"
                color={palette.navy}
                style={{ position: 'absolute', zIndex: 1 }}
              />
            )}

            <Image
              source={{ uri: event_image }}
              contentFit="cover"
              cachePolicy="memory-disk"
              style={{
                width: '100%',
                height: '100%',
                opacity: imageLoading ? 0 : 1,
              }}
              onLoad={() => setImageLoading(false)}
              onError={(e) => {
                console.log('❌ Image failed:', event_image, e?.error);
                setImageLoading(false);
              }}
            />
          </View>
        ) : null}
      </View>
    </>
  ), [event_image, imageLoading]);

  const renderItem = useCallback(({ item }: { item: Distance }) => {
    const isPast = sourceTab === 'past';
    const isLiveOrUpcoming = sourceTab === 'live' || sourceTab === 'upcoming';
    
    return (
      <View style={[commonStyles.card, { minHeight: 110, marginBottom: spacing.sm, marginHorizontal: spacing.md, marginTop: spacing.md }]}>
        <View style={[detailsStyles.distance]}>
          <View style={detailsStyles.distanceInfo}>
            <Text style={[commonStyles.title, { marginBottom: spacing.xs }]} numberOfLines={2}>
              {item.distance_name}
            </Text>
            <View style={detailsStyles.metaRow}>
              <Ionicons name="calendar-outline" size={14} color={palette.textBody} />
              <Text style={commonStyles.subtitle} numberOfLines={1}>
                {item.race_date_formatted}
              </Text>
            </View>
            <View style={detailsStyles.metaRow}>
              <Ionicons name="time-outline" size={15} color={palette.textBody} />
              <Text style={commonStyles.subtitle} numberOfLines={1}>
                {formatClockTime(item.race_time)}
              </Text>
            </View>
            {showResultsStats && (
              <View style={detailsStyles.metaRow}>
                <Feather name="users" size={16} color={palette.textMuted} />
                <Text style={commonStyles.subtitle} numberOfLines={1}>
                  {item.participant_started_count} {t('details:athletes')}
                </Text>
              </View>
            )}
            {showResultsStats && (
              <View style={detailsStyles.metaRow}>
                <Ionicons name="ribbon-outline" size={15} color={palette.textBody} />
                <Text style={commonStyles.subtitle} numberOfLines={1}>
                  {item.finished_count} {t('details:finished')}
                </Text>
              </View>
            )}
            {showResultsStats && (
              <View style={detailsStyles.metaRow}>
                <Ionicons name="close-circle-outline" size={15} color={palette.textBody} />
                <Text style={commonStyles.subtitlered} numberOfLines={1}>
                  {item.dnf_count} {t('details:dnf')}
                </Text>
              </View>
            )}
            {!isPast && (
              <View style={detailsStyles.metaRow}>
                <MaterialCommunityIcons name="timer-sand" size={15} color={palette.textBody} />
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

          <View style={{ gap: spacing.md }}>
            {showResults && (
              <TouchableOpacity
                style={detailsStyles.resultsButton}
                  onPress={async () => {
                    analyticsService.logInteraction(
                      ANALYTICS_SCREENS.FOLLOWER_EVENT_DETAILS,      // was: not logged
                      ANALYTICS_BUTTONS.RESULT,
                      'tap',
                      { [ANALYTICS_PARAMS.EVENT_NAME]: event_name },
                    );
                    void analyticsService.markAsFollowerActive('view_result');   // was: await
                    navigation.navigate('ResultList', {
                      product_app_id,
                      product_option_value_app_id: Number(item.product_option_value_app_id),
                      event_name: event_name,
                      event_image: event_image,
                      sourceScreen: 'FollowerDistanceScreen',
                      sectionType: 'follower',
                      sourceTab,
                    });
                  }}
                activeOpacity={0.8}
              >
                <Text style={detailsStyles.resultsButtonText}>
                  {t('button.result')}
                </Text>
              </TouchableOpacity>
            )}
            {isLiveOrUpcoming && (
              <TouchableOpacity
                style={detailsStyles.routeButton}
                onPress={async () => {
                  analyticsService.logInteraction(
                    ANALYTICS_SCREENS.FOLLOWER_EVENT_DETAILS,      // was: EVENT_DETAILS
                    ANALYTICS_BUTTONS.ROUTE,                       // was: MAP
                    'tap',
                    { [ANALYTICS_PARAMS.EVENT_NAME]: event_name },
                  );
                  void analyticsService.markAsFollowerActive('view_live_route');  // was: await
                  navigation.navigate('LiveTracking', {
                    product_app_id,
                    product_option_value_app_id: item.product_option_value_app_id || '',
                    event_name: event_name,
                    event_image: event_image,
                    sourceScreen: 'FollowerDistanceScreen',
                    sectionType: 'follower',
                    sourceTab,
                  });
                }}
                activeOpacity={0.8}
              >
                <Text style={detailsStyles.routeButtonText}>
                  {t('button.route')}
                </Text>
              </TouchableOpacity>
            )}

            {/* Visibility rule lives in useGpxDownload.canShowGpxButton so this
                tab and the participant one cannot drift apart. */}
            {canShowGpxButton(item, sourceTab) && (
              <TouchableOpacity
                style={detailsStyles.routeButton}
                onPress={() => handleDownloadGpx(item)}
                activeOpacity={0.8}
              >
                <Text style={detailsStyles.routeButtonText}>
                  {t('details:gpx')}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  }, [navigation, product_app_id, event_name, event_image, sourceTab, t, showResults, showResultsStats, handleDownloadGpx]);

  if (loading) {
    return (
      <View style={[commonStyles.centerContainer, { marginTop: 40 }]}>
        <ActivityIndicator size="large" color={palette.lime} />
      </View>
    );
  }

  if (hasError && !loading) {
    // A TAB, not a screen. The parent screen owns both insets - it renders
    // AppHeader (which carries the status bar) inside its own SafeAreaView with
    // edges={['bottom']}. A SafeAreaView here claimed 'top' a second time and
    // pushed the error state down below the header, so this is a plain View.
    return (
      <View style={commonStyles.container}>
        <StatusBar barStyle="dark-content" />
        <ErrorScreen
          type={error!.type}
          title={error!.title}
          message={error!.message}
          onRetry={() => { clearError(); fetchResults(); }}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {results.length === 0 ? (
        <ErrorScreen type="empty" title={t('result:noResults')} onRetry={() => { }} />
      ) : (
        <FlatList
          data={results}
          extraData={showResults}
          keyExtractor={(item, index) => `${item.product_option_value_app_id}-${index}`}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled={true}
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 0, paddingBottom: spacing.xxxl, paddingTop: 0 }}
          renderItem={renderItem}
          ListHeaderComponent={renderListHeader}
        />
      )}

    </View>
  );
};

export default DistanceTab;