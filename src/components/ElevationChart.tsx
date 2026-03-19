import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions, ActivityIndicator } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, G, Circle, Line } from 'react-native-svg';
import { colors, commonStyles } from '../styles/common.styles';
import { GpxPoint } from '../hooks/useGpxElevation';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_HEIGHT = 120;

function buildSmoothPath(elevations: number[], width: number, height: number): string {
    if (elevations.length < 2) return '';
    const max = Math.max(...elevations);
    const min = Math.min(...elevations);
    const range = max - min || 1;
    const step = width / (elevations.length - 1);
    const pad = height * 0.08;

    const coords = elevations.map((e, i) => ({
        x: i * step,
        y: height - pad - ((e - min) / range) * (height - pad * 2),
    }));

    let d = `M ${coords[0].x.toFixed(2)} ${coords[0].y.toFixed(2)}`;
    for (let i = 1; i < coords.length; i++) {
        const prev = coords[i - 1];
        const curr = coords[i];
        const cpx = (prev.x + curr.x) / 2;
        d += ` C ${cpx.toFixed(2)} ${prev.y.toFixed(2)}, ${cpx.toFixed(2)} ${curr.y.toFixed(2)}, ${curr.x.toFixed(2)} ${curr.y.toFixed(2)}`;
    }
    d += ` L ${width} ${height} L 0 ${height} Z`;
    return d;
}

// Find the closest point index for a given distance (km)
function getProgressIndex(points: GpxPoint[], distanceKm: number): number {
    if (points.length === 0) return 0;
    let closest = 0;
    let minDiff = Infinity;
    points.forEach((p, i) => {
        const diff = Math.abs(p.distance - distanceKm);
        if (diff < minDiff) { minDiff = diff; closest = i; }
    });
    return closest;
}

function getRunnerPos(elevations: number[], width: number, height: number, index: number) {
    const max = Math.max(...elevations);
    const min = Math.min(...elevations);
    const range = max - min || 1;
    const step = width / (elevations.length - 1);
    const pad = height * 0.08;
    const idx = Math.min(index, elevations.length - 1);
    return {
        x: idx * step,
        y: height - pad - ((elevations[idx] - min) / range) * (height - pad * 2),
    };
}

const RunnerPin: React.FC<{ x: number; y: number }> = ({ x, y }) => {
    const PIN_W = 28;
    const PIN_H = 36;
    return (
        <G x={x - PIN_W / 2} y={y - PIN_H}>
            <Path
                d={`M${PIN_W / 2} 0 
                    C ${PIN_W * 0.1} 0, 0 ${PIN_H * 0.35}, 0 ${PIN_H * 0.45}
                    C 0 ${PIN_H * 0.7}, ${PIN_W * 0.35} ${PIN_H * 0.85}, ${PIN_W / 2} ${PIN_H}
                    C ${PIN_W * 0.65} ${PIN_H * 0.85}, ${PIN_W} ${PIN_H * 0.7}, ${PIN_W} ${PIN_H * 0.45}
                    C ${PIN_W} ${PIN_H * 0.35}, ${PIN_W * 0.9} 0, ${PIN_W / 2} 0 Z`}
                fill="#111"
            />
            <Circle cx={PIN_W / 2} cy={PIN_H * 0.35} r={PIN_W * 0.2} fill="#4CAF50" />
        </G>
    );
};

interface ElevationChartProps {
    gpxPoints: GpxPoint[];       // from useGpxElevation
    distanceCompleted?: string;  // e.g. "35.52" from raceInfo
    loading?: boolean;
}

const ElevationChart: React.FC<ElevationChartProps> = ({
    gpxPoints,
    distanceCompleted,
    loading = false,
}) => {
    // ✅ Downsample to max 80 points for performance
    const elevations = useMemo(() => {
        if (gpxPoints.length === 0) return [];
        const step = Math.max(1, Math.floor(gpxPoints.length / 80));
        return gpxPoints.filter((_, i) => i % step === 0).map(p => p.elevation);
    }, [gpxPoints]);

    // ✅ Downsample points array for index lookup too
    const sampledPoints = useMemo(() => {
        if (gpxPoints.length === 0) return [];
        const step = Math.max(1, Math.floor(gpxPoints.length / 80));
        return gpxPoints.filter((_, i) => i % step === 0);
    }, [gpxPoints]);

    const distKm = parseFloat(distanceCompleted ?? '0');
    const progressIndex = useMemo(
        () => getProgressIndex(sampledPoints, distKm),
        [sampledPoints, distKm]
    );

    const filledPath = useMemo(
        () => buildSmoothPath(elevations, SCREEN_WIDTH, CHART_HEIGHT),
        [elevations]
    );

    const runner = useMemo(
        () => getRunnerPos(elevations, SCREEN_WIDTH, CHART_HEIGHT, progressIndex),
        [elevations, progressIndex]
    );

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator color={colors.primary} />
            </View>
        );
    }

    if (elevations.length < 2) return null;

    return (
        <View style={styles.container}>
            <Svg width={SCREEN_WIDTH} height={CHART_HEIGHT}>
                <Defs>
                    <LinearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0%" stopColor={colors.primaryLight} stopOpacity="1" />
                        <Stop offset="100%" stopColor={colors.primary} stopOpacity="0.6" />
                    </LinearGradient>
                </Defs>
                <Path d={filledPath} fill="url(#grad)" />
                <Line
                    x1={runner.x} y1={runner.y}
                    x2={runner.x} y2={CHART_HEIGHT}
                    stroke="#111" strokeWidth={1}
                    strokeDasharray="3 2"
                />
                <RunnerPin x={runner.x} y={runner.y} />
            </Svg>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { backgroundColor: colors.white },
    loadingContainer: { height: CHART_HEIGHT, alignItems: 'center', justifyContent: 'center' },
});

export default ElevationChart;