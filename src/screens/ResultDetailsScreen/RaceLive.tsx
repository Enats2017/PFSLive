import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { resultInfoStyles } from '../../styles/resultDetails.styles';
import { commonStyles, spacing } from '../../styles/common.styles';
import { Entypo } from '@expo/vector-icons';
import { resultListStyle } from '../../styles/ResultList.styles';
import { CheckpointDetail, RaceInfo, ResultDetailEvent } from '../../services/resultDetailsService';
import ElevationChart from '../../components/ElevationChart';
import { useGpxElevation } from '../../hooks/useGpxElevation';

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

    return (
        <ScrollView
            contentContainerStyle={resultInfoStyles.scrollContent}
            showsVerticalScrollIndicator={false}
        >
            <View style={[resultInfoStyles.card, { marginBottom: 20 }]}>
                <View style={resultInfoStyles.headerBar}>
                    <View style={[resultInfoStyles.headerGreen]}>
                        <Text style={commonStyles.text}>
                            {t(`status.${event?.race_status ?? 'in_progress'}`)}
                        </Text>
                    </View>
                    <View style={resultInfoStyles.diagLeft} />
                    <View style={resultInfoStyles.headerMiddle} />
                    <View style={resultInfoStyles.diagRight} />
                    <View style={resultInfoStyles.headerRed}>
                        <Text style={commonStyles.text}>
                            {event?.distance_name ?? '—'}
                        </Text>
                    </View>
                </View>

                <View style={resultInfoStyles.bibCard}>
                    <Text style={commonStyles.title}>{raceInfo?.bib ?? '—'}</Text>
                    <Text style={commonStyles.title}>{raceInfo?.name ?? '—'}</Text>
                </View>

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
                                    ? `${t(`common:week.${raceInfo.next_cp.day_name.toLowerCase()}`)} ${raceInfo.next_cp.predicted_time ?? '—'}`
                                    : raceInfo.next_cp.predicted_time ?? '—'
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
                                ? `${t(`common:week.${raceInfo.previous_cp.day_name.toLowerCase()}`)} ${raceInfo.previous_cp.actual_time || '—'}`
                                : raceInfo.previous_cp.actual_time || '—'
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
                        { labelKey: 'raceInfo.overallRanking', value: lastCheckpoint?.ranking || '—' },
                        { labelKey: 'raceInfo.rankingInOpen', value: lastCheckpoint?.rank_agegroup || '—' },
                        { labelKey: 'raceInfo.genderRanking', value: lastCheckpoint?.rank_gender || '—' },
                    ].map((item, i) => (
                        <View
                            key={item.labelKey}
                            style={[
                                resultInfoStyles.rankingCol,
                                i === 1 && resultInfoStyles.rankingColBorder,
                            ]}
                        >
                            <Text style={[commonStyles.subtitle, {
                                textAlign: 'center',
                                marginBottom: 8,
                            }]}>
                                {t(item.labelKey)}
                            </Text>
                            <Text style={commonStyles.title}>{item.value}</Text>
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