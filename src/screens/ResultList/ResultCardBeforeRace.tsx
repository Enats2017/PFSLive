import React, { memo, useCallback } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SvgUri } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { resultListStyle } from '../../styles/ResultList.styles';
import { RaceResult } from '../../services/resultList';
import { useNavigation } from '@react-navigation/native';

interface ResultCardBeforeRaceProps {
    item: RaceResult;
    product_app_id: number;
    isLoading: boolean;
    isFollowed: boolean;
    onToggleFollow: () => void;
    showUtmbIndex: boolean;
    raceStatus: string;
    currentPovId: number;
}

const ResultCardBeforeRace: React.FC<ResultCardBeforeRaceProps> = memo(({
    item,
    product_app_id,
    isFollowed,
    isLoading,
    onToggleFollow,
    showUtmbIndex,
    raceStatus,
    currentPovId
}) => {

    const { t } = useTranslation(['allrace', 'common']);
    const navigation = useNavigation<any>();

    const hasUtmbIndex =
        showUtmbIndex &&
        item.utmb_index &&
        item.utmb_index.trim() !== '';

    const handlePress = () => {
        navigation.navigate('ResultDetails', {
            product_app_id,
            product_option_value_app_id: Number(currentPovId),
            bib: item.bib,
            raceStatus
        });
    };

    const handleStarPress = useCallback(() => {
        if (!isLoading) {
            onToggleFollow();
        }
    }, [isLoading, onToggleFollow]);

    return (
        <TouchableOpacity
            style={resultListStyle.cardWithLeftBorder}
            onPress={handlePress}
        >

            {/* Corner Star */}
            <View style={resultListStyle.cornerWrap} pointerEvents="box-none">
                <View style={resultListStyle.cornerTriangle} pointerEvents="none" />

                <Text style={resultListStyle.cornerNum} pointerEvents="none">
                    {/* optional rank */}
                </Text>

                <TouchableOpacity
                    style={resultListStyle.cornerStarBtn}
                    onPress={handleStarPress}
                    activeOpacity={0.7}
                    disabled={isLoading}
                >
                    <Text
                        style={
                            isFollowed
                                ? resultListStyle.cornerStar
                                : resultListStyle.cornerStarUnfilled
                        }
                    >
                        {isFollowed ? '★' : '☆'}
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Card Content */}
            <View>
                <View style={resultListStyle.cardTop}>
                    <View style={resultListStyle.cardTopLeft}>
                        <Text style={resultListStyle.cardName}>
                            {item.name}
                        </Text>
                    </View>
                    <View style={{ width: 72 }} />
                </View>

                <Text style={resultListStyle.bibText}>
                    {t('allrace:race.bibNumber')} {item.bib}
                </Text>

                <Text style={resultListStyle.teamText} numberOfLines={1}>
                    {[item.club, item.nation].filter(Boolean).join(' · ')}
                </Text>

                <View style={resultListStyle.statsRow}>
                    {hasUtmbIndex ? (
                        <View style={resultListStyle.statCol}>
                            <Text style={resultListStyle.statLabel}>
                                {t('allrace:race.BonBola_ca')}
                            </Text>
                            <Text style={resultListStyle.statVal}>
                                {item.utmb_index}
                            </Text>
                        </View>
                    ) : (
                        <View style={resultListStyle.statCol}>
                            <Text style={resultListStyle.statLabel}>—</Text>
                            <Text style={resultListStyle.statVal}>—</Text>
                        </View>
                    )}

                    <View style={[resultListStyle.statCol, resultListStyle.statFlagMid]}>
                        <View style={resultListStyle.flagRow}>
                            {item.nation_flag && (
                                <SvgUri
                                    width={28}
                                    height={20}
                                    uri={item.nation_flag}
                                />
                            )}
                            <Text
                                style={resultListStyle.statVal}
                                numberOfLines={1}
                            >
                                {item.nation || '—'}
                            </Text>
                        </View>
                    </View>
                </View>
            </View>
        </TouchableOpacity>
    );
},
(prev, next) =>
    prev.item.bib === next.item.bib &&
    prev.isFollowed === next.isFollowed &&
    prev.isLoading === next.isLoading &&
    prev.item.utmb_index === next.item.utmb_index &&
    prev.item.club === next.item.club &&
    prev.item.nation === next.item.nation &&
    prev.showUtmbIndex === next.showUtmbIndex
);

ResultCardBeforeRace.displayName = 'ResultCardBeforeRace';

export default ResultCardBeforeRace;