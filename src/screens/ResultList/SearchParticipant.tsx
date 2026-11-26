import React, { useRef, useCallback } from 'react';
import {
    View,
    Text,
    FlatList,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { commonStyles, spacing, space, palette } from '../../styles/common.styles';
import { resultListStyle } from '../../styles/ResultList.styles';
import SearchInput from '../../components/SearchInput';
import { participantService, Participant } from '../../services/participantService';
import { useParticipantSearch } from './useParticipantSearch';
import ParticipantCard from './ParticipantCard';
import { SearchParticipantpops } from '../../types/navigation';
import ErrorScreen from '../../components/ErrorScreen';
import { useScreenError } from '../../hooks/useApiError';
import { AppHeader } from '../../components/common/AppHeader';
import { useDimensions } from '../../hooks/useDimensions';
import { useLandscapeSidePadding, useSafeAreaEdges } from '../../hooks/useLandscapeSidePadding';
import { analyticsService } from '../../services/analyticsService';
import { ANALYTICS_PARAMS } from '../../constants/analyticsScreens';

const SearchParticipant: React.FC<SearchParticipantpops> = ({ route, navigation }) => {
    const { product_app_id, product_option_value_app_id, raceStatus, event_name } = route.params;
    const { t } = useTranslation(['details', 'follower', 'allrace']);
    const { width, height } = useDimensions();
    const insets = useSafeAreaInsets(); 
    const isGestureNav = insets.bottom > 0;
    // A real boolean: this was `= width` (always truthy), so the SafeAreaView
    // took left/right edges in PORTRAIT on 3-button Android too.
    const isLandscape = width > height;
    // Notch / Dynamic Island in landscape on gesture phones (0 elsewhere).
    const sidePadding = useLandscapeSidePadding();
    const safeEdges = useSafeAreaEdges();   // + Android 3-button landscape sides

    const productId = typeof product_app_id === 'string'
        ? parseInt(product_app_id, 10)
        : product_app_id;

    const searchInputRef = useRef<any>(null);

    const { error, hasError, handleApiError, clearError } = useScreenError();

    // ✅ The list's requests live in useParticipantSearch (app audit
    // 2026-11-26): newest search wins, pages of an older search are dropped,
    // no reset to the unfiltered list on returning from a runner, and one
    // next page at a time. See that file for the history.
    const {
        participants, loading, loadingMore, searchText, setSearchText, loadMore, retry,
    } = useParticipantSearch({
        productId,
        productOptionValueAppId: product_option_value_app_id,
        onError: handleApiError,
        clearError,
        // Fires ONCE per completed search (page 1, non-empty query). Sends
        // pagination.total (all matches), not participants.length, which is
        // capped at one page. Never the query text — free text is unbounded
        // and would blow GA4's cardinality limit.
        onSearched: (total) => {
            // In-race search; only the product id is in scope here.
            void analyticsService.logSearchPerformed(
                'participant',
                total,
                {
                    [ANALYTICS_PARAMS.EVENT_NAME]: event_name ?? '',
                    [ANALYTICS_PARAMS.RACE_ID]: product_app_id,
                },
            );
        },
    });

    const handleLoadMore = loadMore;

    const renderParticipant = useCallback(
        ({ item }: { item: Participant }) => (
            <ParticipantCard
                item={item}
                product_app_id={productId}
                product_option_value_app_id={product_option_value_app_id ?? 0}
                raceStatus={raceStatus}
            />
        ),
        [productId, product_option_value_app_id, raceStatus]
    );

    const renderFooter = useCallback(() =>
        loadingMore ? (
            <View style={{ paddingVertical: spacing.lg, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={palette.navy} />
            </View>
        ) : null
    , [loadingMore]);

    // Same designed empty state as everywhere else - see AllParticipant.tsx.
    const renderEmpty = useCallback(() => (
        <ErrorScreen
            type="empty"
            title={searchText
                ? `${t('details:participant.noResults')} "${searchText}"`
                : t('details:participant.empty')}
            onRetry={() => { }}
        />
    ), [searchText, t]);

    if (loading && searchText.length === 0) {
        return (
            <SafeAreaView style={commonStyles.container} edges={safeEdges}>
                {/* The header in the first load too: without it the screen had
                    no back button (or title) until the list arrived. */}
                <AppHeader title={t('common:band.searchParticipants')} showLogo={true} showBack />
                <View style={commonStyles.centerContainer}>
                    <ActivityIndicator size="large" color={palette.navy} />
                </View>
            </SafeAreaView>
        );
    }

    if (hasError && !loading) {
        return (
            <SafeAreaView style={commonStyles.container} edges={safeEdges}>
                <AppHeader title={t('common:band.searchParticipants')} showLogo={true} showBack />
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

            {/* Was a hand-rolled back chevron and title on white - the same old
                chrome AllParticipant.tsx carried, and the same mismatch with
                this screen's own error state, which already used AppHeader.
                `edges` must not include 'top': AppHeader carries that inset. */}
            <AppHeader title={t('common:band.searchParticipants')} showLogo={true} showBack />

            {/* Body below AppHeader, clear of the notch in landscape (0 in portrait). */}
            <View style={[{ flex: 1 }, sidePadding]}>
            <SearchInput
                ref={searchInputRef}
                placeholder={t('details:participant.search')}
                value={searchText}
                onChangeText={setSearchText}
                icon="search"
                // ✅ Landscape: the band reaches the screen edges (it was inset
                // by the notch padding, grey strips each side); the field
                // keeps clear of the notch. 0 in portrait.
                frameStyle={{
                    marginLeft: -sidePadding.paddingLeft,
                    marginRight: -sidePadding.paddingRight,
                    paddingLeft: space.xl + sidePadding.paddingLeft,
                    paddingRight: space.xl + sidePadding.paddingRight,
                }}
            />

            {searchText.trim().length > 0 && participants.length > 0 && (
                <Text style={resultListStyle.searchCount}>
                    {t('allrace:search.resultsFor', {
                        count: participants.length,
                        query: searchText.trim(),
                    })}
                </Text>
            )}

            {loading && searchText.length > 0 && (
                <View style={{ marginTop: spacing.lg, alignItems: 'center' }}>
                    <ActivityIndicator size="small" color={palette.navy} />
                    <Text style={{ marginTop: spacing.sm, color: palette.textMuted }}>
                        {t('details:participant.searching')}
                    </Text>
                </View>
            )}

            <FlatList
                data={participants}
                keyExtractor={(item, index) =>
                    `${participantService.getParticipantId(item)}-${index}`
                }
                renderItem={renderParticipant}
                showsVerticalScrollIndicator={false}
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.5}
                contentContainerStyle={{
                    // The card carries its own 20pt gutter; this only holds the
                    // first card clear of the search band above it.
                    paddingTop: spacing.sm,
                    paddingBottom: spacing.xxxl,
                    flexGrow: 1,
                }}
                keyboardShouldPersistTaps="handled"
                removeClippedSubviews={false}
                ListFooterComponent={renderFooter}
                ListEmptyComponent={!loading ? renderEmpty : null}
            />
            </View>
        </SafeAreaView>
    );
};

export default SearchParticipant;