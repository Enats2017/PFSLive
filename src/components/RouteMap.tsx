import React, { useRef, useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Mapbox, { Camera, MapView, ShapeSource, LineLayer, CircleLayer, SymbolLayer } from '@rnmapbox/maps';
import { TrackPoint, Station } from '../types';

interface RouteMapProps {
  trackPoints: TrackPoint[];
  stations: Station[];
  participantPosition: { lat: number; lon: number } | null;
  followMode: boolean;
  participantBearing?: number;
  onMapReady?: () => void;
}

export const RouteMap: React.FC<RouteMapProps> = ({
  trackPoints,
  stations,
  participantPosition,
  followMode,
  participantBearing = 0,
  onMapReady,
}) => {
  const cameraRef = useRef<Camera>(null);
  const mapViewRef = useRef<MapView>(null);

  // Memoize GeoJSON
  const routeGeoJSON = useMemo<GeoJSON.Feature<GeoJSON.LineString>>(() => {
    const routeCoordinates = trackPoints.map(pt => [pt.lon, pt.lat]);
    return {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: routeCoordinates,
      },
    };
  }, [trackPoints]);

  const stationsGeoJSON = useMemo<GeoJSON.FeatureCollection<GeoJSON.Point>>(() => {
    return {
      type: 'FeatureCollection',
      features: stations.map(station => ({
        type: 'Feature',
        properties: { name: station.name },
        geometry: {
          type: 'Point',
          coordinates: [station.lon, station.lat],
        },
      })),
    };
  }, [stations]);

  const participantGeoJSON = useMemo<GeoJSON.FeatureCollection<GeoJSON.Point> | null>(() => {
    if (!participantPosition) return null;
    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Point',
            coordinates: [participantPosition.lon, participantPosition.lat],
          },
        },
      ],
    };
  }, [participantPosition]);

  // Calculate bounds manually from track points
  const routeBounds = useMemo(() => {
    if (trackPoints.length === 0) return null;

    let minLat = Infinity, maxLat = -Infinity;
    let minLon = Infinity, maxLon = -Infinity;

    trackPoints.forEach(pt => {
      minLat = Math.min(minLat, pt.lat);
      maxLat = Math.max(maxLat, pt.lat);
      minLon = Math.min(minLon, pt.lon);
      maxLon = Math.max(maxLon, pt.lon);
    });

    return {
      sw: [minLon, minLat] as [number, number],
      ne: [maxLon, maxLat] as [number, number],
    };
  }, [trackPoints]);

  // ✅ FIXED: Zoom to route bounds (Europe)
  useEffect(() => {
    if (routeBounds && cameraRef.current) {
      console.log('📍 Route bounds:', {
        sw: routeBounds.sw.map(c => c.toFixed(4)),
        ne: routeBounds.ne.map(c => c.toFixed(4)),
      });
      
      // Multiple attempts to ensure zoom works
      const attemptZoom = (delay: number) => {
        setTimeout(() => {
          if (cameraRef.current) {
            cameraRef.current.fitBounds(
              routeBounds.ne,
              routeBounds.sw,
              [100, 100, 100, 100], // generous padding
              1000
            );
            console.log('✅ Camera fitted to route bounds');
          }
        }, delay);
      };

      // Try at different intervals to ensure it works
      attemptZoom(300);
      attemptZoom(800);
      attemptZoom(1500);
    }
  }, [routeBounds]);

  // Follow mode
  useEffect(() => {
    if (followMode && participantPosition && cameraRef.current) {
      cameraRef.current.setCamera({
        centerCoordinate: [participantPosition.lon, participantPosition.lat],
        zoomLevel: 14,
        pitch: 0,
        heading: 0,
        animationDuration: 800,
        animationMode: 'easeTo',
      });
    }
  }, [followMode, participantPosition]);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapViewRef}
        style={styles.map}
        styleURL="mapbox://styles/mapbox/light-v11"
        compassEnabled={false}
        logoEnabled={false}
        attributionEnabled={false}
        onDidFinishLoadingMap={() => {
          console.log('✅ Map loaded');
          if (onMapReady) onMapReady();
        }}
      >
        {/* Camera - Start in Europe (France/Alps area) */}
        <Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: [6.8650, 45.8320], // Chamonix area (from GPX)
            zoomLevel: 11,
            pitch: 0,
          }}
          animationMode="easeTo"
          animationDuration={1000}
        />

        {/* Route Line */}
        <ShapeSource id="routeSource" shape={routeGeoJSON}>
          <LineLayer
            id="routeOutline"
            style={{
              lineColor: '#B71C1C',
              lineWidth: 8,
              lineOpacity: 0.8,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
          <LineLayer
            id="routeLine"
            style={{
              lineColor: '#E53935',
              lineWidth: 6,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
        </ShapeSource>

        {/* Station Points */}
        <ShapeSource id="stationsSource" shape={stationsGeoJSON}>
          <CircleLayer
            id="stationsOutline"
            style={{
              circleRadius: 10,
              circleColor: '#FFFFFF',
              circleStrokeWidth: 2,
              circleStrokeColor: '#000000',
            }}
          />
          <CircleLayer
            id="stationsInner"
            style={{
              circleRadius: 7,
              circleColor: '#000000',
            }}
          />
        </ShapeSource>

        {/* Participant Marker */}
        {participantGeoJSON && (
          <ShapeSource id="participantSource" shape={participantGeoJSON}>
            <CircleLayer
              id="participantGlow"
              style={{
                circleRadius: 18,
                circleColor: '#4CAF50',
                circleOpacity: 0.25,
              }}
            />
            <CircleLayer
              id="participantBorder"
              style={{
                circleRadius: 13,
                circleColor: '#FFFFFF',
              }}
            />
            <CircleLayer
              id="participantInner"
              style={{
                circleRadius: 10,
                circleColor: '#4CAF50',
              }}
            />
          </ShapeSource>
        )}
      </MapView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
});