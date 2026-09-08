import React, { useCallback } from 'react';
import { View, Text, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import { commonStyles, spacing, palette } from '../../styles/common.styles';
import { eventStyles } from '../../styles/event';
import { EventItem } from '../../services/followerEvent';
import { formatEventDate } from '../../utils/dateFormatter';
import { API_CONFIG } from '../../constants/config';
import ErrorScreen from '../../components/ErrorScreen';
import { analyticsService } from '../../services/analyticsService';
import { ANALYTICS_SCREENS, ANALYTICS_BUTTONS, ANALYTICS_PARAMS, EVENT_STATUS_BUTTON, liveTabStatus } from '../../constants/analyticsScreens';

import { EventListCard } from '../../components/EventListCard';

// Status of a Live-tab row — see liveTabStatus in analyticsScreens.ts.
const liveStatus = liveTabStatus;

interface LiveTabProps {
    events: EventItem[];
    onLoadMore: () => void;
    loadingMore: boolean;
    hasMore: boolean;
}

const LiveTab: React.FC<LiveTabProps> = ({ events, onLoadMore, loadingMore, hasMore }) => {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const { t } = useTranslation(['event', 'common', 'follower', 'livetracking']);

    // The live tab is a WINDOW (today-2 .. today+5 on event_list_api.php), so it
    // also holds races that have already finished and ones that have not begun.
    // `event_status` says which each row actually is.
    //
    // Deliberately NOT liveTabStatus (analyticsScreens.ts), which defaults a
    // missing status to 'live' — for analytics that is right, because the tab
    // itself is the attribution. On screen it would be a claim we cannot back.
    //
    // No status -> NO BADGE. Defaulting to 'live' is what made a 2026-09-06 race
    // claim to be live: the second page of this tab comes from a different query
    // that was not sending the field. Showing nothing is honest; asserting the
    // one state we cannot verify is not.
    const eventBadge = useCallback((status?: 'live' | 'finished' | 'upcoming' | null) => {
        if (!status) return {};
        return {
            badgeLabel: t(`livetracking:raceState_${status}`),
            badgeTone: (status === 'live' ? 'lime' : 'neutral') as 'lime' | 'neutral',
            badgeCaps: true,
        };
    }, [t]);


    // ✅ SIMPLIFIED: Just check hasMore and loadingMore (EXACT PROFILESCREEN PATTERN)
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
        ({ item }: { item: EventItem }) => (
            <EventListCard
                name={item.name}
                date={formatEventDate(item.race_date, t)}
                city={item.city}
                country={item.country}
                imageUrl={item.event_image}
                {...eventBadge(item.event_status)}
                onPress={async () => {
                    await analyticsService.logInteraction(
                        ANALYTICS_SCREENS.FOLLOWER_EVENT_LIST,
                        EVENT_STATUS_BUTTON[liveStatus(item) ?? 'live'] ?? ANALYTICS_BUTTONS.LIVE_EVENT,
                        'tap',
                        {
                            [ANALYTICS_PARAMS.EVENT_NAME]: item.name,
                            [ANALYTICS_PARAMS.TAB_NAME]: 'live',
                            [ANALYTICS_PARAMS.EVENT_STATUS]: liveStatus(item),
                        }
                    );
                    navigation.navigate('FollowDetails', {
                        product_app_id: Number(item.product_app_id),
                        event_name: item.name,
                        event_image: item.event_image ?? '',
                        sourceTab: 'live',
                    });
                }}
            />
        ),
        [navigation, t]
    );

    const keyExtractor = useCallback(
        (item: EventItem, index: number) => `${item.product_app_id}-${index}`,
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
                title={t('event:empty.live')}
                message=""
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
                paddingHorizontal: spacing.xl,
                paddingTop: spacing.md,
                paddingBottom: spacing.xxxxl,
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