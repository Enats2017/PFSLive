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
import { userFollowersService, FollowerItem } from '../../services/followerListService';
import { useFollowManager } from '../../hooks/useFollowManager';
import { TrackingPasswordModal } from '../../components/TrackingPasswordModal';
import FanEventCard from '../FollowerEventList/FollowerCard';
import FollowerListCard from './FollowerListCard';

interface PaginationState {
    page: number;
    total_pages: number;
}

const INITIAL_PAGINATION: PaginationState = { page: 1, total_pages: 1 };

const FollowersList: React.FC = () => {
    const { t } = useTranslation(['follow', 'follower']);

    const [searchText, setSearchText]             = useState('');
    const [followers, setFollowers]               = useState<FollowerItem[]>([]);
    const [searchResults, setSearchResults]       = useState<FollowerItem[]>([]);
    const [initialLoading, setInitialLoading]     = useState(true);
    const [searching, setSearching]               = useState(false);
    const [loadingMore, setLoadingMore]           = useState(false);
    const [loadingMoreFav, setLoadingMoreFav]     = useState(false);
    const [favPagination, setFavPagination]       = useState<PaginationState>(INITIAL_PAGINATION);
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
        undefined,                                   // ✅ productAppId — not needed here
        () => onFollowSuccessRef.current?.(),        // ✅ onFollowSuccess callback via ref
    );

    // ✅ useCallback so the ref always holds a stable, up-to-date reference
    const loadInitial = useCallback(async () => {
        console.log("1111111111111111111111");
        
        try {
            setInitialLoading(true);
            const result = await userFollowersService.getFollowers({ page: 1 });
            setFollowers(result.followers);
            setFavPagination({ page: 1, total_pages: result.pagination.total_pages });
        } catch (err) {
            console.error('❌ Followers initial load failed:', err);
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
                const result = await userFollowersService.getFollowers({
                    search: searchText.trim(),
                    page: 1,
                });
                setSearchResults(result.followers);
                setSearchPagination({ page: 1, total_pages: result.pagination.total_pages });
            } catch (err) {
                console.error('❌ Followers search failed:', err);
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
        let totalPages  = 0;
        setSearchPagination(prev => {
            currentPage = prev.page;
            totalPages  = prev.total_pages;
            return prev;
        });
        if (currentPage >= totalPages) return;

        try {
            isLoadingMoreSearch.current = true;
            setLoadingMore(true);
            const nextPage = currentPage + 1;
            const result = await userFollowersService.getFollowers({
                search: searchText,
                page: nextPage,
            });
            setSearchResults(prev => {
                const ids = new Set(prev.map(e => e.customer_app_id));
                return [...prev, ...result.followers.filter(i => !ids.has(i.customer_app_id))];
            });
            setSearchPagination({ page: nextPage, total_pages: result.pagination.total_pages });
        } catch (err) {
            console.error('❌ Followers search load more failed:', err);
        } finally {
            isLoadingMoreSearch.current = false;
            setLoadingMore(false);
        }
    }, [searchText]);

    const loadMoreFollowers = useCallback(async () => {
        if (loadingMoreFav || favPagination.page >= favPagination.total_pages) return;
        try {
            setLoadingMoreFav(true);
            const nextPage = favPagination.page + 1;
            const result = await userFollowersService.getFollowers({ page: nextPage });
            setFollowers(prev => {
                const ids = new Set(prev.map(e => e.customer_app_id));
                return [...prev, ...result.followers.filter(i => !ids.has(i.customer_app_id))];
            });
            setFavPagination({ page: nextPage, total_pages: result.pagination.total_pages });
        } catch (err) {
            console.error('❌ Followers load more failed:', err);
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
            loadMoreFollowers();
        }
    }, [searchText, searchPagination, favPagination, loadingMoreFav, loadMoreSearchResults, loadMoreFollowers]);

    const renderCard = useCallback(
        ({ item }: { item: FollowerItem }) => (
            <FollowerListCard
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
                    {t('follow:empty.followerSearchEmpty')}
                </Text>
            );
        }
        return null;
    }, [initialLoading, searching, searchText, t]);

    const displayList = searchText.trim().length > 0 ? searchResults : followers;

    const listFooter = (loadingMore || loadingMoreFav)
        ? <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: spacing.md }} />
        : null;

    return (
        <SafeAreaView style={commonStyles.container} edges={['top']}>
            <StatusBar barStyle="dark-content" />
            <AppHeader />
            <View style={follow.yellowHeader}>
                <Text style={commonStyles.title}>{t('follow:followers')}</Text>
            </View>

            <FlatList
                data={displayList}
                keyExtractor={(item, index) => `follower_${item.customer_app_id}_${index}`}
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

export default FollowersList;