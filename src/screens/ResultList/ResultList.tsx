import React, { useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    FlatList,
    StatusBar,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { AppHeader } from '../../components/common/AppHeader';
import { BottomNavigation } from '../../components/common/BottomNavigation';
import { colors, commonStyles } from '../../styles/common.styles';
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


const ResultListScreen: React.FC<ResultListprops> = ({ route }) => {
    const { t } = useTranslation(['allrace', 'common']);
    const { product_app_id, product_option_value_app_id, event_name, sourceScreen, sectionType, sourceTab } = route.params;

    // ✅ GET FOLLOW DATA
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

    } = useFollowManager(t, product_app_id);

    const initialType = sourceTab === 'live'
        ? TYPE_OPTIONS[1]
        : TYPE_OPTIONS[0];

    useFocusEffect(
        useCallback(() => {
            refreshFollowedUsers();
        }, [refreshFollowedUsers])
    );

    // ✅ PASS FOLLOW DATA TO HOOK
    const {
        displayResults, pagination,
        selectedPovId, selectedType, selectedCategory,
        fromLive, isFavTab, favBibs,
        initialLoad, filterLoad, pageLoad, refreshing, error,
        toggleFav, onDistanceSelect, onTypeSelect,
        onCategorySelect, onEndReached, onRefresh, retry,
        distanceOptions, categoryOptions,
        selectedDistanceLabel, selectedCategoryLabel,
        raceStatus, currentPovId,
        showUtmbIndex, hasError, clearError,
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
            onToggleFollow: () => handleFollowPress({
                customer_app_id: item.customer_app_id,
                password_protected: item.password_protected ?? 0,  // ✅
                bib_number: item.bib,
            }),
        };

        if (raceStatus === 'not_started') {
            return (
                <ResultCardBeforeRace
                    {...commonProps}
                    showUtmbIndex={showUtmbIndex}
                    raceStatus={raceStatus}
                    currentPovId={currentPovId}
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
                />
            );
        }

        return (
            <ResultCard
                {...commonProps}
                fromLive={fromLive}
                raceStatus={raceStatus}
                currentPovId={currentPovId}
            />
        );
    }, [
        isFollowed,
        isLoading,
        handleFollowPress,
        raceStatus,
        sourceTab,
        fromLive,
        product_app_id,
        currentPovId,
        showUtmbIndex,
    ]);

    const ListFooter = useCallback(() =>
        pageLoad
            ? <ActivityIndicator size="small" color={colors.primary} style={{ paddingVertical: 16 }} />
            : null
        , [pageLoad]);

    const keyExtractor = useCallback(
        (item: RaceResult, index: number) => `${item.bib}_${item.position}_${index}`,
        []
    );

    return (
        <SafeAreaView style={commonStyles.container} edges={['top', 'bottom']}>
            <StatusBar barStyle="dark-content" />
            <AppHeader showLogo={false} />

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
            </View>

            {initialLoad ? (
                <View style={resultListStyle.center}>
                    <ActivityIndicator size="large" color={colors.success} />
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
                    <Text style={{ fontSize: 48 }}>☆</Text>
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
                                tintColor={colors.primary}
                            />
                        }
                        initialNumToRender={12}
                        maxToRenderPerBatch={12}
                        windowSize={7}
                        removeClippedSubviews
                        updateCellsBatchingPeriod={50}
                    />
                    {filterLoad && (
                        <View
                            style={resultListStyle.filterOverlay}
                            pointerEvents="none"
                        >
                            <ActivityIndicator size="large" color={colors.success} />
                        </View>
                    )}
                </View>
            )}

            {sectionType === 'follower' ? (
                <BottomNavigationFollower
                    activeTab="Results"
                    product_app_id={product_app_id}
                    event_name={event_name}
                    product_option_value_app_id={product_option_value_app_id}
                    sourceTab={sourceTab}
                />
            ) : (
                <BottomNavigation
                    activeTab="Results"
                    product_app_id={product_app_id}
                    event_name={event_name}
                    product_option_value_app_id={product_option_value_app_id}
                    sourceScreen={sourceScreen}
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