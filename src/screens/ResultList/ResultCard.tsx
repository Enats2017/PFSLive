import React, { memo, useCallback } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SvgUri } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { resultListStyle } from '../../styles/ResultList.styles';
import { RaceResult } from '../../services/resultList';
import { LiveTrackingBar } from '../../components/LiveTrackingBar';
import { colors } from '../../styles/common.styles';
import { FilterOption } from '../../components/FilterDropdown';

interface ResultCardProps {
    item: RaceResult;
    isLoading: boolean;
    fromLive: 0 | 1;
    raceStatus: string;
    isFollowed: boolean;
    onToggleFollow: () => void;
    product_app_id: number;
    currentPovId: number;
    isWomen?: boolean;
    showUtmbIndex: boolean;
    selectedCheckpoint?: FilterOption | null;
}

const ResultCard: React.FC<ResultCardProps> = memo(({
    item,
    fromLive,
    isFollowed,
    isLoading,
    raceStatus,
    currentPovId,
    product_app_id,
    onToggleFollow,
    isWomen,
    showUtmbIndex,
    selectedCheckpoint,
}) => {
    const navigation = useNavigation<any>();
    const { t } = useTranslation(['allrace', 'common']);

    const hasUtmbIndex = showUtmbIndex &&
        item.utmb_index &&
        item.utmb_index.trim() !== '' &&
        item.utmb_index !== '0' &&
        Number(item.utmb_index) !== 0;

    const isLive = item.live_tracking_activated === 1;
    const isFemale = item.gender === 'female';
    const hasFinished = item.status === 'finished';
    const displayDiff = item.diff;

    const selectedCp = selectedCheckpoint
    ? item.checkpoints?.[Number(selectedCheckpoint.value)]
    : null;

    const displayPosition =
    selectedCp?.ranking || item.position || "-";

    const displayAgeGroupRank =
    selectedCp?.rank_agegroup || item.finish_rank_agegroup || "-";

    const displayFinishGenderRank =
    selectedCp?.rank_agegroup || item.finish_rank_gender;

   const genderRank =
    isFemale && /^\d+$/.test(displayFinishGenderRank ?? "")
        ? `F ${displayFinishGenderRank}`
        : null;

    const displayRankingLabel =
    selectedCp?.name || item.category_name;

    const handleCardPress = useCallback(() => {
        navigation.navigate('ResultDetails', {
            product_app_id,
            product_option_value_app_id: Number(currentPovId),
            bib: item.bib,
            raceStatus
        });
    }, [navigation, item.customer_app_id]);

    const handleStarPress = useCallback(() => {
        if (!isLoading) onToggleFollow();
    }, [isLoading, onToggleFollow]);


    return (
        <View style={[resultListStyle.cardWithLeftBorder, isWomen && { borderLeftColor: colors.pinkcolor }]}>

            <TouchableOpacity
                style={[
                    resultListStyle.cornerBadge,
                    isWomen
                        ? { backgroundColor: colors.pinkcolor }
                        : hasFinished
                            ? { backgroundColor: "#028A77" }
                            : null,
                ]}
                onPress={handleStarPress}
                activeOpacity={0.8}
                disabled={isLoading}
            >
                <Text style={[isFollowed ? resultListStyle.cornerStar : resultListStyle.cornerStarUnfilled]}>
                    ★
                </Text>
                <View style={resultListStyle.cornerBadgeRight}>
                    <Text style={resultListStyle.cornerNum}>
                         {displayPosition || "-"}
                    </Text>
                    {genderRank && (
                        <Text style={resultListStyle.cornerGenderRank}>{genderRank}</Text>
                    )}
                </View>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleCardPress} activeOpacity={0.7}>
                <View style={resultListStyle.cardTop}>
                    <View style={resultListStyle.cardTopLeft}>
                        <Text style={resultListStyle.cardName}>{item.name}</Text>
                    </View>
                    <View style={{ width: 100 }} />
                </View>

                <Text style={resultListStyle.bibText}>
                    {t('allrace:race.bibNumber')} {item.bib}
                </Text>

                <Text style={resultListStyle.teamText} numberOfLines={1}>
                    {[item.club, item.nation].filter(Boolean).join(' · ')}
                </Text>

                {isLive && (
                    <View style={{ marginTop: 6 }}>
                        <LiveTrackingBar />
                    </View>
                )}

                <View style={resultListStyle.statsRow}>
                    <View style={resultListStyle.statCol}>
                        <Text style={resultListStyle.statLabel}>{t('allrace:race.time')}</Text>
                        <Text style={resultListStyle.statVal}>{item.time || "-"}</Text>
                    </View>

                    {fromLive === 0 ? (
                        <>
                            <View style={[resultListStyle.statCol, resultListStyle.statColMid]}>
                                <Text style={resultListStyle.statLabel}>{t('allrace:race.diffFirst')}</Text>
                                <Text style={resultListStyle.statVal}> {item.position === 'DNF' ? '-' : displayDiff}</Text>
                            </View>
                            <View style={resultListStyle.statCol}>
                                <Text style={resultListStyle.statLabel}>
                                    {t('allrace:race.ranking')}{'\n'}{displayRankingLabel}
                                </Text>
                                <Text style={resultListStyle.statVal}>
                                    <Text style={resultListStyle.statVal}>
                                       {displayAgeGroupRank}
                                    </Text>
                                </Text>
                            </View>
                        </>
                    ) : (
                        <>
                            <View style={[resultListStyle.statCol, resultListStyle.statFlagMid]}>
                                <View style={resultListStyle.flagRow}>
                                    {item.nation_flag && (
                                        <SvgUri width={28} height={20} uri={item.nation_flag} />
                                    )}
                                    <Text style={resultListStyle.statVal} numberOfLines={2}>
                                        {item.nation || '—'}
                                    </Text>
                                </View>
                            </View>
                            <View style={[resultListStyle.statCol, resultListStyle.statFlagMid]}>
                                {hasUtmbIndex ? (
                                    <View style={resultListStyle.beforeRaceLeftHalf}>
                                        <View style={resultListStyle.utmbSection}>
                                            <View style={resultListStyle.utmbBadge}>
                                                <Text style={resultListStyle.utmbBadgeTextTop}>UTMB</Text>
                                                <Text style={resultListStyle.utmbBadgeTextBottom}>
                                                    {t('allrace:race.utmbIndex')}
                                                </Text>
                                            </View>
                                            <Text style={resultListStyle.statVal}>{item.utmb_index}</Text>
                                        </View>
                                    </View>
                                ) : (
                                    <View style={resultListStyle.beforeRaceLeftHalf}>
                                        <View style={resultListStyle.utmbSection}>
                                            <View style={resultListStyle.utmbBadge}>
                                                <Text style={resultListStyle.utmbBadgeTextTop}>UTMB</Text>
                                                <Text style={resultListStyle.utmbBadgeTextBottom}>
                                                    {t('allrace:race.utmbIndex')}
                                                </Text>
                                            </View>
                                            <Text style={resultListStyle.statLabel}>-</Text>
                                        </View>
                                    </View>
                                )}
                            </View>
                        </>
                    )}
                </View>
            </TouchableOpacity>
        </View>
    );
}, (prev, next) =>
    prev.fromLive === next.fromLive &&
    prev.item.bib === next.item.bib &&
    prev.isFollowed === next.isFollowed &&
    prev.isLoading === next.isLoading &&
    prev.item.position === next.item.position &&
    prev.item.time === next.item.time &&
    prev.item.diff === next.item.diff &&
    prev.item.finish_rank_agegroup === next.item.finish_rank_agegroup &&
    prev.item.live_tracking_activated === next.item.live_tracking_activated &&
    prev.selectedCheckpoint?.value === next.selectedCheckpoint?.value
);

ResultCard.displayName = 'ResultCard';
export default ResultCard;