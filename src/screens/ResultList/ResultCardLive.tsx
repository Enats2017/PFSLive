import React, { memo, useCallback } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SvgUri } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { resultListStyle } from '../../styles/ResultList.styles';
import { RaceResult } from '../../services/resultList';
import { LiveTrackingBar } from '../../components/LiveTrackingBar';
import { palette, categoryColors, fonts, space } from '../../styles/common.styles';
import { formatClockTime } from '../../utils/timeFormat';
import { analyticsService } from '../../services/analyticsService';
import { ANALYTICS_BUTTONS, ANALYTICS_PARAMS } from '../../constants/analyticsScreens';

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
    isCheckpointMode?: boolean;              // true when a checkpoint is selected in the dropdown
    selectedCheckpointIndex?: number | null; // index into the no-START checkpoints array
    analyticsScreenName: string;
}

const getActiveCheckpoints = (checkpoints: RaceResult['checkpoints']) => {
    if (!checkpoints || checkpoints.length === 0) return [];
    const crossedCheckpoints = checkpoints.filter(cp => cp.is_crossed === true);
    return crossedCheckpoints.slice(-2);
};

const getLiveStats = (checkpoints: RaceResult['checkpoints']) => {
    if (!checkpoints || checkpoints.length === 0) {
        return { lastCrossed: null, nextCp: null, finishCp: null };
    }
    const crossed = checkpoints.filter(cp => cp.is_crossed === true);
    const notCrossed = checkpoints.filter(cp => cp.is_crossed === false);
    const lastCrossed = crossed.length > 0 ? crossed[crossed.length - 1] : null;
    const nextCp = notCrossed.length > 0 ? notCrossed[0] : null;
    const finishCp = checkpoints[checkpoints.length - 1];
    return { lastCrossed, nextCp, finishCp };
};

