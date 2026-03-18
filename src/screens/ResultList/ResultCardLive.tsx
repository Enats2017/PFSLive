import React, { memo } from 'react';
import { View, Text, TouchableOpacity, TouchableWithoutFeedback } from 'react-native';
import { SvgUri } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { resultListStyle } from '../../styles/ResultList.styles';
import { RaceResult } from '../../services/resultList';
import { LiveTrackingBar } from '../../components/LiveTrackingBar';

interface ResultCardLiveProps {
    item: RaceResult;
    product_app_id: number; // ✅ ALREADY EXISTS
    isLoading: boolean;
    fromLive: 0 | 1;
    isFollowed: boolean;
    raceStatus: string;
    currentPovId: number;
    onToggleFollow: () => void;
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
    product_app_id
}) => {
    const navigation = useNavigation<any>();
    const { t } = useTranslation(['allrace', 'common']);

    const isLive = item.live_tracking_activated === 1;
    // ✅ REMOVED: canFollow check
    const activeCheckpoints = getActiveCheckpoints(item.checkpoints);

    const handlePress = () => {
        navigation.navigate('ResultDetails', {
            product_app_id,
            product_option_value_app_id: Number(currentPovId),
            bib: item.bib,
            raceStatus
        });
    };

    return (
        <TouchableOpacity
            style={resultListStyle.cardWithLeftBorder}
            onPress={handlePress}
            activeOpacity={0.7}
        >
            {/* ✅ ALWAYS SHOW STAR */}
            <View style={resultListStyle.cornerWrap} pointerEvents="box-none">
                <View style={resultListStyle.cornerTriangle} pointerEvents="none" />
                <Text style={resultListStyle.cornerNum} pointerEvents="none">
                    {item.position.replace('.', '')}
                </Text>
                <TouchableWithoutFeedback
                    onPress={(e) => {
                        e?.preventDefault?.();
                        e?.stopPropagation?.();
                        if (!isLoading) {
                            onToggleFollow();
                        }
                    }}
                    disabled={isLoading}
                >
                    <View style={resultListStyle.cornerStarBtn}>
                        <Text style={isFollowed ? resultListStyle.cornerStar : resultListStyle.cornerStarUnfilled}>
                            {isFollowed ? '★' : '☆'}
                        </Text>
                    </View>
                </TouchableWithoutFeedback>
            </View>

            <View style={resultListStyle.cardTop}>
                <View style={resultListStyle.cardTopLeft}>
                    <Text style={resultListStyle.cardName}>{item.name}</Text>
                </View>
                <View style={{ width: 72 }} />
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
                    <Text style={resultListStyle.statLabel}>
                        {t('allrace:race.time')}
                    </Text>
                    <Text style={resultListStyle.statVal}>{item.time}</Text>
                </View>

                {fromLive === 0 ? (
                    <>
                        <View style={[resultListStyle.statCol, resultListStyle.statColMid]}>
                            <Text style={resultListStyle.statLabel}>
                                {t('allrace:race.diffFirst')}
                            </Text>
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
                            <View style={[resultListStyle.statCol, resultListStyle.statColMid]}>
                                <Text style={resultListStyle.statLabel} numberOfLines={1}>
                                    {truncateCheckpointName(activeCheckpoints[0].name)}
                                </Text>
                                <Text style={resultListStyle.statVal}>
                                    {activeCheckpoints[0].day_name
                                        ? t(`common:week.${activeCheckpoints[0].day_name.toLowerCase()}`)
                                        : '-'
                                    }
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
                                        : '-'
                                    }
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
    );
}, (prev, next) =>
    prev.fromLive === next.fromLive &&
    prev.item.bib === next.item.bib &&
    prev.isFollowed === next.isFollowed &&
    prev.item.position === next.item.position &&
    prev.item.live_tracking_activated === next.item.live_tracking_activated
);

ResultCardLive.displayName = 'ResultCardLive';

export default ResultCardLive;