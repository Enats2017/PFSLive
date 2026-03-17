import React, { memo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SvgUri } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { resultListStyle } from '../../styles/ResultList.styles';
import { RaceResult } from '../../services/resultList';
import { LiveTrackingBar } from '../../components/LiveTrackingBar';

interface ResultCardLiveProps {
    item: RaceResult;
    isLoading: boolean;
    fromLive: 0 | 1;
    isFollowed: boolean;
    raceStatus: string;
    currentPovId: number;
    onToggleFollow: () => void;
    product_app_id: number;
}

const getActiveCheckpoints = (checkpoints: RaceResult['checkpoints']) =>
    checkpoints
        ?.filter(cp => cp.ranking && cp.ranking.trim() !== '')
        .slice(-2) ?? [];

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
    const canFollow = item.customer_app_id !== null && item.customer_app_id > 0;
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
            {/* CORNER RANK AND FOLLOW STAR */}
            <View style={resultListStyle.cornerWrap} pointerEvents="box-none">
                <View style={resultListStyle.cornerTriangle} />
                <Text style={resultListStyle.cornerNum}>
                    {item.category_rank || item.position.replace('.', '')}
                </Text>
                {canFollow && (
                    <TouchableOpacity
                        style={resultListStyle.cornerStarBtn}
                        onPress={onToggleFollow}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        disabled={isLoading}
                    >
                        <Text style={resultListStyle.cornerStar}>
                            {isFollowed ? '★' : '☆'}
                        </Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* PARTICIPANT NAME */}
            <View style={resultListStyle.cardTop}>
                <View style={resultListStyle.cardTopLeft}>
                    <Text style={resultListStyle.cardName}>{item.name}</Text>
                </View>
                <View style={{ width: 64 }} />
            </View>

            {/* BIB NUMBER */}
            <Text style={resultListStyle.bibText}>
                {t('allrace:race.bibNumber')} {item.bib}
            </Text>

            {/* CLUB AND NATION */}
            <Text style={resultListStyle.teamText} numberOfLines={1}>
                {[item.club, item.nation].filter(Boolean).join(' · ')}
            </Text>

            {/* LIVE TRACKING BAR */}
            {isLive && (
                <View style={{ marginTop: 6 }}>
                    <LiveTrackingBar />
                </View>
            )}

            {/* STATS ROW */}
            <View style={resultListStyle.statsRow}>
                {/* TIME */}
                <View style={resultListStyle.statCol}>
                    <Text style={resultListStyle.statLabel}>
                        {t('allrace:race.time')}
                    </Text>
                    <Text style={resultListStyle.statVal}>{item.time}</Text>
                </View>

                {fromLive === 0 ? (
                    <>
                        {/* DIFF FIRST */}
                        <View style={[resultListStyle.statCol, resultListStyle.statColMid]}>
                            <Text style={resultListStyle.statLabel}>
                                {t('allrace:race.diffFirst')}
                            </Text>
                            <Text style={resultListStyle.statVal}>{item.diff}</Text>
                        </View>
                        {/* RANKING */}
                        <View style={resultListStyle.statCol}>
                            <Text style={resultListStyle.statLabel}>
                                {t('allrace:race.ranking')}{'\n'}{item.category_name}
                            </Text>
                            <Text style={resultListStyle.statVal}>{item.category_rank}</Text>
                        </View>
                    </>
                ) : (
                    <>
                        {/* CHECKPOINTS */}
                        {activeCheckpoints[0] && (
                            <View style={[resultListStyle.statCol, resultListStyle.statColMid]}>
                                <Text style={resultListStyle.statLabel}>
                                    {activeCheckpoints[0].name}
                                </Text>
                                <Text style={resultListStyle.statVal}>
                                    {activeCheckpoints[0]?.day_name
                                        ? t(`common:week.${activeCheckpoints[0].day_name.toLowerCase()}`)
                                        : '-'
                                    }
                                </Text>
                                <Text style={resultListStyle.statVal}>
                                    {activeCheckpoints[0].actual_time}
                                </Text>
                            </View>
                        )}
                        {activeCheckpoints[1] && (
                            <View style={resultListStyle.statCol}>
                                <Text style={resultListStyle.statLabel}>
                                    {activeCheckpoints[1].name}
                                </Text>
                                <Text style={resultListStyle.statVal}>
                                    {activeCheckpoints[1]?.day_name
                                        ? t(`common:week.${activeCheckpoints[1].day_name.toLowerCase()}`)
                                        : '-'
                                    }
                                </Text>
                                <Text style={resultListStyle.statVal}>
                                    {activeCheckpoints[1].actual_time}
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