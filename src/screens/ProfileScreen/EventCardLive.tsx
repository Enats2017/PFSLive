import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import { AthleteEvent } from '../../services/athleteProfileService';
import { commonStyles, spacing, colors } from '../../styles/common.styles';
import { profileStyles } from '../../styles/Profile.styles';
import { Feather, MaterialCommunityIcons,Ionicons} from '@expo/vector-icons';
import { formatClockTime } from '../../utils/timeFormat';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'EditPersonalEvent'>;

export const EventCard = React.memo(({ item, isOwnProfile = true }: {
    item: AthleteEvent;
    isOwnProfile?: boolean;
}) => {
    const { t } = useTranslation(['profile']);
    const navigation = useNavigation<NavigationProp>();

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
        <View style={[commonStyles.card, { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }]}>
            <View style={styles.info}>
                <Text style={commonStyles.title} numberOfLines={1}>{item.name}</Text>
                <View style={styles.dateRow}>
                    <MaterialCommunityIcons name="calendar-month-outline" size={13} color="#888" style={{ marginRight: 4 }} />
                    <Text style={commonStyles.date}>
                        {item.race_date_formatted} {formatClockTime(item.race_time)}
                    </Text>
                </View>
            </View>

            {isOwnProfile ? (
                <View style = {{flexDirection:'row', alignItems:'center', gap:6}}>
                    <TouchableOpacity
                        style={[styles.iconBtn, isEditDisabled && styles.disabledBtn]}
                        onPress={isEditDisabled ? undefined : handleEditPress}
                        activeOpacity={isEditDisabled ? 1 : 0.8}
                        disabled={isEditDisabled}
                    >
                    <Ionicons name="pencil-outline" size={23} color={colors.primaryDark} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.iconBtn}
                        onPress={handleTrackingPress}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="eye-outline" size={23} color={colors.primaryDark} />
                    </TouchableOpacity>
                </View>
            ) : (
                <TouchableOpacity
                    style={styles.iconBtn}
                    onPress={handleTrackingPress}
                    activeOpacity={0.8}
                >
                    <Feather name="eye" size={16} color="#fff" />
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
        backgroundColor: colors.themeiColor,
        borderRadius: 8,
        width: 45,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    disabledBtn: {
        opacity: 0.4,
    },
});