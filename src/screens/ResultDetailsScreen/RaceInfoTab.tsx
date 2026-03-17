import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { resultInfoStyles } from '../../styles/resultDetails.styles';
import { commonStyles } from '../../styles/common.styles';
import { RaceInfo, ResultDetailEvent } from '../../services/resultDetailsService';

interface Props {
    raceInfo?: RaceInfo;
    event?: ResultDetailEvent;
}

const RaceInfoTab: React.FC<Props> = ({ raceInfo, event }) => {
    const { t } = useTranslation('resultdetails');

    return (
        <ScrollView
            contentContainerStyle={resultInfoStyles.scrollContent}
            showsVerticalScrollIndicator={false}
        >
            <View style={resultInfoStyles.card}>

                {/* status bar */}
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

                {/* bib + name */}
                <View style={resultInfoStyles.bibCard}>
                    <Text style={commonStyles.title}>{raceInfo?.bib ?? '—'}</Text>
                    <Text style={commonStyles.title}>{raceInfo?.name ?? '—'}</Text>
                </View>

                {/* race time */}
                <View style={resultInfoStyles.bibCard}>
                    <Text style={commonStyles.subtitle}>{t('raceInfo.raceTime')}</Text>
                    <Text style={resultInfoStyles.raceTimeText}>
                        {raceInfo?.race_time_display ?? '—'}
                    </Text>
                </View>

                {/* previous timing point */}
                <View style={resultInfoStyles.bibCard}>
                    <Text style={commonStyles.subtitle}>{t('raceInfo.previousTimingPoint')}</Text>
                    <Text style={commonStyles.text}>
                        {raceInfo?.previous_cp?.name ?? '—'}
                    </Text>
                    <Text style={resultInfoStyles.timingPointDate}>
                        {raceInfo?.previous_cp?.day_name && raceInfo?.previous_cp?.actual_time
                            ? `${raceInfo.previous_cp.day_name}. ${raceInfo.previous_cp.actual_time}`
                            : '—'}
                    </Text>
                </View>

                {/* rankings */}
                <View style={resultInfoStyles.rankingsCard}>
                    {[
                        { labelKey: 'raceInfo.overallRanking', value: raceInfo?.position ?? '—' },
                        { labelKey: 'raceInfo.rankingInOpen', value: raceInfo?.category_rank ?? '—' },
                        { labelKey: 'raceInfo.genderRanking', value: raceInfo?.gender_ranking ?? '—' },
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
                            <Text style={commonStyles.title}>{item.value}</Text>
                        </View>
                    ))}
                </View>

                {/* distance only — elevation removed */}
                <View style={resultInfoStyles.statsCard}>
                    <View style={resultInfoStyles.statsCol}>
                        <Text style={[commonStyles.subtitle, { textAlign: 'center', marginBottom: 8 }]}>
                            {t('raceInfo.distanceCompleted')}
                        </Text>
                        <Text style={resultInfoStyles.raceTimeText}>
                            {raceInfo?.distance_completed
                                ? `${raceInfo.distance_completed} km`
                                : '—'}
                        </Text>
                    </View>
                </View>

            </View>
        </ScrollView>
    );
};

export default RaceInfoTab;