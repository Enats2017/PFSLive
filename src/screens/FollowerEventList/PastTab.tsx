import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { commonStyles, spacing, colors } from '../../styles/common.styles';
import { eventStyles } from '../../styles/event';
import { EventItem, eventService } from '../../services/followerEvent';
import { formatEventDate } from '../../utils/dateFormatter';
import SearchInput from '../../components/SearchInput';
import { API_CONFIG } from '../../constants/config';
import ErrorScreen from '../../components/ErrorScreen';

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
            <TouchableOpacity
                style={[
                    commonStyles.card,
                    {
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: spacing.lg,
                        paddingVertical: spacing.md,
                        marginBottom: spacing.md,
                    },
                ]}
                onPress={() =>
                    navigation.navigate('FollowDetails', {
                        product_app_id: Number(item.product_app_id),
                        event_name: item.name,
                        sourceTab: 'past',
                    })
                }
                activeOpacity={0.8}
            >
                <View style={eventStyles.eventCardInfo}>
                    <Text style={[commonStyles.title, { marginBottom: 4 }]}>{item.name}</Text>
                    <View style={eventStyles.eventCardDateRow}>
                        <Ionicons name="calendar-outline" size={14} color={colors.gray500} />
                        <Text style={commonStyles.date}>
                            {formatEventDate(item.race_date, t)}
                        </Text>
                    </View>
                </View>

                {/* Eye icon button - dark blue */}
                <TouchableOpacity
                    style={eventStyles.iconButtonBlue}
                    onPress={() =>
                        navigation.navigate('FollowDetails', {
                            product_app_id: Number(item.product_app_id),
                            event_name: item.name,
                            sourceTab: 'past',
                        })
                    }
                    activeOpacity={0.8}
                >
                    <Ionicons name="bar-chart-outline" size={23} color={colors.primaryDark} />
                </TouchableOpacity>
            </TouchableOpacity>
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
            <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: spacing.md }} />
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
                message="" // ← empty string hides message, or add a subtitle if you want
                onRetry={() => { }}
            />
        ),
        [t, searchText]
    );

    return (
        <>
            <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm }}>
                <SearchInput
                    placeholder={t('event:search')}
                    value={searchText}
                    onChangeText={setSearchText}
                    icon="search"
                />
            </View>

            {searching && (
                <View style={{ marginTop: spacing.lg, alignItems: 'center' }}>
                    <ActivityIndicator size="small" color={colors.primary} />
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
                    paddingHorizontal: spacing.md,
                    paddingBottom: spacing.xl,
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