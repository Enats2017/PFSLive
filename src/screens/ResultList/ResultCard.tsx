
import React, { memo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SvgUri } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { resultListStyle } from '../../styles/ResultList.styles';
import { RaceResult } from '../../services/resultList';

interface ResultCardProps {
    item:        RaceResult;
    isFav:       boolean;
    fromLive:    0 | 1;
    onToggleFav: (bib: string) => void;
}

const ResultCard: React.FC<ResultCardProps> = memo(({
    item,
    isFav,
    fromLive,
    onToggleFav,
}) => {
    const { t } = useTranslation(['allrace', 'common']);

    return (
        <View style={resultListStyle.card}>

            {/* ── green triangle corner — rank + star ── */}
            <View style={resultListStyle.cornerWrap} pointerEvents="box-none">
                <View style={resultListStyle.cornerTriangle} />
                <Text style={resultListStyle.cornerNum}>
                    {item.category_rank || item.position.replace('.', '')}
                </Text>
                <TouchableOpacity
                    style={resultListStyle.cornerStarBtn}
                    onPress={() => onToggleFav(item.bib)}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                    <Text style={[
                        resultListStyle.cornerStar,
                        isFav && resultListStyle.cornerStarActive,
                    ]}>
                        {isFav ? '★' : '☆'}
                    </Text>
                </TouchableOpacity>
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
                    <View style={[
                        resultListStyle.statCol,
                        resultListStyle.statFlagMid,
                    
                    ]}>
                        <View style={resultListStyle.flagRow}>
                            {!!item.nation_flag && (
                                <SvgUri
                                    width={28}
                                    height={20}
                                    uri={item.nation_flag}
                                />
                            )}
                            <Text style={resultListStyle.statVal} numberOfLines={1}>
                                {item.nation || '—'}
                            </Text>
                        </View>
                    </View>
                )}
            </View>
        </View>
    );
}, (prev, next) =>
    // custom comparator — only re-render when these specific props change
    prev.isFav    === next.isFav    &&
    prev.fromLive === next.fromLive &&
    prev.item.bib === next.item.bib &&
    prev.item.position === next.item.position
);

export default ResultCard;
