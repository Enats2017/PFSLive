import React, { useRef, useEffect, useState } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import Mapbox from '@rnmapbox/maps';
import { GPXTrackPoint, GPXAidStation } from '../../services/gpxService';
import { ParticipantMapMarker, AidStationMapMarker, CheckpointData } from '../../types/liveTracking';
import { liveTrackingStyles } from '../../styles/liveTracking.styles';
import { colors } from '../../styles/common.styles';

interface LiveRouteMapProps {
    trackPoints: GPXTrackPoint[];
    aidStations: GPXAidStation[];
    participants: ParticipantMapMarker[];
    apiCheckpoints: CheckpointData[];
    onAidStationPress: (station: AidStationMapMarker) => void;
    onParticipantPress: (participant: ParticipantMapMarker) => void;
    isLoadingParticipants?: boolean;
}

export const LiveRouteMap: React.FC<LiveRouteMapProps> = ({
    trackPoints,
    aidStations,
    participants,
    apiCheckpoints,
    onAidStationPress,
    onParticipantPress,
    isLoadingParticipants = false,
}) => {
    const cameraRef = useRef<Mapbox.Camera>(null);
    const [mapReady, setMapReady] = useState(false);
    const mapReadyRef = useRef(false);

    console.log('👥 Map received participants:', {
        count: participants.length,
        firstParticipant: participants[0] ? {
            lat: participants[0].lat,
            lon: participants[0].lon,
        } : null,
    });

    const routeGeoJSON: GeoJSON.Feature<GeoJSON.LineString> = React.useMemo(() => ({
        type: 'Feature',
        properties: {},
        geometry: {
            type: 'LineString',
            coordinates: trackPoints.map(pt => [pt.lon, pt.lat]),
        },
    }), [trackPoints]);

    const mapCenter = React.useMemo(() => {
        if (trackPoints.length === 0) return [0, 0];
        const lons = trackPoints.map(pt => pt.lon);
        const lats = trackPoints.map(pt => pt.lat);
        const centerLon = (Math.max(...lons) + Math.min(...lons)) / 2;
        const centerLat = (Math.max(...lats) + Math.min(...lats)) / 2;
        return [centerLon, centerLat];
    }, [trackPoints]);

    const bounds = React.useMemo(() => {
        // Priority 1: fit to GPX track points
        if (trackPoints.length > 0) {
            const lons = trackPoints.map(pt => pt.lon);
            const lats = trackPoints.map(pt => pt.lat);
            return {
                ne: [Math.max(...lons), Math.max(...lats)] as [number, number],
                sw: [Math.min(...lons), Math.min(...lats)] as [number, number],
            };
        }

        // Priority 2: no GPX — fit to participant coordinates
        const validParticipants = participants.filter(p => p.lat !== 0 && p.lon !== 0);
        if (validParticipants.length > 0) {
            const lons = validParticipants.map(p => p.lon);
            const lats = validParticipants.map(p => p.lat);
            return {
                ne: [Math.max(...lons), Math.max(...lats)] as [number, number],
                sw: [Math.min(...lons), Math.min(...lats)] as [number, number],
            };
        }

        return null;
    }, [trackPoints, participants]);

    console.log('🗺️ Bounds check:', {
        hasTrackPoints: trackPoints.length > 0,
        hasValidParticipants: participants.filter(p => p.lat !== 0 && p.lon !== 0).length,
        boundsSource: trackPoints.length > 0 ? 'GPX' : participants.filter(p => p.lat !== 0 && p.lon !== 0).length > 0 ? 'participants' : 'none',
        bounds,
    });

    useEffect(() => {
        if (!bounds) return;

        const tryFocus = () => {
            if (!cameraRef.current) {
                console.log('❌ cameraRef null, retrying...');
                setTimeout(tryFocus, 300);
                return;
            }

            const isSinglePoint = bounds.ne[0] === bounds.sw[0] && bounds.ne[1] === bounds.sw[1];
            console.log('📍 Focusing map | isSinglePoint:', isSinglePoint, '| coords:', bounds.ne);

            if (isSinglePoint) {
                cameraRef.current.setCamera({
                    centerCoordinate: bounds.ne,
                    zoomLevel: 15,
                    animationDuration: 1000,
                    animationMode: 'flyTo',
                });
            } else {
                cameraRef.current.fitBounds(bounds.ne, bounds.sw, [50, 50, 50, 50], 1000);
            }
        };

        const timer = setTimeout(tryFocus, 800);
        return () => clearTimeout(timer);
    }, [bounds]); // ← removed mapReady from deps



    const participantsGeoJSON = React.useMemo<GeoJSON.FeatureCollection<GeoJSON.Point>>(() => {
        console.log('🗺️ Creating participants GeoJSON with', participants.length, 'participants');
        return {
            type: 'FeatureCollection',
            features: participants.map(p => ({
                type: 'Feature',
                properties: {
                    id: p.id,
                    bib: p.bib,
                    name: p.name,
                    customer_app_id: p.customer_app_id,
                    gender: p.gender,
                    position: p.position,
                    position_gender: p.position_gender,
                    position_category: p.position_category,
                    category: p.category,
                    race_time: p.race_time,
                    race_time_seconds: p.race_time_seconds,
                    distance_km: p.distance_km,
                    avg_speed_kmh: p.avg_speed_kmh,
                    last_checkpoint_name: p.last_checkpoint_name,
                    distance_to_next_cp: p.distance_to_next_cp,
                    last_update: p.last_update,
                    last_update_time: p.last_update_time,
                    last_update_type: p.last_update_type,
                    profile_picture: p.profile_picture,
                    source: p.source,
                    initials: p.initials,
                },
                geometry: {
                    type: 'Point',
                    coordinates: [p.lon, p.lat],
                },
            })),
        };
    }, [participants]);

    // ✅ Use API checkpoints if available, otherwise fall back to GPX aid stations
    const aidStationsGeoJSON = React.useMemo<GeoJSON.FeatureCollection<GeoJSON.Point>>(() => {
        if (apiCheckpoints.length > 0) {
            // ✅ Filter out START and FINISH from map display
            const visibleCheckpoints = apiCheckpoints.filter(cp => !cp.is_start && !cp.is_finish);

            console.log('🗺️ Using API checkpoints for map:', visibleCheckpoints.map(c => c.name));

            return {
                type: 'FeatureCollection',
                features: visibleCheckpoints.map((checkpoint, idx) => ({
                    type: 'Feature',
                    properties: {
                        id: `checkpoint-${idx}`,
                        name: checkpoint.name,
                        distance_km: checkpoint.distance,
                        ele: checkpoint.elevation,
                        accessible_by_car: checkpoint.accessible_by_car,
                    },
                    geometry: {
                        type: 'Point',
                        coordinates: [checkpoint.longitude, checkpoint.latitude],
                    },
                })),
            };
        }

        // Fallback to GPX aid stations
        return {
            type: 'FeatureCollection',
            features: aidStations.map((station, idx) => ({
                type: 'Feature',
                properties: {
                    id: `aid-${idx}`,
                    name: station.name,
                    distance_km: station.distance || 0,
                    ele: station.ele,
                    accessible_by_car: station.accessible_by_car,
                },
                geometry: {
                    type: 'Point',
                    coordinates: [station.lon, station.lat],
                },
            })),
        };
    }, [aidStations, apiCheckpoints]);

    const handleParticipantPress = (event: any) => {
        console.log('👆 Participant tapped:', event.features?.length);
        const feature = event.features[0];
        if (feature && feature.properties) {
            const props = feature.properties;
            const participant: ParticipantMapMarker = {
                id: props.id,
                customer_app_id: props.customer_app_id,
                bib: props.bib,
                name: props.name,
                initials: props.initials,
                lat: feature.geometry.coordinates[1],
                lon: feature.geometry.coordinates[0],
                ele: 0,
                gender: props.gender,
                position: props.position,
                position_gender: props.position_gender,
                position_category: props.position_category,
                category: props.category,
                race_time: props.race_time,
                race_time_seconds: props.race_time_seconds,
                distance_km: props.distance_km,
                avg_speed_kmh: props.avg_speed_kmh,
                last_checkpoint_name: props.last_checkpoint_name,
                distance_to_next_cp: props.distance_to_next_cp,
                last_update: props.last_update,
                last_update_time: props.last_update_time,
                last_update_type: props.last_update_type,
                profile_picture: props.profile_picture,
                source: props.source,
            };
            onParticipantPress(participant);
        }
    };

    const handleAidStationPress = (event: any) => {
        const feature = event.features[0];
        if (feature && feature.properties) {
            const props = feature.properties;
            const station: AidStationMapMarker = {
                id: props.id,
                name: props.name,
                lat: feature.geometry.coordinates[1],
                lon: feature.geometry.coordinates[0],
                ele: props.ele,
                distance_km: props.distance_km,
                accessible_by_car: props.accessible_by_car,
            };
            onAidStationPress(station);
        }
    };

    return (
        <View style={liveTrackingStyles.mapContainer}>
            <Mapbox.MapView
                style={{ flex: 1 }}
                styleURL={Mapbox.StyleURL.Outdoors}
                compassEnabled={true}
                scaleBarEnabled={false}
                logoEnabled={false}
                attributionEnabled={false}
                onDidFinishLoadingMap={() => {
                    console.log('🗺️ Map finished loading');
                    mapReadyRef.current = true;
                    setMapReady(true);
                }}
            >
                <Mapbox.Camera
                    ref={cameraRef}
                    centerCoordinate={mapCenter as [number, number]}
                    zoomLevel={12}
                    animationMode="flyTo"
                    animationDuration={1000}
                />

                {/* Route LineString - BLUE */}
                <Mapbox.ShapeSource id="route-source" shape={routeGeoJSON}>
                    <Mapbox.LineLayer
                        id="route-line"
                        style={{
                            lineColor: '#3B82F6',
                            lineWidth: 4,
                            lineCap: 'round',
                            lineJoin: 'round',
                        }}
                    />
                </Mapbox.ShapeSource>

                {/* Aid Stations / Checkpoints */}
                <Mapbox.ShapeSource
                    id="aidstations-source"
                    shape={aidStationsGeoJSON}
                    onPress={handleAidStationPress}
                >
                    <Mapbox.CircleLayer
                        id="aidstation-circles"
                        style={{
                            circleColor: '#000000',
                            circleRadius: 12,
                            circleStrokeWidth: 3,
                            circleStrokeColor: '#FFFFFF',
                            circlePitchAlignment: 'map',
                            circleOpacity: 1,
                        }}
                    />

                    <Mapbox.SymbolLayer
                        id="aidstation-icons"
                        style={{
                            textField: '🍴',
                            textSize: 16,
                            textAllowOverlap: true,
                            iconAllowOverlap: true,
                            textIgnorePlacement: true,
                        }}
                    />
                </Mapbox.ShapeSource>

                {/* Participants */}
                {participants.length > 0 && (
                    <Mapbox.ShapeSource
                        id="participants-source"
                        shape={participantsGeoJSON}
                        onPress={handleParticipantPress}
                    >
                        <Mapbox.CircleLayer
                            id="participant-dots"
                            style={{
                                circleColor: '#22C55E',
                                circleRadius: 10,
                                circleStrokeWidth: 3,
                                circleStrokeColor: '#FFFFFF',
                                circlePitchAlignment: 'map',
                                circleOpacity: 1,
                            }}
                        />

                        <Mapbox.SymbolLayer
                            id="participant-bibs"
                            minZoomLevel={13}
                            style={{
                                textField: ['get', 'initials'],
                                textSize: 12,
                                textColor: '#22C55E',
                                textHaloColor: '#FFFFFF',
                                textHaloWidth: 2,
                                textOffset: [0, 1.8],
                                textAnchor: 'top',
                                textAllowOverlap: true,
                                iconAllowOverlap: true,
                                textIgnorePlacement: true,
                            }}
                        />
                    </Mapbox.ShapeSource>
                )}
            </Mapbox.MapView>

            {isLoadingParticipants && (
                <View style={liveTrackingStyles.mapLoadingOverlay}>
                    <View style={liveTrackingStyles.mapLoadingBox}>
                        <ActivityIndicator size="large" color={colors.primary} />
                        <Text style={liveTrackingStyles.mapLoadingText}>
                            Loading participants...
                        </Text>
                    </View>
                </View>
            )}
        </View>
    );
};