import React, { useCallback, useRef, useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlatList } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, Entypo } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ResultDetailspops } from '../../types/navigation';
import RaceInfoTab from './RaceInfoTab';
import RunnerInfoTab from './RunnerInfoTab';
import { resultInfoStyles as s } from '../../styles/resultDetails.styles';
import { commonStyles, palette } from '../../styles/common.styles';
import RaceLive from './RaceLive';
import { useFollowManager } from '../../hooks/useFollowManager';
import LiveTimingPoint from './LiveTimingPoint';
import { useResultDetail } from '../../hooks/useResultDetail';
import UpcomingRace from './UpcomingRace';
import { TrackingPasswordModal } from '../../components/TrackingPasswordModal';
import ErrorScreen from '../../components/ErrorScreen';
import { AppHeader } from '../../components/common/AppHeader';
import { useDimensions } from '../../hooks/useDimensions';
import { analyticsService } from '../../services/analyticsService';
import { ANALYTICS_SCREENS, ANALYTICS_BUTTONS } from '../../constants/analyticsScreens';

type TabKey = 'raceInfo' | 'timingPoint' | 'runnerInfo';
const TAB_KEYS: TabKey[] = ['raceInfo', 'timingPoint', 'runnerInfo'];

const ResultDetails: React.FC<ResultDetailspops> = ({ navigation, route }) => {
    const { t } = useTranslation(['resultdetails', 'common']);
    const { width: windowWidth } = useDimensions();
    const [containerWidth, setContainerWidth] = useState(0);
    const width = containerWidth || windowWidth;
    const insets = useSafeAreaInsets();
    const isGestureNav = insets.bottom > 0;
    const isLandscape = windowWidth
    const {
        raceStatus,
        product_app_id,
        product_option_value_app_id,
        bib,
        from_live,
    } = route.params;

    const { data, loading, hasError, error, clearError, retry } = useResultDetail(
        product_app_id,
        product_option_value_app_id,
        bib,
        from_live ?? 0,
    );

    const {
        isFollowed, isLoading, refreshFollowedUsers,
        handleFollowPress, passwordModalVisible,
        isVerifying, passwordError,
        handlePasswordSubmit, handlePasswordModalClose,
    } = useFollowManager(t, product_app_id, undefined, {
        screenName: ANALYTICS_SCREENS.RESULT_DETAILS,
        raceName: data?.event?.race_name,
    });

    const [activeTab, setActiveTab] = useState<TabKey>('raceInfo');
    const activeTabRef = useRef<TabKey>('raceInfo');
    const flatListRef = useRef<FlatList<TabKey>>(null);
    const tabScrollRef = useRef<ScrollView>(null);

    const canFollow = !!(
        (data?.race_info?.customer_app_id && data.race_info.customer_app_id > 0) ||
        (data?.race_info?.bib && product_app_id)
    );

    const Followed = isFollowed(product_app_id, data?.race_info?.bib ?? '', data?.race_info?.customer_app_id);
    const Loading = isLoading(product_app_id, data?.race_info?.bib ?? '', data?.race_info?.customer_app_id);

    useEffect(() => {
        const index = TAB_KEYS.indexOf(activeTabRef.current);
        const timer = setTimeout(() => {
            flatListRef.current?.scrollToIndex({ index, animated: false });
            tabScrollRef.current?.scrollTo({
                x: index * (width / 3) - width / 6,
                animated: false,
            });
        }, 80);
        return () => clearTimeout(timer);
    }, [width]);

    const handleFollow = () => {
        if (!canFollow) return;
        void analyticsService.logInteraction(
            ANALYTICS_SCREENS.RESULT_DETAILS,
            ANALYTICS_BUTTONS.FOLLOW,
            Followed ? 'unfollow' : 'follow',
        );
        handleFollowPress({
            customer_app_id: data?.race_info?.customer_app_id,
            password_protected: data?.race_info?.password_protected ?? 0,
            bib_number: data?.race_info?.bib ?? '',
        });
    };

    const handleTabPress = useCallback((tab: TabKey) => {
        // action distinguishes a deliberate tab tap from a swipe below — same
        // destination, different intent, and the ratio says whether the tab bar
        // is discoverable.
        void analyticsService.logInteraction(
            ANALYTICS_SCREENS.RESULT_DETAILS,
            ANALYTICS_BUTTONS.TAB,
            'tap',
            { tab_name: tab },
        );
        const index = TAB_KEYS.indexOf(tab);
        activeTabRef.current = tab;
        setActiveTab(tab);
        flatListRef.current?.scrollToIndex({ index, animated: true });
        tabScrollRef.current?.scrollTo({
            x: index * (width / 3) - width / 6,
            animated: true,
        });
    }, [width]);

    const handleSwipe = useCallback((e: any) => {
        const index = Math.round(e.nativeEvent.contentOffset.x / width);
        if (index >= 0 && index < TAB_KEYS.length) {
            const tab = TAB_KEYS[index];
            if (tab !== activeTabRef.current) {
                void analyticsService.logInteraction(
                    ANALYTICS_SCREENS.RESULT_DETAILS,
                    ANALYTICS_BUTTONS.TAB,
                    'swipe',
                    { tab_name: tab },
                );
                activeTabRef.current = tab;
                setActiveTab(tab);
                tabScrollRef.current?.scrollTo({
                    x: index * (width / 3) - width / 6,
                    animated: true,
                });
            }
        }
    }, [width]);

    const renderTabPage = useCallback(({ item }: { item: TabKey }) => {
        const participantStatus = data?.race_info?.participant_status;
        return (
            <View style={[s.page, { width }]}>
                {item === 'raceInfo' && (
                    raceStatus === 'in_progress' && (participantStatus === 'in_progress' || participantStatus === 'not_started') ? (
                        <RaceLive raceInfo={data?.race_info} event={data?.event} checkpoints={data?.checkpoints} />
                    ) : raceStatus === 'finished' || (raceStatus === 'in_progress' && participantStatus !== 'not_started' && participantStatus !== 'in_progress') ? (
                        <RaceInfoTab raceInfo={data?.race_info} event={data?.event} checkpoints={data?.checkpoints} />
                    ) : raceStatus === 'not_started' || participantStatus === 'not_started' ? (
                        <UpcomingRace raceInfo={data?.race_info} event={data?.event} />
                    ) : null
                )}
                {item === 'timingPoint' && (
                    <LiveTimingPoint checkpoints={data?.checkpoints} raceStatus={data?.event?.race_status} gender={data?.race_info?.gender} />
                )}
                {item === 'runnerInfo' && (
                    <RunnerInfoTab
                        runnerInfo={data?.runner_info}
                        raceInfo={data?.race_info}
                        showUtmbIndex={data?.event?.show_utmb_index === 1}
                        liveTrackingActivated={data?.race_info?.live_tracking_activated}
                        isFollowing={Followed}
                        onMapPress={() => {
                            void analyticsService.logInteraction(
                                ANALYTICS_SCREENS.RESULT_DETAILS,
                                ANALYTICS_BUTTONS.MAP,
                                'tap',
                            );
                             navigation.navigate('LiveTracking', {
                                product_app_id: data?.event?.product_app_id ?? product_app_id,
                                product_option_value_app_id: data?.event?.product_option_value_app_id,
                                event_name: data?.event?.race_name ?? '',
                                event_source: 'partner',
                                selectedDistanceLabel: data?.event?.distance_name,
                            });
                        }}
                    />
                )}
            </View>
        );
    }, [data, raceStatus, width]);

    if (loading) {
        return (
            <SafeAreaView style={commonStyles.container} edges={['top', 'bottom']} >
                <View style={s.header}>
                    <TouchableOpacity
                        style={s.headerBackBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        onPress={() => navigation.goBack()}
                    >
                        <Ionicons name="chevron-back" size={32} color={palette.ink} />
                    </TouchableOpacity>
                    <View style={s.headerCenter}>
                        <Text style={commonStyles.title}>...</Text>
                    </View>
                </View>
                <View style={commonStyles.centerContainer}>
                    <ActivityIndicator size="large" color={palette.navy} />
                </View>
            </SafeAreaView>
        );
    }

    if (hasError && !loading) {
        return (
            <SafeAreaView style={commonStyles.container} edges={['bottom']}>
                <AppHeader showBack />
                <ErrorScreen
                    type={error!.type}
                    title={error!.title}
                    message={error!.message}
                    onRetry={() => { clearError(); retry(); }}
                />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={commonStyles.container} edges={isLandscape && !isGestureNav ? ['left','right'] : ['bottom']}>
            <AppHeader title={data?.race_info?.name ?? ''} showBack />
            <View
                style={{ flex: 1 }}
                onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
            >
                {/* Sub-header — one muted meta line under the band, per the
                    mockups. The name moved up into the lime band. */}
                <View style={s.header}>
                    <View style={s.headerCenter}>
                        <Text style={s.runnerMeta} numberOfLines={1}>
                            {[
                                data?.race_info?.bib ? `${t('raceInfo.bib', 'Bib')} ${data.race_info.bib}` : null,
                                data?.event?.distance_name,
                            ].filter(Boolean).join(' · ')}
                        </Text>
                    </View>
                    {canFollow && (
                        <TouchableOpacity
                            onPress={handleFollow}
                            disabled={Loading}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            accessibilityRole="button"
                            accessibilityLabel={Followed ? 'Unfollow athlete' : 'Follow athlete'}
                        >
                            <Entypo name={Followed ? 'star' : 'star-outlined'} size={26} color={palette.lime} />
                        </TouchableOpacity>
                    )}
                </View>
                <View style={s.tabStrip}>
                    <ScrollView
                        ref={tabScrollRef}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={s.tabBarContent}
                        scrollEventThrottle={16}
                    >
                        {TAB_KEYS.map((tabKey) => (
                            <TouchableOpacity
                                key={tabKey}
                                style={[s.tabItem, activeTab === tabKey && s.tabItemActive]}
                                onPress={() => handleTabPress(tabKey)}
                                activeOpacity={0.7}
                            >
                                <Text style={[s.tabText, activeTab === tabKey && s.tabTextActive]}>
                                    {t(`tabs.${tabKey}`)}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                <FlatList
                    ref={flatListRef}
                    data={TAB_KEYS}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    keyExtractor={(item) => item}
                    renderItem={renderTabPage}
                    onMomentumScrollEnd={handleSwipe}
                    initialScrollIndex={0}
                    onLayout={() => {
                        const index = TAB_KEYS.indexOf(activeTabRef.current);
                        flatListRef.current?.scrollToIndex({ index, animated: false });
                    }}
                    getItemLayout={(_, index) => ({
                        length: width,
                        offset: width * index,
                        index,
                    })}
                    style={s.pageList}
                />

                <TrackingPasswordModal
                    visible={passwordModalVisible}
                    isVerifying={isVerifying}
                    passwordError={passwordError}
                    onSubmit={handlePasswordSubmit}
                    onClose={handlePasswordModalClose}
                />
            </View>
        </SafeAreaView>
    );
};

export default ResultDetails;