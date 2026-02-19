import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Alert,
  Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HomeScreenProps } from '../types/navigation';
import { AppHeader } from '../components/common/AppHeader';
import { commonStyles } from '../styles/common.styles';
import { homeStyles } from '../styles/home.styles';
import { useTranslation } from 'react-i18next';
import axios from "axios";
import { toastSuccess, toastError } from '../../utils/toast';
import { locationService } from '../services/locationService';
import { gpsService } from '../services/gpsService';
import { APP_CONFIG } from '../constants/config';


const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
    const { t } = useTranslation(['home', 'common']);
  const [homeData, setHomeData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isTracking, setIsTracking] = useState(false);
  const [locationUpdateCount, setLocationUpdateCount] = useState(0);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number, lon: number } | null>(null);
  const [hasPermission, setHasPermission] = useState(false);
  const stopTrackingRef = useRef<(() => void) | null>(null);
  const gpsWatchRef = useRef<{ remove: () => void } | null>(null);
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
      console.log('Location permissions already granted');
    }
  };

  const startTracking = async () => {
    try {
      console.log('Starting GPS location tracking...');
      if (!hasPermission) {
        const granted = await gpsService.requestPermissions();
        if (!granted) {
          toastSuccess(
            'Permission Required',
            'Location permission is required to track your position. Please enable it in your device settings.',
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
      console.log('Initial GPS location sent:', {
        lat: initialGPS.latitude.toFixed(6),
        lon: initialGPS.longitude.toFixed(6),
        accuracy: initialGPS.accuracy,
      });
      console.log('API Response:', response.message);

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
            console.log('GPS update sent:', {
              lat: gpsPosition.latitude.toFixed(6),
              lon: gpsPosition.longitude.toFixed(6),
              speed: gpsPosition.speed?.toFixed(2),
              accuracy: gpsPosition.accuracy,
            });
          } catch (error) {
            console.error('Failed to send location update:', error);
          }
        },
        (error) => {
          console.error('GPS tracking error:', error);
          toastError(
            'GPS Error',
            'Failed to get GPS location. Please check if location services are enabled.',
          );
        }
      );

      gpsWatchRef.current = gpsWatch;

      toastSuccess(
        'Tracking Started',
        'Your GPS location is now being sent to the server every 5 seconds or 10 meters.',
      );
    } catch (error) {
      console.error('Failed to start GPS tracking:', error);
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

    toastSuccess(
      'Tracking Stopped',
      `GPS tracking stopped. Sent ${locationUpdateCount} location updates.`,
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

  const fetchHomeData = async () => {
    try {
      const response = await axios.get("http://192.168.0.199/larssie/api/home_api.php",
        {
          headers: {
            Authorization: "Bearer 658db6a46bfbfc0aaa97a5241a3ed78a84df8f49c44d1f5f90ed2d520f75402f",
          },
        }
      );
      console.log("API Response:", response.data);
      if (response.data.success) {
        setHomeData(response.data.data);
      }
    } catch (error) {
      console.log("API Error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
  fetchHomeData(); 
  const interval = setInterval(() => {
    fetchHomeData();
    console.log('🔄 Polling backend for status update...');
  }, 30000);
  return () => clearInterval(interval); 
}, []);

  return (
    <SafeAreaView style={commonStyles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      <AppHeader showLogo={true} />
      <ScrollView
        style={homeStyles.scrollView}
        contentContainerStyle={homeStyles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
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
          {
            homeData?.show_start_track === 1 ? (
              <>
                <Text style={[commonStyles.title, { marginBottom: 5 }]}>{t('home:Event.title')}:{homeData.next_race_name}</Text>
                <Text style={homeStyles.smallText}>{t('home:Event.Date')}: {homeData.next_race_date}</Text>
                <Text style={[homeStyles.heading, { marginTop: 15 }]}>
                 {t('home:Event.description')}
                </Text>
                <TouchableOpacity
                  style={[homeStyles.button, { width: "90%", marginBottom: 30 }]}
                  onPress={isTracking ? stopTracking : startTracking}
                >
                  <Text style={homeStyles.buttonText}>
                    {isTracking ? t('home:Event.button') : t('home:Event.buttonText')}
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={homeStyles.heading}>
                  {t('home:tagline')}
                </Text>
                <Text style={homeStyles.smallText}>{t('home:participant.title')}</Text>
                <Text style={homeStyles.smallText}>{t('home:subtext')}</Text>
              </>
            )
          }
        </View>
        <View style={homeStyles.buttonContainer}>
          <TouchableOpacity style={homeStyles.button} onPress={() => navigation.navigate('ParticipantEvent')}>
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