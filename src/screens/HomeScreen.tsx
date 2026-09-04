import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  AppState,
  ActivityIndicator,
  BackHandler,
  Modal,
  Platform,
  Linking,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import axios from 'axios';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Battery from 'expo-battery';
import { analyticsService } from '../services/analyticsService';
import { HomeScreenProps } from '../types/navigation';
import { AppHeader } from '../components/common/AppHeader';
import { toastSuccess, toastError } from '../../utils/toast';
import { locationService } from '../services/locationService';
import {
  gpsService, BACKGROUND_SENT_COUNT_KEY, RACE_FINISHED_KEY,
  ensureBackgroundTaskAlive, TRACKING_LOG_KEY, TrackingLogEntry,
  startBackgroundFetchKeepalive, stopBackgroundFetchKeepalive,
  isTracking, getTrackingParams, stopWatching, attachUi, detachUi, rehydrateTracking,
  LOG_UPLOADED_KEY, getFullTrackingLog,PENDING_FINISH_KEY, FINAL_SENT_COUNT_KEY,
  GPS_HEALTH_KEY,
} from '../services/gpsService';
import { QUEUE_COUNT_KEY } from '../services/locationQueueService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { locationQueueService } from '../services/locationQueueService';
import { tokenService } from '../services/tokenService';
import { API_CONFIG, getApiEndpoint, getDeviceId } from '../constants/config';
import { useNotifications, NotificationData } from '../hooks/useNotifications';
import { followerApi } from '../services/registerFollowerServices';
import { syncFollowDataFromAPI } from '../utils/followStorage';

// Styles
import { spacing, typography, commonStyles, palette, fonts } from '../styles/common.styles';
import { homeStyles } from '../styles/home.styles';
import FollowingLiveEventsSection from './FollowingLiveEventsSection';
import { useDimensions } from '../hooks/useDimensions';
import { FanEmailModal } from '../components/Fanemailmodal';
import { fanEmailStorage } from '../utils/fanEmailStorage';
import { formatClockTime, formatEventDate } from '../utils/timeFormat';
import { ANALYTICS_SCREENS, ANALYTICS_BUTTONS } from '../constants/analyticsScreens';

interface StandardApiResponse<T = any> {
  success: boolean;
  data: T;
  error: string | null;
}

export interface FollowingLiveEvent {
  product_app_id: number;
  product_option_value_app_id: number;
  event_name: string;
  event_source: string;
  event_image: string;
  race_date: string;
  race_distance: string;
  race_time: string;
  end_time: string | null;
  timezone: string;
  race_status: 'in_progress' | 'upcoming' | 'finished';
  starts_in_seconds: number;
  starts_in_hours: number;
  starts_in_minutes: number;
  starts_in_secs: number;
  race_start_ts: number;
  server_now_ts: number;
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

const ANDROID_PACKAGE = 'eu.passionforsports.livio';

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
      { data: `package:${ANDROID_PACKAGE}` }
    );
  } catch {
    // Fallback — open battery optimization list directly
    await IntentLauncher.startActivityAsync(
      'android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS'
    );
  }
};

type PermissionBlockReason = 'denied' | 'no_background_perm' | 'location_off';

/**
 * Take the runner to the page that fixes THEIR problem, and actually land on
 * it — not on App info with a list of instructions to follow.
 *
 * Android publishes an intent for the device Location toggle, so 'location_off'
 * is exact. The per-app permission page has no public intent, so:
 *   1. MANAGE_APP_PERMISSIONS -> Livio's permission list, one tap from Location.
 *   2. APPLICATION_DETAILS_SETTINGS -> App info. The old behaviour; always resolves.
 *
 * DELIBERATELY NOT USED: MANAGE_APP_PERMISSION (singular), which targets the
 * Location page itself. It requires Intent.EXTRA_USER, a Parcelable UserHandle,
 * and expo-intent-launcher can only carry plain JS values in `extra`. Without it
 * the activity still RESOLVES — so no exception is thrown and the ladder never
 * falls through — then finishes immediately. The runner sees a flash and lands
 * nowhere, which is worse than App info. It cannot be fixed from JS; reaching
 * that page needs a native module.
 *
 * Falling through is otherwise safe: IntentLauncherModule.kt wraps
 * startActivityForResult in try/catch(Throwable) -> promise.reject, so an OEM
 * that does not export a tier rejects rather than crashing. That promise only
 * settles when the user RETURNS, so a tier that does launch cannot fall through
 * and open a second screen behind it.
 *
 * iOS has no per-page deep link at all (the App-Prefs: schemes are private API
 * and get apps rejected), so openSettings() lands on Livio's own page, where
 * Location is a single row.
 */
const openLocationSettingsFor = async (reason: PermissionBlockReason): Promise<void> => {
  if (Platform.OS !== 'android') {
    Linking.openSettings().catch(() => { /* silent */ });
    return;
  }

  if (reason === 'location_off') {
    try {
      await IntentLauncher.startActivityAsync(
        IntentLauncher.ActivityAction.LOCATION_SOURCE_SETTINGS
      );
      return;
    } catch {
      // OEM without the activity — fall through to App info.
    }
  } else {
    try {
      await IntentLauncher.startActivityAsync('android.intent.action.MANAGE_APP_PERMISSIONS', {
        extra: { 'android.intent.extra.PACKAGE_NAME': ANDROID_PACKAGE },
      });
      return;
    } catch {
      // Fall through to App info.
    }
  }

  try {
    await IntentLauncher.startActivityAsync(
      IntentLauncher.ActivityAction.APPLICATION_DETAILS_SETTINGS,
      { data: `package:${ANDROID_PACKAGE}` }
    );
  } catch {
    Linking.openSettings().catch(() => { /* silent */ });
  }
};

// ==================== COMPONENT ====================

