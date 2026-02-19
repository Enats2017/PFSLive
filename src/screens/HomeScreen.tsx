import React, { useState, useEffect, useRef } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import axios from "axios";

// Local imports
import { HomeScreenProps } from '../types/navigation';
import { AppHeader } from '../components/common/AppHeader';
import { toastSuccess, toastError } from '../../utils/toast';
import { locationService } from '../services/locationService';
import { gpsService } from '../services/gpsService';
import { locationQueueService } from '../services/locationQueueService';
import { tokenService } from '../services/tokenService';
import { API_CONFIG, getApiEndpoint } from '../constants/config';

// Styles
import { colors, spacing, typography, commonStyles } from '../styles/common.styles';
import { homeStyles } from '../styles/home.styles';

const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const { t } = useTranslation(['home', 'common']);
  
  const [homeData, setHomeData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [hasToken, setHasToken] = useState(false);
  const [isCheckingToken, setIsCheckingToken] = useState(true);
  
  // Tracking states
  const [isGPSActive, setIsGPSActive] = useState(false);
  const [isSendingData, setIsSendingData] = useState(false);
  const [locationUpdateCount, setLocationUpdateCount] = useState(0);
  const [queuedCount, setQueuedCount] = useState(0);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number, lon: number } | null>(null);
  const [hasPermission, setHasPermission] = useState(false);
  const [raceStartTime, setRaceStartTime] = useState<Date | null>(null);
  const [sendingInterval, setSendingInterval] = useState(30);
  const [timeUntilRace, setTimeUntilRace] = useState<string>('');
  
  const stopTrackingRef = useRef<(() => void) | null>(null);
  const gpsWatchRef = useRef<{ remove: () => void } | null>(null);
  const queueProcessorRef = useRef<NodeJS.Timeout | null>(null);
  const raceStartCheckRef = useRef<NodeJS.Timeout | null>(null);
  const appState = useRef(AppState.currentState);
  
  // Get IDs dynamically from API response
  const participantId = homeData?.next_race_participant_app_id || null;
  const eventId = homeData?.next_race_id || null;

  /**
   * Format date to d-m-Y format (e.g., 19-02-2026)
   */
  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return dateString;
      }
      
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      
      return `${day}-${month}-${year}`;
    } catch (error) {
      console.error('Error formatting date:', error);
      return dateString;
    }
  };

  // Check token and permissions on mount
  useEffect(() => {
    initializeScreen();
  }, []);

  /**
   * Initialize screen - check token first, then load data
   */
  const initializeScreen = async () => {
    try {
      setIsCheckingToken(true);
      
      const isAuthenticated = await tokenService.isAuthenticated();
      setHasToken(isAuthenticated);
      
      if (isAuthenticated) {
        console.log('✅ User is authenticated');
        await fetchHomeData();
      } else {
        console.log('⚠️ No authentication token found');
        const fallbackToken = await tokenService.getToken();
        if (fallbackToken) {
          console.log('✅ Using fallback token from .env');
          setHasToken(true);
          await fetchHomeData();
        }
      }
      
      await checkPermissions();
      await loadQueueSize();
      
    } catch (error) {
      console.error('❌ Error initializing screen:', error);
    } finally {
      setIsCheckingToken(false);
      setLoading(false);
    }
  };

  // Log API data when it loads
  useEffect(() => {
    if (homeData) {
      console.log('📋 API Data Loaded:');
      console.log('   Participant ID:', participantId);
      console.log('   Event ID:', eventId);
      console.log('   Race Name:', homeData.next_race_name);
      console.log('   Race Date:', homeData.next_race_date);
      console.log('   Race Time (UTC):', homeData.next_race_time);
      console.log('   Interval:', homeData.next_race_interval_for_location, 'seconds');
      console.log('   Manual Start:', homeData.manual_start === 1 ? 'ENABLED' : 'DISABLED');
    }
  }, [homeData]);

  const checkPermissions = async () => {
    const hasPerms = await gpsService.hasPermissions();
    setHasPermission(hasPerms);

    if (hasPerms) {
      console.log('✅ Location permissions already granted');
    }
  };

  const loadQueueSize = async () => {
    const size = await locationQueueService.getQueueSize();
    setQueuedCount(size);
  };

  /**
   * Calculate if race has started
   */
  const hasRaceStarted = (): boolean => {
    if (homeData?.manual_start === 1) {
      return true;
    }
    if (!raceStartTime) return false;
    return new Date().getTime() >= raceStartTime.getTime();
  };

  /**
   * Calculate time remaining until race
   */
  const calculateTimeUntilRace = () => {
    if (homeData?.manual_start === 1) {
      setTimeUntilRace(t('home:status.manualStartReady'));
      return;
    }

    if (!raceStartTime) {
      setTimeUntilRace('');
      return;
    }

    try {
      const now = new Date().getTime();
      const raceTime = raceStartTime.getTime();
      
      if (isNaN(now) || isNaN(raceTime)) {
        console.error('❌ Invalid timestamps:', { now, raceTime });
        setTimeUntilRace('');
        return;
      }

      const diff = raceTime - now;

      if (diff <= 0) {
        setTimeUntilRace('Race started!');
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (isNaN(hours) || isNaN(minutes) || isNaN(seconds)) {
        console.error('❌ Invalid calculated time:', { hours, minutes, seconds });
        setTimeUntilRace('');
        return;
      }

      setTimeUntilRace(`${hours}h ${minutes}m ${seconds}s`);
    } catch (error) {
      console.error('❌ Error calculating time until race:', error);
      setTimeUntilRace('');
    }
  };

  // Update countdown every second
  useEffect(() => {
    if (isGPSActive && raceStartTime) {
      const interval = setInterval(calculateTimeUntilRace, 1000);
      return () => clearInterval(interval);
    }
  }, [isGPSActive, raceStartTime, homeData?.manual_start]);

  /**
   * Fetch home data from API
   */
  const fetchHomeData = async () => {
    try {
      const token = await tokenService.getToken();
      
      if (!token) {
        console.log('⚠️ No token available, skipping API call');
        setLoading(false);
        return;
      }

      console.log('📡 Fetching home data...');

      const headers = await API_CONFIG.getHeaders();
      
      const response = await axios.get(
        getApiEndpoint(API_CONFIG.ENDPOINTS.HOME),
        { 
          headers,
          timeout: API_CONFIG.TIMEOUT,
        }
      );
      
      console.log("📡 API Response:", response.data);
      
      if (response.data.success) {
        setHomeData(response.data.data);
      } else {
        console.log("⚠️ API returned success: false");
      }
    } catch (error: any) {
      console.log("❌ API Error:", error);
      
      if (error.response) {
        if (error.response.status === 401) {
          console.log('❌ Unauthorized - Invalid or expired token');
          toastError(
            t('common:errors.generic'),
            'Your session has expired. Please login again.'
          );
          await tokenService.removeToken();
          setHasToken(false);
        } else {
          toastError(
            t('common:errors.generic'),
            `API Error: ${error.response.status}`
          );
        }
      } else if (error.request) {
        console.log('❌ No response from server');
        toastError(
          t('common:errors.generic'),
          'Cannot reach server. Please check your internet connection.'
        );
      } else {
        console.log('❌ Error:', error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * Retry fetching home data
   */
  const retryFetchData = async () => {
    setLoading(true);
    await initializeScreen();
  };

  /**
   * Handle login navigation
   */
  const navigateToLogin = () => {
    console.log('Navigate to Login screen');
    Alert.alert(
      'Login Required',
      'Please login to access this feature. Login screen will be implemented soon.',
      [{ text: 'OK' }]
    );
  };

  /**
   * Start GPS tracking
   */
  const startGPSTracking = async () => {
    try {
      console.log('🚀 Starting GPS tracking...');

      if (!participantId || !eventId) {
        toastError(
          t('home:errors.missingInfo'),
          t('home:errors.missingInfoDescription'),
        );
        console.error('❌ Missing IDs - Participant:', participantId, 'Event:', eventId);
        return;
      }

      console.log('✅ Using Participant ID:', participantId);
      console.log('✅ Using Event ID:', eventId);

      if (!hasPermission) {
        const granted = await gpsService.requestPermissions();
        if (!granted) {
          toastError(
            t('home:errors.permissionRequired'),
            t('home:errors.permissionDescription'),
          );
          return;
        }
        setHasPermission(true);
      }

      // Parse race start time from API (UTC format)
      if (homeData?.next_race_time) {
        try {
          const timeString = String(homeData.next_race_time).trim();
          console.log('=== RACE TIME PARSING DEBUG ===');
          console.log('1. Raw API time:', timeString);
          
          let raceTime: Date;
          
          if (timeString.endsWith('Z') || timeString.includes('+') || timeString.includes('T')) {
            // ISO format with timezone
            raceTime = new Date(timeString);
            console.log('2. Parsed as ISO/UTC format');
          } else if (timeString.includes(' ')) {
            // Legacy format
            const isoFormat = timeString.replace(' ', 'T') + 'Z';
            raceTime = new Date(isoFormat);
            console.log('2. Converted to UTC format:', isoFormat);
          } else {
            raceTime = new Date(`${timeString}T12:00:00Z`);
            console.log('2. Parsed as date only');
          }
          
          // Validate
          if (isNaN(raceTime.getTime())) {
            throw new Error('Invalid date after parsing');
          }
          
          console.log('3. Race time object:', raceTime);
          console.log('4. Race timestamp (ms):', raceTime.getTime());
          console.log('5. Race time (UTC):', raceTime.toISOString());
          console.log('6. Race time (India):', raceTime.toLocaleString('en-IN', { 
            timeZone: 'Asia/Kolkata',
            hour12: false
          }));
          
          const now = new Date();
          console.log('7. Current timestamp (ms):', now.getTime());
          console.log('8. Current time (UTC):', now.toISOString());
          console.log('9. Current time (India):', now.toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            hour12: false
          }));
          
          const diffMs = raceTime.getTime() - now.getTime();
          const diffMinutes = Math.floor(diffMs / 1000 / 60);
          console.log('10. Difference (ms):', diffMs);
          console.log('11. Difference (minutes):', diffMinutes);
          console.log('12. Race has started?', diffMs <= 0);
          console.log('=== END DEBUG ===');
          
          setRaceStartTime(raceTime);
          
        } catch (error) {
          console.error('❌ Error parsing race time:', error);
        }
      }

      // Get sending interval from API (with robust fallback)
      let intervalValue = 30; // Default

      if (homeData?.next_race_interval_for_location) {
        const rawInterval = homeData.next_race_interval_for_location;
        
        if (typeof rawInterval === 'number') {
          intervalValue = rawInterval;
        } else if (typeof rawInterval === 'string' && rawInterval.length > 0) {
          const parsed = parseInt(rawInterval);
          if (!isNaN(parsed) && parsed > 0) {
            intervalValue = parsed;
          }
        }
        
        setSendingInterval(intervalValue);
        console.log('⏱️ Sending interval set to:', intervalValue, 'seconds');
      } else {
        setSendingInterval(30);
        console.log('⚠️ No next_race_interval_for_location from API, using default: 30s');
      }

      if (homeData?.manual_start === 1) {
        console.log('🔓 Manual start is ENABLED');
      }

      setIsGPSActive(true);

      const initialGPS = await gpsService.getCurrentPosition();
      setCurrentLocation({
        lat: initialGPS.latitude,
        lon: initialGPS.longitude,
      });

      console.log('✅ GPS activated at:', initialGPS.latitude.toFixed(6), initialGPS.longitude.toFixed(6));

      if (hasRaceStarted()) {
        setIsSendingData(true);
        console.log('🏁 Race already started - sending data immediately');
      }

      const gpsWatch = await gpsService.startWatchingPosition(
        async (gpsPosition) => {
          setCurrentLocation({
            lat: gpsPosition.latitude,
            lon: gpsPosition.longitude,
          });

          const shouldSend = hasRaceStarted();

          if (shouldSend) {
            if (!isSendingData) {
              setIsSendingData(true);
              console.log('🏁 Beginning data transmission');
            }
            
            const locationData = gpsService.convertToLocationData(gpsPosition);

            if (!participantId || !eventId) {
              console.error('❌ Missing IDs, cannot send location');
              return;
            }

            try {
              const response = await locationService.sendLocation(
                participantId,
                eventId,
                locationData,
                true
              );

              if (response.success) {
                setLocationUpdateCount(prev => prev + 1);
                console.log('✅ Location sent successfully');
              } else {
                console.log('📦 Location queued (offline)');
              }

              await loadQueueSize();
            } catch (error) {
              console.error('❌ Failed to send location:', error);
              await loadQueueSize();
            }
          } else {
            console.log('⏳ Waiting for race to start...');
          }
        },
        (error) => {
          console.error('❌ GPS tracking error:', error);
          toastError(
            t('home:errors.gpsError'),
            t('home:errors.gpsErrorDescription')
          );
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
      } else if (raceStartTime) {
        message = `GPS activated. Data will be sent when race starts.`;
      } else {
        message = t('home:tracking.waitingForRaceNoTime');
      }

      toastSuccess(t('home:tracking.gpsActivated'), message);
    } catch (error) {
      console.error('❌ Failed to start GPS:', error);
      Alert.alert(
        t('common:errors.generic'),
        error instanceof Error ? error.message : t('home:errors.trackingFailed'),
      );
      setIsGPSActive(false);
    }
  };

  const startQueueProcessor = () => {
    if (queueProcessorRef.current) return;

    if (!participantId || !eventId) {
      console.error('❌ Cannot start queue processor: Missing IDs');
      return;
    }

    queueProcessorRef.current = setInterval(async () => {
      try {
        const sentCount = await locationService.processQueue(participantId, eventId);
        if (sentCount > 0) {
          console.log(`✅ Processed ${sentCount} queued locations`);
          setLocationUpdateCount(prev => prev + sentCount);
          await loadQueueSize();
          toastSuccess(
            t('home:tracking.queueProcessed'),
            t('home:tracking.queuedSent', { count: sentCount })
          );
        }
      } catch (error) {
        console.error('❌ Queue processor error:', error);
      }
    }, 60000);

    console.log('🔄 Queue processor started');
  };

  const startRaceStartChecker = () => {
    if (raceStartCheckRef.current) return;

    raceStartCheckRef.current = setInterval(() => {
      if (hasRaceStarted() && !isSendingData) {
        console.log('🏁 Race has started!');
        setIsSendingData(true);
        toastSuccess(
          t('home:tracking.raceStarted'),
          t('home:tracking.nowSending')
        );
      }
    }, 30000);

    console.log('⏰ Race start checker started');
  };

  const stopGPSTracking = () => {
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
    setIsSendingData(false);

    toastSuccess(
      t('home:tracking.gpsStopped'),
      t('home:tracking.trackingStopped', { 
        sent: locationUpdateCount, 
        queued: queuedCount 
      }),
    );
  };

  const manualStartSending = () => {
    Alert.alert(
      t('home:alerts.overrideTitle'),
      t('home:alerts.overrideMessage'),
      [
        { text: t('home:alerts.cancel'), style: 'cancel' },
        {
          text: t('home:alerts.startNow'),
          onPress: () => {
            setIsSendingData(true);
            console.log('🔓 User manual override activated');
            toastSuccess(
              t('home:tracking.manualStart'),
              t('home:tracking.manualStartMessage')
            );
          },
        },
      ]
    );
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (gpsWatchRef.current) {
        gpsWatchRef.current.remove();
      }
      if (queueProcessorRef.current) {
        clearInterval(queueProcessorRef.current);
      }
      if (raceStartCheckRef.current) {
        clearInterval(raceStartCheckRef.current);
      }
    };
  }, []);

  // Handle app state changes
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        console.log('📱 App came to foreground');
        
        if (isGPSActive && participantId && eventId) {
          locationService.processQueue(participantId, eventId).then(sentCount => {
            if (sentCount > 0) {
              console.log(`✅ Processed ${sentCount} locations on foreground`);
              setLocationUpdateCount(prev => prev + sentCount);
            }
          });
          loadQueueSize();
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [isGPSActive, participantId, eventId]);

  // Polling for home data updates
  useEffect(() => {
    if (!hasToken) return;

    const interval = setInterval(() => {
      fetchHomeData();
      console.log('🔄 Polling backend for updates...');
    }, 30000);
    
    return () => clearInterval(interval);
  }, [hasToken]);

  // Loading state
  if (isCheckingToken) {
    return (
      <SafeAreaView style={commonStyles.container} edges={['top']}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <AppHeader showLogo={true} />
        <View style={commonStyles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[commonStyles.loadingText, { marginTop: 16 }]}>
            Initializing...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // No token state
  if (!hasToken) {
    return (
      <SafeAreaView style={commonStyles.container} edges={['top']}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <AppHeader showLogo={true} />
        <View style={commonStyles.centerContainer}>
          <Text style={[commonStyles.errorText, { marginBottom: 24 }]}>
            Authentication Required
          </Text>
          <Text style={[commonStyles.text, { textAlign: 'center', marginBottom: 32 }]}>
            Please login to access this feature
          </Text>
          <TouchableOpacity
            style={commonStyles.primaryButton}
            onPress={navigateToLogin}
          >
            <Text style={commonStyles.primaryButtonText}>Login</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (!loading && !homeData) {
    return (
      <SafeAreaView style={commonStyles.container} edges={['top']}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <AppHeader showLogo={true} />
        <View style={commonStyles.centerContainer}>
          <Text style={[commonStyles.errorText, { marginBottom: 16 }]}>
            Failed to load data
          </Text>
          <Text style={[commonStyles.text, { textAlign: 'center', marginBottom: 32 }]}>
            Could not connect to server
          </Text>
          <TouchableOpacity
            style={commonStyles.primaryButton}
            onPress={retryFetchData}
          >
            <Text style={commonStyles.primaryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Loading state
  if (loading) {
    return (
      <SafeAreaView style={commonStyles.container} edges={['top']}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <AppHeader showLogo={true} />
        <View style={commonStyles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[commonStyles.loadingText, { marginTop: 16 }]}>
            Loading...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Main content
  return (
    <SafeAreaView style={commonStyles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <AppHeader showLogo={true} />
      
      <ScrollView
        style={homeStyles.scrollView}
        contentContainerStyle={homeStyles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={homeStyles.cardscetion}>
          <Image
            source={require("../../assets/Logo-img.png")}
            style={homeStyles.logo}
            resizeMode="contain"
          />
          <View style={homeStyles.textSection}>
            <Text style={homeStyles.title}>
              {t('common:app_name')}
            </Text>
          </View>
        </View>
        
        <Text style={homeStyles.subtitle}>
          {t('home:subtitle')}
        </Text>
        
        <View style={homeStyles.textContainer}>
          {homeData?.show_start_track === 1 ? (
            <>
              {/* Event Name */}
              <View style={homeStyles.eventInfo}>
                <Text style={homeStyles.eventNameText}>
                  <Text style={homeStyles.eventLabel}>{t('home:Event.title')}: </Text>
                  <Text style={homeStyles.eventValue}>{homeData.next_race_name}</Text>
                </Text>
              </View>

              {/* Date - Format: d-m-Y */}
              <Text style={homeStyles.smallText}>
                <Text style={{ fontWeight: typography.weights.bold }}>
                  {t('home:Event.Date')}:
                </Text>
                {' '}{formatDate(homeData.next_race_date)}
              </Text>
              
              {/* Manual Start Indicator */}
              {homeData?.manual_start === 1 && (
                <View style={[
                  homeStyles.trackingStatus, 
                  { backgroundColor: colors.warning + '20' }
                ]}>
                  <Text style={homeStyles.trackingStatusIcon}>🔓</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[
                      homeStyles.trackingStatusText, 
                      { color: colors.warning }
                    ]}>
                      {t('home:status.manualStartEnabled')}
                    </Text>
                    <Text style={[
                      homeStyles.trackingCountText, 
                      { color: colors.warning }
                    ]}>
                      {t('home:status.manualStartDescription')}
                    </Text>
                  </View>
                </View>
              )}
              
              {/* GPS Status Display */}
              {isGPSActive && (
                <View style={homeStyles.trackingStatus}>
                  <Text style={homeStyles.trackingStatusIcon}>
                    {isSendingData ? '🟢' : '🟡'}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text style={homeStyles.trackingStatusText}>
                      {isSendingData ? t('home:status.sendingData') : t('home:status.gpsActive')}
                    </Text>
                    
                    {!isSendingData && timeUntilRace && (
                      <Text style={homeStyles.trackingCountText}>
                        {homeData?.manual_start === 1 
                          ? t('home:status.manualStartReady')
                          : `Race starts in: ${timeUntilRace}`
                        }
                      </Text>
                    )}
                    
                    {currentLocation && (
                      <Text style={homeStyles.trackingLocationText}>
                        {currentLocation.lat.toFixed(6)}, {currentLocation.lon.toFixed(6)}
                      </Text>
                    )}
                    <Text style={homeStyles.trackingCountText}>
                      {t('home:status.sent')}: {locationUpdateCount} | {t('home:status.queued')}: {queuedCount}
                    </Text>
                    <Text style={homeStyles.trackingCountText}>
                      {t('home:status.interval')}: {sendingInterval}s
                    </Text>
                  </View>
                </View>
              )}

              {/* Description */}
              <Text style={homeStyles.heading}>
                {t('home:Event.description')}
              </Text>

              {/* START TRACKING Button */}
              <TouchableOpacity
                style={[
                  homeStyles.button,
                  { width: "100%", marginBottom: spacing.md },
                  (!participantId || !eventId) && { 
                    backgroundColor: colors.gray400,
                    opacity: 0.6 
                  }
                ]}
                onPress={isGPSActive ? stopGPSTracking : startGPSTracking}
                disabled={!isGPSActive && (!participantId || !eventId)}
              >
                <Text style={homeStyles.buttonText}>
                  {isGPSActive 
                    ? t('home:Event.button') 
                    : (!participantId || !eventId) 
                      ? t('home:status.waitingForData')
                      : t('home:Event.buttonText')
                  }
                </Text>
              </TouchableOpacity>

              {/* Manual Override Button */}
              {isGPSActive && !isSendingData && homeData?.manual_start !== 1 && (
                <TouchableOpacity
                  style={[
                    homeStyles.button,
                    { 
                      width: "100%", 
                      backgroundColor: colors.warning,
                      marginBottom: spacing.xl 
                    }
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
              <Text style={homeStyles.tagline}>
                {t('home:tagline')}
              </Text>
              <Text style={homeStyles.centeredText}>
                {t('home:participant.title')}
              </Text>
              <Text style={homeStyles.centeredText}>
                {t('home:subtext')}
              </Text>
            </>
          )}
        </View>

        <View style={homeStyles.buttonContainer}>
          <TouchableOpacity
            style={homeStyles.button}
            onPress={() => navigation.navigate('ParticipantEvent')}
          >
            <Text style={homeStyles.buttonText}>
              {t('home:button.Participant')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={homeStyles.button}>
            <Text style={homeStyles.buttonText}>
              {t('home:button.Fan')}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default HomeScreen;