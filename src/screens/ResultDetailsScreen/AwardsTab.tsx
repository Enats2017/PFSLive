
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
                        <Text style={commonStyles.title}>{award.year}</Text>
                    </View>
                    <Text style={[commonStyles.title,{paddingHorizontal:spacing.sm}]}>{award.raceName}</Text>
                    <View style={[resultInfoStyles.row,{marginTop:spacing.xl}]}>
                        <View style={resultInfoStyles.col}>
                            <Text style={commonStyles.subtitle}>{t('awards.time')}</Text>
                            <Text style={commonStyles.title}>{award.time}</Text>
                        </View>
                        <View style={resultInfoStyles.colDivider} />
                        <View style={resultInfoStyles.col}>
                            <Text style={commonStyles.subtitle}>{t('awards.country')}</Text>
                            <View style={resultInfoStyles.countryRow}>
                                <Text style={commonStyles.title}>{award.countryFlag}</Text>
                                <Text style={commonStyles.title}>{award.country}</Text>
                            </View>
                        </View>
                    </View>
                    <View style={[resultInfoStyles.row,{marginTop:spacing.xl}]}>
                        <View style={resultInfoStyles.col}>
                            <Text style={commonStyles.subtitle}>{t('awards.ranking')}</Text>
                            <Text style={commonStyles.title}>{award.ranking}</Text>
                        </View>
                        <View style={resultInfoStyles.colDivider} />
                        <View style={resultInfoStyles.col}>
                            <Text style={commonStyles.subtitle}>{t('awards.genderRanking')}</Text>
                            <Text style={commonStyles.title}>{award.genderRanking}</Text>
                        </View>
                    </View>
                    <View style={[resultInfoStyles.row,{marginTop:spacing.xl}]}>
                        <View style={resultInfoStyles.col}>
                            
                            <Text style={commonStyles.subtitle}>{t('awards.distance')}</Text>
                            <Text style={commonStyles.title}>{award.distance}</Text>
                        </View>
                        <View style={resultInfoStyles.colDivider} />
                        <View style={resultInfoStyles.col}>
                            <Text style={commonStyles.subtitle}>{t('awards.elevationGain')}</Text>
                            <Text style={commonStyles.title}>{award.elevationGain}</Text>
                        </View>
                    </View>
                </View>
            ))}
        </ScrollView>
    );
};

export default AwardsTab;
