import React from 'react';
import { View, Text, ScrollView, Dimensions, TouchableOpacity } from 'react-native';
import { VictoryArea, VictoryChart, VictoryAxis, VictoryScatter, VictoryLine, VictoryLabel } from 'victory-native';
import { useTranslation } from 'react-i18next';
import { ChartDataPoint } from '../../types';
import { GPXAidStation } from '../../services/gpxService';
import { ParticipantMapMarker, AidStationMapMarker, CheckpointData } from '../../types/liveTracking';
import { liveTrackingStyles } from '../../styles/liveTracking.styles';
import { colors } from '../../styles/common.styles';

interface LiveElevationProfileProps {
    chartData: ChartDataPoint[];
    aidStations: GPXAidStation[];
    apiCheckpoints: CheckpointData[];
    participants: ParticipantMapMarker[];
    totalDistance: number;
    minElevation: number;
    maxElevation: number;
    onAidStationPress?: (station: AidStationMapMarker) => void;
    onParticipantPress?: (participant: ParticipantMapMarker) => void;
}

export const LiveElevationProfile: React.FC<LiveElevationProfileProps> = React.memo(({
    chartData,
    aidStations,
    apiCheckpoints,
    participants,
    totalDistance,
    minElevation,
    maxElevation,
    onAidStationPress,
    onParticipantPress,
}) => {
    const { t } = useTranslation('livetracking');
    const screenWidth = Dimensions.get('window').width;

    const scrollViewRef = React.useRef<ScrollView>(null);

    // ── Chart width ───────────────────────────────────────────────────────
    // Short/medium routes span a FIXED physical width (DISTANCE_DIVISOR cm), so
    // the profile stays compact and overlay-friendly. A clamp on km-per-cm caps
    // how compressed it can ever get: once a route would exceed MAX_KM_PER_CM,
    // the width grows (and scrolls) instead of cramming more in.
    //
    //   km shown per cm = min(totalDistance / DISTANCE_DIVISOR, MAX_KM_PER_CM)
    //     ≤100km → totalDistance/10  → route spans exactly DISTANCE_DIVISOR cm
    //     >100km → capped at 10 km/cm → width grows linearly, scrolls
    //   e.g. 50km→10cm, 100km→10cm, 170km→17cm, 330km→33cm.
    //
    // React Native layout units (dp) are normalised to 160 dpi, so 1 cm ≈ 63 dp
    // on every device. Tune: DISTANCE_DIVISOR = fit-width for short/medium
    // routes; MAX_KM_PER_CM = worst-case zoom (lower = less compression, more
    // scroll on ultras).
    const DISTANCE_DIVISOR = 10;            // short/medium routes span this many cm
    const MAX_KM_PER_CM    = 10;            // compression ceiling — never cram more than this per cm
    const DP_PER_CM = 160 / 2.54;           // ≈ 63 dp per physical cm in RN layout units

    const kmPerCm = totalDistance > 0
        ? Math.min(totalDistance / DISTANCE_DIVISOR, MAX_KM_PER_CM)
        : 1;
    const routeWidthCm = kmPerCm > 0 ? totalDistance / kmPerCm : DISTANCE_DIVISOR;
    // Never narrower than the screen: fills wide screens, scrolls when longer.
    const chartWidth = Math.max(screenWidth, routeWidthCm * DP_PER_CM);
    const chartHeight = 220;

    const elevationRange = maxElevation - minElevation;
    const topBuffer = elevationRange * 0.15;
    const bottomBuffer = elevationRange * 0.05;

    const yDomain: [number, number] = [minElevation - bottomBuffer, maxElevation + topBuffer];

    const checkpointChartPoints = React.useMemo(() => {
        if (apiCheckpoints.length > 0) {
            const visible = apiCheckpoints;

            console.log('📊 Using API checkpoints for elevation:', visible.map(c => ({
                name: c.name,
                distance: c.distance,
                segment: c.segment_distance
            })));

            return visible.map((cp, idx) => ({
                x: cp.distance,
                y: cp.elevation,
                checkpoint: cp,
                id: `checkpoint-${idx}`,
            }));
        }

        const sorted = [...aidStations]
            .filter(s => s.distance !== undefined)
            .sort((a, b) => a.distance! - b.distance!);

        if (sorted.length <= 2) return [];

        const intermediate = sorted.slice(1, -1);

        return intermediate.map((s, idx) => ({
            x: s.distance!,
            y: s.ele,
            station: s,
            id: `aid-${idx}`,
        }));
    }, [aidStations, apiCheckpoints]);

    const participantChartPoints = React.useMemo(() => {
        return participants
            .filter(p => p.lat !== 0 && p.lon !== 0)
            .map(p => {
                if (chartData.length === 0) return null;
                const sorted = [...chartData]
                    .map(pt => ({ pt, diff: Math.pow(pt.lat - p.lat, 2) + Math.pow(pt.lon - p.lon, 2) }))
                    .sort((a, b) => a.diff - b.diff)
                    .slice(0, 3);
                const best = sorted.reduce((prev, curr) => {
                    const prevDiff = Math.abs(prev.pt.x - p.distance_km);
                    const currDiff = Math.abs(curr.pt.x - p.distance_km);
                    return currDiff < prevDiff ? curr : prev;
                });
                return { x: best.pt.x, y: best.pt.y, participant: p };  // ✅ keep p
            })
            .filter((p): p is { x: number; y: number; participant: ParticipantMapMarker } => p !== null);
    }, [participants, chartData]);

    // ✅ NEW: Auto-scroll to keep participant dot visible whenever their position changes
    React.useEffect(() => {
        if (participantChartPoints.length === 0 || !scrollViewRef.current) return;
        const participantX = participantChartPoints[0].x;
        const dotPixelX = (participantX / totalDistance) * chartWidth;
        const scrollTarget = dotPixelX - screenWidth / 2;
        const timer = setTimeout(() => {
            scrollViewRef.current?.scrollTo({
                x: Math.max(0, scrollTarget),
                animated: true,
            });
        }, 200);

        return () => clearTimeout(timer);
    }, [participantChartPoints, chartWidth, totalDistance, screenWidth]);

    // One vertical grid line per cm of width → spacing = kmPerCm.
    //   100km → every 10km (10, 20, 30 …),  50km → every 5km (5, 10, 15 …).
    // Stop half an interval before the end so no line/label hugs the finish
    // (routes are rarely an exact round total, e.g. a "100km" GPX is ~100.4km,
    // which would otherwise draw a clipped "100 km" line at the very edge).
    const distanceMarkers = React.useMemo(() => {
        const markers: number[] = [];
        const interval = kmPerCm;
        if (interval <= 0) return markers;
        const limit = totalDistance - interval * 0.5;
        for (let i = interval; i < limit; i += interval) {
            markers.push(i);
        }
        return markers;
    }, [totalDistance, kmPerCm]);

    const handleCheckpointClick = (data: any, idx: number) => {
        if (onAidStationPress) {
            let station: AidStationMapMarker;

            if (data.checkpoint) {
                station = {
                    id: `checkpoint-${idx}`,
                    name: data.checkpoint.name,
                    lat: data.checkpoint.latitude,
                    lon: data.checkpoint.longitude,
                    ele: data.checkpoint.elevation,
                    distance_km: data.checkpoint.distance,
                    accessible_by_car: data.checkpoint.accessible_by_car,
                    features: data.checkpoint.features ?? [],
                };
            } else {
                station = {
                    id: `aid-${idx}`,
                    name: data.station.name,
                    lat: data.station.lat,
                    lon: data.station.lon,
                    ele: data.station.ele,
                    distance_km: data.station.distance || 0,
                    accessible_by_car: data.station.accessible_by_car,
                    features: data.station.features ?? [],
                };
            }

            onAidStationPress(station);
        }
    };

    // Combined tap targets (checkpoints + participants) in screen coordinates.
    // One flat list so taps are resolved by nearest-hit, not by which absolute
    // overlay happens to sit on top — fixes occlusion when participants cluster.
    const tapTargets = React.useMemo(() => {
        const PAD_TOP = 20, PAD_BOTTOM = 20;   // must match VictoryChart padding
        const plotHeight = chartHeight - PAD_TOP - PAD_BOTTOM;
        const toScreenY = (yVal: number) => {
            const yPct = (yVal - yDomain[0]) / (yDomain[1] - yDomain[0]);
            return PAD_TOP + (1 - yPct) * plotHeight;
        };
        const targets: Array<{
            kind: 'cp' | 'pt'; idx: number; sx: number; sy: number; point: any;
        }> = [];
        checkpointChartPoints.forEach((point, idx) => {
            targets.push({ kind: 'cp', idx, sx: (point.x / totalDistance) * chartWidth, sy: toScreenY(point.y), point });
        });
        participantChartPoints.forEach((point, idx) => {
            targets.push({ kind: 'pt', idx, sx: (point.x / totalDistance) * chartWidth, sy: toScreenY(point.y), point });
        });
        return targets;
    }, [checkpointChartPoints, participantChartPoints, chartWidth, totalDistance, yDomain, chartHeight]);

    // Given an absolute touch point on the chart, dispatch to the nearest target.
    // Participants get a small bias so a participant sitting on a checkpoint wins
    // the tie, but an off-participant tap still falls to the checkpoint.
    const dispatchNearestTarget = (absX: number, absY: number) => {
        let best: typeof tapTargets[number] | null = null;
        let bestScore = Infinity;
        for (const tgt of tapTargets) {
            const dx = tgt.sx - absX;
            const dy = tgt.sy - absY;
            const d = dx * dx + dy * dy;
            const score = tgt.kind === 'pt' ? d - 4 : d; // slight participant bias
            if (score < bestScore) { bestScore = score; best = tgt; }
        }
        if (!best) return;
        if (best.kind === 'cp') {
            handleCheckpointClick(best.point, best.idx);
        } else if (onParticipantPress) {
            onParticipantPress(best.point.participant);
        }
    };

    if (chartData.length === 0) {
        return null;
    }

    console.log('📊 Y Domain check:', {
        minElevation,
        maxElevation,
        participantEle: 515.8,
        isInRange: 515.8 >= minElevation && 515.8 <= maxElevation
    });

    return (
        // ✅ Transparent so the map behind shows through. (For the map to actually
        // be visible behind it, the parent chartContainer must overlap the map —
        // see the absolute-overlay snippet in LiveTrackingScreen.)
        <View style={[liveTrackingStyles.profileContainer, { backgroundColor: 'transparent' }]}>
            <Text style={liveTrackingStyles.profileTitle}>{t('elevationProfile')}</Text>

            <ScrollView
                ref={scrollViewRef}  // ✅ NEW: attach ref
                horizontal
                showsHorizontalScrollIndicator={false}
                style={[liveTrackingStyles.profileScrollView, { backgroundColor: 'transparent' }]}
            >
                <View>
                    <VictoryChart
                        width={chartWidth}
                        height={chartHeight}
                        padding={{ top: 20, bottom: 20, left: 0, right: 0 }}
                        domain={{ x: [0, totalDistance] as [number, number], y: yDomain }}
                    >
                        <VictoryAxis
                            style={{
                                axis: { stroke: 'transparent' },
                                tickLabels: { fill: 'transparent' },
                                grid: { stroke: 'transparent' },
                            }}
                        />
                        <VictoryAxis
                            dependentAxis
                            style={{
                                axis: { stroke: 'transparent' },
                                tickLabels: { fill: 'transparent' },
                                grid: { stroke: 'transparent' },
                            }}
                        />

                        <VictoryArea
                            data={chartData}
                            interpolation="monotoneX"
                            style={{
                                data: {
                                    // Lighter fill so the map reads through the elevation shape.
                                    fill: 'rgba(59, 130, 246, 0.25)',
                                    stroke: '#3B82F6',
                                    strokeWidth: 3,
                                },
                            }}
                        />

                        {distanceMarkers.map((distance, idx) => (
                            <VictoryLine
                                key={`distance-line-${idx}`}
                                data={[
                                    { x: distance, y: yDomain[0] },
                                    { x: distance, y: yDomain[1] },
                                ]}
                                style={{
                                    data: {
                                        // Light grey, but semi-transparent dark so it stays visible
                                        // over the map (pure #D1D5DB washed out on the overlay).
                                        stroke: 'rgba(75, 85, 99, 0.45)',
                                        strokeWidth: 1,
                                    },
                                }}
                            />
                        ))}

                        {checkpointChartPoints.map((point, idx) => (
                            <VictoryLine
                                key={`checkpoint-line-${idx}`}
                                data={[
                                    { x: point.x, y: yDomain[0] },
                                    { x: point.x, y: point.y },   // ✅ stop at the dot, not full height
                                ]}
                                style={{
                                    data: {
                                        stroke: colors.black,
                                        strokeWidth: 1.5,
                                        strokeDasharray: '4,3',
                                    },
                                }}
                            />
                        ))}

                        {checkpointChartPoints.length > 0 && (
                            <VictoryScatter
                                data={checkpointChartPoints}
                                size={9}
                                style={{
                                    data: {
                                        fill: colors.black,
                                        stroke: colors.white,
                                        strokeWidth: 2.5,
                                    },
                                }}
                            />
                        )}

                        {participantChartPoints.length > 0 && (
                            <VictoryScatter
                                data={participantChartPoints}
                                size={11}
                                style={{
                                    data: {
                                        fill: '#F97316',
                                        stroke: colors.white,
                                        strokeWidth: 2.5,
                                    },
                                }}

                            />
                        )}

                        {distanceMarkers.map((distance, idx) => {
                            const xPosition = (distance / totalDistance) * chartWidth;
                            return (
                                <VictoryLabel
                                    key={`distance-label-${idx}`}
                                    x={xPosition + 4}
                                    y={14}
                                    text={`${Math.round(distance)} km`}
                                    style={{
                                        fontSize: 10,
                                        fill: colors.gray700,
                                        fontWeight: '600',
                                    }}
                                    textAnchor="start"
                                    backgroundStyle={{ fill: 'rgba(255, 255, 255, 0.85)' }}
                                    backgroundPadding={3}
                                />
                            );
                        })}

                    </VictoryChart>

                    {tapTargets
                        .filter(t => t.kind === 'pt')
                        .map((t, idx) => (
                            <Text
                                key={`participant-label-${idx}`}
                                style={{
                                    position: 'absolute',
                                    left: t.sx - 11,
                                    top: t.sy - 7,
                                    width: 22,
                                    textAlign: 'center',
                                    color: colors.white,
                                    fontSize: 10,
                                    fontWeight: '700',
                                    zIndex: 20,
                                    elevation: 20,
                                }}
                                pointerEvents="none"
                            >
                                {t.point.participant.initials || String(t.point.participant.bib) || '?'}
                            </Text>
                        ))
                    }

                    {/* Unified tap layer — one box per target, all same size + z.
                        Whichever box catches the touch resolves to the truly
                        nearest target via dispatchNearestTarget, so overlapping
                        participants/checkpoints no longer occlude one another. */}
                    {tapTargets.map((tgt) => {
                        const left = tgt.sx - 22;
                        const top = tgt.sy - 22;
                        return (
                            <TouchableOpacity
                                key={`hit-${tgt.kind}-${tgt.idx}`}
                                style={{
                                    position: 'absolute',
                                    left, top,
                                    width: 44, height: 44,
                                    alignItems: 'center', justifyContent: 'center',
                                    zIndex: 10, elevation: 10,
                                }}
                                activeOpacity={0.6}
                                onPress={(e) => {
                                    const { locationX, locationY } = e.nativeEvent;
                                    dispatchNearestTarget(left + locationX, top + locationY);
                                }}
                            />
                        );
                    })}
                </View>
            </ScrollView>
        </View>
    );
});

LiveElevationProfile.displayName = 'LiveElevationProfile';