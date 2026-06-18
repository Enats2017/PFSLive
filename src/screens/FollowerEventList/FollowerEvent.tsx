import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    FlatList,
    StatusBar,
    Dimensions,
    ActivityIndicator,
    Keyboard,
    KeyboardEvent,
    Platform,
    Animated,
    useWindowDimensions,
} from 'react-native';
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
import { FollowerEventpops } from '../../types/navigation';
import ErrorScreen from '../../components/ErrorScreen';
import { useScreenError } from '../../hooks/useApiError';
import { useDimensions } from '../../hooks/useDimensions';

type Tab = 'Past' | 'Live' | 'Upcoming';
const TABS: Tab[] = ['Past', 'Live', 'Upcoming'];

const FanEvent: React.FC<FollowerEventpops> = ({ navigation, route }) => {
    const { t } = useTranslation(['follower', 'common']);
    const { width: windowWidth } = useDimensions();
    const [containerWidth, setContainerWidth] = useState(0);
    const width = containerWidth || windowWidth;
    const initialTab = (route.params?.initialTab) as Tab;
    const [activeTab, setActiveTab] = useState(initialTab);
    const [loading, setLoading] = useState(true);
    const [searchResults, setSearchResults] = useState<ParticipantItem[]>([]);
    const [searching, setSearching] = useState(false);
    const [pastEvents, setPastEvents] = useState<EventItem[]>([]);
    const [liveEvents, setLiveEvents] = useState<EventItem[]>([]);
    const [upcomingEvents, setUpcomingEvents] = useState<EventItem[]>([]);
    const [participants, setParticipants] = useState<ParticipantItem[]>([]);
    const [searchText, setSearchText] = useState('');
    const [searchPagination, setSearchPagination] = useState({ page: 1, total_pages: 1 });
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
    const participantSearchFocused = useRef(false);
    const keyboardOffset = useRef(new Animated.Value(0)).current;
    const isLoadingMoreSearch = useRef(false);
    const activeTabRef = useRef<Tab>(initialTab ?? 'Upcoming');

    const { error, hasError, handleApiError, clearError } = useScreenError();

    useEffect(() => {
        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

        const onShow = (e: KeyboardEvent) => {
            if (!participantSearchFocused.current) return; // ← add this line
            Animated.timing(keyboardOffset, {
                toValue: e.endCoordinates.height,
                duration: Platform.OS === 'ios' ? (e.duration ?? 250) : 200,
                useNativeDriver: true,
            }).start();
        };

        const onHide = (e: KeyboardEvent) => {
            Animated.timing(keyboardOffset, {
                toValue: 0,
                duration: Platform.OS === 'ios' ? (e.duration ?? 250) : 200,
                useNativeDriver: true,
            }).start();
        };
        const showSub = Keyboard.addListener(showEvent, onShow);
        const hideSub = Keyboard.addListener(hideEvent, onHide);
        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, [keyboardOffset]);

    const fetchEvents = useCallback(async (search: string) => {
        if (isFetching.current) {
            if (API_CONFIG.DEBUG) console.log('⏸️ Fetch already in progress');
            return;
        }
        try {
            isFetching.current = true;
            if (isInitialMount.current) setLoading(true);
            clearError();
            if (API_CONFIG.DEBUG) console.log('📡 Fetching events');
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
                        total_pages: result.pagination.past.total_pages,
                    },
                    live: {
                        page: result.pagination.live.page,
                        total_pages: result.pagination.live.total_pages,
                    },
                    upcoming: {
                        page: result.pagination.upcoming.page,
                        total_pages: result.pagination.upcoming.total_pages,
                    },
                    participants: {
                        page: result.pagination?.participants?.page ?? 1,
                        total_pages: result.pagination?.participants?.total_pages ?? 1,
                    },
                });
            }

            if (API_CONFIG.DEBUG) {
                console.log('Events loaded:', {
                    past: result.tabs.past.length,
                    live: result.tabs.live.length,
                    upcoming: result.tabs.upcoming.length,
                    participants: (result.participants || []).length,
                });
            }
        } catch (err: any) {
            if (API_CONFIG.DEBUG) console.error('❌ Fetch events failed:', err);
            handleApiError(err);
        } finally {
            setLoading(false);
            isFetching.current = false;
        }
    }, [t]);

    useEffect(() => {
        activeTabRef.current = activeTab;
    }, [activeTab]);

    useFocusEffect(
        useCallback(() => {
            if (isFetching.current) {
                if (API_CONFIG.DEBUG) console.log('⏸️ Already fetching, skipping duplicate call');
                return;
            }
            const fetchAndSync = async () => {                
                await fetchEvents('');
                if (!isInitialMount.current) {
                    if (API_CONFIG.DEBUG) console.log('🔄 Syncing scroll to:', activeTab);
                    const index = TABS.indexOf(activeTabRef.current);
                    setTimeout(() => {
                        flatListRef.current?.scrollToIndex({ index, animated: false });
                    }, 100);
                }
            };
            fetchAndSync();
            if (isInitialMount.current) isInitialMount.current = false;
            return () => { isFetching.current = false; };
        }, [fetchEvents])
    );

    const loadMorePast = useCallback(async () => {
        if (loadingMorePast || paginationInfo.past.page >= paginationInfo.past.total_pages) return;

        try {
            setLoadingMorePast(true);
            const nextPage = paginationInfo.past.page + 1;
            if (API_CONFIG.DEBUG) console.log(`📡 Past: Loading page ${nextPage}`);

            const result = await eventService.getEvents({ page_past: nextPage, filter_name_past: searchText });

            setPastEvents((prev) => {
                const existingIds = new Set(prev.map((e) => e.product_app_id));
                const newItems = result.tabs.past.filter((item) => !existingIds.has(item.product_app_id));
                if (API_CONFIG.DEBUG) console.log(`➕ Past: Adding ${newItems.length} new events`);
                return [...prev, ...newItems];
            });

            if (result.pagination?.past) {
                setPaginationInfo((prev) => ({
                    ...prev,
                    past: { page: nextPage, total_pages: result.pagination.past.total_pages },
                }));
            }
        } catch (error) {
            if (API_CONFIG.DEBUG) console.error('❌ Past: Load more failed:', error);
        } finally {
            setLoadingMorePast(false);
        }
    }, [loadingMorePast, paginationInfo.past.page, paginationInfo.past.total_pages]);

    const loadMoreLive = useCallback(async () => {
        if (loadingMoreLive || paginationInfo.live.page >= paginationInfo.live.total_pages) return;

        try {
            setLoadingMoreLive(true);
            const nextPage = paginationInfo.live.page + 1;
            if (API_CONFIG.DEBUG) console.log(`📡 Live: Loading page ${nextPage}`);

            const result = await eventService.getEvents({ page_live: nextPage });

            setLiveEvents((prev) => {
                const existingIds = new Set(prev.map((e) => e.product_app_id));
                const newItems = result.tabs.live.filter((item) => !existingIds.has(item.product_app_id));
                if (API_CONFIG.DEBUG) console.log(`➕ Live: Adding ${newItems.length} new events`);
                return [...prev, ...newItems];
            });

            if (result.pagination?.live) {
                setPaginationInfo((prev) => ({
                    ...prev,
                    live: { page: nextPage, total_pages: result.pagination.live.total_pages },
                }));
            }
        } catch (error) {
            if (API_CONFIG.DEBUG) console.error('❌ Live: Load more failed:', error);
        } finally {
            setLoadingMoreLive(false);
        }
    }, [loadingMoreLive, paginationInfo.live.page, paginationInfo.live.total_pages]);

    const loadMoreUpcoming = useCallback(async () => {
        if (loadingMoreUpcoming || paginationInfo.upcoming.page >= paginationInfo.upcoming.total_pages) return;
        try {
            setLoadingMoreUpcoming(true);
            const nextPage = paginationInfo.upcoming.page + 1;
            if (API_CONFIG.DEBUG) console.log(`📡 Upcoming: Loading page ${nextPage}`);
            const result = await eventService.getEvents({ page_upcoming: nextPage });
            setUpcomingEvents((prev) => {
                const existingIds = new Set(prev.map((e) => e.product_app_id));
                const newItems = result.tabs.upcoming.filter((item) => !existingIds.has(item.product_app_id));
                if (API_CONFIG.DEBUG) console.log(`➕ Upcoming: Adding ${newItems.length} new events`);
                return [...prev, ...newItems];
            });

            if (result.pagination?.upcoming) {
                setPaginationInfo((prev) => ({
                    ...prev,
                    upcoming: { page: nextPage, total_pages: result.pagination.upcoming.total_pages },
                }));
            }
        } catch (error) {
            if (API_CONFIG.DEBUG) console.error('❌ Upcoming: Load more failed:', error);
        } finally {
            setLoadingMoreUpcoming(false);
        }
    }, [loadingMoreUpcoming, paginationInfo.upcoming.page, paginationInfo.upcoming.total_pages]);



    const handleTabPress = useCallback((tab: Tab) => {
        const index = TABS.indexOf(tab);
        activeTabRef.current = tab;   
        setActiveTab(tab);
        flatListRef.current?.scrollToIndex({ index, animated: true });
    }, []);

    const handleSwipe = useCallback((e: any) => {
        const index = Math.round(e.nativeEvent.contentOffset.x / width);
        const swipedTab = TABS[index];
        if (swipedTab && swipedTab !== activeTabRef.current) {
            activeTabRef.current = swipedTab;  
            setActiveTab(swipedTab);
        }
    }, [width]);

    const handleLayout = useCallback(() => {
        const index = TABS.indexOf(activeTabRef.current);
        flatListRef.current?.scrollToIndex({ index, animated: false });
    }, []);

    useEffect(() => {
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        if (searchText.trim().length === 0) {
            setSearchResults([]);
            return;
        }
        isLoadingMoreSearch.current = false;
        setSearchResults([]);
        setSearchPagination({ page: 1, total_pages: 1 });
        debounceTimer.current = setTimeout(async () => {
            try {
                setSearching(true);
                if (API_CONFIG.DEBUG) console.log('🔍 Searching participants:', searchText);
                const result = await eventService.getEvents({
                    is_participant: '1',
                    page_participant: 1,
                    filter_name_participant: searchText,
                });
                setSearchResults(result.participants || []);
                setSearchPagination({
                    page: 1,
                    total_pages: result.pagination?.participants?.total_pages ?? 1,
                });
                if (API_CONFIG.DEBUG) console.log('search results:', (result.participants || []).length);
            } catch (error) {
                if (API_CONFIG.DEBUG) console.error('❌ Search failed:', error);
            } finally {
                setSearching(false);
            }
        }, 500);

        return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
    }, [searchText]);

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

    if (hasError && !loading) {
        return (
            <SafeAreaView style={commonStyles.container} edges={['top']}>
                <StatusBar barStyle="dark-content" />
                <AppHeader />
                <ErrorScreen
                    type={error!.type}
                    title={error!.title}
                    message={error!.message}
                    onRetry={() => { clearError(); fetchEvents(''); }}
                />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={commonStyles.container} edges={['top']}>
            <StatusBar barStyle="dark-content" />
            <AppHeader showLogo={true} />
            <Animated.View
                style={{
                    flex: 1,
                    transform: [{ translateY: Animated.multiply(keyboardOffset, -1) }],
                }}
                onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
            >
                <View style={eventStyles.section}>
                    <Text style={eventStyles.textCenter}>{t('follower:official.title')}</Text>
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
                                activeTab === tab && eventStyles.activeTabText,
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

                <View>
                    <FlatList
                        ref={flatListRef}
                        data={TABS}
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        onLayout={handleLayout}
                        keyExtractor={(item) => item}
                        onMomentumScrollEnd={handleSwipe}
                        initialScrollIndex={TABS.indexOf('Live')}
                        contentContainerStyle={{ paddingBottom: spacing.xxxxl }}
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
            </Animated.View>
        </SafeAreaView>
    );
};

export default FanEvent;