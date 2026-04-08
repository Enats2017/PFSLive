import React, { useEffect, useState, useCallback, useRef } from 'react';
import { FlatList, ActivityIndicator, View, Text, TouchableOpacity, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { colors, commonStyles, spacing } from '../../styles/common.styles';
import { AppHeader } from '../../components/common/AppHeader';
import { BottomNavigationFollower } from '../../components/common/BottomNavigationFollower';
import { BottomNavigation } from '../../components/common/BottomNavigation';
import FavouriteCard from './FavouriteCard';
import { favouritesApi, FavouriteItem } from '../../services/favourites';
import { API_CONFIG } from '../../constants/config';
import { FavouriteListpops } from '../../types/navigation';
import { favstyle } from '../../styles/favourite.style';
import ErrorScreen from '../../components/ErrorScreen';
import { useScreenError } from '../../hooks/useApiError';

const FavouriteList: React.FC<FavouriteListpops> = ({ route, navigation }) => {
    const {
        product_app_id,
        event_name,
        sectionType,
        sourceScreen,
        sourceTab,
        product_option_value_app_id
    } = route.params;

    const { t } = useTranslation(['favourite', 'common']);
    const [favourites, setFavourites] = useState<FavouriteItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    //const [error, setError] = useState<string | null>(null);
    const [paginationInfo, setPaginationInfo] = useState({
        page: 1,
        total_pages: 1,
    });
    const isFetching = useRef(false);
    const isInitialMount = useRef(true);

    const { error, hasError, handleApiError, clearError } = useScreenError();

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

            clearError();

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
            handleApiError(error);
        } finally {
            setLoading(false);
            isFetching.current = false;
            isInitialMount.current = false;
        }
    }, [product_app_id]);

    useFocusEffect(
        useCallback(() => {
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
        <FavouriteCard
            item={item}
            product_app_id={product_app_id}
        />
    ), [product_app_id]);

    const renderEmptyComponent = useCallback(() => (
        <View style={commonStyles.centerContainer}>
            <Text style={{ fontSize: 48, marginBottom: 10 }}>⭐</Text>
            <Text style={commonStyles.title}>
                {t('favourite:message.nofavourite')}
            </Text>
            <Text style={[commonStyles.subtitle,{textAlign:"center",marginTop:5}]}>
                {t('favourite:message.favouritemsg')}
            </Text>
        </View>
    ), [t]);

    const renderFooter = useCallback(() => {
        if (loadingMore) {
            return <ActivityIndicator size="small" style={{ paddingVertical: 14 }} />;
        }
        return null;
    }, [loadingMore]);

    const handleAddPress = useCallback(() => {
        navigation.navigate('AllParticipant', {
            product_app_id,
        });
    }, [navigation, product_app_id]);

    if (loading) {
        return (
            <SafeAreaView style={commonStyles.container} edges={['top', 'bottom']}>
                <AppHeader title={t('favourite:title')} />
                <View style={commonStyles.centerContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
                {sectionType === 'follower' ? (
                    <BottomNavigationFollower activeTab='Favorites' />
                ) : (
                    <BottomNavigation activeTab="Results" />
                )}
            </SafeAreaView>
        );
    }

    if (hasError && !loading) {
        return (
            <SafeAreaView style={commonStyles.container} edges={['top']}>
                <StatusBar barStyle="dark-content" />
                <AppHeader />
                <ErrorScreen
                    type={error!.type}
                    title={error!.title}
                    message={error!.message}
                    onRetry={() => { clearError(); fetchFavourites() }}
                />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={commonStyles.container} edges={['top', 'bottom']}>
            <AppHeader title={t('favourite:title')} />

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
                ListFooterComponent={renderFooter}
                ListEmptyComponent={renderEmptyComponent}
            />

            <View style={favstyle.addButtonContainer}>
                <TouchableOpacity
                    style={favstyle.addButton}
                    activeOpacity={0.8}
                    onPress={handleAddPress}
                >
                    <View style={favstyle.iconWrapper}>
                        <MaterialIcons name="person-add-alt" size={30} color={colors.white} />
                    </View>
                </TouchableOpacity>
            </View>

            {sectionType === 'follower' ? (
                <BottomNavigationFollower
                    activeTab='Favorites'
                    product_app_id={product_app_id}
                    event_name={event_name}
                    sourceTab={sourceTab}
                    product_option_value_app_id={product_option_value_app_id}
                />
            ) : (
                <BottomNavigation
                    activeTab="Results"
                    product_app_id={product_app_id}
                    event_name={event_name}
                    sourceScreen={sourceScreen}
                    product_option_value_app_id={product_option_value_app_id}
                />
            )}
        </SafeAreaView>
    );
};

export default FavouriteList;