import React, { useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    FlatList,
    ActivityIndicator,
    StyleSheet,
    useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { profileListLandscapeHeight } from '../../utils/screenFit';
import { Ionicons } from '@expo/vector-icons';
import { commonStyles, spacing, palette } from '../../styles/common.styles';
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
    // ✅ Landscape (device test 2026-10-23): the list's height was measured once
    // from what was left under the profile card — ~0 when opened in landscape,
    // and kept after rotating. Landscape: the visible area under the header
    // (scroll the card away, the list fills the screen); portrait: measured,
    // and only in portrait, as before.
    const { width: winW, height: winH } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const isLandscape = winW > winH;
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

    // ✅ Real deps (layout audit 2026-10-22): [] froze the first render's
    // profile / onDeleteEvent, so isOwnProfile and the delete handler went stale.
    ), [profile?.is_own_profile, onDeleteEvent]);

    const keyExtractor = useCallback(
        (item: AthleteEvent, index: number) => `${item.participant_app_id}-${index}`,
        []
    );

    const ListFooterComponent = useCallback(() => {
        if (!loadingMoreLive) return null;
        return (
            <ActivityIndicator
                size="small"
                color={palette.navy}
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
    ), [t]);   // ✅ t: the empty-state copy follows a language change


    return (
        <View
            style={{ flex: 1 }}
            onLayout={(e) => {
                if (listHeight === 0 && !isLandscape) {
                    setListHeight(e.nativeEvent.layout.height);
                }
            }}
        >
            <TouchableOpacity style={ownProfile.backRow} onPress={onBack} activeOpacity={0.7}>
                <Ionicons name="arrow-back" size={22} color={palette.ink} />
                <Text style={ownProfile.backLabel}>{t('ownProfile:backbtn.training')}</Text>
            </TouchableOpacity>

            {isOwnProfile && (
                <TouchableOpacity
                    style={ownProfile.createBtn}
                    onPress={handleCreatePersonalEvent}
                    activeOpacity={0.85}
                >
                    <Ionicons name="add-circle-outline" size={20} color={palette.ink} />
                    <Text style={ownProfile.createBtnText}>{t('ownProfile:training.create')}</Text>
                </TouchableOpacity>
            )}

            <View style={isLandscape
                ? { height: profileListLandscapeHeight(winH, insets.top, insets.bottom) }
                : { flex: 1, height: listHeight }}>
                <FlatList
                    data={liveEvents}
                    keyExtractor={keyExtractor}
                    renderItem={renderItem}
                    onEndReached={handleLoadMore}
                    onEndReachedThreshold={0.5}
                    showsVerticalScrollIndicator={false}
                    nestedScrollEnabled={true}
                
                    contentContainerStyle={{
                        paddingHorizontal: spacing.xl,
                        paddingTop: spacing.xs,
                        // landscape: 16, not the 90pt nav-bar pad (a blank band on a ~280pt list)
                        paddingBottom: isLandscape ? spacing.lg : spacing.xxxxl,
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