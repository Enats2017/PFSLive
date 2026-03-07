import React, { useState, useRef, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    FlatList,
    ActivityIndicator,
    Dimensions,
    StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { AppHeader } from '../../components/common/AppHeader';
import { commonStyles, colors, spacing } from '../../styles/common.styles';
import { detailsStyles } from '../../styles/details.styles';
import LiveTab from './LiveTab';
import PastTab from './PastTab';
import ProfileCard from '../../components/ProfileCard';
import { eventService, AthleteEvent, AthleteProfile } from '../../services/athleteProfileService';
import { API_CONFIG } from '../../constants/config';

const { width, height } = Dimensions.get('window');

type Tab = 'Live' | 'Past';
const TABS: Tab[] = ['Live', 'Past'];
const TAB_CONTENT_HEIGHT = height * 0.5; // ✅ FIXED HEIGHT (50% of screen)

const ProfileScreen = () => {
    const { t } = useTranslation(['profile']);
    const flatListRef = useRef<FlatList>(null);
    
    const [activeTab, setActiveTab] = useState<Tab>('Live');
    const [profile, setProfile] = useState<AthleteProfile | null>(null);
    const [liveEvents, setLiveEvents] = useState<AthleteEvent[]>([]);
    const [pastEvents, setPastEvents] = useState<AthleteEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [loadingMoreLive, setLoadingMoreLive] = useState(false);
    const [loadingMorePast, setLoadingMorePast] = useState(false);

    const [paginationInfo, setPaginationInfo] = useState({
        live: { page: 1, total_pages: 1 },
        past: { page: 1, total_pages: 1 },
    });

    // ✅ PREVENT DUPLICATE CALLS
    const isInitialMount = useRef(true);
    const isFetching = useRef(false);

    // ✅ FETCH INITIAL DATA
    useFocusEffect(
        useCallback(() => {
            // Skip if already fetching
            if (isFetching.current) {
                if (API_CONFIG.DEBUG) {
                    console.log('⏸️ Already fetching, skipping duplicate call');
                }
                return;
            }

            // Only fetch on first mount or when coming back to screen
            if (isInitialMount.current) {
                isInitialMount.current = false;
                fetchProfile();
            } else {
                // Refresh data when returning to screen
                fetchProfile();
            }

            return () => {
                // Cleanup
                isFetching.current = false;
            };
        }, [])
    );

    const fetchProfile = useCallback(async () => {
        // Prevent duplicate calls
        if (isFetching.current) {
            if (API_CONFIG.DEBUG) {
                console.log('⏸️ Fetch already in progress');
            }
            return;
        }

        try {
            isFetching.current = true;
            setLoading(true);
            setError(null);

            if (API_CONFIG.DEBUG) {
                console.log('📡 Fetching athlete profile');
            }

            const result = await eventService.getAthleteProfile({
                page_live: 1,
                page_past: 1,
            });

            setProfile(result.profile);
            setLiveEvents(result.tabs.live);
            setPastEvents(result.tabs.past);

            if (result.pagination) {
                setPaginationInfo({
                    live: {
                        page: result.pagination.live.page,
                        total_pages: result.pagination.live.total_pages,
                    },
                    past: {
                        page: result.pagination.past.page,
                        total_pages: result.pagination.past.total_pages,
                    },
                });
            }

            if (API_CONFIG.DEBUG) {
                console.log('✅ Profile loaded:', {
                    live: result.tabs.live.length,
                    past: result.tabs.past.length,
                });
            }
        } catch (error: any) {
            console.log('❌ Failed to fetch profile:', error);
            setError(error.message || t('profile:errors.load_profile_failed'));
        } finally {
            setLoading(false);
            isFetching.current = false;
        }
    }, [t]);

    // ✅ LOAD MORE LIVE
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

            const result = await eventService.getAthleteProfile({
                page_live: nextPage,
            });

            setLiveEvents((prev) => {
                const existingIds = new Set(prev.map((e) => e.participant_app_id));
                const newItems = result.tabs.live.filter((item) => !existingIds.has(item.participant_app_id));
                
                if (API_CONFIG.DEBUG) {
                    console.log(`➕ Live: Adding ${newItems.length} new events (${result.tabs.live.length - newItems.length} duplicates filtered)`);
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
            console.log('Live: Load more failed:', error);
        } finally {
            setLoadingMoreLive(false);
        }
    }, [loadingMoreLive, paginationInfo.live.page, paginationInfo.live.total_pages]);

    // ✅ LOAD MORE PAST
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

            const result = await eventService.getAthleteProfile({
                page_past: nextPage,
            });

            setPastEvents((prev) => {
                const existingIds = new Set(prev.map((e) => e.participant_app_id));
                const newItems = result.tabs.past.filter((item) => !existingIds.has(item.participant_app_id));
                
                if (API_CONFIG.DEBUG) {
                    console.log(`➕ Past: Adding ${newItems.length} new events (${result.tabs.past.length - newItems.length} duplicates filtered)`);
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
            console.log('Past: Load more failed:', error);
        } finally {
            setLoadingMorePast(false);
        }
    }, [loadingMorePast, paginationInfo.past.page, paginationInfo.past.total_pages]);

    // ✅ TAB HANDLERS
    const handleTabPress = useCallback((tab: Tab) => {
        const index = TABS.indexOf(tab);
        setActiveTab(tab);
        flatListRef.current?.scrollToIndex({ index, animated: true });
    }, []);

    const handleSwipe = useCallback((e: any) => {
        const index = Math.round(e.nativeEvent.contentOffset.x / width);
        setActiveTab(TABS[index]);
    }, []);

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
                        onPress={fetchProfile}
                    >
                        <Text style={commonStyles.primaryButtonText}>
                            {t('common:buttons.retry')}
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

            {/* ✅ PROFILE CARD */}
            <ProfileCard profile={profile} fetchError={error} />

            {/* ✅ TAB BAR */}
            <View style={detailsStyles.tabBar}>
                {TABS.map((tab) => (
                    <TouchableOpacity
                        key={tab}
                        style={detailsStyles.tabItem}
                        onPress={() => handleTabPress(tab)}
                    >
                        <Text
                            style={[
                                commonStyles.subtitle,
                                activeTab === tab && detailsStyles.activeTabText,
                            ]}
                        >
                            {t(`profile:tab.${tab}`)}
                        </Text>
                        {activeTab === tab && (
                            <LinearGradient
                                colors={['#e8341a', '#f4a100', '#1a73e8']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={detailsStyles.underline}
                            />
                        )}
                    </TouchableOpacity>
                ))}
            </View>

            {/* ✅ TAB CONTENT - FIXED HEIGHT */}
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
                            {item === 'Live' && (
                                <LiveTab
                                    events={liveEvents}
                                    onLoadMore={loadMoreLive}
                                    loadingMore={loadingMoreLive}
                                    hasMore={paginationInfo.live.page < paginationInfo.live.total_pages}
                                />
                            )}
                            {item === 'Past' && (
                                <PastTab
                                    events={pastEvents}
                                    onLoadMore={loadMorePast}
                                    loadingMore={loadingMorePast}
                                    hasMore={paginationInfo.past.page < paginationInfo.past.total_pages}
                                />
                            )}
                        </View>
                    )}
                />
            </View>
        </SafeAreaView>
    );
};

export default ProfileScreen;