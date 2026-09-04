import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
    View,
    Text,
    FlatList,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { commonStyles, spacing, palette } from '../../styles/common.styles';
import { resultListStyle } from '../../styles/ResultList.styles';
import SearchInput from '../../components/SearchInput';
import { participantService, Participant } from '../../services/participantService';
import { API_CONFIG } from '../../constants/config';
import ParticipantCard from './ParticipantCard';
import { SearchParticipantpops } from '../../types/navigation';
import ErrorScreen from '../../components/ErrorScreen';
import { useScreenError } from '../../hooks/useApiError';
import { AppHeader } from '../../components/common/AppHeader';
import { useDimensions } from '../../hooks/useDimensions';
import { analyticsService } from '../../services/analyticsService';

const SearchParticipant: React.FC<SearchParticipantpops> = ({ route, navigation }) => {
    const { product_app_id, product_option_value_app_id, raceStatus } = route.params;
    const { t } = useTranslation(['details', 'follower', 'allrace']);
    const { width } = useDimensions();
    const insets = useSafeAreaInsets(); 
    const isGestureNav = insets.bottom > 0;
    const isLandscape = width 

    const productId = typeof product_app_id === 'string'
        ? parseInt(product_app_id, 10)
        : product_app_id;

    const [participants, setParticipants] = useState<Participant[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const debounceTimer = useRef<NodeJS.Timeout | null>(null);
    const searchInputRef = useRef<any>(null);
    // ✅ Prevents double fetch — useFocusEffect and debounce useEffect both
    // run on mount. This ref ensures only useFocusEffect fires the first time.
    const isInitialLoad = useRef(true);

    const { error, hasError, handleApiError, clearError } = useScreenError();

    const fetchParticipants = useCallback(
        async (pageNum: number, search: string) => {
            try {
                if (pageNum === 1) {
                    setLoading(true);
                    clearError();
                } else {
                    setLoadingMore(true);
                }

                if (API_CONFIG.DEBUG) {
                    console.log(`📡 Fetching participants page ${pageNum}`, {
                        search: search || '(none)',
                        product_app_id: productId,
                    });
                }

                const result = await participantService.getParticipants({
                    product_app_id: productId,
                    product_option_value_app_id,
                    page: pageNum,
                    filter_name: search,
                });

                setParticipants(prev => {
                    if (pageNum === 1) return result.participants;

                    const existingIds = new Set(
                        prev.map(p => participantService.getParticipantId(p))
                    );
                    const newItems = result.participants.filter(
                        p => !existingIds.has(participantService.getParticipantId(p))
                    );

                    if (API_CONFIG.DEBUG) {
                        console.log(`✅ Added ${newItems.length} new participants (Total: ${prev.length + newItems.length})`);
                    }

                    return [...prev, ...newItems];
                });

                setPage(pageNum);
                setTotalPages(result.pagination.total_pages);

                // Fires ONCE per completed search. fetchParticipants is shared by
                // three callers, so both guards matter:
                //   pageNum === 1   → excludes pagination (same search, more pages)
                //   search non-empty → excludes the initial useFocusEffect load,
                //                      which calls fetchParticipants(1, '')
                // Sends pagination.total (all matches), not participants.length,
                // which is capped at one page. Never the query text — free text is
                // unbounded and would blow GA4's cardinality limit.
                if (pageNum === 1 && search.trim().length > 0) {
                    // In-race search; only the product id is in scope here.
                    void analyticsService.logSearchPerformed(
                        'participant',
                        result.pagination.total ?? result.participants.length,
                        { product_app_id },
                    );
                }

                if (API_CONFIG.DEBUG) {
                    console.log(`📄 Page ${pageNum}/${result.pagination.total_pages} | Total: ${result.pagination.total}`);
                }
            } catch (err: any) {
                if (API_CONFIG.DEBUG) {
                    console.error('❌ Error fetching participants:', err.message);
                }
                if (pageNum === 1) handleApiError(err);
            } finally {
                setLoading(false);
                setLoadingMore(false);
            }
        },
        [productId, product_option_value_app_id] // ✅ removed `t` (stable), added product_option_value_app_id
    );

    // ✅ Initial fetch on screen focus
    useFocusEffect(
        useCallback(() => {
            isInitialLoad.current = true;
            fetchParticipants(1, '');
        }, [fetchParticipants])
    );

    // ✅ Debounced search — skips the very first render handled by useFocusEffect
    useEffect(() => {
        if (isInitialLoad.current) {
            isInitialLoad.current = false;
            return;
        }

        if (debounceTimer.current) clearTimeout(debounceTimer.current);

        debounceTimer.current = setTimeout(() => {
            fetchParticipants(1, searchText);
        }, 500);

        return () => {
            if (debounceTimer.current) clearTimeout(debounceTimer.current);
        };
    }, [searchText, fetchParticipants]);

    const hasMorePages = useCallback(() => page < totalPages, [page, totalPages]);

    const handleLoadMore = useCallback(() => {
        if (API_CONFIG.DEBUG) {
            console.log('🔍 onEndReached triggered:', {
                hasMore: hasMorePages(),
                loading: loadingMore,
                currentPage: page,
                totalPages,
            });
        }

        if (!hasMorePages() || loadingMore) return;
        fetchParticipants(page + 1, searchText);
    }, [page, totalPages, loadingMore, searchText, hasMorePages, fetchParticipants]);

    const renderParticipant = useCallback(
        ({ item }: { item: Participant }) => (
            <ParticipantCard
                item={item}
                product_app_id={productId}
                product_option_value_app_id={product_option_value_app_id ?? 0}
                raceStatus={raceStatus}
            />
        ),
        [productId, product_option_value_app_id, raceStatus]
    );

    const renderFooter = useCallback(() =>
        loadingMore ? (
            <View style={{ paddingVertical: spacing.lg, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={palette.navy} />
            </View>
        ) : null
    , [loadingMore]);

    // Same designed empty state as everywhere else - see AllParticipant.tsx.
    const renderEmpty = useCallback(() => (
        <ErrorScreen
            type="empty"
            title={searchText
                ? `${t('details:participant.noResults')} "${searchText}"`
                : t('details:participant.empty')}
            onRetry={() => { }}
        />
    ), [searchText, t]);

    if (loading && searchText.length === 0) {
        return (
            <SafeAreaView style={commonStyles.container} edges={['bottom']}>
                <View style={commonStyles.centerContainer}>
                    <ActivityIndicator size="large" color={palette.navy} />
                </View>
            </SafeAreaView>
        );
    }

    if (hasError && !loading) {
        return (
            <SafeAreaView style={commonStyles.container} edges={['bottom']}>
                <AppHeader title={t('common:band.searchParticipants')} showLogo={true} showBack />
                <ErrorScreen
                    type={error!.type}
                    title={error!.title}
                    message={error!.message}
                    onRetry={() => { clearError(); fetchParticipants(1, searchText); }}
                />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={commonStyles.container} edges={isLandscape && !isGestureNav ? ['left','right'] : ['bottom']}>

            {/* Was a hand-rolled back chevron and title on white - the same old
                chrome AllParticipant.tsx carried, and the same mismatch with
                this screen's own error state, which already used AppHeader.
                `edges` must not include 'top': AppHeader carries that inset. */}
            <AppHeader title={t('common:band.searchParticipants')} showLogo={true} showBack />

            <SearchInput
                ref={searchInputRef}
                placeholder={t('details:participant.search')}
                value={searchText}
                onChangeText={setSearchText}
                icon="search"
            />

            {searchText.trim().length > 0 && participants.length > 0 && (
                <Text style={resultListStyle.searchCount}>
                    {t('allrace:search.resultsFor', {
                        count: participants.length,
                        query: searchText.trim(),
                    })}
                </Text>
            )}

            {loading && searchText.length > 0 && (
                <View style={{ marginTop: spacing.lg, alignItems: 'center' }}>
                    <ActivityIndicator size="small" color={palette.navy} />
                    <Text style={{ marginTop: spacing.sm, color: palette.textMuted }}>
                        {t('details:participant.searching')}
                    </Text>
                </View>
            )}

            <FlatList
                data={participants}
                keyExtractor={(item, index) =>
                    `${participantService.getParticipantId(item)}-${index}`
                }
                renderItem={renderParticipant}
                showsVerticalScrollIndicator={false}
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.5}
                contentContainerStyle={{
                    // The card carries its own 20pt gutter; this only holds the
                    // first card clear of the search band above it.
                    paddingTop: spacing.sm,
                    paddingBottom: spacing.xxxl,
                    flexGrow: 1,
                }}
                keyboardShouldPersistTaps="handled"
                removeClippedSubviews={false}
                ListFooterComponent={renderFooter}
                ListEmptyComponent={!loading ? renderEmpty : null}
            />
        </SafeAreaView>
    );
};

export default SearchParticipant;