import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, G, Circle, Line } from 'react-native-svg';

import { colors, commonStyles } from '../styles/common.styles';
import { resultInfoStyles } from '../styles/resultDetails.styles';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_HEIGHT = 100;

const DUMMY_POINTS = [
    1, 8, 15, 10, 25, 45, 30, 80, 40, 70,
    55, 80, 65, 85, 70, 60, 75, 55, 65, 45,
    55, 35, 48, 28, 40, 20, 30, 15, 22, 10,
    18, 8, 14, 6, 10, 5, 8, 4, 6, 3,
];

function buildSmoothPath(
    points: number[],
    width: number,
    height: number
): string {
    const max = Math.max(...points);
    const min = Math.min(...points);
    const range = max - min || 1;
    const step = width / (points.length - 1);
    const pad = height * 0.08;

    const coords = points.map((p, i) => ({
        x: i * step,
        y: height - pad - ((p - min) / range) * (height - pad * 2),
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

function getRunnerPos(
    points: number[],
    width: number,
    height: number,
    progressIndex: number
): { x: number; y: number } {
    const max = Math.max(...points);
    const min = Math.min(...points);
    const range = max - min || 1;
    const step = width / (points.length - 1);
    const pad = height * 0.08;

    const idx = Math.min(progressIndex, points.length - 1);
    return {
        x: idx * step,
        y: height - pad - ((points[idx] - min) / range) * (height - pad * 2),
    };
}

const RunnerPin: React.FC<{ x: number; y: number }> = ({ x, y }) => {
    const PIN_W = 36;
    const PIN_H = 44;
    return (
        <G x={x - PIN_W / 2} y={y - PIN_H}>
            {/* pin drop shape */}
            <Path
                d={`M${PIN_W / 2} 0 
                    C ${PIN_W * 0.1} 0, 0 ${PIN_H * 0.35}, 0 ${PIN_H * 0.45}
                    C 0 ${PIN_H * 0.7}, ${PIN_W * 0.35} ${PIN_H * 0.85}, ${PIN_W / 2} ${PIN_H}
                    C ${PIN_W * 0.65} ${PIN_H * 0.85}, ${PIN_W} ${PIN_H * 0.7}, ${PIN_W} ${PIN_H * 0.45}
                    C ${PIN_W} ${PIN_H * 0.35}, ${PIN_W * 0.9} 0, ${PIN_W / 2} 0 Z`}
                fill="#111111"
            />
            {/* inner circle */}
            <Circle
                cx={PIN_W / 2}
                cy={PIN_H * 0.2}
                r={PIN_W * 0.1}
                fill="#111111"
                stroke="#333"
                strokeWidth={1}
            />
            {/* runner icon — simplified person running */}
            <Path
                d={`M${PIN_W * 0.55} ${PIN_H * 0.15} 
                    C${PIN_W * 0.65} ${PIN_H * 0.15} ${PIN_W * 0.65} ${PIN_H * 0.25} ${PIN_W * 0.55} ${PIN_H * 0.25}
                    C${PIN_W * 0.45} ${PIN_H * 0.25} ${PIN_W * 0.45} ${PIN_H * 0.15} ${PIN_W * 0.55} ${PIN_H * 0.15} Z
                    M${PIN_W * 0.35} ${PIN_H * 0.28} L${PIN_W * 0.6} ${PIN_H * 0.28}
                    L${PIN_W * 0.65} ${PIN_H * 0.42} L${PIN_W * 0.55} ${PIN_H * 0.42}
                    L${PIN_W * 0.52} ${PIN_H * 0.35} L${PIN_W * 0.45} ${PIN_H * 0.52}
                    L${PIN_W * 0.58} ${PIN_H * 0.55} L${PIN_W * 0.55} ${PIN_H * 0.65}
                    L${PIN_W * 0.42} ${PIN_H * 0.62} L${PIN_W * 0.45} ${PIN_H * 0.52}
                    L${PIN_W * 0.35} ${PIN_H * 0.38} Z`}
                fill="#4CAF50"
            />
        </G>
    );
};

// ── ElevationChart ─────────────────────────────────────────
const ElevationChart: React.FC<{
    points?: number[];
    distanceKm?: string;
    elevationGain?: string;
    progressIndex?: number;
}> = ({
    points = DUMMY_POINTS,
    distanceKm = '78.46 km',
    elevationGain = '2632 m+',
    progressIndex = 28,
}) => {
        const filledPath = buildSmoothPath(points, SCREEN_WIDTH, CHART_HEIGHT);
        const runner = getRunnerPos(points, SCREEN_WIDTH, CHART_HEIGHT, progressIndex);

        return (
            <View style={styles.container}>
                {/* ── stat boxes ── */}
                <View style={resultInfoStyles.statsCard}>
                    <View style={resultInfoStyles.statsCol}>
                        <Text style={[commonStyles.subtitle, { textAlign: "center" }]}>DISTANCE{'\n'}COMPLETED</Text>
                        <Text style={resultInfoStyles.raceTimeText}>{distanceKm}</Text>
                    </View>
                </View>

                {/* ── chart ── */}
                <Svg
                    width={SCREEN_WIDTH}
                    height={CHART_HEIGHT}
                    style={styles.chart}
                >
                    <Defs>
                        <LinearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                            <Stop offset="0%" stopColor={colors.primaryLight} stopOpacity="1" />
                            <Stop offset="100%" stopColor={colors.primary} stopOpacity="1" />
                        </LinearGradient>
                    </Defs>

                    {/* filled elevation area */}
                    <Path d={filledPath} fill="url(#grad)" />

                    <Line
                        x1={runner.x}
                        y1={runner.y}
                        x2={runner.x}
                        y2={CHART_HEIGHT}
                        stroke="#111"
                        strokeWidth={1}
                    />


                    {/* runner pin on curve */}
                    <RunnerPin x={runner.x} y={runner.y} />
                </Svg>
            </View>
        );
    };

// ── styles ─────────────────────────────────────────────────
const styles = StyleSheet.create({
    container: {
        backgroundColor: colors.white,
    },
    statsRow: {
        flexDirection: 'row',
        paddingVertical: 16,
    },
    statBox: {
        flex: 1,
        alignItems: 'center',
    },
    statBorder: {
        borderLeftWidth: 1,
        borderLeftColor: '#333',
    },
    statLabel: {
        color: '#999',
        fontSize: 10,
        fontWeight: '600',
        letterSpacing: 1.2,
        textAlign: 'center',
        textTransform: 'uppercase',
        marginBottom: 6,
    },
    statVal: {
        color: '#fff',
        fontSize: 24,
        fontWeight: '700',
    },
    chart: {
        display: 'flex',
    },
});

export default ElevationChart;