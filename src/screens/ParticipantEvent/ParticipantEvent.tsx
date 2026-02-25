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
import i18n from '../../i18n';
import { ParticipantEventProps } from '../../types/navigation';
import { API_CONFIG } from '../../constants/config';

type Tab = 'Past' | 'Live' | 'Upcoming';
const TABS: Tab[] = ['Past', 'Live', 'Upcoming'];
const { width, height } = Dimensions.get('window');
const TAB_CONTENT_HEIGHT = height * 0.5;

const ParticipantEvent:React.FC<ParticipantEventProps> = ({navigation}) => {
    const { t } = useTranslation(['event', 'common']);
    const [activeTab, setActiveTab] = useState<Tab>('Live');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [pastEvents, setPastEvents] = useState<EventItem[]>([]);
    const [liveEvents, setLiveEvents] = useState<EventItem[]>([]);
    const [upcomingEvents, setUpcomingEvents] = useState<EventItem[]>([]);
    const flatListRef = useRef<FlatList>(null);

    // ✅ Separate loading state for each tab
    const [loadingMorePast, setLoadingMorePast] = useState(false);
    const [loadingMoreLive, setLoadingMoreLive] = useState(false);
    const [loadingMoreUpcoming, setLoadingMoreUpcoming] = useState(false);

    const [paginationInfo, setPaginationInfo] = useState({
        past: { page: 1, total_pages: 1 },
        live: { page: 1, total_pages: 1 },
        upcoming: { page: 1, total_pages: 1 },
    });

    // ✅ Helper function to check if more pages exist
    const hasMorePages = (tab: Tab): boolean => {
        const key = tab.toLowerCase() as 'past' | 'live' | 'upcoming';
        return paginationInfo[key].page < paginationInfo[key].total_pages;
    };

    useFocusEffect(
        useCallback(() => {
            fetchEvents();
        }, [])
    );

    const fetchEvents = async () => {
        try {
            setLoading(true);
            setError(null);

            if (API_CONFIG.DEBUG) {
                console.log('📡 Fetching events for all tabs');
            }

            const result = await eventService.getEvents({ 
                page_past: 1, 
                page_live: 1, 
                page_upcoming: 1 
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

            if (API_CONFIG.DEBUG) {
                console.log('✅ Events loaded:', {
                    past: `${result.tabs.past.length} (page ${result.pagination.past.page}/${result.pagination.past.total_pages})`,
                    live: `${result.tabs.live.length} (page ${result.pagination.live.page}/${result.pagination.live.total_pages})`,
                    upcoming: `${result.tabs.upcoming.length} (page ${result.pagination.upcoming.page}/${result.pagination.upcoming.total_pages})`
                });
            }
        } catch (error: any) {
            console.error('❌ Failed to fetch events:', error);
            setError(error.message || t('event:error.failed'));
        } finally {
            setLoading(false);
        }
    };

    const loadMorePast = useCallback(async () => {
        const key = 'past';
        
        // ✅ Guard: Check all conditions
        if (loadingMorePast) {
            if (API_CONFIG.DEBUG) console.log('Past: Already loading');
            return;
        }

        if (paginationInfo[key].page >= paginationInfo[key].total_pages) {
            if (API_CONFIG.DEBUG) console.log('Past: No more pages');
            return;
        }

        try {
            setLoadingMorePast(true);
            const nextPage = paginationInfo[key].page + 1;

            if (API_CONFIG.DEBUG) {
                console.log(`Past: Loading page ${nextPage}/${paginationInfo[key].total_pages}`);
            }

            const result = await eventService.getEvents({ page_past: nextPage });

            setPastEvents(prev => {
                const existingIds = new Set(prev.map(e => e.product_app_id));
                const newItems = result.tabs.past.filter(item => !existingIds.has(item.product_app_id));
                if (API_CONFIG.DEBUG) console.log(`Past: Added ${newItems.length} new items`);
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
            console.error('Past: Load more failed:', error);
        } finally {
            setLoadingMorePast(false);
        }
    }, [loadingMorePast, paginationInfo]);

    const loadMoreLive = useCallback(async () => {
        const key = 'live';
        
        if (loadingMoreLive) {
            if (API_CONFIG.DEBUG) console.log('Live: Already loading');
            return;
        }

        if (paginationInfo[key].page >= paginationInfo[key].total_pages) {
            if (API_CONFIG.DEBUG) console.log('Live: No more pages');
            return;
        }

        try {
            setLoadingMoreLive(true);
            const nextPage = paginationInfo[key].page + 1;

            if (API_CONFIG.DEBUG) {
                console.log(`Live: Loading page ${nextPage}/${paginationInfo[key].total_pages}`);
            }

            const result = await eventService.getEvents({ page_live: nextPage });

            setLiveEvents(prev => {
                const existingIds = new Set(prev.map(e => e.product_app_id));
                const newItems = result.tabs.live.filter(item => !existingIds.has(item.product_app_id));
                if (API_CONFIG.DEBUG) console.log(`Live: Added ${newItems.length} new items`);
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
            console.error('Live: Load more failed:', error);
        } finally {
            setLoadingMoreLive(false);
        }
    }, [loadingMoreLive, paginationInfo]);

    const loadMoreUpcoming = useCallback(async () => {
        const key = 'upcoming';
        
        if (loadingMoreUpcoming) {
            if (API_CONFIG.DEBUG) console.log('Upcoming: Already loading');
            return;
        }

        if (paginationInfo[key].page >= paginationInfo[key].total_pages) {
            if (API_CONFIG.DEBUG) console.log('Upcoming: No more pages');
            return;
        }

        try {
            setLoadingMoreUpcoming(true);
            const nextPage = paginationInfo[key].page + 1;

            if (API_CONFIG.DEBUG) {
                console.log(`Upcoming: Loading page ${nextPage}/${paginationInfo[key].total_pages}`);
            }

            const result = await eventService.getEvents({ page_upcoming: nextPage });

            setUpcomingEvents(prev => {
                const existingIds = new Set(prev.map(e => e.product_app_id));
                const newItems = result.tabs.upcoming.filter(item => !existingIds.has(item.product_app_id));
                if (API_CONFIG.DEBUG) console.log(`Upcoming: Added ${newItems.length} new items`);
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
            console.error('Upcoming: Load more failed:', error);
        } finally {
            setLoadingMoreUpcoming(false);
        }
    }, [loadingMoreUpcoming, paginationInfo]);

    const renderContent = (tab: Tab) => {
        if (loading) {
            return (
                <ActivityIndicator 
                    size="large" 
                    color="#FF5722"
                    style={{ marginTop: 40 }} 
                />
            );
        }

        if (error) {
            return (
                <View style={commonStyles.centerContainer}>
                    <Text style={commonStyles.errorText}>{error}</Text>
                    <TouchableOpacity
                        style={[commonStyles.primaryButton, { marginTop: spacing.lg }]}
                        onPress={fetchEvents}
                    >
                        <Text style={commonStyles.primaryButtonText}>
                            {t('event:error.retry')}
                        </Text>
                    </TouchableOpacity>
                </View>
            );
        }

        switch (tab) {
            case 'Past': 
                return <PastTab 
                    events={pastEvents} 
                    onLoadMore={loadMorePast}
                    loadingMore={loadingMorePast}
                    hasMore={hasMorePages('Past')}
                />;
            case 'Live': 
                return <LiveTab 
                    events={liveEvents} 
                    onLoadMore={loadMoreLive}
                    loadingMore={loadingMoreLive}
                    hasMore={hasMorePages('Live')}
                />;
            case 'Upcoming': 
                return <UpcomingTab 
                    events={upcomingEvents} 
                    onLoadMore={loadMoreUpcoming}
                    loadingMore={loadingMoreUpcoming}
                    hasMore={hasMorePages('Upcoming')}
                />;
        }
    };

    const handleTabPress = (tab: Tab) => {
        const index = TABS.indexOf(tab);
        setActiveTab(tab);
        flatListRef.current?.scrollToIndex({ index, animated: true });
    };

    const handleSwipe = (e: any) => {
        const index = Math.round(e.nativeEvent.contentOffset.x / width);
        setActiveTab(TABS[index]);
    };

    return (
        <SafeAreaView style={commonStyles.container} edges={['top']}>
            <StatusBar barStyle="dark-content" />
            <AppHeader showLogo={true} />
            <ScrollView 
                style={{ flex: 1 }}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ flexGrow: 1 }}
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
                                    {renderContent(item)}
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
                        <TouchableOpacity style={commonStyles.primaryButton} onPress={()=>navigation.navigate('PersonalEvent')}>
                            <Text style={commonStyles.primaryButtonText}>{t('personal.button')}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

export default ParticipantEvent;