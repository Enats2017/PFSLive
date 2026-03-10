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
import { ProfileScreenprops } from '../../types/navigation';

const { width, height } = Dimensions.get('window');

type Tab = 'Past' | 'Live';
const TABS: Tab[] = ['Past', 'Live'];
const LIVE_INDEX = TABS.indexOf('Live');
const TAB_CONTENT_HEIGHT = height * 0.5;

interface PaginationState {
    live: { page: number; total_pages: number };
    past: { page: number; total_pages: number };
}

const INITIAL_PAGINATION: PaginationState = {
    live: { page: 1, total_pages: 1 },
    past: { page: 1, total_pages: 1 },
};

const ProfileScreen: React.FC<ProfileScreenprops> = ({ route }) => {
    const { t } = useTranslation(['profile', 'common']);
    const flatListRef = useRef<FlatList>(null);

    // ✅ PREVENT DUPLICATE CALLS (EXACT PARTICIPANTEVENT PATTERN)
    const isInitialMount = useRef(true);
    const isFetching = useRef(false);

    const targetId = route.params?.customer_app_id;
    const fromEdit = route.params?.fromEdit;

    const [activeTab, setActiveTab] = useState<Tab>('Live');
    const [profile, setProfile] = useState<AthleteProfile | null>(null);
    const [liveEvents, setLiveEvents] = useState<AthleteEvent[]>([]);
    const [pastEvents, setPastEvents] = useState<AthleteEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [loadingMoreLive, setLoadingMoreLive] = useState(false);
    const [loadingMorePast, setLoadingMorePast] = useState(false);
    const [pagination, setPagination] = useState<PaginationState>(INITIAL_PAGINATION);

    // ✅ FETCH PROFILE (with optional cache busting)
    const fetchProfile = useCallback(async (bustCache: boolean = false) => {
        // ✅ GUARD AGAINST CONCURRENT CALLS
        if (isFetching.current) {
            if (API_CONFIG.DEBUG) {
                console.log('⏸️ Already fetching, skipping duplicate call');
            }
            return;
        }

        try {
            isFetching.current = true;
            setLoading(true);
            setError(null);

            if (API_CONFIG.DEBUG) {
                console.log('📡 Fetching profile:', { targetId, bustCache });
            }

            const result = await eventService.getAthleteProfile(
                { page_live: 1, page_past: 1 },
                targetId,
                bustCache
            );

            setProfile(result.profile);
            setLiveEvents(result.tabs.live);
            setPastEvents(result.tabs.past);

            if (result.pagination) {
                setPagination({
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
        } catch (err: any) {
            if (API_CONFIG.DEBUG) {
                console.error('❌ Profile fetch failed:', err);
            }
            setError(err?.message || t('profile:errors.load_profile_failed'));
        } finally {
            setLoading(false);
            isFetching.current = false;
        }
    }, [targetId, t]);

    // ✅ FETCH INITIAL DATA (EXACT PARTICIPANTEVENT PATTERN)
    useFocusEffect(
        useCallback(() => {
            // ✅ Skip if already fetching
            if (isFetching.current) {
                if (API_CONFIG.DEBUG) {
                    console.log('⏸️ Already fetching, skipping duplicate call');
                }
                return;
            }

            // ✅ PRIORITY 1: Cache busting (from edit screens)
            if (fromEdit) {
                if (API_CONFIG.DEBUG) {
                    console.log('🔄 Coming from edit screen - busting cache');
                }
                fetchProfile(true);
            }
            // ✅ PRIORITY 2: Initial mount
            else if (isInitialMount.current) {
                isInitialMount.current = false;
                fetchProfile(false);
            }
            // ✅ PRIORITY 3: Return from navigation - just sync scroll
            else {
                if (API_CONFIG.DEBUG) {
                    console.log('🔄 Returning to screen - syncing scroll only');
                }
                const index = TABS.indexOf(activeTab);
                setTimeout(() => {
                    flatListRef.current?.scrollToIndex({ index, animated: false });
                }, 50);
            }

            return () => {
                // ✅ Cleanup
                isFetching.current = false;
            };
        }, [fetchProfile, activeTab, fromEdit])
    );

    // ✅ LOAD MORE LIVE
    const loadMoreLive = useCallback(async () => {
        if (loadingMoreLive || pagination.live.page >= pagination.live.total_pages) return;

        const nextPage = pagination.live.page + 1;
        setLoadingMoreLive(true);

        try {
            if (API_CONFIG.DEBUG) {
                console.log(`📡 Loading more live events: page ${nextPage}`);
            }

            const result = await eventService.getAthleteProfile(
                { page_live: nextPage },
                targetId
            );

            setLiveEvents(prev => {
                const existingIds = new Set(prev.map(e => e.participant_app_id));
                const newItems = result.tabs.live.filter(
                    item => !existingIds.has(item.participant_app_id)
                );

                if (API_CONFIG.DEBUG) {
                    console.log(`➕ Live: Adding ${newItems.length} new events`);
                }

                return [...prev, ...newItems];
            });

            if (result.pagination?.live) {
                setPagination(prev => ({
                    ...prev,
                    live: { page: nextPage, total_pages: result.pagination.live.total_pages },
                }));
            }
        } catch (err) {
            if (API_CONFIG.DEBUG) {
                console.error('❌ Live load more failed:', err);
            }
        } finally {
            setLoadingMoreLive(false);
        }
    }, [loadingMoreLive, pagination.live.page, pagination.live.total_pages, targetId]);

    // ✅ LOAD MORE PAST
    const loadMorePast = useCallback(async () => {
        if (loadingMorePast || pagination.past.page >= pagination.past.total_pages) return;

        const nextPage = pagination.past.page + 1;
        setLoadingMorePast(true);

        try {
            if (API_CONFIG.DEBUG) {
                console.log(`📡 Loading more past events: page ${nextPage}`);
            }

            const result = await eventService.getAthleteProfile(
                { page_past: nextPage },
                targetId
            );

            setPastEvents(prev => {
                const existingIds = new Set(prev.map(e => e.participant_app_id));
                const newItems = result.tabs.past.filter(
                    item => !existingIds.has(item.participant_app_id)
                );

                if (API_CONFIG.DEBUG) {
                    console.log(`➕ Past: Adding ${newItems.length} new events`);
                }

                return [...prev, ...newItems];
            });

            if (result.pagination?.past) {
                setPagination(prev => ({
                    ...prev,
                    past: { page: nextPage, total_pages: result.pagination.past.total_pages },
                }));
            }
        } catch (err) {
            if (API_CONFIG.DEBUG) {
                console.error('❌ Past load more failed:', err);
            }
        } finally {
            setLoadingMorePast(false);
        }
    }, [loadingMorePast, pagination.past.page, pagination.past.total_pages, targetId]);

    // ✅ TAB HANDLERS (EXACT PARTICIPANTEVENT PATTERN - simple, no guards)
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

    const renderTabContent = useCallback(({ item }: { item: Tab }) => (
        <View style={{ width }}>
            {item === 'Live' ? (
                <LiveTab
                    events={liveEvents}
                    onLoadMore={loadMoreLive}
                    loadingMore={loadingMoreLive}
                    hasMore={pagination.live.page < pagination.live.total_pages}
                    profile={profile ?? undefined}
                />
            ) : (
                <PastTab
                    events={pastEvents}
                    onLoadMore={loadMorePast}
                    loadingMore={loadingMorePast}
                    hasMore={pagination.past.page < pagination.past.total_pages}
                    profile={profile ?? undefined}
                />
            )}
        </View>
    ), [
        liveEvents, pastEvents,
        loadMoreLive, loadMorePast,
        loadingMoreLive, loadingMorePast,
        pagination, profile,
    ]);

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
                        onPress={() => fetchProfile(true)}
                        activeOpacity={0.8}
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

            {/* ✅ PASS profile AND error DIRECTLY - ProfileCard accepts null */}
            <ProfileCard profile={profile ?? null} fetchError={error ?? ''} />

            {/* TAB BAR */}
            <View style={detailsStyles.tabBar}>
                {TABS.map(tab => {
                    const isActive = activeTab === tab;
                    return (
                        <TouchableOpacity
                            key={tab}
                            style={detailsStyles.tabItem}
                            onPress={() => handleTabPress(tab)}
                            activeOpacity={0.7}
                        >
                            <Text style={[commonStyles.subtitle, isActive && detailsStyles.activeTabText]}>
                                {t(`profile:tab.${tab}`)}
                            </Text>
                            {isActive && (
                                <LinearGradient
                                    colors={['#e8341a', '#f4a100', '#1a73e8']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={detailsStyles.underline}
                                />
                            )}
                        </TouchableOpacity>
                    );
                })}
            </View>

            {/* TAB CONTENT */}
            <View style={{ height: TAB_CONTENT_HEIGHT }}>
                <FlatList
                    ref={flatListRef}
                    data={TABS}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    keyExtractor={item => item}
                    onMomentumScrollEnd={handleSwipe}
                    initialScrollIndex={LIVE_INDEX}
                    scrollEnabled={true}
                    getItemLayout={(_, index) => ({
                        length: width,
                        offset: width * index,
                        index,
                    })}
                    renderItem={renderTabContent}
                />
            </View>
        </SafeAreaView>
    );
};

export default ProfileScreen;