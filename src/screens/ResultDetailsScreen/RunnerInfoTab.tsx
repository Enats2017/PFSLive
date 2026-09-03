import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { commonStyles, palette, fonts } from '../../styles/common.styles';
import { resultInfoStyles } from '../../styles/resultDetails.styles';
import { RunnerInfo, RaceInfo } from '../../services/resultDetailsService';
import { resultListStyle } from '../../styles/ResultList.styles';
import { SvgUri } from 'react-native-svg';
import { getImageUrl } from '../../constants/config';

interface RunnerInfoProps {
    runnerInfo?: RunnerInfo;
    raceInfo?: RaceInfo;
    showUtmbIndex?: boolean;
    liveTrackingActivated?: number;
    isFollowing?: boolean;
    onMapPress?: () => void;
}

const getInitials = (name?: string): string => {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const RunnerInfoTab: React.FC<RunnerInfoProps> = ({ runnerInfo, raceInfo, showUtmbIndex, liveTrackingActivated,isFollowing,onMapPress}) => {
    const { t } = useTranslation('resultdetails');
    const initials = getInitials(runnerInfo?.name);

    // ✅ Check if UTMB index exists, is not empty, and is not 0
    const hasUtmbIndex = runnerInfo?.utmb_index &&
        runnerInfo.utmb_index.trim() !== '' &&
        runnerInfo.utmb_index !== '0' &&
        Number(runnerInfo.utmb_index) !== 0;

        const showMapButton = liveTrackingActivated === 1 && !!isFollowing;

    return (
        <View style={commonStyles.container}>
            <View style={[resultInfoStyles.card, { marginTop: 8 }]}>

                <View>
                    {runnerInfo?.profile_picture ? (
                        <Image
                            source={{ uri: getImageUrl(runnerInfo?.profile_picture) || undefined }}
                            cachePolicy="memory-disk"
                            style={resultInfoStyles.avatarCircle}
                        />
                    ) : (
                        <View style={resultInfoStyles.initials}>
                            <Text style={resultInfoStyles.initialsText}>
                                {initials}
                            </Text>
                        </View>
                    )}
                </View>

                <View style={resultInfoStyles.bibCard}>
                    <Text style={resultInfoStyles.checkpointName} numberOfLines={1}>{runnerInfo?.name ?? '—'}</Text>
                    <View style={[resultListStyle.flagRow, { marginTop: 8, marginBottom: 8 }]}>
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

                {/* <View style={resultInfoStyles.row}>
                    <View style={resultInfoStyles.col}>
                        <Text style={resultInfoStyles.rowLabel}>{t('runnerInfo.club')}</Text>
                        <Text style={resultInfoStyles.rowLabel}>
                            {runnerInfo?.club || '—'}
                        </Text>
                    </View>

                    <View style={resultInfoStyles.colDivider} />

                    <View style={resultInfoStyles.col}>
                        <Text style={resultInfoStyles.rowLabel}>{t('runnerInfo.category')}</Text>
                        <Text style={resultInfoStyles.rowValue}>
                            {runnerInfo?.category_name || '—'}
                        </Text>
                    </View>
                </View> */}

                <View style={resultInfoStyles.row}>
                    {showUtmbIndex && hasUtmbIndex && (
                        <>
                            <View style={resultInfoStyles.col}>
                                <View style={resultInfoStyles.utmbIndexBadge}>
                                    <Text style={resultInfoStyles.utmbText}>
                                        UTMB
                                    </Text>

                                    <View style={resultInfoStyles.utmbIndexTag}>
                                        <Text style={resultInfoStyles.utmbIndexText}>
                                            {t('runnerInfo.utmbIndex')}
                                        </Text>
                                    </View>
                                </View>

                                <Text style={resultInfoStyles.rowValue}>
                                    {runnerInfo.utmb_index}
                                </Text>
                            </View>

                            <View style={resultInfoStyles.colDivider} />
                        </>
                    )}
                    <View
                        style={[
                            resultInfoStyles.col,
                            { gap: 5 },
                            !showUtmbIndex && resultInfoStyles.singleColumn,
                        ]}
                    >
                        <Text style={resultInfoStyles.rowLabel}>
                            {t('runnerInfo.category')}
                        </Text>

                        <Text style={resultInfoStyles.rowValue}>
                            {runnerInfo?.category_name || '—'}
                        </Text>
                    </View>
                </View>
            </View>

            {!!raceInfo && (
                <View style={resultInfoStyles.card}>
                    <Text style={resultInfoStyles.sectionLabel}>{t('runnerInfo.thisRace')}</Text>

                    <View style={resultInfoStyles.bibCard}>
                        <Text style={resultInfoStyles.rowLabel}>{t('raceInfo.raceTime')}</Text>
                        <Text style={resultInfoStyles.rowValue}>{raceInfo.time || '—'}</Text>
                    </View>

                    <View style={resultInfoStyles.bibCard}>
                        <Text style={resultInfoStyles.rowLabel}>{t('raceInfo.scratchPosition')}</Text>
                        <Text style={resultInfoStyles.rowValue}>
                            {raceInfo.position
                                ? (raceInfo.position_total
                                    ? `${raceInfo.position} / ${raceInfo.position_total}`
                                    : raceInfo.position)
                                : '—'}
                        </Text>
                    </View>

                    {!!raceInfo.wave && (
                        <View style={resultInfoStyles.bibCard}>
                            <Text style={resultInfoStyles.rowLabel}>{t('raceInfo.wavelabel')}</Text>
                            <Text style={resultInfoStyles.rowValue}>{raceInfo.wave}</Text>
                        </View>
                    )}
                </View>
            )}

            {/* 28_RunnerInfo.png closes with a career card. It only exists for a
                runner linked to a Livio account - an unlinked bib has no history
                to count, and the API sends 0. Podiums stays a dash: finishing
                positions live in the partner results feed, not in our tables. */}
            {!!runnerInfo?.races && (
                <View style={resultInfoStyles.card}>
                    <Text style={resultInfoStyles.sectionLabel}>{t('runnerInfo.career')}</Text>

                    <View style={resultInfoStyles.bibCard}>
                        <Text style={resultInfoStyles.rowLabel}>{t('runnerInfo.races')}</Text>
                        <Text style={resultInfoStyles.rowValue}>{runnerInfo.races}</Text>
                    </View>

                    {!!runnerInfo.career_distance && (
                        <View style={resultInfoStyles.bibCard}>
                            <Text style={resultInfoStyles.rowLabel}>
                                {t('runnerInfo.totalDistance')}
                            </Text>
                            <Text style={resultInfoStyles.rowValue}>
                                {runnerInfo.career_distance} {t('units.km')}
                            </Text>
                        </View>
                    )}

                    <View style={resultInfoStyles.bibCard}>
                        <Text style={resultInfoStyles.rowLabel}>{t('runnerInfo.podiums')}</Text>
                        <Text style={resultInfoStyles.rowValue}>
                            {typeof runnerInfo.podiums === 'number' ? runnerInfo.podiums : '—'}
                        </Text>
                    </View>
                </View>
            )}

            <View>
                {showMapButton && (
                    <TouchableOpacity
                        style={resultInfoStyles.mapButton}
                        onPress={onMapPress}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="map-outline" size={18} color={palette.ink} />
                        <Text style={resultInfoStyles.mapButtonText}>
                            {t('runnerInfo.viewOnMap')}
                        </Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
};

export default RunnerInfoTab;