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

    // Pixels-per-km tapers with route length so short routes stay legible and
    // very long routes (100–200km) don't produce an unscrollably huge canvas.
    //   - Floor (screenWidth): short routes fill the screen, no scroll.
    //   - Target 150 px/km: smooth dot movement on short/medium routes (≤80km).
    //   - Ceiling (MAX_CHART_WIDTH): beyond ~80km the cap kicks in and px/km
    //     tapers — e.g. 100km → 120px/km, 200km → 60px/km — still visible
    //     movement, but Victory renders and scrolls without lag.
    const PER_KM_TARGET = 150;     // ideal px/km for short/medium routes
    const MAX_CHART_WIDTH = 12000; // hard ceiling on total scroll width
    const chartWidth = Math.min(
        MAX_CHART_WIDTH,
        Math.max(screenWidth, totalDistance * PER_KM_TARGET)
    );
    const chartHeight = 220;

    const elevationRange = maxElevation - minElevation;
    const topBuffer = elevationRange * 0.15;

    const yDomain: [number, number] = [minElevation, maxElevation + topBuffer];

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

    const distanceMarkers = React.useMemo(() => {
        const markers: number[] = [];
        const interval = 20;
        for (let i = interval; i < totalDistance; i += interval) {
            markers.push(i);
        }
        return markers;
    }, [totalDistance]);

    const segmentDistances = React.useMemo(() => {
        const segments: Array<{ midX: number; distance: number; text: string }> = [];

        if (apiCheckpoints.length > 0) {
            apiCheckpoints.forEach((cp, idx) => {
                if (cp.segment_distance > 0) {
                    const prevDistance = idx === 0 ? 0 : apiCheckpoints[idx - 1].distance;
                    const midX = (prevDistance + cp.distance) / 2;

                    segments.push({
                        midX,
                        distance: cp.segment_distance,
                        text: `${cp.segment_distance.toFixed(1)} km`,
                    });
                }
            });

            console.log('📏 Segment distances from API:', segments.map(s => s.text));
        } else if (checkpointChartPoints.length > 0) {
            const firstCP = checkpointChartPoints[0];
            segments.push({
                midX: firstCP.x / 2,
                distance: firstCP.x,
                text: `${firstCP.x.toFixed(1)} km`,
            });

            for (let i = 0; i < checkpointChartPoints.length - 1; i++) {
                const current = checkpointChartPoints[i];
                const next = checkpointChartPoints[i + 1];

                const segmentDistance = next.x - current.x;
                const midX = (current.x + next.x) / 2;

                segments.push({
                    midX,
                    distance: segmentDistance,
                    text: `${segmentDistance.toFixed(1)} km`,
                });
            }

            const lastCP = checkpointChartPoints[checkpointChartPoints.length - 1];
            const segmentDistance = totalDistance - lastCP.x;
            const midX = (lastCP.x + totalDistance) / 2;

            segments.push({
                midX,
                distance: segmentDistance,
                text: `${segmentDistance.toFixed(1)} km`,
            });
        }

        return segments;
    }, [apiCheckpoints, checkpointChartPoints, totalDistance]);

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
        const PAD_TOP = 20, PAD_BOTTOM = 20;
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
        <View style={liveTrackingStyles.profileContainer}>
            <Text style={liveTrackingStyles.profileTitle}>{t('elevationProfile')}</Text>

            <ScrollView
                ref={scrollViewRef}  // ✅ NEW: attach ref
                horizontal
                showsHorizontalScrollIndicator={false}
                style={liveTrackingStyles.profileScrollView}
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
                                    fill: 'rgba(59, 130, 246, 0.4)',
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
                                        stroke: colors.gray400,
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
                                    { x: point.x, y: yDomain[1] },
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

                        {segmentDistances.map((segment, idx) => {
                            const xPosition = (segment.midX / totalDistance) * chartWidth;
                            const yPosition = 15;

                            return (
                                <VictoryLabel
                                    key={`segment-label-${idx}`}
                                    x={xPosition}
                                    y={yPosition}
                                    text={segment.text}
                                    style={{
                                        fontSize: 9,
                                        fill: colors.gray700,
                                        fontWeight: '600',
                                    }}
                                    textAnchor="middle"
                                    backgroundStyle={{
                                        fill: 'rgba(255, 255, 255, 0.8)',
                                        padding: 2,
                                    }}
                                    backgroundPadding={3}
                                />
                            );
                        })}

                        {distanceMarkers.map((distance, idx) => {
                            const xPosition = (distance / totalDistance) * chartWidth;
                            return (
                                <VictoryLabel
                                    key={`distance-label-${idx}`}
                                    x={xPosition}
                                    y={chartHeight - 5}
                                    text={`${distance} km`}
                                    style={{
                                        fontSize: 10,
                                        fill: colors.gray700,
                                        fontWeight: '500',
                                    }}
                                    textAnchor="middle"
                                />
                            );
                        })}

                        <VictoryLabel
                            x={30}
                            y={chartHeight - 5}
                            text={`${Math.round(minElevation)} m`}
                            style={{
                                fontSize: 10,
                                fill: colors.gray700,
                                fontWeight: '500',
                            }}
                            textAnchor="start"
                        />

                        <VictoryLabel
                            x={chartWidth - 30}
                            y={chartHeight - 5}
                            text={`${Math.round(totalDistance)} km`}
                            style={{
                                fontSize: 10,
                                fill: colors.gray700,
                                fontWeight: '500',
                            }}
                            textAnchor="end"
                        />
                    </VictoryChart>

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