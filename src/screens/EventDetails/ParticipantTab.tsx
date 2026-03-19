import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { commonStyles, spacing, colors } from '../../styles/common.styles';
import SearchInput from '../../components/SearchInput';
import { participantService, Participant } from '../../services/participantService';
import { API_CONFIG } from '../../constants/config';
import ParticipantCard from './ParticipantCard';
import { useFollowManager } from '../../hooks/useFollowManager';

interface ParticipantTabProps {
  product_app_id: string | number;
}

const ParticipantTab: React.FC<ParticipantTabProps> = ({ product_app_id }) => {
  const { t } = useTranslation(['details', 'follower']);

  // ✅ PASS product_app_id TO HOOK
  const productId = typeof product_app_id === 'string' ? parseInt(product_app_id, 10) : product_app_id;
  const { isFollowed, isLoading, toggleFollow, refreshFollowedUsers } = useFollowManager(t, productId);

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const searchInputRef = useRef<any>(null);

  const fetchParticipants = useCallback(
    async (pageNum: number, search: string) => {
      try {
        if (pageNum === 1 && search.length === 0) {
          setLoading(true);
          setError(null);
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
                `✅ Added ${newItems.length} new participants (Total: ${
                  prev.length + newItems.length
                })`
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
          setError(error.message || t('details:error.title'));
        }
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [productId, t]
  );

  // ✅ INITIAL LOAD
  useFocusEffect(
    useCallback(() => {
      refreshFollowedUsers();
      fetchParticipants(1, '');
    }, [fetchParticipants, refreshFollowedUsers])
  );

  // ✅ DEBOUNCED SEARCH
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

  // ✅ RENDER WITH DUAL FOLLOW SYSTEM
  const renderParticipant = useCallback(
    ({ item }: { item: Participant }) => {
      // Use bib_number as fallback if bib doesn't exist
      const bib = item.bib || item.bib_number || '';
      
      return (
        <ParticipantCard
          item={item}
          product_app_id={productId}
          isFollowed={isFollowed(productId, bib, item.customer_app_id)}
          isLoading={isLoading(productId, bib, item.customer_app_id)}
          onToggleFollow={() => toggleFollow(productId, bib, item.customer_app_id)}
        />
      );
    },
    [productId, isFollowed, isLoading, toggleFollow]
  );

  const renderFooter = useCallback(() => {
    if (loadingMore) {
      return (
        <View style={{ paddingVertical: spacing.lg, alignItems: 'center' }}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={{ marginTop: spacing.sm, color: colors.gray500 }}>
            Loading more... ({page}/{totalPages})
          </Text>
        </View>
      );
    }

    if (hasMorePages() && participants.length > 0) {
      return (
        <View style={{ paddingVertical: spacing.lg, alignItems: 'center' }}>
          <Text style={{ color: colors.gray500 }}>
            Scroll for more ({participants.length})
          </Text>
        </View>
      );
    }

    return null;
  }, [loadingMore, page, totalPages, hasMorePages, participants.length]);

  if (loading && searchText.length === 0) {
    return (
      <ActivityIndicator
        size="large"
        color={colors.primary}
        style={{ marginTop: 40 }}
      />
    );
  }

  if (error && searchText.length === 0) {
    return (
      <View style={commonStyles.centerContainer}>
        <Text style={commonStyles.errorText}>{error}</Text>
        <TouchableOpacity
          style={[commonStyles.primaryButton, { marginTop: spacing.lg }]}
          onPress={() => fetchParticipants(1, searchText)}
          activeOpacity={0.8}
        >
          <Text style={commonStyles.primaryButtonText}>
            {t('details:error.retry')}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <>
      <View
        style={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
        }}
      >
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

      {!loading && participants.length === 0 ? (
        <View style={{ marginTop: 40, paddingHorizontal: spacing.lg }}>
          <Text style={commonStyles.errorText}>
            {searchText
              ? `${t('details:participant.noResults')} "${searchText}"`
              : t('details:participant.empty')}
          </Text>
        </View>
      ) : (
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
            paddingHorizontal: spacing.lg,
            paddingBottom: spacing.xxxl,
            flexGrow: 1,
          }}
          keyboardShouldPersistTaps="handled"
          removeClippedSubviews={false}
          ListFooterComponent={renderFooter}
        />
      )}
    </>
  );
};

export default ParticipantTab;