import React, { useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SvgUri } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { colors } from '../../styles/common.styles';
import { resultListStyle } from '../../styles/ResultList.styles';
import { favstyle } from '../../styles/favourite.style';
import { LiveTrackingBar } from '../../components/LiveTrackingBar';
import { FavouriteItem, FavouriteCheckpoint } from '../../services/favourites';
import { formatClockTime } from '../../utils/timeFormat';

const getStatusColors = (status: string) => {
    switch (status) {
        case 'in_progress':
            return { backgroundColor: colors.success, textColor: colors.white };
        case 'finished':
            return { backgroundColor: colors.participantColor, textColor: colors.white };
        case 'not_started':
        default:
            return { backgroundColor: colors.gray500, textColor: colors.white };
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

const truncateCheckpointName = (name: string, maxLength: number = 12): string => {
    if (!name) return '';
    if (name.length <= maxLength) return name;
    return name.substring(0, maxLength - 1).trim() + '.';
};

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

    const genderRank = isFemale && item.finish_rank_gender ? `F ${item.finish_rank_gender}` : null;

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

    return (     
            <View style={favstyle.card}>
                <View style={favstyle.headerBar}>
                    <View style={[favstyle.headerLeft, { backgroundColor: statusColors.backgroundColor }]}>
                        <Text style={[favstyle.headerText, { color: statusColors.textColor }]}>
                            {t(`resultdetails:status.${item.race_status}`)}
                        </Text>
                    </View>
                    <View style={[favstyle.diagLeft, { borderTopColor: statusColors.backgroundColor }]} />
                    <View style={favstyle.headerMiddle} />
                    <View style={favstyle.diagRight} />
                    <View style={favstyle.headerRight}>
                        <Text style={[favstyle.headerText, { color: colors.white }]}>
                            {item.distance_name}
                        </Text>
                    </View>
                </View>

                {/* ── Star + rank badge (interactive follow toggle) ── */}
                <TouchableOpacity
                    style={favstyle.cornerBadge}
                    onPress={handleStarPress}
                    activeOpacity={0.8}
                    disabled={isLoading}
                >
                    <Text style={isFollowed ? favstyle.cornerStar : favstyle.cornerStarUnfilled}>★</Text>
                    {/* Rank only when race has started; not_started → star only */}
                    {!isNotStarted && (overallRank !== '' || genderRank) && (
                        <View style={favstyle.cornerBadgeRight}>
                            {overallRank !== '' && <Text style={favstyle.cornerNum}>{overallRank}</Text>}
                            {genderRank && <Text style={favstyle.cornerGenderRank}>{genderRank}</Text>}
                        </View>
                    )}
                </TouchableOpacity>

                {/* ── Body (tap → ResultDetails) ── */}
                <TouchableOpacity onPress={handleCardPress} activeOpacity={0.7}>
                    <View style={favstyle.bodyRow}>
                        {/* Left: name + bib + flag/nation/age */}
                        <View style={favstyle.bodyLeft}>
                            <Text style={favstyle.runnerName} numberOfLines={1}>{fullName}</Text>

                            <Text style={favstyle.bibText}>
                                {t('allrace:race.bibNumber')} {item.bib_number}
                            </Text>

                            <View style={favstyle.nationRow}>
                                {item.nation_flag ? (
                                    <SvgUri uri={item.nation_flag} width={20} height={14} />
                                ) : null}
                                <Text style={favstyle.nationText} numberOfLines={1}>
                                    {[item.nation, item.age].filter(Boolean).join(' · ')}
                                </Text>
                            </View>

                            {isLive && (
                                <View style={{ marginTop: 6 }}>
                                    <LiveTrackingBar />
                                </View>
                            )}
                        </View>
                    </View>

                    {/* ── Separator ── */}
                    <View style={favstyle.separator} />

                    {/* ── Bottom stats: CP race time / ETA next / ETA finish (always when started) ── */}
                    {isNotStarted ? null : (
                        <View style={favstyle.statsRow}>
                            {/* Col 1: last crossed CP race time (green) */}
                            <View style={favstyle.statCol}>
                                <Text style={favstyle.statLabel} numberOfLines={2}>
                                    {lastCrossed
                                        ? `${truncateCheckpointName(lastCrossed.name)} (${t('allrace:race.raceTime')})`
                                        : t('allrace:race.raceTime')}
                                </Text>
                                <Text style={[favstyle.statVal, { color: lastCrossed?.race_time ? '#22C55E' : '#9CA3AF' }]}>
                                    {lastCrossed?.race_time || item.time || '-'}
                                </Text>
                            </View>

                            {/* Col 2: ETA next CP — once finished there's no next, show last crossed name only (no ETA prefix) */}
                            <View style={[favstyle.statCol, favstyle.statColMid]}>
                                <Text style={favstyle.statLabel} numberOfLines={2}>
                                    {nextCp
                                        ? `${t('allrace:race.eta')} ${truncateCheckpointName(nextCp.name)}`
                                        : lastCrossed
                                            ? truncateCheckpointName(lastCrossed.name)
                                            : t('allrace:race.eta')}
                                </Text>
                                <Text style={favstyle.statVal}>
                                    {formatClockTime(nextCp?.actual_time || lastCrossed?.actual_time) || '-'}
                                </Text>
                            </View>

                            {/* Col 3: Finish — 'FINISH' once crossed (actual time), else 'ETA FINISH' */}
                            <View style={favstyle.statCol}>
                                <Text style={favstyle.statLabel} numberOfLines={1}>
                                    {finishCp?.is_crossed ? t('allrace:race.finish') : t('allrace:race.etaFinish')}
                                </Text>
                                <Text style={favstyle.statVal}>
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
    prev.item.checkpoints === next.item.checkpoints
);