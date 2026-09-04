import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { commonStyles, spacing, palette } from '../../styles/common.styles';
import { eventStyles } from '../../styles/event';
import { EventItem, eventService } from '../../services/followerEvent';
import { formatEventDate } from '../../utils/dateFormatter';
import SearchInput from '../../components/SearchInput';
import { API_CONFIG } from '../../constants/config';
import ErrorScreen from '../../components/ErrorScreen';
import { analyticsService } from '../../services/analyticsService';
import { ANALYTICS_SCREENS, ANALYTICS_BUTTONS, ANALYTICS_PARAMS } from '../../constants/analyticsScreens';
import { EventListCard } from '../../components/EventListCard';

interface PastTabProps {
    events: EventItem[];
    onLoadMore: () => void;
    loadingMore: boolean;
    hasMore: boolean;
}

const PastTab: React.FC<PastTabProps> = ({ events, onLoadMore, loadingMore, hasMore }) => {
    const navigation = useNavigation<any>();
    const { t } = useTranslation(['event', 'common']);
    const [searchText, setSearchText] = useState('');
    const [searchResults, setSearchResults] = useState<EventItem[]>([]);
    const [searching, setSearching] = useState(false);
    const debounceTimer = useRef<NodeJS.Timeout | null>(null);
    const [searchPagination, setSearchPagination] = useState({ page: 1, total_pages: 1 });
    const isLoadingMoreSearch = useRef(false);
    const [loadingMoreSearch, setLoadingMoreSearch] = useState(false);

    useEffect(() => {
        if (debounceTimer.current) {
            clearTimeout(debounceTimer.current);
        }
        if (searchText.trim().length === 0) {
            setSearchResults([]);
            setSearchPagination({ page: 1, total_pages: 1 });
            return;
        }

        isLoadingMoreSearch.current = false;
        setSearchPagination({ page: 1, total_pages: 1 });

        debounceTimer.current = setTimeout(async () => {
            try {
                setSearching(true);
                const result = await eventService.getEvents({
                    page_past: 1,
                    filter_name_past: searchText,
                });
                setSearchResults(result.tabs.past);
                setSearchPagination({
                    page: 1,
                    total_pages: result.pagination?.past?.total_pages ?? 1,
                });

                // ✅ Fires ONCE per completed search — inside the debounce, after
                // results resolve. Not per keystroke. Page 2+ (loadMoreSearchResults)
                // deliberately does NOT fire this: that's pagination of the same
                // search, and logging there would multiply one search into several
                // events. Only the result COUNT is sent, never the query text —
                // free text is unbounded and would blow GA4's cardinality limit.
                void analyticsService.logSearchPerformed('event', result.tabs.past.length);

                console.log('Past search page 1 loaded, total_pages:', result.pagination?.past?.total_pages);
            } catch (error) {
                console.log('❌ Search failed:', error);
            } finally {
                setSearching(false);
            }
        }, 500);

        return () => {
            if (debounceTimer.current) {
                clearTimeout(debounceTimer.current);
            }
        };
    }, [searchText]);

    const displayEvents = searchText.trim().length > 0 ? searchResults : events;

    const loadMoreSearchResults = useCallback(async () => {
        if (isLoadingMoreSearch.current) return;
        let currentPage = 0;
        let totalPages = 0;
        setSearchPagination(prev => {
            currentPage = prev.page;
            totalPages = prev.total_pages;
            console.log('Past search pagination:', { currentPage: prev.page, totalPages: prev.total_pages });
            return prev;
        });

        if (currentPage >= totalPages) {
            console.log('No more past search pages');
            return;
        }
        try {
            isLoadingMoreSearch.current = true;
            setLoadingMoreSearch(true);
            const nextPage = currentPage + 1;
            console.log(`Past search: fetching page ${nextPage}`);

            const result = await eventService.getEvents({
                page_past: nextPage,
                filter_name_past: searchText,
            });

            console.log(`Past search page ${nextPage} loaded:`, result.tabs.past.length);
            setSearchResults(prev => {
                const ids = new Set(prev.map(e => e.product_app_id));
                const newItems = result.tabs.past.filter(i => !ids.has(i.product_app_id));
                return [...prev, ...newItems];
            });
            setSearchPagination({
                page: nextPage,
                total_pages: result.pagination?.past?.total_pages ?? totalPages,
            });

        } catch (err) {
            console.error('Past search load more failed:', err);
        } finally {
            isLoadingMoreSearch.current = false;
            setLoadingMoreSearch(false);
        }
    }, [searchText]);

    const handleLoadMore = useCallback(() => {
        if (searchText.trim().length > 0) {
            console.log('🔍 Past search end reached:', {
                isLoadingMore: isLoadingMoreSearch.current,
                currentPage: searchPagination.page,
                totalPages: searchPagination.total_pages,
            });
            if (!isLoadingMoreSearch.current && searchPagination.page < searchPagination.total_pages) {
                loadMoreSearchResults();
            }
            return;
        }

        if (hasMore && !loadingMore) {
            onLoadMore();
        }
    }, [hasMore, loadingMore, onLoadMore, searchText, searchPagination, loadMoreSearchResults]);

    const renderItem = useCallback(
        ({ item }: { item: EventItem }) => (
            <EventListCard
                name={item.name}
                date={formatEventDate(item.race_date, t)}
                city={item.city}
                country={item.country}
                imageUrl={item.event_image}
                onPress={async () => {
                    await analyticsService.logInteraction(
                        ANALYTICS_SCREENS.FOLLOWER_EVENT_LIST,
                        ANALYTICS_BUTTONS.PAST_EVENT,
                        'tap',
                        {
                            [ANALYTICS_PARAMS.EVENT_NAME]: item.name,
                            [ANALYTICS_PARAMS.TAB_NAME]: 'past',
                        }
                    );
                    navigation.navigate('FollowDetails', {
                        product_app_id: Number(item.product_app_id),
                        event_name: item.name,
                        event_image: item.event_image ?? '',
                        sourceTab: 'past',
                    });
                }}
            />
        ),
        [navigation, t]
    );

    const keyExtractor = useCallback(
        (item: EventItem, index: number) => `${item.product_app_id}-${index}`,
        []
    );

    const ListFooterComponent = useCallback(() => {
        if (!loadingMore && !loadingMoreSearch) return null;
        return (
            <ActivityIndicator size="small" color={palette.navy} style={{ marginVertical: spacing.md }} />
        );
    }, [loadingMore, loadingMoreSearch]);

    const ListEmptyComponent = useCallback(
        () => (
            <ErrorScreen
                type="empty"
                title={
                    searchText.trim().length > 0
                        ? t('event:empty.searchNoResults')
                        : t('event:empty.past')
                }
                message=""
                onRetry={() => { }}
            />
        ),
        [t, searchText]
    );

    return (
        <>
            {/* Full-bleed, like every other search screen. SearchInput draws
                its own white sub-header band with its own padding; the wrapper
                here inset that band 20pt from each edge and doubled the padding
                before the field. */}
            <SearchInput
                placeholder={t('event:search')}
                value={searchText}
                onChangeText={setSearchText}
                icon="search"
            />

            {searching && (
                <View style={{ marginTop: spacing.lg, alignItems: 'center' }}>
                    <ActivityIndicator size="small" color={palette.navy} />
                </View>
            )}

            <FlatList
                data={displayEvents}
                keyExtractor={keyExtractor}
                renderItem={renderItem}
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.5}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{
                    paddingTop: spacing.sm,
                    paddingHorizontal: spacing.xl,
                    paddingBottom: spacing.xxxxl,
                    flexGrow: 1,
                }}
                ListFooterComponent={ListFooterComponent}
                ListEmptyComponent={ListEmptyComponent}
                keyboardShouldPersistTaps="handled"
                removeClippedSubviews={false}
            />
        </>
    );
};

export default React.memo(PastTab);