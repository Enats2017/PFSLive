import React, { useState, useRef, useCallback } from 'react';
import {
    View,
    Text,
    FlatList,
    ActivityIndicator,
    TouchableOpacity,
    StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { commonStyles, spacing, colors } from '../../styles/common.styles';
import SearchInput from '../../components/SearchInput';
import { participantService, Participant } from '../../services/participantService';
import { API_CONFIG } from '../../constants/config';
import ParticipantCard from './ParticipantCard';
import { SearchParticipantpops } from '../../types/navigation';
import ErrorScreen from '../../components/ErrorScreen';
import { useScreenError } from '../../hooks/useApiError';
import { AppHeader } from '../../components/common/AppHeader';

const SearchParticipant: React.FC<SearchParticipantpops> = ({ route, navigation }) => {
    const {
        product_app_id,
        product_option_value_app_id,  
        raceStatus                    
    } = route.params;
    const { t } = useTranslation(['details', 'follower']);
    const productId = typeof product_app_id === 'string' ? parseInt(product_app_id, 10) : product_app_id;

    const [participants, setParticipants] = useState<Participant[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    //const [error, setError] = useState<string | null>(null);
    const debounceTimer = useRef<NodeJS.Timeout | null>(null);
    const searchInputRef = useRef<any>(null);

    const { error, hasError, handleApiError, clearError } = useScreenError();

    const fetchParticipants = useCallback(
        async (pageNum: number, search: string) => {
            try {
                if (pageNum === 1 && search.length === 0) {
                    setLoading(true);
                    clearError();
                } else if (pageNum > 1) {
                    setLoadingMore(true);
                }

                if (API_CONFIG.DEBUG) {
                    console.log(`📡 Fetching participants page ${pageNum}`, {
                        search: search || '(none)',
                        product_app_id: productId,
                    });
                }

                const result = await participantService.getParticipants({
                    product_app_id: productId,
                    product_option_value_app_id: product_option_value_app_id,
                    page: pageNum,
                    filter_name: search,
                });

                setParticipants((prev) => {
                    if (pageNum === 1) {
                        return result.participants;
                    } else {
                        const existingIds = new Set(
                            prev.map((p) => participantService.getParticipantId(p))
                        );

                        const newItems = result.participants.filter((p) => {
                            const participantId = participantService.getParticipantId(p);
                            return !existingIds.has(participantId);
                        });

                        if (API_CONFIG.DEBUG) {
                            console.log(
                                `✅ Added ${newItems.length} new participants (Total: ${prev.length + newItems.length})`
                            );
                        }

                        return [...prev, ...newItems];
                    }
                });

                setPage(pageNum);
                setTotalPages(result.pagination.total_pages);

                if (API_CONFIG.DEBUG) {
                    console.log(
                        `📄 Page ${pageNum}/${result.pagination.total_pages} | Total: ${result.pagination.total}`
                    );
                }
            } catch (error: any) {
                if (API_CONFIG.DEBUG) {
                    console.error('❌ Error fetching participants:', error.message);
                }

                if (pageNum === 1) {
                    handleApiError(error);
                }
            } finally {
                setLoading(false);
                setLoadingMore(false);
            }
        },
        [productId, t]
    );

    useFocusEffect(
        useCallback(() => {

            fetchParticipants(1, '');
        }, [fetchParticipants])
    );

    React.useEffect(() => {
        if (debounceTimer.current) {
            clearTimeout(debounceTimer.current);
        }

        debounceTimer.current = setTimeout(() => {
            fetchParticipants(1, searchText);
        }, 500);

        return () => {
            if (debounceTimer.current) {
                clearTimeout(debounceTimer.current);
            }
        };
    }, [searchText, fetchParticipants]);

    const hasMorePages = useCallback((): boolean => {
        return page < totalPages;
    }, [page, totalPages]);

    const handleLoadMore = useCallback(() => {
        if (API_CONFIG.DEBUG) {
            console.log('🔍 onEndReached triggered:', {
                hasMore: hasMorePages(),
                loading: loadingMore,
                currentPage: page,
                totalPages,
            });
        }

        if (!hasMorePages() || loadingMore) {
            return;
        }

        fetchParticipants(page + 1, searchText);
    }, [page, totalPages, loadingMore, searchText, hasMorePages, fetchParticipants]);

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

    const renderFooter = useCallback(() => {
        if (loadingMore) {
            return (
                <View style={{ paddingVertical: spacing.lg, alignItems: 'center' }}>
                    <ActivityIndicator size="small" color={colors.primary} />
                </View>
            );
        }

        return null;
    }, [loadingMore]);

    const renderEmpty = useCallback(() => (
        <View style={{ marginTop: 40, paddingHorizontal: spacing.lg }}>
            <Text style={commonStyles.errorText}>
                {searchText
                    ? `${t('details:participant.noResults')} "${searchText}"`
                    : t('details:participant.empty')}
            </Text>
        </View>
    ), [searchText, t]);

    if (loading && searchText.length === 0) {
        return (
            <SafeAreaView style={commonStyles.container} edges={['top', 'bottom']}>
                <View style={commonStyles.centerContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            </SafeAreaView>
        );
    }

    if (hasError && !loading) {
        return (
            <SafeAreaView style={commonStyles.container} edges={['top']}>
                <StatusBar barStyle="dark-content" />
                <AppHeader showLogo={true} />
                <ErrorScreen
                    type={error!.type}
                    title={error!.title}
                    message={error!.message}
                    onRetry={() => { clearError(); fetchParticipants(1, searchText) }}
                />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={commonStyles.container} edges={['top', 'bottom']}>
            <StatusBar barStyle="dark-content" />

            <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 }}>
                    <TouchableOpacity
                        style={{ width: 32 }}
                        hitSlop={{ top: 8, bottom: 8, left: 10, right: 8 }}
                        onPress={() => navigation.goBack()}
                    >
                        <Ionicons name="chevron-back" size={32} color={colors.gray900} />
                    </TouchableOpacity>
                    <Text style={commonStyles.title}>{t('favourite:addRunner')}</Text>
                </View>
                <SearchInput
                    ref={searchInputRef}
                    placeholder={t('details:participant.search')}
                    value={searchText}
                    onChangeText={setSearchText}
                    icon="search"
                />
            </View>

            {loading && searchText.length > 0 && (
                <View style={{ marginTop: spacing.lg, alignItems: 'center' }}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={{ marginTop: spacing.sm, color: colors.gray500 }}>
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
                    paddingHorizontal: spacing.sm,
                    paddingBottom: spacing.xxxl,
                    flexGrow: 1,
                }}
                keyboardShouldPersistTaps="handled"
                removeClippedSubviews={false}
                ListFooterComponent={renderFooter}
                ListEmptyComponent={!loading ? renderEmpty : null}
            />

        </SafeAreaView>
    );
};

export default SearchParticipant;