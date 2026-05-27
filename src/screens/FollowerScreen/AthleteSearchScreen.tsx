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
import { Feather } from '@expo/vector-icons';

import { commonStyles, colors, spacing } from '../../styles/common.styles';
import { follow } from '../../styles/followerScreen.styles';
import { AppHeader } from '../../components/common/AppHeader';
import SearchInput from '../../components/SearchInput';
import FanEventCard from '../FollowerEventList/FollowerCard';
import { TrackingPasswordModal } from '../../components/TrackingPasswordModal';
import { eventService, ParticipantItem } from '../../services/followerEvent';
import { AthleteSearchScreenpops } from '../../types/navigation';
import { useFollowManager } from '../../hooks/useFollowManager';

interface PaginationState {
    page: number;
    total_pages: number;
}

const AthleteSearchScreen: React.FC<AthleteSearchScreenpops> = () => {
    const { t } = useTranslation(['follow', 'follower']);
    const [searchText, setSearchText] = useState('');
    const [participants, setParticipants] = useState<ParticipantItem[]>([]);
    const [searchResults, setSearchResults] = useState<ParticipantItem[]>([]);
    const [searching, setSearching] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [loadingMoreParticipant, setLoadingMoreParticipant] = useState(false);
    const [participantPagination, setParticipantPagination] = useState<PaginationState>({ page: 1, total_pages: 1 });
    const [searchPagination, setSearchPagination] = useState<PaginationState>({ page: 1, total_pages: 1 });

    const isLoadingMoreSearch = useRef(false);
    const {
        isFollowed,
        isLoading,
        handleFollowPress,
        passwordModalVisible,
        isVerifying,
        passwordError,
        handlePasswordSubmit,
        handlePasswordModalClose,
    } = useFollowManager(t);

    const displayEvents = searchText.trim().length > 0 ? searchResults : participants;

    useEffect(() => {
        if (!searchText.trim()) {
            setSearchResults([]);
            setSearchPagination({ page: 1, total_pages: 1 });
            return;
        }
        const timer = setTimeout(async () => {
            try {
                setSearching(true);
                const result = await eventService.getEvents({
                    is_participant: '1',
                    page_participant: 1,
                    filter_name_participant: searchText.trim(),
                });
                setSearchResults(result.participants || []);
                setSearchPagination({
                    page: 1,
                    total_pages: result.pagination?.participants?.total_pages ?? 1,
                });
            } catch (err) {
                console.error('❌ Search failed:', err);
            } finally {
                setSearching(false);
            }
        }, 350);
        return () => clearTimeout(timer);
    }, [searchText]);

    const loadMoreSearchResults = useCallback(async () => {
        if (isLoadingMoreSearch.current) return;
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
            const result = await eventService.getEvents({
                is_participant: '1',
                page_participant: nextPage,
                filter_name_participant: searchText,
            });
            setSearchResults(prev => {
                const ids = new Set(prev.map(e => e.customer_app_id));
                return [...prev, ...(result.participants || []).filter(i => !ids.has(i.customer_app_id))];
            });
            setSearchPagination({
                page: nextPage,
                total_pages: result.pagination?.participants?.total_pages ?? totalPages,
            });
        } catch (err) {
            console.error('❌ Search load more failed:', err);
        } finally {
            isLoadingMoreSearch.current = false;
            setLoadingMore(false);
        }
    }, [searchText]);


    const loadMoreParticipant = useCallback(async () => {
        if (loadingMoreParticipant || participantPagination.page >= participantPagination.total_pages) return;

        try {
            setLoadingMoreParticipant(true);
            const nextPage = participantPagination.page + 1;
            const result = await eventService.getEvents({
                is_participant: '1',
                page_participant: nextPage,
                filter_name_participant: '',
            });
            setParticipants(prev => {
                const ids = new Set(prev.map(e => e.customer_app_id));
                return [...prev, ...(result.participants || []).filter(i => !ids.has(i.customer_app_id))];
            });
            setParticipantPagination(prev => ({
                page: nextPage,
                total_pages: result.pagination?.participants?.total_pages ?? prev.total_pages,
            }));
        } catch (err) {
            console.error('❌ Participant load more failed:', err);
        } finally {
            setLoadingMoreParticipant(false);
        }
    }, [loadingMoreParticipant, participantPagination]);

    
    const handleLoadMore = useCallback(() => {
        if (searchText.trim().length > 0) {
            if (!isLoadingMoreSearch.current && searchPagination.page < searchPagination.total_pages) {
                loadMoreSearchResults();
            }
            return;
        }
        if (participantPagination.page < participantPagination.total_pages && !loadingMoreParticipant) {
            loadMoreParticipant();
        }
    }, [
        searchText,
        searchPagination,
        participantPagination,
        loadingMoreParticipant,
        loadMoreSearchResults,
        loadMoreParticipant,
    ]);

    const renderCard = useCallback(
        ({ item }: { item: ParticipantItem }) => (
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
        [isFollowed, isLoading, handleFollowPress]
    );

    const renderEmpty = useCallback(() => {
        if (searching) {
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
                    {t('follower:empty.searchNoResults')}
                </Text>
            );
        }
        return (
            <View style={{ alignItems: 'center', marginTop: 60, paddingHorizontal: spacing.xl, gap: 12 }}>
                <Feather name="users" size={48} color={colors.gray500} />
                <Text style={commonStyles.title}>
                    {t('follow:empty.emptyTitle')}
                </Text>
                <Text style={[commonStyles.subtitle, { textAlign: 'center' }]}>
                    {t('follow:empty.emptySubtitle')}
                </Text>
            </View>
        );
    }, [searching, searchText, t]);

    return (
        <SafeAreaView style={commonStyles.container} edges={['top']}>
            <StatusBar barStyle="dark-content" />
            <AppHeader />

            <View style={follow.yellowHeader}>
                <Text style={commonStyles.title}>{t('follow:athlete')}</Text>
            </View>

            <FlatList
                data={displayEvents}
                keyExtractor={(item, index) => `${item.customer_app_id}_${index}`}
                renderItem={renderCard}
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.5}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                removeClippedSubviews={false}
                contentContainerStyle={{
                    paddingHorizontal: spacing.md,
                    paddingBottom: spacing.xxxl,
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
                ListFooterComponent={
                    loadingMore || loadingMoreParticipant ? (
                        <ActivityIndicator
                            size="small"
                            color={colors.primary}
                            style={{ marginVertical: spacing.md }}
                        />
                    ) : null
                }
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

export default AthleteSearchScreen;
