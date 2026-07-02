import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  StatusBar,
  Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { colors, commonStyles, spacing } from '../../styles/common.styles';
import { AppHeader } from '../../components/common/AppHeader';
import { BottomNavigation } from '../../components/common/BottomNavigation';
import { detailsStyles } from '../../styles/details.styles';
import { RaceResultScreenprops } from '../../types/navigation';
import { eventDetailService, Distance } from '../../services/eventDetailService';
import { API_CONFIG } from '../../constants/config';
import ErrorScreen from '../../components/ErrorScreen';
import { useScreenError } from '../../hooks/useApiError';
import { Ionicons, Feather } from '@expo/vector-icons';
import { formatClockTime } from '../../utils/timeFormat';
import { useDimensions } from '../../hooks/useDimensions';

const RaceResultScreen: React.FC<RaceResultScreenprops> = ({ navigation, route }) => {
  const { product_app_id, event_name, event_image } = route.params;
  const { t } = useTranslation(['result', 'details', 'common']);
  const { width: windowWidth, height } = useDimensions();
  const insets = useSafeAreaInsets();
  const [containerWidth, setContainerWidth] = useState(0);
  const isGestureNav = insets.bottom > 0;
  const isLandscape = windowWidth > height;
  const width = containerWidth || windowWidth;


  const [results, setResults] = useState<Distance[]>([]);
  const [loading, setLoading] = useState(true);
  //const [error, setError] = useState<string | null>(null);
  const { error, hasError, handleApiError, clearError } = useScreenError();

  // ✅ FETCH FINISHED DISTANCES WITH CACHE BUSTING
  const fetchResults = useCallback(
    async (bustCache: boolean = false) => {
      try {
        setLoading(true);
        clearError();

        if (API_CONFIG.DEBUG) {
          console.log('📡 Fetching race results for:', product_app_id, {
            bustCache,
          });
        }

        const result = await eventDetailService.getEventDetails(
          product_app_id,
          bustCache
        );

        // ✅ FILTER ONLY FINISHED DISTANCES
        const finished = result.distances.filter(
          (d) => d.countdown.status !== 'finisheddd'
        );

        setResults(finished);

        if (API_CONFIG.DEBUG) {
          console.log('✅ Finished distances loaded:', finished.length);
        }
      } catch (err: any) {
        if (API_CONFIG.DEBUG) {
          console.error('❌ Error fetching race results:', err);
        }
        handleApiError(err);
      } finally {
        setLoading(false);
      }
    },
    [product_app_id, t]
  );

  // FETCH ON FOCUS (NO CACHE BUST - USE API CACHE)
  useFocusEffect(
    useCallback(() => {
      fetchResults(false);
    }, [fetchResults])
  );

  const renderListHeader = useCallback(() => (
    <View style={{marginBottom: spacing.md}}>
      {event_image ? (
        <Image
          source={{ uri: event_image }}
          style={{
            width: '100%',
            aspectRatio: 612 / 300,
            
          }}
          resizeMode="cover"
        />
      ) : null}
    </View>
  ), [event_name, event_image]);


  const renderItem = useCallback(({ item }: { item: Distance }) => {
    return (
      <View style={[commonStyles.card, { minHeight: 110, marginBottom: spacing.md, marginHorizontal: spacing.md }]}>
        <View style={detailsStyles.distance}>
          <View style={detailsStyles.distanceInfo}>
            <Text style={[commonStyles.title, { marginBottom: spacing.xs }]} numberOfLines={2}>
              {item.distance_name}
            </Text>
            <View style={detailsStyles.metaRow}>
              <Ionicons name="calendar-outline" size={14} color={colors.gray600} />
              <Text style={detailsStyles.metaText} numberOfLines={1}>
                {item.race_date_formatted}
              </Text>
            </View>
            <View style={detailsStyles.metaRow}>
              <Ionicons name="time-outline" size={15} color={colors.gray600} />
              <Text style={detailsStyles.metaText} numberOfLines={1}>
                {formatClockTime(item.race_time)}
              </Text>
            </View>
            <View style={detailsStyles.metaRow}>
              <Feather name="users" size={16} color={colors.gray500} />
              <Text style={detailsStyles.metaText} numberOfLines={1}>
                {item.participant_started_count} {t('details:athletes')}
              </Text>
            </View>
            <View style={detailsStyles.metaRow}>
              <Ionicons name="ribbon-outline" size={15} color={colors.gray600} />
              <Text style={detailsStyles.metaText} numberOfLines={1}>
                {item.finished_count} {t('details:finished')}
              </Text>
            </View>
            <View style={detailsStyles.metaRow}>
              <Ionicons name="close-circle-outline" size={15} color={colors.gray600} />
              <Text style={detailsStyles.metaText} numberOfLines={1}>
                {item.dnf_count} {t('details:dnf')}
              </Text>
            </View>
          </View>
          <View style={detailsStyles.verticalDivider} />
          <TouchableOpacity
            style={detailsStyles.resultsButton}
            onPress={() =>
              navigation.navigate('ResultList', {
                product_app_id,
                product_option_value_app_id: Number(item.product_option_value_app_id),
                event_name: event_name,
                event_image: event_image,
                sourceScreen: 'RaceResultScreen',
                sectionType: 'participant',
                sourceTab: 'past',
              })
            }
            activeOpacity={0.8}
          >
            <Text style={commonStyles.primaryButtonText}>
              {t('button.result')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }, [navigation, product_app_id, t]);

  // ✅ LOADING STATE
  if (loading) {
    return (
      <SafeAreaView style={commonStyles.container} edges={['top', 'bottom']}>
        <StatusBar barStyle="dark-content" />
        <AppHeader showLogo={false} />
        <View style={commonStyles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
        <BottomNavigation
          activeTab="Home"
          product_app_id={product_app_id}
          event_name={event_name}
          event_image={event_image}
        />
      </SafeAreaView>
    );
  }

  // ✅ ERROR STATE
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
        <BottomNavigation
          activeTab="Home"
          product_app_id={product_app_id}
          event_name={event_name}
          event_image={event_image}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={commonStyles.container} edges={isLandscape && !isGestureNav ? ['top', 'left', 'right'] : ['top', 'bottom']}>
      <StatusBar barStyle="dark-content" />
      <AppHeader showLogo={false} />

      <View style={[detailsStyles.section]}>
        <Text style={commonStyles.title}>{event_name}</Text>
      </View>

      {results.length === 0 ? (
        <View style={{ marginTop: 40, alignItems: 'center', paddingHorizontal: spacing.lg }}>
          <Text style={commonStyles.errorText}>{t('result:noResults')}</Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item, index) =>
            `${item.product_option_value_app_id}-${index}`
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            flexGrow: 1,
          
            paddingBottom: 80,
          }}
          ListHeaderComponent={renderListHeader}
          renderItem={renderItem}
        />
      )}

      {/* ✅ BOTTOM NAVIGATION - HOME ACTIVE */}
      <BottomNavigation
        activeTab="Home"
        product_app_id={product_app_id}
        event_name={event_name}
        event_image={event_image}
      />
    </SafeAreaView>
  );
};

export default RaceResultScreen;