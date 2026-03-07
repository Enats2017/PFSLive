// tabs/RaceInfoTab.tsx

import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { raceInfoStyles as s } from '../../styles/raceInfoTab.styles';
import { commonStyles } from '../../styles/common.styles';

const RaceInfoTab: React.FC = () => {
    const { t } = useTranslation('resultdetails');

    return (
        <ScrollView
            contentContainerStyle={s.scrollContent}
            showsVerticalScrollIndicator={false}

        >
            <View style={s.card}>
                <View style={s.headerBar}>
                    <View style={s.headerGreen}>
                        <Text style={s.headerFinisher}>Finisher</Text>
                    </View>
                    <View style={s.diagLeft} />
                    <View style={s.headerMiddle} />
                    <View style={s.diagRight} />
                    <View style={s.headerRed}>
                        <Text style={s.header100km}>100KM</Text>
                    </View>
                </View>

                <View style={s.bibCard}>
                    <Text style={s.bibText}>1040</Text>
                    <Text style={s.nameText}>Weiting CHEN</Text>
                </View>

                <View style={s.bibCard}>
                    <Text style={s.sectionLabel}>{t('raceInfo.raceTime')}</Text>
                    <Text style={s.raceTimeText}>13:00:05</Text>
                </View>

                <View style={s.bibCard}>
                    <Text style={s.sectionLabel}>{t('raceInfo.previousTimingPoint')}</Text>
                    {/* values from API */}
                    <Text style={s.timingPointValue}>Finish</Text>
                    <Text style={s.timingPointDate}>Sat. 19:00:05</Text>
                </View>

                <View style={s.rankingsCard}>
                    {[
                        { labelKey: 'raceInfo.overallRanking', value: '1' },
                        { labelKey: 'raceInfo.rankingInOpen', value: '1' },
                        { labelKey: 'raceInfo.genderRanking', value: '1' },
                    ].map((item, i) => (
                        <View
                            key={i}
                            style={[
                                s.rankingCol,
                                i === 1 && s.rankingColBorder,
                            ]}
                        >
                            <Text style={s.rankingLabel}>{t(item.labelKey)}</Text>
                            <Text style={s.rankingValue}>{item.value}</Text>
                        </View>
                    ))}
                </View>
                <View style={s.statsCard}>
                    {[
                        { labelKey: 'raceInfo.distanceCompleted', value: '94.63 km' },
                        { labelKey: 'raceInfo.elevationGain', value: '3661 m+' },
                    ].map((item, i) => (
                        <View
                            key={i}
                            style={[
                                s.statsCol,
                                i === 1 && s.statsColBorder,
                            ]}
                        >
                            <Text style={s.statsLabel}>{t(item.labelKey)}</Text>
                            <Text style={s.statsValue}>{item.value}</Text>
                        </View>
                    ))}
                </View>
            </View>
        </ScrollView>
    );
};

export default RaceInfoTab;
