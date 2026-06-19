import React, { useState, useRef, useCallback } from 'react';
import { View, Text, Image, StatusBar, Dimensions, TouchableOpacity, ScrollView } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, commonStyles, spacing } from '../../styles/common.styles'
import { Ionicons, FontAwesome5, FontAwesome6 } from '@expo/vector-icons'
import { eventService, AthleteEvent, AthleteProfile } from '../../services/athleteProfileService';
import { FlatList } from 'react-native-gesture-handler'
import { OwnProfileprops } from '../../types/navigation';
import { useScreenError } from '../../hooks/useApiError';
import { useTranslation } from 'react-i18next';
import { API_CONFIG } from '../../constants/config';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { ownProfile } from '../../styles/ownProfile.styles';
import EventsContent from './EventsContent';
import TrainingContent from './TrainingContent';
import { useDimensions } from '../../hooks/useDimensions';

type SectionKey = 'menu' | 'events' | 'training' | 'account'
interface MenuContentProps {
    onSelect: (id: SectionKey) => void;
    onNavigate: (screen: string) => void;
    profile: AthleteProfile | null;
}
interface PaginationState {
    live: { page: number; total_pages: number };
    past: { page: number; total_pages: number };
}
const INITIAL_PAGINATION: PaginationState = {
    live: { page: 1, total_pages: 1 },
    past: { page: 1, total_pages: 1 },
};
type Tab = 'Past' | 'Live';
const TABS: Tab[] = ['Past', 'Live'];


const MenuContent: React.FC<MenuContentProps> = ({ onSelect, onNavigate, profile }) => {
    const { t } = useTranslation('ownProfile');
    
    return (
        <View style={ownProfile.menuSection}>
            {profile?.is_own_profile === 1 && profile?.membership_info?.has_membership && (
                <TouchableOpacity style={ownProfile.trackingBanner} activeOpacity={0.85}>
                    <Ionicons name="cube" size={40} color="black" />
                    <View style={ownProfile.trackingTextWrapper}>
                        {profile.membership_info.unlimited ? (
                            <>
                                <Text style={ownProfile.title}>
                                    {t('ownProfile:tracking.unlimited')}
                                </Text>
                                <Text style={ownProfile.subtitle}>
                                    {t('ownProfile:tracking.subtitle')}
                                </Text>
                            </>
                        ) : (profile.membership_info.remaining ?? 0) > 0 ? (
                            <>
                                <Text style={ownProfile.title}>
                                    {t('ownProfile:tracking.remaining', { count: profile.membership_info.remaining ?? 0 })}
                                </Text>
                                <Text style={ownProfile.subtitle}>
                                    {t('ownProfile:tracking.subtitle')}
                                </Text>
                            </>
                        ) : (
                            <>
                                <Text style={ownProfile.title}>
                                    {t('ownProfile:tracking.exhausted')}
                                </Text>
                                <Text style={ownProfile.subtitle}>
                                    {t('ownProfile:tracking.subtitle')}
                                </Text>
                            </>
                        )}
                    </View>
                </TouchableOpacity>
            )}
            <TouchableOpacity
                style={[commonStyles.card, ownProfile.menuRow]}
                activeOpacity={0.7}
                onPress={() => onSelect('events')}
            >
                <Ionicons name="calendar-outline" size={25} color="black" />
                <View style={ownProfile.menuTextWrapper}>
                    <Text style={ownProfile.title}>{t('menu.events.title')}</Text>
                    <Text style={ownProfile.subtitle}>{t('menu.events.subtitle')}</Text>
                </View>
                <Ionicons name="chevron-forward" size={24} color="black" />
            </TouchableOpacity>
            <TouchableOpacity
                style={[commonStyles.card, ownProfile.menuRow]}
                activeOpacity={0.7}
                onPress={() => onSelect('training')}
            >
                <FontAwesome5 name="running" size={24} color="black" />
                <View style={ownProfile.menuTextWrapper}>
                    <Text style={ownProfile.title}>{t('menu.training.title')}</Text>
                    <Text style={ownProfile.subtitle}>{t('menu.training.subtitle')}</Text>
                </View>
                <Ionicons name="chevron-forward" size={24} color="black" />
            </TouchableOpacity>
            <TouchableOpacity
                style={[commonStyles.card, ownProfile.menuRow]}
                activeOpacity={0.7}
                onPress={() => onNavigate('EditProfileScreen')}
            >
                <FontAwesome6 name="contact-card" size={24} color="black" />
                <View style={ownProfile.menuTextWrapper}>
                    <Text style={ownProfile.title}>{t('menu.account.title')}</Text>
                    <Text style={ownProfile.subtitle}>{t('menu.account.subtitle')}</Text>
                </View>
                <Ionicons name="chevron-forward" size={24} color="black" />
            </TouchableOpacity>
        </View>
    );
};

