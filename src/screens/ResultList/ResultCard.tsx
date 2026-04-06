import React, { memo, useCallback } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SvgUri } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { resultListStyle } from '../../styles/ResultList.styles';
import { RaceResult } from '../../services/resultList';
import { LiveTrackingBar } from '../../components/LiveTrackingBar';

interface ResultCardProps {
    item: RaceResult;
    isLoading: boolean;
    fromLive: 0 | 1;
    raceStatus:string,
    isFollowed: boolean;
    onToggleFollow: () => void;
    product_app_id: number;
    currentPovId: number;
}

const ResultCard: React.FC<ResultCardProps> = memo(({
    item,
    fromLive,
    isFollowed,
    isLoading,
     raceStatus,
    currentPovId,
    product_app_id,
    onToggleFollow
}) => {
    const navigation = useNavigation<any>();
    const { t } = useTranslation(['allrace', 'common']);

    const isLive = item.live_tracking_activated === 1;

    const handleCardPress = useCallback(() => {
        navigation.navigate('ResultDetails', {
            product_app_id,
            product_option_value_app_id: Number(currentPovId),
            bib: item.bib,
            raceStatus
        });
    }, [navigation, item.customer_app_id]);

    const handleStarPress = useCallback(() => {
        if (!isLoading) {
            onToggleFollow();
        }
    }, [isLoading, onToggleFollow]);

    return (
        <View style={resultListStyle.cardWithLeftBorder}>
            {/* Star Zone - Absolute Positioned */}
            <View 
                style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    width: 72,
                    height: 72,
                    zIndex: 999,
                }}
            >
                <View style={resultListStyle.cornerTriangle} pointerEvents="none" />
                <Text style={resultListStyle.cornerNum} pointerEvents="none">
                    {item.position.replace('.', '')}
                </Text>
                
                <TouchableOpacity
                    style={resultListStyle.cornerStarBtn}
                    onPress={handleStarPress}
                    activeOpacity={0.7}
                    disabled={isLoading}
                >
                    <Text style={isFollowed ? resultListStyle.cornerStar : resultListStyle.cornerStarUnfilled}>
                        {isFollowed ? '★' : '☆'}
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Card Content */}
            <TouchableOpacity
                onPress={handleCardPress}
                activeOpacity={0.7}
            >
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

ResultCard.displayName = 'ResultCard';

export default ResultCard;