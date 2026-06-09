import React, { memo, useCallback } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SvgUri } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { resultListStyle } from '../../styles/ResultList.styles';
import { RaceResult } from '../../services/resultList';
import { LiveTrackingBar } from '../../components/LiveTrackingBar';
import { colors } from '../../styles/common.styles';
import { formatClockTime } from '../../utils/timeFormat';

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

// ✅ Returns { lastCrossed, nextCp, finishCp } for the live stats row
// lastCrossed — most recently crossed checkpoint (race_time = elapsed)
// nextCp      — first not-yet-crossed checkpoint (actual_time = ETA)
// finishCp    — last checkpoint in array (always finish, actual_time = ETA finish)
const getLiveStats = (checkpoints: RaceResult['checkpoints']) => {
    if (!checkpoints || checkpoints.length === 0) {
        return { lastCrossed: null, nextCp: null, finishCp: null };
    }
    const crossed = checkpoints.filter(cp => cp.is_crossed === true);
    const notCrossed = checkpoints.filter(cp => cp.is_crossed === false);
    const lastCrossed = crossed.length > 0 ? crossed[crossed.length - 1] : null;
    const nextCp = notCrossed.length > 0 ? notCrossed[0] : null;
    // ✅ Finish is always the last checkpoint regardless of is_crossed
    const finishCp = checkpoints[checkpoints.length - 1];
    return { lastCrossed, nextCp, finishCp };
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
    const hasFinished = item.status === 'finished';
    console.log("11111finshed", hasFinished);

    const isFemale = item.gender === 'female';
    // ✅ Live stats for bottom row: last crossed CP, next CP ETA, finish ETA
    const { lastCrossed, nextCp, finishCp } = getLiveStats(item.checkpoints);

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
                style={[
                    resultListStyle.cornerBadge,
                    isWomen
                        ? { backgroundColor: colors.pinkcolor }  
                        : hasFinished
                            ? { backgroundColor: colors.themeiColor } 
                            : null, 
                ]}
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

                {/* ✅ Flag + country + age row */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                    {item.nation_flag ? (
                        <SvgUri
                            uri={item.nation_flag}
                            width={20}
                            height={14}
                        />
                    ) : null}
                    <Text style={resultListStyle.teamText} numberOfLines={1}>
                        {[item.club, item.nation, item.age].filter(Boolean).join(' · ')}
                    </Text>
                </View>

                {isLive && (
                    <View style={{ marginTop: 6 }}>
                        <LiveTrackingBar />
                    </View>
                )}

                <View style={resultListStyle.statsRow}>
                    <View style={[
                        resultListStyle.statCol,
                        fromLive === 1 && !lastCrossed && { alignItems: 'flex-start' },
                    ]}>
                        {/* ✅ Col 1: Last crossed CP race time (green) — always shown */}
                        <Text style={resultListStyle.statLabel} numberOfLines={2}>
                            {lastCrossed
                                ? `${truncateCheckpointName(lastCrossed.name)} (${t('allrace:race.raceTime')})`
                                : t('allrace:race.raceTime')}
                        </Text>
                        <Text style={[resultListStyle.statVal, { color: lastCrossed?.race_time ? '#22C55E' : '#9CA3AF' }]}>
                            {lastCrossed?.race_time || item.time || '-'}
                        </Text>
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
                            {/* ✅ Col 2: Next CP ETA — if race finished (no next), show lastCrossed name only (no ETA prefix) */}
                            <View style={[resultListStyle.statCol, resultListStyle.statColMid]}>
                                <Text style={resultListStyle.statLabel} numberOfLines={2}>
                                    {nextCp
                                        ? `${t('allrace:race.eta')} ${truncateCheckpointName(nextCp.name)}`
                                        : lastCrossed
                                            ? truncateCheckpointName(lastCrossed.name)
                                            : t('allrace:race.eta')}
                                </Text>
                                <Text style={resultListStyle.statVal}>
                                    {formatClockTime(nextCp?.actual_time || lastCrossed?.actual_time) || '-'}
                                </Text>
                            </View>

                            {/* ✅ Col 3: Finish — 'FINISH' once crossed (actual time), else 'ETA FINISH' */}
                            <View style={resultListStyle.statCol}>
                                <Text style={resultListStyle.statLabel} numberOfLines={1}>
                                    {finishCp?.is_crossed ? t('allrace:race.finish') : t('allrace:race.etaFinish')}
                                </Text>
                                <Text style={resultListStyle.statVal}>
                                    {formatClockTime(finishCp?.actual_time) || '-'}
                                </Text>
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
    prev.item.live_tracking_activated === next.item.live_tracking_activated &&
    // ✅ Re-render when checkpoints change — live stats depend on them
    prev.item.status === next.item.status &&
    prev.item.checkpoints === next.item.checkpoints
);

ResultCardLive.displayName = 'ResultCardLive';
export default ResultCardLive;