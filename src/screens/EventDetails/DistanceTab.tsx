import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StatusBar,
  Linking
} from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { commonStyles, spacing, palette, fonts } from '../../styles/common.styles';
import { detailsStyles } from '../../styles/details.styles';
import { eventDetailService, Distance } from '../../services/eventDetailService';
import RegistrationModal from '../../components/RegistrationModal';
import ConfirmRaceResultModal from './ConfirmRaceResultModal';
import SuccessCelebrationModal from '../../components/SuccessCelebrationModal';
import UndoConfirmModal from '../../components/UndoConfirmModal';
import ErrorModal from '../../components/ErrorModal';
import useRegistrationHandler from '../../services/useRegistrationHandler';
import { useNavigation } from '@react-navigation/native';
import { API_CONFIG } from '../../constants/config';
import { toastSuccess } from '../../../utils/toast';
import ErrorScreen from '../../components/ErrorScreen';
import { useScreenError } from '../../hooks/useApiError';
import { AppHeader } from '../../components/common/AppHeader';
import CountdownBadge from '../../components/CountdownBadge';
import { Ionicons, Feather, MaterialCommunityIcons, AntDesign } from '@expo/vector-icons';
import { formatClockTime } from '../../utils/timeFormat';
import useGpxDownload from '../../hooks/useGpxDownload';
import { analyticsService } from '../../services/analyticsService';
import { ANALYTICS_SCREENS, ANALYTICS_BUTTONS } from '../../constants/analyticsScreens';


interface DistanceTabProps {
  product_app_id: string | number;
  event_name: string;
  event_image?: string | null;
  auto_register_id?: number | null;
  onRefresh?: () => void;
  onResultsAvailability?: (show: boolean) => void;
  onRaceDateAvailable?: (date: string | null) => void; 
}

