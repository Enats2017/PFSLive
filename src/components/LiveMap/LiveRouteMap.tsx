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
    start: '#22C55E', // green  — universally understood as start
    finish: '#EF4444', // red    — universally understood as finish
    checkpoint: '#1a1a2e', // dark   — intermediate checkpoints
    participant: '#F97316', // orange — tracked athletes
    follower: '#6366F1', // indigo — "you are here" marker (viewer's own position)
} as const;

interface LiveRouteMapProps {
    trackPoints: GPXTrackPoint[];
    aidStations: GPXAidStation[];
    participants: ParticipantMapMarker[];
    apiCheckpoints: CheckpointData[];
    onAidStationPress: (station: AidStationMapMarker) => void;
    onParticipantPress: (participant: ParticipantMapMarker) => void;
    isLoadingParticipants?: boolean;
    /** Viewer's own GPS position — plotted client-side, never stored to DB. */
    followerLocation?: { lat: number; lon: number } | null;
}

// ── Viewport helper ───────────────────────────────────────────────────────────
// Mapbox getVisibleBounds() returns [[neLon, neLat], [swLon, swLat]].
// Returns true when (lon,lat) sits inside that rectangle, with an optional
// margin (fraction of the viewport span) so a point that's technically
// on-screen but hugging the very edge still counts as "needs recenter".
const isPointInBounds = (
    lon: number,
    lat: number,
    visibleBounds: [[number, number], [number, number]],
    marginFraction = 0.15,
): boolean => {
    const [[neLon, neLat], [swLon, swLat]] = visibleBounds;

    const maxLon = Math.max(neLon, swLon);
    const minLon = Math.min(neLon, swLon);
    const maxLat = Math.max(neLat, swLat);
    const minLat = Math.min(neLat, swLat);

    // Shrink the box inward by marginFraction so points near the edge are
    // treated as out-of-view and trigger a recenter before they fully exit.
    const lonSpan = (maxLon - minLon) * marginFraction;
    const latSpan = (maxLat - minLat) * marginFraction;

    return (
        lon >= minLon + lonSpan &&
        lon <= maxLon - lonSpan &&
        lat >= minLat + latSpan &&
        lat <= maxLat - latSpan
    );
};