const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const { t } = useTranslation(['home', 'common']);

  // Short month names for the next-session card's date, in the app language.
  const monthsShort = useMemo(
    () => t('common:monthsShort', { returnObjects: true }) as string[],
    [t],
  );
  const { width } = useDimensions();
  const insets = useSafeAreaInsets();
  const isGestureNav = insets.bottom > 0;
  const isLandscape = width
  const [showFanEmailModal, setShowFanEmailModal] = useState(false);



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
  // ✅ 02_Home-Tracking-Active.png — session clock, odometer and send status.
  // Display only: read from gpsService, never written back into it.
  const [sessionStats, setSessionStats] = useState<{
    startedAt: number | null; distanceKm: number | null; lastSentAt: number | null;
  }>({ startedAt: null, distanceKm: null, lastSentAt: null });
  const [nowTick, setNowTick] = useState(Date.now());

  // "00:42:18" since the session began, and "12 sec ago" since the last accepted
  // position. Both recompute from `nowTick`, which only runs while tracking is on.
  const elapsedLabel = useMemo(() => {
    if (!sessionStats.startedAt) return '00:00:00';
    const secs = Math.max(0, Math.floor((nowTick - sessionStats.startedAt) / 1000));
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(Math.floor(secs / 3600))}:${pad(Math.floor((secs % 3600) / 60))}:${pad(secs % 60)}`;
  }, [sessionStats.startedAt, nowTick]);

  const lastSentLabel = useMemo(() => {
    if (!sessionStats.lastSentAt) return t('home:active.justNow');
    const secs = Math.max(0, Math.floor((nowTick - sessionStats.lastSentAt) / 1000));
    if (secs < 5) return t('home:active.justNow');
    if (secs < 60) return t('home:active.secAgo', { n: secs });
    return t('home:active.minAgo', { n: Math.floor(secs / 60) });
  }, [sessionStats.lastSentAt, nowTick, t]);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [hasPermission, setHasPermission] = useState(false);
  const [raceStartTime, setRaceStartTime] = useState<Date | null>(null);
  const [sendingInterval, setSendingInterval] = useState(30);
  const [timeUntilRace, setTimeUntilRace] = useState<string>('');
  const [serverTimeOffset, setServerTimeOffset] = useState<number>(0);
  const [showPowerSavingModal, setShowPowerSavingModal] = useState(false);
  // Location-permission gate (blocks Start) and the mid-race GPS health banner.
  const [showLocationPermissionModal, setShowLocationPermissionModal] = useState(false);
  const [permissionBlockReason, setPermissionBlockReason] = useState<PermissionBlockReason>('denied');
  // Whether the OS will still show its own Location permission page. Decides
  // BOTH what the popup's button can achieve and what its text may promise;
  // false means the button can only reach App info, so the text must say so.
  const [permissionCanAskAgain, setPermissionCanAskAgain] = useState(true);
  const [gpsHealth, setGpsHealth] = useState<string>('');
  const gpsHealthNotifiedRef = useRef(false);

  // ✅ Tracking log — DEBUG only, shows background task events live
  const [trackingLogs, setTrackingLogs] = useState<TrackingLogEntry[]>([]);

  // ✅ Battery explanation modal — shown once before system dialog
  const [showBatteryModal, setShowBatteryModal] = useState(false);

  // ✅ Early tracking warning modal — shown when race is more than 24h away
  const [showEarlyTrackingModal, setShowEarlyTrackingModal] = useState(false);

  const [showStartConfirmModal, setShowStartConfirmModal] = useState(false);

  // ✅ Notification popup state
  const [notificationPopup, setNotificationPopup] = useState<{
    visible: boolean;
    title: string;
    body: string;
    data: NotificationData | null;
  }>({ visible: false, title: '', body: '', data: null });

  // Refs
  const gpsWatchRef = useRef<{ remove: () => void | Promise<void> } | null>(null);
  const queueProcessorRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const raceStartCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appState = useRef(AppState.currentState);
  const raceStartTimeRef = useRef<Date | null>(null);
  const isGPSActiveRef = useRef<boolean>(false);
  const serverTimeOffsetRef = useRef<number>(0);
  // ✅ Set when doStartGPSTracking() bails at the permission gate. It means "the
  // runner already tapped START and confirmed — finish the job as soon as the
  // permission requirement is met", so granting Always does not make them tap
  // START and sit through the confirm popup a second time on the start line.
  // Cleared on resume, on explicit dismissal, and once a start clears the gate.
  const pendingStartRef = useRef(false);
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
    // Route on where the notification's DATA came from, not on the event type.
    //   tracking_source 'rr'  → RaceResult timing exists → ResultDetails
    //   tracking_source 'gps' → GPS-tracked (custom event, OR partner event with
    //                           race_result_status = 0) → live map
    // Partner events with RR unconfigured send a real product_option_value_app_id
    // but have no results, so the old `pov == 0` test sent them to ResultDetails
    // and it came up empty.
    const eventSource = (data.event_source as string) ?? 'custom';
    const povId = Number(data.product_option_value_app_id ?? 0);

    // Fallback for notifications queued before tracking_source shipped, and for
    // older app installs: pov 0 could only ever mean a custom event.
    const trackingSource =
      (data.tracking_source as string) ?? (povId === 0 ? 'gps' : 'rr');

    if (trackingSource === 'gps') {
      navigation.navigate('LiveTracking', {
        product_app_id: Number(data.race_id),
        product_option_value_app_id: povId,
        event_name: data.event_name,
        event_image: data.event_image,
        sourceScreen: 'FollowerDistanceScreen',
        sectionType: 'follower',
        sourceTab: 'live',
        event_source: eventSource,
      });
    } else {
      navigation.navigate('ResultDetails', {
        product_app_id: Number(data.race_id),
        product_option_value_app_id: povId,
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
  // ✅ While tracking is on, refresh the clock every second and the session
  // stats every five. Stops dead when tracking stops — nothing polls at rest.
  useEffect(() => {
    if (!isGPSActive) return;

    let cancelled = false;
    const readStats = async () => {
      try {
        const stats = await gpsService.getSessionStats();
        if (!cancelled) setSessionStats(stats);
      } catch { /* display only */ }
    };

    void readStats();
    const tick = setInterval(() => setNowTick(Date.now()), 1000);
    const stats = setInterval(() => { void readStats(); }, 5000);
    return () => { cancelled = true; clearInterval(tick); clearInterval(stats); };
  }, [isGPSActive]);

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
    if (Platform.OS !== 'android') {
      try {
        return await Battery.isLowPowerModeEnabledAsync();
      } catch {
        return false;
      }
    }

    try {
      // getPowerStateAsync is more reliable than isLowPowerModeEnabledAsync
      // on MIUI — it reads the full power state object
      const powerState = await Battery.getPowerStateAsync();
      console.log('🔋 Full power state:', powerState);
      return powerState.lowPowerMode === true;
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

      // ✅ Always fetch home data — a logged-out fan still needs
      //    following_live_events (keyed on device_id). The token-only work
      //    (GPS permissions + queue size, which are participant-tracking
      //    concerns) stays gated behind a present token.
      if (token) {
        await Promise.all([
          fetchHomeData(),
          checkPermissions(),
          loadQueueSize(),
        ]);
      } else {
        if (API_CONFIG.DEBUG) console.log('⚠️ No token - fetching follower data only');
        await fetchHomeData();
      }
    } catch (error) {
      if (API_CONFIG.DEBUG) console.error('❌ Error initializing screen:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchHomeData = useCallback(async (fresh: boolean = false): Promise<HomeData | null> => {
    try {
      const token = await tokenService.getToken();
      const deviceId = await getDeviceId();

      // ✅ Do NOT bail out when there is no token. A not-logged-in fan still
      //    needs home data (following_live_events) to see who they follow —
      //    that section is keyed on device_id, which getDeviceId() provides
      //    regardless of login. We only set hasToken so the participant-only
      //    UI (start-tracking card) stays hidden for logged-out users; the
      //    fetch itself proceeds either way. When a token IS present we send
      //    the auth headers; when it isn't we send a plain device_id body so
      //    the server returns the follower payload only.
      setHasToken(!!token);

      const headers = token
        ? await API_CONFIG.getHeaders()
        : { 'Content-Type': 'application/json' };
      const requestBody: { device_id: string; fresh?: number } = {
        device_id: deviceId,
      };
      // ✅ When pressing Start, request a cache-bypassed read so a just-edited
      // race start time is reflected (the home response is cached ~45s server-side).
      if (fresh) requestBody.fresh = 1;

      if (API_CONFIG.DEBUG) console.log('📤 Fetching home data');

      if (API_CONFIG.DEBUG) console.log(requestBody);

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
        return null;
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

        // ✅ Return the fresh data so callers (doStartGPSTracking) can use it
        // synchronously without waiting for the state update to land.
        return response.data.data as HomeData;
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
        return null;
      }

      // ✅ Handle other errors silently
      if (API_CONFIG.DEBUG) {
        console.log('⚠️ Network error - keeping current state');
      }
    } finally {
      setLoading(false);
    }
    return null;
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
      // ── PERMISSION GATE ─────────────────────────────────────────────────
      // This used to accept FOREGROUND permission alone and start tracking.
      // That is what broke the 2026-08-23 race: a runner with "While Using the
      // App" passed the check, saw a green GPS-Active banner, and recorded
      // nothing once the phone went in a pocket — seven sessions, one of them
      // for nine hours, none of which ever recovered.
      //
      // Background ("Always") is not optional for a race tracker, so we block
      // and tell the runner instead of starting a session that cannot work.
      //
      // CHECK ONLY — do not request here. On Android 11+ the background request
      // is what makes the OS open Livio's Location permission page, and the OS
      // grants that routing roughly once: request again straight after and it
      // returns silently having shown nothing. Requesting here therefore burned
      // the one useful ask BEFORE the popup appeared, leaving the popup's
      // button with nothing left to trigger — it looked completely dead. The
      // ask now belongs to that button, which is the whole point of it.
      const perms = await gpsService.getPermissionState();
      setHasPermission(perms.foreground);
      setPermissionCanAskAgain(perms.canAskAgain);

      if (!perms.foreground || !perms.background) {
        setPermissionBlockReason(perms.foreground ? 'no_background_perm' : 'denied');
        // Arm the resume — see pendingStartRef. Without this the runner grants
        // Always and comes back to a stopped tracker.
        pendingStartRef.current = true;
        setShowLocationPermissionModal(true);
        return;
      }

      // Permissions can ALL be granted while the phone's master Location switch
      // is off. Nothing above catches that, so the session used to start, show
      // "GPS Active", and record nothing — the 23 Aug failure. Blocking here is
      // what makes the 'location_off' deep-link reachable at start time.
      if (!(await gpsService.isLocationServiceEnabled())) {
        setPermissionBlockReason('location_off');
        pendingStartRef.current = true;
        setShowLocationPermissionModal(true);
        return;
      }

      // Past the gate — disarm, so a later unrelated foreground cannot fire a
      // phantom start.
      pendingStartRef.current = false;

      // ✅ Re-fetch home data FRESH (cache-bypassed) at the moment Start is
      // pressed. The organiser can edit the race start_hour right before the
      // gun; the home response is cached ~45s server-side, and the session
      // captures the race start time ONCE below — so a stale value makes the
      // race-start gate hold every fix as "not started yet" against the wrong
      // time (the missed-start incident). Use the RETURNED value directly:
      // reading the homeData state right after the await won't reflect the
      // update yet. Fall back to existing state if the fresh fetch fails, so an
      // offline start still works.
      const fresh = await fetchHomeData(true);
      const raceData = fresh ?? homeData;

      // Parse race start time
      if (raceData?.next_race_date && raceData?.next_race_time) {
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

          const serverDatetimeStr = raceData?.server_datetime;

          if (serverDatetimeStr) {
            const serverFakeMs = new Date(serverDatetimeStr.replace(' ', 'T') + 'Z').getTime();
            const raceFakeMs = new Date(`${raceData.next_race_date}T${raceData.next_race_time}Z`).getTime();

            // How many ms from event-tz now until race start (negative = already started)
            const msUntilRace = raceFakeMs - serverFakeMs;

            // Anchor to real UTC now — no device timezone involved
            const raceTime = new Date(Date.now() + msUntilRace);

            if (!isNaN(raceTime.getTime())) {
              setRaceStartTime(raceTime);
              raceStartTimeRef.current = raceTime;

              if (API_CONFIG.DEBUG) {
                console.log('✅ server_datetime (event tz):', serverDatetimeStr);
                console.log('✅ race_time (event tz):', `${raceData.next_race_date} ${raceData.next_race_time}`);
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
      if (raceData?.next_race_interval_for_location) {
        const rawInterval = raceData.next_race_interval_for_location;
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

      // ✅ participant/event ids — prefer the fresh fetch (an edit could in
      // principle change them) but fall back to the derived state values.
      const startParticipantId = raceData?.next_race_participant_app_id ?? participantId;
      const startEventId = raceData?.next_race_id ?? eventId;

      // ✅ START PING — notify the backend that tracking started, the instant the
      // user taps start. Written to oc_tracking_starts_app independently of
      // coordinates, so Home detects a restart-after-stop even if the network
      // drops and no coordinates flow for a while. Fire-and-forget: it must never
      // block or fail the start of tracking.
      (async () => {
        try {
          if (!startParticipantId || !startEventId) return;
          const headers = await API_CONFIG.getHeaders();
          await axios.post(
            getApiEndpoint(API_CONFIG.ENDPOINTS.SAVE_TRACKING_START),
            { participantId: startParticipantId, eventId: startEventId },
            { headers, timeout: API_CONFIG.TIMEOUT },
          );
          if (API_CONFIG.DEBUG) console.log('✅ start ping sent', startParticipantId, startEventId);
        } catch (e) {
          if (API_CONFIG.DEBUG) console.log('⚠️ start ping failed (non-blocking)', e);
        }
      })();

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
        String(startParticipantId)!,  // ✅ passed to background task via AsyncStorage
        String(startEventId)!,        // ✅ passed to background task via AsyncStorage
        t('home:tracking.backgroundNotificationTitle'),       // ✅ from language file
        t('home:tracking.backgroundNotificationBody'),        // ✅ from language file
        raceData?.next_race_category_id,                      // ✅ movement threshold per sport
        raceStartTimeRef.current?.toISOString() ?? null,      // ✅ background task race check
        raceData?.manual_start,                               // ✅ skip race check if manual
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

      if (raceData?.manual_start !== 1) {
        startRaceStartChecker();
      }

      let message = '';
      if (raceData?.manual_start === 1) {
        message = t('home:tracking.manualStartEnabled');
      } else if (raceAlreadyStarted) {
        message = t('home:tracking.dataSendingStarted');
      } else if (raceStartTimeRef.current) {
        message = t('home:tracking.waitingForRace');
      } else {
        message = t('home:tracking.waitingForRaceNoTime');
      }

      toastSuccess(t('home:tracking.gpsActivated'), message);
      await analyticsService.markAsParticipant('start_tracking');
      // Records its own start timestamp, so duration is computed by the service
      // and doesn't depend on gpsService session state.
      void analyticsService.logTrackingStarted({
        eventId,
        manualStart: raceData?.manual_start === 1,
        intervalSeconds: trackingParamsRef.current?.intervalSeconds,
      });
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
    fetchHomeData,
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

  // Opens the confirm popup (button now calls this instead of startGPSTracking)
  const confirmStartTracking = useCallback(() => {
    if (!participantId || !eventId) {
      toastError(t('home:errors.missingInfo'), t('home:errors.missingInfoDescription'));
      return;
    }
    setShowStartConfirmModal(true);
  }, [participantId, eventId, t]);

  // User taps "Yes" → close popup, run the real start flow
  const handleStartConfirmYes = useCallback(async () => {
    setShowStartConfirmModal(false);
    await startGPSTracking();
  }, [startGPSTracking]);

  // User taps "No" → just close, do nothing
  const handleStartConfirmNo = useCallback(() => {
    setShowStartConfirmModal(false);
  }, []);

  // ✅ User confirms early tracking — proceed anyway
  const handleEarlyTrackingConfirm = useCallback(async () => {
    setShowEarlyTrackingModal(false);
    await doStartGPSTracking();
  }, [doStartGPSTracking]);

  // ✅ User cancels early tracking — do nothing
  const handleEarlyTrackingCancel = useCallback(() => {
    setShowEarlyTrackingModal(false);
  }, []);

  // `opts` is optional and defensively typed: this function is also passed
  // straight to a Pressable's onPress (see the tracking button below), which
  // invokes it with a GestureResponderEvent. That object has no
  // raceAlreadyFinished property, so the flag reads as undefined and we fall
  // back to the AsyncStorage check — which is the correct behaviour for a
  // manual stop.
  const stopGPSTracking = useCallback(async (opts?: { raceAlreadyFinished?: boolean }) => {
    // ✅ FIRST — read the actual sent count from AsyncStorage BEFORE we tear
    //    anything down. When auto-stop fires after a background→active
    //    transition, the 1s sync interval hasn't run (JS suspended in bg), so
    //    React state `locationUpdateCount` may still be 0 even though
    //    Transistor sent dozens of locations. AsyncStorage is the source of
    //    truth — read it here so the stop-toast and log upload show real numbers.
    let actualSentCount = locationUpdateCount;
    try {
      const countStr = await AsyncStorage.getItem(BACKGROUND_SENT_COUNT_KEY);
      if (countStr) {
        const parsed = parseInt(countStr);
        if (!isNaN(parsed) && parsed >= 0) actualSentCount = parsed;
      }
    } catch { /* silent — fall back to React state */ }

    if (gpsWatchRef.current) {
      // ✅ Await full teardown before the log upload below. remove() →
      // _doFullStop() stops Transistor, appends the "🛑 Tracking stopped" entry,
      // and flushes — awaiting it guarantees that entry is in the buffer before
      // getFullTrackingLog() reads it, and that no late fix lands mid-upload.
      // try/catch so a teardown hiccup can't block the upload/toast.
      try { await gpsWatchRef.current.remove(); } catch { /* silent */ }
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
    // NOTE: do NOT clear BACKGROUND_SENT_COUNT_KEY here — the stop-path drain
    // below (and finishBackgroundStop) still need it for an accurate total.
    // It's cleared at the very end of this function instead (see below).

    await stopBackgroundFetchKeepalive();

    // Skip the stop-path drain if the race already finished — the background
    // finish path (or the live finish path) already drained and tore down, so
    // re-draining here would only re-detect finished=1 and trigger a redundant
    // finishBackgroundStop/_doFullStop (idempotent, but produces a stray 🏆/🛑).
    // The auto-stop callers CLEAR RACE_FINISHED_KEY before calling us (to stop
    // their own 1s/AppState tick re-firing), so reading the key here always saw
    // false — the guard below never engaged, the stop-path drain re-ran, and
    // _uploadTrackingLogOnFinish fired a SECOND time. That produced 43 duplicate
    // rows in oc_tracking_logs_app on 2026-08-23 (28% of all rows), uploaded
    // 0-5s apart with identical counters. It also made every GPS-detected finish
    // report end_reason:'manual_stop' to analytics.
    // Callers that already consumed the key now tell us so explicitly.
    let raceAlreadyFinished = opts?.raceAlreadyFinished === true;
    if (!raceAlreadyFinished) {
      try { raceAlreadyFinished = (await AsyncStorage.getItem(RACE_FINISHED_KEY)) === '1'; } catch { /* silent */ }
    }

    // Drain if the race is still running OR anything is still queued. The
    // raceAlreadyFinished guard exists to avoid a redundant teardown, not to
    // abandon fixes: now that a failed drain correctly LEAVES fixes in the queue
    // (see locationService's data-loss guard), skipping this unconditionally on
    // the finish path would strand them. processQueue's own deferred-finish logic
    // only tears down once the queue is actually empty, so this is safe to run.
    const queuedBeforeStop = await locationQueueService.getQueueSize();
    if (participantId && eventId && (!raceAlreadyFinished || queuedBeforeStop > 0)) {
      try {
        const drained = await locationService.processQueue(participantId, eventId);
        // processQueue bumps BACKGROUND_SENT_COUNT_KEY per drained fix now, so we
        // re-read the live counter below instead of adding `drained` (that would
        // double-count). Keep the log for visibility.
        if (drained > 0 && API_CONFIG.DEBUG) {
          console.log(`✅ Drained ${drained} queued locations on stop`);
        }
      } catch { /* silent */ }
    }

    const remaining = await locationQueueService.getQueueSize();

    // Re-read the counter — processQueue may have bumped it (and, on finish,
    // teardown may have cleared it). This is the authoritative post-drain total.
    try {
      const afterStr = await AsyncStorage.getItem(BACKGROUND_SENT_COUNT_KEY);
      if (afterStr !== null) {
        const parsedAfter = parseInt(afterStr);
        // Only accept a HIGHER value. If the finish path already tore down and
        // cleared the counter mid-drain, this read could be low/absent — never
        // let that pull the total below what we captured pre-drain.
        if (!isNaN(parsedAfter) && parsedAfter > actualSentCount) actualSentCount = parsedAfter;
      }
    } catch { /* silent */ }

    // On the background-finish path the counter was already cleared by
    // _doFullStop; fall back to the preserved final total so the toast matches
    // the DB (12), not stale state.
    try {
      const finalStr = await AsyncStorage.getItem(FINAL_SENT_COUNT_KEY);
      if (finalStr !== null) {
        const pf = parseInt(finalStr);
        if (!isNaN(pf) && pf > actualSentCount) actualSentCount = pf;
      }
    } catch { /* silent */ }

    setQueuedCount(remaining);

    if (participantId && eventId) {
      try {
        // ✅ If the background auto-stop path already uploaded the log when the
        // finish was crossed (LOG_UPLOADED_KEY === '1'), skip re-uploading. For a
        // manual stop, or a finish crossed while foregrounded, the flag is unset
        // and we upload here as before.
        const alreadyUploaded = await AsyncStorage.getItem(LOG_UPLOADED_KEY);
        if (alreadyUploaded !== '1') {
          const logs = await getFullTrackingLog();
          if (logs.length > 0) {
            // Claim BEFORE the network call, mirroring _uploadTrackingLogOnFinish.
            // Setting the flag only afterwards left a multi-second window in which
            // the background finish path read "not uploaded" and uploaded the same
            // log again — the duplicate rows seen on 2026-08-23. Released again if
            // the save fails so the other path can still retry.
            await AsyncStorage.setItem(LOG_UPLOADED_KEY, '1');
            const uploaded = await locationService.saveTrackingLog(
              participantId,
              eventId,
              logs,
              actualSentCount,   // ✅ was: locationUpdateCount
              remaining,
            );
            if (uploaded === false) {
              try { await AsyncStorage.removeItem(LOG_UPLOADED_KEY); } catch { /* silent */ }
            }
          }
        }
      } catch { /* silent */ }
    }

    fetchHomeData();

    toastSuccess(
      t('home:tracking.gpsStopped'),
      t('home:tracking.trackingStopped', {
        sent: actualSentCount,   // ✅ was: locationUpdateCount
        queued: remaining,
      })
    );
    
    // Both actualSentCount and remaining are final at this point (post-drain,
    // post-fallback reads). On a background finish this is usually a no-op:
    // gpsService.finishBackgroundStop already consumed the session token.
    void analyticsService.logTrackingCompleted({
      endReason: raceAlreadyFinished ? 'finish_crossed' : 'manual_stop',
      pointsSent: actualSentCount,
      queuedRemaining: remaining,
      // Race context: tracking_started already sends event_id, so without these
      // a completed session could not be tied back to the race it belonged to.
      eventId,
      raceName: homeData?.next_race_name,
    });

    AsyncStorage.removeItem(BACKGROUND_SENT_COUNT_KEY).catch(() => { });
    AsyncStorage.removeItem(FINAL_SENT_COUNT_KEY).catch(() => { });
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
    initializeScreen();
  }, [initializeScreen]);

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

      // ✅ GPS health — written from native/headless contexts that cannot see
      // React state, so AsyncStorage is the only channel. Drives the warning
      // banner below. Empty string = healthy.
      try {
        const health = await AsyncStorage.getItem(GPS_HEALTH_KEY);
        setGpsHealth(health ?? '');

        // Notify ONCE per session. A banner alone is useless to a runner with
        // the phone in a pocket for hours — which is precisely the population
        // this failure hits. Ref-guarded so the 1s tick cannot spam.
        if (health && !gpsHealthNotifiedRef.current) {
          gpsHealthNotifiedRef.current = true;
          Notifications.scheduleNotificationAsync({
            content: {
              title: t('home:gpsHealth.notificationTitle'),
              body: t('home:gpsHealth.notificationBody'),
            },
            trigger: null,   // deliver immediately
          }).catch(() => { /* silent — a failed notification must not break tracking */ });
        }
        if (!health) gpsHealthNotifiedRef.current = false;   // re-arm after recovery
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
          await stopGPSTracking({ raceAlreadyFinished: true });
        }
      } catch { /* silent */ }

    }, 1000);
    return () => clearInterval(interval);
  }, [isGPSActive, calculateTimeUntilRace, stopGPSTracking]);

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

        // ✅ Re-arm the SDK for THIS JS context before anything else. On a warm
        // reopen after a swipe-away the gpsService module is not re-evaluated,
        // so the module-level rehydrate never runs and ready() is never called
        // here — the engine records to its own database and JS hears nothing.
        // This is what actually restores delivery; re-registering listeners
        // alone does not. It also re-attaches the listeners itself.
        await rehydrateTracking();

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

  // ✅ RESUME A PENDING START WHEN THE RUNNER COMES BACK FROM SETTINGS.
  //
  // The permission modal's button closes the modal and sends the runner to the
  // OS Location page. Granting "Allow all the time" there and returning used to
  // land on a stopped tracker — the main AppState listener below handles the
  // power-saving modal and the isGPSActive watchdog, but had no branch for a
  // start waiting on permission, so the runner had to tap START and confirm
  // again. At the start line that is the worst moment to repeat yourself.
  //
  // Deliberately its own listener rather than a branch in the effect below:
  // that one already depends on eight values and re-subscribes whenever any of
  // them changes. doStartGPSTracking is read through a ref so this effect can
  // subscribe once and never churn.
  const doStartGPSTrackingRef = useRef(doStartGPSTracking);
  doStartGPSTrackingRef.current = doStartGPSTracking;

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active' || !pendingStartRef.current) return;

      void (async () => {
        try {
          const perms = await gpsService.getPermissionState();
          setHasPermission(perms.foreground);

          const satisfied =
            perms.foreground &&
            perms.background &&
            (await gpsService.isLocationServiceEnabled());

          if (satisfied) {
            // Clear FIRST — the inline-grant path can resolve for the same
            // grant, and whichever runs second must find nothing pending.
            pendingStartRef.current = false;
            setShowLocationPermissionModal(false);
            await doStartGPSTrackingRef.current();
            return;
          }

          // Came back without granting. The button already dismissed the modal,
          // so without this the runner faces a bare screen and no explanation
          // of why tracking still is not running. Put it back and stay armed.
          setShowLocationPermissionModal(true);
        } catch { /* silent — a later foreground retries */ }
      })();
    });

    return () => sub.remove();
  }, []);

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
                await stopGPSTracking({ raceAlreadyFinished: true });
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

              // drain the backlog; counter is maintained inside processQueue now
              await locationService.processQueue(participantId, eventId);
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
  const handleFanPress = useCallback(async () => {
    const alreadyPrompted = await fanEmailStorage.hasBeenPrompted();
    const localCustomerId = await tokenService.getCustomerId();

    if (alreadyPrompted || localCustomerId) {
      analyticsService.logInteraction(ANALYTICS_SCREENS.HOME, ANALYTICS_BUTTONS.FAN_MODE);
      // Already asked once on this device — skip modal, go straight in
      navigation.navigate('FanScreen'); // swap for your real fan destination
      return;
    }

    setShowFanEmailModal(true);
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      const checkTokenAndPoll = async () => {
        const token = await tokenService.getToken();

        // ✅ Poll for everyone — logged-out fans need following_live_events to
        //    refresh too. hasToken still reflects login state (it gates the
        //    participant-only UI), but the fetch + poll run either way.
        setHasToken(!!token);

        if (API_CONFIG.DEBUG) {
          console.log(token
            ? '📡 Home screen focused - Fetching data'
            : '📡 Home screen focused - Fetching follower data (no token)');
        }
        fetchHomeData();

        const interval = setInterval(() => {
          if (API_CONFIG.DEBUG) console.log('🔄 Polling home data');
          fetchHomeData();
        }, API_CONFIG.HOME_DATA_POLL_INTERVAL);

        return interval;
      };

      let intervalId: ReturnType<typeof setInterval> | null = null;

      checkTokenAndPoll().then(interval => {
        intervalId = interval;
      });

      return () => {
        if (intervalId) {
          clearInterval(intervalId);
          if (API_CONFIG.DEBUG) console.log('📴 Unfocused - Stopped polling');
        }
      };
    }, [fetchHomeData])
  );

  // ✅ Drain a PENDING FINISH — runs regardless of isGPSActive, on mount and on
  // every foreground. Covers the case where a background finish uploaded nothing
  // (app reopened mid-finish) or the session was torn down before the normal stop
  // path ran. Side-effect-free: uploads the log only, no toast / no GPS-state
  // changes. Deduped by LOG_UPLOADED_KEY. IDs come from PENDING_FINISH_KEY, which
  // survives teardown (unlike component state, empty on cold start).
  useEffect(() => {
    let cancelled = false;

    const drainPendingFinish = async () => {
      try {
        const pendingStr = await AsyncStorage.getItem(PENDING_FINISH_KEY);
        if (!pendingStr || cancelled) return;

        const alreadyUploaded = (await AsyncStorage.getItem(LOG_UPLOADED_KEY)) === '1';
        if (!alreadyUploaded) {
          let pid = '', eid = '';
          try {
            const p = JSON.parse(pendingStr);
            pid = p?.participantId ?? '';
            eid = p?.eventId ?? '';
          } catch { /* malformed — nothing to upload */ }

          if (pid && eid) {
            const logs = await getFullTrackingLog();
            if (logs.length > 0) {
              const remaining = await locationQueueService.getQueueSize();
              const sentStr = await AsyncStorage.getItem(BACKGROUND_SENT_COUNT_KEY);
              const sent = sentStr ? (parseInt(sentStr) || 0) : 0;
              await locationService.saveTrackingLog(pid, eid, logs, sent, remaining);
              await AsyncStorage.setItem(LOG_UPLOADED_KEY, '1');
            }
          }
        }

        if (!cancelled) {
          // Only clear PENDING_FINISH_KEY (our concern: the log upload).
          // Leave RACE_FINISHED_KEY for the 1s timer, which uses it to run
          // stopGPSTracking() for the UI/engine teardown when a session is still
          // active. Clearing it here would skip that teardown and leave the live
          // UI showing for a finished race.
          await AsyncStorage.removeItem(PENDING_FINISH_KEY);
        }
      } catch { /* silent — flag persists, a later foreground retries */ }
    };

    drainPendingFinish();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') drainPendingFinish();
    });
    return () => { cancelled = true; sub.remove(); };
  }, []);

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
      <SafeAreaView style={commonStyles.container} edges={['bottom']}>
        <AppHeader title={t('common:band.home')} logoimg showLogo={true} />
        <View style={commonStyles.centerContainer}>
          <ActivityIndicator size="large" color={palette.navy} />
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
    <SafeAreaView style={commonStyles.container} edges={isLandscape && !isGestureNav ? ['left', 'right'] : ['bottom']}>
      <AppHeader title={t('common:band.home')} logoimg showLogo={true} />

      {Platform.OS === 'android' && (
        <Modal
          transparent
          visible={showBatteryModal}
          animationType="fade"
          statusBarTranslucent
        >
          <View style={homeStyles.notifBackdrop}>
            <View style={homeStyles.notifWrapper}>
              <View style={homeStyles.notifCard}>
                <View style={homeStyles.notifIconWrapper}>
                  <Ionicons name="battery-charging" size={36} color={palette.navy} />
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

                </View>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* ✅ Start tracking confirmation */}
      <Modal
        transparent
        visible={showStartConfirmModal}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={handleStartConfirmNo}
      >
        <View style={homeStyles.notifBackdrop}>
          <View style={homeStyles.notifWrapper}>
            <View style={homeStyles.notifCard}>
              <View style={homeStyles.notifIconWrapper}>
                <Ionicons name="navigate-circle-outline" size={36} color={palette.navy} />
              </View>
              <Text style={homeStyles.notifTitle}>{t('home:startConfirm.title')}</Text>
              <Text style={homeStyles.notifBody}>{t('home:startConfirm.message')}</Text>
              <View style={homeStyles.notifButtonContainer}>
                <TouchableOpacity
                  style={[commonStyles.primaryButton, homeStyles.notifViewButton]}
                  onPress={handleStartConfirmYes}
                  activeOpacity={0.8}
                >
                  <Text style={commonStyles.primaryButtonText}>{t('home:startConfirm.yes')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={commonStyles.secondaryButton}
                  onPress={handleStartConfirmNo}
                  activeOpacity={0.7}
                >
                  <Text style={commonStyles.secondaryButtonText}>{t('home:startConfirm.no')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

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
                <Ionicons name="time-outline" size={36} color={palette.warning} />
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

      {/* ✅ Location-permission modal — blocks Start, and is also reachable by
          tapping the mid-race health banner. Same notif* skeleton as every
          other modal on this screen. */}
      <Modal
        transparent
        visible={showLocationPermissionModal}
        animationType="fade"
        statusBarTranslucent
      >
        <View style={homeStyles.notifBackdrop}>
          <View style={homeStyles.notifWrapper}>
            <View style={homeStyles.notifCard}>
              <View style={homeStyles.notifIconWrapper}>
                <Ionicons name="location-outline" size={36} color={palette.danger} />
              </View>
              <Text style={homeStyles.notifTitle}>{t('home:gpsHealth.title')}</Text>
              <Text style={homeStyles.notifBody}>
                {/* Three distinct problems, three distinct instructions: turn the
                    phone's Location on, grant the permission at all, or upgrade
                    While-Using to Always. Collapsing them tells most runners to
                    do the wrong thing. */}
                {permissionBlockReason === 'location_off'
                  ? t('home:gpsHealth.blockedBodyLocationOff')
                  : permissionBlockReason === 'denied'
                    ? t('home:gpsHealth.blockedBodyDenied')
                    : t('home:gpsHealth.blockedBody')}
              </Text>
              {/* Shown wherever the button cannot land on the exact page — which
                  on Android's permission route is still the case, since the one
                  intent that targets the Location page needs a Parcelable extra
                  JS cannot send. Android's location_off deep-link IS exact, so
                  that combination alone gets no extra line. */}
              {!(Platform.OS === 'android' && permissionBlockReason === 'location_off') && (
                <Text style={homeStyles.notifBody}>
                  {Platform.OS === 'ios'
                    ? (permissionBlockReason === 'location_off'
                        ? t('home:gpsHealth.stepsLocationOffIos')
                        : t('home:gpsHealth.stepsIos'))
                    : permissionCanAskAgain
                      ? t('home:gpsHealth.stepsAndroid')
                      : t('home:gpsHealth.stepsAndroidSettings')}
                </Text>
              )}
              <View style={homeStyles.notifButtonContainer}>
                <TouchableOpacity
                  style={[commonStyles.primaryButton, homeStyles.notifViewButton]}
                  onPress={() => {
                    setShowLocationPermissionModal(false);
                    void (async () => {
                      // Ask the OS FIRST. On Android 11+ a background-location
                      // request cannot be answered by a dialog, so the system
                      // itself opens Livio's Location permission page with
                      // "Allow all the time" — the page the old start-tracking
                      // flow landed on. A settings intent can never reach it
                      // (that needs a Parcelable extra JS cannot send), so this
                      // is the only route to it, and it can also return granted
                      // outright. Only once the OS refuses to ask again does a
                      // settings trip become the last resort.
                      if (permissionBlockReason !== 'location_off') {
                        try {
                          const t0 = Date.now();
                          const perms = await gpsService.requestPermissionsDetailed();
                          setHasPermission(perms.foreground);
                          if (perms.background) {
                            // Granted outright, without ever leaving the app —
                            // on Android 11+ the OS opens Livio's Location page
                            // itself. This used to `return` here, which left
                            // permission correct and the start abandoned: the
                            // runner had to tap START and confirm all over
                            // again. Finish what they already asked for.
                            // Clear the ref FIRST so the AppState resume below
                            // sees nothing pending and cannot start a second time.
                            if (pendingStartRef.current) {
                              pendingStartRef.current = false;
                              await doStartGPSTracking();
                            }
                            return;
                          }
                          // Whether the OS actually SHOWED anything is not in
                          // its answer: a silent auto-deny and a real refusal
                          // look identical, and canAskAgain stays true for both.
                          // Elapsed time separates them — a screen the runner
                          // read and dismissed cannot come back in a few ms.
                          // Without this the button silently did nothing.
                          if (Date.now() - t0 > 700) return;
                        } catch {
                          // fall through to settings
                        }
                      }
                      await openLocationSettingsFor(permissionBlockReason);
                    })();
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={commonStyles.primaryButtonText}>{t('home:gpsHealth.openSettings')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={commonStyles.secondaryButton}
                  onPress={() => {
                    // Backing out cancels the start — disarm, or a later
                    // foreground would fire a start the runner declined.
                    pendingStartRef.current = false;
                    setShowLocationPermissionModal(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={commonStyles.secondaryButtonText}>{t('common:buttons.close')}</Text>
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
      >
        <View style={homeStyles.notifBackdrop}>
          <View style={homeStyles.notifWrapper}>
            <View style={homeStyles.notifCard}>

              {/* Icon */}
              <View style={homeStyles.notifIconWrapper}>
                <Ionicons name="battery-dead-outline" size={36} color={palette.danger} />
              </View>
              <Text style={homeStyles.notifTitle}>{t('home:powerSaving.title')}</Text>
              {/* Platform-specific on purpose. This previously read
                  t('home:powerSaving.message'), a key that exists in NO locale
                  file — all three define messageAndroid/messageIos — so the
                  modal rendered the literal string "home:powerSaving.message"
                  to users. iOS has no deep link to Low Power Mode, hence the
                  two different texts. */}
              <Text style={homeStyles.notifBody}>
                {Platform.OS === 'android'
                  ? t('home:powerSaving.messageAndroid')
                  : t('home:powerSaving.messageIos')}
              </Text>
              <View style={homeStyles.notifButtonContainer}>
                {Platform.OS === 'android' ? (
                  <>
                    <TouchableOpacity
                      style={[commonStyles.primaryButton, homeStyles.notifViewButton]}
                      onPress={openPowerSavingSettings}
                      activeOpacity={0.8}
                    >
                      <Text style={commonStyles.primaryButtonText}>{t('home:powerSaving.disable')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={commonStyles.secondaryButton}
                      onPress={() => setShowPowerSavingModal(false)}
                      activeOpacity={0.7}
                    >
                      <Text style={commonStyles.secondaryButtonText}>{t('common:buttons.close')}</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  // iOS: no deep link to Low Power Mode exists, so a Settings button is
                  // pointless. Instruction text does the work; this only acknowledges.
                  <TouchableOpacity
                    style={[commonStyles.primaryButton, homeStyles.notifViewButton]}
                    onPress={() => setShowPowerSavingModal(false)}
                    activeOpacity={0.8}
                  >
                    <Text style={commonStyles.primaryButtonText}>{t('common:buttons.gotIt')}</Text>
                  </TouchableOpacity>
                )}
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
              style={{ position: 'absolute', top: 16, right: 16, width: 32, height: 32, borderRadius: 16, backgroundColor: palette.fill, justifyContent: 'center', alignItems: 'center', zIndex: 10 }}
              onPress={closeNotificationPopup}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={20} color={palette.textMuted} />
            </TouchableOpacity>

            {/* Icon */}
            <View style={homeStyles.notifIconWrapper}>
              <Ionicons name="notifications" size={36} color={palette.navy} />
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
        {/* Hero — the mark itself is in the header band above. */}
        <View style={homeStyles.cardscetion}>
          <Text style={homeStyles.title}>{t('home:hero.title')}</Text>
          <Text style={homeStyles.subtitle}>{t('home:hero.subtitle')}</Text>
        </View>


        {/* Main Content */}
        <View style={homeStyles.textContainer}>
          {homeData?.show_start_track === 1 ? (
            <>
              <Text style={homeStyles.sectionLabel}>{t('home:sections.nextSession')}</Text>
              <View style={commonStyles.card}>
                {/* 01_Home.png: the event NAME leads the card, then a single
                    meta line carrying the date and the start time. The old
                    "Event name: x" / "Date: y" label prefixes are not in the
                    deck and pushed the values down to caption size. */}
                <Text style={homeStyles.eventName} numberOfLines={2}>
                  {homeData.next_race_name}
                </Text>

                <View style={homeStyles.eventMetaRow}>
                  <Ionicons name="calendar-outline" size={16} color={palette.textMuted} />
                  <Text style={homeStyles.eventMetaText}>
                    {formatEventDate(homeData.next_race_date, monthsShort)}
                  </Text>
                  {!!homeData.next_race_time && (
                    <>
                      <Ionicons name="time-outline" size={16} color={palette.textMuted} />
                      <Text style={homeStyles.eventMetaText}>
                        {formatClockTime(homeData.next_race_time)}
                      </Text>
                    </>
                  )}
                </View>

                <View style={homeStyles.cardDivider} />
                {/* Manual Start Indicator */}
                {homeData?.manual_start === 1 && (
                  <View style={[homeStyles.trackingStatus, { backgroundColor: palette.warningBg }]}>
                    <Ionicons name="lock-open-outline" size={16} color={palette.warning} />
                    <View style={{ flex: 1 }}>
                      <Text style={[homeStyles.trackingStatusText, { color: palette.warning }]}>
                        {t('home:status.manualStartEnabled')}
                      </Text>
                      <Text style={[homeStyles.trackingCountText, { color: palette.warning }]}>
                        {t('home:status.manualStartDescription')}
                      </Text>
                    </View>
                  </View>
                )}
                {/* ✅ Tracking status — PRODUCTION visible (not DEBUG-gated).
                    A runner who starts before race time sees GPS active but no
                    data is sent until the start time passes. Without this they
                    assume it's broken (it isn't) and stop it — exactly the
                    missed-start incident. Show a clear pre-race / sending state. */}
                {isGPSActive && (
                  <>
                    {/* Session clock — 02_Home-Tracking-Active.png */}
                    <View style={homeStyles.activeCard}>
                      <View style={homeStyles.activeStatusRow}>
                        <View style={homeStyles.activeDot} />
                        <Text style={homeStyles.activeStatusText}>
                          {isSendingData
                            ? t('home:active.trackingActive')
                            : t('home:status.gpsActive')}
                        </Text>
                      </View>

                      <Text style={homeStyles.activeClock}>{elapsedLabel}</Text>

                      {!!homeData?.next_race_name && (
                        <Text style={homeStyles.activeEvent} numberOfLines={2}>
                          {homeData.next_race_name}
                        </Text>
                      )}

                      {!isSendingData && timeUntilRace && (
                        <Text style={homeStyles.activeEvent}>
                          {homeData?.manual_start === 1
                            ? t('home:status.manualStartReady')
                            : t('home:status.raceStartsIn', { time: timeUntilRace })}
                        </Text>
                      )}
                    </View>

                    {/* Distance covered and whether everything reached the server */}
                    <View style={homeStyles.statCard}>
                      <Text style={homeStyles.sectionLabel}>{t('home:active.distance')}</Text>
                      <Text style={homeStyles.statValue}>
                        {sessionStats.distanceKm != null
                          ? `${sessionStats.distanceKm.toFixed(1)} ${t('units.km', 'km')}`
                          : '—'}
                      </Text>

                      <View style={homeStyles.sendRow}>
                        <Ionicons
                          name={queuedCount > 0 ? 'time-outline' : 'checkmark-circle'}
                          size={16}
                          color={queuedCount > 0 ? palette.warning : palette.lime}
                        />
                        <Text style={homeStyles.sendText}>
                          {queuedCount > 0
                            ? t('home:active.queued', { count: queuedCount, ago: lastSentLabel })
                            : t('home:active.allSent', { ago: lastSentLabel })}
                        </Text>
                      </View>
                    </View>

                    <Text style={homeStyles.keepOpenNote}>{t('home:active.keepOpen')}</Text>

                    {/* The raw readouts stay, but only where they are useful:
                        support and dev builds. They are diagnostics, not UI. */}
                    {(API_CONFIG.DEBUG || __DEV__) && (
                      <View style={homeStyles.trackingStatus}>
                        <Text style={homeStyles.trackingStatusIcon}>{isSendingData ? '🟢' : '🟡'}</Text>
                        <View style={{ flex: 1 }}>
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
                  </>
                )}

                {/* ✅ Tracking log panel — DEBUG only */}
                {API_CONFIG.DEBUG && isGPSActive && trackingLogs.length > 0 && (
                  <ScrollView
                    style={{
                      maxHeight: 200,
                      backgroundColor: palette.ink,
                      borderRadius: 10,
                      padding: 8,
                      marginBottom: spacing.md,
                    }}
                    showsVerticalScrollIndicator={true}
                    persistentScrollbar={true}
                    nestedScrollEnabled={true}
                  >
                    {trackingLogs.map((entry, origIdx) => ({ entry, origIdx }))
                      .reverse()
                      .map(({ entry, origIdx }) => {
                      const time = new Date(entry.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                      return (
                        <Text
                          key={`${entry.ts}-${origIdx}`}
                          style={{ fontFamily: 'monospace', fontSize: 10, color: palette.border, marginBottom: 2 }}
                        >
                          {time} {entry.icon} {entry.msg}
                        </Text>
                      );
                    })}
                  </ScrollView>
                )}

                <Text style={homeStyles.eventDescription}>{t('home:Event.description')}</Text>
                {/* GPS-HEALTH WARNING BANNER.
                    Seven sessions on 2026-08-23 showed "GPS Active" for hours
                    while recording nothing, and none of them recovered. This is
                    the runner-facing signal for that. Clears itself as soon as a
                    valid fix arrives (see _clearGpsFault in gpsService).
                    Uses permissionWarning/permissionWarningText from
                    home.styles.ts — written long ago for exactly this and never
                    wired up until now. */}
                {isGPSActive && gpsHealth !== '' && (
                  <TouchableOpacity
                    style={homeStyles.permissionWarning}
                    onPress={() => {
                      // The banner fires for every gpsHealth value, so without
                      // this the modal kept whatever reason Start last set — a
                      // provider_off banner showed "permission denied" copy and
                      // opened the wrong page. no_fix maps to location_off: the
                      // useful action for "no position" is the same settings page.
                      setPermissionBlockReason(
                        gpsHealth === 'no_background_perm' ? 'no_background_perm' : 'location_off'
                      );
                      void gpsService.getPermissionState()
                        .then((ps) => setPermissionCanAskAgain(ps.canAskAgain))
                        .catch(() => setPermissionCanAskAgain(false));
                      setShowLocationPermissionModal(true);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={homeStyles.permissionWarningText}>
                      {gpsHealth === 'no_background_perm'
                        ? t('home:gpsHealth.bannerNoBackground')
                        : gpsHealth === 'provider_off'
                          ? t('home:gpsHealth.bannerProviderOff')
                          : t('home:gpsHealth.bannerNoFix')}
                    </Text>
                  </TouchableOpacity>
                )}

                {/* Tracking Button.
                    onPress is wrapped rather than given stopGPSTracking directly:
                    onPress supplies a GestureResponderEvent, and that function's
                    first argument is now an options object. Calling it with no
                    args keeps the manual-stop path explicit. */}
                <TouchableOpacity
                  style={[
                    isGPSActive ? homeStyles.stopButton : homeStyles.button,
                    // Equal space above and below: the button had a bottom
                    // margin only, so it sat flush against the tracking
                    // description above it.
                    { width: '100%', marginTop: spacing.md, marginBottom: spacing.md },
                    !isGPSActive && (!participantId || !eventId) && {
                      backgroundColor: palette.placeholder,
                      opacity: 0.6,
                    },
                  ]}
                  onPress={isGPSActive ? () => { void stopGPSTracking(); } : confirmStartTracking}
                  disabled={!isGPSActive && (!participantId || !eventId)}
                  accessibilityRole="button"
                >
                  <Text style={isGPSActive ? homeStyles.stopButtonText : homeStyles.buttonText}>
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
                    { width: '100%', marginBottom: spacing.md, backgroundColor: palette.warning },
                  ]}
                  onPress={async () => {
                    try {
                      const sentCount = await locationService.processQueue(participantId, eventId);
                      const remaining = await locationQueueService.getQueueSize();
                      setQueuedCount(remaining);
                      if (sentCount > 0) {
                        // processQueue() already bumped the counter as it drained —
                        // READ the live total for the toast, don't add sentCount again.
                        let totalSent = sentCount;
                        try {
                          const liveStr = await AsyncStorage.getItem(BACKGROUND_SENT_COUNT_KEY);
                          if (liveStr !== null) totalSent = parseInt(liveStr) || sentCount;
                        } catch { /* silent */ }
                        toastSuccess(
                          t('home:tracking.queueProcessed'),
                          t('home:tracking.queuedSent', { count: totalSent })
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
                        backgroundColor: palette.warning,
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
              {/*homeData?.following_live_events && homeData.following_live_events.length > 0 && (
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
              )*/}
            </>
          )}

          {homeData?.following_live_events && homeData.following_live_events.length > 0 && (
            <FollowingLiveEventsSection
              events={homeData.following_live_events}
              onRoutePress={(event) => {


                if (event.event_source == "custom") {
                  navigation.navigate('LiveTracking', {
                    product_app_id: event.product_app_id,
                    product_option_value_app_id: event.product_option_value_app_id,
                    event_name: event.event_name,
                    sourceScreen: 'HomeScreen',
                    sectionType: 'follower',
                    sourceTab: 'live',
                    event_source: event.event_source,
                  });
                } else {
                  navigation.navigate('FollowDetails', {
                    product_app_id: event.product_app_id,
                    event_image: event.event_image ?? '',
                    event_name: event.event_name,
                    sourceTab: 'live',
                  });
                }
              }}
            />
          )}
        </View>
        {/* Bottom Buttons */}
        <View style={homeStyles.buttonContainer}>
          <TouchableOpacity
            style={homeStyles.button}
            onPress={ async ()  => {
               await analyticsService.logInteraction(ANALYTICS_SCREENS.HOME, ANALYTICS_BUTTONS.PARTICIPANT_MODE); 
              navigation.navigate('ParticipantScreen')}}
          >
            <Text style={homeStyles.buttonText}>{t('home:button.Participant')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={homeStyles.button}
            onPress={handleFanPress}
          >
            <Text style={homeStyles.buttonText}>{t('home:button.Fan')}</Text>
          </TouchableOpacity>
        </View>
        {/* <View style={homeStyles.logosSection}>
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
                    cachePolicy="memory-disk"
                    style={homeStyles.partnerLogo}
                    contentFit="contain"
                  />
                </View>
              ))}
            </ScrollView>
          </View>
        </View> */}
      </ScrollView>
      <FanEmailModal
        visible={showFanEmailModal}
        onSave={async (email) => {
          if (API_CONFIG.DEBUG) console.log('📧 email saved:', email);
          await fanEmailStorage.markPrompted();
          setShowFanEmailModal(false);
          navigation.navigate('FanScreen');
        }}
        onSkip={async () => {
          await fanEmailStorage.markPrompted();
          setShowFanEmailModal(false);
          navigation.navigate('FanScreen');
        }}
      />
    </SafeAreaView>
  );
};

export default HomeScreen;