import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, StatusBar, Dimensions, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { AppHeader } from '../../components/common/AppHeader';
import { colors, commonStyles, spacing } from '../../styles/common.styles';
import { eventStyles } from '../../styles/event';
import PastTab from './PastTab';
import LiveTab from './LiveTab';
import UpcomingTab from './UpcomingTab';
import { eventService, EventItem, ParticipantItem } from '../../services/followerEvent';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { API_CONFIG } from '../../constants/config';
import SearchInput from '../../components/SearchInput';
import FanEventCard from './FollowerCard';
import { FollowerEventpops } from '../../types/navigation';
import { useFollowManager } from '../../hooks/useFollowManager'; // ✅ IMPORT HOOK

type Tab = 'Past' | 'Live' | 'Upcoming';
const TABS: Tab[] = ['Past', 'Live', 'Upcoming'];
const { width, height } = Dimensions.get('window');
const TAB_CONTENT_HEIGHT = height * 0.39;

const FanEvent: React.FC<FollowerEventpops> = ({ navigation }) => {
    const { t } = useTranslation(['follower', 'common']);
    
    // ✅ USE FOLLOW MANAGER HOOK
    const { isFollowed, isLoading: isFollowLoading, toggleFollow } = useFollowManager(t);
    
    const [activeTab, setActiveTab] = useState<Tab>('Live');
    const [loading, setLoading] = useState(true);
    const [searchResults, setSearchResults] = useState<ParticipantItem[]>([]);
    const [searching, setSearching] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pastEvents, setPastEvents] = useState<EventItem[]>([]);
    const [liveEvents, setLiveEvents] = useState<EventItem[]>([]);
    const [upcomingEvents, setUpcomingEvents] = useState<EventItem[]>([]);
    const [participants, setParticipants] = useState<ParticipantItem[]>([]);
    const [searchText, setSearchText] = useState('');
    const [loadingMorePast, setLoadingMorePast] = useState(false);
    const [loadingMoreLive, setLoadingMoreLive] = useState(false);
    const [loadingMoreUpcoming, setLoadingMoreUpcoming] = useState(false);
    const [loadingMoreParticipant, setLoadingMoreParticipant] = useState(false);
    const [paginationInfo, setPaginationInfo] = useState({
        past: { page: 1, total_pages: 1 },
        live: { page: 1, total_pages: 1 },
        upcoming: { page: 1, total_pages: 1 },
        participants: { page: 1, total_pages: 1 },
    });
    
    const flatListRef = useRef<FlatList>(null);
    const isInitialMount = useRef(true);
    const isFetching = useRef(false);
    const debounceTimer = useRef<NodeJS.Timeout | null>(null);

    // ✅ FETCH EVENTS
    const fetchEvents = useCallback(async (search: string) => {
        if (isFetching.current) {
            if (API_CONFIG.DEBUG) {
                console.log('⏸️ Fetch already in progress');
            }
            return;
        }
        
        try {
            isFetching.current = true;
            
            if (isInitialMount.current) {
                setLoading(true);
            }
            
            setError(null);

            if (API_CONFIG.DEBUG) {
                console.log('📡 Fetching events');
            }

            const result = await eventService.getEvents({
                page_past: 1,
                page_live: 1,
                page_upcoming: 1,
                filter_name_past: search,
                is_participant: "1",
                page_participant: 1,
                filter_name_participant: '',
            });

            setPastEvents(result.tabs.past);
            setLiveEvents(result.tabs.live);
            setUpcomingEvents(result.tabs.upcoming);
            setParticipants(result.participants || []);

            if (result.pagination) {
                setPaginationInfo({
                    past: { 
                        page: result.pagination.past.page, 
                        total_pages: result.pagination.past.total_pages 
                    },
                    live: { 
                        page: result.pagination.live.page, 
                        total_pages: result.pagination.live.total_pages 
                    },
                    upcoming: { 
                        page: result.pagination.upcoming.page, 
                        total_pages: result.pagination.upcoming.total_pages 
                    },
                    participants: { 
                        page: result.pagination?.participants?.page ?? 1, 
                        total_pages: result.pagination?.participants?.total_pages ?? 1 
                    },
                });
            }

            if (API_CONFIG.DEBUG) {
                console.log('✅ Events loaded:', {
                    past: result.tabs.past.length,
                    live: result.tabs.live.length,
                    upcoming: result.tabs.upcoming.length,
                    participants: (result.participants || []).length,
                });
            }
        } catch (err: any) {
            if (API_CONFIG.DEBUG) {
                console.error('❌ Fetch events failed:', err);
            }
            setError(err.message || t('follower:error.failed'));
        } finally {
            setLoading(false);
            isFetching.current = false;
        }
    }, [t]);

    // ✅ FOCUS EFFECT (EXACT PARTICIPANTEVENT PATTERN)
    useFocusEffect(
        useCallback(() => {
            if (isFetching.current) {
                if (API_CONFIG.DEBUG) {
                    console.log('⏸️ Already fetching, skipping duplicate call');
                }
                return;
            }

            const fetchAndSync = async () => {
                await fetchEvents('');

                // ✅ SYNC SCROLL TO ACTIVE TAB AFTER FETCH
                if (!isInitialMount.current) {
                    if (API_CONFIG.DEBUG) {
                        console.log('🔄 Syncing scroll to:', activeTab);
                    }
                    const index = TABS.indexOf(activeTab);
                    setTimeout(() => {
                        flatListRef.current?.scrollToIndex({ index, animated: false });
                    }, 100);
                }
            };

            fetchAndSync();

            if (isInitialMount.current) {
                isInitialMount.current = false;
            }

            return () => {
                isFetching.current = false;
            };
        }, [fetchEvents, activeTab])
    );

    // ✅ LOAD MORE PAST
    const loadMorePast = useCallback(async () => {
        if (loadingMorePast || paginationInfo.past.page >= paginationInfo.past.total_pages) {
            return;
        }
        
        try {
            setLoadingMorePast(true);
            const nextPage = paginationInfo.past.page + 1;
            
            if (API_CONFIG.DEBUG) {
                console.log(`📡 Past: Loading page ${nextPage}`);
            }
            
            const result = await eventService.getEvents({
                page_past: nextPage,
            });

            setPastEvents((prev) => {
                const existingIds = new Set(prev.map((e) => e.product_app_id));
                const newItems = result.tabs.past.filter((item) => !existingIds.has(item.product_app_id));

                if (API_CONFIG.DEBUG) {
                    console.log(`➕ Past: Adding ${newItems.length} new events`);
                }
                
                return [...prev, ...newItems];
            });
            
            if (result.pagination?.past) {
                setPaginationInfo((prev) => ({
                    ...prev,
                    past: {
                        page: nextPage,
                        total_pages: result.pagination.past.total_pages,
                    },
                }));
            }
        } catch (error) {
            if (API_CONFIG.DEBUG) {
                console.error('❌ Past: Load more failed:', error);
            }
        } finally {
            setLoadingMorePast(false);
        }
    }, [loadingMorePast, paginationInfo.past.page, paginationInfo.past.total_pages]);

    // ✅ LOAD MORE LIVE
    const loadMoreLive = useCallback(async () => {
        if (loadingMoreLive || paginationInfo.live.page >= paginationInfo.live.total_pages) {
            return;
        }
        
        try {
            setLoadingMoreLive(true);
            const nextPage = paginationInfo.live.page + 1;
            
            if (API_CONFIG.DEBUG) {
                console.log(`📡 Live: Loading page ${nextPage}`);
            }
            
            const result = await eventService.getEvents({
                page_live: nextPage,
            });
            
            setLiveEvents((prev) => {
                const existingIds = new Set(prev.map((e) => e.product_app_id));
                const newItems = result.tabs.live.filter((item) => !existingIds.has(item.product_app_id));
                
                if (API_CONFIG.DEBUG) {
                    console.log(`➕ Live: Adding ${newItems.length} new events`);
                }
                
                return [...prev, ...newItems];
            });

            if (result.pagination?.live) {
                setPaginationInfo((prev) => ({
                    ...prev,
                    live: {
                        page: nextPage,
                        total_pages: result.pagination.live.total_pages,
                    },
                }));
            }
        } catch (error) {
            if (API_CONFIG.DEBUG) {
                console.error('❌ Live: Load more failed:', error);
            }
        } finally {
            setLoadingMoreLive(false);
        }
    }, [loadingMoreLive, paginationInfo.live.page, paginationInfo.live.total_pages]);

    // ✅ LOAD MORE UPCOMING
    const loadMoreUpcoming = useCallback(async () => {
        if (loadingMoreUpcoming || paginationInfo.upcoming.page >= paginationInfo.upcoming.total_pages) {
            return;
        }
        
        try {
            setLoadingMoreUpcoming(true);
            const nextPage = paginationInfo.upcoming.page + 1;

            if (API_CONFIG.DEBUG) {
                console.log(`📡 Upcoming: Loading page ${nextPage}`);
            }
            
            const result = await eventService.getEvents({
                page_upcoming: nextPage,
            });
            
            setUpcomingEvents((prev) => {
                const existingIds = new Set(prev.map((e) => e.product_app_id));
                const newItems = result.tabs.upcoming.filter((item) => !existingIds.has(item.product_app_id));

                if (API_CONFIG.DEBUG) {
                    console.log(`➕ Upcoming: Adding ${newItems.length} new events`);
                }

                return [...prev, ...newItems];
            });

            if (result.pagination?.upcoming) {
                setPaginationInfo((prev) => ({
                    ...prev,
                    upcoming: {
                        page: nextPage,
                        total_pages: result.pagination.upcoming.total_pages,
                    },
                }));
            }
        } catch (error) {
            if (API_CONFIG.DEBUG) {
                console.error('❌ Upcoming: Load more failed:', error);
            }
        } finally {
            setLoadingMoreUpcoming(false);
        }
    }, [loadingMoreUpcoming, paginationInfo.upcoming.page, paginationInfo.upcoming.total_pages]);

    // ✅ LOAD MORE PARTICIPANTS
    const loadMoreParticipant = useCallback(async () => {
        if (loadingMoreParticipant || paginationInfo.participants.page >= paginationInfo.participants.total_pages) {
            return;
        }

        try {
            setLoadingMoreParticipant(true);
            const nextPage = paginationInfo.participants.page + 1;
            
            if (API_CONFIG.DEBUG) {
                console.log(`📡 Participants: Loading page ${nextPage}`);
            }
            
            const result = await eventService.getEvents({
                is_participant: '1',
                page_participant: nextPage,
                filter_name_participant: searchText,
            });
            
            setParticipants(prev => {
                const ids = new Set(prev.map(e => e.customer_app_id));
                const newItems = (result.participants || []).filter(i => !ids.has(i.customer_app_id));
                
                if (API_CONFIG.DEBUG) {
                    console.log(`➕ Participants: Adding ${newItems.length} new items`);
                }
                
                return [...prev, ...newItems];
            });
            
            setPaginationInfo(prev => ({
                ...prev,
                participants: {
                    page: nextPage,
                    total_pages: result.pagination?.participants?.total_pages ?? prev.participants.total_pages,
                },
            }));
        } catch (err) {
            if (API_CONFIG.DEBUG) {
                console.error('❌ Participant: Load more failed:', err);
            }
        } finally {
            setLoadingMoreParticipant(false);
        }
    }, [loadingMoreParticipant, paginationInfo.participants, searchText]);

    // ✅ TAB HANDLERS
    const handleTabPress = useCallback((tab: Tab) => {
        const index = TABS.indexOf(tab);
        setActiveTab(tab);
        flatListRef.current?.scrollToIndex({ index, animated: true });
    }, []);

    const handleSwipe = useCallback((e: any) => {
        const index = Math.round(e.nativeEvent.contentOffset.x / width);
        if (TABS[index] && TABS[index] !== activeTab) {
            setActiveTab(TABS[index]);
        }
    }, [activeTab]);

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
                
                if (API_CONFIG.DEBUG) {
                    console.log('🔍 Searching participants:', searchText);
                }
                
                const result = await eventService.getEvents({
                    is_participant: '1',
                    page_participant: 1,
                    filter_name_participant: searchText,
                });
                
                setSearchResults(result.participants || []);
                
                if (API_CONFIG.DEBUG) {
                    console.log('✅ Search results:', (result.participants || []).length);
                }
            } catch (error) {
                if (API_CONFIG.DEBUG) {
                    console.error('❌ Search failed:', error);
                }
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

    const displayEvents = searchText.trim().length > 0 ? searchResults : participants;

    // ✅ HANDLE LOAD MORE PARTICIPANTS
    const handleLoadMoreParticipant = useCallback(() => {
        if (searchText.trim().length > 0) return;
        
        if (API_CONFIG.DEBUG) {
            console.log('🔍 Participant onEndReached:', {
                hasMore: paginationInfo.participants.page < paginationInfo.participants.total_pages,
                loadingMore: loadingMoreParticipant,
                participantsCount: participants.length,
            });
        }
        
        if (paginationInfo.participants.page < paginationInfo.participants.total_pages && !loadingMoreParticipant) {
            if (API_CONFIG.DEBUG) {
                console.log('✅ Calling loadMoreParticipant');
            }
            loadMoreParticipant();
        }
    }, [paginationInfo.participants, loadingMoreParticipant, loadMoreParticipant, participants.length, searchText]);

    // ✅ RENDER PARTICIPANT CARD
    const renderParticipantCard = useCallback(
        ({ item }: { item: ParticipantItem }) => (
            <FanEventCard
                item={item}
                isFollowed={isFollowed(item.customer_app_id)}
                isFollowLoading={isFollowLoading(item.customer_app_id)}
                onToggleFollow={() => toggleFollow(item.customer_app_id)}
            />
        ),
        [isFollowed, isFollowLoading, toggleFollow]
    );

    // ✅ LOADING STATE
    if (loading) {
        return (
            <SafeAreaView style={commonStyles.container} edges={['top']}>
                <StatusBar barStyle="dark-content" />
                <AppHeader showLogo={true} />
                <View style={commonStyles.centerContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            </SafeAreaView>
        );
    }

    // ✅ ERROR STATE
    if (error) {
        return (
            <SafeAreaView style={commonStyles.container} edges={['top']}>
                <StatusBar barStyle="dark-content" />
                <AppHeader showLogo={true} />
                <View style={commonStyles.centerContainer}>
                    <Text style={commonStyles.errorText}>{error}</Text>
                    <TouchableOpacity
                        style={[commonStyles.primaryButton, { marginTop: spacing.lg }]}
                        onPress={() => fetchEvents('')}
                        activeOpacity={0.8}
                    >
                        <Text style={commonStyles.primaryButtonText}>
                            {t('follower:error.retry')}
                        </Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={commonStyles.container} edges={['top']}>
            <StatusBar barStyle="dark-content" />
            <AppHeader showLogo={true} />
            
            <View style={{ flex: 1 }}>
                {/* SECTION TITLE */}
                <View style={eventStyles.section}>
                    <Text style={commonStyles.title}>{t('follower:official.title')}</Text>
                </View>

                {/* TAB BAR */}
                <View style={eventStyles.tabBar}>
                    {TABS.map((tab) => (
                        <TouchableOpacity
                            key={tab}
                            style={eventStyles.tabItem}
                            onPress={() => handleTabPress(tab)}
                            activeOpacity={0.7}
                        >
                            <Text style={[
                                commonStyles.subtitle, 
                                activeTab === tab && eventStyles.activeTabText
                            ]}>
                                {t(`follower:live.${tab}`)}
                            </Text>
                            {activeTab === tab && (
                                <LinearGradient
                                    colors={['#e8341a', '#f4a100', '#1a73e8']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={eventStyles.underline}
                                />
                            )}
                        </TouchableOpacity>
                    ))}
                </View>

                {/* TAB CONTENT */}
                <View style={{ height: TAB_CONTENT_HEIGHT }}>
                    <FlatList
                        ref={flatListRef}
                        data={TABS}
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        keyExtractor={(item) => item}
                        onMomentumScrollEnd={handleSwipe}
                        initialScrollIndex={TABS.indexOf('Live')}
                        scrollEnabled={true}
                        getItemLayout={(_, index) => ({
                            length: width,
                            offset: width * index,
                            index,
                        })}
                        renderItem={({ item }) => (
                            <View style={{ width }}>
                                {item === 'Past' && (
                                    <PastTab
                                        events={pastEvents}
                                        onLoadMore={loadMorePast}
                                        loadingMore={loadingMorePast}
                                        hasMore={paginationInfo.past.page < paginationInfo.past.total_pages}
                                    />
                                )}
                                {item === 'Live' && (
                                    <LiveTab
                                        events={liveEvents}
                                        onLoadMore={loadMoreLive}
                                        loadingMore={loadingMoreLive}
                                        hasMore={paginationInfo.live.page < paginationInfo.live.total_pages}
                                    />
                                )}
                                {item === 'Upcoming' && (
                                    <UpcomingTab
                                        events={upcomingEvents}
                                        onLoadMore={loadMoreUpcoming}
                                        loadingMore={loadingMoreUpcoming}
                                        hasMore={paginationInfo.upcoming.page < paginationInfo.upcoming.total_pages}
                                    />
                                )}
                            </View>
                        )}
                    />
                </View>

                {/* PARTICIPANTS SECTION */}
                <View style={[eventStyles.section, { marginBottom: spacing.md, marginTop: spacing.sm }]}>
                    <Text style={commonStyles.title}>{t('follower:personal.title')}</Text>
                </View>

                {/* PARTICIPANTS LIST */}
                <FlatList
                    data={displayEvents}
                    keyExtractor={(item, index) => `${item.customer_app_id}_${index}`}
                    renderItem={renderParticipantCard}
                    onEndReached={handleLoadMoreParticipant}
                    onEndReachedThreshold={0.5}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{
                        paddingHorizontal: spacing.md,
                        paddingBottom: spacing.xxxl,
                    }}
                    keyboardShouldPersistTaps="handled"
                    removeClippedSubviews={false}
                    ListHeaderComponent={
                        <>
                            <SearchInput
                                placeholder={t('details:participant.search')}
                                value={searchText}
                                onChangeText={setSearchText}
                                icon="search"
                            />
                            {searching && (
                                <View style={{ marginTop: spacing.lg, alignItems: 'center' }}>
                                    <ActivityIndicator size="small" color={colors.primary} />
                                </View>
                            )}
                        </>
                    }
                    ListEmptyComponent={
                        <View style={{ marginTop: 40, alignItems: 'center' }}>
                            <Text style={commonStyles.errorText}>
                                {searchText.trim().length > 0
                                    ? t('follower:empty.searchNoResults')
                                    : t('details:participant.empty')}
                            </Text>
                        </View>
                    }
                    ListFooterComponent={
                        loadingMoreParticipant ? (
                            <ActivityIndicator 
                                size="small" 
                                color={colors.primary} 
                                style={{ marginVertical: spacing.md }} 
                            />
                        ) : null
                    }
                />
            </View>
        </SafeAreaView>
    );
};

export default FanEvent;