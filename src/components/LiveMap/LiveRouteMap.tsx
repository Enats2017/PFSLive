import React, { useRef, useEffect, useState } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import Mapbox from '@rnmapbox/maps';
import { GPXTrackPoint, GPXAidStation } from '../../services/gpxService';
import { ParticipantMapMarker, AidStationMapMarker, CheckpointData } from '../../types/liveTracking';
import { liveTrackingStyles } from '../../styles/liveTracking.styles';
import { colors } from '../../styles/common.styles';

// ── Map marker colors ────────────────────────────────────────────────────────
// Each marker type has a distinct color so they're easy to tell apart at a glance.
const MARKER_COLORS = {
    start:       '#22C55E', // green  — universally understood as start
    finish:      '#EF4444', // red    — universally understood as finish
    checkpoint:  '#1a1a2e', // dark — intermediate checkpoints (with fork & knife icon)
    participant: '#F97316', // blue   — tracked athletes (distinct from start green)
} as const;

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
        firstParticipant: participants[0] ? { lat: participants[0].lat, lon: participants[0].lon } : null,
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
        if (trackPoints.length === 0) return [4.4699, 50.5039];
        const lons = trackPoints.map(pt => pt.lon);
        const lats = trackPoints.map(pt => pt.lat);
        return [(Math.max(...lons) + Math.min(...lons)) / 2, (Math.max(...lats) + Math.min(...lats)) / 2];
    }, [trackPoints]);

    const bounds = React.useMemo(() => {
        // Priority 1: GPX track
        if (trackPoints.length > 0) {
            const lons = trackPoints.map(pt => pt.lon);
            const lats = trackPoints.map(pt => pt.lat);
            return {
                ne: [Math.max(...lons), Math.max(...lats)] as [number, number],
                sw: [Math.min(...lons), Math.min(...lats)] as [number, number],
            };
        }

        // Priority 2: participant positions
        const validParticipants = participants.filter(p => p.lat !== 0 && p.lon !== 0);
        if (validParticipants.length > 0) {
            const lons = validParticipants.map(p => p.lon);
            const lats = validParticipants.map(p => p.lat);
            return {
                ne: [Math.max(...lons), Math.max(...lats)] as [number, number],
                sw: [Math.min(...lons), Math.min(...lats)] as [number, number],
            };
        }

        // Priority 3: API checkpoints
        const validCheckpoints = apiCheckpoints.filter(cp => {
            const lat = parseFloat(String(cp.latitude));
            const lon = parseFloat(String(cp.longitude));
            return !isNaN(lat) && !isNaN(lon) && lat !== 0 && lon !== 0;
        });
        if (validCheckpoints.length > 0) {
            const lons = validCheckpoints.map(cp => parseFloat(String(cp.longitude)));
            const lats = validCheckpoints.map(cp => parseFloat(String(cp.latitude)));
            console.log('📍 Bounds from checkpoints:', { lons, lats });
            return {
                ne: [Math.max(...lons), Math.max(...lats)] as [number, number],
                sw: [Math.min(...lons), Math.min(...lats)] as [number, number],
            };
        }

        return null;
    }, [trackPoints, participants, apiCheckpoints]);

    console.log('🗺️ Bounds source:', {
        hasTrackPoints: trackPoints.length > 0,
        hasValidParticipants: participants.filter(p => p.lat !== 0 && p.lon !== 0).length,
        hasValidCheckpoints: apiCheckpoints.filter(cp => cp.latitude && cp.longitude).length,
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
                    animationDuration: 100,
                    animationMode: 'flyTo',
                });
            } else {
                cameraRef.current.fitBounds(bounds.ne, bounds.sw, [50, 50, 50, 50], 1000);
            }
        };
        const timer = setTimeout(tryFocus, 300);
        return () => clearTimeout(timer);
    }, [bounds]);

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

    const aidStationsGeoJSON = React.useMemo<GeoJSON.FeatureCollection<GeoJSON.Point>>(() => {
        if (apiCheckpoints.length > 0) {
            const validCheckpoints = apiCheckpoints.filter(cp => {
                const lat = parseFloat(String(cp.latitude));
                const lon = parseFloat(String(cp.longitude));
                const valid = !isNaN(lat) && !isNaN(lon) && lat !== 0 && lon !== 0;
                if (!valid) {
                    console.log(`⚠️ Skipping checkpoint "${cp.name}" — invalid coords:`, cp.latitude, cp.longitude);
                }
                return valid;
            });

            console.log(`🗺️ Checkpoints: ${apiCheckpoints.length} total, ${validCheckpoints.length} with valid coords`);

            return {
                type: 'FeatureCollection',
                features: validCheckpoints.map((checkpoint, idx) => {
                    const lat = parseFloat(String(checkpoint.latitude));
                    const lon = parseFloat(String(checkpoint.longitude));

                    // ✅ Offset FIN slightly so it doesn't fully overlap START
                    const offsetLon = checkpoint.is_finish ? lon + 0.0003 : lon;
                    const offsetLat = checkpoint.is_finish ? lat + 0.0003 : lat;

                    return {
                        type: 'Feature' as const,
                        properties: {
                            id: `checkpoint-${idx}`,
                            name: checkpoint.name,
                            distance_km: checkpoint.distance,
                            ele: checkpoint.elevation,
                            accessible_by_car: checkpoint.accessible_by_car,
                            is_start: checkpoint.is_start,
                            is_finish: checkpoint.is_finish,
                        },
                        geometry: {
                            type: 'Point' as const,
                            coordinates: [offsetLon, offsetLat],
                        },
                    };
                }),
            };
        }

        // Fallback to GPX aid stations
        return {
            type: 'FeatureCollection',
            features: aidStations.map((station, idx) => ({
                type: 'Feature' as const,
                properties: {
                    id: `aid-${idx}`,
                    name: station.name,
                    distance_km: station.distance || 0,
                    ele: station.ele,
                    accessible_by_car: station.accessible_by_car,
                    is_start: false,
                    is_finish: false,
                },
                geometry: {
                    type: 'Point' as const,
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

                {/* Route */}
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

                {/* ── Checkpoints / Aid Stations ───────────────────────────
                    green  = START
                    red    = FINISH
                    orange = intermediate checkpoints (with fork & knife icon)
                    Two filtered SymbolLayers to avoid mixing textField + iconImage. */}
                <Mapbox.ShapeSource
                    id="aidstations-source"
                    shape={aidStationsGeoJSON}
                    onPress={handleAidStationPress}
                >
                    <Mapbox.CircleLayer
                        id="aidstation-circles"
                        style={{
                            circleColor: [
                                'case',
                                ['==', ['get', 'is_start'], true],  MARKER_COLORS.start,
                                ['==', ['get', 'is_finish'], true], MARKER_COLORS.finish,
                                MARKER_COLORS.checkpoint,
                            ] as any,
                            circleRadius: 14,
                            circleStrokeWidth: 3,
                            circleStrokeColor: '#FFFFFF',
                            circlePitchAlignment: 'map',
                            circleOpacity: 1,
                        }}
                    />

                    {/* Fork & knife icon for intermediate checkpoints */}
                    <Mapbox.SymbolLayer
                        id="aidstation-fork-icons"
                        filter={['all',
                            ['!=', ['get', 'is_start'], true],
                            ['!=', ['get', 'is_finish'], true],
                        ] as any}
                        style={{
                            iconImage: 'restaurant-15',
                            iconSize: 1.2,
                            iconColor: '#FFFFFF',
                            iconAllowOverlap: true,
                            iconIgnorePlacement: true,
                        }}
                    />

                    {/* S / F text for start & finish */}
                    <Mapbox.SymbolLayer
                        id="aidstation-sf-labels"
                        filter={['any',
                            ['==', ['get', 'is_start'], true],
                            ['==', ['get', 'is_finish'], true],
                        ] as any}
                        style={{
                            textField: ['case',
                                ['==', ['get', 'is_start'], true], 'S',
                                'F',
                            ] as any,
                            textSize: 14,
                            textColor: '#FFFFFF',
                            textFont: ['Open Sans Bold', 'Arial Unicode MS Bold'],
                            textAllowOverlap: true,
                            iconAllowOverlap: true,
                            textIgnorePlacement: true,
                        }}
                    />


                </Mapbox.ShapeSource>

                {/* ── Participants ─────────────────────────────────────────
                    Blue circles — distinct from green START marker. */}
                {participants.length > 0 && (
                    <Mapbox.ShapeSource
                        id="participants-source"
                        shape={participantsGeoJSON}
                        onPress={handleParticipantPress}
                    >
                        <Mapbox.CircleLayer
                            id="participant-dots"
                            style={{
                                circleColor: MARKER_COLORS.participant, // blue
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
                                textColor: MARKER_COLORS.participant,
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