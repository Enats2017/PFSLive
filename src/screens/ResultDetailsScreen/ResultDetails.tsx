import React, { useCallback, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StatusBar, Dimensions, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlatList } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, Entypo } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ResultDetailspops } from '../../types/navigation';
import RaceInfoTab from './RaceInfoTab';
import RunnerInfoTab from './RunnerInfoTab';
import { resultInfoStyles as s } from '../../styles/resultDetails.styles';
import { colors, commonStyles } from '../../styles/common.styles';
import RaceLive from './RaceLive';
import { useFollowManager } from '../../hooks/useFollowManager';
import LiveTimingPoint from './LiveTimingPoint';
import { useResultDetail } from '../../hooks/useResultDetail';
import UpcomingRace from './UpcomingRace';
import { TrackingPasswordModal } from '../../components/TrackingPasswordModal';
import ErrorScreen from '../../components/ErrorScreen';
import { AppHeader } from '../../components/common/AppHeader';

type TabKey = 'raceInfo' | 'timingPoint' | 'runnerInfo';
const TAB_KEYS: TabKey[] = ['raceInfo', 'timingPoint', 'runnerInfo'];

const { width } = Dimensions.get('window');

const ResultDetails: React.FC<ResultDetailspops> = ({ navigation, route }) => {
    const { t } = useTranslation(['resultdetails','common']);
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
        isFollowed,
        isLoading,
        refreshFollowedUsers,
        handleFollowPress,
        passwordModalVisible,
        isVerifying,
        passwordError,
        handlePasswordSubmit,
        handlePasswordModalClose,
    } = useFollowManager(t, product_app_id);

    const [activeTab, setActiveTab] = useState<TabKey>('raceInfo');
    const flatListRef = useRef<FlatList<TabKey>>(null);
    const tabScrollRef = useRef<ScrollView>(null);

    const canFollow = !!(
        (data?.race_info?.customer_app_id && data.race_info.customer_app_id > 0) ||
        (data?.race_info?.bib && product_app_id)
    );

    // ✅ FIX: Call isFollowed as a function
    const Followed = isFollowed(
        product_app_id,
        data?.race_info?.bib ?? '',
        data?.race_info?.customer_app_id
    );

    const Loading = isLoading(
        product_app_id,
        data?.race_info?.bib ?? '',
        data?.race_info?.customer_app_id
    );

    const handleFollow = () => {
        if (!canFollow) return;
        handleFollowPress({
            customer_app_id: data?.race_info?.customer_app_id,
            password_protected: data?.race_info?.password_protected ?? 0,
            bib_number: data?.race_info?.bib ?? '',
        });
    };

    const handleTabPress = useCallback((tab: TabKey) => {
        const index = TAB_KEYS.indexOf(tab);
        setActiveTab(tab);
        flatListRef.current?.scrollToIndex({ index, animated: true });
        tabScrollRef.current?.scrollTo({
            x: index * (width / 3) - width / 6,
            animated: true,
        });
    }, []);

    const handleSwipe = useCallback((e: any) => {
        const index = Math.round(e.nativeEvent.contentOffset.x / width);
        if (index >= 0 && index < TAB_KEYS.length) {
            const tab = TAB_KEYS[index];
            setActiveTab(tab);
            tabScrollRef.current?.scrollTo({
                x: index * (width / 3) - width / 6,
                animated: true,
            });
        }
    }, []);

    const renderTabPage = useCallback(({ item }: { item: TabKey }) => {
        const participantStatus = data?.race_info?.participant_status;

        return (
            <View style={s.page}>
                {item === 'raceInfo' && (
                    raceStatus === 'in_progress' && participantStatus === 'in_progress' ? (
                        <RaceLive
                            raceInfo={data?.race_info}
                            event={data?.event}
                            checkpoints={data?.checkpoints}
                        />
                    ) : raceStatus === 'finished' || (raceStatus === 'in_progress' && participantStatus !== 'not_started' && participantStatus !== 'in_progress') ? (
                        <RaceInfoTab
                            raceInfo={data?.race_info}
                            event={data?.event}
                            checkpoints={data?.checkpoints}
                        />
                    ) : raceStatus === 'not_started' || participantStatus === 'not_started' ? (
                        <UpcomingRace
                            raceInfo={data?.race_info}
                            event={data?.event}
                        />
                    ) : null
                )}
                {item === 'timingPoint' && (
                    <LiveTimingPoint checkpoints={data?.checkpoints} raceStatus={data?.event?.race_status} />
                )}
                {item === 'runnerInfo' && (
                    <RunnerInfoTab runnerInfo={data?.runner_info} />
                )}
            </View>
        )
    }, [data, raceStatus]);

    if (loading) {
        return (
            <SafeAreaView style={commonStyles.container} edges={['top', 'bottom']}>
                <StatusBar barStyle="dark-content" />
                {/* Keep header visible with back button during load */}
                <View style={s.header}>
                    <TouchableOpacity
                        style={s.headerBackBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        onPress={() => navigation.goBack()}
                    >
                        <Ionicons name="chevron-back" size={32} color={colors.gray900} />
                    </TouchableOpacity>
                    <View style={s.headerCenter}>
                        <Text style={commonStyles.title}>...</Text>
                    </View>
                </View>
                <View style={commonStyles.centerContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            </SafeAreaView>
        );
    }

   if (hasError && !loading) {
        return (
            <SafeAreaView style={commonStyles.container} edges={['top']}>
                <StatusBar barStyle="dark-content" />
                <AppHeader/>
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
        <SafeAreaView style={commonStyles.container} edges={['top', 'bottom']}>
            <StatusBar barStyle="dark-content" />
            <View style={s.header}>
                <TouchableOpacity
                    style={s.headerBackBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    onPress={() => navigation.goBack()}
                >
                    <Ionicons name="chevron-back" size={32} color={colors.gray900} />
                </TouchableOpacity>

                <View style={s.headerCenter}>
                    <Text style={commonStyles.title}>{data?.race_info?.name ?? '...'}</Text>
                    <Text style={commonStyles.text}>{data?.race_info?.bib ?? ''}</Text>
                </View>

                {canFollow && (
                    <TouchableOpacity
                        onPress={handleFollow}
                        disabled={Loading}
                    >
                        <Entypo
                            name={Followed ? "heart" : "heart-outlined"}
                            size={30}
                            color="black"
                        />
                    </TouchableOpacity>
                )}
            </View>

            <View>
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
                            style={s.tabItem}
                            onPress={() => handleTabPress(tabKey)}
                            activeOpacity={0.7}
                        >
                            <Text style={[
                                commonStyles.text,
                                activeTab === tabKey && s.tabTextActive,
                            ]}>
                                {t(`tabs.${tabKey}`)}
                            </Text>

                            {activeTab === tabKey && (
                                <LinearGradient
                                    colors={['#e8341a', '#f4a100', '#1a73e8']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={s.tabUnderline}
                                />
                            )}
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
        </SafeAreaView>
    );
};

export default ResultDetails;