import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { resultInfoStyles } from '../../styles/resultDetails.styles';
import { commonStyles } from '../../styles/common.styles';

const FACILITY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
    restaurant: 'restaurant-outline',
    medical:    'medkit-outline',
    bus:        'bus-outline',
    toilet:     'water-outline',
    dropbag:    'bag-outline',
};

const TIMING_DATA = [
    {
        name: 'Start',
        startTime: 'Sat. 06:00:00',
        arrivalTime: null,
        distance: '0.00 km',
        elevationGain: '0 m+',
        raceTime: '00:00:00',
        ranking: '- -',
        segmentKm: null,
        segmentEle: null,
        cutOffTime: null,
        facilities: [],
        done: true,
    },
    {
        name: 'Old House',
        startTime: null,
        arrivalTime: 'Sat. 08:30:00',
        distance: '9.69 km',
        elevationGain: '263 m+',
        raceTime: '02:30:00',
        ranking: '(1.)',
        segmentKm: '9.69 km',
        segmentEle: '263',
        cutOffTime: 'Sat. 10:00:00',
        facilities: ['restaurant', 'medical', 'toilet'],
        done: true,
    },
    {
        name: '21 KM',
        startTime: null,
        arrivalTime: 'Sat. 09:42:05',
        distance: '21.00 km',
        elevationGain: '750 m+',
        raceTime: '03:42:05',
        ranking: '(1.)',
        segmentKm: '11.31 km',
        segmentEle: '487',
        cutOffTime: 'Sat. 12:00:00',
        facilities: ['restaurant', 'bus', 'toilet', 'dropbag'],
        done: true,
    },
    {
        name: 'Finish',
        startTime: null,
        arrivalTime: 'Sat. 19:00:05',
        distance: '94.63 km',
        elevationGain: '3661 m+',
        raceTime: '13:00:05',
        ranking: '(1.)',
        segmentKm: '73.63 km',
        segmentEle: '2911',
        cutOffTime: null,
        done: true,
    },
];

const LiveTimingPoint: React.FC = () => {
    const { t } = useTranslation('resultdetails');
    const isLast  = (i: number) => i === TIMING_DATA.length - 1;
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
                        <View style={[
                            resultInfoStyles.iconCircle,
                            item.done && resultInfoStyles.iconCircleDone,
                        ]}>
                            <Ionicons name="checkmark" size={14} color="#fff" />
                        </View>
                        {!isLast(index) && (
                            <View style={resultInfoStyles.lineBottomWrap}>
                                <View style={resultInfoStyles.lineBottom} />
                                {item.segmentKm && (
                                    <View style={resultInfoStyles.segmentLabels}>
                                        <Text style={resultInfoStyles.segmentText}>
                                            {item.segmentKm}
                                        </Text>
                                    </View>
                                )}
                            </View>
                        )}
                    </View>

                    {/* ── right card ── */}
                    <View style={resultInfoStyles.timingcard}>

                        {/* name */}
                        <View style={resultInfoStyles.bibCard}>
                            <Text style={commonStyles.title}>{item.name}</Text>
                        </View>

                        {/* start or arrival time */}
                        {isFirst(index) ? (
                            <View style={resultInfoStyles.bibCard}>
                                <Text style={commonStyles.subtitle}>
                                    {t('timingPoint.startTime')}
                                </Text>
                                <Text style={resultInfoStyles.timingPointDate}>
                                    {item.startTime}
                                </Text>
                            </View>
                        ) : (
                            <View style={resultInfoStyles.bibCard}>
                                <Text style={commonStyles.subtitle}>
                                    {t('timingPoint.arrivalTime')}
                                </Text>
                                <Text style={resultInfoStyles.timingPointDate}>
                                    {item.arrivalTime}
                                </Text>
                            </View>
                        )}

                        {/* distance + elevation */}
                        <View style={resultInfoStyles.twoColRow}>
                            <View style={resultInfoStyles.twoColLeft}>
                                <Text style={commonStyles.subtitle}>
                                    {t('timingPoint.distance')}
                                </Text>
                                <Text style={commonStyles.title}>{item.distance}</Text>
                            </View>
                            <View style={resultInfoStyles.verticalDivider} />
                            <View style={resultInfoStyles.twoColRight}>
                                <Text style={commonStyles.subtitle}>
                                    {t('timingPoint.elevationGain')}
                                </Text>
                                <Text style={commonStyles.title}>{item.elevationGain}</Text>
                            </View>
                        </View>

                        {/* race time + ranking */}
                        <View style={resultInfoStyles.twoColRow}>
                            <View style={resultInfoStyles.twoColLeft}>
                                <Text style={commonStyles.subtitle}>
                                    {t('timingPoint.time')}
                                </Text>
                                <Text style={commonStyles.title}>{item.raceTime}</Text>
                            </View>
                            <View style={resultInfoStyles.verticalDivider} />
                            <View style={resultInfoStyles.twoColRight}>
                                <Text style={commonStyles.subtitle}>
                                    {t('timingPoint.ranking')}
                                </Text>
                                <Text style={commonStyles.title}>{item.ranking}</Text>
                            </View>
                        </View>

                        {/* ── cut-off time ── */}
                        {item.cutOffTime && (
                            <View style={resultInfoStyles.bibCard}>
                                <View style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 6,
                                    marginBottom: 4,
                                }}>
                                    <Ionicons
                                        name="alert-circle-outline"
                                        size={16}
                                        color="#e53935"
                                    />
                                    <Text style={{
                                        color: '#e53935',
                                        fontSize: 11,
                                        fontWeight: '700',
                                        letterSpacing: 1,
                                    }}>
                                        CUT-OFF TIME
                                    </Text>
                                </View>
                                <Text style={resultInfoStyles.timingPointDate}>
                                    {item.cutOffTime}
                                </Text>
                            </View>
                        )}
                        {item.facilities && item.facilities.length > 0 && (
                            <View style={resultInfoStyles.bibCard}>
                                <Text style={[commonStyles.subtitle, { marginBottom: 10 }]}>
                                    FACILITIES
                                </Text>
                                <View style={{
                                    flexDirection: 'row',
                                    gap: 7,
                                    flexWrap: 'wrap',
                                }}>
                                    {item.facilities.map((f, i) => (
                                        <Ionicons
                                            key={i}
                                            name={FACILITY_ICONS[f] ?? 'help-outline'}
                                            size={24}
                                            color="#333"
                                        />
                                    ))}
                                </View>
                            </View>
                        )}
                    </View>
                </View>
            ))}
        </ScrollView>
    );
};

export default LiveTimingPoint;