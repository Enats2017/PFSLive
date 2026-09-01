import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { resultInfoStyles } from '../../styles/resultDetails.styles';
import { commonStyles, typography, fonts } from '../../styles/common.styles';
import { CheckpointDetail, RaceInfo, ResultDetailEvent } from '../../services/resultDetailsService';
import { formatClockTime } from '../../utils/timeFormat';

// participant_status is open-ended: the API passes through whatever non-numeric
// text the timing feed puts in `pos`, uppercased, alongside its own
// 'not_started' | 'in_progress' | 'finished'.
const KNOWN_STATUSES = ['not_started', 'in_progress', 'finished', 'DNF', 'DNS', 'DSQ'];

interface Props {
    raceInfo?: RaceInfo;
    event?: ResultDetailEvent;
    checkpoints?: CheckpointDetail[];
}

const RaceInfoTab: React.FC<Props> = ({ raceInfo, event, checkpoints }) => {
    const { t } = useTranslation(['resultdetails', 'common']);

    const lastCheckpoint = [...(checkpoints || [])]
        .reverse()
        .find(cp => cp.is_crossed);

    // Splits: every timing point the runner actually crossed, in race order.
    const splits = (checkpoints || []).filter(cp => cp.is_crossed && !cp.is_start);
    
    const fmtRank = (v?: string) => (/^\d+$/.test(v ?? '') ? (v as string) : '—');
    
    const fmtRankTotal = (rank?: string, total?: string) => {
        const r = fmtRank(rank);
        if (r === '—') return '—';
        return (/^\d+$/.test(total ?? '')) ? `${r} / ${total}` : r;
    };

    // "1 (M40+)" — rank with its category name; blank category → just the rank
    const fmtCategoryRank = (rank?: string, total?: string, cat?: string) => {
        const rt = fmtRankTotal(rank, total);
        return (rt !== '—' && cat && cat.trim() !== '') ? `${rt} (${cat})` : rt;
    };

    const fmtGenderRank = (rank?: string, total?: string, gender?: string) => {
        const rt = fmtRankTotal(rank, total);
        if (rt === '—') return '—';
        const genderLabel = gender === 'female'
            ? t('common:gender.women')
            : gender === 'male'
                ? t('common:gender.men')
                : '';
        return genderLabel ? `${rt} ${genderLabel}` : rt;
    };

    // Never default to "finished": a missing status is not a finish, and an
    // unrecognised feed code (OTL, NC, ...) is already displayable as sent.
    const statusText = (s?: string | null) => {
        if (!s) return '—';
        return KNOWN_STATUSES.includes(s) ? t(`status.${s}`) : s;
    };

    return (
        <ScrollView
            contentContainerStyle={resultInfoStyles.scrollContent}
            showsVerticalScrollIndicator={false}
        >
            <View style={resultInfoStyles.card}>
                {/* 29_RaceInfo.png: the card opens with a small-caps section label
                    and lists everything as label/value rows. The status and
                    distance chips were leftovers of the old diagonal banner. */}
                <Text style={resultInfoStyles.sectionLabel}>{t('raceInfo.raceResult')}</Text>

                {/* 29_RaceInfo.png row order: race time, scratch position,
                    category with its rank, wave, status. */}
                <View style={resultInfoStyles.bibCard}>
                    <Text style={resultInfoStyles.rowLabel}>{t('raceInfo.raceTime')}</Text>
                    <Text style={resultInfoStyles.raceTimeText}>{raceInfo?.time ?? '—'}</Text>
                </View>

                <View style={resultInfoStyles.bibCard}>
                    <Text style={resultInfoStyles.rowLabel}>{t('raceInfo.scratchPosition')}</Text>
                    <Text style={resultInfoStyles.rowValue}>
                        {fmtRankTotal(raceInfo?.position, raceInfo?.position_total)}
                    </Text>
                </View>

                <View style={resultInfoStyles.bibCard}>
                    <Text style={resultInfoStyles.rowLabel}>
                        {raceInfo?.category_name
                            ? `${t('raceInfo.category')} ${raceInfo.category_name}`
                            : t('raceInfo.category')}
                    </Text>
                    <Text style={resultInfoStyles.rowValue}>
                        {fmtRankTotal(raceInfo?.category_rank, raceInfo?.category_rank_total)}
                    </Text>
                </View>

                {!!raceInfo?.wave && (
                    <View style={resultInfoStyles.bibCard}>
                        <Text style={resultInfoStyles.rowLabel}>{t('raceInfo.wavelabel')}</Text>
                        <Text style={resultInfoStyles.rowValue}>{raceInfo.wave}</Text>
                    </View>
                )}

                <View style={resultInfoStyles.bibCard}>
                    <Text style={resultInfoStyles.rowLabel}>{t('raceInfo.status')}</Text>
                    <Text style={resultInfoStyles.rowValue} numberOfLines={1}>
                        {statusText(raceInfo?.participant_status)}
                    </Text>
                </View>

                {/* Kept beyond the mockup: values the app already showed and
                    that the timing feed provides. */}
                <View style={resultInfoStyles.bibCard}>
                    <Text style={resultInfoStyles.rowLabel}>{t('raceInfo.distance')}</Text>
                    <Text style={resultInfoStyles.rowValue} numberOfLines={1}>
                        {event?.distance_name ?? '—'}
                    </Text>
                </View>

                <View style={resultInfoStyles.bibCard}>
                    <Text style={resultInfoStyles.rowLabel}>{t('raceInfo.genderRank')}</Text>
                    <Text style={resultInfoStyles.rowValue}>
                        {fmtGenderRank(raceInfo?.gender_ranking, raceInfo?.gender_ranking_total, raceInfo?.gender)}
                    </Text>
                </View>

                <View style={resultInfoStyles.bibCard}>
                    <Text style={resultInfoStyles.rowLabel}>{t('raceInfo.previousTimingPoint')}</Text>
                    <Text style={resultInfoStyles.rowValue}>
                        {raceInfo?.previous_cp?.name ?? '—'}
                    </Text>
                    <Text style={resultInfoStyles.timingPointDate}>
                        {raceInfo?.previous_cp?.day_name && raceInfo?.previous_cp?.actual_time
                            ? `${t(`common:week.${raceInfo.previous_cp.day_name.toLowerCase()}`)} ${formatClockTime(raceInfo.previous_cp.actual_time)}`
                            : '—'}
                    </Text>
                </View>

                <View style={resultInfoStyles.statsCard}>
                    <View style={resultInfoStyles.statsCol}>
                        <Text style={resultInfoStyles.rowLabel}>
                            {t('raceInfo.distanceCompleted')}
                        </Text>
                        <Text style={resultInfoStyles.raceTimeText}>
                            {raceInfo?.distance_completed
                                ? `${raceInfo.distance_completed} ${t('units.km')}`
                                : '—'}
                        </Text>
                    </View>
                    <View style={resultInfoStyles.statsColBorder} />
                    <View style={resultInfoStyles.statsCol}>
                        <Text style={resultInfoStyles.rowLabel}>
                            {t('raceInfo.elevationGain')}
                        </Text>
                        <Text style={resultInfoStyles.raceTimeText}>
                            {raceInfo?.elevation_gain
                                ? `${raceInfo.elevation_gain} ${t('units.meterPlus')}`
                                : '—'}
                        </Text>
                    </View>
                </View>
            </View>

            {(!!raceInfo?.average_pace || !!raceInfo?.finishers || !!raceInfo?.elevation_gain) && (
                <View style={resultInfoStyles.card}>
                    <Text style={resultInfoStyles.sectionLabel}>{t('raceInfo.performance')}</Text>

                    {!!raceInfo?.average_pace && (
                        <View style={resultInfoStyles.bibCard}>
                            <Text style={resultInfoStyles.rowLabel}>{t('raceInfo.averagePace')}</Text>
                            <Text style={resultInfoStyles.rowValue}>
                                {raceInfo.average_pace} {t('raceInfo.perKm')}
                            </Text>
                        </View>
                    )}

                    {!!raceInfo?.elevation_gain && (
                        <View style={resultInfoStyles.bibCard}>
                            <Text style={resultInfoStyles.rowLabel}>{t('raceInfo.elevationGain')}</Text>
                            <Text style={resultInfoStyles.rowValue}>
                                {raceInfo.elevation_gain} {t('units.meterPlus')}
                            </Text>
                        </View>
                    )}

                    {!!raceInfo?.finishers && (
                        <View style={resultInfoStyles.bibCard}>
                            <Text style={resultInfoStyles.rowLabel}>{t('raceInfo.finishers')}</Text>
                            <Text style={resultInfoStyles.rowValue}>
                                {raceInfo.field_size
                                    ? t('raceInfo.ofField', {
                                        finishers: raceInfo.finishers,
                                        total: raceInfo.field_size,
                                    })
                                    : String(raceInfo.finishers)}
                            </Text>
                        </View>
                    )}
                </View>
            )}

            {splits.length > 0 && (
                <View style={resultInfoStyles.card}>
                    <Text style={resultInfoStyles.sectionLabel}>{t('raceInfo.splits')}</Text>
                    {splits.map((cp, i) => (
                        <View key={`${cp.name}-${i}`} style={resultInfoStyles.bibCard}>
                            <Text style={resultInfoStyles.rowLabel} numberOfLines={1}>
                                {cp.distance ? `${cp.distance} ${t('units.km')}` : cp.name}
                            </Text>
                            <Text style={resultInfoStyles.rowValue}>{cp.race_time || '—'}</Text>
                        </View>
                    ))}
                </View>
            )}
        </ScrollView>
    );
};

export default RaceInfoTab;