import React, { memo } from 'react';
import { View, Text, TouchableWithoutFeedback } from 'react-native';
import { SvgUri } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { resultListStyle } from '../../styles/ResultList.styles';
import { RaceResult } from '../../services/resultList';

interface ResultCardBeforeRaceProps {
    item: RaceResult;
    product_app_id: number; // ✅ ADDED
    isLoading: boolean;
    isFollowed: boolean;
    onToggleFollow: () => void;
    showUtmbIndex: boolean;
}

const ResultCardBeforeRace: React.FC<ResultCardBeforeRaceProps> = memo(({
    item,
    product_app_id, // ✅ ADDED
    isFollowed,
    isLoading,
    onToggleFollow,
    showUtmbIndex,
}) => {
    const { t } = useTranslation(['allrace', 'common']);

    // ✅ REMOVED: canFollow check
    const hasUtmbIndex = showUtmbIndex && item.utmb_index && item.utmb_index.trim() !== '';

    return (
        <View style={resultListStyle.cardWithLeftBorder}>
            {/* ✅ ALWAYS SHOW STAR */}
            <View style={resultListStyle.cornerWrap} pointerEvents="box-none">
                <View style={resultListStyle.cornerTriangle} pointerEvents="none" />
                <Text style={resultListStyle.cornerNum} pointerEvents="none">
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
    );
}, (prev, next) =>
    prev.item.bib === next.item.bib &&
    prev.isFollowed === next.isFollowed &&
    prev.item.utmb_index === next.item.utmb_index &&
    prev.item.club === next.item.club &&
    prev.item.nation === next.item.nation &&
    prev.showUtmbIndex === next.showUtmbIndex
);

ResultCardBeforeRace.displayName = 'ResultCardBeforeRace';

export default ResultCardBeforeRace;