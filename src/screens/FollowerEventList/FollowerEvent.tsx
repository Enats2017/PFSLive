import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, StatusBar, Dimensions, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { AppHeader } from '../../components/common/AppHeader';
import { commonStyles, spacing } from '../../styles/common.styles';
import { eventStyles } from '../../styles/event';
import PastTab from './PastTab';
import LiveTab from './LiveTab';
import UpcomingTab from './UpcomingTab';
import { eventService, EventItem, ParticipantItem } from '../../services/followerEvent';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';

import { API_CONFIG } from '../../constants/config';
import { tokenService } from '../../services/tokenService';
import SearchInput from '../../components/SearchInput';
import FanEventCard from './FollowerCard';
import { FollowerEventpops } from '../../types/navigation';

type Tab = 'Past' | 'Live' | 'Upcoming';
const TABS: Tab[] = ['Past', 'Live', 'Upcoming'];
const { width, height } = Dimensions.get('window');
const TAB_CONTENT_HEIGHT = height * 0.39;

const FanEvent: React.FC<FollowerEventpops> = ({ navigation }) => {
    const { t } = useTranslation(['follower', 'common']);
    const [activeTab, setActiveTab] = useState<Tab>('Live');
    const [loading, setLoading] = useState(true);
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
    });
    const [participantPagination, setParticipantPagination] = useState({ page: 1, total_pages: 1 });

    const flatListRef = useRef<FlatList>(null);
    const pastSearchQueryRef = useRef('');
    const participantSearchQueryRef = useRef('');

    useFocusEffect(
        useCallback(() => {
            fetchEvents('');
        }, [])
    );

    const fetchEvents = useCallback(async (search: string) => {
        try {
            setLoading(true);
            setError(null);

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
                    past: { page: result.pagination.past.page, total_pages: result.pagination.past.total_pages },
                    live: { page: result.pagination.live.page, total_pages: result.pagination.live.total_pages },
                    upcoming: { page: result.pagination.upcoming.page, total_pages: result.pagination.upcoming.total_pages },
                });
            }
            if (result.pagination?.participants) {
                setParticipantPagination({
                    page: result.pagination.participants.page,
                    total_pages: result.pagination.participants.total_pages,
                });
            }
        } catch (err: any) {
            setError(err.message || t('event:error.failed'));
        } finally {
            setLoading(false);
        }
    }, [t]);

    const handlePastSearch = useCallback((query: string) => {

        pastSearchQueryRef.current = query;
        fetchEvents(query);
    }, [fetchEvents]);

    const handleParticipantSearch = useCallback((query: string) => {
        console.log('🔍 handleParticipantSearch called with:', query); // ✅ debug 1
        participantSearchQueryRef.current = query;
        setSearchText(query);
        setParticipants([]);
        setParticipantPagination({ page: 1, total_pages: 1 });

        eventService.getEvents({
            is_participant: "1",
            page_participant: 1,
            filter_name_participant: query,
        }).then(result => {
            console.log('✅ Search API result participants:', result.participants?.length); // ✅ debug 2
            console.log('✅ Search API pagination:', result.pagination?.participants);      // ✅ debug 3
            setParticipants(result.participants || []);
            if (result.pagination?.participants) {
                setParticipantPagination({
                    page: result.pagination.participants.page,
                    total_pages: result.pagination.participants.total_pages,
                });
            }
        }).catch(err => {
            console.log('❌ Search API failed:', err); // ✅ debug 4
        });
    }, []);

    const loadMorePast = useCallback(async () => {
        if (loadingMorePast || paginationInfo.past.page >= paginationInfo.past.total_pages) return;
        try {
            setLoadingMorePast(true);
            const nextPage = paginationInfo.past.page + 1;
            const result = await eventService.getEvents({
                page_past: nextPage,
                filter_name_past: pastSearchQueryRef.current,
            });
            setPastEvents(prev => {
                const ids = new Set(prev.map(e => e.product_app_id));
                return [...prev, ...result.tabs.past.filter(i => !ids.has(i.product_app_id))];
            });
            if (result.pagination?.past) {
                setPaginationInfo(prev => ({
                    ...prev,
                    past: { page: nextPage, total_pages: result.pagination.past.total_pages }
                }));
            }
        } catch (err) {
            console.log('Past: Load more failed:', err);
        } finally {
            setLoadingMorePast(false);
        }
    }, [loadingMorePast, paginationInfo.past]);

    const loadMoreLive = useCallback(async () => {
        if (loadingMoreLive || paginationInfo.live.page >= paginationInfo.live.total_pages) return;
        try {
            setLoadingMoreLive(true);
            const nextPage = paginationInfo.live.page + 1;
            const result = await eventService.getEvents({ page_live: nextPage });
            setLiveEvents(prev => {
                const ids = new Set(prev.map(e => e.product_app_id));
                return [...prev, ...result.tabs.live.filter(i => !ids.has(i.product_app_id))];
            });
            if (result.pagination?.live) {
                setPaginationInfo(prev => ({
                    ...prev,
                    live: { page: nextPage, total_pages: result.pagination.live.total_pages }
                }));
            }
        } catch (err) {
            console.log('Live: Load more failed:', err);
        } finally {
            setLoadingMoreLive(false);
        }
    }, [loadingMoreLive, paginationInfo.live]);

    const loadMoreUpcoming = useCallback(async () => {
        if (loadingMoreUpcoming || paginationInfo.upcoming.page >= paginationInfo.upcoming.total_pages) return;
        try {
            setLoadingMoreUpcoming(true);
            const nextPage = paginationInfo.upcoming.page + 1;
            const result = await eventService.getEvents({ page_upcoming: nextPage });
            setUpcomingEvents(prev => {
                const ids = new Set(prev.map(e => e.product_app_id));
                return [...prev, ...result.tabs.upcoming.filter(i => !ids.has(i.product_app_id))];
            });
            if (result.pagination?.upcoming) {
                setPaginationInfo(prev => ({
                    ...prev,
                    upcoming: { page: nextPage, total_pages: result.pagination.upcoming.total_pages }
                }));
            }
        } catch (err) {
            console.log('Upcoming: Load more failed:', err);
        } finally {
            setLoadingMoreUpcoming(false);
        }
    }, [loadingMoreUpcoming, paginationInfo.upcoming]);

    const loadMoreParticipant = useCallback(async () => {
        if (loadingMoreParticipant || participantPagination.page >= participantPagination.total_pages) return;
        try {
            setLoadingMoreParticipant(true);
            const nextPage = participantPagination.page + 1;
            const result = await eventService.getEvents({
                is_participant: "1",
                page_participant: nextPage,
                filter_name_participant: participantSearchQueryRef.current,
            });
            setParticipants(prev => {
                const ids = new Set(prev.map(e => e.customer_app_id));
                return [...prev, ...(result.participants || []).filter(i => !ids.has(i.customer_app_id))];
            });
            setParticipantPagination({
                page: nextPage,
                total_pages: result.pagination?.participants?.total_pages || participantPagination.total_pages,
            });
        } catch (err) {
            console.log('Participant: Load more failed:', err);
        } finally {
            setLoadingMoreParticipant(false);
        }
    }, [loadingMoreParticipant, participantPagination]);

    const handleTabPress = useCallback((tab: Tab) => {
        const index = TABS.indexOf(tab);
        setActiveTab(tab);
        flatListRef.current?.scrollToIndex({ index, animated: true });
    }, []);

    const handleSwipe = useCallback((e: any) => {
        const index = Math.round(e.nativeEvent.contentOffset.x / width);
        setActiveTab(TABS[index]);
    }, []);



    // ✅ Add this debounce effect
    const participantDebounceTimer = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (participantDebounceTimer.current) {
            clearTimeout(participantDebounceTimer.current);
        }

        participantDebounceTimer.current = setTimeout(() => {
            participantSearchQueryRef.current = searchText;
            setParticipants([]);
            setParticipantPagination({ page: 1, total_pages: 1 });

            eventService.getEvents({
                is_participant: "1",
                page_participant: 1,
                filter_name_participant: searchText,
            }).then(result => {
                console.log('✅ Search result:', result.participants?.length);
                setParticipants(result.participants || []);
                if (result.pagination?.participants) {
                    setParticipantPagination({
                        page: result.pagination.participants.page,
                        total_pages: result.pagination.participants.total_pages,
                    });
                }
            }).catch(err => {
                console.log('❌ Search failed:', err);
            });
        }, 500);

        return () => {
            if (participantDebounceTimer.current) {
                clearTimeout(participantDebounceTimer.current);
            }
        };
    }, [searchText]); // ✅ triggers when searchText changes

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
                        <Text style={commonStyles.primaryButtonText}>{t('event:error.retry')}</Text>
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
                {/* ✅ Official Events - 3 Tabs */}
                <View style={eventStyles.section}>
                    <Text style={commonStyles.title}>{t('follower:official.title')}</Text>
                </View>
                <View style={eventStyles.tabBar}>
                    {TABS.map((tab) => (
                        <TouchableOpacity
                            key={tab}
                            style={eventStyles.tabItem}
                            onPress={() => handleTabPress(tab)}
                        >
                            <Text style={[commonStyles.subtitle, activeTab === tab && eventStyles.activeTabText]}>
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
                <View style={[eventStyles.section, { marginBottom: spacing.md, marginTop: spacing.sm }]}>
                    <Text style={commonStyles.title}>{t('follower:personal.title')}</Text>
                </View>
                    <FlatList
                        data={participants}
                        keyExtractor={(item, index) => `${item.customer_app_id}_${index}`}
                        onEndReached={loadMoreParticipant}
                        showsVerticalScrollIndicator={false}
                        onEndReachedThreshold={0.5}
                        contentContainerStyle={{
                            paddingHorizontal: spacing.md,
                           
                            paddingBottom: spacing.xxxl,
                        }}
                        keyboardShouldPersistTaps="handled"
                        getItemLayout={(_, index) => ({
                            length: width,
                            offset: width * index,
                            index,
                        })}
                        ListHeaderComponent={
                            <SearchInput
                                placeholder={t('details:participant.search')}
                                value={searchText}
                                onChangeText={setSearchText}
                                icon="search"

                            />
                        }
                        ListEmptyComponent={
                            <Text style={commonStyles.errorText}>No participants found.</Text>
                        }
                        ListFooterComponent={
                            loadingMoreParticipant
                                ? <ActivityIndicator size="small" color="#f4a100" style={{ marginVertical: 16 }} />
                                : null
                        }
                        renderItem={({ item }) => (
                            <FanEventCard item={item} />
                        )}
                    />                                
            </View>

        </SafeAreaView>
    );
};

export default FanEvent;