import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { commonStyles, spacing, space, palette, fonts, shadows, withAlpha } from '../../styles/common.styles';
import { detailsStyles } from '../../styles/details.styles';
import { AppHeader } from '../../components/common/AppHeader';
import NoticeCard from '../../components/NoticeCard';
import SearchInput from '../../components/SearchInput';
import { analyticsService } from '../../services/analyticsService';
import ConfirmRaceResultModal from './ConfirmRaceResultModal';
import ErrorModal from '../../components/ErrorModal';
import { participantService, Participant } from '../../services/participantService';
import { eventDetailService, RaceResultData } from '../../services/eventDetailService';
import { API_CONFIG } from '../../constants/config';
import { clearPendingRegistration, savePendingRegistration } from '../../hooks/usePendingRegistration';
import { tokenService } from '../../services/tokenService';
import { useAuth } from '../../context/AuthContext';
import RegistrationModal from '../../components/RegistrationModal';
import { classifyCallError, thisIsMeOutcome } from './registrationFlow';
import { getCurrentLanguageId } from '../../i18n';
import ErrorScreen from '../../components/ErrorScreen';
import { useScreenError } from '../../hooks/useApiError';
import { ANALYTICS_PARAMS } from '../../constants/analyticsScreens';
import { MODAL_ORIENTATIONS } from '../../constants/modalOrientations';
import ModalScroll from '../../components/ui/ModalScroll';
import { useCompactDialog } from '../../components/ui';
import { useLandscapeSidePadding, useSafeAreaEdges } from '../../hooks/useLandscapeSidePadding';

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
  const sidePadding = useLandscapeSidePadding();
  const safeEdges = useSafeAreaEdges();   // + Android 3-button landscape sides
  // ✅ Mail-sent popup compact in landscape (device test 2026-10-23): no icon,
  // tighter card. Up here, before the early returns (hooks rule).
  const cd = useCompactDialog();

  const params = route.params as ParticipantResultRouteParams | undefined;
  const product_app_id = params?.product_app_id;
  const product_option_value_app_id = params?.product_option_value_app_id;
  // Display name falls back to a TRANSLATED placeholder ('Event'/'Événement'/
  // 'Evenement'). That is right for the heading and wrong for analytics — it
  // would put three locale-dependent fake race names into the race_name
  // dimension. Analytics uses the raw param, so an absent name is simply
  // omitted by omitEmptyParams.
  const event_name = params?.event_name || t('participantResult:defaultEventName');
  const analyticsRaceName = params?.event_name;

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
  // ✅ Close the screen with the error only when it cannot work at all (missing
  // params). Every error closed it before (audit M5): a Confirm that timed out
  // after the e-mail had gone lost the screen, and the repeat sent another mail.
  const [errorLeaves, setErrorLeaves] = useState(false);

  // ✅ membership_required / limit_reached / membership_upcoming get the
  // membership popup (audit M4) - they used to read "You are already
  // registered for this event", the opposite of the truth.
  const [membershipModal, setMembershipModal] = useState<{
    status: 'membership_required' | 'limit_reached' | 'membership_upcoming';
    limit?: number;
    startDate?: string;
  } | null>(null);

  // ✅ One "This is me" / Confirm call at a time (audit L2): the disabled prop
  // only applies after a re-render.
  const inFlightRef = useRef(false);
  const { logout } = useAuth();

  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const searchInputRef = useRef<any>(null);

  const { error, hasError, handleApiError, clearError } = useScreenError();

  React.useEffect(() => {
    if (!product_app_id || !product_option_value_app_id) {
      showErrorModal(
        'participantResult:error.missingParamsTitle',
        'participantResult:error.missingParamsMessage',
        true
      );
    }
  }, [product_app_id, product_option_value_app_id]);

  const showErrorModal = useCallback((titleKey: string, messageKey: string, leave: boolean = false) => {
    setErrorTitleKey(titleKey);
    setErrorMessageKey(messageKey);
    setErrorLeaves(leave);
    setErrorModalVisible(true);
  }, []);

  // ✅ A 401 is THROWN as session_expired (api.ts) - the 'unauthorized'
  // actions below never arrive (audit H1), and the catch said "network error"
  // with no way out. Same as useRegistrationHandler.handleUnauthorized, and the
  // Connect is kept so the login brings the runner back to this event.
  // Saved AFTER the logout, which clears any pending Connect (see
  // useRegistrationHandler.handleUnauthorized).
  const handleSessionExpired = useCallback(async () => {
    await tokenService.removeToken();
    await logout();
    if (product_app_id && product_option_value_app_id) {
      await savePendingRegistration(product_app_id, product_option_value_app_id, params?.event_name ?? '');
    }
    setTimeout(() => {
      navigation.reset({ index: 0, routes: [{ name: 'LoginScreen' }] });
    }, 50);
  }, [product_app_id, product_option_value_app_id, params?.event_name, logout, navigation]);

  /** Network vs server vs session for a thrown call error. */
  const showCallError = useCallback(async (error: unknown) => {
    const failure = classifyCallError(error);
    if (failure === 'session_expired') {
      await handleSessionExpired();
      return;
    }
    if (failure === 'server') {
      showErrorModal('participantResult:error.registrationFailedTitle', 'participantResult:error.registrationFailedMessage');
    } else {
      showErrorModal('participantResult:error.networkErrorTitle', 'participantResult:error.networkErrorMessage');
    }
  }, [handleSessionExpired, showErrorModal]);

  const invalidateEventCache = useCallback(async () => {
    if (!product_app_id) return;
    try {
      await eventDetailService.getEventDetails(product_app_id, true);
    } catch (error) {
      if (API_CONFIG.DEBUG) console.error('⚠️ Failed to invalidate cache:', error);
    }
  }, [product_app_id]);

  // ✅ The server registered straight away ('registered': an event with no Race
  // Result / table match path inserts at once, also on "This is me" and on the
  // e-mail Confirm). Same success handling as the event screen's confirm:
  // pending Connect cleared, event cache refreshed, runner told, and back to
  // the event, which refetches on focus and shows Undo.
  const handleRegisteredHere = useCallback(async () => {
    setConfirmModalVisible(false);
    setConfirmData(null);
    setSelectedParticipant(null);
    await clearPendingRegistration();
    await invalidateEventCache();
    await analyticsService.markAsParticipant('register');
    void analyticsService.logRegisterStep('completed', undefined, analyticsRaceName);
    // ✅ Alert, not a toast: this text (written for DistanceTab's success popup) needs 9-10 lines on a
    // 320 pt phone at larger text — the toast caps a message at 8 (tests/ui_orientation/group2). The
    // OS draws an Alert in full in both orientations, and it stays up over the event we go back to.
    Alert.alert(t('details:success.label'), t('details:success.message'));
    navigation.goBack();
  }, [invalidateEventCache, analyticsRaceName, t, navigation]);

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

        // Guarded because fetchParticipants is shared by the initial load, the
        // search, and pagination:
        //   pageNum === 1    -> excludes pagination (same search, more pages)
        //   search non-empty -> excludes the mount-time fetchParticipants(1, '')
        // Sends pagination.total (all matches), not participants.length, which is
        // capped at one page. Never the query text.
        if (pageNum === 1 && search.trim().length > 0) {
          // A participant search always happens inside ONE race, so it can be
          // attributed. (The eight cross-event searches must NOT be.)
          void analyticsService.logSearchPerformed(
            'participant',
            result.pagination.total ?? result.participants.length,
            {
              [ANALYTICS_PARAMS.EVENT_NAME]: analyticsRaceName,
              [ANALYTICS_PARAMS.RACE_ID]: product_app_id,
            },
          );
        }
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

      if (inFlightRef.current) return;
      inFlightRef.current = true;

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

        // ✅ Mapping in registrationFlow.thisIsMeOutcome (tested).
        switch (thisIsMeOutcome(action)) {
          case 'confirm':
            // ✅ Show confirm modal in email verification mode
            setConfirmData(result.race_result_data ?? null);
            setConfirmModalVisible(true);
            break;
          case 'registered':
            await handleRegisteredHere();
            break;
          case 'email_sent':
            await clearPendingRegistration();
            setMailSentVisible(true);
            break;
          case 'membership':
            setMembershipModal({
              status: action as 'membership_required' | 'limit_reached' | 'membership_upcoming',
              limit: result.membership_limit,
              startDate: result.membership_start_date,
            });
            break;
          case 'already_registered':
            showErrorModal('participantResult:error.alreadyRegisteredTitle', 'participantResult:error.alreadyRegisteredMessage');
            break;
          case 'invalid_bib':
            showErrorModal('participantResult:error.invalidBibTitle', 'participantResult:error.invalidBibMessage');
            break;
          case 'validation':
            showErrorModal('participantResult:error.validationErrorTitle', 'participantResult:error.validationErrorMessage');
            break;
          default:
            if (action === 'registration_in_progress') {
              showErrorModal('details:error.inProgressTitle', 'details:error.inProgressMessage');
            } else {
              showErrorModal('participantResult:error.registrationFailedTitle', 'participantResult:error.registrationFailedMessage');
            }
            break;
        }
      } catch (error: any) {
        await showCallError(error);
      } finally {
        inFlightRef.current = false;
        setRegisterLoading(false);
        setRegisteringId(null);
      }
    },
    [product_option_value_app_id, showErrorModal, showCallError, handleRegisteredHere]
  );

  // ✅ Step 2: "Confirm" clicked in modal — sends verification email
  const handleConfirmSendEmail = useCallback(async () => {
    if (!confirmData?.bib_number || !product_option_value_app_id) {
      showErrorModal('participantResult:error.invalidDataTitle', 'participantResult:error.invalidDataMessage');
      return;
    }

    if (inFlightRef.current) return;
    inFlightRef.current = true;

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
      } else if (thisIsMeOutcome(action) === 'registered') {
        // ✅ No Race Result path: the server inserted at once (review 2026-11-26).
        await handleRegisteredHere();
      } else if (!isSuccessAction(action)) {
        switch (thisIsMeOutcome(action)) {
          case 'membership':
            // ✅ Same popup as "This is me" (audit M4).
            setConfirmModalVisible(false);
            setMembershipModal({
              status: action as 'membership_required' | 'limit_reached' | 'membership_upcoming',
              limit: result.membership_limit,
              startDate: result.membership_start_date,
            });
            break;
          case 'already_registered':
            setConfirmModalVisible(false);
            showErrorModal('participantResult:error.alreadyRegisteredTitle', 'participantResult:error.alreadyRegisteredMessage');
            break;
          default:
            showErrorModal('participantResult:error.registrationFailedTitle', 'participantResult:error.registrationFailedMessage');
            break;
        }
      }
    } catch (error: any) {
      // ✅ The mail may have gone out before the timeout: the screen stays, and
      // a repeat re-sends the SAME link (insert_participant_app_api, M5).
      await showCallError(error);
    } finally {
      inFlightRef.current = false;
      setRegisterLoading(false);
    }
  }, [confirmData, product_option_value_app_id, showErrorModal, showCallError, handleRegisteredHere]);

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
        <View style={[commonStyles.card, commonStyles.cardAccent, { padding: 0, marginBottom: spacing.lg }]}>
          <View style={detailsStyles.topRow}>
            <View style={detailsStyles.avatarFallback}>
              <Text style={detailsStyles.avatarInitials}>
                {(fullName || '?').split(/\s+/).filter(Boolean).slice(0, 2)
                  .map((n) => n[0]).join('').toUpperCase() || '?'}
              </Text>
            </View>
            <View style={detailsStyles.info}>
              {/* 2 lines (were 1): a 20pt caps name like "SOPHIE DE MEULEMEESTER"
                  and the bib · distance · wave line were cut on every phone
                  (audit 2026-10-22). */}
              <Text style={commonStyles.title} numberOfLines={2}>{fullName}</Text>
              <Text style={detailsStyles.rowMeta} numberOfLines={2}>
                {[
                  hasBibNumber ? `${t('details:tracking.bib')} ${participant.bib_number}` : null,
                  participant.race_distance,
                  participant.wave ? `${t('details:wave')} ${participant.wave}` : null,
                ].filter(Boolean).join(' · ')}
              </Text>
              {/* City + country is one phrase: it wraps rather than being cut. */}
              <Text style={detailsStyles.rowMeta} numberOfLines={2}>
                {[participant.city, participant.country].filter(Boolean).join(' · ')}
              </Text>
            </View>
          </View>

          {isLiveTracking && (
            <View style={detailsStyles.liveTrackingBadge}>
              <Ionicons name="radio" size={14} color={palette.lime} />
              <Text style={detailsStyles.liveTrackingText}>{t('details:tracking.live')}</Text>
            </View>
          )}

          <View style={detailsStyles.cardActionRow}>
          <TouchableOpacity
            style={[
              detailsStyles.cardActionPrimary,
              { opacity: isThisRegistering ? 0.7 : 1 },
            ]}
            onPress={() => handleThisIsMe(participant)}
            disabled={registerLoading}
            activeOpacity={0.8}
          >
            {isThisRegistering ? (
              <ActivityIndicator size="small" color={palette.surface} />
            ) : (
              <Text style={detailsStyles.cardActionPrimaryText}>{t('participantResult:button')}</Text>
            )}
          </TouchableOpacity>
          </View>
        </View>
      );
    },
    [t, handleThisIsMe, registerLoading, registeringId]
  );

  const renderFooter = useCallback(() => {
    if (loadingMore) {
      return (
        <View style={{ paddingVertical: spacing.lg, alignItems: 'center' }}>
          <ActivityIndicator size="small" color={palette.navy} />
          <Text style={{ marginTop: spacing.sm, color: palette.textMuted }}>
            {t('participantResult:loadingMore', { page, totalPages })}
          </Text>
        </View>
      );
    }
    if (hasMorePages() && participants.length > 0) {
      return (
        <View style={{ paddingVertical: spacing.lg, alignItems: 'center' }}>
          <Text style={{ color: palette.textMuted }}>
            {t('participantResult:scrollForMore', { count: participants.length })}
          </Text>
        </View>
      );
    }
    return null;
  }, [loadingMore, page, totalPages, hasMorePages, participants.length, t]);

  if (loading && searchText.length === 0) {
    return (
      <SafeAreaView style={commonStyles.container} edges={safeEdges}>
        <AppHeader title={event_name} showLogo={true} showBack />
        <ActivityIndicator size="large" color={palette.navy} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  // Wrapped like the loading state: the bare ErrorScreen had no header, so
  // there was no back button off this screen (audit 2026-10-22).
  if (hasError && !loading && searchText.length === 0) {
    return (
      <SafeAreaView style={commonStyles.container} edges={safeEdges}>
        <AppHeader title={event_name} showLogo={true} showBack />
        <View style={[{ flex: 1 }, sidePadding]}>
          <ErrorScreen
            type={error!.type}
            title={error!.title}
            message={error!.message}
            onRetry={() => { clearError(); fetchParticipants(1, searchText); }}
          />
        </View>
      </SafeAreaView>
    );
  }

  // The info card scrolls away with the list (it used to sit fixed above it with
  // the search, leaving ~77pt for the list in landscape). The search stays
  // fixed so typing never unmounts it when results switch to the empty state.
  const infoNotice = (
    <NoticeCard
      icon="information-circle-outline"
      title={t('participantResult:info.title')}
      message={t('participantResult:info.message')}
    />
  );

  return (
    <SafeAreaView style={commonStyles.container} edges={safeEdges}>
      <AppHeader title={event_name} showLogo={true} showBack />

      {/* landscape: body kept clear of the notch (AppHeader pads itself) */}
      <View style={[{ flex: 1 }, sidePadding]}>
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: space.md }}>
          <SearchInput
            framed={false}
            ref={searchInputRef}
            placeholder={t('details:participant.search')}
            value={searchText}
            onChangeText={setSearchText}
            icon="search"
          />
        </View>

        {loading && searchText.length > 0 && (
          <View style={{ marginTop: spacing.lg, alignItems: 'center' }}>
            <ActivityIndicator size="small" color={palette.navy} />
            <Text style={{ marginTop: spacing.sm, color: palette.textMuted }}>
              {t('details:participant.searching')}
            </Text>
          </View>
        )}

        {!loading && participants.length === 0 ? (
          <>
            <View style={{ paddingHorizontal: spacing.lg }}>{infoNotice}</View>
            <ErrorScreen
              type="empty"
              title={searchText
                ? `${t('details:participant.noResults')} "${searchText}"`
                : t('details:participant.empty')}
              onRetry={() => { }}
            />
          </>
        ) : (
          <FlatList
            data={participants}
            keyExtractor={(item, index) => `${participantService.getParticipantId(item)}-${index}`}
            renderItem={renderParticipant}
            showsVerticalScrollIndicator={false}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            contentContainerStyle={{
              // The gutter lives HERE, not on the card: renderParticipant's card
              // (above) carries no marginHorizontal, unlike ParticipantCard.tsx,
              // which is a different component used by the Participants tab and
              // brings its own 20pt. Matches the search header's inset at the top
              // of this screen. `marginTop` on a content container alongside
              // flexGrow is unreliable; paddingTop is the predictable form.
              paddingHorizontal: spacing.lg,
              paddingTop: spacing.md,
              paddingBottom: spacing.xxxl,
              flexGrow: 1,
            }}
            keyboardShouldPersistTaps="handled"
            removeClippedSubviews={false}
            ListHeaderComponent={<View style={{ marginBottom: spacing.lg }}>{infoNotice}</View>}
            ListFooterComponent={renderFooter}
          />
        )}
      </View>

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
      <Modal supportedOrientations={MODAL_ORIENTATIONS}
        visible={mailSentVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setMailSentVisible(false)}
      >
        {/* ModalScroll: the card (~494-520pt) was taller than a landscape
            screen — the button was off the bottom (audit 2026-10-22) */}
        <View style={[mailStyles.backdrop, cd.s.wrapper]}>
          <ModalScroll contentStyle={{ alignItems: 'center' }} style={cd.s.scroll} reserve={cd.compact ? 16 : 48}>
            <View style={[mailStyles.card, cd.s.card]}>
              <View style={[mailStyles.iconWrapper, cd.s.hide]}>
                <Ionicons name="mail" size={28} color={palette.navy} />
              </View>
              <Text style={[mailStyles.title, cd.s.title]}>{t('participantResult:mailSent.title')}</Text>
              <Text style={mailStyles.message}>{t('participantResult:mailSent.message')}</Text>
              <TouchableOpacity
                style={[commonStyles.primaryButton, { marginTop: cd.compact ? space.lg : 24 }]}
                onPress={() => {
                  setMailSentVisible(false);
                  navigation.goBack();
                }}
                activeOpacity={0.8}
              >
                <Text style={commonStyles.primaryButtonText}>{t('participantResult:mailSent.button')}</Text>
              </TouchableOpacity>
            </View>
          </ModalScroll>
        </View>
      </Modal>

      <ErrorModal
        visible={errorModalVisible}
        titleKey={errorTitleKey}
        messageKey={errorMessageKey}
        onClose={() => {
          setErrorModalVisible(false);
          if (errorLeaves) navigation.goBack();
        }}
      />

      {/* ✅ Membership answers (audit M4) - the event screen's own popup, so the
          text, and the plans button on iOS, are the ones runners already know. */}
      <RegistrationModal
        visible={membershipModal !== null}
        status={membershipModal?.status ?? null}
        distanceName={event_name}
        membershipLimit={membershipModal?.limit}
        membershipStartDate={membershipModal?.startDate}
        onClose={() => setMembershipModal(null)}
      />
    </SafeAreaView>
  );
};

const mailStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: withAlpha(palette.ink, 0.6),
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: palette.surface,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    maxWidth: 400, // shared modal cap — was full-width in landscape (audit 2026-10-22)
    ...shadows.overlay,
  },
  iconWrapper: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: palette.fill,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconText: {
    fontFamily: fonts.body,
        fontSize: 26,
  },
  title: {
    fontFamily: fonts.display,
        fontSize: 20,
    color: palette.ink,
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    fontFamily: fonts.body,
        fontSize: 14,
    color: palette.textMuted,
    textAlign: 'center',
    lineHeight: 23,
  },
});

export default ParticipantResult;