import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { resultInfoStyles } from '../../styles/resultDetails.styles';
import { commonStyles } from '../../styles/common.styles';
import { RaceInfo, ResultDetailEvent } from '../../services/resultDetailsService';

interface Props {
    raceInfo?: RaceInfo;
    event?: ResultDetailEvent;
}

const UpcomingRace: React.FC<Props> = ({ raceInfo, event }) => {
    const { t } = useTranslation('resultdetails');
    return (
        <ScrollView
            contentContainerStyle={resultInfoStyles.scrollContent}
            showsVerticalScrollIndicator={false}
        >
            <View style={resultInfoStyles.card}>
                <View style={resultInfoStyles.headerBar}>
                    <View style={resultInfoStyles.headerGreen}>
                        <Text style={commonStyles.text}>
                            {t(`status.${event?.race_status}`)}
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
                    <Text style={resultInfoStyles.raceTimeText}>{raceInfo?.time || "00:00:00"}</Text>
                </View>

                <View style={resultInfoStyles.statsCard}>
                    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                        <Text
                            style={[
                                commonStyles.subtitle,
                                { textAlign: 'center', marginBottom: 8 },
                            ]}
                        >
                            {t('raceInfo.distanceCompleted')}
                        </Text>

                        <Text style={resultInfoStyles.raceTimeText}>
                            {raceInfo?.distance_completed != null
                                ? `${raceInfo.distance_completed} ${t('units.km')}`
                                : `0.00 ${t('units.km')}`}
                        </Text>
                    </View>
                </View>
            </View>
        </ScrollView>
    );
};

export default UpcomingRace;