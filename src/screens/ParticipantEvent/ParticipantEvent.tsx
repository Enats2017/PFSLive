import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, StatusBar, Dimensions, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader } from '../../components/common/AppHeader';
import { commonStyles } from '../../styles/common.styles';
import { eventStyles } from '../../styles/event';
import { homeStyles } from '../../styles/home.styles';
import PastTab from './PastTab';
import LiveTab from './LiveTab';
import UpcomingTab from './UpcomingTab';
import { eventService, EventItem } from '../../services/eventService';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';

type Tab = 'Past' | 'Live' | 'Upcoming';
const TABS: Tab[] = ['Past', 'Live', 'Upcoming'];
const { width } = Dimensions.get('window');

const ParticipantEvent = () => {
    const { t } = useTranslation(['event', 'common']);
    const [activeTab, setActiveTab] = useState<Tab>('Live');
    const [loading, setLoading] = useState(true);
    const [pastEvents, setPastEvents] = useState<EventItem[]>([]);
    const [liveEvents, setLiveEvents] = useState<EventItem[]>([]);
    const [upcomingEvents, setUpcomingEvents] = useState<EventItem[]>([]);
    const flatListRef = useRef<FlatList>(null);
    const [loadingMore, setLoadingMore] = useState(false);
    const isLoadingMoreRef = useRef(false);

    const [paginationInfo, setPaginationInfo] = useState({
        past: { page: 1, total_pages: 1 },
        live: { page: 1, total_pages: 1 },
        upcoming: { page: 1, total_pages: 1 },
    });

    useEffect(() => {
        fetchEvents();
    }, [i18n.language]);

    const fetchEvents = async () => {
        try {
            setLoading(true);
            const result = await eventService.getEvents({ page_past: 1, page_live: 1, page_upcoming: 1 });
            setPastEvents(result.tabs.past);
            setLiveEvents(result.tabs.live);
            setUpcomingEvents(result.tabs.upcoming);
            if (result.pagination) {
                setPaginationInfo({
                    past: { page: result.pagination.past.page, total_pages: result.pagination.past.total_pages },
                    live: { page: result.pagination.live.page, total_pages: result.pagination.live.total_pages },
                    upcoming: { page: result.pagination.upcoming.page, total_pages: result.pagination.upcoming.total_pages },
                });
            }
        } catch (error) {
            console.error('Failed to fetch events:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadMore = async (tab: Tab) => {
        if (isLoadingMoreRef.current) {
            console.log(`${tab}: Already loading, skip`);
            return;
        }
        if (loadingMore) {
            console.log(`${tab}: loadingMore=true, skip`);
            return;
        }

        const key = tab.toLowerCase() as 'past' | 'live' | 'upcoming';
        
        if (paginationInfo[key].page >= paginationInfo[key].total_pages) {
            console.log(`${tab}: No more pages (${paginationInfo[key].page}/${paginationInfo[key].total_pages})`);
            return;
        }

        try {
            isLoadingMoreRef.current = true;
            setLoadingMore(true);
            
            const nextPage = paginationInfo[key].page + 1;
            
            const paginationParams: any = {};
            
            if (tab === 'Past') {
                paginationParams.page_past = nextPage;
            } else if (tab === 'Live') {
                paginationParams.page_live = nextPage;
            } else if (tab === 'Upcoming') {
                paginationParams.page_upcoming = nextPage;
            }

            console.log(`${tab}: Loading page ${nextPage}`, paginationParams);
            
            const result = await eventService.getEvents(paginationParams);
            
            if (tab === 'Past') {
                setPastEvents(prev => {
                    const newItems = result.tabs.past.filter(
                        item => !prev.some(p => p.product_app_id === item.product_app_id)
                    );
                    console.log(`Past: Added ${newItems.length} new items`);
                    return [...prev, ...newItems];
                });
            } else if (tab === 'Live') {
                setLiveEvents(prev => {
                    const newItems = result.tabs.live.filter(
                        item => !prev.some(p => p.product_app_id === item.product_app_id)
                    );
                    console.log(`Live: Added ${newItems.length} new items`);
                    return [...prev, ...newItems];
                });
            } else if (tab === 'Upcoming') {
                setUpcomingEvents(prev => {
                    const newItems = result.tabs.upcoming.filter(
                        item => !prev.some(p => p.product_app_id === item.product_app_id)
                    );
                    console.log(`Upcoming: Added ${newItems.length} new items`);
                    return [...prev, ...newItems];
                });
            }
            
            if (result.pagination && result.pagination[key]) {
                setPaginationInfo(prev => ({
                    ...prev,
                    [key]: {
                        page: nextPage,
                        total_pages: result.pagination[key].total_pages
                    }
                }));
                console.log(`${tab}: Updated pagination - page ${nextPage}/${result.pagination[key].total_pages}`);
            } else {
                setPaginationInfo(prev => ({
                    ...prev,
                    [key]: {
                        page: nextPage,
                        total_pages: prev[key].total_pages
                    }
                }));
                console.log(`${tab}: Updated page to ${nextPage}, kept total_pages`);
            }

        } catch (error) {
            console.error(`${tab}: Load more failed:`, error);
        } finally {
            isLoadingMoreRef.current = false;
            setLoadingMore(false);
        }
    };

    const renderContent = (tab: Tab) => {
        if (loading) return <ActivityIndicator size="large" color="#f4a100" style={{ marginTop: 40 }} />;
        switch (tab) {
            case 'Past': return <PastTab events={pastEvents} onLoadMore={() => loadMore('Past')} loadingMore={loadingMore} />;
            case 'Live': return <LiveTab events={liveEvents} onLoadMore={() => loadMore('Live')} loadingMore={loadingMore} />;
            case 'Upcoming': return <UpcomingTab events={upcomingEvents} onLoadMore={() => loadMore('Upcoming')} loadingMore={loadingMore} />;
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

            <View style={{ flex: 1 }}>
                {/* Official Events Header */}
                <View style={eventStyles.section}>
                    <Text style={commonStyles.title}>{t('official.title')}</Text>
                </View>

                {/* Tab Bar */}
                <View style={eventStyles.tabBar}>
                    {TABS.map((tab) => (
                        <TouchableOpacity
                            key={tab}
                            style={eventStyles.tabItem}
                            onPress={() => handleTabPress(tab)}
                        >
                            <Text style={[commonStyles.subtitle, activeTab === tab && eventStyles.activeTabText]}>
                                {t(`live.${tab}`)}
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

                {/* Tab Content - Scrollable Area */}
                <View style={{ flex: 1 }}>
                    <FlatList
                        ref={flatListRef}
                        data={TABS}
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        keyExtractor={(item) => item}
                        onMomentumScrollEnd={handleSwipe}
                        initialScrollIndex={TABS.indexOf('Live')}
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
                        scrollEnabled={true}
                    />
                </View>

                {/* Personal Events Section - Always Visible at Bottom */}
                <View style={{ paddingBottom: 10 }}>
                    <View style={eventStyles.section}>
                        <Text style={commonStyles.title}>{t('personal.title')}</Text>
                    </View>
                    <View style={[commonStyles.card, { marginHorizontal: 11, padding: 0, overflow: 'hidden', marginBottom: 20 }]}>
                        <View style={eventStyles.header}>
                            <Text style={[homeStyles.heading, { marginBottom: 0 }]}>{t('personal.description')}</Text>
                        </View>
                        <TouchableOpacity style={commonStyles.primaryButton}>
                            <Text style={commonStyles.primaryButtonText}>{t('personal.button')}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </SafeAreaView>
    );
};

export default ParticipantEvent;