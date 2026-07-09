import React, { useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    FlatList,
    ActivityIndicator,
    StyleSheet,
    Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, commonStyles, spacing } from '../../styles/common.styles';
import { AthleteEvent, AthleteProfile } from '../../services/athleteProfileService';
import { EventCard } from './EventCardLive';
import { ownProfile } from '../../styles/ownProfile.styles';
import ErrorScreen from '../../components/ErrorScreen';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';

interface TrainingContentProps {
    onBack: () => void;
    liveEvents: AthleteEvent[];
    loadMoreLive: () => void;
    loadingMoreLive: boolean;
    profile: AthleteProfile | null;
    pagination: {
        live: { page: number; total_pages: number };
    };
    onDeleteEvent: (event: AthleteEvent) => void;
}
const { width, height } = Dimensions.get('window');
const TAB_CONTENT_HEIGHT = height * 0.56;

const TrainingContent: React.FC<TrainingContentProps> = ({
    onBack,
    liveEvents,
    loadMoreLive,
    loadingMoreLive,
    pagination,
    profile,
    onDeleteEvent,
}) => {
    const hasMore = pagination.live.page < pagination.live.total_pages;
    const { t } = useTranslation(['profile', "ownProfile"]);
    const [listHeight, setListHeight] = React.useState(0);
    // Add this line before the return

    const navigation = useNavigation();

    // Only the profile owner can create a personal event (matches the edit/own-profile gating).
    const isOwnProfile = profile?.is_own_profile === 1;

    const handleCreatePersonalEvent = useCallback(() => {
        navigation.navigate('PersonalEvent' as never);
    }, [navigation]);

    const handleLoadMore = useCallback(() => {
      
        if (hasMore && !loadingMoreLive) {
            loadMoreLive();
        }
    }, [hasMore, loadingMoreLive, loadMoreLive, pagination.live.page, pagination.live.total_pages,]);

    const renderItem = useCallback(({ item }: { item: AthleteEvent }) => (
        <EventCard
            item={item}
            isOwnProfile={profile?.is_own_profile === 1}
            onDelete={onDeleteEvent}
        />

    ), []);

    const keyExtractor = useCallback(
        (item: AthleteEvent, index: number) => `${item.participant_app_id}-${index}`,
        []
    );

    const ListFooterComponent = useCallback(() => {
        if (!loadingMoreLive) return null;
        return (
            <ActivityIndicator
                size="small"
                color={colors.primary}
                style={{ marginVertical: spacing.md }}
            />
        );
    }, [loadingMoreLive]);

    const ListEmptyComponent = useCallback(() => (
        <ErrorScreen
            type="empty"
            title={t('profile:empty.no_live_events')}
            message={t('profile:empty.no_live_events_msg')}
            onRetry={() => { }}
        />
    ), []);


    return (
        <View
            style={{ flex: 1 }}
            onLayout={(e) => {
                if (listHeight === 0) {
                    setListHeight(e.nativeEvent.layout.height);
                }
            }}
        >
            <TouchableOpacity style={ownProfile.backRow} onPress={onBack} activeOpacity={0.7}>
                <Ionicons name="arrow-back" size={22} color={colors.gray900} />
                <Text style={ownProfile.backLabel}>{t('ownProfile:backbtn.training')}</Text>
            </TouchableOpacity>

            {isOwnProfile && (
                <TouchableOpacity
                    style={ownProfile.createBtn}
                    onPress={handleCreatePersonalEvent}
                    activeOpacity={0.85}
                >
                    <Ionicons name="add-circle-outline" size={20} color={colors.gray900} />
                    <Text style={ownProfile.createBtnText}>{t('ownProfile:training.create')}</Text>
                </TouchableOpacity>
            )}

            <View style={{ flex: 1, height: listHeight }}>
                <FlatList
                    data={liveEvents}
                    keyExtractor={keyExtractor}
                    renderItem={renderItem}
                    onEndReached={handleLoadMore}
                    onEndReachedThreshold={0.5}
                    showsVerticalScrollIndicator={false}
                    nestedScrollEnabled={true}
                
                    contentContainerStyle={{
                        paddingHorizontal: spacing.md,
                        paddingTop: spacing.xs,
                        paddingBottom: spacing.xxxxl,
                        flexGrow: 1,
                    }}
                    ListFooterComponent={ListFooterComponent}
                    ListEmptyComponent={ListEmptyComponent}
                    removeClippedSubviews={false}
                />
            </View>

        </View>
    );
};



export default React.memo(TrainingContent);