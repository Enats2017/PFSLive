import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, Image, StatusBar, Dimensions, TouchableOpacity, ScrollView, Platform, StyleSheet, ActivityIndicator } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, commonStyles, spacing } from '../../styles/common.styles'
import { Ionicons, FontAwesome5, FontAwesome6, FontAwesome, Feather } from '@expo/vector-icons'
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
import { DeleteEventModal } from '../../components/DeleteEventModal';
import { toastError, toastSuccess } from '../../../utils/toast';
import { appleVerifyService } from '../../services/appleverifyservice';
import PurchaseStatusModal from '../../components/PurchaseStatusModal';

type SectionKey = 'menu' | 'events' | 'training' | 'account'
interface MenuContentProps {
    onSelect: (id: SectionKey) => void;
    onNavigate: (screen: string) => void;
    profile: AthleteProfile | null;
    onRefresh: () => void;
    refreshLoading: boolean;
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


const MenuContent: React.FC<MenuContentProps> = ({ onSelect, onNavigate, profile, onRefresh, refreshLoading }) => {
    const { t } = useTranslation('ownProfile');
    const renderIosCard = () => {
        if (profile?.in_process_payment === 1) {
            return (
                <View style={ownProfile.ioscard}>
                    <View style={{ alignItems: 'center', paddingVertical: 8 }}>
                        <Ionicons name="time-outline" size={28} color={colors.themeiColor} />
                        <Text style={[ownProfile.iostitle, { textAlign: 'center', marginTop: 8 }]}>
                            {t('ownProfile:membershipCard.paymentProcessing')}
                        </Text>
                        <TouchableOpacity
                            onPress={onRefresh}
                            activeOpacity={0.8}
                            style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 6 }}
                        >
                            {refreshLoading ? (
                                <ActivityIndicator
                                    size="small"
                                    color={colors.themeiColor}
                                />
                            ) : (
                                <>
                                    <Feather name="refresh-ccw" size={16} color={colors.themeiColor} />
                                    <Text
                                        style={{
                                            color: colors.themeiColor,
                                            fontSize: 14,
                                            fontWeight: '600',
                                        }}
                                    >
                                        {t('ownProfile:membershipCard.refresh')}
                                    </Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            );
        }

        return (
            <View style={ownProfile.ioscard}>
                <View style={ownProfile.iosheader}>
                    <Ionicons name="navigate-circle-outline" size={24} color={colors.themeiColor} />
                    <Text style={ownProfile.iostitle}>
                        {profile?.membership_info?.has_membership && profile?.membership_info?.membership_name
                            ? `${profile?.membership_info?.membership_name} ${t('ownProfile:membershipCard.liteTitle')}`
                            : t('ownProfile:membershipCard.noMembershipTitle')}
                    </Text>
                </View>

                {profile?.membership_info?.has_membership ? (
                    profile?.membership_info?.unlimited ? (
                        <Text style={ownProfile.iossubtitle}>
                            {t('ownProfile:tracking.unlimited')}
                        </Text>
                    ) : (profile?.membership_info?.remaining ?? 0) > 0 ? (
                        <Text style={ownProfile.iossubtitle}>
                            <Text style={ownProfile.iosbold}>{profile?.membership_info?.remaining ?? 0}</Text>
                            {' '}{t('ownProfile:membershipCard.sessionsLeft')}
                        </Text>
                    ) : (
                        <Text style={ownProfile.iossubtitle}>
                            {t('ownProfile:tracking.exhausted')}
                        </Text>
                    )
                ) : (
                    <Text style={ownProfile.iossubtitle}>
                        {t('ownProfile:membershipCard.noMembershipSubtitle')}
                    </Text>
                )}

                <TouchableOpacity
                    style={ownProfile.iosbutton}
                    activeOpacity={0.8}
                    onPress={() => onNavigate('MembershipPlansScreen')}
                >
                    <Text style={ownProfile.iosbuttonText}>
                        {t('ownProfile:membershipCard.viewPlans')}
                    </Text>
                    <Ionicons name="chevron-forward" size={18} color="#1A2233" />
                </TouchableOpacity>
            </View>
        );
    };

    return (
        <View style={ownProfile.menuSection}>
            {profile?.is_own_profile === 1 && (
                Platform.OS === 'ios' ? renderIosCard() : (
                    <TouchableOpacity style={ownProfile.trackingBanner} activeOpacity={0.85}>
                        <Ionicons name="navigate-circle-outline" size={30} color="black" />
                        <View style={ownProfile.trackingTextWrapper}>
                            {profile?.membership_info?.unlimited ? (
                                <>
                                    <Text style={ownProfile.title}>{t('ownProfile:tracking.unlimited')}</Text>
                                    <Text style={ownProfile.subtitle}>{t('ownProfile:tracking.subtitle')}</Text>
                                </>
                            ) : (profile?.membership_info?.remaining ?? 0) > 0 ? (
                                <>
                                    <Text style={ownProfile.title}>
                                        {t('ownProfile:tracking.remaining', { count: profile?.membership_info?.remaining ?? 0 })}
                                    </Text>
                                    <Text style={ownProfile.subtitle}>{t('ownProfile:tracking.subtitle')}</Text>
                                </>
                            ) : (
                                <>
                                    <Text style={ownProfile.title}>{t('ownProfile:tracking.exhausted')}</Text>
                                    <Text style={ownProfile.subtitle}>{t('ownProfile:tracking.subtitle')}</Text>
                                </>
                            )}
                        </View>
                    </TouchableOpacity>
                )
            )}

            <TouchableOpacity style={[commonStyles.card, ownProfile.menuRow]} activeOpacity={0.7} onPress={() => onSelect('events')}>
                <Ionicons name="calendar-outline" size={25} color="black" />
                <View style={ownProfile.menuTextWrapper}>
                    <Text style={ownProfile.title}>{t('menu.events.title')}</Text>
                    <Text style={ownProfile.subtitle}>{t('menu.events.subtitle')}</Text>
                </View>
                <Ionicons name="chevron-forward" size={24} color="black" />
            </TouchableOpacity>

            <TouchableOpacity style={[commonStyles.card, ownProfile.menuRow]} activeOpacity={0.7} onPress={() => onSelect('training')}>
                <FontAwesome5 name="running" size={24} color="black" />
                <View style={ownProfile.menuTextWrapper}>
                    <Text style={ownProfile.title}>{t('menu.training.title')}</Text>
                    <Text style={ownProfile.subtitle}>{t('menu.training.subtitle')}</Text>
                </View>
                <Ionicons name="chevron-forward" size={24} color="black" />
            </TouchableOpacity>

            <TouchableOpacity style={[commonStyles.card, ownProfile.menuRow]} activeOpacity={0.7} onPress={() => onNavigate('EditProfileScreen')}>
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
    const [partnerLive, setPartnerLive] = useState<AthleteEvent[]>([]);
    const [partnerPast, setPartnerPast] = useState<AthleteEvent[]>([]);
    const [customLive, setCustomLive] = useState<AthleteEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshLoading, setRefreshLoading] = useState(false);

    const [partnerPagination, setPartnerPagination] = useState<PaginationState>(INITIAL_PAGINATION);
    const [customPagination, setCustomPagination] = useState<PaginationState>(INITIAL_PAGINATION);

    const [loadingMorePartnerLive, setLoadingMorePartnerLive] = useState(false);
    const [loadingMorePartnerPast, setLoadingMorePartnerPast] = useState(false);
    const [loadingMoreCustomLive, setLoadingMoreCustomLive] = useState(false);
    const isInitialMount = useRef(true);
    const isFetching = useRef(false);
    const fromEditFetched = useRef(false);
    const activeTabRef = useRef<Tab>('Live');
    const navigation = useNavigation();
    const targetId = route.params?.customer_app_id ?? 0;
    const fromEdit = route.params?.fromEdit;
    const [deleteTarget, setDeleteTarget] = useState<AthleteEvent | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const goBack = useCallback(() => setActiveSection('menu'), [])
    const [avatarLoading, setAvatarLoading] = useState(true);

    const { error, hasError, handleApiError, clearError } = useScreenError();

    React.useEffect(() => {
        if (!targetId || targetId === 0) {
            handleApiError(t('profile:errors.invalid_user_id'));
            setLoading(false);
        }
    }, [targetId, t]);

    useEffect(() => {
        setAvatarLoading(true);
    }, [profile?.profile_picture]);

    const fetchProfile = useCallback(async (bustCache: boolean = false) => {
        if (!targetId || targetId === 0) return;
        if (isFetching.current) return;
        try {
            isFetching.current = true;
            setLoading(true);
            clearError();

            const [partnerResult, customResult] = await Promise.all([
                eventService.getAthleteProfile({ page_live: 1, page_past: 1 }, targetId, bustCache, 'partner'),
                eventService.getAthleteProfile({ page_live: 1, page_past: 1 }, targetId, bustCache, 'custom'),
            ]);

            setProfile(partnerResult.profile);
            console.log('partnerResult.profile', partnerResult.profile);// same profile either call, partner's is fine
            setPartnerLive(partnerResult.tabs.live);
            setPartnerPast(partnerResult.tabs.past);
            setCustomLive(customResult.tabs.live);

            if (partnerResult.pagination) {
                setPartnerPagination({
                    live: { page: partnerResult.pagination.live.page, total_pages: partnerResult.pagination.live.total_pages },
                    past: { page: partnerResult.pagination.past.page, total_pages: partnerResult.pagination.past.total_pages },
                });
            }
            if (customResult.pagination) {
                setCustomPagination({
                    live: { page: customResult.pagination.live.page, total_pages: customResult.pagination.live.total_pages },
                    past: { page: customResult.pagination.past.page, total_pages: customResult.pagination.past.total_pages },
                });
            }
        } catch (err: any) {
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

    const handleRefresh = useCallback(async () => {
        try {
            setRefreshLoading(true);
            await fetchProfile(true);
        } finally {
            setRefreshLoading(false);
        }
    }, [fetchProfile]);

    const loadMorePartnerLive = useCallback(async () => {
        if (!targetId || loadingMorePartnerLive || partnerPagination.live.page >= partnerPagination.live.total_pages) return;
        const nextPage = partnerPagination.live.page + 1;
        setLoadingMorePartnerLive(true);
        try {
            const result = await eventService.getAthleteProfile({ page_live: nextPage }, targetId, false, 'partner');
            setPartnerLive(prev => {
                const existingIds = new Set(prev.map(e => e.participant_app_id));
                return [...prev, ...result.tabs.live.filter(e => !existingIds.has(e.participant_app_id))];
            });
            if (result.pagination?.live) {
                setPartnerPagination(prev => ({ ...prev, live: { page: nextPage, total_pages: result.pagination.live.total_pages } }));
            }
        } catch (err) {
            handleApiError(err);
        } finally {
            setLoadingMorePartnerLive(false);
        }
    }, [loadingMorePartnerLive, partnerPagination.live, targetId]);

    const loadMorePartnerPast = useCallback(async () => {
        if (!targetId || loadingMorePartnerPast || partnerPagination.past.page >= partnerPagination.past.total_pages) return;
        const nextPage = partnerPagination.past.page + 1;
        setLoadingMorePartnerPast(true);
        try {
            const result = await eventService.getAthleteProfile({ page_past: nextPage }, targetId, false, 'partner');
            setPartnerPast(prev => {
                const existingIds = new Set(prev.map(e => e.participant_app_id));
                return [...prev, ...result.tabs.past.filter(e => !existingIds.has(e.participant_app_id))];
            });
            if (result.pagination?.past) {
                setPartnerPagination(prev => ({ ...prev, past: { page: nextPage, total_pages: result.pagination.past.total_pages } }));
            }
        } catch (err) {
            handleApiError(err);
        } finally {
            setLoadingMorePartnerPast(false);
        }
    }, [loadingMorePartnerPast, partnerPagination.past, targetId]);

    const loadMoreCustomLive = useCallback(async () => {
        if (!targetId || loadingMoreCustomLive || customPagination.live.page >= customPagination.live.total_pages) return;
        const nextPage = customPagination.live.page + 1;
        setLoadingMoreCustomLive(true);
        try {
            const result = await eventService.getAthleteProfile({ page_live: nextPage }, targetId, false, 'custom');
            setCustomLive(prev => {
                const existingIds = new Set(prev.map(e => e.participant_app_id));
                return [...prev, ...result.tabs.live.filter(e => !existingIds.has(e.participant_app_id))];
            });
            if (result.pagination?.live) {
                setCustomPagination(prev => ({ ...prev, live: { page: nextPage, total_pages: result.pagination.live.total_pages } }));
            }
        } catch (err) {
            handleApiError(err);
        } finally {
            setLoadingMoreCustomLive(false);
        }
    }, [loadingMoreCustomLive, customPagination.live, targetId]);

    const handleDeleteRequest = useCallback((event: AthleteEvent) => {
        if (event.can_delete !== 1 || !event.product_custom_app_id) return;
        setDeleteTarget(event);
    }, []);


    const handleCancelDelete = useCallback(() => {
        if (isDeleting) return;
        setDeleteTarget(null);
    }, [isDeleting]);


    const handleConfirmDelete = useCallback(async () => {
        if (!deleteTarget?.product_custom_app_id) return;
        try {
            setIsDeleting(true);
            const { action } = await eventService.deleteCustomEvent(deleteTarget.product_custom_app_id);

            if (action === 'custom_event_deleted' || action === 'custom_event_not_found') {
                setDeleteTarget(null);
                // Same pattern as fromEdit — force a fresh fetch, bypassing the backend cache
                await fetchProfile(true);
                toastSuccess(t('ownProfile:deleteEvent.deleteSuccess'));
            } else if (action === 'tracking_already_started') {
                setDeleteTarget(null);
                handleApiError(t('ownProfile:deleteEvent.trackingStartedError'));
                toastSuccess(t('ownProfile:deleteEvent.deleteSuccess'));
            }
        } catch (err) {
            handleApiError(err);
        } finally {
            setIsDeleting(false);
        }
    }, [deleteTarget, handleApiError, t]);

    const renderContent = (): React.ReactNode => {
        if (activeSection === 'menu') return <MenuContent onSelect={setActiveSection} onNavigate={(screen) => navigation.navigate(screen as never)} profile={profile} onRefresh={handleRefresh} refreshLoading={refreshLoading} />;
        if (activeSection === 'events') return (
            <EventsContent
                onBack={goBack}
                liveEvents={partnerLive}
                pastEvents={partnerPast}
                profile={profile}
                loadMoreLive={loadMorePartnerLive}
                loadMorePast={loadMorePartnerPast}
                loadingMoreLive={loadingMorePartnerLive}
                loadingMorePast={loadingMorePartnerPast}
                pagination={partnerPagination}
            />
        );
        if (activeSection === 'training') return <TrainingContent
            onBack={goBack}
            liveEvents={customLive}
            profile={profile}
            loadMoreLive={loadMoreCustomLive}
            loadingMoreLive={loadingMoreCustomLive}
            pagination={customPagination}
            onDeleteEvent={handleDeleteRequest}
        />;

        return null;
    };

    const fullName = profile
        ? `${profile.firstname} ${profile.lastname}`.toUpperCase()
        : '';

    return (
        <SafeAreaView style={ownProfile.safeArea} edges={isLandscape && !isGestureNav ? ['top', 'left', 'right'] : ['top']}>
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
                                <>
                                    <Image
                                        source={{ uri: profile.profile_picture || undefined }}
                                        style={ownProfile.avatar}
                                        onLoad={() => setAvatarLoading(false)}
                                        onError={() => setAvatarLoading(false)}
                                    />
                                    {avatarLoading && (
                                        <ActivityIndicator
                                            size="small"
                                            color={colors.themeiColor}
                                            style={{
                                                position: 'absolute',
                                                top: 0,
                                                left: 0,
                                                right: 0,
                                                bottom: 0,
                                                justifyContent: 'center',
                                                alignItems: 'center',
                                            }}
                                        />
                                    )}
                                </>
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
            <DeleteEventModal
                visible={!!deleteTarget}
                event={deleteTarget}
                isDeleting={isDeleting}
                onCancel={handleCancelDelete}
                onConfirm={handleConfirmDelete}
            />
        </SafeAreaView>
    )
}

export default OwnProfile


