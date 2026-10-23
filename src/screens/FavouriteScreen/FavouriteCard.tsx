import React, { useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SvgUri } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { palette } from '../../styles/common.styles';
import { resultListStyle } from '../../styles/ResultList.styles';
import { favstyle } from '../../styles/favourite.style';
import { LiveTrackingBar } from '../../components/LiveTrackingBar';
import { FavouriteItem, FavouriteCheckpoint } from '../../services/favourites';
import { formatClockTime } from '../../utils/timeFormat';
import { isNarrowWidth } from '../../utils/screenFit';

const getStatusColors = (status: string) => {
    switch (status) {
        // Green = finished, red = still out on course. These were inverted.
        case 'in_progress':
            return { backgroundColor: palette.danger, textColor: palette.surface };
        case 'finished':
            return { backgroundColor: palette.lime, textColor: palette.surface };
        case 'not_started':
        default:
            return { backgroundColor: palette.textMuted, textColor: palette.surface };
    }
};

// ✅ Identical logic to ResultCardLive.getLiveStats
// lastCrossed — most recently crossed checkpoint (race_time = elapsed)
// nextCp      — first not-yet-crossed checkpoint (actual_time = ETA)
// finishCp    — last checkpoint in array (always finish, actual_time = ETA finish)
const getLiveStats = (checkpoints: FavouriteCheckpoint[] | undefined) => {
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

// The whole checkpoint name, as on ResultCardLive. The 11-character hard cut
// ("Checkpoint 10" → "Checkpoint.", "Kilometer 21,1" → "Kilometer 2.") read
// as a different checkpoint; the labels wrap to 3 lines instead.
const truncateCheckpointName = (name: string): string => (name ? name.trim() : '');

interface FavouriteCardProps {
    item: FavouriteItem;
    product_app_id: number;
    isFollowed: boolean;
    isLoading: boolean;
    onToggleFollow: () => void;
}

const FavouriteCard: React.FC<FavouriteCardProps> = ({
    item,
    product_app_id,
    isFollowed,
    isLoading,
    onToggleFollow,
}) => {
    const { t } = useTranslation(['favourite', 'common', 'resultdetails', 'allrace']);
    const navigation = useNavigation<any>();
    // Below 360pt the status chip moves under the name: beside it, "PAS
    // COMMENCÉ" / "NIET GESTART" (~110-120pt with padding) left the name ~55pt
    // and "Jean-Christophe" broke mid-word.
    const narrow = isNarrowWidth(useWindowDimensions().width);

    const fullName = useMemo(
        () => (item.name && item.name.trim() !== ''
            ? item.name
            : `${item.firstname} ${item.lastname}`.trim()),
        [item.name, item.firstname, item.lastname]
    );

    const statusColors = useMemo(() => getStatusColors(item.race_status), [item.race_status]);

    const isLive = item.live_tracking_activated === 1;
    const isFemale = item.gender === 'female';
    const isNotStarted = item.race_status === 'not_started';

    const { lastCrossed, nextCp, finishCp } = useMemo(
        () => getLiveStats(item.checkpoints),
        [item.checkpoints]
    );

    const overallRank = useMemo(
        () => (item.position ? item.position.replace('.', '') : ''),
        [item.position]
    );

    // ✅ Gender rank only for female, and only when it's a numeric rank (hide "DNF" etc.)
    const genderRank = isFemale && /^\d+$/.test(item.finish_rank_gender ?? '')
        ? `F ${item.finish_rank_gender}`
        : null;

    const handleCardPress = useCallback(() => {
        navigation.navigate('ResultDetails', {
            raceStatus: item.race_status,
            product_app_id,
            product_option_value_app_id: item.product_option_value_app_id,
            bib: item.bib_number,
            from_live: 0,
        });
    }, [navigation, item.race_status, item.product_option_value_app_id, item.bib_number, product_app_id]);

    const handleStarPress = useCallback(() => {
        if (!isLoading) onToggleFollow();
    }, [isLoading, onToggleFollow]);

    const statusChip = (
        <View style={[favstyle.headerLeft, narrow && favstyle.headerLeftUnderName, { backgroundColor: statusColors.backgroundColor }]}>
            <Text style={[favstyle.headerText, { color: statusColors.textColor }]}>
                {t(`resultdetails:status.${item.race_status}`)}
            </Text>
        </View>
    );

    return (
            <View style={favstyle.card}>
                {/* ── Identity row: avatar, name, bib · distance, status ── */}
                <TouchableOpacity onPress={handleCardPress} activeOpacity={0.7}>
                    <View style={favstyle.identityRow}>
                        <View style={favstyle.cardAvatar}>
                            <Text style={favstyle.cardAvatarText}>
                                {(fullName || '?').split(/\s+/).filter(Boolean)
                                    .slice(0, 2).map((n) => n[0]).join('').toUpperCase() || '?'}
                            </Text>
                        </View>
                        <View style={favstyle.identityText}>
                            {/* Long names wrap rather than truncate (review request). */}
                            <Text style={favstyle.runnerName} numberOfLines={2}>{fullName}</Text>
                            {/* Two lines so nothing is hidden. The first is the
                                deck's line (25_Favourites.png: "Bib 640 · 80 km");
                                the second carries the nationality and age the app
                                shows on top of it. Squeezed onto one line these
                                needed ~180pt in a 149pt column, so the country and
                                age were always cut off. */}
                            <Text style={[favstyle.nationText, favstyle.metaLine]} numberOfLines={2}>
                                {[`${t('allrace:race.bibNumber')} ${item.bib_number}`,
                                  item.distance_name]
                                    .filter(Boolean).join(' · ')}
                            </Text>

                            <View style={favstyle.nationRow}>
                                {item.nation_flag ? (
                                    <SvgUri uri={item.nation_flag} width={18} height={13} />
                                ) : null}
                                <Text style={favstyle.nationText} numberOfLines={1}>
                                    {[item.nation,
                                      item.age ? `${t('allrace:race.age')} ${item.age}` : null]
                                        .filter(Boolean).join(' · ')}
                                </Text>
                            </View>
                            {narrow ? statusChip : null}
                        </View>

                        {/* Status and the star/rank stack, so the pair costs the
                            row the width of the wider one rather than both. */}
                        <View style={favstyle.identityMeta}>
                            {narrow ? null : statusChip}

                            {/* ── Star + rank badge (interactive follow toggle) ── */}
                            <TouchableOpacity
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                style={favstyle.cornerBadge}
                                onPress={handleStarPress}
                                activeOpacity={0.8}
                                disabled={isLoading}
                            >
                                <Ionicons
                                    name={isFollowed ? 'star' : 'star-outline'}
                                    size={26}
                                    color={isFollowed ? palette.lime : palette.placeholder}
                                />
                                {/* Rank only when race has started; not_started → star only */}
                                {!isNotStarted && (overallRank !== '' || genderRank) && (
                                    <View style={favstyle.cornerBadgeRight}>
                                        {overallRank !== '' && <Text style={favstyle.cornerNum}>{overallRank}</Text>}
                                        {genderRank && <Text style={favstyle.cornerGenderRank}>{genderRank}</Text>}
                                    </View>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>

                    {isLive && (
                        <View style={{ marginTop: 8 }}>
                            <LiveTrackingBar />
                        </View>
                    )}
                    {/* ── Separator ── (only above the stats row: before the race
                        it was a rule over ~32pt of empty card) */}
                    {!isNotStarted && <View style={favstyle.separator} />}

                    {/* ── Bottom stats: CP race time / ETA next / ETA finish (always when started) ── */}
                    {/* Labels 3 lines (was 2): "<checkpoint> (TEMPS DE COURSE)" needs 3
                        in fr. favstyle.statCol's space-between + statLabel minHeight
                        keep the three values on one baseline. */}
                    {isNotStarted ? null : (
                        <View style={favstyle.statsRow}>
                            {/* Col 1: last crossed CP race time (green) */}
                            <View style={favstyle.statCol}>
                                <Text style={favstyle.statLabel} maxFontSizeMultiplier={1} numberOfLines={3}>
                                    {lastCrossed
                                        ? `${truncateCheckpointName(lastCrossed.name)} (${t('allrace:race.raceTime')})`
                                        : t('allrace:race.raceTime')}
                                </Text>
                                <Text style={[favstyle.statVal, { color: lastCrossed?.race_time ? palette.lime : palette.placeholder }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
                                    {lastCrossed?.race_time || item.time || '-'}
                                </Text>
                            </View>

                            {/* Col 2: ETA next CP — once finished there's no next, show last crossed name only (no ETA prefix) */}
                            <View style={[favstyle.statCol, favstyle.statColMid]}>
                                <Text style={favstyle.statLabel} maxFontSizeMultiplier={1} numberOfLines={3}>
                                    {nextCp
                                        ? `${t('allrace:race.eta')} ${truncateCheckpointName(nextCp.name)}`
                                        : lastCrossed
                                            ? truncateCheckpointName(lastCrossed.name)
                                            : t('allrace:race.eta')}
                                </Text>
                                <Text style={favstyle.statVal} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
                                    {formatClockTime(nextCp?.actual_time || lastCrossed?.actual_time) || '-'}
                                </Text>
                            </View>

                            {/* Col 3: Finish — 'FINISH' once crossed (actual time), else 'ETA FINISH' */}
                            <View style={favstyle.statCol}>
                                <Text style={favstyle.statLabel} maxFontSizeMultiplier={1} numberOfLines={3}>
                                    {finishCp?.is_crossed ? t('allrace:race.finish') : t('allrace:race.etaFinish')}
                                </Text>
                                <Text style={favstyle.statVal} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
                                    {formatClockTime(finishCp?.actual_time) || '-'}
                                </Text>
                            </View>
                        </View>
                    )}
                </TouchableOpacity>
            </View>       
    );
};

export default React.memo(FavouriteCard, (prev, next) =>
    prev.item.bib_number === next.item.bib_number &&
    prev.item.position === next.item.position &&
    prev.item.race_status === next.item.race_status &&
    prev.item.live_tracking_activated === next.item.live_tracking_activated &&
    prev.isFollowed === next.isFollowed &&
    prev.isLoading === next.isLoading &&
    prev.item.checkpoints === next.item.checkpoints &&
    // identity text — stale after a refresh without these
    prev.item.name === next.item.name &&
    prev.item.time === next.item.time &&
    prev.item.finish_rank_gender === next.item.finish_rank_gender
);