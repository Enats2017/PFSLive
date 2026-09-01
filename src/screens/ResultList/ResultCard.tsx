import React, { memo, useCallback } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SvgUri } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { resultListStyle } from '../../styles/ResultList.styles';
import { RaceResult } from '../../services/resultList';
import { LiveTrackingBar } from '../../components/LiveTrackingBar';
import { palette, categoryColors } from '../../styles/common.styles';
import { FilterOption } from '../../components/FilterDropdown';
import { analyticsService } from '../../services/analyticsService';
import { ANALYTICS_BUTTONS, ANALYTICS_PARAMS } from '../../constants/analyticsScreens';

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
    analyticsScreenName: string;
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
    analyticsScreenName,
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
    const displayDiff = item.position === '1'? '-': item.diff || '-';

    const selectedCp = selectedCheckpoint
    ? item.checkpoints?.[Number(selectedCheckpoint.value)]
    : null;

    const displayPosition = item.position || "-";

    const displayAgeGroupRank = item.finish_rank_agegroup || "-";

    const displayFinishGenderRank = item.finish_rank_gender;

   const genderRank =
    isFemale && /^\d+$/.test(displayFinishGenderRank ?? "")
        ? `F ${displayFinishGenderRank}`
        : null;

    const displayRankingLabel =
    selectedCp?.name || item.category_name;

    const handleCardPress = useCallback(() => {
       analyticsService.logInteraction(
            analyticsScreenName,
            ANALYTICS_BUTTONS.PARTICIPANT_PROFILE,
            'tap',
            { [ANALYTICS_PARAMS.BIB_NUMBER]: item.bib },
        );

        // ADD
        void analyticsService.markAsFollowerActive('view_result');
        
        navigation.navigate('ResultDetails', {
            product_app_id,
            product_option_value_app_id: Number(currentPovId),
            bib: item.bib,
            raceStatus
        });
    }, [navigation, product_app_id, currentPovId, item.bib, raceStatus, analyticsScreenName]);

    const handleStarPress = useCallback(() => {
        if (!isLoading) onToggleFollow();
    }, [isLoading, onToggleFollow]);


    return (
        <View style={[resultListStyle.cardWithLeftBorder, isWomen && { borderLeftColor: categoryColors.women }]}>

            {/* Row head — rank circle, identity, follow star. */}
            <View style={resultListStyle.rowHead}>
                <View style={[resultListStyle.rankCircle, hasFinished && resultListStyle.rankCircleFinished]}>
                    {/* 26_ResultList.png puts ONE number in the circle. The gender
                        rank used to be stacked underneath it inside 34px — two
                        ranks in one circle, and only on women's rows, so rows
                        disagreed with each other. It now sits in the ranking
                        column below, where it has a label. */}
                    <Text style={[resultListStyle.rankText, hasFinished && resultListStyle.rankTextFinished]}>
                        {displayPosition || '-'}
                    </Text>
                </View>
                <View style={resultListStyle.cardTop}>
                    <Text style={resultListStyle.cardName} numberOfLines={1}>{item.name}</Text>
                    <Text style={resultListStyle.bibText} numberOfLines={1}>
                        {[`${t('allrace:race.bibNumber')} ${item.bib}`, item.club, item.nation,
                          item.wave ? `${t('allrace:race.wavelabel')} ${item.wave}` : null]
                            .filter(Boolean).join(' \u00b7 ')}
                    </Text>
                </View>
                <TouchableOpacity
                    onPress={handleStarPress}
                    disabled={isLoading}
                    activeOpacity={0.7}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    accessibilityRole="button"
                    accessibilityLabel={isFollowed ? 'Unfollow athlete' : 'Follow athlete'}
                >
                    <Ionicons
                        name={isFollowed ? 'star' : 'star-outline'}
                        size={26}
                        color={isFollowed ? palette.lime : palette.placeholder}
                    />
                </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={handleCardPress} activeOpacity={0.7}>

                {isLive && (
                    <View style={{ marginTop: 8 }}>
                        <LiveTrackingBar />
                    </View>
                )}

                <View style={resultListStyle.statsRow}>
                    <View style={resultListStyle.statCol}>
                        <Text style={resultListStyle.statLabel}>{t('allrace:race.raceTime')}</Text>
                        <Text style={resultListStyle.statVal}>{item.time || "-"}</Text>
                    </View>

                    {fromLive === 0 ? (
                        <>
                            <View style={[resultListStyle.statCol, resultListStyle.statColMid]}>
                                <Text style={resultListStyle.statLabel}>{t('allrace:race.diffFirst')}</Text>
                                <Text style={resultListStyle.statVal}> {item.position === 'DNF' ? '-' : displayDiff}</Text>
                            </View>
                            <View style={resultListStyle.statCol}>
                                {/* One label, wrapped naturally — the hard \n made this
                                    column two lines tall while its neighbours were one,
                                    so its value sat lower than theirs. */}
                                <Text style={resultListStyle.statLabel} numberOfLines={2}>
                                    {[t('allrace:race.ranking'), displayRankingLabel]
                                        .filter(Boolean).join(' ')}
                                </Text>
                                {/* The women's gender rank used to be stacked inside the
                                    rank circle. It belongs here, where it has a label. */}
                                <Text style={resultListStyle.statVal}>
                                    {[displayAgeGroupRank, genderRank].filter(Boolean).join(' · ')}
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
                            {showUtmbIndex && (
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
                            )}
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