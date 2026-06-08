import React, { memo } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { resultInfoStyles } from '../../styles/resultDetails.styles';
import { colors, commonStyles } from '../../styles/common.styles';
import { CheckpointDetail } from '../../services/resultDetailsService';
import { getFeatureIcon } from '../../utils/featureIcons';
import { formatClockTime } from '../../utils/timeFormat';

interface LiveTimingPointProps {
    checkpoints?: CheckpointDetail[];
    raceStatus?: string;
}

const AmenityIcons = (({ features, t }: { features?: string[]; t: any }) => {
    if (!features || features.length === 0) return null;
    return (
        <View style={{ paddingBottom:5,justifyContent:"center", alignItems:"center"}}>
            <Text style={commonStyles.subtitle}>
                {t('timingPoint.availableServices')}
            </Text>
            <View style={{ flexDirection: 'row',  gap: 6, flexWrap: 'wrap' }}>
                {features.map(feature => (
                    <View key={feature} style={{
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: colors.gray100,
                        borderRadius: 8,
                        padding: 8,
                        minWidth: 36,
                        marginTop:7
                    }}>
                        <Ionicons name={getFeatureIcon(feature)} size={18} color={colors.gray900} />
                    </View>
                ))}
            </View>
        </View>
    );
});

const val = (v: string | undefined, t: any) =>
    v || t('defaults.empty');

// ✅ Clock time-of-day → localized 12h/24h via timeFormat, with the same
// empty fallback as val(). Used for arrival/start actual_time only.
const clockTime = (v: string | undefined, t: any) => {
    const formatted = formatClockTime(v);
    return formatted || t('defaults.empty');
};

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
            <Text style={[commonStyles.subtitle, { textAlign: "center" }]}>{leftLabel}</Text>
            <Text style={commonStyles.title}>{leftVal}</Text>
        </View>
        <View style={resultInfoStyles.verticalDivider} />
        <View style={resultInfoStyles.twoColRight}>
            <Text style={[commonStyles.subtitle, { textAlign: "center" }]}>{rightLabel}</Text>
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
                        ? `${t(`common:week.${item.day_name.toLowerCase()}`)} ${clockTime(item.actual_time, t)}`
                        : clockTime(item.actual_time, t)
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
                        ? `${t(`common:week.${item.day_name.toLowerCase()}`)} ${clockTime(item.actual_time, t)}`
                        : clockTime(item.actual_time, t)
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

                 <AmenityIcons features={item.features} t={t} />

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

    // Once the race is live/finished, only show timing points the participant has
    // actually crossed — hide the ones not yet reached. The start (index 0) is kept
    // as the anchor so the start card + first-checkpoint logic stay correct.
    // Pre-race (not_started) the full schedule is still shown.
    const isLiveOrFinished = raceStatus === 'in_progress' || raceStatus === 'finished';
    const visibleCheckpoints = isLiveOrFinished
        ? checkpoints.filter((cp, i) => cp.is_crossed || i === 0)
        : checkpoints;

    // ✅ Reverse to show Finish → CP3 → CP2 → CP1 → Start (descending order)
    const reversed = [...visibleCheckpoints].reverse();
    const lastIndex = reversed.length - 1;

    return (
        <ScrollView
            contentContainerStyle={[resultInfoStyles.scrollContent, { paddingHorizontal: 10 }]}
            showsVerticalScrollIndicator={false}
        >
            {reversed.map((item, index) => (
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

                                {/* Distance at TOP of line (blue) */}
                                {/* ✅ Use reversed[index] — in descending order, the segment
                                    between current and next item belongs to current item.
                                    e.g. Finish.segment_distance = dist(CP2→Finish) */}
                                {reversed[index]?.segment_distance && (
                                    <View style={resultInfoStyles.segmentDistanceLabel}>
                                        <Text style={resultInfoStyles.segmentDistanceText}>
                                            {reversed[index].segment_distance} {t('units.km')}
                                        </Text>
                                    </View>
                                )}

                                {/* Elevation at BOTTOM of line (green) */}
                                {reversed[index]?.segment_elevation_gain && (
                                    <View style={resultInfoStyles.segmentElevationLabel}>
                                        <Text style={resultInfoStyles.segmentElevationText}>
                                            {reversed[index].segment_elevation_gain} {t('units.meterPlus')}
                                        </Text>
                                    </View>
                                )}
                            </View>
                        )}
                    </View>

                    <CheckpointCard
                        item={item}
                        t={t}
                        isFirstCheckpoint={index === lastIndex} // ✅ Start is now last in reversed list
                        raceStatus={raceStatus}
                    />
                </View>
            ))}
        </ScrollView>
    );
};

export default LiveTimingPoint;