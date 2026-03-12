import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { colors, commonStyles, spacing } from '../../styles/common.styles';
import { AppHeader } from '../../components/common/AppHeader';
import { BottomNavigation } from '../../components/common/BottomNavigation';
import { detailsStyles } from '../../styles/details.styles';
import { RaceResultScreenprops } from '../../types/navigation';
import { eventDetailService, Distance } from '../../services/eventDetailService';
import { API_CONFIG } from '../../constants/config';

const RaceResultScreen: React.FC<RaceResultScreenprops> = ({ navigation, route }) => {
  const { product_app_id, event_name } = route.params;
  const { t } = useTranslation(['result', 'details', 'common']);

  const [results, setResults] = useState<Distance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ✅ FETCH FINISHED DISTANCES WITH CACHE BUSTING
  const fetchResults = useCallback(
    async (bustCache: boolean = false) => {
      try {
        setLoading(true);
        setError(null);

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
          (d) => d.countdown_type !== 'finisheddd'
        );

        setResults(finished);

        if (API_CONFIG.DEBUG) {
          console.log('✅ Finished distances loaded:', finished.length);
        }
      } catch (err: any) {
        if (API_CONFIG.DEBUG) {
          console.error('❌ Error fetching race results:', err);
        }
        setError(err?.message ?? t('common:errors.generic'));
      } finally {
        setLoading(false);
      }
    },
    [product_app_id, t]
  );

  // ✅ FETCH ON FOCUS (NO CACHE BUST - USE API CACHE)
  useFocusEffect(
    useCallback(() => {
      fetchResults(false);
    }, [fetchResults])
  );

  // ✅ GET COUNTDOWN BADGE (MEMOIZED)
  const getCountdownBadge = useCallback(
    (item: Distance) => {
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
    },
    [t]
  );

  // ✅ RENDER DISTANCE CARD
  const renderItem = useCallback(
    ({ item }: { item: Distance }) => {
      const badge = getCountdownBadge(item);

      return (
        <View
          style={[
            commonStyles.card,
            { padding: 0, overflow: 'hidden', marginBottom: spacing.md },
          ]}
        >
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

          {/* ✅ ACTION BUTTONS */}
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {/* Result Button */}
            <TouchableOpacity
              style={[commonStyles.favoriteButton, { borderRadius: 0, flex: 1 }]}
              onPress={() =>
                navigation.navigate('ResultList', {
                  product_app_id,
                  product_option_value_app_id: Number(item.product_option_value_app_id),
                  event_name: event_name,
                  sourceScreen: 'RaceResultScreen',
                })
              }
              activeOpacity={0.8}
            >
              <Text style={commonStyles.primaryButtonText}>
                {t('result:button.result')}
              </Text>
            </TouchableOpacity>

            {/* Route Button */}
            <TouchableOpacity
              style={[commonStyles.livetracking, { borderRadius: 0, flex: 1 }]}
              onPress={() =>
                navigation.navigate('Route', {
                  product_app_id,
                  product_option_value_app_id: item.product_option_value_app_id || '',
                  event_name: event_name,
                  sourceScreen: 'RaceResultScreen',
                })
              }
              activeOpacity={0.8}
            >
              <Text style={commonStyles.primaryButtonText}>
                {t('result:button.route')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    },
    [navigation, product_app_id, event_name, getCountdownBadge, t]
  );

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
        />
      </SafeAreaView>
    );
  }

  // ✅ ERROR STATE
  if (error) {
    return (
      <SafeAreaView style={commonStyles.container} edges={['top', 'bottom']}>
        <StatusBar barStyle="dark-content" />
        <AppHeader showLogo={false} />
        <View style={commonStyles.centerContainer}>
          <Text style={commonStyles.errorText}>{error}</Text>
          <TouchableOpacity
            style={[commonStyles.primaryButton, { marginTop: spacing.lg }]}
            onPress={() => fetchResults(true)}
            activeOpacity={0.8}
          >
            <Text style={commonStyles.primaryButtonText}>
              {t('result:error.retry')}
            </Text>
          </TouchableOpacity>
        </View>
        <BottomNavigation 
          activeTab="Home" 
          product_app_id={product_app_id}
          event_name={event_name}
        />
      </SafeAreaView>
    );
  }

  // ✅ MAIN CONTENT
  return (
    <SafeAreaView style={commonStyles.container} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" />
      <AppHeader showLogo={false} />

      <View style={detailsStyles.section}>
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
            paddingHorizontal: spacing.lg,
            paddingBottom: 80,
          }}
          renderItem={renderItem}
        />
      )}

      {/* ✅ BOTTOM NAVIGATION - HOME ACTIVE */}
      <BottomNavigation 
        activeTab="Home" 
        product_app_id={product_app_id}
        event_name={event_name}
      />
    </SafeAreaView>
  );
};

export default RaceResultScreen;