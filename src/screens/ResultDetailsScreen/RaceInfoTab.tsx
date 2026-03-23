import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { resultInfoStyles } from '../../styles/resultDetails.styles';
import { commonStyles } from '../../styles/common.styles';
import { CheckpointDetail, RaceInfo, ResultDetailEvent } from '../../services/resultDetailsService';

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

    return (
        <ScrollView
            contentContainerStyle={resultInfoStyles.scrollContent}
            showsVerticalScrollIndicator={false}
        >
            <View style={resultInfoStyles.card}>
                <View style={resultInfoStyles.headerBar}>
                    <View style={resultInfoStyles.headerGreen}>
                        <Text style={commonStyles.text}>
                            {t(`status.${event?.race_status ?? 'finished'}`)}
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
                            ? `${t(`common:week.${raceInfo.previous_cp.day_name.toLowerCase()}`)} ${raceInfo.previous_cp.actual_time}`
                            : '—'}
                    </Text>
                </View>

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