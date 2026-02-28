import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { commonStyles, spacing, colors } from '../../styles/common.styles';
import { detailsStyles } from '../../styles/details.styles';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import SearchInput from '../../components/SearchInput';
import { LinearGradient } from 'expo-linear-gradient';
import { participantService, Participant } from '../../services/participantService';
import { eventDetailService, Distance, RaceResultData } from '../../services/eventDetailService';
import { API_CONFIG } from '../../constants/config';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader } from '../../components/common/AppHeader';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ConfirmRaceResultModal from './ConfirmRaceResultModal';
import SuccessCelebrationModal from '../../components/SuccessCelebrationModal';


//Types 

interface ParticipantSearchRouteParams {
  product_app_id: string | number;
  item: Distance;
}

// ─── Component ────────────────────────────────────────────────────────────────

const ParticipantResult = () => {
  const { t } = useTranslation(['details']);
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { product_app_id, item } = route.params as ParticipantSearchRouteParams;
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registeringId, setRegisteringId] = useState<string | null>(null);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const searchInputRef = useRef<any>(null);
  const onEndReachedCalledDuringMomentum = useRef(true);
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [confirmData, setConfirmData] = useState<RaceResultData | null>(null);
  const [isFirstTracking, setIsFirstTracking] = useState(0);
  const [successVisible, setSuccessVisible] = useState(false);




  // ─── Fetch on focus
  useFocusEffect(
    useCallback(() => {
      fetchParticipants(1, '');
    }, [product_app_id])
  );

  // ─── Debounce search 
  React.useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    debounceTimer.current = setTimeout(() => {
      fetchParticipants(1, searchText);
    }, 500);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [searchText]);

  // ─── Fetch participants ───────────────────────────────────────────────────
  const fetchParticipants = async (pageNum: number, search: string) => {
    try {
      if (pageNum === 1 && search.length === 0) {
        setLoading(true);
        setError(null);
      } else if (pageNum > 1) {
        setLoadingMore(true);
      }

      if (API_CONFIG.DEBUG) {
        console.log(`📡 Fetching participants page ${pageNum}`);
      }

      const result = await participantService.getParticipants(
        product_app_id,
        pageNum,
        search
      );

      setParticipants(prev => {
        if (pageNum === 1) return result.participants;

        const existingIds = new Set(prev.map(p => participantService.getParticipantId(p)));
        const newItems = result.participants.filter(p =>
          !existingIds.has(participantService.getParticipantId(p))
        );

        if (API_CONFIG.DEBUG) {
          console.log(`Added ${newItems.length} new participants (Total: ${prev.length + newItems.length})`);
        }

        return [...prev, ...newItems];
      });

      setPage(pageNum);
      setTotalPages(result.pagination.total_pages);

      if (API_CONFIG.DEBUG) {
        console.log(`📄 Page ${pageNum}/${result.pagination.total_pages} | Total: ${result.pagination.total}`);
      }
    } catch (err: any) {
      if (API_CONFIG.DEBUG) {
        console.error('Error fetching participants:', err?.message);
      }
      if (pageNum === 1) {
        setError(err?.message ?? t('details:error.title'));
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // ─── Has more pages 
  const hasMorePages = (): boolean => page < totalPages;

  // ─── Load more 
  const handleLoadMore = useCallback(() => {
    if (API_CONFIG.DEBUG) {
      console.log('🔄 onEndReached fired', {
        momentumFlag: onEndReachedCalledDuringMomentum.current,
        hasMore: hasMorePages(),
        loading: loadingMore,
        currentPage: page,
        totalPages,
      });
    }

    if (onEndReachedCalledDuringMomentum.current) return;
    if (!hasMorePages()) return;
    if (loadingMore) return;

    onEndReachedCalledDuringMomentum.current = true;
    fetchParticipants(page + 1, searchText);
  }, [page, totalPages, loadingMore, searchText]);

  const handleThisIsMe = useCallback(async (participant: Participant) => {
    if (!participant.bib_number) {
      Alert.alert("Error", "This participant has no bib number.");
      return;
    }

    try {
      setRegisterLoading(true);
      setRegisteringId(participantService.getParticipantId(participant));

      const result = await eventDetailService.registerParticipant(
        item.product_option_value_app_id,
      );

      if (result.action === "confirm_race_result") {
        setConfirmData(result.race_result_data ?? null);
        setIsFirstTracking(result.is_first_tracking);
        setConfirmModalVisible(true);
      }

      if (result.action === "registered") {
        await AsyncStorage.multiRemove([
          "pending_product_app_id",
          "pending_option_value_app_id"
        ]);

        navigation.goBack();
      }

    } catch (err: any) {
      Alert.alert("Registration Failed", err?.message ?? "Please try again.");
    } finally {
      setRegisterLoading(false);
      setRegisteringId(null);
    }

  }, [item, navigation, product_app_id]);

  const handleConfirmRegister = async () => {
    if (!confirmData?.bib_number) return;

    try {
      setRegisterLoading(true);

      const result = await eventDetailService.registerParticipant(
        item.product_option_value_app_id,
        confirmData.bib_number
      );

      if (result.action === "registered") {
        setConfirmModalVisible(false);

        await AsyncStorage.multiRemove([
          "pending_product_app_id",
          "pending_option_value_app_id"
        ]);
        setSuccessVisible(true);

      }

    } catch (err: any) {
      Alert.alert("Confirmation Failed", err?.message ?? "Please try again.");
    } finally {
      setRegisterLoading(false);
    }
  };

  // ─── Render participant ───────────────────────────────────────────────────
  const renderParticipant = useCallback(({ item: participant }: { item: Participant }) => {
    const fullName = `${participant.firstname ?? ''} ${participant.lastname ?? ''}`.trim().toUpperCase() || t('details:participant.unknownName');
    const hasBibNumber = participant.bib_number && participant.bib_number.trim() !== '';
    const isLiveTracking = participant.live_tracking_activated === 1;
    const isThisRegistering =
      registerLoading &&
      registeringId === participantService.getParticipantId(participant);

    return (
      <View style={[commonStyles.card, { padding: 0, overflow: 'hidden', marginBottom: spacing.lg }]}>
        <View style={detailsStyles.topRow}>
          <View style={detailsStyles.avatar}>
            <Ionicons
              name="person-circle-outline"
              size={55}
              color="#9ca3af"
              style={detailsStyles.logo}
            />
          </View>
          <LinearGradient
            colors={['#e8341a', '#f4a100', '#1a73e8']}
            start={{ x: 0, y: 1 }}
            end={{ x: 1, y: 0 }}
            style={detailsStyles.divider}
          />
          <View style={detailsStyles.info}>
            <Text style={commonStyles.title}>{fullName}</Text>
            <Text style={commonStyles.text}>{participant.city} | {participant.country}</Text>
            <Text style={commonStyles.subtitle}>{participant.race_distance}</Text>
            {hasBibNumber && (
              <Text style={[commonStyles.subtitle, { color: colors.primary, fontWeight: '600' }]}>
                {t('details:tracking.bib')}: {participant.bib_number}
              </Text>
            )}
          </View>
        </View>

        {isLiveTracking && (
          <View style={detailsStyles.liveTrackingBadge}>
            <Ionicons name="radio" size={14} color={colors.success} />
            <Text style={detailsStyles.liveTrackingText}>
              {t('details:tracking.live')}
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[commonStyles.primaryButton, { opacity: isThisRegistering ? 0.7 : 1 }]}
          onPress={() => handleThisIsMe(participant)}
          disabled={registerLoading}
        >
          {isThisRegistering ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={commonStyles.primaryButtonText}>Registered</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  }, [t, handleThisIsMe, registerLoading, registeringId]);

  // ─── Loading state ────────────────────────────────────────────────────────
  if (loading && searchText.length === 0) {
    return (
      <SafeAreaView style={commonStyles.container}>
        <AppHeader />
        <ActivityIndicator size="large" color="#FF5722" style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  // ─── Error state ──────────────────────────────────────────────────────────
  if (error && searchText.length === 0) {
    return (
      <SafeAreaView style={commonStyles.container}>
        <AppHeader />
        <View style={commonStyles.centerContainer}>
          <Text style={commonStyles.errorText}>{error}</Text>
          <TouchableOpacity
            style={[commonStyles.primaryButton, { marginTop: spacing.lg }]}
            onPress={() => fetchParticipants(1, searchText)}
          >
            <Text style={commonStyles.primaryButtonText}>
              {t('details:error.retry')}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Main render ──────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={commonStyles.container}>
      <AppHeader />

      <View style={{ paddingHorizontal: spacing.lg }}>
        <SearchInput
          ref={searchInputRef}
          placeholder={t('details:participant.search')}
          value={searchText}
          onChangeText={setSearchText}
          icon="search"
        />
      </View>

      {loading && searchText.length > 0 && (
        <View style={{ marginTop: spacing.lg, alignItems: 'center' }}>
          <ActivityIndicator size="small" color="#FF5722" />
          <Text style={{ marginTop: spacing.sm, color: colors.gray500 }}>
            {t('details:participant.searching')}
          </Text>
        </View>
      )}

      {!loading && participants.length === 0 ? (
        <View style={{ marginTop: 40, paddingHorizontal: spacing.lg }}>
          <Text style={commonStyles.errorText}>
            {searchText
              ? `${t('details:participant.noResults')} "${searchText}"`
              : t('details:participant.empty')
            }
          </Text>
        </View>
      ) : (
        <FlatList
          data={participants}
          keyExtractor={(item, index) => `${participantService.getParticipantId(item)}-${index}`}
          renderItem={renderParticipant}
          showsVerticalScrollIndicator={false}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          onMomentumScrollBegin={() => {
            onEndReachedCalledDuringMomentum.current = false;
            if (API_CONFIG.DEBUG) console.log('🔄 Scroll momentum began - flag reset');
          }}
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingBottom: spacing.xxxl,
          }}
          keyboardShouldPersistTaps="handled"
          ListFooterComponent={
            loadingMore ? (
              <View style={{ paddingVertical: spacing.lg, alignItems: 'center' }}>
                <ActivityIndicator size="small" color="#FF5722" />
                <Text style={{ marginTop: spacing.sm, color: colors.gray500 }}>
                  Loading more... ({page}/{totalPages})
                </Text>
              </View>
            ) : hasMorePages() && participants.length > 0 ? (
              <View style={{ paddingVertical: spacing.lg, alignItems: 'center' }}>
                <Text style={{ color: colors.gray500 }}>
                  Scroll for more ({participants.length} loaded)
                </Text>
              </View>
            ) : null
          }
        />
      )}
      <ConfirmRaceResultModal
        visible={confirmModalVisible}
        data={confirmData}
        distanceName={item?.distance_name ?? ""}
        registerLoading={registerLoading}
        onConfirm={handleConfirmRegister}
        onClose={() => setConfirmModalVisible(false)}
      />
      <SuccessCelebrationModal
        visible={successVisible}
        message="Thank you for signing up for the live tracking of this event. Tell your family and friends to follow you here and don't forget to activate your live tracking from 1 hour before the start of your race in this app!"
        onClose={() => {
          setSuccessVisible(false);
          navigation.goBack(); // 👈 go back AFTER modal closes
        }}
      />
    </SafeAreaView>
  );
};

export default ParticipantResult;