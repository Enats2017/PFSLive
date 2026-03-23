import React, { memo } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { resultInfoStyles } from '../../styles/resultDetails.styles';
import { commonStyles } from '../../styles/common.styles';
import { CheckpointDetail } from '../../services/resultDetailsService';

interface LiveTimingPointProps {
    checkpoints?: CheckpointDetail[];
    raceStatus?: string;
}

const val = (v: string | undefined, t: any) =>
    v || t('defaults.empty');

const time = (v: string | undefined, t: any) =>
    v || t('defaults.time');

const dist = (v: string | undefined, t: any) =>
    v
        ? `${v} ${t('units.km')}`
        : `${t('defaults.distance')} ${t('units.km')}`;

const elevation = (v: string | undefined, t: any) =>
    v
        ? `${v} ${t('units.meterPlus')}`
        : `${t('defaults.elevation')} ${t('units.meterPlus')}`;

const speed = (v: string | undefined, t: any) =>
    v
        ? `${v} ${t('units.kmh')}`
        : t('defaults.empty');

const pace = (v: string | undefined, t: any) =>
    v
        ? `${v} ${t('units.minPerKm')}`
        : t('defaults.empty');

const StatRow = memo(({
    leftLabel, leftVal, rightLabel, rightVal,
}: {
    leftLabel: string; leftVal: string;
    rightLabel: string; rightVal: string;
}) => (
    <View style={resultInfoStyles.twoColRow}>
        <View style={resultInfoStyles.twoColLeft}>
            <Text style={commonStyles.subtitle}>{leftLabel}</Text>
            <Text style={commonStyles.title}>{leftVal}</Text>
        </View>
        <View style={resultInfoStyles.verticalDivider} />
        <View style={resultInfoStyles.twoColRight}>
            <Text style={commonStyles.subtitle}>{rightLabel}</Text>
            <Text style={commonStyles.title}>{rightVal}</Text>
        </View>
    </View>
));

const StatCol = memo(({ label, value }: { label: string; value: string }) => (
    <View style={resultInfoStyles.bibCard}>
        <Text style={commonStyles.subtitle}>{label}</Text>
        <Text style={commonStyles.title}>{value}</Text>
    </View>
));

// ✅ Centered two-column display (vertically centered in the card)
const CenteredDistanceElevation = memo(({
    leftLabel, leftVal, rightLabel, rightVal,
}: {
    leftLabel: string; leftVal: string;
    rightLabel: string; rightVal: string;
}) => (
    <View style={{ 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center',
        paddingVertical: 40,
    }}>
        <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            width: '100%',
        }}>
            <View style={{
                flex: 1,
                alignItems: 'center',
                gap: 8,
            }}>
                <Text style={commonStyles.subtitle}>{leftLabel}</Text>
                <Text style={commonStyles.title}>{leftVal}</Text>
            </View>
            <View style={resultInfoStyles.verticalDivider} />
            <View style={{
                flex: 1,
                alignItems: 'center',
                gap: 8,
            }}>
                <Text style={commonStyles.subtitle}>{rightLabel}</Text>
                <Text style={commonStyles.title}>{rightVal}</Text>
            </View>
        </View>
    </View>
));

