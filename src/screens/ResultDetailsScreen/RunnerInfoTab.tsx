import React from 'react';
import { View, Text, Image } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { colors, commonStyles } from '../../styles/common.styles';
import { resultInfoStyles } from '../../styles/resultDetails.styles';
import { RunnerInfo } from '../../services/resultDetailsService';
import { resultListStyle } from '../../styles/ResultList.styles';
import { SvgUri } from 'react-native-svg';
import { getImageUrl } from '../../constants/config';

interface RunnerInfoProps {
    runnerInfo?: RunnerInfo;
}

const getInitials = (name?: string): string => {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const RunnerInfoTab: React.FC<RunnerInfoProps> = ({ runnerInfo }) => {
    const { t } = useTranslation('resultdetails');
    const initials = getInitials(runnerInfo?.name);
    
    // ✅ Check if UTMB index exists, is not empty, and is not 0
    const hasUtmbIndex = runnerInfo?.utmb_index && 
                         runnerInfo.utmb_index.trim() !== '' && 
                         runnerInfo.utmb_index !== '0' &&
                         Number(runnerInfo.utmb_index) !== 0;

    return (
        <View style={commonStyles.container}>
            <View style={[resultInfoStyles.card, { marginTop: 10 }]}>

                <View>
                    {runnerInfo?.profile_picture ? (
                        <Image
                            source={{ uri: getImageUrl(runnerInfo?.profile_picture) || undefined }}
                            style={resultInfoStyles.avatarCircle}
                        />
                    ) : (
                        <View style={resultInfoStyles.initials}>
                            <Text style={{
                                fontSize: 30,
                                fontWeight: '600',
                                color: colors.participantColor,
                                letterSpacing: 1,
                            }}>
                                {initials}
                            </Text>
                        </View>
                    )}
                </View>

                <View style={resultInfoStyles.bibCard}>
                    <Text style={commonStyles.title}>{runnerInfo?.name ?? '—'}</Text>
                    <View style={[resultListStyle.flagRow, { marginTop: 10, marginBottom: 8 }]}>
                        {runnerInfo?.nation_flag ? (
                            <SvgUri
                                width={28}
                                height={20}
                                uri={runnerInfo.nation_flag}
                            />
                        ) : (
                            <Text>🏳️</Text>
                        )}
                        <Text style={resultListStyle.statVal} numberOfLines={1}>
                            {runnerInfo?.nation || '—'}
                        </Text>
                    </View>
                </View>

                <View style={resultInfoStyles.row}>
                    <View style={resultInfoStyles.col}>
                        <Text style={commonStyles.subtitle}>{t('runnerInfo.club')}</Text>
                        <Text style={commonStyles.subtitle}>
                            {runnerInfo?.club || '—'}
                        </Text>
                    </View>

                    <View style={resultInfoStyles.colDivider} />

                    <View style={resultInfoStyles.col}>
                        <Text style={commonStyles.subtitle}>{t('runnerInfo.category')}</Text>
                        <Text style={commonStyles.title}>
                            {runnerInfo?.category_name || '—'}
                        </Text>
                    </View>
                </View>

                {/* ✅ Only show UTMB section if utmb_index exists and is not 0 */}
                {hasUtmbIndex && (
                    <View style={resultInfoStyles.row}>
                        <View style={resultInfoStyles.col}>
                            <View style={resultInfoStyles.utmbIndexBadge}>
                                <Text style={resultInfoStyles.utmbText}>UTMB</Text>
                                <View style={resultInfoStyles.utmbIndexTag}>
                                    <Text style={resultInfoStyles.utmbIndexText}>
                                        {t('runnerInfo.utmbIndex')}
                                    </Text>
                                </View>
                            </View>
                            <Text style={commonStyles.title}>
                                {runnerInfo.utmb_index}
                            </Text>
                        </View>

                        <View style={resultInfoStyles.colDivider} />

                        <View style={resultInfoStyles.col}>
                            <View style={resultInfoStyles.utmbSeriesBadge}>
                                <Text style={resultInfoStyles.utmbSeriesTitle}>UTMB®</Text>
                                <Text style={resultInfoStyles.utmbSeriesSub}>
                                    {t('runnerInfo.utmbSeries')}
                                </Text>
                            </View>
                            <View>
                                <Ionicons name="card-outline" size={28} color="#333" />
                            </View>
                        </View>
                    </View>
                )}

            </View>
        </View>
    );
};

export default RunnerInfoTab;