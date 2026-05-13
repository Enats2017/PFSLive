import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  StyleSheet,
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
import ErrorModal from '../../components/ErrorModal';
import { participantService, Participant } from '../../services/participantService';
import { eventDetailService, RaceResultData } from '../../services/eventDetailService';
import { API_CONFIG } from '../../constants/config';
import { clearPendingRegistration } from '../../hooks/usePendingRegistration';
import { getCurrentLanguageId } from '../../i18n';
import ErrorScreen from '../../components/ErrorScreen';
import { useScreenError } from '../../hooks/useApiError';

interface ParticipantResultRouteParams {
  product_app_id: number;
  product_option_value_app_id: number;
  event_name?: string;
}

const SUCCESS_ACTIONS = ['registered', 'confirm_race_result', 'verification_email_sent'];

const isSuccessAction = (action: string): boolean =>
  SUCCESS_ACTIONS.includes(action);

const ParticipantResult = () => {
  const { t } = useTranslation(['details', 'participantResult', 'confirmModal']);
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const params = route.params as ParticipantResultRouteParams | undefined;
  const product_app_id = params?.product_app_id;
  const product_option_value_app_id = params?.product_option_value_app_id;
  const event_name = params?.event_name || t('participantResult:defaultEventName');

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registeringId, setRegisteringId] = useState<string | null>(null);

  // ✅ Confirm modal state
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [confirmData, setConfirmData] = useState<RaceResultData | null>(null);
  const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);

  // ✅ Mail sent modal state
  const [mailSentVisible, setMailSentVisible] = useState(false);

  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorTitleKey, setErrorTitleKey] = useState('');
  const [errorMessageKey, setErrorMessageKey] = useState('');

  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const searchInputRef = useRef<any>(null);

  const { error, hasError, handleApiError, clearError } = useScreenError();

  React.useEffect(() => {
    if (!product_app_id || !product_option_value_app_id) {
      showErrorModal(
        'participantResult:error.missingParamsTitle',
        'participantResult:error.missingParamsMessage'
      );
    }
  }, [product_app_id, product_option_value_app_id]);

  const showErrorModal = useCallback((titleKey: string, messageKey: string) => {
    setErrorTitleKey(titleKey);
    setErrorMessageKey(messageKey);
    setErrorModalVisible(true);
  }, []);

  const invalidateEventCache = useCallback(async () => {
    if (!product_app_id) return;
    try {
      await eventDetailService.getEventDetails(product_app_id, true);
    } catch (error) {
      if (API_CONFIG.DEBUG) console.error('⚠️ Failed to invalidate cache:', error);
    }
  }, [product_app_id]);

  const fetchParticipants = useCallback(
    async (pageNum: number, search: string) => {
      if (!product_app_id) return;
      try {
        if (pageNum === 1 && search.length === 0) {
          setLoading(true);
          clearError();
        } else if (pageNum > 1) {
          setLoadingMore(true);
        }

        const result = await participantService.getParticipants({
          product_app_id,
          page: pageNum,
          filter_name: search,
          product_option_value_app_id,
        });

        setParticipants((prev) => {
          if (pageNum === 1) return result.participants;
          const existingIds = new Set(prev.map((p) => participantService.getParticipantId(p)));
          return [...prev, ...result.participants.filter(
            (p) => !existingIds.has(participantService.getParticipantId(p))
          )];
        });

        setPage(pageNum);
        setTotalPages(result.pagination.total_pages);
      } catch (err: any) {
        if (pageNum === 1) handleApiError(err);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [product_app_id, product_option_value_app_id]
  );

  useFocusEffect(
    useCallback(() => {
      fetchParticipants(1, '');
    }, [fetchParticipants])
  );

  React.useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      fetchParticipants(1, searchText);
    }, 500);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [searchText, fetchParticipants]);

  const hasMorePages = useCallback(() => page < totalPages, [page, totalPages]);

  const handleLoadMore = useCallback(() => {
    if (!hasMorePages() || loadingMore) return;
    fetchParticipants(page + 1, searchText);
  }, [page, totalPages, loadingMore, searchText, hasMorePages, fetchParticipants]);

  // ✅ Step 1: "This is me" clicked — call API with show_confirm_popup=true to get RR data
  const handleThisIsMe = useCallback(
    async (participant: Participant) => {
      if (!product_option_value_app_id) {
        showErrorModal('participantResult:error.missingDataTitle', 'participantResult:error.missingDataMessage');
        return;
      }
      if (!participant.bib_number) {
        showErrorModal('participantResult:error.noBibNumberTitle', 'participantResult:error.noBibNumberMessage');
        return;
      }

      try {
        setRegisterLoading(true);
        setRegisteringId(participantService.getParticipantId(participant));
        setSelectedParticipant(participant);

        const result = await eventDetailService.registerParticipant(
          product_option_value_app_id,
          participant.bib_number,
          getCurrentLanguageId(),
          true // show_confirm_popup = true → returns confirm_race_result
        );

        const action = result.action || 'unknown_error';

        if (action === 'confirm_race_result') {
          // ✅ Show confirm modal in email verification mode
          setConfirmData(result.race_result_data ?? null);
          setConfirmModalVisible(true);
        } else if (!isSuccessAction(action)) {
          switch (action) {
            case 'already_registered':
            case 'membership_required':
            case 'limit_reached':
              showErrorModal('participantResult:error.alreadyRegisteredTitle', 'participantResult:error.alreadyRegisteredMessage');
              break;
            case 'bib_number_invalid':
            case 'not_found_in_race_result':
              showErrorModal('participantResult:error.invalidBibTitle', 'participantResult:error.invalidBibMessage');
              break;
            case 'validation_error':
            case 'missing_parameters':
              showErrorModal('participantResult:error.validationErrorTitle', 'participantResult:error.validationErrorMessage');
              break;
            case 'unauthorized':
            case 'token_invalid':
            case 'token_expired':
              navigation.navigate('LoginScreen');
              break;
            default:
              showErrorModal('participantResult:error.registrationFailedTitle', 'participantResult:error.registrationFailedMessage');
              break;
          }
        }
      } catch (error: any) {
        showErrorModal('participantResult:error.networkErrorTitle', 'participantResult:error.networkErrorMessage');
      } finally {
        setRegisterLoading(false);
        setRegisteringId(null);
      }
    },
    [product_option_value_app_id, navigation, showErrorModal]
  );

  // ✅ Step 2: "Confirm" clicked in modal — sends verification email
  const handleConfirmSendEmail = useCallback(async () => {
    if (!confirmData?.bib_number || !product_option_value_app_id) {
      showErrorModal('participantResult:error.invalidDataTitle', 'participantResult:error.invalidDataMessage');
      return;
    }

    try {
      setRegisterLoading(true);

      // ✅ Call API with send_verification_email=true flag
      const result = await eventDetailService.registerParticipant(
        product_option_value_app_id,
        confirmData.bib_number,
        getCurrentLanguageId(),
        false,
        true // ✅ send_verification_email = true
      );

      const action = result.action || 'unknown_error';

      if (action === 'verification_email_sent') {
        // ✅ Success — close confirm modal, show mail sent modal
        setConfirmModalVisible(false);
        setConfirmData(null);
        setSelectedParticipant(null);
        await clearPendingRegistration();
        setMailSentVisible(true);
      } else if (!isSuccessAction(action)) {
        switch (action) {
          case 'unauthorized':
          case 'token_invalid':
          case 'token_expired':
            navigation.navigate('LoginScreen');
            break;
          default:
            showErrorModal('participantResult:error.registrationFailedTitle', 'participantResult:error.registrationFailedMessage');
            break;
        }
      }
    } catch (error: any) {
      showErrorModal('participantResult:error.networkErrorTitle', 'participantResult:error.networkErrorMessage');
    } finally {
      setRegisterLoading(false);
    }
  }, [confirmData, product_option_value_app_id, navigation, showErrorModal]);

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
        <View style={[commonStyles.card, { padding: 0, marginBottom: spacing.lg }]}>
          <View style={detailsStyles.topRow}>
            <View style={detailsStyles.avatar}>
              <Ionicons name="person-circle-outline" size={55} color="#9ca3af" style={detailsStyles.logo} />
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
                <Text style={[commonStyles.subtitle, { color: colors.primary, fontWeight: '600' }]}>
                  {t('details:tracking.bib')}: {participant.bib_number}
                </Text>
              )}
            </View>
          </View>

          {isLiveTracking && (
            <View style={detailsStyles.liveTrackingBadge}>
              <Ionicons name="radio" size={14} color={colors.success} />
              <Text style={detailsStyles.liveTrackingText}>{t('details:tracking.live')}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[
              commonStyles.primaryButton,
              { borderRadius: 0, opacity: isThisRegistering ? 0.7 : 1, borderBottomLeftRadius: 12, borderBottomRightRadius: 12 },
            ]}
            onPress={() => handleThisIsMe(participant)}
            disabled={registerLoading}
            activeOpacity={0.8}
          >
            {isThisRegistering ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={commonStyles.primaryButtonText}>{t('participantResult:button')}</Text>
            )}
          </TouchableOpacity>
        </View>
      );
    },
    [t, handleThisIsMe, registerLoading, registeringId]
  );

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

  if (loading && searchText.length === 0) {
    return (
      <SafeAreaView style={commonStyles.container} edges={['top']}>
        <AppHeader showLogo={true} />
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  if (hasError && !loading && searchText.length === 0) {
    return (
      <ErrorScreen
        type={error!.type}
        title={error!.title}
        message={error!.message}
        onRetry={() => { clearError(); fetchParticipants(1, searchText); }}
      />
    );
  }

  return (
    <SafeAreaView style={commonStyles.container} edges={['top']}>
      <AppHeader showLogo={true} />

      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
        <Text style={[commonStyles.title, { marginBottom: spacing.sm }]}>{event_name}</Text>

        <View style={{
          backgroundColor: '#FEF3C7',
          borderLeftWidth: 4,
          borderLeftColor: '#F59E0B',
          borderRadius: 8,
          padding: spacing.md,
          marginBottom: spacing.lg,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <Ionicons name="information-circle" size={24} color="#F59E0B" style={{ marginRight: spacing.sm, marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: '#92400E', marginBottom: 4 }}>
                {t('participantResult:info.title')}
              </Text>
              <Text style={{ fontSize: 14, color: '#92400E', lineHeight: 20 }}>
                {t('participantResult:info.message')}
              </Text>
            </View>
          </View>
        </View>

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
          keyExtractor={(item, index) => `${participantService.getParticipantId(item)}-${index}`}
          renderItem={renderParticipant}
          showsVerticalScrollIndicator={false}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingBottom: spacing.xxxl,
            flexGrow: 1,
          }}
          keyboardShouldPersistTaps="handled"
          removeClippedSubviews={false}
          ListFooterComponent={renderFooter}
        />
      )}

      {/* ✅ Confirm modal — email verification mode */}
      <ConfirmRaceResultModal
        visible={confirmModalVisible}
        data={confirmData}
        distanceName={event_name}
        registerLoading={registerLoading}
        emailVerificationMode={true}
        onConfirm={handleConfirmSendEmail}
        onClose={() => {
          setConfirmModalVisible(false);
          setConfirmData(null);
          setSelectedParticipant(null);
        }}
      />

      {/* ✅ Mail sent modal */}
      <Modal
        visible={mailSentVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setMailSentVisible(false)}
      >
        <View style={mailStyles.backdrop}>
          <View style={mailStyles.card}>
            <View style={mailStyles.iconWrapper}>
              <Text style={mailStyles.iconText}>📧</Text>
            </View>
            <Text style={mailStyles.title}>{t('participantResult:mailSent.title')}</Text>
            <Text style={mailStyles.message}>{t('participantResult:mailSent.message')}</Text>
            <TouchableOpacity
              style={[commonStyles.primaryButton, { marginTop: 24 }]}
              onPress={() => {
                setMailSentVisible(false);
                navigation.goBack();
              }}
              activeOpacity={0.8}
            >
              <Text style={commonStyles.primaryButtonText}>{t('participantResult:mailSent.button')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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

const mailStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    width: '100%',
  },
  iconWrapper: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconText: {
    fontSize: 32,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 22,
  },
});

export default ParticipantResult;