const getDisplayCheckpoints = (cps: RaceResult['checkpoints']) =>
    (cps ?? []).filter(cp => !cp.is_start);

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
    isCheckpointMode = false,
    selectedCheckpointIndex = null,
    analyticsScreenName,
}) => {
    const navigation = useNavigation<any>();
    const { t } = useTranslation(['allrace', 'common']);

    const isLive = item.live_tracking_activated === 1;
    const activeCheckpoints = getActiveCheckpoints(item.checkpoints);
    const hasFinished = item.status === 'finished';

    const isFemale = item.gender === 'female';
    const { lastCrossed, nextCp, finishCp } = getLiveStats(item.checkpoints);
    const checkpoints = item.checkpoints ?? [];
    const lastIdx = Math.max(checkpoints.length - 1, 0);
    const idx1 = isCheckpointMode && selectedCheckpointIndex !== null ? Math.min(selectedCheckpointIndex, lastIdx): null;
    const idx2 = idx1 !== null ? Math.min(idx1 + 1, lastIdx) : null;
    
    // cp3 = the FINISH checkpoint (is_finish is true only on the last one), so the
    // third column always shows finish data. Falls back to the last checkpoint if
    // none is flagged. Only shown when the finish is genuinely beyond cp2, so it
    // doesn't duplicate cp2 near the end of the course.
    const finishIdx = (() => {
        if (checkpoints.length === 0) return null;
        const fi = checkpoints.findIndex(cp => cp.is_finish === true);
        return fi >= 0 ? fi : lastIdx;
    })();
    const idx3 = (finishIdx !== null) ? finishIdx : null;
    
    const cp1 = idx1 !== null ? checkpoints[idx1] : null;
    const cp2 = idx2 !== null ? checkpoints[idx2] : null;
    const cp3 = idx3 !== null ? checkpoints[idx3] : null;

    const displayGenderRank = item.finish_rank_gender;

  const genderRank =
    isFemale && /^\d+$/.test(displayGenderRank ?? "")
        ? `F ${displayGenderRank}`
        : null;

    const badgeNumber = item.position.replace('.', '');

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

    const hasUtmbIndex = showUtmbIndex &&
        item.utmb_index &&
        item.utmb_index.trim() !== '' &&
        item.utmb_index !== '0' &&
        Number(item.utmb_index) !== 0;

    const handleStarPress = useCallback(() => {
        if (!isLoading) onToggleFollow();
    }, [isLoading, onToggleFollow]);

    const renderCpColumn = (cp: RaceResult['checkpoints'][number] | null, style?: any) => (
        <View style={[resultListStyle.statCol, style]}>
            <Text style={resultListStyle.statLabel} numberOfLines={2}>
                {cp ? truncateCheckpointName(cp.name) : '-'}
            </Text>
            <Text style={[
                resultListStyle.statVal,
                { color: cp?.is_crossed ? palette.ink : palette.placeholder }
            ]}>
                {cp?.race_time || '-'}
            </Text>
        </View>
    );

    return (
        <View style={[resultListStyle.cardWithLeftBorder, isWomen && { borderLeftColor: categoryColors.women }]}>

            {/* Row head — rank circle, identity, follow star. */}
            <View style={resultListStyle.rowHead}>
                <View style={[resultListStyle.rankCircle, hasFinished && resultListStyle.rankCircleFinished]}>
                    <Text style={[resultListStyle.rankText, hasFinished && resultListStyle.rankTextFinished]}>
                        {badgeNumber || '-'}
                    </Text>
                </View>
                <View style={resultListStyle.cardTop}>
                    <Text style={resultListStyle.cardName} numberOfLines={1}>{item.name}</Text>
                    {/* The flag and age were part of this row before the redesign and
                        are kept: the deck's example runner simply had neither. */}
                    <View style={resultListStyle.metaLine}>
                        {!!item.nation_flag && (
                            <SvgUri uri={item.nation_flag} width={18} height={13} />
                        )}
                        <Text style={resultListStyle.bibText} numberOfLines={1}>
                            {[`${t('allrace:race.bibNumber')} ${item.bib}`, item.club, item.nation, item.age,
                              item.wave ? `${t('allrace:race.wavelabel')} ${item.wave}` : null]
                                .filter(Boolean).join(' \u00b7 ')}
                        </Text>
                    </View>
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

                {hasUtmbIndex && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: space.md }}>
                        <View style={resultListStyle.utmbBadge}>
                        <Text style={resultListStyle.utmbBadgeTextTop}>UTMB</Text>
                        <Text style={resultListStyle.utmbBadgeTextBottom}>Index</Text>
                        </View>
                        <Text style={[resultListStyle.utmbValue, { fontFamily: fonts.body,
        fontSize: 15 }]}>{item.utmb_index}</Text>
                    </View>
                )}

                {isLive && !isCheckpointMode && (
                    <View style={{ marginTop: 8 }}>
                        <LiveTrackingBar />
                    </View>
                )}

                <View style={resultListStyle.statsRow}>
                    {isCheckpointMode ? (
                        renderCpColumn(cp1, fromLive === 1 && !cp1?.is_crossed ? { alignItems: 'flex-start' } : undefined)
                    ) : (
                        <View style={[
                            resultListStyle.statCol,
                            fromLive === 1 && !lastCrossed && { alignItems: 'flex-start' },
                        ]}>
                            <Text style={resultListStyle.statLabel} numberOfLines={2}>
                                {lastCrossed
                                    ? `${truncateCheckpointName(lastCrossed.name)} (${t('allrace:race.raceTime')})`
                                    : t('allrace:race.raceTime')}
                            </Text>
                            <Text style={[resultListStyle.statVal, { color: lastCrossed?.race_time ? palette.lime : palette.placeholder }]}>
                                {lastCrossed?.race_time || item.time || '-'}
                            </Text>
                        </View>
                    )}

                    {fromLive === 0 ? (
                        isCheckpointMode ? (
                            <View style={[resultListStyle.statCol, resultListStyle.statColLeft]}>
                                <Text style={resultListStyle.statLabel} numberOfLines={2}>
                                    {[t('allrace:race.ranking'), cp1 ? truncateCheckpointName(cp1.name) : '']
                                        .filter(Boolean).join(' ')}
                                </Text>
                                <Text style={resultListStyle.statVal}>
                                    {cp1?.is_crossed ? (cp1?.ranking || '-') : '-'}
                                </Text>
                            </View>
                        ) : (
                            <View style={[resultListStyle.statCol, resultListStyle.statColLeft]}>
                                <Text style={resultListStyle.statLabel} numberOfLines={2}>
                                    {[t('allrace:race.ranking'), item.category_name]
                                        .filter(Boolean).join(' ')}
                                </Text>
                                <Text style={resultListStyle.statVal}>
                                    {[item.finish_rank_agegroup, genderRank].filter(Boolean).join(' · ')}
                                </Text>
                            </View>
                        )
                    ) : isCheckpointMode ? (
                        <>
                            {renderCpColumn(cp2, resultListStyle.statColMid)}
                            {/* {renderCpColumn(cp3)} */}
                            <View style={resultListStyle.statCol}>
                                <Text style={resultListStyle.statLabel} numberOfLines={1}>
                                    {finishCp?.is_crossed ? t('allrace:race.finish') : t('allrace:race.etaFinish')}
                                </Text>
                                <Text style={resultListStyle.statVal}>
                                    {formatClockTime(finishCp?.actual_time) || '-'}
                                </Text>
                            </View>
                        </>
                    ) : (
                        <>
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
    prev.item.status === next.item.status &&
    prev.item.checkpoints === next.item.checkpoints &&
    prev.isCheckpointMode === next.isCheckpointMode &&
    prev.selectedCheckpointIndex === next.selectedCheckpointIndex && 
    prev.showUtmbIndex === next.showUtmbIndex &&
    prev.item.utmb_index === next.item.utmb_index
);

ResultCardLive.displayName = 'ResultCardLive';
export default ResultCardLive;