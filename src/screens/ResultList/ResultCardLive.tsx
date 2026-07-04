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
    isCheckpointMode?: boolean;              // true when a checkpoint is selected in the dropdown
    selectedCheckpointIndex?: number | null; // index into the no-START checkpoints array
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
    
    console.log('idx3');
    console.log(idx3);

    const cp1 = idx1 !== null ? checkpoints[idx1] : null;
    const cp2 = idx2 !== null ? checkpoints[idx2] : null;
    const cp3 = idx3 !== null ? checkpoints[idx3] : null;

    console.log('cp3');
    console.log(cp3);

    const displayGenderRank =
    cp1?.rank_agegroup || item.finish_rank_gender;

  const genderRank =
    isFemale && /^\d+$/.test(displayGenderRank ?? "")
        ? `F ${displayGenderRank}`
        : null;

    const badgeNumber = isCheckpointMode
        ? (cp1?.is_crossed ? (cp1?.ranking || '-') : '-')
        : item.position.replace('.', '');

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

    const renderCpColumn = (cp: RaceResult['checkpoints'][number] | null, style?: any) => (
        <View style={[resultListStyle.statCol, style]}>
            <Text style={resultListStyle.statLabel} numberOfLines={2}>
                {cp ? truncateCheckpointName(cp.name) : '-'}
            </Text>
            <Text style={[
                resultListStyle.statVal,
                { color: cp?.is_crossed ? '#000' : '#9CA3AF' }
            ]}>
                {cp?.race_time || '-'}
            </Text>
        </View>
    );

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
                <Text style={isFollowed ? resultListStyle.cornerStar : resultListStyle.cornerStarUnfilled}>
                    ★
                </Text>
                <View style={resultListStyle.cornerBadgeRight}>
                    <Text style={resultListStyle.cornerNum}>
                        {badgeNumber}
                    </Text>
                    {genderRank && (
                        <Text style={resultListStyle.cornerGenderRank}> {genderRank}</Text>
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

                {isLive && !isCheckpointMode && (
                    <View style={{ marginTop: 6 }}>
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
                            <Text style={[resultListStyle.statVal, { color: lastCrossed?.race_time ? '#22C55E' : '#9CA3AF' }]}>
                                {lastCrossed?.race_time || item.time || '-'}
                            </Text>
                        </View>
                    )}

                    {fromLive === 0 ? (
                        isCheckpointMode ? (
                            <View style={[resultListStyle.statCol, resultListStyle.statColLeft]}>
                                <Text style={resultListStyle.statLabel}>
                                    {t('allrace:race.ranking')}{'\n'}{cp1 ? truncateCheckpointName(cp1.name) : ''}
                                </Text>
                                <Text style={resultListStyle.statVal}>
                                    {cp1?.is_crossed ? (cp1?.ranking || '-') : '-'}
                                </Text>
                            </View>
                        ) : (
                            <View style={[resultListStyle.statCol, resultListStyle.statColLeft]}>
                                <Text style={resultListStyle.statLabel}>
                                    {t('allrace:race.ranking')}{'\n'}{item.category_name}
                                </Text>
                                <Text style={resultListStyle.statVal}>{item.finish_rank_agegroup}</Text>
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
    prev.selectedCheckpointIndex === next.selectedCheckpointIndex
);

ResultCardLive.displayName = 'ResultCardLive';
export default ResultCardLive;