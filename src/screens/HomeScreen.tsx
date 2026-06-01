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
  Modal,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Battery from 'expo-battery';

// Local imports
import { HomeScreenProps } from '../types/navigation';
import { AppHeader } from '../components/common/AppHeader';
import { UpdateRequiredModal } from '../components/UpdateRequiredModal';
import { toastSuccess, toastError } from '../../utils/toast';
import { locationService } from '../services/locationService';
import {
  gpsService, BACKGROUND_SENT_COUNT_KEY, RACE_FINISHED_KEY,
  ensureBackgroundTaskAlive, TRACKING_LOG_KEY, TrackingLogEntry,
  startBackgroundFetchKeepalive, stopBackgroundFetchKeepalive,
  isTracking, getTrackingParams, stopWatching, attachUi, detachUi,
} from '../services/gpsService';
import { QUEUE_COUNT_KEY } from '../services/locationQueueService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { locationQueueService } from '../services/locationQueueService';
import { tokenService } from '../services/tokenService';
import { versionService } from '../services/versionService';
import { API_CONFIG, getApiEndpoint, getDeviceId } from '../constants/config';
import { useNotifications, NotificationData } from '../hooks/useNotifications';
import { followerApi } from '../services/registerFollowerServices';
import { syncFollowDataFromAPI } from '../utils/followStorage';

// Styles
import { colors, spacing, typography, commonStyles } from '../styles/common.styles';
import { homeStyles } from '../styles/home.styles';
import FollowingLiveEventsSection from './FollowingLiveEventsSection';

// ==================== TYPES ====================

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

export interface FollowingLiveEvent {
  product_app_id: number;
  product_option_value_app_id: number;
  event_name: string;
  event_source: string;
  race_date: string;
  race_time: string;
  end_time: string | null;
  timezone: string;
  race_status: 'in_progress' | 'upcoming' | 'finished';
  followed_participants: {
    participant_app_id: number;
    customer_app_id: number;
    bib_number: string;
    firstname: string;
    lastname: string;
    profile_picture: string;
  }[];
}

interface HomeData {
  next_race_participant_app_id?: string;
  next_race_id?: string;
  next_race_name?: string;
  next_race_date?: string;
  next_race_time?: string;
  next_race_interval_for_location?: number | string;
  next_race_category_id?: number;
  show_start_track?: number;
  manual_start?: number;
  server_datetime?: string;
  timezone?: string;
  next_race_in_hours?: number;
  following_live_events?: FollowingLiveEvent[];
}

// ==================== CONSTANTS ====================

// ✅ Stored permanently — never cleared after first prompt
const BATTERY_PROMPTED_KEY = '@PFSLive:batteryOptimizationPrompted';

// ✅ Hours threshold — show early tracking warning if race is more than this far away
const EARLY_TRACKING_WARNING_HOURS = 24;

// ==================== BATTERY OPTIMIZATION ====================

/**
 * Open system dialog to exempt app from battery optimization.
 * HomeScreen provides the visual background behind the system dialog.
 * Called once on first install — permanent, zero cost on non-event days.
 */
const requestBatteryOptimizationExemption = async (): Promise<void> => {
  if (Platform.OS !== 'android') return;
  try {
    await IntentLauncher.startActivityAsync(
      IntentLauncher.ActivityAction.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
      { data: 'package:eu.passionforsports.livio' }
    );
  } catch {
    // Fallback — open battery optimization list directly
    await IntentLauncher.startActivityAsync(
      'android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS'
    );
  }
};

// ==================== COMPONENT ====================

