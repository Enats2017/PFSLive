import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { commonStyles, spacing, colors } from '../../styles/common.styles';
import { detailsStyles } from '../../styles/details.styles';
import SearchInput from '../../components/SearchInput';
import { participantService, Participant } from '../../services/participantService';
import { API_CONFIG } from '../../constants/config';

import ParticipantCard from './ParticipantCard';
import { clearCache } from '../../../utils/followStorage';


interface ParticipantTabProps {
  product_app_id: string | number;
}

const ParticipantTab: React.FC<ParticipantTabProps> = ({ product_app_id }) => {
  const { t } = useTranslation(['details','follower']);

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
            product_app_id,
          });
        }

        const result = await participantService.getParticipants({
          product_app_id,
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
    [product_app_id, t]
  );

  useFocusEffect(
    useCallback(() => {
       clearCache();
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

  // ✅ SIMPLIFIED: No momentum flag
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
  ({ item }: { item: Participant }) => <ParticipantCard item={item} t={t} />,
  [t]
);

  const renderFooter = useCallback(() => {
    if (loadingMore) {
      return (
        <View style={{ paddingVertical: spacing.lg, alignItems: 'center' }}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={{ marginTop: spacing.sm, color: colors.gray500 }}>
            {t('details:participant.loadingMore')} ({page}/{totalPages})
          </Text>
        </View>
      );
    }

    if (hasMorePages() && participants.length > 0) {
      return (
        <View style={{ paddingVertical: spacing.lg, alignItems: 'center' }}>
          <Text style={{ color: colors.gray500 }}>
            {t('details:participant.scrollForMore')} ({participants.length})
          </Text>
        </View>
      );
    }

    return null;
  }, [loadingMore, page, totalPages, hasMorePages, participants.length, t]);

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
      {/* ✅ SEARCH INPUT - ADDED TOP PADDING */}
      <View
        style={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md, // ✅ ADDED: Space between tab bar and search
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
            flexGrow: 1, // ✅ ADDED: Allows scrolling with few items
          }}
          keyboardShouldPersistTaps="handled"
          removeClippedSubviews={false} // ✅ ADDED: Prevents scroll issues
          ListFooterComponent={renderFooter}
        />
      )}
    </>
  );
};

export default ParticipantTab;