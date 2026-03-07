
import React from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { colors, commonStyles } from '../../styles/common.styles';
import { resultInfoStyles } from '../../styles/resultDetails.styles';

const RunnerInfoTab: React.FC = () => {
    const { t } = useTranslation('resultdetails');

    return (
        <View style={commonStyles.container}>
            <View style={[resultInfoStyles.card,{marginTop:10}]}>
                <View style={resultInfoStyles.avatarCircle}>
                    <Ionicons name="person-outline" size={64} color={colors.primary} />
                </View>
                <View style={resultInfoStyles.bibCard}>
                <Text style={commonStyles.title}>CHEN Weiting</Text>
                </View>
                <View style={resultInfoStyles.row}>
                    <View style={resultInfoStyles.col}>
                        <Text style={commonStyles.subtitle}>{t('runnerInfo.club')}</Text>
                        <Text style={commonStyles.title}>{t('runnerInfo.noClub')}</Text>
                    </View>

                    <View style={resultInfoStyles.colDivider} />

                    <View style={resultInfoStyles.col}>
                        <Text style={commonStyles.subtitle}>{t('runnerInfo.category')}</Text>
                        <Text style={commonStyles.title}>Open ()</Text>
                    </View>
                </View>
                <View style={resultInfoStyles.row}>
                    <View style={resultInfoStyles.col}>
                        <View style={resultInfoStyles.utmbIndexBadge}>
                            <Text style={resultInfoStyles.utmbText}>UTMB</Text>
                            <View style={resultInfoStyles.utmbIndexTag}>
                                <Text style={resultInfoStyles.utmbIndexText}>{t('runnerInfo.utmbIndex')}</Text>
                            </View>
                        </View>
                        <Text style={commonStyles.title}>512</Text>
                    </View>

                    <View style={resultInfoStyles.colDivider} />
                    <View style={resultInfoStyles.col}>
                        <View style={resultInfoStyles.utmbSeriesBadge}>
                            <Text style={resultInfoStyles.utmbSeriesTitle}>UTMB®</Text>
                            <Text style={resultInfoStyles.utmbSeriesSub}>{t('runnerInfo.utmbSeries')}</Text>
                        </View>
                        <View>
                            <Ionicons name="card-outline" size={28} color="#333" />
                        </View>
                    </View>
                </View>
            </View>
        </View>
    );
};

export default RunnerInfoTab;
