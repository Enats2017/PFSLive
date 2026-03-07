import React, { useState, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, FlatList, StatusBar, Dimensions, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { AppHeader } from '../../components/common/AppHeader';
import { commonStyles, spacing } from '../../styles/common.styles';
import { eventStyles } from '../../styles/event';
import { homeStyles } from '../../styles/home.styles';
import PastTab from './PastTab';
import LiveTab from './LiveTab';
import UpcomingTab from './UpcomingTab';
import { eventService, EventItem } from '../../services/eventService';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { ParticipantEventProps } from '../../types/navigation';
import { API_CONFIG } from '../../constants/config';
import { tokenService } from '../../services/tokenService';

type Tab = 'Past' | 'Live' | 'Upcoming';
const TABS: Tab[] = ['Past', 'Live', 'Upcoming'];
const { width, height } = Dimensions.get('window');
const TAB_CONTENT_HEIGHT = height * 0.5;

const ParticipantEvent: React.FC<ParticipantEventProps> = ({ navigation }) => {
    const { t } = useTranslation(['event', 'common']);
    const [activeTab, setActiveTab] = useState<Tab>('Live');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [pastEvents, setPastEvents] = useState<EventItem[]>([]);
    const [liveEvents, setLiveEvents] = useState<EventItem[]>([]);
    const [upcomingEvents, setUpcomingEvents] = useState<EventItem[]>([]);
    const flatListRef = useRef<FlatList>(null);
    
    const pastSearchQueryRef = useRef('');

    const [loadingMorePast, setLoadingMorePast] = useState(false);
    const [loadingMoreLive, setLoadingMoreLive] = useState(false);
    const [loadingMoreUpcoming, setLoadingMoreUpcoming] = useState(false);

    const [paginationInfo, setPaginationInfo] = useState({
        past: { page: 1, total_pages: 1 },
        live: { page: 1, total_pages: 1 },
        upcoming: { page: 1, total_pages: 1 },
    });

    useFocusEffect(
        useCallback(() => {
            fetchEvents('');
        }, [])
    );

    const fetchEvents = useCallback(async (search: string) => {
        try {
            setLoading(true);
            setError(null);

            if (API_CONFIG.DEBUG) {
                console.log('📡 Fetching events');
            }

            const result = await eventService.getEvents({
                page_past: 1,
                page_live: 1,
                page_upcoming: 1,
                filter_name_past: search,
            });

            setPastEvents(result.tabs.past);
            setLiveEvents(result.tabs.live);
            setUpcomingEvents(result.tabs.upcoming);

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
                });
            }
        } catch (error: any) {
            console.log('❌ Failed to fetch events:', error);
            setError(error.message || t('event:error.failed'));
        } finally {
            setLoading(false);
        }
    }, [t]);

    const handlePastSearch = useCallback((query: string) => {
        pastSearchQueryRef.current = query;
        fetchEvents(query);
    }, [fetchEvents]);

    const loadMorePast = useCallback(async () => {
        if (loadingMorePast || paginationInfo.past.page >= paginationInfo.past.total_pages) {
            return;
        }

        try {
            setLoadingMorePast(true);
            const nextPage = paginationInfo.past.page + 1;

            if (API_CONFIG.DEBUG) {
                console.log(`Past: Loading page ${nextPage}`);
            }

            const result = await eventService.getEvents({
                page_past: nextPage,
                filter_name_past: pastSearchQueryRef.current,
            });

            setPastEvents(prev => {
                const existingIds = new Set(prev.map(e => e.product_app_id));
                const newItems = result.tabs.past.filter(item => !existingIds.has(item.product_app_id));
                return [...prev, ...newItems];
            });

            if (result.pagination?.past) {
                setPaginationInfo(prev => ({
                    ...prev,
                    past: {
                        page: nextPage,
                        total_pages: result.pagination.past.total_pages
                    }
                }));
            }
        } catch (error) {
            console.log('Past: Load more failed:', error);
        } finally {
            setLoadingMorePast(false);
        }
    }, [loadingMorePast, paginationInfo.past.page, paginationInfo.past.total_pages]);

    const loadMoreLive = useCallback(async () => {
        if (loadingMoreLive || paginationInfo.live.page >= paginationInfo.live.total_pages) {
            return;
        }

        try {
            setLoadingMoreLive(true);
            const nextPage = paginationInfo.live.page + 1;

            if (API_CONFIG.DEBUG) {
                console.log(`Live: Loading page ${nextPage}`);
            }

            const result = await eventService.getEvents({ page_live: nextPage });

            setLiveEvents(prev => {
                const existingIds = new Set(prev.map(e => e.product_app_id));
                const newItems = result.tabs.live.filter(item => !existingIds.has(item.product_app_id));
                return [...prev, ...newItems];
            });

            if (result.pagination?.live) {
                setPaginationInfo(prev => ({
                    ...prev,
                    live: {
                        page: nextPage,
                        total_pages: result.pagination.live.total_pages
                    }
                }));
            }
        } catch (error) {
            console.log('Live: Load more failed:', error);
        } finally {
            setLoadingMoreLive(false);
        }
    }, [loadingMoreLive, paginationInfo.live.page, paginationInfo.live.total_pages]);

    const loadMoreUpcoming = useCallback(async () => {
        if (loadingMoreUpcoming || paginationInfo.upcoming.page >= paginationInfo.upcoming.total_pages) {
            return;
        }

        try {
            setLoadingMoreUpcoming(true);
            const nextPage = paginationInfo.upcoming.page + 1;

            if (API_CONFIG.DEBUG) {
                console.log(`Upcoming: Loading page ${nextPage}`);
            }

            const result = await eventService.getEvents({ page_upcoming: nextPage });

            setUpcomingEvents(prev => {
                const existingIds = new Set(prev.map(e => e.product_app_id));
                const newItems = result.tabs.upcoming.filter(item => !existingIds.has(item.product_app_id));
                return [...prev, ...newItems];
            });

            if (result.pagination?.upcoming) {
                setPaginationInfo(prev => ({
                    ...prev,
                    upcoming: {
                        page: nextPage,
                        total_pages: result.pagination.upcoming.total_pages
                    }
                }));
            }
        } catch (error) {
            console.log('Upcoming: Load more failed:', error);
        } finally {
            setLoadingMoreUpcoming(false);
        }
    }, [loadingMoreUpcoming, paginationInfo.upcoming.page, paginationInfo.upcoming.total_pages]);

    const handleTabPress = useCallback((tab: Tab) => {
        const index = TABS.indexOf(tab);
        setActiveTab(tab);
        flatListRef.current?.scrollToIndex({ index, animated: true });
    }, []);

    const handleSwipe = useCallback((e: any) => {
        const index = Math.round(e.nativeEvent.contentOffset.x / width);
        setActiveTab(TABS[index]);
    }, []);

    const handlePersonalEventPress = useCallback(async () => {
        try {
            const token = await tokenService.getToken();
            if (token !== null && token !== '') {
                navigation.navigate('PersonalEvent');
                return;
            }
            navigation.navigate('RegisterScreen');
        } catch (error) {
            console.log('Token check failed:', error);
            navigation.navigate('RegisterScreen');
        }
    }, [navigation]);

    if (loading) {
        return (
            <SafeAreaView style={commonStyles.container} edges={['top']}>
                <StatusBar barStyle="dark-content" />
                <AppHeader showLogo={true} />
                <View style={commonStyles.centerContainer}>
                    <ActivityIndicator size="large" color="#FF5722" />
                </View>
            </SafeAreaView>
        );
    }

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
                    >
                        <Text style={commonStyles.primaryButtonText}>
                            {t('event:error.retry')}
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
                    <View style={eventStyles.tabBar}>
                        {TABS.map((tab) => (
                            <TouchableOpacity
                                key={tab}
                                style={eventStyles.tabItem}
                                onPress={() => handleTabPress(tab)}
                            >
                                <Text style={[
                                    commonStyles.subtitle,
                                    activeTab === tab && eventStyles.activeTabText
                                ]}>
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
                                            onSearch={handlePastSearch}
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

                    <View style={[eventStyles.section, { marginBottom: 0, marginTop: spacing.sm }]}>
                        <Text style={commonStyles.title}>{t('event:personal.title')}</Text>
                    </View>
                    <View style={[
                        commonStyles.card,
                        {
                            marginHorizontal: spacing.md,
                            padding: 0,
                            overflow: 'hidden',
                            marginBottom: spacing.xl
                        }
                    ]}>
                        <View style={eventStyles.header}>
                            <Text style={[homeStyles.heading, { marginBottom: 0 }]}>
                                {t('event:personal.description')}
                            </Text>
                        </View>
                        <TouchableOpacity
                            style={[commonStyles.primaryButton, { borderRadius: 0 }]}
                            onPress={handlePersonalEventPress}
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