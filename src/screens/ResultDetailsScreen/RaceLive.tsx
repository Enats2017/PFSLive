import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView,Dimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { resultInfoStyles } from '../../styles/resultDetails.styles';
import { commonStyles, spacing, typography } from '../../styles/common.styles';
import { Entypo } from '@expo/vector-icons';
import { resultListStyle } from '../../styles/ResultList.styles';
import { CheckpointDetail, RaceInfo, ResultDetailEvent } from '../../services/resultDetailsService';
import ElevationChart from '../../components/ElevationChart';
import { useGpxElevation } from '../../hooks/useGpxElevation';
import { formatClockTime } from '../../utils/timeFormat';
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isTablet = SCREEN_WIDTH >= 768;

const parseTimeToSeconds = (time: string): number => {
    if (!time) return 0;
    const parts = time.split(':').map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return 0;
};

const formatSeconds = (secs: number): string => {
    if (secs <= 0) return '00:00:00';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

interface RaceLiveProps {
    raceInfo?: RaceInfo;
    event?: ResultDetailEvent;
    checkpoints?: CheckpointDetail[];
}

const RaceLive: React.FC<RaceLiveProps> = ({ raceInfo, event, checkpoints }) => {
    const { t } = useTranslation(['resultdetails', 'common']);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);

    const { points: gpxPoints, loading: gpxLoading } = useGpxElevation(event?.gpx_url);

    useEffect(() => {
        if (!raceInfo?.server_time) return;

        const initial = parseTimeToSeconds(raceInfo.server_time);
        setElapsedSeconds(initial);

        if (event?.race_status === 'in_progress') {
            const interval = setInterval(() => {
                setElapsedSeconds(prev => prev + 1);
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [raceInfo?.server_time, event?.race_status]);

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

    return (
        <ScrollView
            contentContainerStyle={resultInfoStyles.scrollContent}
            showsVerticalScrollIndicator={false}
        >
            <View style={[resultInfoStyles.card, { marginBottom: 20 }]}>
                <View style={resultInfoStyles.headerBar}>
                    <View style={[resultInfoStyles.headerGreen]}>
                        <Text style={resultInfoStyles.text}>
                            {t(`status.${event?.race_status ?? 'in_progress'}`)}
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
                        {formatSeconds(elapsedSeconds)}
                    </Text>
                </View>

                {raceInfo?.next_cp && (
                    <View style={[resultListStyle.card, {
                        borderWidth: 0.28,
                        borderLeftWidth: 0.28,
                        borderColor: '#FF3B30',
                    }]}>
                        <View style={resultInfoStyles.bibCard}>
                            <Text style={commonStyles.subtitle}>
                                {t('raceInfo.nextTimingPoint')}
                            </Text>
                            <Text style={resultInfoStyles.timingPointDate}>
                                {raceInfo.next_cp.name}
                            </Text>
                            <Text style={resultInfoStyles.timingPointDate}>
                                {raceInfo.next_cp.day_name
                                    ? `${t(`common:week.${raceInfo.next_cp.day_name.toLowerCase()}`)} ${formatClockTime(raceInfo.next_cp.predicted_time) || '—'}`
                                    : formatClockTime(raceInfo.next_cp.predicted_time) || '—'
                                }
                            </Text>
                            {raceInfo.next_cp.predicted_minutes != null && (
                                <Text style={resultInfoStyles.timingPointDate}>
                                    {t('raceInfo.in')} {raceInfo.next_cp.predicted_minutes} {t('raceInfo.minutes')}
                                </Text>
                            )}
                        </View>
                    </View>
                )}

                {raceInfo?.previous_cp && (
                    <View style={resultInfoStyles.bibCard}>
                        <Text style={commonStyles.subtitle}>
                            {t('raceInfo.previousTimingPoint')}
                        </Text>
                        <Text style={resultInfoStyles.timingPointDate}>
                            {raceInfo.previous_cp.name}
                        </Text>
                        <Text style={resultInfoStyles.timingPointDate}>
                            {raceInfo.previous_cp.day_name
                                ? `${t(`common:week.${raceInfo.previous_cp.day_name.toLowerCase()}`)} ${formatClockTime(raceInfo.previous_cp.actual_time) || '—'}`
                                : formatClockTime(raceInfo.previous_cp.actual_time) || '—'
                            }
                        </Text>
                        <View style={[resultInfoStyles.headerBar, {
                            paddingTop: spacing.sm,
                            gap: spacing.sm,
                        }]}>
                            <Entypo name="stopwatch" size={24} color="black" />
                            <Text style={commonStyles.title}>
                                {raceInfo.previous_cp.race_time || '—'}
                            </Text>
                        </View>
                    </View>
                )}

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
                        <Text style={[commonStyles.subtitle, {
                            textAlign: 'center',
                            marginBottom: 8,
                        }]}>
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
                        <Text style={[commonStyles.subtitle, {
                            textAlign: 'center',
                            marginBottom: 8,
                        }]}>
                            {t('raceInfo.elevationGain')}
                        </Text>
                        <Text style={resultInfoStyles.raceTimeText}>
                            {raceInfo?.elevation_gain
                                ? `${raceInfo.elevation_gain} ${t('units.meterPlus')}`
                                : '—'}
                        </Text>
                    </View>
                </View>

                <ElevationChart
                    gpxPoints={gpxPoints}
                    distanceCompleted={raceInfo?.distance_completed}
                    loading={gpxLoading}
                />
            </View>
        </ScrollView>
    );
};

export default RaceLive;