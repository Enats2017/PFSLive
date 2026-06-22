import React, { memo, useCallback } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SvgUri } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { resultListStyle } from '../../styles/ResultList.styles';
import { RaceResult } from '../../services/resultList';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../../styles/common.styles';
import { LiveTrackingBar } from '../../components/LiveTrackingBar';

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
    isWomen
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
            style={[resultListStyle.cardWithLeftBorder, isWomen && { borderLeftColor: colors.pinkcolor }]}
            onPress={handlePress}
        >
            {/* ✅ Badge: star only — no position before race */}
            <TouchableOpacity
                style={[resultListStyle.cornerBadge, isWomen && { backgroundColor: colors.pinkcolor }]}
                onPress={handleStarPress}
                activeOpacity={0.8}
                disabled={isLoading}
            >
                <Text style={isFollowed ? resultListStyle.cornerStar : resultListStyle.cornerStarUnfilled}>
                    ★
                </Text>
            </TouchableOpacity>

            {/* Card Content */}
            <View>
                <View style={resultListStyle.cardTop}>
                    <View style={resultListStyle.cardTopLeft}>
                        <Text style={resultListStyle.cardName}>{item.name}</Text>
                    </View>
                    <View style={{ width: 60 }} />
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
                </View>
            </View>
        </TouchableOpacity>
    );
},
(prev, next) =>
    prev.item.bib === next.item.bib &&
    prev.isFollowed === next.isFollowed &&
    prev.isLoading === next.isLoading &&
    prev.item.utmb_index === next.item.utmb_index &&
    prev.item.club === next.item.club &&
    prev.item.nation === next.item.nation &&
    prev.showUtmbIndex === next.showUtmbIndex
);

ResultCardBeforeRace.displayName = 'ResultCardBeforeRace';
export default ResultCardBeforeRace;