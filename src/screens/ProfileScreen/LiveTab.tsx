import React, { useCallback } from 'react';
import { View, Text, FlatList, ActivityIndicator } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { commonStyles, spacing, colors } from '../../styles/common.styles';
import { profileStyles } from '../../styles/Profile.styles';
import { AthleteEvent, AthleteProfile } from '../../services/athleteProfileService';
import { EventCard } from './EventCardLive';
import { API_CONFIG } from '../../constants/config';

interface LiveTabProps {
    events: AthleteEvent[];
    onLoadMore: () => void;
    loadingMore: boolean;
    hasMore: boolean;
    profile?:    AthleteProfile
}

const LiveTab: React.FC<LiveTabProps> = ({ events, onLoadMore, loadingMore, hasMore,profile }) => {
    const { t } = useTranslation(['profile']);
    console.log("111",profile);
    

    // ✅ SIMPLIFIED: Just check hasMore and loadingMore
    const handleLoadMore = useCallback(() => {
        if (API_CONFIG.DEBUG) {
            console.log('🔍 Live onEndReached:', {
                hasMore,
                loadingMore,
                eventsCount: events.length,
            });
        }

        if (hasMore && !loadingMore) {
            if (API_CONFIG.DEBUG) {
                console.log('✅ Calling onLoadMore');
            }
            onLoadMore();
        } else {
            if (API_CONFIG.DEBUG) {
                console.log('⏸️ Skipped - hasMore:', hasMore, 'loadingMore:', loadingMore);
            }
        }
    }, [hasMore, loadingMore, onLoadMore, events.length]);

    const renderItem = useCallback(
    ({ item }: { item: AthleteEvent }) => (
        <EventCard 
            item={item} 
            isOwnProfile={profile?.is_own_profile === 1}
        />
    ),
    [profile]  // ← add profile to dependencies
);

    const keyExtractor = useCallback(
        (item: AthleteEvent, index: number) => `${item.id}-${index}`,
        []
    );

    const ListFooterComponent = useCallback(() => {
        if (!loadingMore) return null;
        return (
            <ActivityIndicator
                size="small"
                color={colors.primary}
                style={{ marginVertical: spacing.md }}
            />
        );
    }, [loadingMore]);

    const ListEmptyComponent = useCallback(
        () => (
            <View style={profileStyles.empty}>
                <Ionicons name="radio-outline" size={48} color={colors.gray300} />
                <Text style={commonStyles.errorText}>
                    {t('profile:empty.no_live_events')}
                </Text>
            </View>
        ),
        [t]
    );

    return (
        <FlatList
            data={events}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
                paddingHorizontal: spacing.md,
                paddingTop: spacing.md,
                paddingBottom: spacing.xl,
                flexGrow: 1,
            }}
            ListFooterComponent={ListFooterComponent}
            ListEmptyComponent={ListEmptyComponent}
            keyboardShouldPersistTaps="handled"
            removeClippedSubviews={false}
        />
    );
};

export default React.memo(LiveTab);