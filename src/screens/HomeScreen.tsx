import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { HomeScreenProps } from '../types/navigation';
import { AppHeader } from '../components/common/AppHeader';
import { LanguageSelector } from '../components/LanguageSelector';
import { locationService } from '../services/locationService';
import { gpsService } from '../services/gpsService';
import { APP_CONFIG } from '../constants/config';
import { commonStyles } from '../styles/common.styles';
import { homeStyles } from '../styles/home.styles';

const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const { t } = useTranslation(['home', 'common']);
  
  const [isTracking, setIsTracking] = useState(false);
  const [locationUpdateCount, setLocationUpdateCount] = useState(0);
  const [currentLocation, setCurrentLocation] = useState<{lat: number, lon: number} | null>(null);
  const [hasPermission, setHasPermission] = useState(false);
  
  const stopTrackingRef = useRef<(() => void) | null>(null);
  const gpsWatchRef = useRef<{ remove: () => void } | null>(null);
  
  // Mock participant data (will come from auth/login later)
  const participantId = 'participant_001';
  const eventId = 'event_tmiler_100km';

  // Check GPS permissions on mount
  useEffect(() => {
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    const hasPerms = await gpsService.hasPermissions();
    setHasPermission(hasPerms);
    
    if (hasPerms) {
      console.log('✅ Location permissions already granted');
    }
  };

  const startTracking = async () => {
    try {
      console.log('🚀 Starting GPS location tracking...');

      // Request permissions if not granted
      if (!hasPermission) {
        const granted = await gpsService.requestPermissions();
        
        if (!granted) {
          Alert.alert(
            'Permission Required',
            'Location permission is required to track your position. Please enable it in your device settings.',
            [{ text: 'OK' }]
          );
          return;
        }
        
        setHasPermission(true);
      }

      setIsTracking(true);
      setLocationUpdateCount(0);

      // Get initial GPS position
      const initialGPS = await gpsService.getCurrentPosition();
      const initialLocation = gpsService.convertToLocationData(initialGPS);
      
      setCurrentLocation({
        lat: initialGPS.latitude,
        lon: initialGPS.longitude,
      });

      // Send initial location to API
      const response = await locationService.sendLocation(
        participantId,
        eventId,
        initialLocation
      );
      
      console.log('📍 Initial GPS location sent:', {
        lat: initialGPS.latitude.toFixed(6),
        lon: initialGPS.longitude.toFixed(6),
        accuracy: initialGPS.accuracy,
      });
      console.log('✅ API Response:', response.message);

      setLocationUpdateCount(1);

      // Start continuous GPS tracking
      const gpsWatch = await gpsService.startWatchingPosition(
        async (gpsPosition) => {
          const locationData = gpsService.convertToLocationData(gpsPosition);
          
          setCurrentLocation({
            lat: gpsPosition.latitude,
            lon: gpsPosition.longitude,
          });

          // Send to API
          try {
            await locationService.sendLocation(
              participantId,
              eventId,
              locationData
            );
            
            setLocationUpdateCount(prev => prev + 1);
            
            console.log('📍 GPS update sent:', {
              lat: gpsPosition.latitude.toFixed(6),
              lon: gpsPosition.longitude.toFixed(6),
              speed: gpsPosition.speed?.toFixed(2),
              accuracy: gpsPosition.accuracy,
            });
          } catch (error) {
            console.error('❌ Failed to send location update:', error);
          }
        },
        (error) => {
          console.error('❌ GPS tracking error:', error);
          Alert.alert(
            'GPS Error',
            'Failed to get GPS location. Please check if location services are enabled.',
            [{ text: 'OK' }]
          );
        }
      );

      gpsWatchRef.current = gpsWatch;

      Alert.alert(
        'Tracking Started',
        'Your GPS location is now being sent to the server every 5 seconds or 10 meters.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('❌ Failed to start GPS tracking:', error);
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to start location tracking. Please try again.',
        [{ text: 'OK' }]
      );
      setIsTracking(false);
    }
  };

  const stopTracking = () => {
    // Stop GPS watching
    if (gpsWatchRef.current) {
      gpsWatchRef.current.remove();
      gpsWatchRef.current = null;
    }

    // Stop any interval tracking
    if (stopTrackingRef.current) {
      stopTrackingRef.current();
      stopTrackingRef.current = null;
    }
    
    setIsTracking(false);
    
    Alert.alert(
      'Tracking Stopped',
      `GPS tracking stopped. Sent ${locationUpdateCount} location updates.`,
      [{ text: 'OK' }]
    );
  };

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (gpsWatchRef.current) {
        gpsWatchRef.current.remove();
      }
      if (stopTrackingRef.current) {
        stopTrackingRef.current();
      }
    };
  }, []);

  return (
    <SafeAreaView style={commonStyles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      
      {/* App Header */}
      <AppHeader showLogo={true} />
      
      {/* Scrollable Content */}
      <ScrollView 
        style={homeStyles.scrollView}
        contentContainerStyle={homeStyles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={homeStyles.content}>
          {/* Logo & Subtitle */}
          <View style={homeStyles.header}>
            <Text style={homeStyles.logo}>🏃‍♂️ {t('common:app_name')}</Text>
            <Text style={homeStyles.subtitle}>{t('home:subtitle')}</Text>
          </View>

          {/* Language Selector */}
          <View style={homeStyles.languageSection}>
            <Text style={homeStyles.languageLabel}>{t('home:footer.language')}</Text>
            <LanguageSelector />
          </View>

          {/* Tagline */}
          <Text style={homeStyles.tagline}>{t('home:tagline')}</Text>

          {/* Role Selection Cards */}
          <View style={homeStyles.cardsContainer}>
            {/* Participant Card */}
            <TouchableOpacity
              style={homeStyles.card}
              onPress={() => {
                console.log('Participant selected');
                navigation.navigate('Route', {
                  eventId: '1',
                  eventName: 'TMiler Mountain Trail',
                });
              }}
            >
              <View style={homeStyles.cardIcon}>
                <Text style={homeStyles.iconText}>🏃</Text>
              </View>
              <Text style={homeStyles.cardTitle}>{t('home:participant.title')}</Text>
              <Text style={homeStyles.cardDescription}>
                {t('home:participant.description')}
              </Text>
              <View style={homeStyles.cardButton}>
                <Text style={homeStyles.cardButtonText}>
                  {t('home:participant.button')}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Follower Card - GPS Tracking */}
            <View style={homeStyles.card}>
              <View style={homeStyles.cardIcon}>
                <Text style={homeStyles.iconText}>👥</Text>
              </View>
              <Text style={homeStyles.cardTitle}>{t('home:follower.title')}</Text>
              <Text style={homeStyles.cardDescription}>
                {t('home:follower.description')}
              </Text>

              {/* GPS Tracking Status */}
              {isTracking && (
                <View style={homeStyles.trackingStatus}>
                  <Text style={homeStyles.trackingStatusIcon}>🟢</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={homeStyles.trackingStatusText}>
                      GPS Tracking Active
                    </Text>
                    {currentLocation && (
                      <Text style={homeStyles.trackingLocationText}>
                        {currentLocation.lat.toFixed(6)}, {currentLocation.lon.toFixed(6)}
                      </Text>
                    )}
                    <Text style={homeStyles.trackingCountText}>
                      {locationUpdateCount} updates sent
                    </Text>
                  </View>
                </View>
              )}

              {/* Permission Warning */}
              {!hasPermission && !isTracking && (
                <View style={homeStyles.permissionWarning}>
                  <Text style={homeStyles.permissionWarningText}>
                    ⚠️ Location permission required
                  </Text>
                </View>
              )}

              {/* Start/Stop Tracking Button */}
              {!isTracking ? (
                <TouchableOpacity
                  style={homeStyles.cardButton}
                  onPress={startTracking}
                >
                  <Text style={homeStyles.cardButtonText}>
                    Start GPS Tracking
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={homeStyles.cardButtonStop}
                  onPress={stopTracking}
                >
                  <Text style={homeStyles.cardButtonText}>
                    Stop Tracking
                  </Text>
                </TouchableOpacity>
              )}

              {/* View Map Button */}
              <TouchableOpacity
                style={homeStyles.cardButtonSecondary}
                onPress={() => {
                  navigation.navigate('Route', {
                    eventId: '1',
                    eventName: 'TMiler Mountain Trail',
                  });
                }}
              >
                <Text style={homeStyles.cardButtonSecondaryText}>
                  View on Map
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Footer */}
          <View style={homeStyles.footer}>
            <Text style={homeStyles.footerText}>
              {t('home:footer.version', { version: APP_CONFIG.VERSION })}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default HomeScreen;