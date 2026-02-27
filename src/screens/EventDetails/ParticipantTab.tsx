import React, { useState, useRef, useCallback } from 'react';
import { View, Text, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { commonStyles, spacing, colors } from '../../styles/common.styles';
import { detailsStyles } from '../../styles/details.styles';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import SearchInput from '../../components/SearchInput';
import { LinearGradient } from 'expo-linear-gradient';
import { participantService, Participant } from '../../services/participantService';
import { API_CONFIG } from '../../constants/config';

interface ParticipantTabProps {
  product_app_id: string | number;
}

const ParticipantTab: React.FC<ParticipantTabProps> = ({ product_app_id }) => {
  const { t } = useTranslation(['details']);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const searchInputRef = useRef<any>(null);
  const onEndReachedCalledDuringMomentum = useRef(true);

  useFocusEffect(
    useCallback(() => {
      fetchParticipants(1, '');
    }, [product_app_id])
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
  }, [searchText]);

  const fetchParticipants = async (pageNum: number, search: string) => {
    try {
      if (pageNum === 1 && search.length === 0) {
        setLoading(true);
        setError(null);
      } else if (pageNum > 1) {
        setLoadingMore(true);
      }

      if (API_CONFIG.DEBUG) {
        console.log(`📡 Fetching participants page ${pageNum}`);
      }

      const result = await participantService.getParticipants(
        product_app_id,
        pageNum,
        search
      );

      setParticipants(prev => {
        if (pageNum === 1) {
          return result.participants;
        } else {
          // ✅ SMART DEDUPLICATION: Use source-aware logic
          const existingIds = new Set(
            prev.map(p => participantService.getParticipantId(p))
          );
          
          const newItems = result.participants.filter(p => {
            const participantId = participantService.getParticipantId(p);
            return !existingIds.has(participantId);
          });
          
          if (API_CONFIG.DEBUG) {
            console.log(`✅ Added ${newItems.length} new participants (Total: ${prev.length + newItems.length})`);
            console.log(`📊 Deduplication: checked ${result.participants.length}, added ${newItems.length}`);
          }
          
          return [...prev, ...newItems];
        }
      });

      setPage(pageNum);
      setTotalPages(result.pagination.total_pages);

      if (API_CONFIG.DEBUG) {
        console.log(`📄 Page ${pageNum}/${result.pagination.total_pages} | Total: ${result.pagination.total}`);
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
  };

  const hasMorePages = (): boolean => {
    return page < totalPages;
  };

  const handleLoadMore = useCallback(() => {
    if (API_CONFIG.DEBUG) {
      console.log('🔄 onEndReached fired', {
        momentumFlag: onEndReachedCalledDuringMomentum.current,
        hasMore: hasMorePages(),
        loading: loadingMore,
        currentPage: page,
        totalPages: totalPages
      });
    }

    if (onEndReachedCalledDuringMomentum.current) {
      if (API_CONFIG.DEBUG) console.log('⏭️ Skipped: momentum flag set');
      return;
    }

    if (!hasMorePages()) {
      if (API_CONFIG.DEBUG) console.log('⏭️ Skipped: no more pages');
      return;
    }

    if (loadingMore) {
      if (API_CONFIG.DEBUG) console.log('⏭️ Skipped: already loading');
      return;
    }

    onEndReachedCalledDuringMomentum.current = true;

    if (API_CONFIG.DEBUG) {
      console.log(`📥 Loading more: page ${page + 1}/${totalPages}`);
    }

    fetchParticipants(page + 1, searchText);
  }, [page, totalPages, loadingMore, searchText]);

  const renderParticipant = useCallback(({ item, index }: { item: Participant; index: number }) => {
    const fullName = `${item.firstname ?? ''} ${item.lastname ?? ''}`.trim().toUpperCase() || t('details:participant.unknownName');
    const hasBibNumber = item.bib_number && item.bib_number.trim() !== '';
    const isLiveTracking = item.live_tracking_activated === 1;

    return (
      <View style={[commonStyles.card, { padding: 0, overflow: 'hidden', marginBottom: spacing.lg }]}>
        <View style={detailsStyles.topRow}>
          <View style={detailsStyles.avatar}>
            <Ionicons
              name="person-circle-outline"
              size={55}
              color="#9ca3af"
              style={detailsStyles.logo}
            />
          </View>
          <LinearGradient
            colors={['#e8341a', '#f4a100', '#1a73e8']}
            start={{ x: 0, y: 1 }}
            end={{ x: 1, y: 0 }}
            style={detailsStyles.divider}
          />
          <View style={detailsStyles.info}>
            <Text style={commonStyles.title}>{fullName}</Text>
            <Text style={commonStyles.text}>{item.city} | {item.country}</Text>
            <Text style={commonStyles.subtitle}>{item.race_distance}</Text>
            {hasBibNumber && (
              <Text style={[commonStyles.subtitle, { color: colors.primary, fontWeight: '600' }]}>
                {t('details:tracking.bib')}: {item.bib_number}
              </Text>
            )}
          </View>
        </View>

        {isLiveTracking && (
          <View style={detailsStyles.liveTrackingBadge}>
            <Ionicons name="radio" size={14} color={colors.success} />
            <Text style={detailsStyles.liveTrackingText}>
              {t('details:tracking.live')}
            </Text>
          </View>
        )}

        <TouchableOpacity style={commonStyles.primaryButton}>
          <Text style={commonStyles.primaryButtonText}>
            {t('details:participant.favorite')}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }, [t]);

  if (loading && searchText.length === 0) {
    return (
      <ActivityIndicator
        size="large"
        color="#FF5722"
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
      <View style={{ paddingHorizontal: spacing.lg }}>
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
          <ActivityIndicator size="small" color="#FF5722" />
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
              : t('details:participant.empty')
            }
          </Text>
        </View>
      ) : (
        <FlatList
          data={participants}
          keyExtractor={(item, index) => `${participantService.getParticipantId(item)}-${index}`}
          renderItem={renderParticipant}
          showsVerticalScrollIndicator={false}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          onMomentumScrollBegin={() => {
            onEndReachedCalledDuringMomentum.current = false;
            if (API_CONFIG.DEBUG) console.log('🔄 Scroll momentum began - flag reset');
          }}
          contentContainerStyle={{ 
            paddingHorizontal: spacing.lg,
            paddingBottom: spacing.xxxl 
          }}
          keyboardShouldPersistTaps="handled"
          ListFooterComponent={
            loadingMore ? (
              <View style={{ paddingVertical: spacing.lg, alignItems: 'center' }}>
                <ActivityIndicator size="small" color="#FF5722" />
                <Text style={{ marginTop: spacing.sm, color: colors.gray500 }}>
                  Loading more... ({page}/{totalPages})
                </Text>
              </View>
            ) : hasMorePages() && participants.length > 0 ? (
              <View style={{ paddingVertical: spacing.lg, alignItems: 'center' }}>
                <Text style={{ color: colors.gray500 }}>
                  Scroll for more ({participants.length} loaded)
                </Text>
              </View>
            ) : null
          }
        />
      )}
    </>
  );
};

export default ParticipantTab;