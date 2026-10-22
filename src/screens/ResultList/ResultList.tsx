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
import { landscapeSideInsets } from '../../utils/landscapeInsets';
import { filtersOnePerRow } from '../../utils/screenFit';
import {  ANALYTICS_SCREENS } from '../../constants/analyticsScreens';

const StatItem = ({ label, value, highlight }: { label: string; value: number | string; highlight?: boolean }) => (
    <View style={resultListStyle.statItem}>
        {/* one word, one line: at 320pt nl "Gepasseerd" needs ~76pt of a ~66pt box —
            shrinks there (≥ 0.8) instead of breaking mid-word; full size from 360pt */}
        <Text style={resultListStyle.statLabel} maxFontSizeMultiplier={1} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{label}</Text>
        <Text style={[resultListStyle.statValue, highlight && resultListStyle.statValueHighlight]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
            {value}
        </Text>
    </View>
);

const Divider = () => <View style={resultListStyle.divider} />;

const ResultListScreen: React.FC<ResultListprops> = ({ route }) => {
    const { t } = useTranslation(['allrace', 'common']);
    const { width, height, fontScale, isLandscape: isLandscapeView } = useDimensions();
    const filtersStacked = filtersOnePerRow(width, fontScale);
    const stackedTab = filtersStacked ? resultListStyle.filterTabStacked : undefined;
    const insets = useSafeAreaInsets();
    // Side padding for the content under the header in landscape on a notch /
    // Dynamic Island phone (0 in portrait) — see utils/landscapeInsets.
    const side = landscapeSideInsets(insets, width, height);
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
        raceId: product_app_id,
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
            analyticsRaceName: event_name ?? '',
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
        selectedCheckpoint, resultListScreenName,
        // renderItem closes over event_name via commonProps.analyticsRaceName;
        // without it the cards keep a stale race name after an event switch.
        event_name,
    ]);

    const ListFooter = useCallback(() =>
        pageLoad
            ? <ActivityIndicator size="small" color={palette.navy} style={{ paddingVertical: 16 }} />
            : null
        , [pageLoad]);

    // Only once there is a list to scroll: loading / error / empty states keep
    // the filters fixed above them, so a filter can still be changed.
    const filtersInList = isLandscapeView && !initialLoad && !hasError && displayResults.length > 0;

    const keyExtractor = useCallback(
        (item: RaceResult, index: number) => `${item.bib}_${item.position}_${index}`,
        []
    );

    // Landscape: the header, three filter rows, the statistics strip and the
    // bottom bar left the list almost no height, so the results could not be
    // scrolled (client 2026-10-22). There the filters and statistics ride at
    // the top of the list and scroll away with it; portrait is unchanged.
    const filterHeader = (
        <>
            {/* Two filters per row (2026-10-22). Three in one row left each label
                ~45pt on a 360-375pt phone: "Results", "Checkpoint", "Point de
                contrôle", "Suivi en direct" all ended in "…". Distance takes the
                larger share of row 1 (names are long, the type is one word). */}
            <View style={[resultListStyle.filterRow1, filtersStacked && resultListStyle.filterRowStacked]}>
                <Dropdown
                    label={selectedDistanceLabel}
                    options={distanceOptions}
                    selected={{ label: selectedDistanceLabel, value: String(selectedPovId) }}
                    onSelect={onDistanceSelect}
                    style={[resultListStyle.filterTabWide, stackedTab]}
                />
                <Dropdown
                    label={t(selectedType.label)}
                    options={TYPE_OPTIONS}
                    selected={selectedType}
                    onSelect={onTypeSelect}
                    style={stackedTab}
                />
            </View>

            <View style={[resultListStyle.filterRow2, filtersStacked && resultListStyle.filterRowStacked]}>
                <Dropdown
                    label={selectedCategoryLabel}
                    options={categoryOptions}
                    selected={{ label: selectedCategoryLabel, value: selectedCategory }}
                    onSelect={onCategorySelect}
                    style={stackedTab}
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
                        style={stackedTab}
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
        </>
    );

    return (
        <SafeAreaView style={commonStyles.container} edges={isLandscape && !isGestureNav ? ['left', 'right'] : ['bottom']}>

            <AppHeader title={event_name}
                showLogo={true}
                showSearch={true}
                product_app_id={product_app_id}
                event_name={event_name}
                product_option_value_app_id={currentPovId}
                raceStatus={raceStatus as 'finished' | 'in_progress' | 'not_started'}
                showBack
            />

            <View style={{ flex: 1, paddingLeft: side.left, paddingRight: side.right }}>
            {!filtersInList && filterHeader}
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
                        ListHeaderComponent={filtersInList ? filterHeader : null}
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
            </View>

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