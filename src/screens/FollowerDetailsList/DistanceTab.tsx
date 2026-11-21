import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, ActivityIndicator,
  TouchableOpacity,
  StatusBar,
  Dimensions,
  useWindowDimensions,
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
import { formatEventDate } from '../../utils/dateFormatter';
import { distanceButtonsBelow, detailsHeaderImageLandscape, detailsHeaderImageFit } from '../../utils/screenFit';
import { analyticsService } from '../../services/analyticsService';
import { ANALYTICS_SCREENS, ANALYTICS_BUTTONS, ANALYTICS_PARAMS } from '../../constants/analyticsScreens';
import useGpxDownload, { canShowGpxButton } from '../../hooks/useGpxDownload';
import { distanceButtonKind } from './distanceButton';
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
  // Organiser's per-event Download GPX switch. Undefined on an older payload
  // means on — the column defaults to 1 for every existing event.
  const [showGpx, setShowGpx] = useState<boolean>(true);
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
      setShowGpx(result.event?.show_gpx !== 0);
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

  // ✅ Header image capped in landscape (layout audit 2026-10-22): full width
  // at 612:428 it was ~590pt tall there - taller than the screen. Portrait is
  // unchanged.
  const { width: headerWinWidth, height: headerWinHeight } = useWindowDimensions();
  const headerLandscape = headerWinWidth > headerWinHeight;
  const headerImageHeight = detailsHeaderImageLandscape(headerWinHeight);

  const renderListHeader = useCallback(() => (
    <>
      <View style={{ paddingTop: 2 }}>
        {event_image ? (
          <View
            style={[{
              width: '100%',
              aspectRatio: 612 / 428,
              justifyContent: 'center',
              alignItems: 'center',
            }, headerLandscape && { aspectRatio: undefined, height: headerImageHeight }]}
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
              contentFit={detailsHeaderImageFit(headerLandscape)}
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
  ), [event_image, imageLoading, headerLandscape, headerImageHeight]);

  // Card: margin spacing.md + padding space.lg each side.
  const { width: windowWidth, fontScale } = useWindowDimensions();
  const buttonsBelow = distanceButtonsBelow(windowWidth - 2 * spacing.md - 2 * spacing.lg, fontScale);

  const renderItem = useCallback(({ item }: { item: Distance }) => {
    const isPast = sourceTab === 'past';
    const isLiveOrUpcoming = sourceTab === 'live' || sourceTab === 'upcoming';
    
    return (
      <View style={[commonStyles.card, { minHeight: 110, marginBottom: spacing.sm, marginHorizontal: spacing.md, marginTop: spacing.md }]}>
        {/* ✅ Distance name on its own full-width line, no line limit (layout
            audit 2026-10-22): beside the button column it had ~99-169pt, so a
            single nl word ("Recreatieloop" 141pt, "Wandeltocht" 132pt at 20pt)
            broke mid-word at 360-414pt and long names were cut at 2 lines. */}
        <Text style={[commonStyles.title, { marginBottom: spacing.xs }]}>
          {item.distance_name}
        </Text>
        <View style={[detailsStyles.distance, buttonsBelow && detailsStyles.distanceStacked]}>
          <View style={[detailsStyles.distanceInfo, buttonsBelow && detailsStyles.distanceInfoStacked]}>
            <View style={detailsStyles.metaRow}>
              <Ionicons name="calendar-outline" size={14} color={palette.textBody} />
              <Text style={commonStyles.subtitle}>
                {/* translated month (the API sends English) — client 2026-10-23 */}
                {formatEventDate(item.race_date_formatted, t)}
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
                <Text style={commonStyles.subtitle}>
                  {item.participant_started_count} {t('details:athletes')}
                </Text>
              </View>
            )}
            {showResultsStats && (
              <View style={detailsStyles.metaRow}>
                <Ionicons name="ribbon-outline" size={15} color={palette.textBody} />
                <Text style={commonStyles.subtitle}>
                  {item.finished_count} {t('details:finished')}
                </Text>
              </View>
            )}
            {showResultsStats && (
              <View style={detailsStyles.metaRow}>
                <Ionicons name="close-circle-outline" size={15} color={palette.textBody} />
                <Text style={commonStyles.subtitlered}>
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
          {!buttonsBelow && <View style={detailsStyles.verticalDivider} />}

          <View style={buttonsBelow ? detailsStyles.distanceButtonsBelow : { gap: spacing.md }}>
            {showResults && (
              <TouchableOpacity
                style={[detailsStyles.resultsButton, buttonsBelow && detailsStyles.distanceButtonFull]}
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
                  {/* Participants before race day, Results from race day on (distanceButton.ts).
                      button.result stays as-is: RaceResultScreen still uses it. */}
                  {t(distanceButtonKind(item.race_date, item.countdown?.status) === 'participants'
                    ? 'button.participants'
                    : 'button.results')}
                </Text>
              </TouchableOpacity>
            )}
            {isLiveOrUpcoming && (
              <TouchableOpacity
                style={[detailsStyles.routeButton, buttonsBelow && detailsStyles.distanceButtonFull]}
                onPress={async () => {
                  analyticsService.logInteraction(
                    ANALYTICS_SCREENS.FOLLOWER_EVENT_DETAILS,      // was: EVENT_DETAILS
                    ANALYTICS_BUTTONS.ROUTE,                       // shared 'route' element
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
            {canShowGpxButton(item, sourceTab, showGpx) && (
              <TouchableOpacity
                style={[detailsStyles.routeButton, buttonsBelow && detailsStyles.distanceButtonFull]}
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
  }, [navigation, product_app_id, event_name, event_image, sourceTab, t, showResults, showResultsStats, handleDownloadGpx, showGpx, buttonsBelow]);

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