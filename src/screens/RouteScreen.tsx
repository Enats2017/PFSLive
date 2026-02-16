import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StatusBar,
  Alert,
  TouchableOpacity,
  PanResponder,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Asset } from 'expo-asset';
import { AppHeader } from '../components/common/AppHeader';
import { BottomNavigation } from '../components/common/BottomNavigation';
import { DistanceDropdown } from '../components/DistanceDropdown';
import { RouteMap } from '../components/RouteMap';
import { ElevationProfile } from '../components/ElevationProfile';
import { parseGPX } from '../utils/gpx';
import {
  calculateDistances,
  calculateStationDistances,
  buildChartData,
  trackPointsToGeoJSON,
  snapToRoute,
} from '../utils/geoUtils';
import { RouteData, ChartDataPoint, ParticipantPosition } from '../types';
import { RouteScreenProps } from '../types/navigation';
import { commonStyles } from '../styles/common.styles';
import { routeStyles } from '../styles/route.styles';

const RouteScreen: React.FC<RouteScreenProps> = ({ route, navigation }) => {
  const { t } = useTranslation(['route', 'common']);
  const { eventName } = route.params;

  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [participantPosition, setParticipantPosition] = useState<ParticipantPosition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [followMode, setFollowMode] = useState(false);
  const [selectedDistance, setSelectedDistance] = useState(100);

  // Swipe animation value
  const swipeAnimation = new Animated.Value(0);

  const routeLineGeoJSON = useMemo(() => {
    if (!routeData || routeData.trackPoints.length === 0) return null;
    return trackPointsToGeoJSON(routeData.trackPoints);
  }, [routeData]);

  // Custom swipe gesture handler
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) => {
          // Only activate if swiping from left edge (first 50px)
          return gestureState.dx > 10 && Math.abs(gestureState.dy) < 80;
        },
        onPanResponderGrant: () => {
          swipeAnimation.setOffset(0);
        },
        onPanResponderMove: (_, gestureState) => {
          // Only allow right swipe (positive dx)
          if (gestureState.dx > 0) {
            swipeAnimation.setValue(gestureState.dx);
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          // If swiped more than 100px or with velocity > 0.5, go back
          if (gestureState.dx > 100 || gestureState.vx > 0.5) {
            Animated.timing(swipeAnimation, {
              toValue: 400,
              duration: 200,
              useNativeDriver: true,
            }).start(() => {
              navigation.goBack();
            });
          } else {
            // Snap back
            Animated.spring(swipeAnimation, {
              toValue: 0,
              useNativeDriver: true,
            }).start();
          }
        },
      }),
    [navigation]
  );

  useEffect(() => {
    loadGPX();
  }, []);

  const loadGPX = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('📂 Loading GPX file...');

      const asset = Asset.fromModule(require('../../assets/sample.gpx'));
      await asset.downloadAsync();

      if (!asset.localUri) {
        throw new Error('Failed to load GPX file');
      }

      const response = await fetch(asset.localUri);
      const gpxContent = await response.text();
      
      console.log('✅ GPX content loaded');

      const parsed = await parseGPX(gpxContent);

      const distances = calculateDistances(parsed.trackPoints);
      const totalDistance = distances[distances.length - 1];

      const stationsWithDistances = calculateStationDistances(
        parsed.trackPoints,
        parsed.stations,
        distances
      );

      const chart = buildChartData(parsed.trackPoints, distances);

      setRouteData({
        ...parsed,
        stations: stationsWithDistances,
        totalDistance,
      });
      setChartData(chart);

      const hardcodedCoords = { lat: 45.8640, lon: 6.8980 };
      const routeLine = trackPointsToGeoJSON(parsed.trackPoints);
      const snapped = snapToRoute(routeLine, hardcodedCoords);

      const nearestIdx = parsed.trackPoints.findIndex(pt => 
        Math.abs(pt.lat - snapped.lat) < 0.001 && 
        Math.abs(pt.lon - snapped.lon) < 0.001
      );

      setParticipantPosition({
        lat: snapped.lat,
        lon: snapped.lon,
        ele: nearestIdx >= 0 ? parsed.trackPoints[nearestIdx].ele : 1555,
        distance: snapped.distanceAlongKm,
        speed: 0,
        rank: 42,
      });

      console.log('✅ Route loaded successfully!');
      setLoading(false);
    } catch (err) {
      console.error('❌ Error loading GPX:', err);
      setError(err instanceof Error ? err.message : 'Failed to load route');
      setLoading(false);
      Alert.alert(t('common:errors.generic'), t('route:error_loading_route'));
    }
  };

  if (loading) {
    return (
      <View style={commonStyles.centerContainer}>
        <ActivityIndicator size="large" color="#DC143C" />
        <Text style={commonStyles.loadingText}>{t('route:loading_route')}</Text>
      </View>
    );
  }

  if (error || !routeData) {
    return (
      <View style={commonStyles.centerContainer}>
        <Text style={commonStyles.errorText}>
          {error || t('route:error_loading_route')}
        </Text>
        <TouchableOpacity style={commonStyles.primaryButton} onPress={loadGPX}>
          <Text style={commonStyles.primaryButtonText}>{t('common:buttons.retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <Animated.View
      style={[
        { flex: 1 },
        {
          transform: [{ translateX: swipeAnimation }],
        },
      ]}
      {...panResponder.panHandlers}
    >
      <SafeAreaView style={commonStyles.container} edges={['top', 'bottom']}>
        <StatusBar barStyle="dark-content" />
        
        {/* App Header */}
        <AppHeader title={eventName || routeData.name} showLogo={true} />

        {/* Distance Dropdown */}
        <DistanceDropdown 
          onSelect={(distance) => {
            setSelectedDistance(distance);
            console.log('Selected distance:', distance);
          }} 
        />

        {/* Map Container */}
        <View style={routeStyles.mapContainer}>
          <RouteMap
            trackPoints={routeData.trackPoints}
            stations={routeData.stations}
            participantPosition={participantPosition ? {
              lat: participantPosition.lat,
              lon: participantPosition.lon,
            } : null}
            participantBearing={0}
            followMode={followMode}
          />
        </View>

        {/* Elevation Profile Chart */}
        <View style={routeStyles.chartContainer}>
          <ElevationProfile
            chartData={chartData}
            stations={routeData.stations}
            currentDistance={participantPosition?.distance || 0}
            totalDistance={routeData.totalDistance}
          />
        </View>

        {/* Bottom Navigation */}
        <BottomNavigation activeTab="Map" />
      </SafeAreaView>
    </Animated.View>
  );
};

export default RouteScreen;