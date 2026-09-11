import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Text,
    View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { commonStyles, spacing, palette } from '../../styles/common.styles';
import { follow } from '../../styles/followerScreen.styles';
import { AppHeader } from '../../components/common/AppHeader';
import SearchInput from '../../components/SearchInput';
import FanEventCard from '../FollowerEventList/FollowerCard';
import { TrackingPasswordModal } from '../../components/TrackingPasswordModal';
import { userfavouriteService, FavouriteItem } from '../../services/userfavouriteService';
import { UserFavouriteListpops } from '../../types/navigation';
import { useFollowManager } from '../../hooks/useFollowManager';
import ErrorScreen from '../../components/ErrorScreen';
import { useScreenError } from '../../hooks/useApiError';
import { useSessionExpired } from '../../hooks/useSessionExpired';
import { useDimensions } from '../../hooks/useDimensions';
import { analyticsService } from '../../services/analyticsService';
import { ANALYTICS_SCREENS } from '../../constants/analyticsScreens';
import { useFocusEffect,useRoute } from '@react-navigation/native';

interface PaginationState {
    page: number;
    total_pages: number;
}

const INITIAL_PAGINATION: PaginationState = { page: 1, total_pages: 1 };

const UserFavouriteList: React.FC<UserFavouriteListpops> = ({ navigation }) => {
    const { t } = useTranslation(['follow', 'follower', 'errorScreen']);
    const route = useRoute<any>();
     const targetCustomerAppId = route.params?.customer_app_id;
    const { width } = useDimensions();
    const insets = useSafeAreaInsets(); 
    const isGestureNav = insets.bottom > 0;
    const isLandscape = width 

    const [searchText, setSearchText]           = useState('');
    const [favourites, setFavourites]           = useState<FavouriteItem[]>([]);
    const [searchResults, setSearchResults]     = useState<FavouriteItem[]>([]);
    const [initialLoading, setInitialLoading]   = useState(true);
    const [searching, setSearching]             = useState(false);
    const [loadingMore, setLoadingMore]         = useState(false);
    const [loadingMoreFav, setLoadingMoreFav]   = useState(false);
    const [favPagination, setFavPagination]     = useState<PaginationState>(INITIAL_PAGINATION);
    const [searchPagination, setSearchPagination] = useState<PaginationState>(INITIAL_PAGINATION);
    const [isOwnList, setIsOwnList] = useState(false);

    const isLoadingMoreSearch = useRef(false);

    // ✅ Every load takes a ticket; only the newest one may commit its result.
    //    Without this a "load more" that resolves after the next keystroke
    //    splices the OLD query's page 2 onto the NEW query's page 1, and leaves
    //    the pagination state describing a query nobody is looking at.
    const requestIdRef = useRef(0);

    // ✅ Rows unfollowed in this visit, hidden immediately.
    //    The alternative — waiting for the refetch — leaves the row on screen
    //    for the whole round-trip, and leaves it there FOREVER if the refetch
    //    fails. Deliberately not cleared when `favourites` changes, so it survives
    //    the refetch that would otherwise hand the athlete straight back; it is
    //    cleared on focus instead, so a fresh visit always shows server truth.
    const [removedIds, setRemovedIds] = useState<Set<number>>(new Set());

    // ✅ An unfollow has already been reflected locally by removedIds, so the
    //    page-1 refetch it would otherwise trigger is pure loss: it discards
    //    pages 2..N and the scroll position to tell us something we know.
    const skipNextRefetchRef = useRef(false);

    const { error, isAuthError, handleApiError, clearError } = useScreenError();
    const handleSessionExpired = useSessionExpired();

    // ✅ Stable ref to break circular dependency between useFollowManager and loadInitial
    const onFollowSuccessRef = useRef<(() => void) | null>(null);

    const {
        isFollowed,
        isLoading,
        handleFollowPress,
        refreshFollowedUsers,
        passwordModalVisible,
        isVerifying,
        passwordError,
        handlePasswordSubmit,
        handlePasswordModalClose,
    } = useFollowManager(
        t,
        undefined,                                   // ✅ productAppId — not needed in this screen
        () => onFollowSuccessRef.current?.(),        // ✅ onFollowSuccess callback via ref
        // Cross-event screen: follows here are athlete-scoped, so no raceName.
        { screenName: ANALYTICS_SCREENS.USER_FAVOURITES },
    );

    // ✅ useCallback so the ref always holds a stable, up-to-date reference
    const loadInitial = useCallback(async () => {
        const requestId = ++requestIdRef.current;
        try {
            setInitialLoading(true);
            clearError();
            const result = await userfavouriteService.getFavourites({ page: 1, customer_app_id: targetCustomerAppId });
            if (requestId !== requestIdRef.current) return;
            setFavourites(result.favourites);
            setIsOwnList(result.is_own === 1);
            setFavPagination({ page: 1, total_pages: result.pagination.total_pages });
        } catch (err) {
            if (requestId !== requestIdRef.current) return;
            console.error('❌ Favourites initial load failed:', err);
            handleApiError(err);
        } finally {
            if (requestId === requestIdRef.current) setInitialLoading(false);
        }
    // handleApiError / clearError are intentionally NOT deps: this callback
    // feeds useFocusEffect, and FavouriteList.tsx keeps them out for the same
    // reason — a changing identity would re-subscribe the focus effect.
    }, [targetCustomerAppId]);

    const retry = useCallback(() => {
        clearError();
        loadInitial();
    }, [clearError, loadInitial]);

    // ✅ Keep ref in sync with latest loadInitial
    onFollowSuccessRef.current = () => {
        if (skipNextRefetchRef.current) {
            skipNextRefetchRef.current = false;
            return;
        }
        loadInitial();
    };

    useFocusEffect(
        useCallback(() => {
            // Two separate things go stale here, and loadInitial only fixed one.
            // loadInitial refetches the LIST from the server; the follow/unfollow
            // BUTTON reads useFollowManager's own followedUsers state, which is
            // populated once when the hook mounts. Following someone on another
            // screen (AthleteSearchScreen) therefore showed the new athlete in
            // the list with a "Follow" button, until the screen happened to
            // remount. refreshFollowedUsers() re-reads local storage — same
            // pairing ParticipantTab, AllParticipant, FavouriteList, ResultList
            // and AthleteSearchScreen already use.
            // A new visit starts from server truth: anything hidden by the
            // optimistic set last time has had its sync round-trip by now.
            setRemovedIds(new Set());
            refreshFollowedUsers();
            loadInitial();
        }, [loadInitial, refreshFollowedUsers])
    );

    // Search with debounce
    useEffect(() => {
        if (!searchText.trim()) {
            setSearchResults([]);
            setSearchPagination(INITIAL_PAGINATION);
            return;
        }
        const timer = setTimeout(async () => {
            const requestId = ++requestIdRef.current;
            try {
                setSearching(true);
                clearError();
                const result = await userfavouriteService.getFavourites({
                    search: searchText.trim(),
                    page: 1,
                    customer_app_id: targetCustomerAppId, 
                });
                if (requestId !== requestIdRef.current) return;
                setSearchResults(result.favourites);
                setSearchPagination({ page: 1, total_pages: result.pagination.total_pages });

                // One event per completed search — inside the debounce, after
                // results resolve. Not per keystroke, not on pagination.
                // Count only, never the query text (unbounded cardinality).
                void analyticsService.logSearchPerformed('favourite', result.favourites.length);
            } catch (err) {
                if (requestId !== requestIdRef.current) return;
                console.error('❌ Favourites search failed:', err);
                handleApiError(err);
            } finally {
                if (requestId === requestIdRef.current) setSearching(false);
            }
        }, 350);
        return () => clearTimeout(timer);
    }, [searchText, targetCustomerAppId]);

    const loadMoreSearchResults = useCallback(async () => {
        if (isLoadingMoreSearch.current) return;

        // ✅ Read pagination state safely without adding it to deps
        let currentPage = 0;
        let totalPages = 0;
        setSearchPagination(prev => {
            currentPage = prev.page;
            totalPages = prev.total_pages;
            return prev;
        });
        if (currentPage >= totalPages) return;

        try {
            isLoadingMoreSearch.current = true;
            setLoadingMore(true);
            const requestId = ++requestIdRef.current;
            const nextPage = currentPage + 1;
            const result = await userfavouriteService.getFavourites({
                search: searchText,
                page: nextPage,
                customer_app_id: targetCustomerAppId,
            });
            if (requestId !== requestIdRef.current) return;
            setSearchResults(prev => {
                const ids = new Set(prev.map(e => e.customer_app_id));
                return [...prev, ...result.favourites.filter(i => !ids.has(i.customer_app_id))];
            });
            setSearchPagination({ page: nextPage, total_pages: result.pagination.total_pages });
        } catch (err) {
            console.error('❌ Favourites search load more failed:', err);
        } finally {
            isLoadingMoreSearch.current = false;
            setLoadingMore(false);
        }
    }, [searchText, targetCustomerAppId]);

    const loadMoreFavourites = useCallback(async () => {
        if (loadingMoreFav || favPagination.page >= favPagination.total_pages) return;
        try {
            setLoadingMoreFav(true);
            const requestId = ++requestIdRef.current;
            const nextPage = favPagination.page + 1;
            const result = await userfavouriteService.getFavourites({ page: nextPage, customer_app_id: targetCustomerAppId });
            if (requestId !== requestIdRef.current) return;
            setFavourites(prev => {
                const ids = new Set(prev.map(e => e.customer_app_id));
                return [...prev, ...result.favourites.filter(i => !ids.has(i.customer_app_id))];
            });
            setFavPagination({ page: nextPage, total_pages: result.pagination.total_pages });
        } catch (err) {
            console.error('❌ Favourites load more failed:', err);
        } finally {
            setLoadingMoreFav(false);
        }
    }, [loadingMoreFav, favPagination,targetCustomerAppId]);

    const handleLoadMore = useCallback(() => {
        if (searchText.trim().length > 0) {
            if (!isLoadingMoreSearch.current && searchPagination.page < searchPagination.total_pages) {
                loadMoreSearchResults();
            }
            return;
        }
        if (favPagination.page < favPagination.total_pages && !loadingMoreFav) {
            loadMoreFavourites();
        }
    }, [searchText, searchPagination, favPagination, loadingMoreFav, loadMoreSearchResults, loadMoreFavourites]);

    const renderCard = useCallback(
        ({ item }: { item: FavouriteItem }) => (
            <FanEventCard
                variant="favourite"
                analyticsScreenName={ANALYTICS_SCREENS.USER_FAVOURITES}
                item={item}
                isFollowed={isFollowed(item.customer_app_id)}
                isLoading={isLoading(item.customer_app_id)}
                showRemoveButton={isOwnList}
                onToggleFollow={() => {
                    // This list IS the follow list, so a toggle on a followed
                    // athlete is a removal — hide the row now, and tell the
                    // success callback not to refetch over it.
                    const removing = isFollowed(item.customer_app_id);
                    if (removing) {
                        setRemovedIds(prev => new Set(prev).add(item.customer_app_id));
                    }
                    // Assigned on BOTH directions, not only on removal: a
                    // failed toggle never reaches onFollowSuccess, so a flag
                    // that is only ever set would be left armed and would
                    // swallow the refetch belonging to the next action.
                    skipNextRefetchRef.current = removing;
                    handleFollowPress({
                        customer_app_id: item.customer_app_id,
                        password_protected: item.password_protected ?? 0,
                    });
                }}
            />
        ),
        // isOwnList drives showRemoveButton and is set by loadInitial, i.e. AFTER
        // the first render. Left out of the deps the card kept the closure that
        // captured false, and the Remove button never appeared at all.
        [isFollowed, isLoading, handleFollowPress, isOwnList],
    );

   const renderEmpty = useCallback(() => {
    if (initialLoading || searching) {
        return (
            <ActivityIndicator
                size="small"
                color={palette.navy}
                style={{ marginTop: spacing.lg }}
            />
        );
    }
    // ✅ Before either empty branch: a failed request also leaves the list
    //    empty, and answering a network or session failure with "Not Following
    //    Anyone" is a lie the user cannot act on.
    if (error) {
        return (
            <ErrorScreen
                type={error.type}
                title={error.title}
                message={error.message}
                buttonLabel={isAuthError ? t('errorScreen:codes.session_expired.button') : undefined}
                onRetry={isAuthError ? () => { void handleSessionExpired(); } : retry}
            />
        );
    }
    if (searchText.trim().length > 0) {
        return (
            <ErrorScreen
                type="empty"
                title={t('follow:empty.favouriteSearchEmpty')}
                onRetry={() => { }}
            />
        );
    }
    // ✅ No following at all
    return (
        <ErrorScreen
            type="empty"
            title={t('follow:empty.no_following_title')}
            message={t('follow:empty.no_following_msg')}
            onRetry={() => {}}
            emptyAction={{
                label: t('follow:athlete'),
                icon: 'search',
                onPress: () => navigation.navigate('AthleteSearchScreen', {}),
            }}
        />
    );
}, [initialLoading, searching, searchText, t, navigation, error, isAuthError, handleSessionExpired, retry]);

    const rawList = searchText.trim().length > 0 ? searchResults : favourites;
    const displayList = removedIds.size > 0
        ? rawList.filter(item => !removedIds.has(item.customer_app_id))
        : rawList;

    const listFooter = (loadingMore || loadingMoreFav)
        ? <ActivityIndicator size="small" color={palette.navy} style={{ marginVertical: spacing.md }} />
        : null;

    return (
        <SafeAreaView style={commonStyles.container} edges={isLandscape && !isGestureNav ? ['left','right'] : ['bottom']}>
            <AppHeader title={t('common:band.favouriteAthletes')} showBack />

            <SearchInput
                placeholder={t('follow:search.athletesearch')}
                value={searchText}
                onChangeText={setSearchText}
                icon="search"
            />

            <FlatList
                data={displayList}
                keyExtractor={(item, index) => `fav_${item.customer_app_id}_${index}`}
                renderItem={renderCard}
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.5}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                removeClippedSubviews={false}
                contentContainerStyle={{
                    flexGrow: 1,
                    paddingHorizontal: spacing.xl,
                    // The search band above is full-bleed white; the list needs
                    // its own top inset so the first card is not welded to it.
                    paddingTop: spacing.lg,
                    paddingBottom: spacing.xxxxl,
                }}
                ListEmptyComponent={renderEmpty}
                ListFooterComponent={listFooter}
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

export default UserFavouriteList;