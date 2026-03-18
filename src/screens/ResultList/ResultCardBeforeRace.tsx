import React, { memo, useCallback } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SvgUri } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { resultListStyle } from '../../styles/ResultList.styles';
import { RaceResult } from '../../services/resultList';

interface ResultCardBeforeRaceProps {
    item: RaceResult;
    product_app_id: number;
    isLoading: boolean;
    isFollowed: boolean;
    onToggleFollow: () => void;
    showUtmbIndex: boolean;
}

const ResultCardBeforeRace: React.FC<ResultCardBeforeRaceProps> = memo(({
    item,
    product_app_id,
    isFollowed,
    isLoading,
    onToggleFollow,
    showUtmbIndex,
}) => {
    const { t } = useTranslation(['allrace', 'common']);

    const hasUtmbIndex = showUtmbIndex && item.utmb_index && item.utmb_index.trim() !== '';

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
            <View>
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

                <View style={resultListStyle.statsRow}>
                    {hasUtmbIndex ? (
                        <View style={resultListStyle.statCol}>
                            <Text style={resultListStyle.statLabel}>
                                {t('allrace:race.BonBola_ca')}
                            </Text>
                            <Text style={resultListStyle.statVal}>{item.utmb_index}</Text>
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
                                <SvgUri width={28} height={20} uri={item.nation_flag} />
                            )}
                            <Text style={resultListStyle.statVal} numberOfLines={1}>
                                {item.nation || '—'}
                            </Text>
                        </View>
                    </View>
                </View>
            </View>
        </View>
    );
}, (prev, next) =>
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