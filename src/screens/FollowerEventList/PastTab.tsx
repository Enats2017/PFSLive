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

interface PastTabProps {
    events: EventItem[];
    onLoadMore: () => void;
    loadingMore: boolean;
    hasMore: boolean;
}

const PastTab: React.FC<PastTabProps> = ({ events, onLoadMore, loadingMore, hasMore }) => {
    const navigation = useNavigation<any>();
    const { t } = useTranslation(['event', 'common']);   
    // ✅ SEARCH STATE
    const [searchText, setSearchText] = useState('');
    const [searchResults, setSearchResults] = useState<EventItem[]>([]);
    const [searching, setSearching] = useState(false);
    const debounceTimer = useRef<NodeJS.Timeout | null>(null);

    // ✅ DEBOUNCED SEARCH
    useEffect(() => {
        if (debounceTimer.current) {
            clearTimeout(debounceTimer.current);
        }

        if (searchText.trim().length === 0) {
            setSearchResults([]);
            return;
        }

        debounceTimer.current = setTimeout(async () => {
            try {
                setSearching(true);
                const result = await eventService.getEvents({
                    page_past: 1,
                    filter_name_past: searchText,
                });
                setSearchResults(result.tabs.past);
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

    const handleLoadMore = useCallback(() => {
        
        if (searchText.trim().length > 0) return;

        if (API_CONFIG.DEBUG) {
            console.log('🔍 Past onEndReached:', {
                hasMore,
                loadingMore,
                eventsCount: events.length,
            });
        }

        if (hasMore && !loadingMore) {
            if (API_CONFIG.DEBUG) {
                console.log('✅ Calling onLoadMore');
            }
            onLoadMore();
        } else {
            if (API_CONFIG.DEBUG) {
                console.log('⏸️ Skipped - hasMore:', hasMore, 'loadingMore:', loadingMore);
            }
        }
    }, [hasMore, loadingMore, onLoadMore, events.length, searchText]);

    const renderItem = useCallback(
        ({ item }: { item: EventItem }) => (
            <View
                style={[
                    commonStyles.card,
                    {
                        paddingTop: spacing.xs,
                        padding: 0,
                        overflow: 'hidden',
                        marginBottom: spacing.md,
                    },
                ]}
            >
                <View style={eventStyles.header}>
                    <Text style={[commonStyles.title, { marginBottom: spacing.xs }]}>
                        {item.name}
                    </Text>
                    <Text style={commonStyles.subtitle}>{formatEventDate(item.race_date, t)}</Text>
                </View>
                <TouchableOpacity
                    style={[commonStyles.primaryButton, { borderRadius: 0 }]}
                    onPress={() =>
                        navigation.navigate('FollowDetails', {
                            product_app_id: item.product_app_id,
                            event_name: item.name,
                        })
                    }
                    activeOpacity={0.8}
                >
                    <Text style={commonStyles.primaryButtonText}>{t('event:past.button')}</Text>
                </TouchableOpacity>
            </View>
        ),
        [navigation, t]
    );

    const keyExtractor = useCallback(
        (item: EventItem, index: number) => `${item.product_app_id}-${index}`,
        []
    );

    const ListFooterComponent = useCallback(() => {
        if (!loadingMore) return null;
        return (
            <ActivityIndicator
                size="small"
                color={colors.primary}
                style={{ marginVertical: spacing.md }}
            />
        );
    }, [loadingMore]);

    const ListEmptyComponent = useCallback(
        () => (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: spacing.xxl }}>
                <Ionicons name="time-outline" size={48} color={colors.gray300} />
                <Text style={commonStyles.errorText}>
                    {searchText.trim().length > 0
                        ? t('event:empty.searchNoResults')
                        : t('event:empty.past')}
                </Text>
            </View>
        ),
        [t, searchText]
    );

    return (
        <>
            {/* ✅ SEARCH BAR */}
            <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm }}>
                <SearchInput
                    placeholder={t('details:participant.search')}
                    value={searchText}
                    onChangeText={setSearchText}
                    icon="search"
                />
            </View>

            {/* ✅ SEARCHING INDICATOR */}
            {searching && (
                <View style={{ marginTop: spacing.lg, alignItems: 'center' }}>
                    <ActivityIndicator size="small" color={colors.primary} />
                </View>
            )}

            {/* ✅ RESULTS LIST */}
            <FlatList
                data={displayEvents}
                keyExtractor={keyExtractor}
                renderItem={renderItem}
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.5}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{
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