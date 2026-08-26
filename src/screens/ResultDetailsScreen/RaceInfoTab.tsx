import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { resultInfoStyles } from '../../styles/resultDetails.styles';
import { commonStyles, typography } from '../../styles/common.styles';
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
                <View style={resultInfoStyles.headerBar}>
                    <View style={resultInfoStyles.headerGreen}>
                        <Text style={resultInfoStyles.text}>
                            {statusText(raceInfo?.participant_status)}
                        </Text>
                    </View>
                    <View style={resultInfoStyles.diagLeft} />
                    <View style={resultInfoStyles.headerMiddle} />
                    <View style={resultInfoStyles.diagRight} />
                    <View style={resultInfoStyles.headerRed}>
                        <Text
                            style={resultInfoStyles.text}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            minimumFontScale={0.7}
                        >
                            {event?.distance_name ?? '—'}
                        </Text>
                    </View>
                </View>

                <View style={resultInfoStyles.bibCard}>
                    <Text style={commonStyles.title}>{raceInfo?.bib ?? '—'}</Text>
                    <Text style={commonStyles.title}>{raceInfo?.name ?? '—'}</Text>
                </View>
                 {raceInfo?.wave && (
                    <View style={resultInfoStyles.bibCard}>
                        <Text style={commonStyles.title}>{t('raceInfo.wavelabel')}: {raceInfo?.wave}</Text>
                    </View>
                )}

                <View style={resultInfoStyles.bibCard}>
                    <Text style={commonStyles.subtitle}>{t('raceInfo.raceTime')}</Text>
                    <Text style={resultInfoStyles.raceTimeText}>
                        {raceInfo?.time ?? '—'}
                    </Text>
                </View>

                <View style={resultInfoStyles.bibCard}>
                    <Text style={commonStyles.subtitle}>{t('raceInfo.previousTimingPoint')}</Text>
                    <Text style={commonStyles.text}>
                        {raceInfo?.previous_cp?.name ?? '—'}
                    </Text>
                    <Text style={resultInfoStyles.timingPointDate}>
                        {raceInfo?.previous_cp?.day_name && raceInfo?.previous_cp?.actual_time
                            ? `${t(`common:week.${raceInfo.previous_cp.day_name.toLowerCase()}`)} ${formatClockTime(raceInfo.previous_cp.actual_time)}`
                            : '—'}
                    </Text>
                </View>

                <View style={resultInfoStyles.rankingsCard}>
                    {[
                        {
                            labelKey: 'raceInfo.overallRanking',
                            value: fmtRankTotal(raceInfo?.position, raceInfo?.position_total),
                        },
                        {
                            labelKey: 'raceInfo.rankingInOpen',
                            value: fmtCategoryRank(raceInfo?.category_rank, raceInfo?.category_rank_total, raceInfo?.category_name),
                        },
                        {
                            labelKey: 'raceInfo.genderRanking',
                            value: fmtGenderRank(raceInfo?.gender_ranking, raceInfo?.gender_ranking_total, raceInfo?.gender),
                        },
                    ].map((item, i) => (
                        <View
                            key={item.labelKey}
                            style={[
                                resultInfoStyles.rankingCol,
                                i === 1 && resultInfoStyles.rankingColBorder,
                            ]}
                        >
                            <Text style={[commonStyles.subtitle, { textAlign: 'center', marginBottom: 8 }]}>
                                {t(item.labelKey)}
                            </Text>
                            <Text style={[commonStyles.title,{textAlign:'center', fontSize:typography.sizes.lg}]}>{item.value}</Text>
                        </View>
                    ))}
                </View>

                <View style={resultInfoStyles.statsCard}>
                    <View style={resultInfoStyles.statsCol}>
                        <Text style={[commonStyles.subtitle, { textAlign: 'center', marginBottom: 8 }]}>
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
                        <Text style={[commonStyles.subtitle, { textAlign: 'center', marginBottom: 8 }]}>
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
        </ScrollView>
    );
};

export default RaceInfoTab;