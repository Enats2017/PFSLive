import React, { useEffect, useState, useCallback, useRef } from 'react';
import { FlatList, ActivityIndicator, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, commonStyles, spacing } from '../../styles/common.styles';
import { AppHeader } from '../../components/common/AppHeader';
import FavouriteCard from './FavouriteCard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BottomNavigationFollower } from '../../components/common/BottomNavigationFollower';
import { favouritesApi, FavouriteItem } from '../../services/favourites';
import { API_CONFIG } from '../../constants/config';
import { FavouriteListpops } from '../../types/navigation';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { favstyle } from '../../styles/favourite.style';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

const FavouriteList: React.FC<FavouriteListpops> = ({ route, navigation }: any) => {
    const { product_app_id } = route.params;
    const { t } = useTranslation(['favourite', 'common']);
    const [favourites, setFavourites] = useState<FavouriteItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [paginationInfo, setPaginationInfo] = useState({
        page: 1,
        total_pages: 1,
    });
    const isFetching = useRef(false);
    const isInitialMount = useRef(true);

    const fetchFavourites = useCallback(async () => {
        if (isFetching.current) {
            if (API_CONFIG.DEBUG) {
                console.log('⏸️ Fetch already in progress');
            }
            return;
        }

        try {
            isFetching.current = true;

            if (isInitialMount.current) {
                setLoading(true);
            }

            setError(null);

            const result = await favouritesApi.getFavourites({
                product_app_id,
                page: 1,
            });

            setFavourites(result.favourites);
            setPaginationInfo({
                page: result.pagination.page,
                total_pages: result.pagination.total_pages,
            });

            if (API_CONFIG.DEBUG) {
                console.log('✅ Favourites loaded:', {
                    total: result.pagination.total,
                    count: result.favourites.length,
                });
            }
        } catch (err: any) {
            if (API_CONFIG.DEBUG) {
                console.error('❌ Favourites fetch failed:', err);
            }
            setError(err.message || 'Failed to load favourites');
        } finally {
            setLoading(false);
            isFetching.current = false;
            isInitialMount.current = false;
        }
    }, [product_app_id]);

    useFocusEffect(
        useCallback(() => {
            // reset to page 1 and reload every time screen comes into focus
            setFavourites([]);
            setPaginationInfo({ page: 1, total_pages: 1 });
            isInitialMount.current = true;
            isFetching.current = false;
            fetchFavourites();
        }, [fetchFavourites])
    );

    const loadMore = useCallback(async () => {
        if (loadingMore || paginationInfo.page >= paginationInfo.total_pages) {
            return;
        }

        try {
            setLoadingMore(true);
            const nextPage = paginationInfo.page + 1;

            if (API_CONFIG.DEBUG) {
                console.log(`📡 Favourites: Loading page ${nextPage}`);
            }

            const result = await favouritesApi.getFavourites({
                product_app_id,
                page: nextPage,
            });

            setFavourites(prev => {
                const existingKeys = new Set(
                    prev.map(item =>
                        item.customer_app_id
                            ? `user-${item.customer_app_id}`
                            : `bib-${item.bib_number}`
                    )
                );
                const newItems = result.favourites.filter(item => {
                    const key = item.customer_app_id
                        ? `user-${item.customer_app_id}`
                        : `bib-${item.bib_number}`;
                    return !existingKeys.has(key);
                });

                if (API_CONFIG.DEBUG) {
                    console.log(`➕ Favourites: Adding ${newItems.length} new items`);
                }

                return [...prev, ...newItems];
            });

            setPaginationInfo({
                page: nextPage,
                total_pages: result.pagination.total_pages,
            });

        } catch (err) {
            if (API_CONFIG.DEBUG) {
                console.error('❌ Favourites: Load more failed:', err);
            }
        } finally {
            setLoadingMore(false);
        }
    }, [loadingMore, paginationInfo, product_app_id]);

    const keyExtractor = useCallback((item: FavouriteItem, index: number) =>
        item.customer_app_id
            ? `user-${item.customer_app_id}-${index}`
            : `bib-${item.bib_number}-${index}`,
        []);

    const renderItem = useCallback(({ item }: { item: FavouriteItem }) => (
        <FavouriteCard item={item} />
    ), []);

    const renderEmptyComponent = useCallback(() => (
        <>
            <View style={commonStyles.centerContainer}>
                <Text style={{ fontSize: 48, marginBottom: 10 }}>⭐</Text>
                <Text style={commonStyles.title}>
                    {t('favourite:message.nofavourite')}
                </Text>

                <Text style={commonStyles.subtitle}>
                    {t('favourite:message.favouritemsg')}

                </Text>
            </View>

        </>

    ), []);
    if (loading) {
        return (
            <SafeAreaView style={commonStyles.container} edges={['top', 'bottom']}>
                <AppHeader title="Favourites" />
                <View style={commonStyles.centerContainer}>
                    <ActivityIndicator size="large" />
                </View>
                <BottomNavigationFollower />
            </SafeAreaView>
        );
    }

    if (error) {
        return (
            <SafeAreaView style={commonStyles.container} edges={['top', 'bottom']}>
                <AppHeader title="Favourites" />
                <View style={commonStyles.centerContainer}>
                    <Text style={commonStyles.errorText}>{error}</Text>
                </View>
                <BottomNavigationFollower />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={commonStyles.container} edges={['top', 'bottom']}>
            <AppHeader title="Favourites" />
            <FlatList
                data={favourites}
                keyExtractor={keyExtractor}
                renderItem={renderItem}
                onEndReached={loadMore}
                onEndReachedThreshold={0.5}
                contentContainerStyle={{
                    paddingHorizontal: spacing.sm,
                    paddingBottom: spacing.xxxl,
                    flexGrow: 1,
                }}
                ListFooterComponent={
                    loadingMore
                        ? <ActivityIndicator size="small" style={{ paddingVertical: 14 }} />
                        : null
                }
                ListEmptyComponent={renderEmptyComponent}
            />
            <View style={favstyle.addButtonContainer}>
                <TouchableOpacity
                    style={favstyle.addButton}
                    activeOpacity={0.8}
                    onPress={() => {
                        navigation.navigate('AllParticipant', {
                            product_app_id
                        })
                    }}
                >
                    <View style={favstyle.iconWrapper}>
                        <MaterialIcons name="person-add-alt" size={30} color={colors.white} />
                    </View>
                </TouchableOpacity>
            </View>
            <BottomNavigationFollower activeTab='Favorites' />
        </SafeAreaView>
    );
};

export default FavouriteList;

