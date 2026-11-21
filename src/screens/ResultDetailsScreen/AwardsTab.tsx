
import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';

import { resultInfoStyles } from '../../styles/resultDetails.styles';
import { commonStyles, spacing } from '../../styles/common.styles';

// hardcoded — will come from API later
const AWARDS_DATA = [
    {
        year:          '2024',
        raceName:      'DRAGON, TIGER, PHOENIX TRAIL - KIRIN',
        time:          '26:12:24',
        country:       'Chinese Taipei',
        countryFlag:   '🇹🇼',
        ranking:       '27',
        genderRanking: '- -',
        distance:      '88 km',
        elevationGain: '7000 m+',
    },
];

const AwardsTab: React.FC = () => {
    const { t } = useTranslation('resultdetails');

    return (
        <ScrollView
            contentContainerStyle={resultInfoStyles.scrollContent}
            showsVerticalScrollIndicator={false}
        >
            {AWARDS_DATA.map((award, index) => (
                <View key={index} style={resultInfoStyles.card}>
                    <View style={resultInfoStyles.cornerBadge}>
                        <Text style={resultInfoStyles.rowValue}>{award.year}</Text>
                    </View>
                    <Text style={[resultInfoStyles.rowValue,{paddingHorizontal:spacing.sm}]}>{award.raceName}</Text>
                    <View style={[resultInfoStyles.row,{marginTop:spacing.xl}]}>
                        <View style={resultInfoStyles.col}>
                            <Text style={resultInfoStyles.rowLabel}>{t('awards.time')}</Text>
                            <Text style={resultInfoStyles.rowValue}>{award.time}</Text>
                        </View>
                        <View style={resultInfoStyles.colDivider} />
                        <View style={resultInfoStyles.col}>
                            <Text style={resultInfoStyles.rowLabel}>{t('awards.country')}</Text>
                            <View style={resultInfoStyles.countryRow}>
                                <Text style={resultInfoStyles.rowValue}>{award.countryFlag}</Text>
                                <Text style={resultInfoStyles.rowValue}>{award.country}</Text>
                            </View>
                        </View>
                    </View>
                    <View style={[resultInfoStyles.row,{marginTop:spacing.xl}]}>
                        <View style={resultInfoStyles.col}>
                            <Text style={resultInfoStyles.rowLabel}>{t('awards.ranking')}</Text>
                            <Text style={resultInfoStyles.rowValue}>{award.ranking}</Text>
                        </View>
                        <View style={resultInfoStyles.colDivider} />
                        <View style={resultInfoStyles.col}>
                            <Text style={resultInfoStyles.rowLabel}>{t('awards.genderRanking')}</Text>
                            <Text style={resultInfoStyles.rowValue}>{award.genderRanking}</Text>
                        </View>
                    </View>
                    <View style={[resultInfoStyles.row,{marginTop:spacing.xl}]}>
                        <View style={resultInfoStyles.col}>
                            
                            <Text style={resultInfoStyles.rowLabel}>{t('awards.distance')}</Text>
                            <Text style={resultInfoStyles.rowValue}>{award.distance}</Text>
                        </View>
                        <View style={resultInfoStyles.colDivider} />
                        <View style={resultInfoStyles.col}>
                            <Text style={resultInfoStyles.rowLabel}>{t('awards.elevationGain')}</Text>
                            <Text style={resultInfoStyles.rowValue}>{award.elevationGain}</Text>
                        </View>
                    </View>
                </View>
            ))}
        </ScrollView>
    );
};

export default AwardsTab;
