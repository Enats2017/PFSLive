import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Alert,
  Image,
  AppState,
  ActivityIndicator,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import axios from 'axios';

// Local imports
import { HomeScreenProps } from '../types/navigation';
import { AppHeader } from '../components/common/AppHeader';
import { UpdateRequiredModal } from '../components/UpdateRequiredModal';
import { toastSuccess, toastError } from '../../utils/toast';
import { locationService } from '../services/locationService';
import { gpsService } from '../services/gpsService';
import { locationQueueService } from '../services/locationQueueService';
import { tokenService } from '../services/tokenService';
import { versionService } from '../services/versionService';
import { API_CONFIG, getApiEndpoint } from '../constants/config';

// Styles
import { colors, spacing, typography, commonStyles } from '../styles/common.styles';
import { homeStyles } from '../styles/home.styles';

// Types
interface StandardApiResponse<T = any> {
  success: boolean;
  data: T;
  error: string | null;
}

interface UpdateInfo {
  isForced: boolean;
  currentVersion: string;
  latestVersion: string;
  title: string;
  message: string;
  updateUrl: string;
}

interface HomeData {
  next_race_participant_app_id?: string;
  next_race_id?: string;
  next_race_name?: string;
  next_race_date?: string;
  next_race_time?: string;
  next_race_interval_for_location?: number | string;
  show_start_track?: number;
  manual_start?: number;
  server_datetime?: string;
  timezone?: string;
}

