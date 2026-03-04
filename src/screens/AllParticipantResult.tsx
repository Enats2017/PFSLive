
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    Modal,
    Animated,
    StatusBar,
    ActivityIndicator,
    RefreshControl,
    Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
const { width: SCREEN_W } = Dimensions.get('window');
import { AppHeader } from '../components/common/AppHeader';
import { BottomNavigation } from '../components/common/BottomNavigation';
import { colors, commonStyles } from '../styles/common.styles';
import { AllParticipantprops } from '../types/navigation';
import { allParticipantServices, RaceResult, FilterOption, FiltersState } from '../services/allParticipantServices';
import { participantStyles } from '../styles/AllParticipant.styles';
import { useTranslation } from 'react-i18next';
import Dropdown from '../components/FilterDropdown';

 

const DEFAULT_FILTERS: FiltersState = {   
    distance: { label: '100 km', value: '100' },
    type: { label: 'Results', value: 'results' },
    category: { label: 'Scratch', value: 'scratch' },
};
interface ResultCardProps {
    item: RaceResult;
    onToggleFavorite: (id: string) => void;
}

const useRaceResults = () => {
    const [distanceOpts, setDistanceOpts] = useState<FilterOption[]>([]);
    const [typeOpts, setTypeOpts] = useState<FilterOption[]>([]);
    const [categoryOpts, setCategoryOpts] = useState<FilterOption[]>([]);
    const [filters, setFilters] = useState<FiltersState>(DEFAULT_FILTERS);
    const [results, setResults] = useState<RaceResult[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [refreshing, setRefreshing] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        allParticipantServices.getFilterOptions()
            .then((d) => {
                setDistanceOpts(d.distances);
                setTypeOpts(d.types);
                setCategoryOpts(d.categories);
            })
            .catch((e) => console.error('[useRaceResults] filter options:', e));
    }, []);

    useEffect(() => { fetchResults(); }, [filters]);

    const fetchResults = useCallback(async (isPull = false): Promise<void> => {
        try {
            isPull ? setRefreshing(true) : setLoading(true);
            setError(null);
            const data = await allParticipantServices.getResults(filters);
            setResults(data);
        } catch (e) {
            setError('Failed to load results. Tap to retry.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [filters]);

    const updateFilter = useCallback((key: keyof FiltersState, opt: FilterOption): void => {
        setFilters((prev) => ({ ...prev, [key]: opt }));
    }, []);

    const toggleFavorite = useCallback((id: string): void => {
        setResults((prev) =>
            prev.map((r) => {
                if (r.id !== id) return r;
                const next = { ...r, isFavorite: !r.isFavorite };
                allParticipantServices.toggleFavorite(id, next.isFavorite).catch(console.error);
                return next;
            })
        );
    }, []);

    return {
        distanceOpts, typeOpts, categoryOpts,
        filters, results, loading, refreshing, error,
        updateFilter, toggleFavorite,
        retry: () => fetchResults(false),
        onRefresh: () => fetchResults(true),
    };
};

const ResultCard: React.FC<ResultCardProps> = ({ item, onToggleFavorite }) => {
    const { t } = useTranslation(['allrace', 'common']);
    const [fav, setFav] = useState<boolean>(item.isFavorite);
    const handleFav = (): void => { setFav((p) => !p); onToggleFavorite(item.id); };
    return (
        <View style={participantStyles.card}>
            <View style={participantStyles.cornerWrap} pointerEvents="box-none">
                <View style={participantStyles.cornerTriangle} />
                <Text style={participantStyles.cornerNum}>{item.rank}</Text>
                <TouchableOpacity
                    style={participantStyles.cornerStarBtn}
                    onPress={handleFav}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                    <Text style={[participantStyles.cornerStar, fav && participantStyles.cornerStarActive]}>
                        {fav ? '★' : '☆'}
                    </Text>
                </TouchableOpacity>
            </View>
            <View style={participantStyles.cardTop}>
                <View style={participantStyles.cardTopLeft}>
                    <Text style={participantStyles.cardName}>{item.name}</Text>
                    {item.isLive && (
                        <View style={participantStyles.livePill}>
                            <Text style={participantStyles.livePillText}>{t('allrace:race.live')}</Text>
                        </View>
                    )}
                </View>
                <View style={{ width: 64 }} />
            </View>

            <Text style={participantStyles.bibText}>{t('allrace:race.bibNumber')} {item.bib}</Text>
            <Text style={participantStyles.teamText} numberOfLines={1}>{item.team}</Text>
            <View style={participantStyles.statsRow}>
                <View style={participantStyles.statCol}>
                    <Text style={participantStyles.statLabel}>{t('allrace:race.time')}</Text>
                    <Text style={participantStyles.statVal}>{item.time}</Text>
                </View>
                <View style={[participantStyles.statCol, participantStyles.statColMid]}>
                    <Text style={participantStyles.statLabel}>{t('allrace:race.diffFirst')}</Text>
                    <Text style={participantStyles.statVal}>{item.diff}</Text>
                </View>
                <View style={participantStyles.statCol}>
                    <Text style={participantStyles.statLabel}>{t('allrace:race.ranking')} {'\n'}
                        {item.rankingCategory}</Text>
                    <Text style={participantStyles.statVal}>{item.rankingPos}</Text>
                </View>
            </View>
        </View>
    );
};

const AllParticipantResult: React.FC<AllParticipantprops> = ({ navigation }) => {
    const { t } = useTranslation(['allrace', 'common']);
    const {
        distanceOpts, typeOpts, categoryOpts,
        filters, results, loading, refreshing, error,
        updateFilter, toggleFavorite, retry, onRefresh,
    } = useRaceResults();

    return (
        <SafeAreaView style={commonStyles.container} edges={['top', 'bottom']}>
            <StatusBar barStyle="dark-content" />
            <AppHeader showLogo={false} />
            <View style={participantStyles.filterRow1}>
                <Dropdown
                    label={filters.distance.label}
                    options={distanceOpts}
                    selected={filters.distance}
                    onSelect={(opt) => updateFilter('distance', opt)}
                />
            </View>

            <View style={participantStyles.filterRow2}>
                <Dropdown
                    label={filters.type.label}
                    options={typeOpts}
                    selected={filters.type}
                    onSelect={(opt) => updateFilter('type', opt)}
                />
                <Dropdown
                    label={filters.category.label}
                    options={categoryOpts}
                    selected={filters.category}
                    onSelect={(opt) => updateFilter('category', opt)}
                />
            </View>

            {loading ? (
                <View style={participantStyles.center}>
                    <ActivityIndicator size="large" color={colors.success} />
                    <Text style={participantStyles.loadingText}>{t('common:loading.loading')}</Text>
                </View>
            ) : error ? (
                <View style={participantStyles.center}>
                    <Text style={participantStyles.errorText}>{error}</Text>
                    <TouchableOpacity style={participantStyles.retryBtn} onPress={retry}>
                        <Text style={participantStyles.retryText}>{t('common:buttons.retry')}</Text>
                    </TouchableOpacity>
                </View>
            ) : results.length === 0 ? (
                <View style={participantStyles.center}>
                    <Text style={participantStyles.errorText}>{t('allrace:race.noResults')}</Text>
                </View>
            ) : (
                <FlatList
                    data={results}
                    keyExtractor={(item: RaceResult) => item.id}
                    renderItem={({ item }: { item: RaceResult }) => (
                        <ResultCard item={item} onToggleFavorite={toggleFavorite} />
                    )}
                    contentContainerStyle={participantStyles.list}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.success} />
                    }
                />
            )}

            <BottomNavigation />
        </SafeAreaView>
    );
};

export default AllParticipantResult;
