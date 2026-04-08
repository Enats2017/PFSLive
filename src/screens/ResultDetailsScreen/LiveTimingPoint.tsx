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
            <Text style={[commonStyles.subtitle,{textAlign:"center"}]}>{leftLabel}</Text>
            <Text style={commonStyles.title}>{leftVal}</Text>
        </View>
        <View style={resultInfoStyles.verticalDivider} />
        <View style={resultInfoStyles.twoColRight}>
            <Text style={[commonStyles.subtitle,{textAlign:"center"}]}>{rightLabel}</Text>
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

    if (isUpcomingRace) {
        return (
            <View style={resultInfoStyles.timingcard}>
                <View style={resultInfoStyles.bibCard}>
                    <Text style={commonStyles.title}>{item.name}</Text>
                </View>
                <CenteredDistanceElevation
                    leftLabel={t('timingPoint.distance')}
                    leftVal={dist(item.distance, t)}
                    rightLabel={t('timingPoint.elevationGain')}
                    rightVal={elevation(item.elevation_gain, t)}
                />
            </View>
        );
    }

    if (isFirstCheckpoint && isStartedOrPastRace) {
        return (
            <View style={resultInfoStyles.timingcard}>
                <View style={resultInfoStyles.bibCard}>
                    <Text style={commonStyles.title}>{item.name}</Text>
                </View>
                <StatCol
                    label={t('timingPoint.startTime')}
                    value={item.day_name 
                        ? `${t(`common:week.${item.day_name.toLowerCase()}`)} ${val(item.actual_time, t)}`
                        : val(item.actual_time, t)
                    }
                />
                <StatRow
                    leftLabel={t('timingPoint.distance')}
                    leftVal={dist(item.distance, t)}
                    rightLabel={t('timingPoint.elevationGain')}
                    rightVal={elevation(item.elevation_gain, t)}
                />
                <StatRow
                    leftLabel={t('timingPoint.time')}
                    leftVal={time(item.race_time, t)}
                    rightLabel={t('timingPoint.ranking')}
                    rightVal={val(item.ranking, t)}
                />
                <View style={{ height: 30 }} />
            </View>
        );
    }

    if (isStartedOrPastRace && !isCrossed) {
        return (
            <View style={resultInfoStyles.timingcard}>
                <View style={resultInfoStyles.bibCard}>
                    <Text style={commonStyles.title}>{item.name}</Text>
                </View>
                <CenteredDistanceElevation
                    leftLabel={t('timingPoint.distance')}
                    leftVal={dist(item.distance, t)}
                    rightLabel={t('timingPoint.elevationGain')}
                    rightVal={elevation(item.elevation_gain, t)}
                />
            </View>
        );
    }

    if (isStartedOrPastRace && isCrossed) {
        return (
            <View style={resultInfoStyles.timingcard}>
                <View style={resultInfoStyles.bibCard}>
                    <Text style={commonStyles.title}>{item.name}</Text>
                </View>
                <StatCol
                    label={t('timingPoint.arrivalTime')}
                    value={item.day_name 
                        ? `${t(`common:week.${item.day_name.toLowerCase()}`)} ${val(item.actual_time, t)}`
                        : val(item.actual_time, t)
                    }
                />
                <StatRow
                    leftLabel={t('timingPoint.distance')}
                    leftVal={dist(item.distance, t)}
                    rightLabel={t('timingPoint.elevationGain')}
                    rightVal={elevation(item.elevation_gain, t)}
                />
                <StatRow
                    leftLabel={t('timingPoint.time')}
                    leftVal={time(item.race_time, t)}
                    rightLabel={t('timingPoint.ranking')}
                    rightVal={val(item.ranking, t)}
                />
                <StatRow
                    leftLabel={t('timingPoint.speed')}
                    leftVal={speed(item.speed, t)}
                    rightLabel={t('timingPoint.pace')}
                    rightVal={pace(item.pace, t)}
                />
            </View>
        );
    }

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
                                
                                {/* ✅ Distance at TOP of line (blue) */}
                                {item.is_crossed && checkpoints[index + 1]?.segment_distance && (
                                    <View style={resultInfoStyles.segmentDistanceLabel}>
                                        <Text style={resultInfoStyles.segmentDistanceText}>
                                            {checkpoints[index + 1].segment_distance} {t('units.km')}
                                        </Text>
                                    </View>
                                )}

                                {/* ✅ Elevation at BOTTOM of line (green) */}
                                {item.is_crossed && checkpoints[index + 1]?.segment_elevation_gain && (
                                    <View style={resultInfoStyles.segmentElevationLabel}>
                                        <Text style={resultInfoStyles.segmentElevationText}>
                                            {checkpoints[index + 1].segment_elevation_gain} {t('units.meterPlus')}
                                        </Text>
                                    </View>
                                )}
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