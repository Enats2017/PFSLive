import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { commonStyles, spacing, colors } from '../../styles/common.styles';
import { detailsStyles } from '../../styles/details.styles';
import { AppHeader } from '../../components/common/AppHeader';
import SearchInput from '../../components/SearchInput';
import ConfirmRaceResultModal from './ConfirmRaceResultModal';
import SuccessCelebrationModal from '../../components/SuccessCelebrationModal';
import ErrorModal from '../../components/ErrorModal';
import { participantService, Participant } from '../../services/participantService';
import { eventDetailService, RaceResultData } from '../../services/eventDetailService';
import { API_CONFIG } from '../../constants/config';
import { clearPendingRegistration } from '../../hooks/usePendingRegistration';
import { getCurrentLanguageId } from '../../i18n';

// ✅ TYPES
interface ParticipantResultRouteParams {
  product_app_id: number;
  product_option_value_app_id: number;
  event_name?: string;
}

// ✅ DEFINE SUCCESS ACTIONS
const SUCCESS_ACTIONS = ['registered', 'confirm_race_result'];

// ✅ CHECK IF ACTION IS SUCCESS
const isSuccessAction = (action: string): boolean => {
  return SUCCESS_ACTIONS.includes(action);
};

const ParticipantResult = () => {
  const { t } = useTranslation(['details', 'participantResult']);
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  // ✅ SAFE PARAMS EXTRACTION
  const params = route.params as ParticipantResultRouteParams | undefined;
  const product_app_id = params?.product_app_id;
  const product_option_value_app_id = params?.product_option_value_app_id;
  const event_name = params?.event_name || t('participantResult:defaultEventName');

  // ✅ STATE
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registeringId, setRegisteringId] = useState<string | null>(null);
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [confirmData, setConfirmData] = useState<RaceResultData | null>(null);
  const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);
  const [isFirstTracking, setIsFirstTracking] = useState(0);
  const [successVisible, setSuccessVisible] = useState(false);
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorTitleKey, setErrorTitleKey] = useState('');
  const [errorMessageKey, setErrorMessageKey] = useState('');

  // ✅ REFS
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const searchInputRef = useRef<any>(null);
  const onEndReachedCalledDuringMomentum = useRef(true);

  // ✅ VALIDATE PARAMS ON MOUNT
  React.useEffect(() => {
    if (!product_app_id || !product_option_value_app_id) {
      if (API_CONFIG.DEBUG) {
        console.error('❌ Missing required params:', {
          product_app_id,
          product_option_value_app_id,
        });
      }
      showErrorModal(
        'participantResult:error.missingParamsTitle',
        'participantResult:error.missingParamsMessage'
      );
    }
  }, [product_app_id, product_option_value_app_id]);

  // ✅ SHOW ERROR MODAL
  const showErrorModal = useCallback((titleKey: string, messageKey: string) => {
    setErrorTitleKey(titleKey);
    setErrorMessageKey(messageKey);
    setErrorModalVisible(true);
  }, []);

  // ✅ INVALIDATE EVENT DETAIL CACHE
  const invalidateEventCache = useCallback(async () => {
    if (!product_app_id) return;

    try {
      if (API_CONFIG.DEBUG) {
        console.log('🗑️ Invalidating event detail cache for:', product_app_id);
      }

      await eventDetailService.getEventDetails(product_app_id, true);

      if (API_CONFIG.DEBUG) {
        console.log('✅ Event detail cache invalidated');
      }
    } catch (error) {
      if (API_CONFIG.DEBUG) {
        console.error('⚠️ Failed to invalidate cache (non-critical):', error);
      }
    }
  }, [product_app_id]);

  // ✅ FETCH PARTICIPANTS
  const fetchParticipants = useCallback(
    async (pageNum: number, search: string) => {
      if (!product_app_id) return;

      try {
        if (pageNum === 1 && search.length === 0) {
          setLoading(true);
          setError(null);
        } else if (pageNum > 1) {
          setLoadingMore(true);
        }

        if (API_CONFIG.DEBUG) {
          console.log(`📡 Fetching participants page ${pageNum}`, {
            product_app_id,
            search: search || '(none)',
          });
        }

        const result = await participantService.getParticipants(
          product_app_id,
          pageNum,
          search
        );

        setParticipants((prev) => {
          if (pageNum === 1) return result.participants;

          const existingIds = new Set(
            prev.map((p) => participantService.getParticipantId(p))
          );
          const newItems = result.participants.filter(
            (p) => !existingIds.has(participantService.getParticipantId(p))
          );

          if (API_CONFIG.DEBUG) {
            console.log(
              `✅ Added ${newItems.length} new participants (Total: ${
                prev.length + newItems.length
              })`
            );
          }

          return [...prev, ...newItems];
        });

        setPage(pageNum);
        setTotalPages(result.pagination.total_pages);

        if (API_CONFIG.DEBUG) {
          console.log(
            `📄 Page ${pageNum}/${result.pagination.total_pages} | Total: ${result.pagination.total}`
          );
        }
      } catch (err: any) {
        if (API_CONFIG.DEBUG) {
          console.error('❌ Error fetching participants:', err?.message);
        }
        if (pageNum === 1) {
          setError(err?.message ?? t('details:error.title'));
        }
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [product_app_id, t]
  );

  // ✅ FETCH ON FOCUS
  useFocusEffect(
    useCallback(() => {
      fetchParticipants(1, '');
    }, [fetchParticipants])
  );

  // ✅ DEBOUNCED SEARCH
  React.useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    debounceTimer.current = setTimeout(() => {
      fetchParticipants(1, searchText);
    }, 500);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [searchText, fetchParticipants]);

  // ✅ HAS MORE PAGES
  const hasMorePages = useCallback((): boolean => {
    return page < totalPages;
  }, [page, totalPages]);

  // ✅ LOAD MORE
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
  }, [page, totalPages, loadingMore, searchText, hasMorePages, fetchParticipants]);

  // ✅ HANDLE "THIS IS ME" CLICK (CHECK ACTION FIELD)
  const handleThisIsMe = useCallback(
    async (participant: Participant) => {
      if (!product_option_value_app_id) {
        showErrorModal(
          'participantResult:error.missingDataTitle',
          'participantResult:error.missingDataMessage'
        );
        return;
      }

      if (!participant.bib_number) {
        showErrorModal(
          'participantResult:error.noBibNumberTitle',
          'participantResult:error.noBibNumberMessage'
        );
        return;
      }

      try {
        setRegisterLoading(true);
        setRegisteringId(participantService.getParticipantId(participant));
        setSelectedParticipant(participant);

        if (API_CONFIG.DEBUG) {
          console.log('📝 Initial registration check for participant:', {
            bib_number: participant.bib_number,
            product_option_value_app_id,
          });
        }

        // ✅ CALL WITHOUT BIB NUMBER FIRST
        const result = await eventDetailService.registerParticipant(
          product_option_value_app_id
        );

        if (API_CONFIG.DEBUG) {
          console.log('✅ API Response:', {
            success: result.success,
            action: result.action,
          });
        }

        const action = result.action || 'unknown_error';

        // ✅ CHECK IF NOT A SUCCESS ACTION
        if (!isSuccessAction(action)) {
          if (API_CONFIG.DEBUG) {
            console.log('⚠️ Non-success action received:', action);
          }

          // ✅ HANDLE ERRORS
          switch (action) {
            case 'already_registered':
            case 'membership_required':
            case 'limit_reached':
              showErrorModal(
                'participantResult:error.alreadyRegisteredTitle',
                'participantResult:error.alreadyRegisteredMessage'
              );
              break;

            case 'bib_number_invalid':
              showErrorModal(
                'participantResult:error.invalidBibTitle',
                'participantResult:error.invalidBibMessage'
              );
              break;

            case 'validation_error':
            case 'product_app_id_invalid':
            case 'missing_parameters':
              showErrorModal(
                'participantResult:error.validationErrorTitle',
                'participantResult:error.validationErrorMessage'
              );
              break;

            case 'unauthorized':
            case 'token_invalid':
            case 'token_expired':
              navigation.navigate('LoginScreen');
              break;

            default:
              showErrorModal(
                'participantResult:error.registrationFailedTitle',
                'participantResult:error.registrationFailedMessage'
              );
              break;
          }
          return;
        }

        // ✅ HANDLE SUCCESS ACTIONS
        if (action === 'confirm_race_result') {
          if (API_CONFIG.DEBUG) {
            console.log('📋 Showing confirmation modal');
          }
          setConfirmData(result.race_result_data ?? null);
          setIsFirstTracking(result.is_first_tracking || 0);
          setConfirmModalVisible(true);
        } else if (action === 'registered') {
          if (API_CONFIG.DEBUG) {
            console.log('✅ Directly registered');
          }
          await clearPendingRegistration();

          setTimeout(() => {
            invalidateEventCache();
          }, 1000);

          setSuccessVisible(true);
        }
      } catch (error: any) {
        // ✅ NETWORK/CRITICAL ERRORS
        if (API_CONFIG.DEBUG) {
          console.error('❌ Network error:', error);
        }
        showErrorModal(
          'participantResult:error.networkErrorTitle',
          'participantResult:error.networkErrorMessage'
        );
      } finally {
        setRegisterLoading(false);
        setRegisteringId(null);
      }
    },
    [product_option_value_app_id, navigation, showErrorModal, invalidateEventCache]
  );

  // ✅ HANDLE CONFIRM REGISTER (CHECK ACTION FIELD)
  const handleConfirmRegister = useCallback(async () => {
    if (!confirmData?.bib_number || !product_option_value_app_id) {
      showErrorModal(
        'participantResult:error.invalidDataTitle',
        'participantResult:error.invalidDataMessage'
      );
      return;
    }

    try {
      setRegisterLoading(true);

      if (API_CONFIG.DEBUG) {
        console.log('✅ Confirming registration with bib:', confirmData.bib_number);
      }

      // ✅ CALL WITH BIB NUMBER
      const result = await eventDetailService.registerParticipant(
        product_option_value_app_id,
        confirmData.bib_number,
        getCurrentLanguageId()
      );

      if (API_CONFIG.DEBUG) {
        console.log('✅ Confirmation API Response:', {
          success: result.success,
          action: result.action,
        });
      }

      const action = result.action || 'unknown_error';

      // ✅ CHECK IF NOT A SUCCESS ACTION
      if (!isSuccessAction(action)) {
        if (API_CONFIG.DEBUG) {
          console.error('❌ Confirmation failed with action:', action);
        }

        switch (action) {
          case 'bib_number_invalid':
            showErrorModal(
              'participantResult:error.invalidBibTitle',
              'participantResult:error.invalidBibMessage'
            );
            break;

          case 'unauthorized':
          case 'token_invalid':
          case 'token_expired':
            navigation.navigate('LoginScreen');
            break;

          default:
            showErrorModal(
              'participantResult:error.confirmationFailedTitle',
              'participantResult:error.confirmationFailedMessage'
            );
            break;
        }
        return;
      }

      // ✅ SUCCESS
      if (action === 'registered') {
        if (API_CONFIG.DEBUG) {
          console.log('✅ Registration confirmed successfully');
        }

        setConfirmModalVisible(false);
        setConfirmData(null);
        await clearPendingRegistration();

        setTimeout(() => {
          invalidateEventCache();
        }, 1000);

        setSuccessVisible(true);
      } else {
        showErrorModal(
          'participantResult:error.confirmationFailedTitle',
          'participantResult:error.confirmationFailedMessage'
        );
      }
    } catch (error: any) {
      // ✅ NETWORK ERRORS
      if (API_CONFIG.DEBUG) {
        console.error('❌ Network error:', error);
      }
      showErrorModal(
        'participantResult:error.networkErrorTitle',
        'participantResult:error.networkErrorMessage'
      );
    } finally {
      setRegisterLoading(false);
    }
  }, [confirmData, product_option_value_app_id, navigation, showErrorModal, invalidateEventCache]);

  // ✅ RENDER PARTICIPANT ITEM
  const renderParticipant = useCallback(
    ({ item: participant }: { item: Participant }) => {
      const fullName =
        `${participant.firstname ?? ''} ${participant.lastname ?? ''}`
          .trim()
          .toUpperCase() || t('details:participant.unknownName');
      const hasBibNumber = participant.bib_number && participant.bib_number.trim() !== '';
      const isLiveTracking = participant.live_tracking_activated === 1;
      const isThisRegistering =
        registerLoading &&
        registeringId === participantService.getParticipantId(participant);

      return (
        <View
          style={[
            commonStyles.card,
            { padding: 0, overflow: 'hidden', marginBottom: spacing.lg },
          ]}
        >
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
              <Text style={commonStyles.text}>
                {participant.city} | {participant.country}
              </Text>
              <Text style={commonStyles.subtitle}>{participant.race_distance}</Text>
              {hasBibNumber && (
                <Text
                  style={[
                    commonStyles.subtitle,
                    { color: colors.primary, fontWeight: '600' },
                  ]}
                >
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
            style={[
              commonStyles.primaryButton,
              { borderRadius: 0, opacity: isThisRegistering ? 0.7 : 1 },
            ]}
            onPress={() => handleThisIsMe(participant)}
            disabled={registerLoading}
            activeOpacity={0.8}
          >
            {isThisRegistering ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={commonStyles.primaryButtonText}>
                {t('participantResult:button')}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      );
    },
    [t, handleThisIsMe, registerLoading, registeringId]
  );

  // ✅ RENDER FOOTER
  const renderFooter = useCallback(() => {
    if (loadingMore) {
      return (
        <View style={{ paddingVertical: spacing.lg, alignItems: 'center' }}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={{ marginTop: spacing.sm, color: colors.gray500 }}>
            {t('participantResult:loadingMore', { page, totalPages })}
          </Text>
        </View>
      );
    }

    if (hasMorePages() && participants.length > 0) {
      return (
        <View style={{ paddingVertical: spacing.lg, alignItems: 'center' }}>
          <Text style={{ color: colors.gray500 }}>
            {t('participantResult:scrollForMore', { count: participants.length })}
          </Text>
        </View>
      );
    }

    return null;
  }, [loadingMore, page, totalPages, hasMorePages, participants.length, t]);

  // ✅ LOADING STATE
  if (loading && searchText.length === 0) {
    return (
      <SafeAreaView style={commonStyles.container} edges={['top']}>
        <AppHeader showLogo={true} />
        <ActivityIndicator
          size="large"
          color={colors.primary}
          style={{ marginTop: 40 }}
        />
      </SafeAreaView>
    );
  }

  // ✅ ERROR STATE
  if (error && searchText.length === 0) {
    return (
      <SafeAreaView style={commonStyles.container} edges={['top']}>
        <AppHeader showLogo={true} />
        <View style={commonStyles.centerContainer}>
          <Text style={commonStyles.errorText}>{error}</Text>
          <TouchableOpacity
            style={[commonStyles.primaryButton, { marginTop: spacing.lg }]}
            onPress={() => fetchParticipants(1, searchText)}
            activeOpacity={0.8}
          >
            <Text style={commonStyles.primaryButtonText}>
              {t('details:error.retry')}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ✅ MAIN RENDER
  return (
    <SafeAreaView style={commonStyles.container} edges={['top']}>
      <AppHeader showLogo={true} />

      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
        <Text style={[commonStyles.title, { marginBottom: spacing.sm }]}>
          {event_name}
        </Text>
        <Text style={[commonStyles.subtitle, { marginBottom: spacing.md }]}>
          {t('participantResult:subtitle')}
        </Text>

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
          <ActivityIndicator size="small" color={colors.primary} />
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
              : t('details:participant.empty')}
          </Text>
        </View>
      ) : (
        <FlatList
          data={participants}
          keyExtractor={(item, index) =>
            `${participantService.getParticipantId(item)}-${index}`
          }
          renderItem={renderParticipant}
          showsVerticalScrollIndicator={false}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          onMomentumScrollBegin={() => {
            onEndReachedCalledDuringMomentum.current = false;
            if (API_CONFIG.DEBUG)
              console.log('🔄 Scroll momentum began - flag reset');
          }}
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingBottom: spacing.xxxl,
          }}
          keyboardShouldPersistTaps="handled"
          ListFooterComponent={renderFooter}
        />
      )}

      <ConfirmRaceResultModal
        visible={confirmModalVisible}
        data={confirmData}
        distanceName={event_name}
        registerLoading={registerLoading}
        onConfirm={handleConfirmRegister}
        onClose={() => {
          setConfirmModalVisible(false);
          setConfirmData(null);
        }}
      />

      <SuccessCelebrationModal
        visible={successVisible}
        message={t('details:success.message')}
        onClose={() => {
          setSuccessVisible(false);
          navigation.goBack();
        }}
      />

      <ErrorModal
        visible={errorModalVisible}
        titleKey={errorTitleKey}
        messageKey={errorMessageKey}
        onClose={() => {
          setErrorModalVisible(false);
          navigation.goBack();
        }}
      />
    </SafeAreaView>
  );
};

export default ParticipantResult;