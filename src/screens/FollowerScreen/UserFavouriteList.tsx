import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    StatusBar,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { commonStyles, colors, spacing } from '../../styles/common.styles';
import { follow } from '../../styles/followerScreen.styles';
import { AppHeader } from '../../components/common/AppHeader';
import SearchInput from '../../components/SearchInput';
import FanEventCard from '../FollowerEventList/FollowerCard';
import { TrackingPasswordModal } from '../../components/TrackingPasswordModal';
import { userfavouriteService, FavouriteItem } from '../../services/userfavouriteService';
import { UserFavouriteListpops } from '../../types/navigation';
import { useFollowManager } from '../../hooks/useFollowManager';
import ErrorScreen from '../../components/ErrorScreen';

interface PaginationState {
    page: number;
    total_pages: number;
}

const INITIAL_PAGINATION: PaginationState = { page: 1, total_pages: 1 };

const UserFavouriteList: React.FC<UserFavouriteListpops> = () => {
    const { t } = useTranslation(['follow', 'follower']);

    const [searchText, setSearchText]           = useState('');
    const [favourites, setFavourites]           = useState<FavouriteItem[]>([]);
    const [searchResults, setSearchResults]     = useState<FavouriteItem[]>([]);
    const [initialLoading, setInitialLoading]   = useState(true);
    const [searching, setSearching]             = useState(false);
    const [loadingMore, setLoadingMore]         = useState(false);
    const [loadingMoreFav, setLoadingMoreFav]   = useState(false);
    const [favPagination, setFavPagination]     = useState<PaginationState>(INITIAL_PAGINATION);
    const [searchPagination, setSearchPagination] = useState<PaginationState>(INITIAL_PAGINATION);

    const isLoadingMoreSearch = useRef(false);

    // ✅ Stable ref to break circular dependency between useFollowManager and loadInitial
    const onFollowSuccessRef = useRef<(() => void) | null>(null);

    const {
        isFollowed,
        isLoading,
        handleFollowPress,
        passwordModalVisible,
        isVerifying,
        passwordError,
        handlePasswordSubmit,
        handlePasswordModalClose,
    } = useFollowManager(
        t,
        undefined,                                   // ✅ productAppId — not needed in this screen
        () => onFollowSuccessRef.current?.(),        // ✅ onFollowSuccess callback via ref
    );

    // ✅ useCallback so the ref always holds a stable, up-to-date reference
    const loadInitial = useCallback(async () => {
        try {
            setInitialLoading(true);
            const result = await userfavouriteService.getFavourites({ page: 1 });
            setFavourites(result.favourites);
            setFavPagination({ page: 1, total_pages: result.pagination.total_pages });
        } catch (err) {
            console.error('❌ Favourites initial load failed:', err);
        } finally {
            setInitialLoading(false);
        }
    }, []);

    // ✅ Keep ref in sync with latest loadInitial
    onFollowSuccessRef.current = loadInitial;

    useEffect(() => {
        loadInitial();
    }, [loadInitial]);

    // Search with debounce
    useEffect(() => {
        if (!searchText.trim()) {
            setSearchResults([]);
            setSearchPagination(INITIAL_PAGINATION);
            return;
        }
        const timer = setTimeout(async () => {
            try {
                setSearching(true);
                const result = await userfavouriteService.getFavourites({
                    search: searchText.trim(),
                    page: 1,
                });
                setSearchResults(result.favourites);
                setSearchPagination({ page: 1, total_pages: result.pagination.total_pages });
            } catch (err) {
                console.error('❌ Favourites search failed:', err);
            } finally {
                setSearching(false);
            }
        }, 350);
        return () => clearTimeout(timer);
    }, [searchText]);

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
            const nextPage = currentPage + 1;
            const result = await userfavouriteService.getFavourites({
                search: searchText,
                page: nextPage,
            });
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
    }, [searchText]);

    const loadMoreFavourites = useCallback(async () => {
        if (loadingMoreFav || favPagination.page >= favPagination.total_pages) return;
        try {
            setLoadingMoreFav(true);
            const nextPage = favPagination.page + 1;
            const result = await userfavouriteService.getFavourites({ page: nextPage });
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
    }, [loadingMoreFav, favPagination]);

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
                item={item}
                isFollowed={isFollowed(item.customer_app_id)}
                isLoading={isLoading(item.customer_app_id)}
                onToggleFollow={() =>
                    handleFollowPress({
                        customer_app_id: item.customer_app_id,
                        password_protected: item.password_protected ?? 0,
                    })
                }
            />
        ),
        [isFollowed, isLoading, handleFollowPress],
    );

   const renderEmpty = useCallback(() => {
    if (initialLoading || searching) {
        return (
            <ActivityIndicator
                size="small"
                color={colors.primary}
                style={{ marginTop: spacing.lg }}
            />
        );
    }
    if (searchText.trim().length > 0) {
        return (
            <Text style={[commonStyles.errorText, { textAlign: 'center', marginTop: 40 }]}>
                {t('follow:empty.favouriteSearchEmpty')}
            </Text>
        );
    }
    // ✅ No following at all
    return (
        <ErrorScreen
            type="empty"
            title={t('follow:empty.no_following_title')}
            message={t('follow:empty.no_following_msg')}
            onRetry={() => {}}
        />
    );
}, [initialLoading, searching, searchText, t]);

    const displayList = searchText.trim().length > 0 ? searchResults : favourites;

    const listFooter = (loadingMore || loadingMoreFav)
        ? <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: spacing.md }} />
        : null;

    return (
        <SafeAreaView style={commonStyles.container} edges={['top']}>
            <StatusBar barStyle="dark-content" />
            <AppHeader />

            <View style={follow.yellowHeader}>
                <Text style={commonStyles.title}>{t('follow:favourite')}</Text>
            </View>

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
                    paddingHorizontal: spacing.md,
                    paddingBottom: spacing.xxxxl,
                }}
                ListHeaderComponent={
                    <SearchInput
                        placeholder={t('follow:search.athletesearch')}
                        value={searchText}
                        onChangeText={setSearchText}
                        icon="search"
                    />
                }
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