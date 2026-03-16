import React, { memo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SvgUri } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { resultListStyle } from '../../styles/ResultList.styles';
import { RaceResult } from '../../services/resultList';

interface ResultCardBeforeRaceProps {
    item: RaceResult;
    isLoading: boolean;
    isFollowed: boolean;
    onToggleFollow: () => void;
    showUtmbIndex: boolean;
}

const ResultCardBeforeRace: React.FC<ResultCardBeforeRaceProps> = memo(({
    item,
    isFollowed,
    isLoading,
    onToggleFollow,
    showUtmbIndex,
}) => {
    const { t } = useTranslation(['allrace', 'common']);

    const canFollow = item.customer_app_id !== null && item.customer_app_id > 0;
    const hasUtmbIndex = showUtmbIndex && item.utmb_index && item.utmb_index.trim() !== '';

    return (
        <View style={resultListStyle.cardWithLeftBorder}>
            {/* CORNER RANK AND FOLLOW STAR */}
            <View style={resultListStyle.cornerWrap} pointerEvents="box-none">
                <View style={resultListStyle.cornerTriangle} />
                <Text style={resultListStyle.cornerNum}>
                    {item.position.replace('.', '')}
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

            {/* STATS ROW */}
            <View style={resultListStyle.statsRow}>
                {/* UTMB INDEX (IF AVAILABLE) */}
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

                {/* NATION FLAG */}
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