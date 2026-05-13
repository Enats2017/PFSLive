import React, { memo, useCallback } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SvgUri } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { resultListStyle } from '../../styles/ResultList.styles';
import { RaceResult } from '../../services/resultList';
import { LiveTrackingBar } from '../../components/LiveTrackingBar';
import { colors } from '../../styles/common.styles';

interface ResultCardLiveProps {
    item: RaceResult;
    product_app_id: number;
    isLoading: boolean;
    fromLive: 0 | 1;
    isFollowed: boolean;
    raceStatus: string;
    currentPovId: number;
    onToggleFollow: () => void;
    isWomen?: boolean;
    showUtmbIndex?: boolean;
}

const getActiveCheckpoints = (checkpoints: RaceResult['checkpoints']) => {
    if (!checkpoints || checkpoints.length === 0) return [];
    const crossedCheckpoints = checkpoints.filter(cp => cp.is_crossed === true);
    return crossedCheckpoints.slice(-2);
};

const truncateCheckpointName = (name: string, maxLength: number = 12): string => {
    if (!name) return '';
    if (name.length <= maxLength) return name;
    return name.substring(0, maxLength - 1).trim() + '.';
};

const ResultCardLive: React.FC<ResultCardLiveProps> = memo(({
    item,
    fromLive,
    isFollowed,
    isLoading,
    onToggleFollow,
    raceStatus,
    currentPovId,
    product_app_id,
    isWomen,
    showUtmbIndex,
}) => {
    const navigation = useNavigation<any>();
    const { t } = useTranslation(['allrace', 'common']);

    const isLive = item.live_tracking_activated === 1;
    const activeCheckpoints = getActiveCheckpoints(item.checkpoints);
    const isFemale = item.gender === 'female';

    // ✅ Gender rank only for female
    const genderRank = isFemale && item.finish_rank_gender
        ? `F ${item.finish_rank_gender}`
        : null;

    const handleCardPress = useCallback(() => {
        navigation.navigate('ResultDetails', {
            product_app_id,
            product_option_value_app_id: Number(currentPovId),
            bib: item.bib,
            raceStatus
        });
    }, [navigation, product_app_id, currentPovId, item.bib, raceStatus]);

    const handleStarPress = useCallback(() => {
        if (!isLoading) onToggleFollow();
    }, [isLoading, onToggleFollow]);

    return (
        <View style={[resultListStyle.cardWithLeftBorder, isWomen && { borderLeftColor: colors.pinkcolor }]}>

            {/* ✅ Badge: star left | overall rank top + gender rank bottom */}
            <TouchableOpacity
                style={[resultListStyle.cornerBadge, isWomen && { backgroundColor: colors.pinkcolor }]}
                onPress={handleStarPress}
                activeOpacity={0.8}
                disabled={isLoading}
            >
                <Text style={isFollowed ? resultListStyle.cornerStar : resultListStyle.cornerStarUnfilled}>
                    ★
                </Text>
                <View style={resultListStyle.cornerBadgeRight}>
                    <Text style={resultListStyle.cornerNum}>
                        {item.position.replace('.', '')}
                    </Text>
                    {genderRank && (
                        <Text style={resultListStyle.cornerGenderRank}>{genderRank}</Text>
                    )}
                </View>
            </TouchableOpacity>

            {/* Card Content */}
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
                    <View style={[
                        resultListStyle.statCol,
                        fromLive === 1 && activeCheckpoints.length === 0 && { alignItems: 'flex-start' },
                    ]}>
                        <Text style={resultListStyle.statLabel}>{t('allrace:race.time')}</Text>
                        <Text style={resultListStyle.statVal}>{item.time}</Text>
                    </View>

                    {fromLive === 0 ? (
                        <>
                            <View style={[resultListStyle.statCol, resultListStyle.statColMid]}>
                                <Text style={resultListStyle.statLabel}>{t('allrace:race.diffFirst')}</Text>
                                <Text style={resultListStyle.statVal}>{item.diff}</Text>
                            </View>
                            <View style={resultListStyle.statCol}>
                                <Text style={resultListStyle.statLabel}>
                                    {t('allrace:race.ranking')}{'\n'}{item.category_name}
                                </Text>
                                <Text style={resultListStyle.statVal}>{item.finish_rank_agegroup}</Text>
                            </View>
                        </>
                    ) : (
                        <>
                            {activeCheckpoints[0] && (
                                <View style={[
                                    resultListStyle.statCol,
                                    activeCheckpoints[1] ? resultListStyle.statColMid : resultListStyle.statColLeft,
                                ]}>
                                    <Text style={resultListStyle.statLabel} numberOfLines={1}>
                                        {truncateCheckpointName(activeCheckpoints[0].name)}
                                    </Text>
                                    <Text style={resultListStyle.statVal}>
                                        {activeCheckpoints[0].day_name
                                            ? t(`common:week.${activeCheckpoints[0].day_name.toLowerCase()}`)
                                            : '-'}
                                    </Text>
                                    <Text style={resultListStyle.statVal}>
                                        {activeCheckpoints[0].actual_time || '-'}
                                    </Text>
                                </View>
                            )}
                            {activeCheckpoints[1] && (
                                <View style={resultListStyle.statCol}>
                                    <Text style={resultListStyle.statLabel} numberOfLines={1}>
                                        {truncateCheckpointName(activeCheckpoints[1].name)}
                                    </Text>
                                    <Text style={resultListStyle.statVal}>
                                        {activeCheckpoints[1].day_name
                                            ? t(`common:week.${activeCheckpoints[1].day_name.toLowerCase()}`)
                                            : '-'}
                                    </Text>
                                    <Text style={resultListStyle.statVal}>
                                        {activeCheckpoints[1].actual_time || '-'}
                                    </Text>
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
    prev.item.live_tracking_activated === next.item.live_tracking_activated
);

ResultCardLive.displayName = 'ResultCardLive';
export default ResultCardLive;