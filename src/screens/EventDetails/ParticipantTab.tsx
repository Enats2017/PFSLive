import React, { useState, useRef, useCallback } from 'react';
import { View, Text, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { commonStyles, spacing } from '../../styles/common.styles';
import { detailsStyles } from '../../styles/details.styles';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import SearchInput from '../../components/SearchInput';
import { LinearGradient } from 'expo-linear-gradient';
import { participantService, Participant } from '../../services/participantService';

interface ParticipantTabProps {
  product_app_id: string | number;
}

const ParticipantTab = ({ product_app_id }: ParticipantTabProps) => {
  const { t } = useTranslation(['details']);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const isLoadingMoreRef = useRef(false);

  // Fetch participants when screen is focused
  useFocusEffect(
    useCallback(() => {
      fetchParticipants(1, '');
    }, [product_app_id])
  );

  // Debounced search
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
      if (pageNum === 1) {
        setLoading(true);
        setError(null);
      } else {
        setLoadingMore(true);
      }

      const result = await participantService.getParticipants(
        product_app_id,
        pageNum,
        search
      );

      // Filter out duplicates
      setParticipants(prev => {
        if (pageNum === 1) {
          return result.participants;
        } else {
          const existingIds = new Set(prev.map(p => p.participant_app_id));
          const newItems = result.participants.filter(
            p => !existingIds.has(p.participant_app_id)
          );
          return [...prev, ...newItems];
        }
      });

      setPage(pageNum);
      setTotalPages(result.pagination.total_pages);
    } catch (error: any) {
      if (pageNum === 1) {
        setError(error.message || 'Failed to load participants. Please try again.');
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
      isLoadingMoreRef.current = false;
    }
  };

  const handleLoadMore = useCallback(() => {
    if (isLoadingMoreRef.current || loadingMore) return;
    if (page >= totalPages) return;

    isLoadingMoreRef.current = true;
    fetchParticipants(page + 1, searchText);
  }, [page, totalPages, loadingMore, searchText]);

  const renderParticipant = useCallback(({ item, index }: { item: Participant; index: number }) => {
    const fullName = `${item.firstname ?? ''} ${item.lastname ?? ''}`.trim().toUpperCase() || 'UNKNOWN PARTICIPANT';

    return (
      <View style={[commonStyles.card, { padding: 0, overflow: 'hidden', marginBottom: 16 }]}>
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
          </View>
        </View>
        <TouchableOpacity style={commonStyles.favoriteButton}>
          <Text style={commonStyles.favoriteButtonText}>ADD TO FAVORITE</Text>
        </TouchableOpacity>
      </View>
    );
  }, []);

  if (loading) {
    return (
      <ActivityIndicator
        size="large"
        color="#f4a100"
        style={{ marginTop: 40 }}
      />
    );
  }

  if (error) {
    return (
      <View style={commonStyles.centerContainer}>
        <Text style={commonStyles.errorText}>{error}</Text>
        <TouchableOpacity
          style={[commonStyles.primaryButton, { marginTop: 16 }]}
          onPress={() => fetchParticipants(1, searchText)}
        >
          <Text style={commonStyles.primaryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={commonStyles.container}>
      <SearchInput
        placeholder={t('details:participant.search')}
        value={searchText}
        onChangeText={setSearchText}
        icon="search"
      />

      {participants.length === 0 ? (
        <View style={{ marginTop: 40 }}>
          <Text style={commonStyles.errorText}>
            {searchText
              ? `No participants found for "${searchText}"`
              : t('details:participant.empty')
            }
          </Text>
        </View>
      ) : (
        <FlatList
          data={participants}
          keyExtractor={(item, index) => `${item.participant_app_id}-${index}`}
          renderItem={renderParticipant}
          showsVerticalScrollIndicator={false}
          onEndReached={handleLoadMore}
          contentContainerStyle={{ paddingBottom: spacing.xxxl }}
          onEndReachedThreshold={0.2}
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator
                size="small"
                color="#f4a100"
                style={{ marginVertical: 16 }}
              />
            ) : null
          }
        />
      )}
    </View>
  );
};

export default ParticipantTab;