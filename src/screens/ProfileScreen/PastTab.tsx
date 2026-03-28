import React, { useCallback } from 'react';
import { View, Text, FlatList, ActivityIndicator } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { commonStyles, spacing, colors } from '../../styles/common.styles';
import { profileStyles } from '../../styles/Profile.styles';
import { AthleteEvent, AthleteProfile } from '../../services/athleteProfileService';
import EventCardPast from './EventCardPast';
import { API_CONFIG } from '../../constants/config';
import ErrorScreen from '../../components/ErrorScreen';

interface PastTabProps {
    events: AthleteEvent[];
    onLoadMore: () => void;
    loadingMore: boolean;
    hasMore: boolean;
    profile?: AthleteProfile
}

const PastTab: React.FC<PastTabProps> = ({ events, onLoadMore, loadingMore, hasMore, profile }) => {
    const { t } = useTranslation(['profile']);

    // ✅ SIMPLIFIED: Just check hasMore and loadingMore
    const handleLoadMore = useCallback(() => {
        if (API_CONFIG.DEBUG) {
            console.log('🔍 Past onEndReached:', {
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
        ({ item }: { item: AthleteEvent }) => <EventCardPast
            item={item}
            isOwnProfile={profile?.is_own_profile === 1}  // ← add
        />,
        []
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
            <ErrorScreen
                type="empty"
                title={t('profile:past.no_events')}
                message={t('profile:past.no_events_msg')}
                onRetry={() => { }}
            />
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

export default React.memo(PastTab);