const CheckpointCard = memo(({ 
    item, 
    t, 
    isFirstCheckpoint,
    raceStatus 
}: { 
    item: CheckpointDetail; 
    t: any;
    isFirstCheckpoint: boolean;
    raceStatus?: string;
}) => {
    const isUpcomingRace = raceStatus === 'not_started';
    const isStartedOrPastRace = raceStatus === 'in_progress' || raceStatus === 'finished';
    const isCrossed = item.is_crossed;

    // ✅ UPCOMING RACE - ALL CHECKPOINTS (CENTERED)
    if (isUpcomingRace) {
        return (
            <View style={resultInfoStyles.timingcard}>
                {/* Line 1: Name */}
                <View style={resultInfoStyles.bibCard}>
                    <Text style={commonStyles.title}>{item.name}</Text>
                </View>

                {/* Line 2: Distance | Elevation Gain (CENTERED VERTICALLY) */}
                <CenteredDistanceElevation
                    leftLabel={t('timingPoint.distance')}
                    leftVal={dist(item.distance, t)}
                    rightLabel={t('timingPoint.elevationGain')}
                    rightVal={elevation(item.elevation_gain, t)}
                />
            </View>
        );
    }

    // ✅ STARTED/PAST RACE - FIRST CHECKPOINT (START)
    if (isFirstCheckpoint && isStartedOrPastRace) {
        return (
            <View style={resultInfoStyles.timingcard}>
                {/* Line 1: Name */}
                <View style={resultInfoStyles.bibCard}>
                    <Text style={commonStyles.title}>{item.name}</Text>
                </View>

                {/* Line 2: Day Name + Start Time */}
                <StatCol
                    label={t('timingPoint.startTime')}
                    value={item.day_name 
                        ? `${t(`common:week.${item.day_name.toLowerCase()}`)} ${val(item.actual_time, t)}`
                        : val(item.actual_time, t)
                    }
                />

                {/* Line 3: Distance | Elevation Gain - NOT CENTERED */}
                <StatRow
                    leftLabel={t('timingPoint.distance')}
                    leftVal={dist(item.distance, t)}
                    rightLabel={t('timingPoint.elevationGain')}
                    rightVal={elevation(item.elevation_gain, t)}
                />

                {/* Line 4: Race Time | Ranking */}
                <StatRow
                    leftLabel={t('timingPoint.time')}
                    leftVal={time(item.race_time, t)}
                    rightLabel={t('timingPoint.ranking')}
                    rightVal={val(item.ranking, t)}
                />

                {/* ✅ Empty spacer to match height */}
                <View style={{ height: 30 }} />
            </View>
        );
    }

    // ✅ STARTED/PAST RACE - NOT CROSSED (UPCOMING CHECKPOINT) - CENTERED
    if (isStartedOrPastRace && !isCrossed) {
        return (
            <View style={resultInfoStyles.timingcard}>
                {/* Line 1: Name */}
                <View style={resultInfoStyles.bibCard}>
                    <Text style={commonStyles.title}>{item.name}</Text>
                </View>

                {/* Line 2: Distance | Elevation Gain (CENTERED VERTICALLY) */}
                <CenteredDistanceElevation
                    leftLabel={t('timingPoint.distance')}
                    leftVal={dist(item.distance, t)}
                    rightLabel={t('timingPoint.elevationGain')}
                    rightVal={elevation(item.elevation_gain, t)}
                />
            </View>
        );
    }

    // ✅ STARTED/PAST RACE - CROSSED (INTERMEDIATE/FINISH) - NOT CENTERED
    if (isStartedOrPastRace && isCrossed) {
        return (
            <View style={resultInfoStyles.timingcard}>
                {/* Line 1: Name */}
                <View style={resultInfoStyles.bibCard}>
                    <Text style={commonStyles.title}>{item.name}</Text>
                </View>

                {/* Line 2: Day Name + Arrival Time */}
                <StatCol
                    label={t('timingPoint.arrivalTime')}
                    value={item.day_name 
                        ? `${t(`common:week.${item.day_name.toLowerCase()}`)} ${val(item.actual_time, t)}`
                        : val(item.actual_time, t)
                    }
                />

                {/* Line 3: Distance | Elevation Gain - NOT CENTERED */}
                <StatRow
                    leftLabel={t('timingPoint.distance')}
                    leftVal={dist(item.distance, t)}
                    rightLabel={t('timingPoint.elevationGain')}
                    rightVal={elevation(item.elevation_gain, t)}
                />

                {/* Line 4: Race Time | Ranking */}
                <StatRow
                    leftLabel={t('timingPoint.time')}
                    leftVal={time(item.race_time, t)}
                    rightLabel={t('timingPoint.ranking')}
                    rightVal={val(item.ranking, t)}
                />

                {/* Line 5: Speed | Pace */}
                <StatRow
                    leftLabel={t('timingPoint.speed')}
                    leftVal={speed(item.speed, t)}
                    rightLabel={t('timingPoint.pace')}
                    rightVal={pace(item.pace, t)}
                />
            </View>
        );
    }

    // Fallback (should never reach here)
    return null;
});

const LiveTimingPoint: React.FC<LiveTimingPointProps> = ({ checkpoints, raceStatus }) => {
    const { t } = useTranslation(['resultdetails', 'common']);

    if (!checkpoints || checkpoints.length === 0) {
        return (
            <View style={resultInfoStyles.scrollContent}>
                <Text style={commonStyles.subtitle}>
                    {t('timingPoint.noData')}
                </Text>
            </View>
        );
    }

    const lastIndex = checkpoints.length - 1;

    return (
        <ScrollView
            contentContainerStyle={[resultInfoStyles.scrollContent, { paddingHorizontal: 10 }]}
            showsVerticalScrollIndicator={false}
        >
            {checkpoints.map((item, index) => (
                <View key={index} style={resultInfoStyles.headerBar}>
                    <View style={resultInfoStyles.leftCol}>
                        {index === 0
                            ? <View style={resultInfoStyles.iconSpacer} />
                            : <View style={resultInfoStyles.lineTop} />
                        }

                        <View style={[
                            resultInfoStyles.iconCircle,
                            item.is_crossed && resultInfoStyles.iconCircleDone
                        ]}>
                            <Ionicons
                                name={item.is_crossed ? 'checkmark' : 'time-outline'}
                                size={14}
                                color="#fff"
                            />
                        </View>

                        {index < lastIndex && (
                            <View style={resultInfoStyles.lineBottomWrap}>
                                <View style={resultInfoStyles.lineBottom} />
                                <View style={resultInfoStyles.segmentLabels}>
                                    <Text style={resultInfoStyles.segmentText}>
                                        {item.is_crossed && checkpoints[index + 1]?.segment_distance
                                            ? `${checkpoints[index + 1].segment_distance} ${t('units.km')}`
                                            : ' '
                                        }
                                    </Text>
                                </View>
                            </View>
                        )}
                    </View>

                    <CheckpointCard 
                        item={item} 
                        t={t} 
                        isFirstCheckpoint={index === 0}
                        raceStatus={raceStatus}
                    />
                </View>
            ))}
        </ScrollView>
    );
};

export default LiveTimingPoint;