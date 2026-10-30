import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import { AthleteEvent } from '../../services/athleteProfileService';
import { commonStyles, spacing, palette, radii, space } from '../../styles/common.styles';
import { profileStyles } from '../../styles/Profile.styles';
import { Feather, MaterialCommunityIcons,Ionicons} from '@expo/vector-icons';
import { formatClockTime } from '../../utils/timeFormat';
import { formatEventDate } from '../../utils/dateFormatter';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'EditPersonalEvent'>;

/**
 * ✅ A tracked personal event loses Edit exactly as it loses Delete (developer
 * report 2026-10-30): the server's can_delete is 0 once more than 10 minutes
 * were tracked. Changing the date, time or route after that would rewrite a
 * race that already happened. Partner events keep the button (it opens the
 * event page; greyed out once finished, as before).
 */
export const showEditButton = (item: Pick<AthleteEvent, 'event_source' | 'can_delete'>): boolean =>
    item.event_source !== 'custom' || item.can_delete === 1;
interface EventCardProps {
    item: AthleteEvent;
    isOwnProfile?: boolean;
    onDelete?: (event: AthleteEvent) => void;
}

export const EventCard = React.memo(({ item, isOwnProfile = true, onDelete }: EventCardProps) => {
    const { t } = useTranslation(['profile']);
    const navigation = useNavigation<NavigationProp>();
    // ✅ Own profile: three 48pt icon buttons beside the info left it ~88pt at
    // 320pt, so the 20pt event name broke mid-word and the 2-line date lost the
    // time (layout audit 2026-10-22). The buttons go on their own row under
    // the info, bottom-right — on EVERY width (device test 2026-10-23: from
    // 400pt, in landscape and on tablets they sat beside the name, centred,
    // so cards on one screen did not line up).
    const actionsBelow = isOwnProfile;


    const handleEditPress = useCallback(() => {
        if (item.event_source === 'custom') {
            navigation.navigate('EditPersonalEvent', { eventId: item.id });
        } else {
            navigation.navigate('EventDetails', {
                product_app_id: item.id,
                event_name: item.name,
                auto_register_id: null,
            });
        }
    }, [item, navigation]);

    const handleTrackingPress = useCallback(() => {
        navigation.navigate('LiveTracking', {
            product_app_id: item.id,
            product_option_value_app_id: item.product_option_value_app_id,
            event_name: item.name,
            event_source: item.event_source,
            sourceScreen: isOwnProfile ? 'Profile' : 'FollowerDistanceScreen',
            sectionType: isOwnProfile ? 'default' : 'follower',
            sourceTab: 'live',
        });
    }, [item, isOwnProfile, navigation]);

    const editLabel = item.event_source === 'custom'
        ? t('profile:buttons.edit_personal_event')
        : t('profile:buttons.edit_live_tracking_event');

    const handleDeletePress = useCallback(() => {
        onDelete?.(item);
    }, [item, onDelete]);

    const canDelete = item.event_source === 'custom' && item.can_delete === 1 && !!onDelete;
    const showEdit = showEditButton(item);

    const trackingLabel = useCallback((): string => {
        switch (item.race_status) {
            case 'in_progress': return t('profile:buttons.live_tracking_progress');
            case 'not_started': return t('profile:buttons.live_tracking_soon');
            case 'finished': return t('profile:buttons.live_tracking_ended');
            default: return t('profile:buttons.live_tracking_soon');
        }
    }, [item.race_status, t]);

    const isEditDisabled = item.race_status === 'finished';

    return (
        <View style={[
            commonStyles.card,
            { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
            actionsBelow && { flexDirection: 'column', alignItems: 'stretch' },
        ]}>
            <View style={styles.info}>
                {/* no line limit (was 1): a long event name was cut with "…" (device test 2026-10-22) */}
                <Text style={commonStyles.title}>{item.name}</Text>
                <View style={styles.dateRow}>
                    <MaterialCommunityIcons name="calendar-month-outline" size={13} color={palette.textMuted} style={{ marginRight: 4 }} />
                    {/* ✅ flexShrink + numberOfLines so a long "26 August 2026 12:00 AM" ellipsises
                        instead of running under the delete/edit/view buttons. RN defaults flex
                        items to flexShrink: 0, so without this the Text keeps its intrinsic width
                        and overflows the flex:1 info column. Matches the title Text above. */}
                    <Text style={[commonStyles.date, { flexShrink: 1 }]} numberOfLines={2}>
                        {formatEventDate(item.race_date_formatted, t)} {formatClockTime(item.race_time)}
                    </Text>
                </View>
            </View>

            {isOwnProfile ? (
                <View style = {[
                    {flexDirection:'row', alignItems:'center', gap: space.sm},
                    actionsBelow && { justifyContent: 'flex-end', marginTop: space.md },
                ]}>
                    {canDelete && (
                        <TouchableOpacity
                            style={[styles.iconBtn, styles.iconBtnDanger]}
                            onPress={handleDeletePress}
                            activeOpacity={0.8}
                            accessibilityRole="button"
                        >
                            <Ionicons name="trash-outline" size={22} color={palette.danger} />
                        </TouchableOpacity>
                    )}
                    {showEdit && (
                    <TouchableOpacity
                        style={[styles.iconBtn, isEditDisabled && styles.disabledBtn]}
                        onPress={isEditDisabled ? undefined : handleEditPress}
                        activeOpacity={isEditDisabled ? 1 : 0.8}
                        disabled={isEditDisabled}
                    >
                    <Ionicons name="pencil-outline" size={22} color={palette.navy} />
                    </TouchableOpacity>
                    )}
                    <TouchableOpacity
                        style={styles.iconBtn}
                        onPress={handleTrackingPress}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="eye-outline" size={22} color={palette.navy} />
                    </TouchableOpacity>
                </View>
            ) : (
                <TouchableOpacity
                    style={styles.iconBtn}
                    onPress={handleTrackingPress}
                    activeOpacity={0.8}
                >
                    <Ionicons name="eye-outline" size={23} color={palette.ink} />
                </TouchableOpacity>
            )}
        </View>
    );
});

EventCard.displayName = 'EventCard';

const styles = StyleSheet.create({

    info: {
        flex: 1,
        justifyContent: 'center',
    },

    dateRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },

    iconBtn: {
        backgroundColor: palette.fill,
        borderRadius: radii.sm,
        width: 48,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconBtnDanger: {
        backgroundColor: palette.dangerBg,
    },
    disabledBtn: {
        opacity: 0.4,
    },
});