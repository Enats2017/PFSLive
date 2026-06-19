import React, { useCallback } from 'react';
import { View, Text, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import { commonStyles, spacing, colors } from '../../styles/common.styles';
import { eventStyles } from '../../styles/event';
import { EventItem } from '../../services/eventService';
import { formatEventDate } from '../../utils/dateFormatter';
import { API_CONFIG } from '../../constants/config';
import ErrorScreen from '../../components/ErrorScreen';

interface UpcomingTabProps {
    events: EventItem[];
    onLoadMore: () => void;
    loadingMore: boolean;
    hasMore: boolean;
}

const UpcomingTab: React.FC<UpcomingTabProps> = ({ events, onLoadMore, loadingMore, hasMore }) => {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const { t } = useTranslation(['event', 'common']);

    // ✅ SIMPLIFIED: Just check hasMore and loadingMore (EXACT PROFILESCREEN PATTERN)
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

    const renderItem = useCallback(
        ({ item }: { item: EventItem }) => (
            <TouchableOpacity
                style={[
                    commonStyles.card,
                    {
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: spacing.lg,
                        paddingVertical: spacing.md,
                        marginBottom: spacing.md,
                    },
                ]}
                onPress={() =>
                    navigation.navigate('EventDetails', {
                        product_app_id: Number(item.product_app_id),
                        event_name: item.name,
                        event_image: item.event_image ?? '',
                        auto_register_id: null,
                        
                    })
                }
                activeOpacity={0.8}
            >
                <View style={eventStyles.eventCardInfo}>
                    <Text style={[commonStyles.title, { marginBottom: 4 }]}>{item.name}</Text>
                    <View style={eventStyles.eventCardDateRow}>
                        <Ionicons name="calendar-outline" size={14} color={colors.gray500} />
                        <Text style={commonStyles.date}>
                            {formatEventDate(item.race_date, t)}
                        </Text>
                    </View>
                </View>

                {/* Eye icon button - dark blue */}
                <TouchableOpacity
                    style={eventStyles.iconButtonBlue}
                    onPress={() =>
                        navigation.navigate('EventDetails', {
                            product_app_id: item.product_app_id,
                            event_name: item.name,
                            event_image: item.event_image ?? '',
                            auto_register_id: null,
                        })
                    }
                    activeOpacity={0.8}
                >
                    <Ionicons name="eye-outline" size={23} color={colors.primaryDark} />
                </TouchableOpacity>
            </TouchableOpacity>
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
                color={colors.primary}
                style={{ marginVertical: spacing.md }}
            />
        );
    }, [loadingMore]);

    const ListEmptyComponent = useCallback(
        () => (
            <ErrorScreen
                type="empty"
                title={t('event:empty.upcoming')}
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
                paddingHorizontal: spacing.md,
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

export default React.memo(UpcomingTab);