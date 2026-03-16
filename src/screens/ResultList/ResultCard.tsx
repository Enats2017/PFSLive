import React, { memo, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated } from 'react-native';
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
    isFollowed: boolean;

    onToggleFollow: () => void;
    sourceTab?: 'past' | 'live' | 'upcoming';
}


const ResultCard: React.FC<ResultCardProps> = memo(({
    item,
    fromLive,
    isFollowed,
    isLoading,
    onToggleFollow,
    sourceTab
}) => {
    const navigation = useNavigation<any>();
    const { t } = useTranslation(['allrace', 'common']);
    console.log(sourceTab);
    const isLive = item.live_tracking_activated === 1;
    const canFollow = item.customer_app_id !== null && item.customer_app_id > 0;

    const handlePress = () => {

       
        navigation.navigate('ResultDetails', {
            participant_app_id: item.customer_app_id,
            sourceTab

        });
    }


    return (
        <TouchableOpacity
            style={[
                resultListStyle.card,
                isLive && {
                    borderLeftWidth: 3,
                    borderLeftColor: '#FF3B30',
                },
            ]}
            onPress={handlePress}
            activeOpacity={0.7}
           
        >
            <View style={resultListStyle.cornerWrap} pointerEvents="box-none">
                <View style={resultListStyle.cornerTriangle} />
                <Text style={resultListStyle.cornerNum}>
                    {item.category_rank || item.position.replace('.', '')}
                </Text>
                {
                    canFollow && (
                        <TouchableOpacity
                            style={[resultListStyle.cornerStarBtn]}
                            onPress={onToggleFollow}
                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}

                            disabled={isLoading}
                        >
                            <Text style={[
                                resultListStyle.cornerStar,

                            ]}>
                                {isFollowed ? '★' : '☆'}
                            </Text>
                        </TouchableOpacity>

                    )
                }
            </View>

            <View style={resultListStyle.cardTop}>
                <View style={resultListStyle.cardTopLeft}>
                    <Text style={resultListStyle.cardName}>{item.name}</Text>
                </View>
                <View style={{ width: 64 }} />
            </View>
            <Text style={resultListStyle.bibText}>
                {t('allrace:race.bibNumber')} {item.bib}
            </Text>

            {fromLive === 0 && (
                <Text style={resultListStyle.teamText} numberOfLines={1}>
                    {[item.club, item.nation].filter(Boolean).join(' · ')}
                </Text>
            )}


            {isLive && <LiveTrackingBar />}

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
                            <Text style={resultListStyle.statVal}>{item.category_rank}</Text>
                        </View>
                    </>
                ) : (
                    <View style={[resultListStyle.statCol, resultListStyle.statFlagMid]}>
                        <View style={resultListStyle.flagRow}>
                            {!!item.nation_flag && (
                                <SvgUri width={28} height={20} uri={item.nation_flag} />
                            )}
                            <Text style={resultListStyle.statVal} numberOfLines={1}>
                                {item.nation || '—'}
                            </Text>
                        </View>
                    </View>
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

export default ResultCard;