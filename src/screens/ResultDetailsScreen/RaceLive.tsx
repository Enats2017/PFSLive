
import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { resultInfoStyles } from '../../styles/resultDetails.styles';
import { commonStyles, spacing } from '../../styles/common.styles';
import Entypo from '@expo/vector-icons/Entypo';
import { resultListStyle } from '../../styles/ResultList.styles';
import ElevationChart from '../../components/ElevationChart';

const RaceLive: React.FC = () => {
    const { t } = useTranslation('resultdetails');
    return (
        <ScrollView
            contentContainerStyle={resultInfoStyles.scrollContent}
            showsVerticalScrollIndicator={false}

        >
            <View style={[resultInfoStyles.card, , { marginBottom: 20 }]}>
                <View style={resultInfoStyles.headerBar}>
                    <View style={resultInfoStyles.headerGreen}>
                        <Text style={commonStyles.text}>Finisher</Text>
                    </View>
                    <View style={resultInfoStyles.diagLeft} />
                    <View style={resultInfoStyles.headerMiddle} />
                    <View style={resultInfoStyles.diagRight} />
                    <View style={resultInfoStyles.headerRed}>
                        <Text style={commonStyles.text}>100KM</Text>
                    </View>
                </View>

                <View style={resultInfoStyles.bibCard}>
                    <Text style={commonStyles.title}>1040</Text>
                    <Text style={commonStyles.title}>Weiting CHEN</Text>
                </View>

                <View style={resultInfoStyles.bibCard}>
                    <Text style={commonStyles.subtitle}>{t('raceInfo.raceTime')}</Text>
                    <Text style={resultInfoStyles.raceTimeText}>13:00:05</Text>
                </View>


                <View style={[resultListStyle.card,{borderWidth: 0.28,
                    borderLeftWidth: 0.28,
                    borderColor: '#FF3B30',}]}>
                    <View style={resultInfoStyles.bibCard}>
                        <Text style={commonStyles.subtitle}>{t('raceInfo.nextTimingPoint')}</Text>
                        <Text style={resultInfoStyles.timingPointDate}>Kenting Villa 2</Text>
                        <Text style={resultInfoStyles.timingPointDate}>Sat. 19:00:05</Text>
                        <Text style={resultInfoStyles.timingPointDate}>in 15 minutes</Text>

                    </View>
                </View>
                <View style={resultInfoStyles.bibCard}>
                    <Text style={commonStyles.subtitle}>{t('raceInfo.previousTimingPoint')}</Text>
                    {/* values from API */}
                    <Text style={resultInfoStyles.timingPointDate}>Kenting Villa 2</Text>
                    <Text style={resultInfoStyles.timingPointDate}>Sat. 19:00:05</Text>
                    <View style={[resultInfoStyles.headerBar, { paddingTop: spacing.sm, gap: spacing.sm }]}>
                        <Entypo name="stopwatch" size={24} color="black" />
                        <Text style={commonStyles.title}>07:07:06</Text>
                    </View>

                </View>

                <View style={resultInfoStyles.rankingsCard}>
                    {[
                        { labelKey: 'raceInfo.overallRanking', value: '1' },
                        { labelKey: 'raceInfo.rankingInOpen', value: '1' },
                        { labelKey: 'raceInfo.genderRanking', value: '1' },
                    ].map((item, i) => (
                        <View
                            key={i}
                            style={[
                                resultInfoStyles.rankingCol,
                                i === 1 && resultInfoStyles.rankingColBorder,
                            ]}
                        >
                            <Text style={[commonStyles.subtitle, { textAlign: 'center', marginBottom: 8 }]}>{t(item.labelKey)}</Text>
                            <Text style={commonStyles.title}>{item.value}</Text>
                        </View>
                    ))}
                </View>
                {/* <View style={resultInfoStyles.statsCard}>
                    {[
                        { labelKey: 'raceInfo.distanceCompleted', value: '94.63 km' },
                        { labelKey: 'raceInfo.elevationGain', value: '3661 m+' },
                    ].map((item, i) => (
                        <View
                            key={i}
                            style={[
                                resultInfoStyles.statsCol,
                                i === 1 && resultInfoStyles.statsColBorder,
                            ]}
                        >
                            <Text style={[commonStyles.subtitle,{textAlign:'center',marginBottom:8}]}>{t(item.labelKey)}</Text>
                            <Text style={resultInfoStyles.raceTimeText}>{item.value}</Text>
                        </View>
                    ))}
                </View> */}
                <ElevationChart
                    distanceKm="78.46 km"
                    elevationGain="2632 m+"
                />
            </View>
        </ScrollView>
    );
};

export default RaceLive;