const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const { t } = useTranslation(['home', 'common']);

  // ✅ Notifications hook
  const {
    expoPushToken,
    lastNotification,
    clearLastNotification,
    isRegistering,
    setOnNotificationTap,
  } = useNotifications();

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
  const [showPowerSavingModal, setShowPowerSavingModal] = useState(false);

  // ✅ Tracking log — DEBUG only, shows background task events live
  const [trackingLogs, setTrackingLogs] = useState<TrackingLogEntry[]>([]);

  // ✅ Battery explanation modal — shown once before system dialog
  const [showBatteryModal, setShowBatteryModal] = useState(false);

  // ✅ Early tracking warning modal — shown when race is more than 24h away
  const [showEarlyTrackingModal, setShowEarlyTrackingModal] = useState(false);

  // Version check states
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);

  // ✅ Notification popup state
  const [notificationPopup, setNotificationPopup] = useState<{
    visible: boolean;
    title: string;
    body: string;
    data: NotificationData | null;
  }>({ visible: false, title: '', body: '', data: null });

  // Refs
  const gpsWatchRef = useRef<{ remove: () => void } | null>(null);
  const queueProcessorRef = useRef<NodeJS.Timeout | null>(null);
  const raceStartCheckRef = useRef<NodeJS.Timeout | null>(null);
  const appState = useRef(AppState.currentState);
  const raceStartTimeRef = useRef<Date | null>(null);
  const isGPSActiveRef = useRef<boolean>(false);
  const serverTimeOffsetRef = useRef<number>(0);
  // ✅ Ref so GPS callback always reads current value without stale closure
  const isSendingDataRef = useRef<boolean>(false);
  // ✅ Ref to tracking params — needed by watchdog to restart task if killed
  const trackingParamsRef = useRef<{
    intervalSeconds: number;
    notificationTitle: string;
    notificationBody: string;
  } | null>(null);

  // Derived values
  const participantId = homeData?.next_race_participant_app_id || null;
  const eventId = homeData?.next_race_id || null;

  // ==================== NOTIFICATION HELPERS ====================

  const navigateToResultDetails = useCallback((data: NotificationData) => {
    // navigation.navigate('LiveTracking', {
    //   product_app_id: Number(data.race_id),
    //   product_option_value_app_id: Number(data.product_option_value_app_id),
    //   event_name: data.event_name,
    //   sourceScreen: 'FollowerDistanceScreen',
    //   sectionType: 'follower',
    //   sourceTab: 'live'
    // });
    if (data.product_option_value_app_id == 0) {
      navigation.navigate('LiveTracking', {
        product_app_id: Number(data.race_id),
        product_option_value_app_id: Number(data.product_option_value_app_id),
        event_name: data.event_name,
        sourceScreen: 'FollowerDistanceScreen',
        sectionType: 'follower',
        sourceTab: 'live',
        event_source: 'custom',
      });
    } else {
      navigation.navigate('ResultDetails', {
        product_app_id: Number(data.race_id),
        product_option_value_app_id: Number(data.product_option_value_app_id),
        bib: String(data.bib),
        from_live: 0,
        raceStatus: (data.race_status as any) ?? undefined,
      });
    }

  }, [navigation]);

  const closeNotificationPopup = useCallback(() => {
    setNotificationPopup(p => ({ ...p, visible: false }));
  }, []);

  // ==================== NOTIFICATION HANDLERS ====================

  // ✅ Log push token when ready (DEBUG only)
  useEffect(() => {
    if (API_CONFIG.DEBUG && expoPushToken) {
      console.log('📲 Expo push token ready:', expoPushToken);
    }
  }, [expoPushToken]);

  // ✅ Foreground notification — show popup instead of navigating directly
  useEffect(() => {
    if (!lastNotification) return;

    const { title, body, data } = lastNotification.request.content;

    if (API_CONFIG.DEBUG) {
      console.log('📬 Foreground notification received:', { title, body, data });
    }

    if (data?.race_id && data?.event_name) {
      setNotificationPopup({
        visible: true,
        title: title ?? '',
        body: body ?? '',
        data: data as NotificationData,
      });
    }

    clearLastNotification();
  }, [lastNotification, clearLastNotification]);

  // ✅ Background/killed tap — register handler so hook can navigate immediately
  useEffect(() => {
    setOnNotificationTap((data: NotificationData) => {
      navigateToResultDetails(data);
    });

    return () => setOnNotificationTap(null);
  }, [navigateToResultDetails, setOnNotificationTap]);

  // ✅ Show notification registration status (DEBUG only)
  useEffect(() => {
    if (API_CONFIG.DEBUG && isRegistering) {
      console.log('🔄 Registering device for push notifications...');
    }
  }, [isRegistering]);

  useEffect(() => {
    if (!expoPushToken) return;

    const syncFromServer = async () => {
      try {
        const data = await followerApi.getFollowerData(expoPushToken);

        console.log('data');
        console.log(data);

        await syncFollowDataFromAPI(
          data.followed_customers ?? [],
          data.followed_bibs ?? {},
        );
      } catch {
        // Silent — local data stays as fallback if server unreachable
      }
    };

    syncFromServer();
  }, [expoPushToken]);

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
    // ✅ raceStartTimeRef is real UTC ms (Date.now() + msUntilRace).
    // Compare against Date.now() directly — no offset needed.
    // getServerTime() returns fake-UTC ms (event-tz number) which is
    // numerically larger than real UTC, causing race to appear started early.
    return Date.now() >= raceStartTimeRef.current.getTime();
  }, [homeData?.manual_start]);

  // ==================== BATTERY OPTIMIZATION ====================

  /**
   * Show battery explanation modal once on first install.
   * HomeScreen is mounted so user sees the app behind the system dialog.
   * Key is NEVER cleared — user is only asked once, ever.
   */
  const checkAndPromptBatteryOptimization = useCallback(async (): Promise<void> => {
    if (Platform.OS !== 'android') return;
    try {
      const alreadyPrompted = await AsyncStorage.getItem(BATTERY_PROMPTED_KEY);
      if (alreadyPrompted) return;
      setShowBatteryModal(true);
    } catch { /* silent */ }
  }, []);

  // ✅ User taps "Allow" — mark permanently, open system dialog
  const handleBatteryAllow = useCallback(async (): Promise<void> => {
    setShowBatteryModal(false);
    try {
      await AsyncStorage.setItem(BATTERY_PROMPTED_KEY, '1');
    } catch { /* silent */ }
    await requestBatteryOptimizationExemption();
  }, []);

  // ✅ User taps "Skip" — mark permanently, never ask again
  const handleBatterySkip = useCallback(async (): Promise<void> => {
    setShowBatteryModal(false);
    try {
      await AsyncStorage.setItem(BATTERY_PROMPTED_KEY, '1');
    } catch { /* silent */ }
  }, []);


  const checkPowerSavingMode = useCallback(async (): Promise<boolean> => {
    try {
      const isLowPower = await Battery.isLowPowerModeEnabledAsync();
      return isLowPower;
    } catch {
      return false;
    }
  }, []);

  const openPowerSavingSettings = useCallback(async () => {
    if (Platform.OS !== 'android') return;
    try {
      await IntentLauncher.startActivityAsync('android.settings.BATTERY_SAVER_SETTINGS');
    } catch {
      try {
        await IntentLauncher.startActivityAsync('android.settings.BATTERY_SAVER_SETTINGS');
      } catch { /* silent */ }
    }
  }, []);

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
      const deviceId = await getDeviceId();
      if (!token) {
        if (API_CONFIG.DEBUG) console.log('⚠️ No token - skipping fetch');
        setHasToken(false);
        setHomeData(null);
        setLoading(false);
        return;
      }

      setHasToken(true);

      const headers = await API_CONFIG.getHeaders();
      const requestBody = {
        device_id: deviceId,
      };

      if (API_CONFIG.DEBUG) console.log('📤 Fetching home data');

      const response = await axios.post<StandardApiResponse>(
        getApiEndpoint(API_CONFIG.ENDPOINTS.HOME),
        requestBody,
        { headers, timeout: API_CONFIG.TIMEOUT },
      );

      if (API_CONFIG.DEBUG) {
        console.log('📡 Home API response:', response.data);
      }

      // ✅ Check for unauthorized action
      if (response.data.success && response.data.data?.action === 'unauthorized') {
        if (API_CONFIG.DEBUG) {
          console.log('🔐 Token invalid/expired - clearing session silently');
        }

        await tokenService.removeToken();
        setHasToken(false);
        setHomeData(null);
        setLoading(false);
        return;
      }

      // ✅ Normal success flow
      if (response.data.success && response.data.data) {
        setHomeData(response.data.data);
        console.log("11111", response.data.data);


        // ✅ Calculate server time offset.
        // server_datetime is in event timezone (e.g. Brussels), NOT UTC.
        // Parse as fake-UTC (append 'Z') so JS doesn't apply device timezone.
        // offset = serverFakeMs - Date.now()
        //   → how far ahead event-tz time is from real UTC (in ms)
        // getServerTime() = Date.now() + offset = current time in event tz (as UTC ms)
        // This lets hasRaceStarted() compare raceTime (UTC ms) against event-tz now correctly.
        if (response.data.data.server_datetime) {
          try {
            const serverFakeMs = new Date(
              response.data.data.server_datetime.replace(' ', 'T') + 'Z'
            ).getTime();
            const offset = serverFakeMs - Date.now();

            setServerTimeOffset(offset);
            serverTimeOffsetRef.current = offset;

            if (API_CONFIG.DEBUG) {
              console.log('🖥️ server_datetime (event tz):', response.data.data.server_datetime);
              console.log('⏱️ event tz offset from UTC:', (offset / 3600000).toFixed(2), 'h');
              console.log('🕐 getServerTime() now:', new Date(Date.now() + offset).toISOString());
            }
          } catch (error) {
            if (API_CONFIG.DEBUG) console.error('Error calculating offset:', error);
          }
        }
      }
    } catch (error: any) {
      if (API_CONFIG.DEBUG) {
        console.error('❌ Error fetching home data:', error.message);
      }

      // ✅ Handle 401 status
      if (error?.response?.status === 401) {
        if (API_CONFIG.DEBUG) {
          console.log('🚨 401 Unauthorized - clearing session silently');
        }

        await tokenService.removeToken();
        setHasToken(false);
        setHomeData(null);
        return;
      }

      // ✅ Handle other errors silently
      if (API_CONFIG.DEBUG) {
        console.log('⚠️ Network error - keeping current state');
      }
    } finally {
      setLoading(false);
    }
  }, []);

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
      // ✅ raceStartTimeRef is real UTC ms — compare against Date.now() directly.
      const now = Date.now();
      const raceTime = raceStartTimeRef.current;
      const diff = raceTime.getTime() - now;

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
      // ✅ Check queue count key first — cheap single string read,
      // avoids parsing full queue JSON when nothing is queued.
      const queueSize = await locationQueueService.getQueueSize();
      if (queueSize === 0) return;

      try {
        const sentCount = await locationService.processQueue(participantId, eventId);
        if (sentCount > 0) {
          // ✅ Write to BACKGROUND_SENT_COUNT_KEY so countdown timer sync
          // includes queue-sent locations in the total count
          try {
            const countStr = await AsyncStorage.getItem(BACKGROUND_SENT_COUNT_KEY);
            const current = countStr ? parseInt(countStr) : 0;
            await AsyncStorage.setItem(BACKGROUND_SENT_COUNT_KEY, String(current + sentCount));
          } catch { /* silent */ }

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
    }, 10000);  // ✅ 10s — quick retry when network recovers after instability.
    // Safe: getQueueSize() exits immediately if queue is empty.
  }, [participantId, eventId, loadQueueSize, t]);

  const startRaceStartChecker = useCallback(() => {
    if (raceStartCheckRef.current) return;

    raceStartCheckRef.current = setInterval(() => {
      // ✅ Use ref — not state — so callback reads current value not stale closure
      const started = hasRaceStarted();
      if (API_CONFIG.DEBUG) {
        console.log('🕐 Race check — started:', started, '| now (UTC):', new Date().toISOString(), '| raceTime (UTC):', raceStartTimeRef.current?.toISOString());
      }
      if (started && !isSendingDataRef.current) {
        isSendingDataRef.current = true;
        setIsSendingData(true);

        if (API_CONFIG.DEBUG) {
          toastSuccess(t('home:tracking.raceStarted'), t('home:tracking.nowSending'));
        }

        // ✅ Race has started — stop the checker, no longer needed
        if (raceStartCheckRef.current) {
          clearInterval(raceStartCheckRef.current);
          raceStartCheckRef.current = null;
        }
      }
    }, 30000);
  }, [hasRaceStarted, getServerTime, t]);

  /**
   * Core GPS tracking logic — called after all confirmations passed.
   */
  const doStartGPSTracking = useCallback(async () => {
    try {
      if (!hasPermission) {
        const granted = await gpsService.requestPermissions();
        if (!granted) {
          toastError(t('home:errors.permissionRequired'), t('home:errors.permissionDescription'));
          return;
        }
        setHasPermission(true);
      }

      // Parse race start time
      if (homeData?.next_race_date && homeData?.next_race_time) {
        try {
          // ✅ Both server_datetime and race_time are in the event timezone.
          // Parse both as fake-UTC (appending 'Z') so JS doesn't apply any
          // device timezone offset. Since both strings are in the SAME timezone,
          // the difference between them is always correct — no device time needed.
          //
          // server_datetime (fake-UTC ms) = actual event-tz now
          // race_datetime   (fake-UTC ms) = actual event-tz race start
          // diff = race_ms - server_ms = how far in the future the race is (in ms)
          // raceTime = Date.now() + diff  ← correct UTC race start time
          //
          // Example:
          //   server_datetime = "2026-05-20 07:24:43" Brussels (UTC+2) = 05:24 UTC
          //   race_time       = "2026-05-20 05:00:00" Brussels (UTC+2) = 03:00 UTC
          //   serverFakeMs = parse("2026-05-20T07:24:43Z") = 07:24 fake-UTC
          //   raceFakeMs   = parse("2026-05-20T05:00:00Z") = 05:00 fake-UTC
          //   diff = 05:00 - 07:24 = -2h24m (race was 2h24m ago in event tz)
          //   raceTime = Date.now() + (-2h24m) = 2h24m ago in UTC ✅ correct

          const serverDatetimeStr = homeData?.server_datetime;

          if (serverDatetimeStr) {
            const serverFakeMs = new Date(serverDatetimeStr.replace(' ', 'T') + 'Z').getTime();
            const raceFakeMs = new Date(`${homeData.next_race_date}T${homeData.next_race_time}Z`).getTime();

            // How many ms from event-tz now until race start (negative = already started)
            const msUntilRace = raceFakeMs - serverFakeMs;

            // Anchor to real UTC now — no device timezone involved
            const raceTime = new Date(Date.now() + msUntilRace);

            if (!isNaN(raceTime.getTime())) {
              setRaceStartTime(raceTime);
              raceStartTimeRef.current = raceTime;

              if (API_CONFIG.DEBUG) {
                console.log('✅ server_datetime (event tz):', serverDatetimeStr);
                console.log('✅ race_time (event tz):', `${homeData.next_race_date} ${homeData.next_race_time}`);
                console.log('✅ ms until race:', msUntilRace, '→', (msUntilRace / 3600000).toFixed(2), 'h');
                console.log('✅ raceTime (UTC):', raceTime.toISOString());
              }
            }
          } else {
            // No server_datetime — cannot reliably compute race time
            // Clear it so the background task does not send prematurely
            setRaceStartTime(null);
            raceStartTimeRef.current = null;
            if (API_CONFIG.DEBUG) console.warn('⚠️ No server_datetime — race time not set');
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
      if (raceAlreadyStarted) {
        isSendingDataRef.current = true;
        setIsSendingData(true);
      }

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

          // ✅ Background task handles the actual API send.
          // Foreground callback only updates UI state (position dot, sending indicator).
          const shouldSend = hasRaceStarted();

          if (shouldSend && !isSendingDataRef.current) {
            isSendingDataRef.current = true;
            setIsSendingData(true);
            if (API_CONFIG.DEBUG) {
              toastSuccess(t('home:tracking.raceStarted'), t('home:tracking.nowSending'));
            }
          }
        },
        () => {
          toastError(t('home:errors.gpsError'), t('home:errors.gpsErrorDescription'));
        },
        intervalValue,
        participantId!,  // ✅ passed to background task via AsyncStorage
        eventId!,        // ✅ passed to background task via AsyncStorage
        t('home:tracking.backgroundNotificationTitle'),       // ✅ from language file
        t('home:tracking.backgroundNotificationBody'),        // ✅ from language file
        homeData?.next_race_category_id,                      // ✅ movement threshold per sport
        raceStartTimeRef.current?.toISOString() ?? null,      // ✅ background task race check
        homeData?.manual_start,                               // ✅ skip race check if manual
      );

      gpsWatchRef.current = gpsWatch;

      // ✅ Start background fetch keepalive — fires every 15s via JobScheduler.
      // Bypasses Samsung One UI Adaptive Battery throttling of GPS during walking.
      await startBackgroundFetchKeepalive();

      // ✅ Store for watchdog use in AppState listener
      trackingParamsRef.current = {
        intervalSeconds: intervalValue,
        notificationTitle: t('home:tracking.backgroundNotificationTitle'),
        notificationBody: t('home:tracking.backgroundNotificationBody'),
      };

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
    hasPermission,
    homeData,
    participantId,
    eventId,
    getServerTime,
    hasRaceStarted,
    startQueueProcessor,
    startRaceStartChecker,
    t,
  ]);

  const startGPSTracking = useCallback(async () => {
    if (!participantId || !eventId) {
      toastError(t('home:errors.missingInfo'), t('home:errors.missingInfoDescription'));
      return;
    }

    const isPowerSaving = await checkPowerSavingMode();
    console.log('Power Saving Mode:', isPowerSaving);
    if (isPowerSaving) {
      setShowPowerSavingModal(true);
      return;

    }

    const hoursUntilRace = homeData?.next_race_in_hours ?? 0;
    if (
      homeData?.manual_start !== 1 &&
      hoursUntilRace > EARLY_TRACKING_WARNING_HOURS
    ) {
      setShowEarlyTrackingModal(true);
      return;
    }

    await doStartGPSTracking();
  }, [participantId, eventId, homeData, doStartGPSTracking, t]);

  // ✅ User confirms early tracking — proceed anyway
  const handleEarlyTrackingConfirm = useCallback(async () => {
    setShowEarlyTrackingModal(false);
    await doStartGPSTracking();
  }, [doStartGPSTracking]);

  // ✅ User cancels early tracking — do nothing
  const handleEarlyTrackingCancel = useCallback(() => {
    setShowEarlyTrackingModal(false);
  }, []);

  const stopGPSTracking = useCallback(async () => {
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
    isSendingDataRef.current = false;
    setIsSendingData(false);
    setCurrentLocation(null);
    trackingParamsRef.current = null;
    AsyncStorage.removeItem(BACKGROUND_SENT_COUNT_KEY).catch(() => { });

    // ✅ Stop background fetch keepalive
    await stopBackgroundFetchKeepalive();

    // ✅ Attempt to drain queue immediately on stop — covers the case where
    // network was unavailable during the race and locations were queued.
    // processQueue is a no-op if queue is empty or network is still down.
    if (participantId && eventId) {
      try {
        const sentCount = await locationService.processQueue(participantId, eventId);
        if (API_CONFIG.DEBUG && sentCount > 0) {
          console.log(`✅ Drained ${sentCount} queued locations on stop`);
        }
      } catch { /* silent — user can retry via button */ }
    }

    // ✅ Refresh queue count after drain attempt
    const remaining = await locationQueueService.getQueueSize();
    setQueuedCount(remaining);

    // ✅ Upload tracking log to server for debugging
    // Only in DEBUG mode or always — your choice. Non-fatal if it fails.
    if (participantId && eventId) {
      try {
        const logsStr = await AsyncStorage.getItem(TRACKING_LOG_KEY);
        const logs: TrackingLogEntry[] = logsStr ? JSON.parse(logsStr) : [];
        if (logs.length > 0) {
          await locationService.saveTrackingLog(
            participantId,
            eventId,
            logs,
            locationUpdateCount,
            queuedCount,
          );
        }
      } catch { /* silent */ }
    }

    toastSuccess(
      t('home:tracking.gpsStopped'),
      t('home:tracking.trackingStopped', {
        sent: locationUpdateCount,
        queued: remaining,
      })
    );

    setLocationUpdateCount(0);
  }, [locationUpdateCount, participantId, eventId, t]);

  const manualStartSending = useCallback(() => {
    Alert.alert(
      t('home:alerts.overrideTitle'),
      t('home:alerts.overrideMessage'),
      [
        { text: t('home:alerts.cancel'), style: 'cancel' },
        {
          text: t('home:alerts.startNow'),
          onPress: () => {
            isSendingDataRef.current = true;
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

  // ✅ Battery optimization — prompt once on first install when HomeScreen is visible
  // HomeScreen provides the background behind the system dialog — better UX than App.tsx
  useEffect(() => {
    checkAndPromptBatteryOptimization();
  }, [checkAndPromptBatteryOptimization]);

  // Countdown timer + background sent count sync + queue count sync
  useEffect(() => {
    if (!isGPSActive) return;
    const interval = setInterval(async () => {
      calculateTimeUntilRace();

      // ✅ Sync locationUpdateCount from background task's AsyncStorage counter.
      try {
        const countStr = await AsyncStorage.getItem(BACKGROUND_SENT_COUNT_KEY);
        if (countStr) setLocationUpdateCount(parseInt(countStr));
      } catch { /* silent */ }

      // ✅ Sync queuedCount — read the lightweight count key written by
      // locationQueueService on every addToQueue/removeFromQueue call.
      // Avoids parsing the full queue JSON on every 1s tick.
      try {
        const queueCountStr = await AsyncStorage.getItem(QUEUE_COUNT_KEY);
        if (queueCountStr !== null) setQueuedCount(parseInt(queueCountStr) || 0);
      } catch { /* silent */ }

      // ✅ Sync tracking logs — DEBUG only
      if (API_CONFIG.DEBUG) {
        try {
          const logsStr = await AsyncStorage.getItem(TRACKING_LOG_KEY);
          if (logsStr) setTrackingLogs(JSON.parse(logsStr));
        } catch { /* silent */ }
      }

      // ✅ Auto-stop when participant crosses finish line.
      // Background task sets RACE_FINISHED_KEY='1' when distance_to_finish_km===0.
      // We read it here in the 1s timer so stopGPSTracking() runs in React context
      // (cannot call it from the background task JS context directly).
      // Clear the flag first to prevent double-trigger on next tick.
      try {
        const raceFinished = await AsyncStorage.getItem(RACE_FINISHED_KEY);
        if (raceFinished === '1') {
          await AsyncStorage.removeItem(RACE_FINISHED_KEY);
          await stopGPSTracking();
        }
      } catch { /* silent */ }

    }, 1000);
    return () => clearInterval(interval);
  }, [isGPSActive, calculateTimeUntilRace, stopGPSTracking]);

  // Block back button on forced update
  useEffect(() => {
    if (showUpdateModal && updateInfo?.isForced) {
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => true);
      return () => backHandler.remove();
    }
  }, [showUpdateModal, updateInfo?.isForced]);

  // ✅ Cleanup on unmount.
  //
  // CRITICAL: do NOT call gpsWatchRef.current.remove() here. Some React
  // Navigation configurations unmount HomeScreen when the user navigates to
  // another screen, and calling remove() in that case stops Transistor — so
  // when the user navigates back, tracking has silently died.
  //
  // Tracking is intended to persist across screen mounts. It is stopped only
  // by:
  //   • Explicit user action (Stop Tracking button → stopGPSTracking)
  //   • Auto-stop after the finish line (RACE_FINISHED_KEY → stopGPSTracking)
  //   • App process termination (OS tears down Transistor's foreground service)
  //
  // On unmount we DO detach the UI-only foreground watch (so the GPS chip
  // isn't kept warm on a defunct screen) and clear the screen-scoped timers.
  // Transistor's background service keeps running.
  useEffect(() => {
    return () => {
      if (queueProcessorRef.current) clearInterval(queueProcessorRef.current);
      if (raceStartCheckRef.current) clearInterval(raceStartCheckRef.current);
      // Detach the foreground UI watch (does NOT stop Transistor).
      detachUi().catch(() => { /* silent */ });
    };
  }, []);

  // ✅ Restore tracking state on mount.
  //
  // If the user started tracking, navigated away, and came back, Transistor
  // is still running (we don't stop it on unmount any more). But this fresh
  // HomeScreen mount has isGPSActive=false, gpsWatchRef.current=null, and no
  // attached UI callback. This effect detects the existing session and wires
  // everything back up so the screen shows the correct state and the Stop
  // button works.
  const hasRestoredRef = useRef(false);

  useEffect(() => {
    if (hasRestoredRef.current) return;
    let cancelled = false;

    const restore = async () => {
      try {
        const active = await isTracking();
        if (!active || cancelled) return;

        hasRestoredRef.current = true;

        const params = await getTrackingParams();
        if (!params || cancelled) return;

        if (API_CONFIG.DEBUG) console.log('🔄 Restoring active tracking session');

        // Restore tracking flags.
        setIsGPSActive(true);
        isGPSActiveRef.current = true;

        if (params.intervalSeconds) {
          setSendingInterval(params.intervalSeconds);
        }

        if (params.raceStartTime) {
          const rt = new Date(params.raceStartTime);
          if (!isNaN(rt.getTime())) {
            setRaceStartTime(rt);
            raceStartTimeRef.current = rt;
          }
        }

        // If the race has already started, the sending state should reflect that.
        const started =
          params.manualStart === 1 ||
          (params.raceStartTime !== null &&
            params.raceStartTime !== undefined &&
            Date.now() >= new Date(params.raceStartTime).getTime());
        if (started) {
          isSendingDataRef.current = true;
          setIsSendingData(true);
        }

        // Restore the stop handle so the Stop Tracking button works on this
        // new screen instance. stopWatching is the same teardown the original
        // remove() would have called.
        gpsWatchRef.current = { remove: stopWatching };

        // Restore the watchdog's params reference (used by AppState handler).
        trackingParamsRef.current = {
          intervalSeconds: params.intervalSeconds ?? 30,
          notificationTitle: t('home:tracking.backgroundNotificationTitle'),
          notificationBody: t('home:tracking.backgroundNotificationBody'),
        };

        // Re-attach the foreground UI callback so live lat/lon updates resume
        // on this screen instance. Transistor's background sends continue
        // independently of this — this only drives the screen display.
        await attachUi(async (gpsPosition) => {
          if (!isGPSActiveRef.current) return;
          setCurrentLocation({
            lat: gpsPosition.latitude,
            lon: gpsPosition.longitude,
          });
          const shouldSend = hasRaceStarted();
          if (shouldSend && !isSendingDataRef.current) {
            isSendingDataRef.current = true;
            setIsSendingData(true);
          }
        }, params.intervalSeconds ?? 30);

        // Restart the screen-scoped timers (these are cleared on unmount).
        startQueueProcessor();
        if (params.manualStart !== 1) {
          startRaceStartChecker();
        }
      } catch (err) {
        if (API_CONFIG.DEBUG) console.error('❌ Restore tracking state failed:', err);
      }
    };

    restore();

    return () => {
      cancelled = true;
    };
  }, [hasRaceStarted, startQueueProcessor, startRaceStartChecker, t]);

  // App state changes
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        if (showPowerSavingModal) {
          (async () => {
            const stillSaving = await checkPowerSavingMode();
            if (!stillSaving) setShowPowerSavingModal(false);
          })();
        }

        if (isGPSActive && participantId && eventId) {
          // ✅ FIX 2: Check the race-finished flag FIRST, before the watchdog.
          // If auto-stop already fired in the background while the app was
          // closed, calling ensureBackgroundTaskAlive first would restart
          // Transistor for ~70ms and send one unwanted coordinate before
          // stopGPSTracking finally tears everything down. Doing the check
          // first means: if the race is over, we stop cleanly and skip the
          // watchdog/queue work entirely.
          (async () => {
            try {
              const raceFinished = await AsyncStorage.getItem(RACE_FINISHED_KEY);
              if (raceFinished === '1') {
                await AsyncStorage.removeItem(RACE_FINISHED_KEY);
                await stopGPSTracking();
                return;
              }

              // Race still running — watchdog + queue drain.
              if (trackingParamsRef.current) {
                ensureBackgroundTaskAlive(
                  participantId,
                  eventId,
                  trackingParamsRef.current.intervalSeconds,
                  homeData?.next_race_category_id,
                  raceStartTimeRef.current?.toISOString() ?? null,
                  homeData?.manual_start,
                  trackingParamsRef.current.notificationTitle,
                  trackingParamsRef.current.notificationBody,
                ).then(alive => {
                  if (API_CONFIG.DEBUG) console.log('🔍 Background task alive:', alive);
                });
              }

              const sentCount = await locationService.processQueue(participantId, eventId);
              if (sentCount > 0) {
                try {
                  const countStr = await AsyncStorage.getItem(BACKGROUND_SENT_COUNT_KEY);
                  const current = countStr ? parseInt(countStr) : 0;
                  await AsyncStorage.setItem(BACKGROUND_SENT_COUNT_KEY, String(current + sentCount));
                } catch { /* silent */ }
              }
              await loadQueueSize();
            } catch { /* silent */ }
          })();
        }
      }
      appState.current = nextAppState;
    });

    return () => subscription.remove();
  }, [isGPSActive, participantId, eventId, loadQueueSize, stopGPSTracking, showPowerSavingModal, homeData?.next_race_category_id, homeData?.manual_start]);

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

  const PARTNER_LOGOS = [
    'https://www-static.liviolive.com/wp-content/uploads/2026/05/fantomes-2.png',
    'https://www-static.liviolive.com/wp-content/uploads/2026/05/terhills.png',
    'https://www-static.liviolive.com/wp-content/uploads/2026/05/walking.png',
    'https://www-static.liviolive.com/wp-content/uploads/2026/05/soup.png',
    'https://www-static.liviolive.com/wp-content/uploads/2026/05/gtlc-1.png',
    'https://www-static.liviolive.com/wp-content/uploads/2026/05/orval.png',
    'https://www-static.liviolive.com/wp-content/uploads/2026/05/heuvelland.png',
    'https://www-static.liviolive.com/wp-content/uploads/2026/05/chouffe.png',
    'https://www-static.liviolive.com/wp-content/uploads/2026/05/castle-1.png',
    'https://www-static.liviolive.com/wp-content/uploads/2026/05/castle-1.png',
    'https://www-static.liviolive.com/wp-content/uploads/2026/05/ballon-1.png'

  ];

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

  // ✅ Format hours for early tracking modal message
  const hoursUntilRace = homeData?.next_race_in_hours ?? 0;
  const hoursDisplay = hoursUntilRace >= 24
    ? `${Math.floor(hoursUntilRace / 24)}d ${Math.round(hoursUntilRace % 24)}h`
    : `${Math.round(hoursUntilRace)}h`;

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

      {/* ✅ Battery optimization explanation modal — Android only, shown once on first install */}
      {Platform.OS === 'android' && (
        <Modal
          transparent
          visible={showBatteryModal}
          animationType="fade"
          statusBarTranslucent
          onRequestClose={handleBatterySkip}
        >
          <View style={homeStyles.notifBackdrop}>
            <View style={homeStyles.notifWrapper}>
              <View style={homeStyles.notifCard}>
                <View style={homeStyles.notifIconWrapper}>
                  <Ionicons name="battery-charging" size={36} color={colors.primary} />
                </View>
                <Text style={homeStyles.notifTitle}>{t('home:battery.title')}</Text>
                <Text style={homeStyles.notifBody}>{t('home:battery.message')}</Text>
                <View style={homeStyles.notifButtonContainer}>
                  <TouchableOpacity
                    style={[commonStyles.primaryButton, homeStyles.notifViewButton]}
                    onPress={handleBatteryAllow}
                    activeOpacity={0.8}
                  >
                    <Text style={commonStyles.primaryButtonText}>{t('home:battery.allow')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={commonStyles.secondaryButton}
                    onPress={handleBatterySkip}
                    activeOpacity={0.7}
                  >
                    <Text style={commonStyles.secondaryButtonText}>{t('home:battery.skip')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* ✅ Early tracking warning modal — shown when race is more than 24h away */}
      <Modal
        transparent
        visible={showEarlyTrackingModal}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={handleEarlyTrackingCancel}
      >
        <View style={homeStyles.notifBackdrop}>
          <View style={homeStyles.notifWrapper}>
            <View style={homeStyles.notifCard}>
              <View style={homeStyles.notifIconWrapper}>
                <Ionicons name="time-outline" size={36} color={colors.warning} />
              </View>
              <Text style={homeStyles.notifTitle}>{t('home:earlyTracking.title')}</Text>
              <Text style={homeStyles.notifBody}>
                {t('home:earlyTracking.message', { hours: hoursDisplay })}
              </Text>
              <View style={homeStyles.notifButtonContainer}>
                <TouchableOpacity
                  style={[commonStyles.primaryButton, homeStyles.notifViewButton]}
                  onPress={handleEarlyTrackingConfirm}
                  activeOpacity={0.8}
                >
                  <Text style={commonStyles.primaryButtonText}>{t('home:earlyTracking.yes')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={commonStyles.secondaryButton}
                  onPress={handleEarlyTrackingCancel}
                  activeOpacity={0.7}
                >
                  <Text style={commonStyles.secondaryButtonText}>{t('home:earlyTracking.no')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* ✅ Power Saving Mode modal — blocks tracking when battery saver is ON */}
      <Modal
        transparent
        visible={showPowerSavingModal}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setShowPowerSavingModal(false)}
      >
        <View style={homeStyles.notifBackdrop}>
          <View style={homeStyles.notifWrapper}>
            <View style={homeStyles.notifCard}>

              {/* Icon */}
              <View style={homeStyles.notifIconWrapper}>
                <Ionicons name="battery-dead-outline" size={36} color={colors.error} />
              </View>
              <Text style={homeStyles.notifTitle}>{t('home:powerSaving.title')}</Text>
              <Text style={homeStyles.notifBody}>{t('home:powerSaving.message')}</Text>
              <View style={homeStyles.notifButtonContainer}>
                <TouchableOpacity
                  style={[commonStyles.primaryButton, homeStyles.notifViewButton]}
                  onPress={openPowerSavingSettings}
                  activeOpacity={0.8}
                >
                  <Text style={commonStyles.primaryButtonText}>
                    {t('home:powerSaving.disable')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={commonStyles.secondaryButton}
                  onPress={() => setShowPowerSavingModal(false)}
                  activeOpacity={0.7}
                >
                  <Text style={commonStyles.secondaryButtonText}>{t('home:battery.skip')}</Text>

                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>


      {/* ✅ Foreground notification popup */}
      <Modal
        transparent
        visible={notificationPopup.visible}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={closeNotificationPopup}
      >
        {/* Backdrop */}
        <View style={homeStyles.notifBackdrop}>
          <TouchableOpacity
            style={homeStyles.notifBackdrop}
            activeOpacity={1}
            onPress={closeNotificationPopup}
          />
        </View>

        {/* Card */}
        <View style={homeStyles.notifWrapper}>
          <View style={homeStyles.notifCard}>
            {/* Close button */}
            <TouchableOpacity
              style={{ position: 'absolute', top: 16, right: 16, width: 32, height: 32, borderRadius: 16, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center', zIndex: 10 }}
              onPress={closeNotificationPopup}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={20} color="#64748b" />
            </TouchableOpacity>

            {/* Icon */}
            <View style={homeStyles.notifIconWrapper}>
              <Ionicons name="notifications" size={36} color={colors.primary} />
            </View>

            {/* Title */}
            <Text style={homeStyles.notifTitle}>{notificationPopup.title}</Text>

            {/* Body */}
            <Text style={homeStyles.notifBody}>{notificationPopup.body}</Text>

            {/* Buttons */}
            <View style={homeStyles.notifButtonContainer}>
              <TouchableOpacity
                style={[commonStyles.primaryButton, homeStyles.notifViewButton]}
                onPress={() => {
                  closeNotificationPopup();
                  if (notificationPopup.data) navigateToResultDetails(notificationPopup.data);
                }}
                activeOpacity={0.8}
              >
                <Text style={commonStyles.primaryButtonText}>{t('common:buttons.view')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={commonStyles.secondaryButton}
                onPress={closeNotificationPopup}
                activeOpacity={0.7}
              >
                <Text style={commonStyles.secondaryButtonText}>{t('common:buttons.close')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <ScrollView
        style={homeStyles.scrollView}
        contentContainerStyle={homeStyles.scrollContent}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled={true}
      >
        {/* Logo & Title */}
        <View style={homeStyles.cardscetion}>
          <Image
            source={require('../../assets/livio_logo.png')}
            style={homeStyles.logo}
            resizeMode="contain"
          />
        </View>


        {/* Main Content */}
        <View style={homeStyles.textContainer}>
          {homeData?.show_start_track === 1 ? (
            <>
              <View style={commonStyles.card}>
                <View style={homeStyles.eventInfo}>
                  <Text style={homeStyles.eventNameText}>
                    <Text style={homeStyles.eventLabel}>{t('home:Event.title')}: </Text>
                    <Text style={homeStyles.eventValue}>{homeData.next_race_name}</Text>
                  </Text>
                </View>

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

                {/* ✅ Tracking log panel — DEBUG only */}
                {API_CONFIG.DEBUG && isGPSActive && trackingLogs.length > 0 && (
                  <ScrollView
                    style={{
                      maxHeight: 200,
                      backgroundColor: '#0f172a',
                      borderRadius: 8,
                      padding: 8,
                      marginBottom: spacing.md,
                    }}
                    showsVerticalScrollIndicator={true}
                    persistentScrollbar={true}
                    nestedScrollEnabled={true}
                  >
                    {[...trackingLogs].reverse().map((entry, idx) => {
                      const time = new Date(entry.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                      return (
                        <Text
                          key={idx}
                          style={{ fontFamily: 'monospace', fontSize: 10, color: '#e2e8f0', marginBottom: 2 }}
                        >
                          {time} {entry.icon} {entry.msg}
                        </Text>
                      );
                    })}
                  </ScrollView>
                )}

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
              </View>
              {/* ✅ Queue retry button — shown after tracking stops if locations remain queued */}
              {!isGPSActive && queuedCount > 0 && participantId && eventId && (
                <TouchableOpacity
                  style={[
                    homeStyles.button,
                    { width: '100%', marginBottom: spacing.md, backgroundColor: colors.warning },
                  ]}
                  onPress={async () => {
                    try {
                      const sentCount = await locationService.processQueue(participantId, eventId);
                      const remaining = await locationQueueService.getQueueSize();
                      setQueuedCount(remaining);
                      if (sentCount > 0) {
                        toastSuccess(
                          t('home:tracking.queueProcessed'),
                          t('home:tracking.queuedSent', { count: sentCount })
                        );
                      } else {
                        toastError(t('common:errors.generic'), t('home:tracking.queueRetryFailed'));
                      }
                    } catch { /* silent */ }
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={homeStyles.buttonText}>
                    {t('home:tracking.retryQueue', { count: queuedCount })}
                  </Text>
                </TouchableOpacity>
              )}

              {/* Manual Override (DEBUG only) */}
              {/*API_CONFIG.DEBUG &&
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
                )*/}
            </>
          ) : (
            <>
              {homeData?.following_live_events && homeData.following_live_events.length > 0 && (
                <FollowingLiveEventsSection
                  events={homeData.following_live_events}
                  serverDatetime={homeData.server_datetime!}
                  onRoutePress={(event) => {
                    navigation.navigate('LiveTracking', {
                      product_app_id: event.product_app_id,
                      product_option_value_app_id: event.product_option_value_app_id,
                      event_name: event.event_name,
                      sourceScreen: 'HomeScreen',
                      sectionType: 'follower',
                      sourceTab: 'live',
                      event_source: event.event_source,
                    });
                  }}
                />
              )}
            </>
          )}
        </View>
        {/* Bottom Buttons */}
        <View style={homeStyles.buttonContainer}>
          <TouchableOpacity
            style={homeStyles.button}
            onPress={() => navigation.navigate('ParticipantScreen')}
          >
            <Text style={homeStyles.buttonText}>{t('home:button.Participant')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={homeStyles.button}
            onPress={() => navigation.navigate('FollowerSrceen')}
          >
            <Text style={homeStyles.buttonText}>{t('home:button.Fan')}</Text>
          </TouchableOpacity>
        </View>
        <View style={homeStyles.logosSection}>
          <View style={homeStyles.logosContainer}>
            <Text style={homeStyles.logosTitle}>{t('home:Logotagline')}</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={homeStyles.logosRow}
              decelerationRate="fast"
              snapToInterval={110}   // ← logoBox width + gap, snaps per logo
              snapToAlignment="start"
            >
              {PARTNER_LOGOS.map((uri, index) => (
                <View key={index} style={homeStyles.logoBox}>
                  <Image
                    source={{ uri }}
                    style={homeStyles.partnerLogo}
                    resizeMode="contain"
                  />
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default HomeScreen;