const DistanceTab = ({
  product_app_id,
  event_name,
  event_image,
  auto_register_id,
  onRefresh,
  onResultsAvailability,
  onRaceDateAvailable,
}: DistanceTabProps) => {
  const { t } = useTranslation(['details']);
  const navigation = useNavigation<any>();
  const [distances, setDistances] = useState<Distance[]>([]);
  const [loading, setLoading] = useState(true);
  const [serverTime, setServerTime] = useState<string>('');
  const [successVisible, setSuccessVisible] = useState(false);
  const [undoModalVisible, setUndoModalVisible] = useState(false);
  const [selectedUndoItem, setSelectedUndoItem] = useState<Distance | null>(null);
  const [pendingRefresh, setPendingRefresh] = useState(false);
  const { downloadGpx, downloadingId } = useGpxDownload();
  const [gpxRestrictedVisible, setGpxRestrictedVisible] = useState(false);
  const [gpxRestrictedItem, setGpxRestrictedItem] = useState<Distance | null>(null);
  const [imageLoading, setImageLoading] = useState(true);
  const [showResults, setShowResults] = useState(false);
  const [showResultsStats, setShowResultsStats] = useState(false);
  const [rrUrl, setRrUrl] = useState<string>('');
  const [eventRegisterUrl, setEventRegisterUrl] = useState<string>('');





  const { error, hasError, handleApiError, clearError } = useScreenError();

  const fetchDistances = useCallback(
    async (bustCache: boolean = false) => {
      try {
        setLoading(true);
        clearError();

        if (API_CONFIG.DEBUG) {
          console.log('📡 Fetching distances for product:', product_app_id, { bustCache });
        }

        const result = await eventDetailService.getEventDetails(product_app_id, bustCache);

        setDistances(result.distances);
        setServerTime(result.server_datetime);

        setRrUrl(result.event?.rr_url ?? '');
      setEventRegisterUrl(result.event?.event_register_url ?? '');

        // Results button/tab only when RR results are published (status 1) AND a URL exists.
        const canShowResults =
          result.event?.show_results === 1;
        
        setShowResults(canShowResults);
        onResultsAvailability?.(canShowResults);
        onRaceDateAvailable?.(result.event?.product_race_date ?? null);

        const canShowResultsStats =
          result.event?.show_results === 1;
        setShowResultsStats(canShowResultsStats);

        if (API_CONFIG.DEBUG) {
          console.log('✅ Distances loaded:', result.distances.length);
        }
      } catch (err: any) {
        if (API_CONFIG.DEBUG) {
          console.error('❌ Error fetching distances:', err);
        }
        handleApiError(err);
      } finally {
        setLoading(false);
      }
    },
    [product_app_id, t]
  );

  // ✅ OPTIMISTICALLY UPDATE DISTANCE STATUS
  const updateDistanceStatus = useCallback(
    (
      product_option_value_app_id: number,
      newStatus: Distance['registration_status'],
      participant_app_id?: number
    ) => {
      setDistances((prev) =>
        prev.map((d) =>
          d.product_option_value_app_id === product_option_value_app_id
            ? {
              ...d,
              registration_status: newStatus,
              participant_app_id: participant_app_id ?? d.participant_app_id,
            }
            : d
        )
      );

      if (API_CONFIG.DEBUG) {
        console.log('🔄 Optimistically updated distance status:', {
          product_option_value_app_id,
          newStatus,
        });
      }
    },
    []
  );

  // ✅ SUCCESS CALLBACK
  const handleSuccess = useCallback(
    async (product_option_value_app_id: number, participant_app_id?: number) => {
      if (API_CONFIG.DEBUG) {
        console.log('🎉 Registration successful');
      }

      updateDistanceStatus(product_option_value_app_id, 'registered', participant_app_id);
      setSuccessVisible(true);
      setPendingRefresh(true);
    },
    [updateDistanceStatus]
  );

  // ✅ DELETE SUCCESS CALLBACK WITH TOAST
  const handleDeleteSuccess = useCallback(
    async (product_option_value_app_id: number) => {
      if (API_CONFIG.DEBUG) {
        console.log('✅ Unregister successful');
      }

      updateDistanceStatus(product_option_value_app_id, 'available');

      toastSuccess(
        t('details:unregister.successTitle'),
        t('details:unregister.successMessage')
      );

      setPendingRefresh(true);

      setTimeout(() => {
        fetchDistances(true);
        onRefresh?.();
        setPendingRefresh(false);
      }, 500);
    },
    [updateDistanceStatus, t, fetchDistances, onRefresh]
  );

  // ✅ HANDLE SUCCESS MODAL CLOSE
  const handleSuccessModalClose = useCallback(() => {
    setSuccessVisible(false);

    if (pendingRefresh) {
      if (API_CONFIG.DEBUG) {
        console.log('🔄 Refreshing after modal close');
      }

      setTimeout(() => {
        fetchDistances(true);
        onRefresh?.();
        setPendingRefresh(false);
      }, 300);
    }
  }, [pendingRefresh, fetchDistances, onRefresh]);

  const {
    modalVisible,
    selectedItem,
    handleModalClose,
    confirmModalVisible,
    confirmData,
    confirmItem,
    handleConfirmModalClose,
    handleConfirmRegister,
    registerLoading,
    errorModalVisible,
    errorTitleKey,
    errorMessageKey,
    handleErrorModalClose,
    handleErrorRetry,
    handleRegister,
    handleDelete,
    liveTrackingModalVisible,
    liveTrackingItem,
    handleConnectClick,
    handleLiveTrackingConfirm,
    handleLiveTrackingClose,
  } = useRegistrationHandler(
    product_app_id,
    event_name,
    () => fetchDistances(true),
    handleSuccess,
    handleDeleteSuccess
  );

  useFocusEffect(
    useCallback(() => {
      fetchDistances(false);
    }, [fetchDistances])
  );

  // ✅ AUTO-REGISTER LOGIC
  useEffect(() => {
    if (!auto_register_id || distances.length === 0 || loading) return;

    if (API_CONFIG.DEBUG) {
      console.log('🔍 Looking for auto-register distance:', auto_register_id);
    }

    const distanceItem = distances.find(
      (d) => d.product_option_value_app_id === auto_register_id
    );

    if (!distanceItem) {
      if (API_CONFIG.DEBUG) {
        console.log('⚠️ Auto-register distance not found');
      }
      return;
    }

    if (API_CONFIG.DEBUG) {
      console.log('✅ Auto-registering for:', distanceItem.distance_name);
    }

    navigation.setParams({ auto_register_id: null });
    handleRegister(distanceItem);
  }, [auto_register_id, distances, loading, handleRegister, navigation]);

  // ✅ GPX CLICK HANDLER — check registration first
    const handleGpxClick = useCallback(
      (item: Distance) => {
        //if (item.registration_status === 'registered') {
          downloadGpx(item);
        //} else {
        //  setGpxRestrictedItem(item);
        //  setGpxRestrictedVisible(true);
        //}
      },
      [downloadGpx]
    );

    const handleDownloadGpx = useCallback(
      (item: Distance) => {
        if (!rrUrl) {
          setGpxRestrictedItem(item);
          setGpxRestrictedVisible(true);
          return;
        }
        downloadGpx(item);
        analyticsService.logInteraction(ANALYTICS_SCREENS.EVENT_DETAILS, ANALYTICS_BUTTONS.DOWNLOAD_GPX);
      },
      
      [downloadGpx, rrUrl]
    );

  const isRegisterMode = useMemo(
    () => !rrUrl && !!eventRegisterUrl,
    [rrUrl, eventRegisterUrl]
  );

const handleExternalRegister = useCallback((url: string) => {
  Linking.openURL(url).catch((err) => {
    if (API_CONFIG.DEBUG) {
      console.error('❌ Failed to open register URL:', err);
    }
  });
}, []);

  // ✅ MAP CLICK HANDLER — open the live map for this distance
  const handleMapClick = useCallback(
    async (item: Distance) => {
      analyticsService.logInteraction(
        ANALYTICS_SCREENS.EVENT_DETAILS,     // correct as is — participant side
        ANALYTICS_BUTTONS.MAP,
      );

      void analyticsService.markAsFollowerActive('view_live_route');  // was: await

      navigation.navigate('LiveTracking', {
        product_app_id: Number(product_app_id),
        product_option_value_app_id: Number(item.product_option_value_app_id),
        event_name,
        sourceScreen: 'EventDetails',
        sectionType: 'participant',
        sourceTab: 'live',
      });
    },
    [navigation, product_app_id, event_name],
  );

  // ✅ UNDO HANDLER
  const handleUndoClick = useCallback((item: Distance) => {
    if (API_CONFIG.DEBUG) {
      console.log('🔄 Undo clicked for:', item.distance_name);
    }
    setSelectedUndoItem(item);
    setUndoModalVisible(true);
  }, []);

  // ✅ CONFIRM UNDO
  const handleConfirmUndo = useCallback(async () => {
    if (!selectedUndoItem) return;

    if (API_CONFIG.DEBUG) {
      console.log('✅ Confirming undo for:', selectedUndoItem.distance_name);
    }

    setUndoModalVisible(false);
    await handleDelete(selectedUndoItem);
    setSelectedUndoItem(null);
  }, [selectedUndoItem, handleDelete]);

  React.useEffect(() => {
    setImageLoading(true);
  }, [event_image]);


  const renderListHeader = useCallback(() => {
    const isAnyRegistered = distances.some(
      (d) => d.registration_status === 'registered'
    );
    return (
      <View>
        {event_image ? (
          <View style={{ width: '100%', aspectRatio: 612 / 428, justifyContent: 'center', alignItems: 'center',}}>
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
                aspectRatio: 612 / 428,
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

        <View style={detailsStyles.infoBox}>
          <View style={detailsStyles.infoIconWrapper}>
            <AntDesign name="link" size={20} color={palette.ink} />
          </View>
          <Text style={detailsStyles.infoBoxText}>
            {t('details:connectInfo')}
          </Text>
        </View>

      </View>
    );
  }, [event_name, event_image, distances, imageLoading]);

  const renderItem = useCallback(({ item }: { item: Distance }) => {
    const isRegistering =
      registerLoading &&
      (confirmItem?.product_option_value_app_id === item.product_option_value_app_id ||
        selectedItem?.product_option_value_app_id === item.product_option_value_app_id);

    return (
      <View style={[commonStyles.card, { minHeight: 110, marginBottom: spacing.md, marginHorizontal: spacing.md }]}>
        <View style={detailsStyles.distance}>
          <View style={detailsStyles.distanceInfo}>
            <Text style={[commonStyles.title, { marginBottom: spacing.xs }]} numberOfLines={2}>
              {item.distance_name}
            </Text>

            <View style={detailsStyles.metaRow}>
              <Ionicons name="calendar-outline" size={14} color={palette.textBody} />
              <Text style={detailsStyles.metaText} numberOfLines={1}>
                {item.race_date_formatted}
              </Text>
            </View>

            <View style={detailsStyles.metaRow}>
              <Ionicons name="time-outline" size={15} color={palette.textBody} />
              <Text style={detailsStyles.metaText} numberOfLines={1}>
                {formatClockTime(item.race_time)}
              </Text>
            </View>

            {showResultsStats && (
              <View style={detailsStyles.metaRow}>
                <Feather name="users" size={16} color={palette.textMuted} />
                <Text style={detailsStyles.metaText} numberOfLines={1}>
                  {item.participant_started_count} {t('details:athletes')}
                </Text>
              </View>
            )}

            {showResultsStats && (
              <View style={detailsStyles.metaRow}>
                <Ionicons name="ribbon-outline" size={15} color={palette.textBody} />
                <Text style={detailsStyles.metaText} numberOfLines={1}>
                  {item.finished_count} {t('details:finished')}
                </Text>
              </View>
            )}

            {showResultsStats && (
              <View style={detailsStyles.metaRow}>
                <Ionicons name="close-circle-outline" size={15} color={palette.textBody} />
                <Text style={detailsStyles.metaTextRed} numberOfLines={1}>
                  {item.dnf_count} {t('details:dnf')}
                </Text>
              </View>
            )}

            <View style={detailsStyles.metaRow}>
              <MaterialCommunityIcons name="timer-sand" size={15} color={palette.textBody} />
              <CountdownBadge
                days={item.countdown.days}
                hours={item.countdown.hours}
                minutes={item.countdown.minutes}
                status={item.countdown.status}
              />
            </View>
          </View>
          <View style={detailsStyles.verticalDivider} />

          <View style={{ gap: spacing.sm }} >
            <TouchableOpacity
                style={[detailsStyles.resultsButton]}
                onPress={() => {
                  if (isRegisterMode) {
                    handleExternalRegister(eventRegisterUrl);
                    return;
                  }
                  item.registration_status === 'registered'
                    ? handleUndoClick(item)
                    : handleConnectClick(item);
                }}
                disabled={isRegistering}
                activeOpacity={0.8}
              >
              {isRegistering ? (
                <ActivityIndicator size="small" color={palette.surface} />
              ) : (
                <Text style={detailsStyles.resultsButtonText}>
                {item.registration_status === 'registered'
                  ? t('details:undo')
                  : isRegisterMode
                    ? t('details:register')
                    : t('details:button')}
              </Text>
              )}
            </TouchableOpacity>

            {/* ✅ GPX button ALWAYS visible */}
            <TouchableOpacity
              style={detailsStyles.routeButton}
              //onPress={() => handleGpxClick(item)}
              onPress={() => handleDownloadGpx(item)}
              activeOpacity={0.8}
            >
              <Text style={detailsStyles.routeButtonText}>
                {t('details:gpx')}
              </Text>
            </TouchableOpacity>

            {/* ✅ MAP button — live tracking map for this distance */}
            <TouchableOpacity
              style={detailsStyles.routeButton}
              onPress={() => handleMapClick(item)}
              activeOpacity={0.8}
            >
              <Text style={detailsStyles.routeButtonText}>
                {t('details:map')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }, [CountdownBadge, handleConnectClick, handleUndoClick, handleMapClick, handleGpxClick, handleDownloadGpx, handleExternalRegister, eventRegisterUrl, registerLoading, confirmItem, selectedItem, t, showResults, showResultsStats, isRegisterMode]);

  if (loading) {
    return (
      <ActivityIndicator size="large" color={palette.navy} style={{ marginTop: 40 }} />
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
          onRetry={() => { clearError(); fetchDistances(); }}
        />
      </View>
    );
  }

  if (distances.length === 0) {
    return (
      <ErrorScreen type="empty" title={t('details:distance.empty')} onRetry={() => { }} />
    );
  }

  return (
    <>
      <FlatList
        data={distances}
        extraData={showResults}
        keyExtractor={(item, index) => `${item.product_option_value_app_id}-${index}`}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled={true}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 48, }}
        renderItem={renderItem}
        ListHeaderComponent={renderListHeader}
      />

      <RegistrationModal
        visible={modalVisible}
        status={selectedItem?.registration_status ?? null}
        distanceName={selectedItem?.distance_name ?? ''}
        membershipLimit={selectedItem?.membership_limit}
        membershipStartDate={selectedItem?.membership_start_date}
        onClose={handleModalClose}
      />

      <ConfirmRaceResultModal
        visible={confirmModalVisible}
        data={confirmData}
        distanceName={confirmItem?.distance_name ?? ''}
        registerLoading={registerLoading}
        onConfirm={handleConfirmRegister}
        onClose={handleConfirmModalClose}
      />

      <SuccessCelebrationModal
        visible={successVisible}
        message={t('details:success.message')}
        onClose={handleSuccessModalClose}
        title={t('details:success.label')}
      />

      <UndoConfirmModal
        visible={undoModalVisible}
        distanceName={selectedUndoItem?.distance_name ?? ''}
        onConfirm={handleConfirmUndo}
        onClose={() => {
          setUndoModalVisible(false);
          setSelectedUndoItem(null);
        }}
      />

      <ErrorModal
        visible={errorModalVisible}
        titleKey={errorTitleKey}
        messageKey={errorMessageKey}
        onClose={handleErrorModalClose}
        onRetry={handleErrorRetry}
      />

     <ErrorModal
        visible={gpxRestrictedVisible}
        titleKey="details:gpxRestricted.noResultsTitle"
        messageKey="details:gpxRestricted.noResultsMessage"
        onClose={() => {
          setGpxRestrictedVisible(false);
          setGpxRestrictedItem(null);
        }}
      />
      <RegistrationModal
        visible={liveTrackingModalVisible}
        status="connect_confirm"
        distanceName={liveTrackingItem?.distance_name ?? ''}
        onClose={handleLiveTrackingClose}
        onConfirm={handleLiveTrackingConfirm}
      />
    </>
  );
};

export default DistanceTab;