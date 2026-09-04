import React, { useCallback } from 'react';
import {
    View,
    Text,
    FlatList,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { AppHeader } from '../../components/common/AppHeader';
import { BottomNavigation } from '../../components/common/BottomNavigation';
import { commonStyles, palette, fonts } from '../../styles/common.styles';
import { resultListStyle } from '../../styles/ResultList.styles';
import { ResultListprops } from '../../types/navigation';
import Dropdown from '../../components/FilterDropdown';
import ResultCard from './ResultCard';
import { useResultList, TYPE_OPTIONS } from '../../hooks/useResultList';
import { RaceResult } from '../../services/resultList';
import { BottomNavigationFollower } from '../../components/common/BottomNavigationFollower';
import { useFollowManager } from '../../hooks/useFollowManager';
import { useFocusEffect } from '@react-navigation/native';
import ResultCardLive from './ResultCardLive';
import ResultCardBeforeRace from './ResultCardBeforeRace';
import { TrackingPasswordModal } from '../../components/TrackingPasswordModal';
import ErrorScreen from '../../components/ErrorScreen';
import { useDimensions } from '../../hooks/useDimensions';
import {  ANALYTICS_SCREENS } from '../../constants/analyticsScreens';

const StatItem = ({ label, value, highlight }: { label: string; value: number | string; highlight?: boolean }) => (
    <View style={resultListStyle.statItem}>
        <Text style={resultListStyle.statLabel}>{label}</Text>
        <Text style={[resultListStyle.statValue, highlight && resultListStyle.statValueHighlight]}>
            {value}
        </Text>
    </View>
);

const Divider = () => <View style={resultListStyle.divider} />;

const ResultListScreen: React.FC<ResultListprops> = ({ route }) => {
    const { t } = useTranslation(['allrace', 'common']);
    const { width } = useDimensions();
    const insets = useSafeAreaInsets();
    const isGestureNav = insets.bottom > 0;
    const isLandscape = width
    const {
        product_app_id,
        product_option_value_app_id,
        event_name,
        sourceScreen,
        sectionType,
        sourceTab,
        event_image,
    } = route.params;

    // Declared before useFollowManager so the follow events can report which
    // side of the app the user is on (participant vs follower result list).
    const resultListScreenName = sectionType === 'follower'
        ? ANALYTICS_SCREENS.FOLLOWER_RESULT_LIST
        : ANALYTICS_SCREENS.RESULT_LIST;

    const {
        isFollowed,
        isLoading,
        refreshFollowedUsers,
        followedUsers,
        followedBibs,
        handleFollowPress,
        passwordModalVisible,
        isVerifying,
        passwordError,
        handlePasswordSubmit,
        handlePasswordModalClose,
    } = useFollowManager(t, product_app_id, undefined, {
        screenName: resultListScreenName,
        raceName: event_name,
    });

    const initialType = sourceTab === 'live' ? TYPE_OPTIONS[1] : TYPE_OPTIONS[0];

    useFocusEffect(
        useCallback(() => {
            refreshFollowedUsers();
        }, [refreshFollowedUsers])
    );

    const {
        displayResults,
        selectedPovId,
        selectedType,
        selectedCategory,
        fromLive,
        isFavTab,
        initialLoad,
        filterLoad,
        pageLoad,
        refreshing,
        error,
        onDistanceSelect,
        onTypeSelect,
        onCategorySelect,
        onEndReached,
        onRefresh,
        retry,
        distanceOptions,
        categoryOptions,
        selectedDistanceLabel,
        selectedCategoryLabel,
        raceStatus,
        raceProgressStatus,
        currentPovId,  // ✅ use currentPovId — reflects selected distance for search
        showUtmbIndex,
        hasError,
        clearError,
        selectedCheckpoint,      // ← new: currently selected checkpoint FilterOption
        checkpointOptions,       // ← new: dropdown options derived from results[0].checkpoints
        onCheckpointSelect,
        statistics,
        raceDate,
    } = useResultList(
        product_app_id,
        product_option_value_app_id,
        followedUsers,
        initialType,
        followedBibs
    );

    const renderItem = useCallback(({ item }: { item: RaceResult }) => {
        const commonProps = {
            item,
            product_app_id,
            isFollowed: isFollowed(product_app_id, item.bib, item.customer_app_id),
            isLoading: isLoading(product_app_id, item.bib, item.customer_app_id),
            isCheckpointMode: !!selectedCheckpoint,
            selectedCheckpointIndex: selectedCheckpoint ? Number(selectedCheckpoint.value) : null,
            onToggleFollow: () => handleFollowPress({
                customer_app_id: item.customer_app_id,
                password_protected: item.password_protected ?? 0,
                bib_number: item.bib,
            }),
            analyticsScreenName: resultListScreenName,
        };

        if (raceStatus === 'not_started' || (raceStatus === 'in_progress' && raceProgressStatus === 'not_started')) {
            return (
                <ResultCardBeforeRace
                    {...commonProps}
                    showUtmbIndex={showUtmbIndex}
                    raceStatus={raceStatus}
                    currentPovId={currentPovId}
                    isWomen={item.gender === 'female' || selectedCategory === 'women'}
                />
            );
        }

        if (sourceTab === 'live' && raceStatus !== 'finished') {
            return (
                <ResultCardLive
                    {...commonProps}
                    fromLive={fromLive}
                    raceStatus={raceStatus}
                    currentPovId={currentPovId}
                    showUtmbIndex={showUtmbIndex}
                    isWomen={item.gender === 'female' || selectedCategory === 'women'}
                    
                />
            );
        }

        return (
            <ResultCard
                {...commonProps}
                fromLive={fromLive}
                raceStatus={raceStatus}
                currentPovId={currentPovId}
                isWomen={item.gender === 'female' || selectedCategory === 'women'}
                showUtmbIndex={showUtmbIndex}
                selectedCheckpoint={selectedCheckpoint} 
            />
        );
    }, [
        isFollowed, isLoading, handleFollowPress,
        raceStatus, raceProgressStatus, sourceTab, fromLive,
        product_app_id, currentPovId, showUtmbIndex, selectedCategory,
        selectedCheckpoint, selectedCheckpoint, resultListScreenName
    ]);

    const ListFooter = useCallback(() =>
        pageLoad
            ? <ActivityIndicator size="small" color={palette.navy} style={{ paddingVertical: 16 }} />
            : null
        , [pageLoad]);

    const keyExtractor = useCallback(
        (item: RaceResult, index: number) => `${item.bib}_${item.position}_${index}`,
        []
    );

    return (
        <SafeAreaView style={commonStyles.container} edges={isLandscape && !isGestureNav ? ['left', 'right'] : ['bottom']}>

            <AppHeader title={event_name}
                showLogo={true}
                showSearch={true}
                product_app_id={product_app_id}
                product_option_value_app_id={currentPovId}
                raceStatus={raceStatus as 'finished' | 'in_progress' | 'not_started'}
                showBack
            />

            <View style={resultListStyle.filterRow1}>
                <Dropdown
                    label={selectedDistanceLabel}
                    options={distanceOptions}
                    selected={{ label: selectedDistanceLabel, value: String(selectedPovId) }}
                    onSelect={onDistanceSelect}
                />
            </View>

            <View style={resultListStyle.filterRow2}>
                <Dropdown
                    label={t(selectedType.label)}
                    options={TYPE_OPTIONS}
                    selected={selectedType}
                    onSelect={onTypeSelect}
                />
                <Dropdown
                    label={selectedCategoryLabel}
                    options={categoryOptions}
                    selected={{ label: selectedCategoryLabel, value: selectedCategory }}
                    onSelect={onCategorySelect}
                />
                {(raceStatus === 'in_progress' || raceStatus === 'finished') && (
                    <Dropdown
                        label={selectedCheckpoint?.label ?? t("allrace:filter.checkpoint")}
                        options={checkpointOptions}
                        selected={
                            selectedCheckpoint ?? {
                                label: t("allrace:filter.all"),
                                value: "",
                            }
                        }
                        onSelect={onCheckpointSelect}
                    />
                )}
            </View>
            {(raceStatus === 'in_progress' || raceStatus === 'finished') && (
                <View style={resultListStyle.statisticsContainer}>
                    {selectedCheckpoint ? (
                        <>
                            <StatItem label={t("allrace:filter.stat_started")} value={statistics.started} />
                            <Divider />
                            <StatItem label={t("allrace:filter.stat_crossed")} value={statistics.crossed} />
                            <Divider />
                            <StatItem label={t("allrace:filter.stat_expected")} value={statistics.expected} />
                            <Divider />
                            <StatItem label={t("allrace:filter.stat_dnf")} value={statistics.dnf} highlight />
                        </>
                    ) : (
                        <>
                            <StatItem label={t("allrace:filter.stat_started")} value={statistics.started} />
                            <Divider />
                            <StatItem label={t("allrace:filter.isFinished")} value={statistics.crossed} />
                            <Divider />
                            <StatItem label={t("allrace:filter.stat_dnf")} value={statistics.dnf} highlight />
                        </>
                    )}
                </View>
            )}
            {initialLoad ? (
                <View style={resultListStyle.center}>
                    <ActivityIndicator size="large" color={palette.navy} />
                    <Text style={resultListStyle.loadingText}>
                        {t('common:loading.loading')}
                    </Text>
                </View>
            ) : hasError ? (
                <ErrorScreen
                    type={error!.type}
                    title={error!.title}
                    message={error!.message}
                    onRetry={() => { clearError(); retry(); }}
                />
            ) : isFavTab && displayResults.length === 0 ? (
                <View style={resultListStyle.center}>
                    <Text style={{ fontFamily: fonts.body,
        fontSize: 40 }}>☆</Text>
                    <Text style={resultListStyle.loadingText}>
                        {t('allrace:filter.noFavourites')}
                    </Text>
                </View>
            ) : displayResults.length === 0 ? (
                <View style={resultListStyle.center}>
                    <Text style={resultListStyle.errorText}>
                        {t('allrace:race.noResults')}
                    </Text>
                </View>
            ) : (
                <View style={{ flex: 1 }}>
                    <FlatList
                        data={displayResults}
                        keyExtractor={keyExtractor}
                        renderItem={renderItem}
                        contentContainerStyle={resultListStyle.list}
                        showsVerticalScrollIndicator={false}
                        onEndReached={onEndReached}
                        onEndReachedThreshold={0.3}
                        ListFooterComponent={ListFooter}
                        refreshControl={
                            <RefreshControl
                                refreshing={refreshing}
                                onRefresh={onRefresh}
                                tintColor={palette.navy}
                            />
                        }
                        initialNumToRender={12}
                        maxToRenderPerBatch={12}
                        windowSize={7}
                        removeClippedSubviews
                        updateCellsBatchingPeriod={50}
                    />
                    {filterLoad && (
                        <View style={resultListStyle.filterOverlay} pointerEvents="none">
                            <ActivityIndicator size="large" color={palette.lime} />
                        </View>
                    )}
                </View>
            )}

            {sectionType === 'follower' ? (
                <BottomNavigationFollower
                    activeTab="Results"
                    product_app_id={product_app_id}
                    event_name={event_name}
                    event_image={event_image}
                    product_option_value_app_id={product_option_value_app_id}
                    sourceTab={sourceTab}
                    selectedDistanceLabel={selectedDistanceLabel}
                    race_date={raceDate}
                />
            ) : (
                <BottomNavigation
                    activeTab="Results"
                    product_app_id={product_app_id}
                    event_name={event_name}
                    event_image={event_image}
                    product_option_value_app_id={product_option_value_app_id}
                    sourceScreen={sourceScreen}
                    selectedDistanceLabel={selectedDistanceLabel}
                    race_date={raceDate}

                />
            )}

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

export default ResultListScreen;