const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const { t } = useTranslation(['home', 'common']);

  // Core states
  const [homeData, setHomeData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasToken, setHasToken] = useState(false);

  // Tracking states
  const [isGPSActive, setIsGPSActive] = useState(false);
  const [isSendingData, setIsSendingData] = useState(false);
  const [locationUpdateCount, setLocationUpdateCount] = useState(0);
  const [queuedCount, setQueuedCount] = useState(0);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [hasPermission, setHasPermission] = useState(false);
  const [raceStartTime, setRaceStartTime] = useState<Date | null>(null);
  const [sendingInterval, setSendingInterval] = useState(30);
  const [timeUntilRace, setTimeUntilRace] = useState<string>('');
  const [serverTimeOffset, setServerTimeOffset] = useState<number>(0);

  // Version check states
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);

  // Refs
  const gpsWatchRef = useRef<{ remove: () => void } | null>(null);
  const queueProcessorRef = useRef<NodeJS.Timeout | null>(null);
  const raceStartCheckRef = useRef<NodeJS.Timeout | null>(null);
  const appState = useRef(AppState.currentState);
  const raceStartTimeRef = useRef<Date | null>(null);
  const isGPSActiveRef = useRef<boolean>(false);
  const serverTimeOffsetRef = useRef<number>(0);

  // Derived values
  const participantId = homeData?.next_race_participant_app_id || null;
  const eventId = homeData?.next_race_id || null;

  // ==================== UTILITIES ====================

  const getServerTime = useCallback((): Date => {
    const deviceTime = new Date();
    return new Date(deviceTime.getTime() + serverTimeOffsetRef.current);
  }, []);

  const formatDate = useCallback((dateString: string): string => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;

      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();

      return `${day}-${month}-${year}`;
    } catch (error) {
      return dateString;
    }
  }, []);

  const hasRaceStarted = useCallback((): boolean => {
    if (homeData?.manual_start === 1) return true;
    if (!raceStartTimeRef.current) return false;

    const now = getServerTime();
    const raceTime = raceStartTimeRef.current;

    if (API_CONFIG.DEBUG) {
      console.log('🕐 Server time (now):', now.toLocaleString());
      console.log('🏁 Race time:', raceTime.toLocaleString());
      console.log('✅ Race started?', now >= raceTime);
    }

    return now >= raceTime;
  }, [homeData?.manual_start, getServerTime]);

  // ==================== VERSION CHECK ====================

  const checkAppVersion = useCallback(async () => {
    try {
      if (API_CONFIG.DEBUG) console.log('🔍 Checking app version...');

      const result = await versionService.checkVersion();

      if (result.needsUpdate) {
        setUpdateInfo({
          isForced: result.isForced,
          currentVersion: result.currentVersion,
          latestVersion: result.latestVersion,
          title: result.title,
          message: result.message,
          updateUrl: result.updateUrl,
        });
        setShowUpdateModal(true);

        if (API_CONFIG.DEBUG) {
          console.log('⚠️ Update available:', {
            forced: result.isForced,
            current: result.currentVersion,
            latest: result.latestVersion,
          });
        }
      } else {
        if (API_CONFIG.DEBUG) console.log('✅ App is up to date');
      }
    } catch (error) {
      if (API_CONFIG.DEBUG) console.error('❌ Version check failed:', error);
    }
  }, []);

  const handleUpdate = useCallback(() => {
    if (updateInfo?.updateUrl) {
      versionService.openStore(updateInfo.updateUrl);
    }
  }, [updateInfo]);

  const handleLater = useCallback(() => {
    if (!updateInfo?.isForced) {
      setShowUpdateModal(false);
    }
  }, [updateInfo]);

  // ==================== DATA FETCHING ====================

  const checkPermissions = useCallback(async () => {
    const hasPerms = await gpsService.hasPermissions();
    setHasPermission(hasPerms);
  }, []);

  const loadQueueSize = useCallback(async () => {
    const size = await locationQueueService.getQueueSize();
    setQueuedCount(size);
  }, []);

  const initializeScreen = useCallback(async () => {
    try {
      setLoading(true);

      const token = await tokenService.getToken();
      setHasToken(!!token);

      if (token) {
        await Promise.all([
          fetchHomeData(),
          checkPermissions(),
          loadQueueSize(),
        ]);
      } else {
        if (API_CONFIG.DEBUG) console.log('⚠️ No token - clearing home data');
        setHomeData(null);
      }
    } catch (error) {
      if (API_CONFIG.DEBUG) console.error('❌ Error initializing screen:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchHomeData = useCallback(async () => {
    try {
      const token = await tokenService.getToken();

      if (!token) {
        if (API_CONFIG.DEBUG) console.log('⚠️ No token - skipping fetch');
        setHasToken(false);
        setHomeData(null);
        setLoading(false);
        return;
      }

      setHasToken(true);

      const headers = await API_CONFIG.getHeaders();

      if (API_CONFIG.DEBUG) console.log('📤 Fetching home data');

      const response = await axios.get<StandardApiResponse>(
        getApiEndpoint(API_CONFIG.ENDPOINTS.HOME),
        { headers, timeout: API_CONFIG.TIMEOUT }
      );

      if (response.data.success && response.data.data) {
        setHomeData(response.data.data);

        // Calculate server time offset
        if (response.data.data.server_datetime) {
          try {
            const serverTimeString = response.data.data.server_datetime.replace(' ', 'T');
            const serverTime = new Date(serverTimeString);
            const deviceTime = new Date();
            const offset = serverTime.getTime() - deviceTime.getTime();

            setServerTimeOffset(offset);
            serverTimeOffsetRef.current = offset;

            if (API_CONFIG.DEBUG) {
              console.log('🖥️ Server time:', serverTime.toLocaleString());
              console.log('📱 Device time:', deviceTime.toLocaleString());
              console.log('⏱️ Time offset:', (offset / 1000).toFixed(2), 'seconds');
            }
          } catch (error) {
            if (API_CONFIG.DEBUG) console.error('Error calculating offset:', error);
          }
        }
      }
    } catch (error: any) {
      if (API_CONFIG.DEBUG) console.error('❌ Error fetching home data:', error.message);

      if (error?.response?.status === 401) {
        if (API_CONFIG.DEBUG) console.log('🚨 Session expired - redirecting to login');
        setHasToken(false);
        setHomeData(null);
        tokenService.removeToken();
        //navigation.navigate('LoginScreen');
      }
    } finally {
      setLoading(false);
    }
  }, [navigation]);

  // ==================== GPS TRACKING ====================

  const calculateTimeUntilRace = useCallback(() => {
    if (homeData?.manual_start === 1) {
      setTimeUntilRace(t('home:status.manualStartReady'));
      return;
    }

    if (!raceStartTimeRef.current) {
      setTimeUntilRace('');
      return;
    }

    try {
      const now = getServerTime();
      const raceTime = raceStartTimeRef.current;
      const diff = raceTime.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeUntilRace('Race started!');
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeUntilRace(`${hours}h ${minutes}m ${seconds}s`);
    } catch (error) {
      if (API_CONFIG.DEBUG) console.error('Error calculating time:', error);
      setTimeUntilRace('');
    }
  }, [homeData?.manual_start, getServerTime, t]);

  const startQueueProcessor = useCallback(() => {
    if (queueProcessorRef.current || !participantId || !eventId) return;

    queueProcessorRef.current = setInterval(async () => {
      try {
        const sentCount = await locationService.processQueue(participantId, eventId);
        if (sentCount > 0) {
          setLocationUpdateCount(prev => prev + sentCount);
          await loadQueueSize();

          if (API_CONFIG.DEBUG) {
            toastSuccess(
              t('home:tracking.queueProcessed'),
              t('home:tracking.queuedSent', { count: sentCount })
            );
          }
        }
      } catch (error) {
        // Silent fail
      }
    }, 60000);
  }, [participantId, eventId, loadQueueSize, t]);

  const startRaceStartChecker = useCallback(() => {
    if (raceStartCheckRef.current) return;

    raceStartCheckRef.current = setInterval(() => {
      if (hasRaceStarted() && !isSendingData) {
        setIsSendingData(true);

        if (API_CONFIG.DEBUG) {
          toastSuccess(t('home:tracking.raceStarted'), t('home:tracking.nowSending'));
        }
      }
    }, 30000);
  }, [hasRaceStarted, isSendingData, t]);

  const startGPSTracking = useCallback(async () => {
    try {
      if (!participantId || !eventId) {
        toastError(t('home:errors.missingInfo'), t('home:errors.missingInfoDescription'));
        return;
      }

      if (!hasPermission) {
        const granted = await gpsService.requestPermissions();
        if (!granted) {
          toastError(t('home:errors.permissionRequired'), t('home:errors.permissionDescription'));
          return;
        }
        setHasPermission(true);
      }

      await fetchHomeData();
      await new Promise(resolve => setTimeout(resolve, 500));

      // Parse race start time
      if (homeData?.next_race_date && homeData?.next_race_time) {
        try {
          const dateTimeString = `${homeData.next_race_date}T${homeData.next_race_time}`;
          const raceTime = new Date(dateTimeString);

          if (!isNaN(raceTime.getTime())) {
            setRaceStartTime(raceTime);
            raceStartTimeRef.current = raceTime;

            if (API_CONFIG.DEBUG) {
              console.log('✅ Parsed Race Time:', raceTime.toLocaleString());
              const now = getServerTime();
              const diff = raceTime.getTime() - now.getTime();
              console.log('⏰ Hours until race:', (diff / (1000 * 60 * 60)).toFixed(2));
            }
          }
        } catch (error) {
          if (API_CONFIG.DEBUG) console.error('❌ Error parsing race time:', error);
        }
      } else {
        setRaceStartTime(null);
        raceStartTimeRef.current = null;
      }

      // Get sending interval
      let intervalValue = 30;
      if (homeData?.next_race_interval_for_location) {
        const rawInterval = homeData.next_race_interval_for_location;
        const parsed = typeof rawInterval === 'number' ? rawInterval : parseInt(String(rawInterval));
        if (!isNaN(parsed) && parsed > 0) intervalValue = parsed;
      }
      setSendingInterval(intervalValue);

      setIsGPSActive(true);
      isGPSActiveRef.current = true;

      const initialGPS = await gpsService.getCurrentPosition();
      setCurrentLocation({
        lat: initialGPS.latitude,
        lon: initialGPS.longitude,
      });

      const raceAlreadyStarted = hasRaceStarted();
      if (raceAlreadyStarted) setIsSendingData(true);

      const gpsWatch = await gpsService.startWatchingPosition(
        async (gpsPosition) => {
          if (!isGPSActiveRef.current) {
            if (API_CONFIG.DEBUG) console.log('GPS inactive - skipping send');
            return;
          }

          setCurrentLocation({
            lat: gpsPosition.latitude,
            lon: gpsPosition.longitude,
          });

          const shouldSend = hasRaceStarted();

          if (shouldSend) {
            if (!isSendingData) {
              setIsSendingData(true);
              if (API_CONFIG.DEBUG) {
                toastSuccess(t('home:tracking.raceStarted'), t('home:tracking.nowSending'));
              }
            }

            const locationData = gpsService.convertToLocationData(gpsPosition);

            if (!participantId || !eventId) return;

            try {
              const response = await locationService.sendLocation(
                participantId,
                eventId,
                locationData,
                true
              );

              if (response.success) {
                setLocationUpdateCount(prev => prev + 1);
              }

              await loadQueueSize();
            } catch (error) {
              await loadQueueSize();
            }
          }
        },
        () => {
          toastError(t('home:errors.gpsError'), t('home:errors.gpsErrorDescription'));
        },
        intervalValue
      );

      gpsWatchRef.current = gpsWatch;

      startQueueProcessor();

      if (homeData?.manual_start !== 1) {
        startRaceStartChecker();
      }

      let message = '';
      if (homeData?.manual_start === 1) {
        message = t('home:tracking.manualStartEnabled');
      } else if (raceAlreadyStarted) {
        message = t('home:tracking.dataSendingStarted');
      } else if (raceStartTimeRef.current) {
        message = t('home:tracking.waitingForRace');
      } else {
        message = t('home:tracking.waitingForRaceNoTime');
      }

      toastSuccess(t('home:tracking.gpsActivated'), message);
    } catch (error) {
      Alert.alert(
        t('common:errors.generic'),
        error instanceof Error ? error.message : t('home:errors.trackingFailed')
      );
      setIsGPSActive(false);
      isGPSActiveRef.current = false;
    }
  }, [
    participantId,
    eventId,
    hasPermission,
    homeData,
    fetchHomeData,
    getServerTime,
    hasRaceStarted,
    isSendingData,
    loadQueueSize,
    startQueueProcessor,
    startRaceStartChecker,
    t,
  ]);

  const stopGPSTracking = useCallback(() => {
    if (gpsWatchRef.current) {
      gpsWatchRef.current.remove();
      gpsWatchRef.current = null;
    }

    if (queueProcessorRef.current) {
      clearInterval(queueProcessorRef.current);
      queueProcessorRef.current = null;
    }

    if (raceStartCheckRef.current) {
      clearInterval(raceStartCheckRef.current);
      raceStartCheckRef.current = null;
    }

    setIsGPSActive(false);
    isGPSActiveRef.current = false;
    setIsSendingData(false);
    setCurrentLocation(null);

    toastSuccess(
      t('home:tracking.gpsStopped'),
      t('home:tracking.trackingStopped', {
        sent: locationUpdateCount,
        queued: queuedCount,
      })
    );

    setLocationUpdateCount(0);
  }, [locationUpdateCount, queuedCount, t]);

  const manualStartSending = useCallback(() => {
    Alert.alert(
      t('home:alerts.overrideTitle'),
      t('home:alerts.overrideMessage'),
      [
        { text: t('home:alerts.cancel'), style: 'cancel' },
        {
          text: t('home:alerts.startNow'),
          onPress: () => {
            setIsSendingData(true);
            toastSuccess(t('home:tracking.manualStart'), t('home:tracking.manualStartMessage'));
          },
        },
      ]
    );
  }, [t]);

  // ==================== EFFECTS ====================

  // Initialize on mount
  useEffect(() => {
    checkAppVersion();
    initializeScreen();
  }, [checkAppVersion, initializeScreen]);

  // Countdown timer
  useEffect(() => {
    if (isGPSActive && raceStartTimeRef.current) {
      const interval = setInterval(calculateTimeUntilRace, 1000);
      return () => clearInterval(interval);
    }
  }, [isGPSActive, homeData?.manual_start, calculateTimeUntilRace]);

  // Block back button on forced update
  useEffect(() => {
    if (showUpdateModal && updateInfo?.isForced) {
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => true);
      return () => backHandler.remove();
    }
  }, [showUpdateModal, updateInfo?.isForced]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (gpsWatchRef.current) gpsWatchRef.current.remove();
      if (queueProcessorRef.current) clearInterval(queueProcessorRef.current);
      if (raceStartCheckRef.current) clearInterval(raceStartCheckRef.current);
    };
  }, []);

  // App state changes
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        if (isGPSActive && participantId && eventId) {
          locationService.processQueue(participantId, eventId).then(sentCount => {
            if (sentCount > 0) {
              setLocationUpdateCount(prev => prev + sentCount);
            }
          });
          loadQueueSize();
        }
      }
      appState.current = nextAppState;
    });

    return () => subscription.remove();
  }, [isGPSActive, participantId, eventId, loadQueueSize]);

  // Smart polling with version check
  useFocusEffect(
    useCallback(() => {
      checkAppVersion();

      const checkTokenAndPoll = async () => {
        const token = await tokenService.getToken();

        if (!token) {
          if (API_CONFIG.DEBUG) console.log('📴 No token - clearing data');
          setHasToken(false);
          setHomeData(null);
          return null;
        }

        setHasToken(true);

        if (API_CONFIG.DEBUG) console.log('📡 Home screen focused - Fetching data');
        fetchHomeData();

        const interval = setInterval(() => {
          if (API_CONFIG.DEBUG) console.log('🔄 Polling home data');
          fetchHomeData();
        }, API_CONFIG.HOME_DATA_POLL_INTERVAL);

        return interval;
      };

      let intervalId: NodeJS.Timeout | null = null;

      checkTokenAndPoll().then(interval => {
        intervalId = interval;
      });

      return () => {
        if (intervalId) {
          clearInterval(intervalId);
          if (API_CONFIG.DEBUG) console.log('📴 Unfocused - Stopped polling');
        }
      };
    }, [checkAppVersion, fetchHomeData])
  );

  // ==================== RENDER ====================

  if (loading) {
    return (
      <SafeAreaView style={commonStyles.container} edges={['top']}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <AppHeader showLogo={true} />
        <View style={commonStyles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[commonStyles.loadingText, { marginTop: spacing.lg }]}>
            {t('home:status.loading')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={commonStyles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <AppHeader showLogo={true} />

      {/* Update Modal */}
      {updateInfo && (
        <UpdateRequiredModal
          visible={showUpdateModal}
          isForced={updateInfo.isForced}
          currentVersion={updateInfo.currentVersion}
          latestVersion={updateInfo.latestVersion}
          title={updateInfo.title}
          message={updateInfo.message}
          onUpdate={handleUpdate}
          onLater={updateInfo.isForced ? undefined : handleLater}
        />
      )}

      <ScrollView
        style={homeStyles.scrollView}
        contentContainerStyle={homeStyles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Logo & Title */}
        <View style={homeStyles.cardscetion}>
          <Image
            source={require('../../assets/livio_logo.png')}
            style={homeStyles.logo}
            resizeMode="contain"
          />
          <View style={homeStyles.textSection}>
            <Text style={homeStyles.title}>{t('common:app_name')}</Text>
          </View>
        </View>

        {/* Subtitle */}
        <Text style={homeStyles.subtitle}>{t('home:subtitle')}</Text>

        {/* Main Content */}
        <View style={homeStyles.textContainer}>
          {homeData?.show_start_track === 1 ? (
            <>
              {/* Event Info */}
              <View style={homeStyles.eventInfo}>
                <Text style={homeStyles.eventNameText}>
                  <Text style={homeStyles.eventLabel}>{t('home:Event.title')}: </Text>
                  <Text style={homeStyles.eventValue}>{homeData.next_race_name}</Text>
                </Text>
              </View>

              {/* Date */}
              <Text style={homeStyles.smallText}>
                <Text style={{ fontWeight: typography.weights.bold }}>{t('home:Event.Date')}:</Text>
                {' '}
                {formatDate(homeData.next_race_date!)}
              </Text>

              {/* Manual Start Indicator */}
              {homeData?.manual_start === 1 && (
                <View style={[homeStyles.trackingStatus, { backgroundColor: colors.warning + '20' }]}>
                  <Text style={homeStyles.trackingStatusIcon}>🔓</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[homeStyles.trackingStatusText, { color: colors.warning }]}>
                      {t('home:status.manualStartEnabled')}
                    </Text>
                    <Text style={[homeStyles.trackingCountText, { color: colors.warning }]}>
                      {t('home:status.manualStartDescription')}
                    </Text>
                  </View>
                </View>
              )}

              {/* GPS Status (DEBUG only) */}
              {isGPSActive && API_CONFIG.DEBUG && (
                <View style={homeStyles.trackingStatus}>
                  <Text style={homeStyles.trackingStatusIcon}>{isSendingData ? '🟢' : '🟡'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={homeStyles.trackingStatusText}>
                      {isSendingData ? t('home:status.sendingData') : t('home:status.gpsActive')}
                    </Text>

                    {!isSendingData && timeUntilRace && (
                      <Text style={homeStyles.trackingCountText}>
                        {homeData?.manual_start === 1
                          ? t('home:status.manualStartReady')
                          : `Race starts in: ${timeUntilRace}`}
                      </Text>
                    )}

                    {currentLocation && (
                      <Text style={homeStyles.trackingLocationText}>
                        {currentLocation.lat.toFixed(6)}, {currentLocation.lon.toFixed(6)}
                      </Text>
                    )}
                    <Text style={homeStyles.trackingCountText}>
                      {t('home:status.sent')}: {locationUpdateCount} | {t('home:status.queued')}:{' '}
                      {queuedCount}
                    </Text>
                    <Text style={homeStyles.trackingCountText}>
                      {t('home:status.interval')}: {sendingInterval}s
                    </Text>
                  </View>
                </View>
              )}

              {/* Description */}
              <Text style={homeStyles.heading}>{t('home:Event.description')}</Text>

              {/* Tracking Button */}
              <TouchableOpacity
                style={[
                  homeStyles.button,
                  { width: '100%', marginBottom: spacing.md },
                  (!participantId || !eventId) && {
                    backgroundColor: colors.gray400,
                    opacity: 0.6,
                  },
                ]}
                onPress={isGPSActive ? stopGPSTracking : startGPSTracking}
                disabled={!isGPSActive && (!participantId || !eventId)}
              >
                <Text style={homeStyles.buttonText}>
                  {isGPSActive
                    ? t('home:Event.button')
                    : !participantId || !eventId
                    ? t('home:status.waitingForData')
                    : t('home:Event.buttonText')}
                </Text>
              </TouchableOpacity>

              {/* Manual Override (DEBUG only) */}
              {API_CONFIG.DEBUG &&
                isGPSActive &&
                !isSendingData &&
                homeData?.manual_start !== 1 && (
                  <TouchableOpacity
                    style={[
                      homeStyles.button,
                      {
                        width: '100%',
                        backgroundColor: colors.warning,
                        marginBottom: spacing.xl,
                      },
                    ]}
                    onPress={manualStartSending}
                  >
                    <Text style={homeStyles.buttonText}>
                      {t('home:alerts.startNow')} (OVERRIDE)
                    </Text>
                  </TouchableOpacity>
                )}
            </>
          ) : (
            <>
              <Text style={homeStyles.tagline}>{t('home:tagline')}</Text>
              <Text style={homeStyles.centeredText}>{t('home:participant.title')}</Text>
              <Text style={homeStyles.centeredText}>{t('home:subtext')}</Text>
            </>
          )}
        </View>

        {/* Bottom Buttons */}
        <View style={homeStyles.buttonContainer}>
          <TouchableOpacity
            style={homeStyles.button}
            onPress={() => navigation.navigate('ParticipantEvent')}
          >
            <Text style={homeStyles.buttonText}>{t('home:button.Participant')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={homeStyles.button}>
            <Text style={homeStyles.buttonText}>{t('home:button.Fan')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default HomeScreen;