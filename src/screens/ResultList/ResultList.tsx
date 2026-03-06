
import React, { useState, useEffect, useCallback, useRef } from 'react';
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

const ResultListScreen: React.FC<ResultListprops> = ({ route }) => {
    const { t } = useTranslation(['allrace', 'common']);
    const { product_app_id, product_option_value_app_id } = route.params;

    const {
        displayResults, pagination,
        selectedPovId, selectedType, selectedCategory,
        fromLive, isFavTab, favBibs,
        initialLoad, filterLoad, pageLoad, refreshing, error,
        toggleFav, onDistanceSelect, onTypeSelect,
        onCategorySelect, onEndReached, onRefresh, retry,
        distanceOptions, categoryOptions,
        selectedDistanceLabel, selectedCategoryLabel,
    } = useResultList(product_app_id, product_option_value_app_id);

    const renderItem = useCallback(({ item }: { item: RaceResult }) => (
        <ResultCard
            item={item}
            isFav={favBibs.has(item.bib)}
            fromLive={fromLive}
            onToggleFav={toggleFav}
        />
    ), [favBibs, fromLive, toggleFav]);

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

            ) : error ? (
                <View style={resultListStyle.center}>
                    <Text style={resultListStyle.errorText}>{error}</Text>
                    <TouchableOpacity style={resultListStyle.retryBtn} onPress={retry}>
                        <Text style={resultListStyle.retryText}>
                            {t('common:buttons.retry')}
                        </Text>
                    </TouchableOpacity>
                </View>

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
            <BottomNavigation />
        </SafeAreaView>
    );
};

export default ResultListScreen;
