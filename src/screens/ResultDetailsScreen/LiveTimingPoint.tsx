import React, { memo } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { resultInfoStyles } from '../../styles/resultDetails.styles';
import { commonStyles, palette, space } from '../../styles/common.styles';
import { CheckpointDetail } from '../../services/resultDetailsService';
import { getFeatureIcon } from '../../utils/featureIcons';
import { formatClockTime } from '../../utils/timeFormat';

interface LiveTimingPointProps {
    checkpoints?: CheckpointDetail[];
    raceStatus?: string;
    gender?: string;
}

const AmenityIcons = (({ features, t }: { features?: string[]; t: any }) => {
    if (!features || features.length === 0) return null;
    return (
        <View style={{ paddingBottom: 4,justifyContent:"center", alignItems:"center"}}>
            <Text style={resultInfoStyles.rowLabel}>
                {t('timingPoint.availableServices')}
            </Text>
            <View style={{ flexDirection: 'row',  gap: 6, flexWrap: 'wrap' }}>
                {features.map(feature => (
                    <View key={feature} style={{
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: palette.fill,
                        borderRadius: 10,
                        padding: 8,
                        minWidth: 36,
                        marginTop: 8
                    }}>
                        <Ionicons name={getFeatureIcon(feature)} size={18} color={palette.ink} />
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

const genderLetter = (gender: string | undefined) =>
    gender === 'female' ? 'F' : gender === 'male' ? 'M' : '';

// "25 F 5" → 25th overall at this point, 5th among women.
// Men and unknown gender show the bare overall ranking.
const rankingWithGender = (
    ranking: string | undefined,
    gender: string | undefined,
    rank_gender: string | undefined,
    t: any,
) => {
    if (!ranking) return t('defaults.empty');
    const isFemale = gender === 'female';
    return isFemale && /^\d+$/.test(rank_gender ?? '')
        ? `${ranking} F ${rank_gender}`
        : ranking;
};

const StatRow = memo(({
    leftLabel, leftVal, rightLabel, rightVal,
}: {
    leftLabel: string; leftVal: string;
    rightLabel: string; rightVal: string;
}) => (
    <View style={resultInfoStyles.twoColRow}>
        <View style={resultInfoStyles.twoColLeft}>
            <Text style={resultInfoStyles.statLabel}>{leftLabel}</Text>
            <Text style={resultInfoStyles.statValue}>{leftVal}</Text>
        </View>
        <View style={resultInfoStyles.verticalDivider} />
        <View style={resultInfoStyles.twoColRight}>
            <Text style={resultInfoStyles.statLabel}>{rightLabel}</Text>
            <Text style={resultInfoStyles.statValue}>{rightVal}</Text>
        </View>
    </View>
));

const StatCol = memo(({ label, value }: { label: string; value: string }) => (
    <View style={resultInfoStyles.bibCard}>
        <Text style={resultInfoStyles.rowLabel}>{label}</Text>
        <Text style={resultInfoStyles.rowValue}>{value}</Text>
    </View>
));

const CenteredDistanceElevation = memo(({
    leftLabel, leftVal, rightLabel, rightVal,
}: {
    leftLabel: string; leftVal: string;
    rightLabel: string; rightVal: string;
}) => (
    <View style={resultInfoStyles.twoColRow}>
        <View style={resultInfoStyles.twoColLeft}>
            <Text style={resultInfoStyles.statLabel}>{leftLabel}</Text>
            <Text style={resultInfoStyles.statValue}>{leftVal}</Text>
        </View>
        <View style={resultInfoStyles.verticalDivider} />
        <View style={resultInfoStyles.twoColRight}>
            <Text style={resultInfoStyles.statLabel}>{rightLabel}</Text>
            <Text style={resultInfoStyles.statValue}>{rightVal}</Text>
        </View>
    </View>
));


// 30_CheckpointHistory.png: badge, name over distance, time over ranking.
// The mockup has no timeline rail, so this head carries the identity that the
// rail used to; the detail rows below it keep the data the old card showed.
// The two values the old timeline rail carried: the length of the leg just
// completed and the climb in it. The API computes both as "this checkpoint
// minus the previous one", so they describe the leg BEHIND this point.
const SegmentRow = memo(({ item, t }: { item: CheckpointDetail; t: any }) => {
    if (!item.segment_distance && !item.segment_elevation_gain) return null;
    return (
        <StatRow
            leftLabel={t('timingPoint.segmentDistance')}
            leftVal={item.segment_distance ? `${item.segment_distance} ${t('units.km')}` : '—'}
            rightLabel={t('timingPoint.segmentElevation')}
            rightVal={item.segment_elevation_gain
                ? `${item.segment_elevation_gain} ${t('units.meterPlus')}`
                : '—'}
        />
    );
});

const CheckpointHead = memo(({
    item, t, gender, showTime,
}: { item: CheckpointDetail; t: any; gender?: string; showTime: boolean }) => (
    <View style={resultInfoStyles.cpHead}>
        <View style={[
            resultInfoStyles.cpBadge,
            item.is_finish && resultInfoStyles.cpBadgeFinish,
            !item.is_crossed && resultInfoStyles.cpBadgePending,
        ]}>
            <Ionicons
                name={item.is_finish ? 'flag' : item.is_crossed ? 'checkmark' : 'time-outline'}
                size={20}
                color={item.is_finish ? palette.lime : item.is_crossed ? palette.ink : palette.textMuted}
            />
        </View>

        <View style={resultInfoStyles.cpHeadText}>
            <Text style={resultInfoStyles.cpName} numberOfLines={1}>{item.name}</Text>
            <Text style={resultInfoStyles.cpSub} numberOfLines={1}>{dist(item.distance, t)}</Text>
        </View>

        {showTime && (
            <View style={resultInfoStyles.cpRight}>
                <Text style={resultInfoStyles.cpTime}>{time(item.race_time, t)}</Text>
                <Text style={resultInfoStyles.cpRank} numberOfLines={1}>
                    {rankingWithGender(item.ranking, gender, item.rank_gender, t)}
                </Text>
            </View>
        )}
    </View>
));

const CheckpointCard = memo(({
    item,
    t,
    isFirstCheckpoint,
    raceStatus,
    gender,
}: {
    item: CheckpointDetail;
    t: any;
    isFirstCheckpoint: boolean;
    raceStatus?: string;
    gender?: string;
}) => {

    const isUpcomingRace = raceStatus === 'not_started';
    const isStartedOrPastRace = raceStatus === 'in_progress' || raceStatus === 'finished';
    const isCrossed = item.is_crossed;

    if (isUpcomingRace) {
        return (
            <View style={resultInfoStyles.timingcard}>
                <CheckpointHead item={item} t={t} gender={gender} showTime={false} />
                <View style={resultInfoStyles.cpDivider} />
                <StatCol
                    label={t('timingPoint.elevationGain')}
                    value={elevation(item.elevation_gain, t)}
                />
                <SegmentRow item={item} t={t} />

            </View>
        );
    }

    if (isFirstCheckpoint && isStartedOrPastRace) {
        return (
            <View style={resultInfoStyles.timingcard}>
                <Text style={resultInfoStyles.checkpointName} numberOfLines={1}>{item.name}</Text>
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
                    rightVal={rankingWithGender(item.ranking, gender, item.rank_gender, t)}
                />
            </View>
        );
    }

    if (isStartedOrPastRace && !isCrossed) {
        return (
            <View style={resultInfoStyles.timingcard}>
                <CheckpointHead item={item} t={t} gender={gender} showTime={false} />
                <View style={resultInfoStyles.cpDivider} />
                <StatCol
                    label={t('timingPoint.elevationGain')}
                    value={elevation(item.elevation_gain, t)}
                />
                <SegmentRow item={item} t={t} />


            </View>
        );
    }

    if (isStartedOrPastRace && isCrossed) {
        return (
            <View style={resultInfoStyles.timingcard}>
                <CheckpointHead item={item} t={t} gender={gender} showTime />
                <View style={resultInfoStyles.cpDivider} />
                <StatCol
                    label={t('timingPoint.arrivalTime')}
                    value={item.day_name
                        ? `${t(`common:week.${item.day_name.toLowerCase()}`)} ${clockTime(item.actual_time, t)}`
                        : clockTime(item.actual_time, t)
                    }
                />
                <StatCol
                    label={t('timingPoint.elevationGain')}
                    value={elevation(item.elevation_gain, t)}
                />
                <SegmentRow item={item} t={t} />
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

const LiveTimingPoint: React.FC<LiveTimingPointProps> = ({ checkpoints, raceStatus, gender }) => {
    const { t } = useTranslation(['resultdetails', 'common']);

    if (!checkpoints || checkpoints.length === 0) {
        return (
            <View style={resultInfoStyles.scrollContent}>
                <Text style={resultInfoStyles.rowLabel}>
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
            contentContainerStyle={[resultInfoStyles.scrollContent, { paddingHorizontal: space.xl }]}
            showsVerticalScrollIndicator={false}
        >
            {reversed.map((item, index) => (
                <View key={index} style={resultInfoStyles.timelineRow}>
                    <CheckpointCard
                        item={item}
                        t={t}
                        isFirstCheckpoint={index === lastIndex} // ✅ Start is now last in reversed list
                        raceStatus={raceStatus}
                        gender={gender}
                    />
                </View>
            ))}
        </ScrollView>
    );
};

export default LiveTimingPoint;