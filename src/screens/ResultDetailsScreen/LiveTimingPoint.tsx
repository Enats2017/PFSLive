import React, { memo } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { resultInfoStyles } from '../../styles/resultDetails.styles';
import { commonStyles } from '../../styles/common.styles';
import { CheckpointDetail } from '../../services/resultDetailsService';

// ── types ──────────────────────────────────────────────────
interface LiveTimingPointProps {
    checkpoints?: CheckpointDetail[];
}

// ── helpers ────────────────────────────────────────────────
const val = (v: string | undefined, t: any) =>
    v || t('defaults.empty');

const time = (v: string | undefined, t: any) =>
    v || t('defaults.time');

const dist = (v: string | undefined, t: any) =>
    v
        ? `${v} ${t('units.km')}`
        : `${t('defaults.distance')} ${t('units.km')}`;

const speed = (v: string | undefined, t: any) =>
    v
        ? `${v} ${t('units.km')}/h`
        : t('defaults.empty');

const pace = (v: string | undefined, t: any) =>
    v
        ? `${v} ${t('units.min/km')}`
        : t('defaults.empty');

// ── StatRow ────────────────────────────────────────────────
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

// ── StatCol ────────────────────────────────────────────────
const StatCol = memo(({ label, value }: { label: string; value: string }) => (
    <View style={resultInfoStyles.bibCard}>
        <Text style={commonStyles.subtitle}>{label}</Text>
        <Text style={commonStyles.title}>{value}</Text>
    </View>
));

// ── CheckpointCard ─────────────────────────────────────────
const CheckpointCard = memo(({ item, t }: { item: CheckpointDetail; t: any }) => {
    const isStart = item.is_start;
    const isUpcoming = !item.is_crossed && !item.is_start;

    // ── UPCOMING — name + distance centered, rest invisible ──
    if (isUpcoming) {
        return (
            <View style={[resultInfoStyles.timingcard, { justifyContent: 'space-between' }]}>
                {/* name at top */}
                <View style={resultInfoStyles.bibCard}>
                    <Text style={commonStyles.title}>{item.name}</Text>
                </View>

                {/* invisible spacers — keep card height same */}
                <StatCol label="" value="" />
                <StatRow leftLabel="" leftVal="" rightLabel="" rightVal="" />
                <StatRow leftLabel="" leftVal="" rightLabel="" rightVal="" />

                {/* distance centered at bottom */}
                <View style={{ alignItems: 'center', paddingVertical: 8 }}>
                    <Text style={commonStyles.subtitle}>
                        {t('timingPoint.distance')}
                    </Text>
                    <Text style={commonStyles.title}>
                        {dist(item.distance, t)}
                    </Text>
                </View>
            </View>
        );
    }

    return (
        <View style={resultInfoStyles.timingcard}>

            {/* name */}
            <View style={resultInfoStyles.bibCard}>
                <Text style={commonStyles.title}>{item.name}</Text>
            </View>

            {/* arrival / start time */}
            <StatCol
                label={isStart ? t('timingPoint.startTime') : t('timingPoint.arrivalTime')}
                value={`${t(`common:week.${item.day_name?.toLowerCase()}`)}. ${val(item.actual_time, t)}`}
            />

            {/* distance + ranking */}
            <StatRow
                leftLabel={t('timingPoint.distance')}
                leftVal={dist(item.distance, t)}
                rightLabel={t('timingPoint.ranking')}
                rightVal={val(item.ranking, t)}
            />

            {/* race time + speed */}
            <StatRow
                leftLabel={t('timingPoint.time')}
                leftVal={time(item.race_time, t)}
                rightLabel={isStart ? '' : t('timingPoint.speed')}
                rightVal={isStart ? '' : speed(item.speed, t)}
            />

            {/* pace */}
            <StatCol
                label={isStart ? '' : t('timingPoint.pace')}
                value={isStart ? '' : pace(item.pace, t)}
            />

        </View>
    );
});

// ── LiveTimingPoint ────────────────────────────────────────
const LiveTimingPoint: React.FC<LiveTimingPointProps> = ({ checkpoints }) => {
    const { t } = useTranslation(['resultdetails','common']);

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

                    {/* ── left timeline ── */}
                    <View style={resultInfoStyles.leftCol}>
                        {index === 0
                            ? <View style={resultInfoStyles.iconSpacer} />
                            : <View style={resultInfoStyles.lineTop} />
                        }

                        {/* ── icon — green if crossed, gray if upcoming ── */}
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
                                {/* segment — keep space even if empty */}
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

                    {/* ── card ── */}
                    <CheckpointCard item={item} t={t} />

                </View>
            ))}
        </ScrollView>
    );
};

export default LiveTimingPoint;