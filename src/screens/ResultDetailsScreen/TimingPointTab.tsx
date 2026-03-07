// tabs/TimingPointTab.tsx

import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';

import { resultInfoStyles } from '../../styles/resultDetails.styles';
import { commonStyles } from '../../styles/common.styles';
import RaceInfoTab from './RaceInfoTab';

const TIMING_DATA = [
    {
        name: 'Start',
        startTime: 'Sat. 06:00:00',
        distance: '0.00 km',
        elevationGain: '0 ',
        raceTime: '00:00:00',
        ranking: '- -',
        segmentKm: null,
        segmentEle: null,
        done: true,
    },
    {
        name: 'Old House',
        arrivalTime: 'Sat. 08:30:00',
        distance: '9.69 km',
        elevationGain: '263 ',
        raceTime: '02:30:00',
        ranking: '(1.)',
        segmentKm: '9.69 ',
        segmentEle: '263',
        done: true,
    },
    {
        name: '21 KM',
        arrivalTime: 'Sat. 09:42:05',
        distance: '21.00 km',
        elevationGain: '750 ',
        raceTime: '03:42:05',
        ranking: '(1.)',
        segmentKm: '11.31 ',
        segmentEle: '487',
        done: true,
    },
    {
        name: 'Finish',
        arrivalTime: 'Sat. 19:00:05',
        distance: '94.63 km',
        elevationGain: '3661 ',
        raceTime: '13:00:05',
        ranking: '(1.)',
        segmentKm: '73.63 ',
        segmentEle: '2911',
        done: true,
    },
];

const TimingPointTab: React.FC = () => {
    const { t } = useTranslation('resultdetails');
    const isLast = (i: number) => i === TIMING_DATA.length - 1;
    const isFirst = (i: number) => i === 0;

    return (
        <ScrollView
            contentContainerStyle={[resultInfoStyles.scrollContent, { paddingHorizontal: 10 }]}
            showsVerticalScrollIndicator={false}
        >
            {TIMING_DATA.map((item, index) => (
                <View key={index} style={resultInfoStyles.headerBar}>
                    <View style={resultInfoStyles.leftCol}>
                        {isFirst(index)
                            ? <View style={resultInfoStyles.iconSpacer} />
                            : <View style={resultInfoStyles.lineTop} />
                        }
                        <View style={[resultInfoStyles.iconCircle, item.done && resultInfoStyles.iconCircleDone]}>
                            <Ionicons name="checkmark" size={14} color="#fff" />
                        </View>
                        {!isLast(index) && (
                            <View style={resultInfoStyles.lineBottomWrap}>
                                {/* blue line */}
                                <View style={resultInfoStyles.lineBottom} />

                                {item.segmentKm && (
                                    <View style={resultInfoStyles.segmentLabels}>
                                        <Text style={resultInfoStyles.segmentText}>{item.segmentKm}</Text>

                                    </View>
                                )}
                            </View>
                        )}
                    </View>
                    <View style={resultInfoStyles.timingcard}>
                        <View style={resultInfoStyles.bibCard}>
                            <Text style={commonStyles.title}>{item.name}</Text>

                        </View>
                        {isFirst(index) ? (
                            <View style={resultInfoStyles.bibCard}>
                                <Text style={commonStyles.subtitle}>{t('timingPoint.startTime')}</Text>
                                <Text style={resultInfoStyles.timingPointDate}>{item.startTime}</Text>
                            </View>
                        ) : (
                            <View style={resultInfoStyles.bibCard}>
                                <Text style={commonStyles.subtitle}>{t('timingPoint.arrivalTime')}</Text>
                                <Text style={resultInfoStyles.timingPointDate}>{item.arrivalTime}</Text>
                            </View>
                        )}
                        <View style={resultInfoStyles.twoColRow}>
                            <View style={resultInfoStyles.twoColLeft}>
                                <Text style={commonStyles.subtitle}>{t('timingPoint.distance')}</Text>
                                <Text style={commonStyles.title}>{item.distance}</Text>
                            </View>
                            <View style={resultInfoStyles.verticalDivider} />
                            <View style={resultInfoStyles.twoColRight}>
                                <Text style={commonStyles.subtitle}>{t('timingPoint.elevationGain')}</Text>
                                <Text style={commonStyles.title}>{item.elevationGain}</Text>
                            </View>
                        </View>
                        <View style={resultInfoStyles.twoColRow}>
                            <View style={resultInfoStyles.twoColLeft}>
                                <Text style={commonStyles.subtitle}>{t('timingPoint.time')}</Text>
                                <Text style={commonStyles.title}>{item.raceTime}</Text>
                            </View>
                            <View style={resultInfoStyles.verticalDivider} />
                            <View style={resultInfoStyles.twoColRight}>
                                <Text style={commonStyles.subtitle}>{t('timingPoint.ranking')}</Text>
                                <Text style={commonStyles.title}>{item.ranking}</Text>
                            </View>
                        </View>

                    </View>
                </View>
            ))}
        </ScrollView>
    );
};

export default TimingPointTab;
