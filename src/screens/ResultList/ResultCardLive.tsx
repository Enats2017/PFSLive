import React, { memo, useCallback } from 'react';
import { View, Text, TouchableOpacity, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SvgUri } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { resultListStyle } from '../../styles/ResultList.styles';
import { isNarrowWidth } from '../../utils/screenFit';
import { formatWave } from '../../utils/waveLabel';
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
    /** Analytics only — race attribution for the tap logged here. */
    analyticsRaceName: string;
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

// The whole checkpoint name. This used to hard-cut it to 11 characters + "."
// ("Checkpoint 10" → "Checkpoint.", "Kilometer 21,1" → "Kilometer 2."), which
// read as a different checkpoint. The labels wrap to 3 lines instead and
// numberOfLines ellipsizes anything longer.
const truncateCheckpointName = (name: string): string => (name ? name.trim() : '');

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
    analyticsRaceName,
}) => {
    const navigation = useNavigation<any>();
    const { t } = useTranslation(['allrace', 'common']);
    // compact spacing below 360pt — re-renders on rotation / Display Zoom despite memo
    const narrow = isNarrowWidth(useWindowDimensions().width);

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
            {
                [ANALYTICS_PARAMS.BIB_NUMBER]: item.bib,
                [ANALYTICS_PARAMS.EVENT_NAME]: analyticsRaceName,
            },
        );

        // ADD
        void analyticsService.markAsFollowerActive('view_result');

        navigation.navigate('ResultDetails', {
            product_app_id,
            product_option_value_app_id: Number(currentPovId),
            bib: item.bib,
            raceStatus
        });
    }, [navigation, product_app_id, currentPovId, item.bib, raceStatus, analyticsScreenName, analyticsRaceName]);

    const hasUtmbIndex = showUtmbIndex &&
        item.utmb_index &&
        item.utmb_index.trim() !== '' &&
        item.utmb_index !== '0' &&
        Number(item.utmb_index) !== 0;

    const handleStarPress = useCallback(() => {
        if (!isLoading) onToggleFollow();
    }, [isLoading, onToggleFollow]);

    // Every stat label on this card: 3 lines (was 2). "<checkpoint> (TEMPS DE
    // COURSE)" needs 3 in a ~85pt column in fr, so "COURSE" was lost; statCol's
    // space-between keeps the values on one baseline.
    const renderCpColumn = (cp: RaceResult['checkpoints'][number] | null, style?: any) => (
        <View style={[resultListStyle.statCol, style]}>
            <Text style={resultListStyle.statLabel} maxFontSizeMultiplier={1} numberOfLines={3}>
                {cp ? truncateCheckpointName(cp.name) : '-'}
            </Text>
            <Text style={[
                resultListStyle.statVal,
                { color: cp?.is_crossed ? palette.ink : palette.placeholder }
            ]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
                {cp?.race_time || '-'}
            </Text>
        </View>
    );

    // Finished: the middle column repeated the finish (last point = FIN, same
    // time of day as the FINISH column). It shows the gender rank instead
    // (client 2026-10-22). No usable gender rank → the old column.
    const finishedGenderRank = finishCp?.is_crossed && !nextCp && /^\d+$/.test(item.finish_rank_gender ?? '')
        ? item.finish_rank_gender
        : null;
    const genderWord = item.gender === 'female'
        ? t('common:gender.women')
        : item.gender === 'male' ? t('common:gender.men') : '';

    return (
        // The whole card opens the athlete. Only the stats strip under the
        // identity used to, so a tap on the name or rank did nothing and it
        // "sometimes took several taps" (client 2026-10-22). The star is a
        // nested touchable and keeps its own press.
        <TouchableOpacity
            style={[resultListStyle.cardWithLeftBorder, narrow && resultListStyle.cardNarrow, isWomen && { backgroundColor: categoryColors.womenSurface }]}
            onPress={handleCardPress}
            activeOpacity={0.7}
        >

            {/* Row head — rank circle, identity, follow star. */}
            <View style={resultListStyle.rowHead}>
                <View style={[resultListStyle.rankCircle, hasFinished && resultListStyle.rankCircleFinished]}>
                    <Text style={[resultListStyle.rankText, hasFinished && resultListStyle.rankTextFinished]}>
                        {badgeNumber || '-'}
                    </Text>
                </View>
                <View style={resultListStyle.cardTop}>
                    {/* 2 lines (was 1): a long name / team name in the ~160-200pt
                        column at 320pt was cut to "…". */}
                    <Text style={resultListStyle.cardName} numberOfLines={2}>{item.name}</Text>
                    {/* The flag and age were part of this row before the redesign and
                        are kept: the deck's example runner simply had neither. */}
                    {/* Two lines. Five values on one clamped line needed ~306pt
                        in a 234pt column, so the club, country and age were cut
                        off on every row that had them. Line 1 is the race entry
                        (always visible), line 2 is who the athlete is. */}
                    <Text style={resultListStyle.bibText} numberOfLines={2}>
                        {`${t('allrace:race.bibNumber')} ${item.bib}`}
                    </Text>
                    {/* Wave gets its own row. Joined onto the bib line it ran to
                        41-54 characters ("Bib number 201 - Start Wave 1: Start @ 9h",
                        longer in fr) and numberOfLines={1} truncated it mid-word in
                        this column. Empty on the many events with no wave column. */}
                    {item.wave ? (
                        <Text style={resultListStyle.bibTextTight} numberOfLines={2}>
                            {formatWave(t('allrace:race.wavelabel'), item.wave)}
                        </Text>
                    ) : null}
                    <View style={resultListStyle.metaLineTight}>
                        {!!item.nation_flag && (
                            <SvgUri uri={item.nation_flag} width={18} height={13} />
                        )}
                        {/* 2 lines (was 1): club · country · age lost the country
                            and age behind a long club name */}
                        <Text style={resultListStyle.bibTextTight} numberOfLines={2}>
                            {[item.club, item.nation,
                              item.age ? `${t('allrace:race.age')} ${item.age}` : null]
                                .filter(Boolean).join(' \u00b7 ')}
                        </Text>
                    </View>
                    {/* Duo teams: `item.name` above is the TEAM name; these are the two
                        members. A SIBLING of the flag row above, never a child of it —
                        metaLineTight is flexDirection:'row', so nesting would put the
                        member names on the same line as the flag. Empty for solo. */}
                    {item.name_participant_1 ? (
                        <Text style={resultListStyle.bibTextTight} numberOfLines={2}>
                            {[item.name_participant_1, item.name_participant_2].filter(Boolean).join(' & ')}
                        </Text>
                    ) : null}
                    {hasUtmbIndex ? (
                        <View style={resultListStyle.utmbInline}>
                            <View style={[resultListStyle.utmbBadge, resultListStyle.utmbBadgeCompact]}>
                                <Text style={resultListStyle.utmbBadgeTextTop}>UTMB</Text>
                                <Text style={resultListStyle.utmbBadgeTextBottom}>{t('allrace:race.utmbIndex')}</Text>
                            </View>
                            <Text style={resultListStyle.utmbInlineValue}>{item.utmb_index}</Text>
                        </View>
                    ) : null}
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
                <Ionicons name="chevron-forward" size={18} color={palette.placeholder} style={resultListStyle.cardChevron} />
            </View>

            <View>

                {isLive && !isCheckpointMode && (
                    <View style={{ marginTop: 8 }}>
                        <LiveTrackingBar />
                    </View>
                )}

                <View style={[
                    resultListStyle.statsRow,
                    narrow && resultListStyle.statsRowNarrow,
                    isWomen && { borderTopColor: categoryColors.womenDivider },
                ]}>
                    {isCheckpointMode ? (
                        renderCpColumn(cp1, fromLive === 1 && !cp1?.is_crossed ? { alignItems: 'flex-start' } : undefined)
                    ) : (
                        <View style={[
                            resultListStyle.statCol,
                            fromLive === 1 && !lastCrossed && { alignItems: 'flex-start' },
                        ]}>
                            <Text style={resultListStyle.statLabel} maxFontSizeMultiplier={1} numberOfLines={3}>
                                {lastCrossed
                                    ? `${truncateCheckpointName(lastCrossed.name)} (${t('allrace:race.raceTime')})`
                                    : t('allrace:race.raceTime')}
                            </Text>
                            <Text style={[resultListStyle.statVal, { color: lastCrossed?.race_time ? palette.lime : palette.placeholder }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
                                {lastCrossed?.race_time || item.time || '-'}
                            </Text>
                        </View>
                    )}

                    {fromLive === 0 ? (
                        isCheckpointMode ? (
                            <View style={[resultListStyle.statCol, resultListStyle.statColLeft]}>
                                <Text style={resultListStyle.statLabel} maxFontSizeMultiplier={1} numberOfLines={3}>
                                    {[t('allrace:race.ranking'), cp1 ? truncateCheckpointName(cp1.name) : '']
                                        .filter(Boolean).join(' ')}
                                </Text>
                                <Text style={resultListStyle.statVal} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
                                    {cp1?.is_crossed ? (cp1?.ranking || '-') : '-'}
                                </Text>
                            </View>
                        ) : (
                            <View style={[resultListStyle.statCol, resultListStyle.statColLeft]}>
                                <Text style={resultListStyle.statLabel} maxFontSizeMultiplier={1} numberOfLines={3}>
                                    {[t('allrace:race.ranking'), item.category_name]
                                        .filter(Boolean).join(' ')}
                                </Text>
                                <Text style={resultListStyle.statVal} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
                                    {[item.finish_rank_agegroup, genderRank].filter(Boolean).join(' · ')}
                                </Text>
                            </View>
                        )
                    ) : isCheckpointMode ? (
                        <>
                            {renderCpColumn(cp2, resultListStyle.statColMid)}
                            {/* {renderCpColumn(cp3)} */}
                            <View style={resultListStyle.statCol}>
                                <Text style={resultListStyle.statLabel} maxFontSizeMultiplier={1} numberOfLines={3}>
                                    {finishCp?.is_crossed ? t('allrace:race.finish') : t('allrace:race.etaFinish')}
                                </Text>
                                <Text style={resultListStyle.statVal} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
                                    {formatClockTime(finishCp?.actual_time) || '-'}
                                </Text>
                            </View>
                        </>
                    ) : (
                        <>
                            {finishedGenderRank ? (
                                <View style={[resultListStyle.statCol, resultListStyle.statColMid]}>
                                    <Text style={resultListStyle.statLabel} maxFontSizeMultiplier={1} numberOfLines={3}>
                                        {[t('allrace:race.rank'), genderWord].filter(Boolean).join(' ')}
                                    </Text>
                                    <Text style={resultListStyle.statVal} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>{finishedGenderRank}</Text>
                                </View>
                            ) : (
                            <View style={[resultListStyle.statCol, resultListStyle.statColMid]}>
                                <Text style={resultListStyle.statLabel} maxFontSizeMultiplier={1} numberOfLines={3}>
                                    {nextCp
                                        ? `${t('allrace:race.eta')} ${truncateCheckpointName(nextCp.name)}`
                                        : lastCrossed
                                            ? truncateCheckpointName(lastCrossed.name)
                                            : t('allrace:race.eta')}
                                </Text>
                                <Text style={resultListStyle.statVal} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
                                    {formatClockTime(nextCp?.actual_time || lastCrossed?.actual_time) || '-'}
                                </Text>
                            </View>
                            )}

                            <View style={resultListStyle.statCol}>
                                <Text style={resultListStyle.statLabel} maxFontSizeMultiplier={1} numberOfLines={3}>
                                    {finishCp?.is_crossed ? t('allrace:race.finish') : t('allrace:race.etaFinish')}
                                </Text>
                                <Text style={resultListStyle.statVal} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
                                    {formatClockTime(finishCp?.actual_time) || '-'}
                                </Text>
                            </View>
                        </>
                    )}
                </View>
            </View>
        </TouchableOpacity>
    );
}, (prev, next) =>
    prev.fromLive === next.fromLive &&
    prev.item.bib === next.item.bib &&
    // Without this the card never repaints when the Women filter is toggled.
    prev.isWomen === next.isWomen &&
    prev.isFollowed === next.isFollowed &&
    prev.isLoading === next.isLoading &&
    prev.item.position === next.item.position &&
    prev.item.live_tracking_activated === next.item.live_tracking_activated &&
    prev.item.status === next.item.status &&
    prev.item.finish_rank_gender === next.item.finish_rank_gender &&
    prev.item.checkpoints === next.item.checkpoints &&
    prev.isCheckpointMode === next.isCheckpointMode &&
    prev.selectedCheckpointIndex === next.selectedCheckpointIndex && 
    prev.showUtmbIndex === next.showUtmbIndex &&
    prev.item.utmb_index === next.item.utmb_index &&
    // identity text — stale after a refresh without these
    prev.item.name === next.item.name &&
    prev.item.club === next.item.club &&
    prev.item.category_name === next.item.category_name &&
    prev.item.time === next.item.time &&
    prev.item.finish_rank_agegroup === next.item.finish_rank_agegroup
);

ResultCardLive.displayName = 'ResultCardLive';
export default ResultCardLive;