export const LiveRouteMap: React.FC<LiveRouteMapProps> = ({
    trackPoints,
    aidStations,
    participants,
    apiCheckpoints,
    onAidStationPress,
    onParticipantPress,
    isLoadingParticipants = false,
    followerLocation = null,
}) => {
    const cameraRef = useRef<Mapbox.Camera>(null);
    // ✅ NEW — ref to the MapView so we can read the current viewport
    // (getVisibleBounds) during auto-refresh and decide whether the tracked
    // participant has drifted off-screen.
    const mapViewRef = useRef<Mapbox.MapView>(null);
    const [mapReady, setMapReady] = useState(false);
    const mapReadyRef = useRef(false);

    // ✅ camera fit-once tracking.
    //
    //   hasFitCameraRef
    //     Becomes true after the FIRST successful auto-fit for the currently
    //     loaded route. While true, the route-bounds effect short-circuits so
    //     subsequent renders don't clobber the fan's manual zoom / pan. The
    //     participants effect no longer hard short-circuits — instead it does
    //     a "follow if off-screen" check (see below).
    //
    //   prevTrackPointsLengthRef
    //     Lets us detect a fresh route load (0 → N) to re-arm the auto-fit.
    const hasFitCameraRef          = useRef(false);
    const prevTrackPointsLengthRef = useRef(0);

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

    // ✅ detect "fresh route loaded" and re-arm the auto-fit.
    // When trackPoints transitions 0 → N (initial load or distance switch),
    // clear the "already fit" flag so the next render fits the new route.
    useEffect(() => {
        const prev = prevTrackPointsLengthRef.current;
        const curr = trackPoints.length;
        if (prev === 0 && curr > 0) {
            console.log('🆕 Fresh route loaded — re-arming auto-fit');
            hasFitCameraRef.current = false;
        }
        prevTrackPointsLengthRef.current = curr;
    }, [trackPoints]);

    // Route-bounds fit: fit ONCE per route load. The route never moves, so
    // after the first fit we leave the camera entirely to the user / to the
    // participants follow-effect below.
    useEffect(() => {
        if (!bounds) return;

        if (hasFitCameraRef.current) {
            console.log('🔒 Skipping bounds fit — camera already positioned (preserving user view)');
            return;
        }

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
            hasFitCameraRef.current = true;
        };
        const timer = setTimeout(tryFocus, 300);
        return () => clearTimeout(timer);
    }, [bounds]);

    // ── Participants follow effect ─────────────────────────────────────────
    // BEFORE the first fit: behaves like before (fit to participant bounds).
    // AFTER the first fit: no longer hard short-circuits. Instead it preserves
    // the fan's current ZOOM and only PANS when the tracked position has
    // drifted off-screen (outside getVisibleBounds, minus a small margin).
    // If the tracked position is still comfortably on-screen, the camera is
    // left untouched so manual zoom / pan is preserved.
    useEffect(() => {
        if (!mapReadyRef.current) return;
        if (participants.length === 0) return;

        const valid = participants.filter(p => p.lat !== 0 && p.lon !== 0);
        if (valid.length === 0) return;
        if (!cameraRef.current) return;

        // ── Case 1: initial fit not done yet → original fit-to-bounds behaviour.
        if (!hasFitCameraRef.current) {
            const timer = setTimeout(() => {
                if (!cameraRef.current) return;

                if (valid.length === 1) {
                    cameraRef.current.setCamera({
                        centerCoordinate: [valid[0].lon, valid[0].lat],
                        zoomLevel: 15,
                        animationDuration: 800,
                        animationMode: 'flyTo',
                    });
                } else {
                    const lons = valid.map(p => p.lon);
                    const lats = valid.map(p => p.lat);
                    cameraRef.current.fitBounds(
                        [Math.max(...lons), Math.max(...lats)],
                        [Math.min(...lons), Math.min(...lats)],
                        [80, 80, 80, 80],
                        800
                    );
                }
                hasFitCameraRef.current = true;
            }, 500);

            return () => clearTimeout(timer);
        }

        // ── Case 2: already fit (auto-refresh) → follow only if off-screen,
        //    preserving the fan's current zoom level.
        let cancelled = false;

        const followIfOffScreen = async () => {
            if (!mapViewRef.current || !cameraRef.current) return;

            let visibleBounds: [[number, number], [number, number]] | null = null;
            try {
                // getVisibleBounds → [[neLon, neLat], [swLon, swLat]]
                visibleBounds = await mapViewRef.current.getVisibleBounds() as any;
            } catch (e) {
                console.log('⚠️ getVisibleBounds failed, skipping follow:', e);
                return;
            }
            if (cancelled || !visibleBounds) return;

            // Track the centroid of all valid participants (for a single
            // self-tracked user this is just their position).
            const lons = valid.map(p => p.lon);
            const lats = valid.map(p => p.lat);
            const centerLon = (Math.max(...lons) + Math.min(...lons)) / 2;
            const centerLat = (Math.max(...lats) + Math.min(...lats)) / 2;

            // If EVERY tracked point is still on-screen, leave the camera as
            // the fan set it. Otherwise recenter on the centroid, keeping zoom.
            const allOnScreen = valid.every(p =>
                isPointInBounds(p.lon, p.lat, visibleBounds!),
            );

            if (allOnScreen) {
                console.log('✅ Tracked position still on-screen — preserving fan view');
                return;
            }

            console.log('📍 Tracked position off-screen — panning to follow (zoom preserved)');
            // setCamera with ONLY centerCoordinate keeps the current zoomLevel.
            cameraRef.current!.setCamera({
                centerCoordinate: [centerLon, centerLat],
                animationDuration: 800,
                animationMode: 'easeTo',
            });
        };

        const timer = setTimeout(followIfOffScreen, 500);
        return () => { cancelled = true; clearTimeout(timer); };
    }, [participants, mapReady]);

    const participantsGeoJSON = React.useMemo<GeoJSON.FeatureCollection<GeoJSON.Point>>(() => {
        console.log('🗺️ Creating participants GeoJSON with', participants.length, 'participants');

        const validParticipants = participants.filter(p => p.lat !== 0 || p.lon !== 0);

        return {
            type: 'FeatureCollection',
            features: validParticipants.map(p => ({
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
                            features: JSON.stringify(checkpoint.features ?? []),
                        },
                        geometry: {
                            type: 'Point' as const,
                            coordinates: [offsetLon, offsetLat],
                        },
                    };
                }),
            };
        }

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

    const followerGeoJSON = React.useMemo<GeoJSON.FeatureCollection<GeoJSON.Point>>(() => ({
        type: 'FeatureCollection',
        features: followerLocation
            ? [{
                type: 'Feature',
                properties: { type: 'follower' },
                geometry: { type: 'Point', coordinates: [followerLocation.lon, followerLocation.lat] },
            }]
            : [],
    }), [followerLocation]);

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
                features: typeof props.features === 'string'
                    ? JSON.parse(props.features)
                    : props.features ?? [],
            };

            onAidStationPress(station);
        }
    };

    return (
        <View style={liveTrackingStyles.mapContainer}>
            <Mapbox.MapView
                ref={mapViewRef}
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

                {/* ── Checkpoints / Aid Stations ─────────────────────────── */}
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
                                ['==', ['get', 'is_start'], true], MARKER_COLORS.start,
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

                {/* ── Participants ───────────────────────────────────────── */}
                {participants.length > 0 && (
                    <Mapbox.ShapeSource
                        id="participants-source"
                        shape={participantsGeoJSON}
                        onPress={handleParticipantPress}
                    >
                        <Mapbox.CircleLayer
                            id="participant-dots"
                            style={{
                                circleColor: MARKER_COLORS.participant,
                                circleRadius: 13,
                                circleStrokeWidth: 4,
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
                                textSize: 24,
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

                {/* ── Follower "You are here" marker ──────────────────────── */}
                {followerLocation && (
                    <Mapbox.ShapeSource id="follower-source" shape={followerGeoJSON}>
                        <Mapbox.CircleLayer
                            id="follower-dot"
                            style={{
                                circleColor: MARKER_COLORS.follower,
                                circleRadius: 10,
                                circleStrokeWidth: 3,
                                circleStrokeColor: '#FFFFFF',
                                circlePitchAlignment: 'map',
                            }}
                        />
                        <Mapbox.SymbolLayer
                            id="follower-label"
                            style={{
                                textField: 'YOU',
                                textSize: 10,
                                textColor: MARKER_COLORS.follower,
                                textHaloColor: '#FFFFFF',
                                textHaloWidth: 2,
                                textOffset: [0, 1.8],
                                textAnchor: 'top',
                                textAllowOverlap: true,
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