import React, { useRef, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { EventItem } from '../../services/followerEvent';
import { commonStyles, spacing } from '../../styles/common.styles';
import { eventStyles } from '../../styles/event';
import { useTranslation } from 'react-i18next';
import { formatEventDate } from '../../utils/dateFormatter';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { RootStackParamList } from '../../types/navigation';
import { API_CONFIG } from '../../constants/config';

interface UpcomingTabProps {
    events: EventItem[];
    onLoadMore: () => void;
    loadingMore: boolean;
    hasMore: boolean;
}

const UpcomingTab: React.FC<UpcomingTabProps> = ({ events, onLoadMore, loadingMore, hasMore }) => {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const { t } = useTranslation(['follower', 'common']);
     const handleLoadMore = useCallback(() => {
            if (API_CONFIG.DEBUG) {
                console.log('🔍 Upcoming onEndReached:', {
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

    const renderItem = useCallback(({ item }: { item: EventItem }) => (
        <View style={[
            commonStyles.card,
            {
                paddingTop: spacing.xs,
                padding: 0,
                overflow: 'hidden',
                marginBottom: spacing.md // ✅ Consistent spacing
            }
        ]}>
            <View style={eventStyles.header}>
                <Text style={[commonStyles.title, { marginBottom: spacing.xs }]}>
                    {item.name}
                </Text>
                <Text style={commonStyles.subtitle}>
                    {formatEventDate(item.race_date, t)}
                </Text>
            </View>
            <TouchableOpacity
                style={[commonStyles.primaryButton, { borderRadius: 0 }]}
                 onPress={() => navigation.navigate('FollowDetails', {
                    product_app_id: Number(item.product_app_id),
                    event_name: item.name,
                    sourceTab: 'upcoming',         
                })}
                activeOpacity={0.8}
            >
                <Text style={commonStyles.primaryButtonText}>
                    {t('follower:button.show_event')}
                </Text>
            </TouchableOpacity>
        </View>
    ), [navigation, t]);

    const keyExtractor = useCallback(
        (item: EventItem, index: number) => `${item.product_app_id}-${index}`,
        []
    );

    const ListFooterComponent = useCallback(() => {
        if (!loadingMore) return null;
        return (
            <ActivityIndicator
                size="small"
                color="#FF5722"
                style={{ marginVertical: spacing.md }}
            />
        );
    }, [loadingMore]);

    const ListEmptyComponent = useCallback(() => (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: spacing.xxl }}>
            <Text style={commonStyles.errorText}>
                {t('event:empty.upcoming')}
            </Text>
        </View>
    ), [t]);

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
                paddingBottom: spacing.xl,
                flexGrow: 1
            }}
            ListFooterComponent={ListFooterComponent}
            ListEmptyComponent={ListEmptyComponent}
            keyboardShouldPersistTaps="handled"
            removeClippedSubviews={false}
        />
    );
};

export default React.memo(UpcomingTab);