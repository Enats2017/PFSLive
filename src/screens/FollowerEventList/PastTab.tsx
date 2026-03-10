import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { EventItem } from '../../services/followerEvent';
import { commonStyles, spacing } from '../../styles/common.styles';
import { eventStyles } from '../../styles/event';
import { useTranslation } from 'react-i18next';
import { formatEventDate } from '../../utils/dateFormatter';
import SearchInput from '../../components/SearchInput';
import { useNavigation } from '@react-navigation/native';

interface PastTabProps {
    product_app_id?: string | number;
     // Not used, but keep interface consistent
}

const PastTab: React.FC<PastTabProps> = () => {
    const navigation = useNavigation<any>();
    const { t } = useTranslation(['event', 'common']);
    
    // ✅ ALL STATE INSIDE COMPONENT - Just like ParticipantTab
    const [events, setEvents] = useState<EventItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [error, setError] = useState<string | null>(null);

    const debounceTimer = useRef<NodeJS.Timeout | null>(null);
    const onEndReachedCalledDuringMomentum = useRef(true);

    // ✅ FETCH EVENTS - Just like ParticipantTab
    const fetchEvents = useCallback(async (pageNum: number, search: string) => {
        try {
            if (pageNum === 1 && search.length === 0) {
                setLoading(true);
                setError(null);
            } else if (pageNum > 1) {
                setLoadingMore(true);
            }

            const { eventService } = require('../../services/eventService');
            const result = await eventService.getEvents({
                page_past: pageNum,
                filter_name_past: search,
            });

            setEvents(prev => {
                if (pageNum === 1) {
                    return result.tabs.past;
                } else {
                    const existingIds = new Set(prev.map(e => e.product_app_id));
                    const newItems = result.tabs.past.filter(item => !existingIds.has(item.product_app_id));
                    return [...prev, ...newItems];
                }
            });

            setPage(pageNum);
            setTotalPages(result.pagination.past.total_pages);
        } catch (error: any) {
            if (pageNum === 1) {
                setError(error.message || t('event:error.failed'));
            }
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [t]);

    // ✅ INITIAL LOAD
    useEffect(() => {
        fetchEvents(1, '');
    }, [fetchEvents]);

    // ✅ DEBOUNCED SEARCH - Just like ParticipantTab
    useEffect(() => {
        if (debounceTimer.current) {
            clearTimeout(debounceTimer.current);
        }

        debounceTimer.current = setTimeout(() => {
            fetchEvents(1, searchText);
        }, 500);

        return () => {
            if (debounceTimer.current) {
                clearTimeout(debounceTimer.current);
            }
        };
    }, [searchText, fetchEvents]);

    const hasMorePages = useCallback((): boolean => {
        return page < totalPages;
    }, [page, totalPages]);

    const handleLoadMore = useCallback(() => {
        if (onEndReachedCalledDuringMomentum.current) return;
        if (!hasMorePages()) return;
        if (loadingMore) return;

        onEndReachedCalledDuringMomentum.current = true;
        fetchEvents(page + 1, searchText);
    }, [page, loadingMore, searchText, hasMorePages, fetchEvents]);

    const renderItem = useCallback(({ item }: { item: EventItem }) => (
        <View style={[commonStyles.card, {
            paddingTop: spacing.xs,
            padding: 0,
            overflow: 'hidden',
            marginBottom: spacing.md,
        }]}>
            <View style={eventStyles.header}>
                <Text style={[commonStyles.title, { marginBottom: spacing.xs }]}>
                    {item.name}
                </Text>
                <Text style={commonStyles.subtitle}>
                    {formatEventDate(item.race_date, t)}
                </Text>
            </View>
            <TouchableOpacity
                style={[commonStyles.primaryButton, { borderRadius: 0 }]}
                onPress={() => navigation.navigate('RaseResultScreen', {
                    product_app_id: item.product_app_id,
                    event_name: item.name
                })}
                activeOpacity={0.8}
            >
                <Text style={commonStyles.primaryButtonText}>
                    {t('follower:button.result')}
                </Text>
            </TouchableOpacity>
        </View>
    ), [navigation, t]);

    const keyExtractor = useCallback(
        (item: EventItem, index: number) => `${item.product_app_id}-${index}`,
        []
    );

    const renderFooter = useCallback(() => {
        if (!loadingMore) return null;
        return (
            <View style={{ paddingVertical: spacing.lg, alignItems: 'center' }}>
                <ActivityIndicator size="small" color="#FF5722" />
            </View>
        );
    }, [loadingMore]);

    // ✅ LOADING STATE
    if (loading && searchText.length === 0) {
        return (
            <ActivityIndicator
                size="large"
                color="#FF5722"
                style={{ marginTop: 40 }}
            />
        );
    }

    // ✅ ERROR STATE
    if (error && searchText.length === 0) {
        return (
            <View style={commonStyles.centerContainer}>
                <Text style={commonStyles.errorText}>{error}</Text>
                <TouchableOpacity
                    style={[commonStyles.primaryButton, { marginTop: spacing.lg }]}
                    onPress={() => fetchEvents(1, searchText)}
                    activeOpacity={0.8}
                >
                    <Text style={commonStyles.primaryButtonText}>
                        {t('event:error.retry')}
                    </Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <>
            <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm }}>
                <SearchInput
                    placeholder={t('details:participant.search')}
                    value={searchText}
                    onChangeText={setSearchText}
                    icon="search"
                />
            </View>

            {loading && searchText.length > 0 && (
                <View style={{ marginTop: spacing.lg, alignItems: 'center' }}>
                    <ActivityIndicator size="small" color="#FF5722" />
                </View>
            )}

            {!loading && events.length === 0 ? (
                <View style={{ marginTop: 40, paddingHorizontal: spacing.lg }}>
                    <Text style={commonStyles.errorText}>
                        {searchText
                            ? t('event:empty.searchNoResults')
                            : t('event:empty.past')}
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={events}
                    keyExtractor={keyExtractor}
                    renderItem={renderItem}
                    showsVerticalScrollIndicator={false}
                    onEndReached={handleLoadMore}
                    onEndReachedThreshold={0.3}
                    onMomentumScrollBegin={() => {
                        onEndReachedCalledDuringMomentum.current = false;
                    }}
                    contentContainerStyle={{
                        paddingHorizontal: spacing.md,
                        paddingBottom: spacing.xxxl,
                    }}
                    keyboardShouldPersistTaps="handled"
                    ListFooterComponent={renderFooter}
                />
            )}
        </>
    );
};

export default PastTab;