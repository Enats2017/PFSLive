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
}) => {
    const { t } = useTranslation('livetracking');
    const screenWidth = Dimensions.get('window').width;
    
    const chartWidth = Math.max(screenWidth, totalDistance * 80);
    const chartHeight = 220;

    const yDomain: [number, number] = [minElevation, maxElevation];

    // ✅ Use API checkpoints if available, otherwise GPX aid stations
    // ✅ Remove START and FINISH from elevation profile
    const checkpointChartPoints = React.useMemo(() => {
        if (apiCheckpoints.length > 0) {
            // Filter out START and FINISH
            //const visible = apiCheckpoints.filter(cp => !cp.is_start && !cp.is_finish);
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

        // Fallback to GPX (remove first and last)
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

    const participantChartPoints = React.useMemo(() => 
        participants
            .filter(p => p.distance_km > 0)
            .map(p => ({ x: p.distance_km, y: p.ele })),
        [participants]
    );

    const distanceMarkers = React.useMemo(() => {
        const markers: number[] = [];
        const interval = 20;
        for (let i = interval; i < totalDistance; i += interval) {
            markers.push(i);
        }
        return markers;
    }, [totalDistance]);

    // ✅ Calculate segment distances using API checkpoint data
    const segmentDistances = React.useMemo(() => {
        const segments: Array<{ midX: number; distance: number; text: string }> = [];
        
        if (apiCheckpoints.length > 0) {
            // Use official segment distances from API
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
            // Fallback: calculate from GPX
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
                // API checkpoint
                station = {
                    id: `checkpoint-${idx}`,
                    name: data.checkpoint.name,
                    lat: data.checkpoint.latitude,
                    lon: data.checkpoint.longitude,
                    ele: data.checkpoint.elevation,
                    distance_km: data.checkpoint.distance,
                    accessible_by_car: data.checkpoint.accessible_by_car,
                };
            } else {
                // GPX aid station
                station = {
                    id: `aid-${idx}`,
                    name: data.station.name,
                    lat: data.station.lat,
                    lon: data.station.lon,
                    ele: data.station.ele,
                    distance_km: data.station.distance || 0,
                    accessible_by_car: data.station.accessible_by_car,
                };
            }
            
            onAidStationPress(station);
        }
    };

    if (chartData.length === 0) {
        return null;
    }

    return (
        <View style={liveTrackingStyles.profileContainer}>
            <Text style={liveTrackingStyles.profileTitle}>{t('elevationProfile')}</Text>
            
            <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                style={liveTrackingStyles.profileScrollView}
            >
                <View>
                    <VictoryChart
                        width={chartWidth}
                        height={chartHeight}
                        padding={{ top: 10, bottom: 20, left: 0, right: 0 }}
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
                                size={7}
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

                    {checkpointChartPoints.map((point, idx) => {
                        const xPosition = (point.x / totalDistance) * chartWidth;
                        const yPercentage = (point.y - yDomain[0]) / (yDomain[1] - yDomain[0]);
                        const yPosition = chartHeight - 20 - (yPercentage * (chartHeight - 20));

                        return (
                            <TouchableOpacity
                                key={`touchable-${idx}`}
                                style={{
                                    position: 'absolute',
                                    left: xPosition - 20,
                                    top: yPosition - 20,
                                    width: 40,
                                    height: 40,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                                onPress={() => handleCheckpointClick(point, idx)}
                                activeOpacity={0.6}
                            />
                        );
                    })}
                </View>
            </ScrollView>
        </View>
    );
});

LiveElevationProfile.displayName = 'LiveElevationProfile';