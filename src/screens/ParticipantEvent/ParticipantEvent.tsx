import React, { useState, useRef, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    FlatList,
    ActivityIndicator,
    Dimensions,
    StatusBar,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { AppHeader } from '../../components/common/AppHeader';
import { commonStyles, spacing, colors } from '../../styles/common.styles';
import { eventStyles } from '../../styles/event';
import { homeStyles } from '../../styles/home.styles';
import PastTab from './PastTab';
import LiveTab from './LiveTab';
import UpcomingTab from './UpcomingTab';
import { eventService, EventItem } from '../../services/eventService';
import { ParticipantEventProps } from '../../types/navigation';
import { API_CONFIG } from '../../constants/config';
import { tokenService } from '../../services/tokenService';
import ErrorScreen from '../../components/ErrorScreen';
import { useScreenError } from '../../hooks/useApiError';
import FanEventCard from '../FollowerEventList/FollowerCard';


const { width, height } = Dimensions.get('window');

type Tab = 'Past' | 'Live' | 'Upcoming';
const TABS: Tab[] = ['Past', 'Live', 'Upcoming'];
const TAB_CONTENT_HEIGHT = height * 0.5;

const ParticipantEvent: React.FC<ParticipantEventProps> = ({ navigation }) => {
    const { t } = useTranslation(['event', 'common']);
    const flatListRef = useRef<FlatList>(null);
    const [activeTab, setActiveTab] = useState<Tab>('Live');
    const [pastEvents, setPastEvents] = useState<EventItem[]>([]);
    const [liveEvents, setLiveEvents] = useState<EventItem[]>([]);
    const [upcomingEvents, setUpcomingEvents] = useState<EventItem[]>([]);
    const [loading, setLoading] = useState(true);
    //const [error, setError] = useState<string | null>(null);

    const [loadingMorePast, setLoadingMorePast] = useState(false);
    const [loadingMoreLive, setLoadingMoreLive] = useState(false);
    const [loadingMoreUpcoming, setLoadingMoreUpcoming] = useState(false);

    const [paginationInfo, setPaginationInfo] = useState({
        past: { page: 1, total_pages: 1 },
        live: { page: 1, total_pages: 1 },
        upcoming: { page: 1, total_pages: 1 },
    });

    // ✅ PREVENT DUPLICATE CALLS
    const isInitialMount = useRef(true);
    const isFetching = useRef(false);

    const { error, hasError, handleApiError, clearError } = useScreenError();

    // ✅ FETCH DATA AND SYNC SCROLL
    useFocusEffect(
        useCallback(() => {
            // Skip if already fetching
            if (isFetching.current) {
                if (API_CONFIG.DEBUG) {
                    console.log('⏸️ Already fetching, skipping duplicate call');
                }
                return;
            }

            // ✅ FETCH DATA (BOTH INITIAL AND ON RETURN)
            const fetchAndSync = async () => {
                await fetchEvents();

                // ✅ AFTER FETCH, SYNC SCROLL TO ACTIVE TAB
                if (!isInitialMount.current) {
                    if (API_CONFIG.DEBUG) {
                        console.log('🔄 Syncing scroll to:', activeTab);
                    }
                    const index = TABS.indexOf(activeTab);
                    setTimeout(() => {
                        flatListRef.current?.scrollToIndex({ index, animated: false });
                    }, 100); // ✅ Slightly longer delay to ensure data is rendered
                }
            };

            fetchAndSync();

            if (isInitialMount.current) {
                isInitialMount.current = false;
            }

            return () => {
                // Cleanup
                isFetching.current = false;
            };
        }, [activeTab]) // ✅ Depend on activeTab to preserve selection
    );

    const fetchEvents = useCallback(async () => {
        if (isFetching.current) {
            if (API_CONFIG.DEBUG) {
                console.log('⏸️ Fetch already in progress');
            }
            return;
        }

        try {
            isFetching.current = true;

            // ✅ ONLY SHOW LOADING ON INITIAL MOUNT
            if (isInitialMount.current) {
                setLoading(true);
            }

            clearError();

            if (API_CONFIG.DEBUG) {
                console.log('📡 Fetching events');
            }

            const result = await eventService.getEvents({
                page_past: 1,
                page_live: 1,
                page_upcoming: 1,
            });

            setPastEvents(result.tabs.past);
            setLiveEvents(result.tabs.live);
            setUpcomingEvents(result.tabs.upcoming);

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
                });
            }

            if (API_CONFIG.DEBUG) {
                console.log('✅ Events loaded:', {
                    past: result.tabs.past.length,
                    live: result.tabs.live.length,
                    upcoming: result.tabs.upcoming.length,
                });
            }
        } catch (error: any) {
            console.log('❌ Failed to fetch events:', error);
            handleApiError(error);
        } finally {
            setLoading(false);
            isFetching.current = false;
        }
    }, [t]);

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
            console.log('❌ Past: Load more failed:', error);
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
            console.log('❌ Live: Load more failed:', error);
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
            console.log('❌ Upcoming: Load more failed:', error);
        } finally {
            setLoadingMoreUpcoming(false);
        }
    }, [loadingMoreUpcoming, paginationInfo.upcoming.page, paginationInfo.upcoming.total_pages]);

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

    const handlePersonalEventPress = useCallback(async () => {
        try {
            const token = await tokenService.getToken();
            if (token !== null && token !== '') {
                navigation.navigate('PersonalEvent');
                return;
            }
            navigation.navigate('LoginScreen');
        } catch (error) {
            console.log('❌ Token check failed:', error);
            navigation.navigate('RegisterScreen');
        }
    }, [navigation]);

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
    if (hasError && !loading) {
        return (
            <SafeAreaView style={commonStyles.container} edges={['top']}>
                <StatusBar barStyle="dark-content" />
                <AppHeader />
                <ErrorScreen
                    type={error!.type}
                    title={error!.title}
                    message={error!.message}
                    onRetry={() => { clearError(); fetchEvents(); }}
                />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={commonStyles.container} edges={['top']}>
            <StatusBar barStyle="dark-content" />
            <AppHeader showLogo={true} />
            <ScrollView
                style={{ flex: 1 }}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ flexGrow: 1 }}
                keyboardShouldPersistTaps="handled"
            >
                <View style={{ flex: 1 }}>
                    <View style={eventStyles.section}>
                        <Text style={commonStyles.title}>{t('event:official.title')}</Text>
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
                                <Text
                                    style={[
                                        commonStyles.subtitle,
                                        activeTab === tab && eventStyles.activeTabText,
                                    ]}
                                >
                                    {t(`event:live.${tab}`)}
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

                    {/* PERSONAL EVENT SECTION */}
                    <View style={[eventStyles.section, { marginBottom: 0, marginTop: spacing.sm }]}>
                        <Text style={commonStyles.title}>{t('event:personal.title')}</Text>
                    </View>
                    <View
                        style={[
                            commonStyles.card,
                            {
                                marginHorizontal: spacing.md,
                                padding: 0,
                                overflow: 'hidden',
                                marginBottom: spacing.xl,
                            },
                        ]}
                    >
                        <View style={eventStyles.header}>
                            <Text style={[homeStyles.heading, { marginBottom: 0 }]}>
                                {t('event:personal.description')}
                            </Text>
                        </View>
                        <TouchableOpacity
                            style={[commonStyles.primaryButton, { borderRadius: 0 }]}
                            onPress={handlePersonalEventPress}
                            activeOpacity={0.8}
                        >
                            <Text style={commonStyles.primaryButtonText}>{t('personal.button')}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

export default ParticipantEvent;