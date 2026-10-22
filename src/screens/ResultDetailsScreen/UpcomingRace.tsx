import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { resultInfoStyles } from '../../styles/resultDetails.styles';
import { commonStyles } from '../../styles/common.styles';
import { RaceInfo, ResultDetailEvent } from '../../services/resultDetailsService';
import { stripWavePrefix } from '../../utils/waveLabel';

interface Props {
    raceInfo?: RaceInfo;
    event?: ResultDetailEvent;
}

const UpcomingRace: React.FC<Props> = ({ raceInfo, event }) => {
    const { t } = useTranslation(['resultdetails', 'common']);
    
    return (
        <ScrollView
            contentContainerStyle={resultInfoStyles.scrollContent}
            showsVerticalScrollIndicator={false}
        >
            <View style={resultInfoStyles.card}>
                {/* 29_RaceInfo.png: a small-caps section label, then label/value
                    rows. Status and distance were chips left over from the old
                    two-tone banner. */}
                <Text style={resultInfoStyles.sectionLabel}>{t('raceInfo.raceResult')}</Text>

                <View style={resultInfoStyles.bibCard}>
                    <Text style={[resultInfoStyles.rowLabel, resultInfoStyles.rowLabelFixed]}>{t('raceInfo.status')}</Text>
                    <Text style={[resultInfoStyles.rowValue, resultInfoStyles.rowValueEnd]} numberOfLines={1}>
                        {t(`status.${event?.race_status ?? 'not_started'}`)}
                    </Text>
                </View>

                <View style={resultInfoStyles.bibCard}>
                    {/* rowLabelFixed / rowValueEnd: the value never shrank, so a long
                        distance name squeezed "Afstand" at 320pt. */}
                    <Text style={[resultInfoStyles.rowLabel, resultInfoStyles.rowLabelFixed]}>{t('raceInfo.distance')}</Text>
                    <Text style={[resultInfoStyles.rowValue, resultInfoStyles.rowValueEnd]} numberOfLines={2}>
                        {event?.distance_name ?? '—'}
                    </Text>
                </View>

                {/* The name takes the rest of the row and wraps (flex 1): neither
                    text could shrink, so bib + a long name ran past the card at
                    320pt (and 375pt with larger text). */}
                <View style={resultInfoStyles.bibCard}>
                    <Text style={resultInfoStyles.rowValue}>{raceInfo?.bib ?? '—'}</Text>
                    <Text style={[resultInfoStyles.rowValue, resultInfoStyles.rowValueEnd, { flex: 1 }]} numberOfLines={2}>{raceInfo?.name ?? '—'}</Text>
                </View>
                {!!raceInfo?.wave && (
                    <View style={resultInfoStyles.bibCard}>
                        <Text style={[resultInfoStyles.rowLabel, resultInfoStyles.rowLabelFixed]}>{t('raceInfo.wavelabel')}</Text>
                        <Text style={[resultInfoStyles.rowValue, resultInfoStyles.rowValueEnd]}>{stripWavePrefix(raceInfo.wave)}</Text>
                    </View>
                )}
                <View style={resultInfoStyles.bibCard}>
                    <Text style={resultInfoStyles.rowLabel}>{t('raceInfo.raceTime')}</Text>
                    <Text style={resultInfoStyles.raceTimeText}>00:00:00</Text>
                </View>
                

                <View style={resultInfoStyles.statsCard}>
                    <View style={resultInfoStyles.statsCol}>
                        <Text style={resultInfoStyles.rowLabel}>
                            {t('raceInfo.distanceCompleted')}
                        </Text>
                        <Text style={resultInfoStyles.raceTimeText}>
                            0.00 {t('units.km')}
                        </Text>
                    </View>
                    <View style={resultInfoStyles.statsColBorder} />
                    <View style={resultInfoStyles.statsCol}>
                        <Text style={resultInfoStyles.rowLabel}>
                            {t('raceInfo.elevationGain')}
                        </Text>
                        <Text style={resultInfoStyles.raceTimeText}>
                            0 {t('units.meterPlus')}
                        </Text>
                    </View>
                </View>
            </View>
        </ScrollView>
    );
};

export default UpcomingRace;