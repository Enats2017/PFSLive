import React, { useCallback } from 'react';
import { View, Text, FlatList, ActivityIndicator, useWindowDimensions } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { commonStyles, spacing, palette } from '../../styles/common.styles';
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
    profile?: AthleteProfile;
    
}

const PastTab: React.FC<PastTabProps> = ({ events, onLoadMore, loadingMore, hasMore, profile }) => {
    // ✅ Landscape (device test 2026-10-23): 16pt under the last card, not the
    // 90pt nav-bar pad — a blank band on a ~280pt-tall list.
    const { width: winW, height: winH } = useWindowDimensions();
    const isLandscape = winW > winH;
    const { t } = useTranslation(['profile']);

    

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
                console.log('Calling onLoadMore');
            }
            onLoadMore();
        } else {
            if (API_CONFIG.DEBUG) {
                console.log('Skipped - hasMore:', hasMore, 'loadingMore:', loadingMore);
            }
        }
    }, [hasMore, loadingMore, onLoadMore, events.length]);

    const renderItem = useCallback(
        ({ item }: { item: AthleteEvent }) => <EventCardPast
            item={item}
            isOwnProfile={profile?.is_own_profile === 1} 
        />,
        // ✅ Real deps (layout audit 2026-10-22): [] froze the first render's
        // profile, so isOwnProfile stayed false after the profile loaded.
        [profile?.is_own_profile]
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
                color={palette.navy}
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
            nestedScrollEnabled={true}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
                paddingHorizontal: spacing.xl,
                paddingTop: spacing.md,
                paddingBottom: isLandscape ? spacing.lg : spacing.xxxxl,
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