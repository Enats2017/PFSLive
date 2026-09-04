import React, { memo, useCallback } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SvgUri } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { resultListStyle } from '../../styles/ResultList.styles';
import { RaceResult } from '../../services/resultList';
import { useNavigation } from '@react-navigation/native';
import { categoryColors, palette } from '../../styles/common.styles';
import { LiveTrackingBar } from '../../components/LiveTrackingBar';
import { analyticsService } from '../../services/analyticsService';
import { ANALYTICS_BUTTONS, ANALYTICS_PARAMS } from '../../constants/analyticsScreens';

interface ResultCardBeforeRaceProps {
    item: RaceResult;
    product_app_id: number;
    isLoading: boolean;
    isFollowed: boolean;
    onToggleFollow: () => void;
    showUtmbIndex: boolean;
    raceStatus: string;
    currentPovId: number;
    isWomen?: boolean;
    analyticsScreenName: string;
}

const ResultCardBeforeRace: React.FC<ResultCardBeforeRaceProps> = memo(({
    item,
    product_app_id,
    isFollowed,
    isLoading,
    onToggleFollow,
    showUtmbIndex,
    raceStatus,
    currentPovId,
    isWomen,
    analyticsScreenName,
}) => {
    const { t } = useTranslation(['allrace', 'common']);
    const navigation = useNavigation<any>();

    const isLive = item.live_tracking_activated === 1;

    const hasUtmbIndex = showUtmbIndex &&
        item.utmb_index &&
        item.utmb_index.trim() !== '' &&
        item.utmb_index !== '0' &&
        Number(item.utmb_index) !== 0;

    const handlePress = () => {
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
    };

    const handleStarPress = useCallback(() => {
        if (!isLoading) onToggleFollow();
    }, [isLoading, onToggleFollow]);

    return (
        <TouchableOpacity
            style={[resultListStyle.cardWithLeftBorder, isWomen && { backgroundColor: categoryColors.womenSurface }]}
            onPress={handlePress}
        >
            {/* Row head — bib circle, identity, follow star. Matches
                ResultCard / ResultCardLive; before the race there is no
                position, so the circle carries the bib. */}
            <View style={resultListStyle.rowHead}>
                <View style={[resultListStyle.rankCircle, isWomen && { backgroundColor: categoryColors.women }]}>
                    <Text style={resultListStyle.rankText}>{item.bib || '-'}</Text>
                </View>
                <View style={resultListStyle.cardTop}>
                    <Text style={resultListStyle.cardName} numberOfLines={1}>{item.name}</Text>
                    {/* Two lines. Five values on one clamped line needed ~306pt
                        in a 234pt column, so the club, country and age were cut
                        off on every row that had them. Line 1 is the race entry
                        (always visible), line 2 is who the athlete is. */}
                    <Text style={resultListStyle.bibText} numberOfLines={1}>
                        {[`${t('allrace:race.bibNumber')} ${item.bib}`,
                          item.wave ? `${t('allrace:race.wavelabel')} ${item.wave}` : null]
                            .filter(Boolean).join(' \u00b7 ')}
                    </Text>
                    <View style={resultListStyle.metaLineTight}>
                        {!!item.nation_flag && (
                            <SvgUri uri={item.nation_flag} width={18} height={13} />
                        )}
                        <Text style={resultListStyle.bibTextTight} numberOfLines={1}>
                            {[item.club, item.nation,
                              item.age ? `${t('allrace:race.age')} ${item.age}` : null]
                                .filter(Boolean).join(' \u00b7 ')}
                        </Text>
                    </View>
                </View>
                <TouchableOpacity
                    onPress={handleStarPress}
                    activeOpacity={0.7}
                    disabled={isLoading}
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

            <View>
                <View style={resultListStyle.metaBlock}>
                    {item.wave ? (
                        <Text style={resultListStyle.waveText} numberOfLines={1}>
                            {t('allrace:race.wavelabel')}: {item.wave}
                        </Text>
                    ) : null}
                </View>

                {isLive && (
                    <View style={{ marginTop: 8 }}>
                        <LiveTrackingBar />
                    </View>
                )}

                <View style={[
                    resultListStyle.statsRow,
                    isWomen && { borderTopColor: categoryColors.womenDivider },
                ]}>
                    {showUtmbIndex && (
                        <View style={resultListStyle.statCol}>
                            {hasUtmbIndex ? (
                                <View style={resultListStyle.beforeRaceLeftHalf}>
                                    <View style={resultListStyle.utmbSection}>
                                        <View style={resultListStyle.utmbBadge}>
                                            <Text style={resultListStyle.utmbBadgeTextTop}>UTMB</Text>
                                            <Text style={resultListStyle.utmbBadgeTextBottom}>
                                                {t('allrace:race.utmbIndex')}
                                            </Text>
                                        </View>
                                        <Text style={resultListStyle.utmbValue}>{item.utmb_index}</Text>
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
                                        <Text style={resultListStyle.statLabel}>—</Text>
                                    </View>
                                </View>
                            )}
                        </View>
                    )}

                    <View style={[
                        resultListStyle.statCol,
                        showUtmbIndex ? resultListStyle.statFlagMid : resultListStyle.statFlagFullNoBorder,
                    ]}>
                        <View style={resultListStyle.flagRow}>
                            {!!item.nation_flag && (
                                <SvgUri width={28} height={20} uri={item.nation_flag} />
                            )}
                            <Text style={resultListStyle.statVal} numberOfLines={2}>
                                {item.nation || '—'}
                            </Text>
                        </View>
                    </View>
                </View>
            </View>
        </TouchableOpacity>
    );
},
(prev, next) =>
    prev.item.bib === next.item.bib &&
    // Without this the card never repaints when the Women filter is toggled.
    prev.isWomen === next.isWomen &&
    prev.isFollowed === next.isFollowed &&
    prev.isLoading === next.isLoading &&
    prev.item.utmb_index === next.item.utmb_index &&
    prev.item.club === next.item.club &&
    prev.item.nation === next.item.nation &&
    prev.showUtmbIndex === next.showUtmbIndex
);

ResultCardBeforeRace.displayName = 'ResultCardBeforeRace';
export default ResultCardBeforeRace;