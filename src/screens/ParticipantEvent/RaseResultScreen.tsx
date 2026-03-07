import React, { useCallback, useState } from 'react';
import {
  View, Text, FlatList, ActivityIndicator,
  TouchableOpacity, StatusBar,
} from 'react-native';
import { SafeAreaView }    from 'react-native-safe-area-context';
import { useFocusEffect }  from '@react-navigation/native';
import { useTranslation }  from 'react-i18next';
import { colors, commonStyles, spacing } from '../../styles/common.styles';
import { AppHeader }       from '../../components/common/AppHeader';
import { BottomNavigation } from '../../components/common/BottomNavigation';
import { detailsStyles }   from '../../styles/details.styles';
import { RaseResultScreenprops } from '../../types/navigation';
import { eventDetailService, Distance } from '../../services/eventDetailService';

const RaseResultScreen: React.FC<RaseResultScreenprops> = ({ navigation, route }) => {
  const { product_app_id, event_name } = route.params;
  const { t } = useTranslation(['reuslt', 'details', 'common']);

  const [results, setResults] = useState<Distance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  // ── Fetch finished distances ───────────────────────────────────────────
  const fetchResults = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await eventDetailService.getEventDetails(product_app_id);
      // Only show distances that are finished
      const finished = result.distances.filter(
        d => d.countdown_type === 'finished'  // ← adjust to match your API value
      );
      setResults(finished);
    } catch (err: any) {
      setError(err?.message ?? t('common:errors.generic'));
    } finally {
      setLoading(false);
    }
  }, [product_app_id]);

  useFocusEffect(useCallback(() => { fetchResults(); }, [fetchResults]));

  // ── Card ───────────────────────────────────────────────────────────────
  const renderItem = useCallback(({ item }: { item: Distance }) => (
    <View style={[commonStyles.card, { padding: 0, overflow: 'hidden', marginBottom: spacing.sm }]}>
      <View style={detailsStyles.distance}>
        <View style={{ flex: 1 }}>
          <Text style={[commonStyles.title, { marginBottom: 4 }]}>
            {item.distance_name}
          </Text>
          <Text style={commonStyles.subtitle}>{item.race_date}</Text>
          <Text style={commonStyles.subtitle}>{item.race_time}</Text>
        </View>
        <View style={[detailsStyles.count, { backgroundColor: colors.success }]}>
          <Text style={[commonStyles.text, { color: '#fff', fontWeight: '600' }]}>
            {t('details:countdown.finished')}
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 6 }}>
        <TouchableOpacity
          style={[commonStyles.favoriteButton, { borderRadius: 0 }]}
          onPress={() => navigation.navigate('ResultList', {
            product_app_id,
            product_option_value_app_id: Number(item.product_option_value_app_id),
          })}
        >
          <Text style={commonStyles.primaryButtonText}>
            {t('reuslt:button.result')}
          </Text>
        </TouchableOpacity>

        {/* Route button */}
        <TouchableOpacity
          style={[commonStyles.livetracking, { borderRadius: 0 }]}
          onPress={() => navigation.navigate('Route', {
            product_app_id,
            product_option_value_app_id: item.product_option_value_app_id || '',
            event_name: item.distance_name,
          })}
        >
          <Text style={commonStyles.primaryButtonText}>
            {t('reuslt:button.route')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  ), [navigation, product_app_id]);

  // ── Loading ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={commonStyles.container} edges={['top']}>
        <StatusBar barStyle="dark-content" />
        <AppHeader showLogo={false} />
        <ActivityIndicator size="large" color={colors.success} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────
  if (error) {
    return (
      <SafeAreaView style={commonStyles.container} edges={['top']}>
        <StatusBar barStyle="dark-content" />
        <AppHeader showLogo={false} />
        <View style={commonStyles.centerContainer}>
          <Text style={commonStyles.errorText}>{error}</Text>
          <TouchableOpacity
            style={[commonStyles.primaryButton, { marginTop: spacing.lg }]}
            onPress={fetchResults}
          >
            <Text style={commonStyles.primaryButtonText}>{t('common:buttons.retry')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Main ───────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={commonStyles.container} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" />
      <AppHeader showLogo={false} />

      <View style={detailsStyles.section}>
        <Text style={commonStyles.title}>{event_name}</Text>
      </View>

      {results.length === 0 ? (
        <View style={{ marginTop: 40, alignItems: 'center' }}>
          <Text style={commonStyles.errorText}>
            {t('reuslt:noResults')}
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

      <BottomNavigation activeTab="Map" />
    </SafeAreaView>
  );
};

export default RaseResultScreen;