const OwnProfile: React.FC<OwnProfileprops> = ({ route }) => {
    const { t } = useTranslation('ownProfile');
    const { width } = useDimensions();
    const insets = useSafeAreaInsets(); 
    const isGestureNav = insets.bottom > 0;
    const isLandscape = width
    const [activeSection, setActiveSection] = useState<SectionKey>('menu')
    const flatListRef = useRef<FlatList>(null);
    const [profile, setProfile] = useState<AthleteProfile | null>(null);
    const [liveEvents, setLiveEvents] = useState<AthleteEvent[]>([]);
    const [pastEvents, setPastEvents] = useState<AthleteEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMoreLive, setLoadingMoreLive] = useState(false);
    const [loadingMorePast, setLoadingMorePast] = useState(false);
    const [pagination, setPagination] = useState<PaginationState>(INITIAL_PAGINATION);
    const isInitialMount = useRef(true);
    const isFetching = useRef(false);
    const fromEditFetched = useRef(false);
    const activeTabRef = useRef<Tab>('Live');
    const navigation = useNavigation();
    const targetId = route.params?.customer_app_id ?? 0;
    const fromEdit = route.params?.fromEdit;

    const goBack = useCallback(() => setActiveSection('menu'), [])

    const { error, hasError, handleApiError, clearError } = useScreenError();

    React.useEffect(() => {
        if (!targetId || targetId === 0) {
            handleApiError(t('profile:errors.invalid_user_id'));
            setLoading(false);
        }
    }, [targetId, t]);

    const fetchProfile = useCallback(async (bustCache: boolean = false) => {
        if (!targetId || targetId === 0) {
            if (API_CONFIG.DEBUG) {
                console.error('Invalid targetId:', targetId);
            }
            return;
        }
        if (isFetching.current) {
            if (API_CONFIG.DEBUG) {
                console.log('⏸Already fetching, skipping duplicate call');
            }
            return;
        }
        try {
            isFetching.current = true;
            setLoading(true);
            clearError();
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
                console.log('Profile loaded:', {
                    live: result.tabs.live.length,
                    past: result.tabs.past.length,
                });
            }
        } catch (err: any) {
            if (API_CONFIG.DEBUG) {
                console.error('Profile fetch failed:', err);
            }
            handleApiError(err);
        } finally {
            setLoading(false);
            isFetching.current = false;
        }
    }, [targetId, t]);

    useFocusEffect(
        useCallback(() => {
            if (!targetId || targetId === 0) {
                return;
            }
            if (isFetching.current) {
                if (API_CONFIG.DEBUG) {
                    console.log('Already fetching, skipping duplicate call');
                }
                return;
            }
            const fetchData = async () => {
                if (fromEdit && !fromEditFetched.current) {
                    fromEditFetched.current = true;
                    if (API_CONFIG.DEBUG) {
                        console.log('Coming from edit screen - busting cache');
                    }
                    await fetchProfile(true);
                } else if (isInitialMount.current) {
                    isInitialMount.current = false;
                    await fetchProfile(false);
                } else {
                    if (API_CONFIG.DEBUG) {
                        console.log('Returning to screen - syncing scroll only');
                    }
                    const index = TABS.indexOf(activeTabRef.current);
                    setTimeout(() => {
                        flatListRef.current?.scrollToIndex({ index, animated: false });
                    }, 50);
                }
            };
            fetchData();
            return () => {
                isFetching.current = false;
            };
        }, [fetchProfile, fromEdit, targetId])
    );

    const loadMoreLive = useCallback(async () => {
        if (!targetId || loadingMoreLive || pagination.live.page >= pagination.live.total_pages) return;
        const nextPage = pagination.live.page + 1;
        setLoadingMoreLive(true);
        try {
            const result = await eventService.getAthleteProfile({ page_live: nextPage }, targetId);
            setLiveEvents(prev => {
                const existingIds = new Set(prev.map(e => e.participant_app_id));
                return [...prev, ...result.tabs.live.filter(e => !existingIds.has(e.participant_app_id))];
            });
            if (result.pagination?.live) {
                setPagination(prev => ({ ...prev, live: { page: nextPage, total_pages: result.pagination.live.total_pages } }));
            }
        } catch (err) {
            handleApiError(err);
        } finally {
            setLoadingMoreLive(false);
        }
    }, [loadingMoreLive, pagination.live, targetId]);

    const loadMorePast = useCallback(async () => {
        if (!targetId || loadingMorePast || pagination.past.page >= pagination.past.total_pages) return;
        const nextPage = pagination.past.page + 1;
        setLoadingMorePast(true);
        try {
            const result = await eventService.getAthleteProfile({ page_past: nextPage }, targetId);
            setPastEvents(prev => {
                const existingIds = new Set(prev.map(e => e.participant_app_id));
                return [...prev, ...result.tabs.past.filter(e => !existingIds.has(e.participant_app_id))];
            });
            if (result.pagination?.past) {
                setPagination(prev => ({ ...prev, past: { page: nextPage, total_pages: result.pagination.past.total_pages } }));
            }
        } catch (err) {
            handleApiError(err);
        } finally {
            setLoadingMorePast(false);
        }
    }, [loadingMorePast, pagination.past, targetId]);

    const renderContent = (): React.ReactNode => {

        if (activeSection === 'menu') return <MenuContent onSelect={setActiveSection} onNavigate={(screen) => navigation.navigate(screen as never)} profile={profile} />;
        if (activeSection === 'events') return (
            <EventsContent
                onBack={goBack}
                liveEvents={liveEvents.filter(
                    event => event.event_source === 'partner'
                )}
                pastEvents={pastEvents.filter(
                    event => event.event_source === 'partner'
                )}
                profile={profile}
                loadMoreLive={loadMoreLive}
                loadMorePast={loadMorePast}
                loadingMoreLive={loadingMoreLive}
                loadingMorePast={loadingMorePast}
                pagination={pagination}
            />
        );
        if (activeSection === 'training') return <TrainingContent
            onBack={goBack}
            liveEvents={liveEvents.filter(
                event => event.event_source === 'custom'
            )}
            profile={profile}
            loadMoreLive={loadMoreLive}
            loadingMoreLive={loadingMoreLive}
            pagination={pagination}
        />;

        return null;
    };

    const fullName = profile
        ? `${profile.firstname} ${profile.lastname}`.toUpperCase()
        : '';

    return (
        <SafeAreaView style={ownProfile.safeArea} edges={isLandscape && !isGestureNav ? ['top', 'left','right'] : ['top']}>
            <StatusBar barStyle="dark-content" backgroundColor={colors.themeiColor} />
            <TouchableOpacity style={{ paddingHorizontal: spacing.xl, alignSelf: 'flex-start', marginTop: spacing.md, }} onPress={() => navigation.reset({ index: 0, routes: [{ name: 'HomeScreen' as never }], })}>
                <Ionicons name="arrow-back" size={28} color={colors.primaryDark} />
            </TouchableOpacity>
            <ScrollView
                nestedScrollEnabled={true}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ flexGrow: 1 }}
            >
                <View style={ownProfile.scrollContent}>
                    <View style={ownProfile.header} />
                    <View style={ownProfile.profileRow}>
                        <View style={ownProfile.avatarWrapper}>
                            {profile?.profile_picture ? (
                                <Image
                                    source={{ uri: profile.profile_picture || undefined }}
                                    style={ownProfile.avatar}
                                />
                            ) : (
                                <View style={[ownProfile.avatar, ownProfile.initialsWrapper]}>
                                    <Text style={ownProfile.initialsText}>
                                        {`${profile?.firstname?.charAt(0) ?? ''}${profile?.lastname?.charAt(0) ?? ''}`.toUpperCase() || '?'}
                                    </Text>
                                </View>
                            )}
                            <TouchableOpacity style={ownProfile.cameraBadge}
                                onPress={() => navigation.navigate('EditProfileScreen' as never)} >
                                <Ionicons name="camera-sharp" size={16} color={colors.gray900} />
                            </TouchableOpacity>
                        </View>
                        <View style={ownProfile.profileInfo}>
                            <Text style={commonStyles.title}>{fullName || '—'}</Text>
                            <View style={ownProfile.statsRow}>
                                <TouchableOpacity style={ownProfile.statItem} onPress={() => navigation.navigate('FollowersList' as never)}>
                                    <Text style={ownProfile.statNumber}>{profile?.followers_count}</Text>
                                    <Text style={ownProfile.statLabel}>{t('ownProfile:profile.followers')}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={ownProfile.statItem} onPress={() => navigation.navigate('UserFavouriteList' as never)}>
                                    <Text style={ownProfile.statNumber}>{profile?.following_count}</Text>
                                    <Text style={ownProfile.statLabel}>{t('ownProfile:profile.following')}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>

                    <View style={ownProfile.whiteBody}>
                        {renderContent()}
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    )
}

export default OwnProfile
