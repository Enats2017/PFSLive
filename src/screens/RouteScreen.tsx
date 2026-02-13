import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Text,
  ActivityIndicator,
  StatusBar,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Asset } from 'expo-asset';
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

const RouteScreen: React.FC<RouteScreenProps> = ({ route, navigation }) => {
  const { t } = useTranslation(['route', 'common']);
  const { eventName } = route.params;

  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [trackDistances, setTrackDistances] = useState<number[]>([]);
  const [participantPosition, setParticipantPosition] = useState<ParticipantPosition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [followMode, setFollowMode] = useState(false);

  const routeLineGeoJSON = useMemo(() => {
    if (!routeData || routeData.trackPoints.length === 0) return null;
    return trackPointsToGeoJSON(routeData.trackPoints);
  }, [routeData]);

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
      
      console.log('✅ Asset downloaded:', asset.localUri);

      if (!asset.localUri) {
        throw new Error('Failed to load GPX file');
      }

      const response = await fetch(asset.localUri);
      const gpxContent = await response.text();
      
      console.log('✅ GPX content loaded, length:', gpxContent.length);

      const parsed = await parseGPX(gpxContent);
      
      console.log('✅ GPX parsed:', {
        trackPoints: parsed.trackPoints.length,
        stations: parsed.stations.length,
      });

      const distances = calculateDistances(parsed.trackPoints);
      const totalDistance = distances[distances.length - 1];

      console.log('✅ Total distance:', totalDistance.toFixed(2), 'km');

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
      setTrackDistances(distances);
      setChartData(chart);

      // Hardcoded participant coordinates
      const hardcodedParticipantCoordinates = {
        lat: 45.8640,
        lon: 6.8980,
      };

      console.log('📍 Participant position:', hardcodedParticipantCoordinates);

      const routeLine = trackPointsToGeoJSON(parsed.trackPoints);
      const snapped = snapToRoute(routeLine, hardcodedParticipantCoordinates);

      const nearestPointIndex = parsed.trackPoints.findIndex(pt => 
        Math.abs(pt.lat - snapped.lat) < 0.001 && 
        Math.abs(pt.lon - snapped.lon) < 0.001
      );
      
      const elevation = nearestPointIndex >= 0 
        ? parsed.trackPoints[nearestPointIndex].ele 
        : 1555;

      const participantPos = {
        lat: snapped.lat,
        lon: snapped.lon,
        ele: elevation,
        distance: snapped.distanceAlongKm,
        speed: 0,
        rank: 42,
      };
      
      setParticipantPosition(participantPos);

      console.log('✅ Route loaded successfully!');
      setLoading(false);
    } catch (err) {
      console.error('❌ Error loading GPX:', err);
      setError(err instanceof Error ? err.message : 'Failed to load route');
      setLoading(false);
      Alert.alert(
        t('common:errors.generic'),
        `${t('route:error_loading_route')}\n\n${err instanceof Error ? err.message : t('common:errors.generic')}`
      );
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#DC143C" />
        <Text style={styles.loadingText}>{t('route:loading_route')}</Text>
      </View>
    );
  }

  if (error || !routeData) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>
          {error || t('route:error_loading_route')}
        </Text>
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={loadGPX}
        >
          <Text style={styles.retryButtonText}>{t('common:buttons.retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      
      {/* Top Navigation Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>← {t('common:buttons.back')}</Text>
        </TouchableOpacity>
        
        <Text style={styles.eventName} numberOfLines={1}>
          {eventName || routeData.name}
        </Text>
        
        <TouchableOpacity
          style={[styles.followButton, followMode && styles.followButtonActive]}
          onPress={() => setFollowMode(!followMode)}
        >
          <Text style={styles.followButtonText}>
            {followMode ? '📍' : '🗺️'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Map Container */}
      <View style={styles.mapContainer}>
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

      {/* Elevation Profile */}
      <View style={styles.chartContainer}>
        <ElevationProfile
          chartData={chartData}
          stations={routeData.stations}
          currentDistance={participantPosition?.distance || 0}
          totalDistance={routeData.totalDistance}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    fontSize: 16,
    color: '#DC143C',
    textAlign: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#DC143C',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  topBar: {
    backgroundColor: 'white',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: '#DC143C',
    fontWeight: '600',
  },
  eventName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    flex: 1,
    textAlign: 'center',
  },
  followButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E0E0E0',
    borderWidth: 1,
    borderColor: '#CCCCCC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  followButtonActive: {
    backgroundColor: '#FF6B35',
    borderColor: '#FF6B35',
  },
  followButtonText: {
    fontSize: 20,
  },
  mapContainer: {
    flex: 1,
    minHeight: 300,
  },
  chartContainer: {
    backgroundColor: 'white',
  },
});

// ✅ CRITICAL: Default export (not named export)
export default RouteScreen;