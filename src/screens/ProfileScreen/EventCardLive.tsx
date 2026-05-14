import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import { AthleteEvent } from '../../services/athleteProfileService';
import { commonStyles, spacing, colors } from '../../styles/common.styles';
import { profileStyles } from '../../styles/Profile.styles';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'EditPersonalEvent'>;

export const EventCard = React.memo(({ item, isOwnProfile = true }: {
    item: AthleteEvent;
    isOwnProfile?: boolean;
}) => {
    const { t } = useTranslation(['profile']);
    const navigation = useNavigation<NavigationProp>();

    // ── Navigation handlers ─────────────────────────────────────

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

    // ── Label helpers ───────────────────────────────────────────

    const editLabel = item.event_source === 'custom'
        ? t('profile:buttons.edit_personal_event')
        : t('profile:buttons.edit_live_tracking_event');

    const trackingLabel = useCallback((): string => {
        switch (item.race_status) {
            case 'in_progress': return t('profile:buttons.live_tracking_progress');
            case 'not_started': return t('profile:buttons.live_tracking_soon');
            case 'finished':    return t('profile:buttons.live_tracking_ended');
            default:             return t('profile:buttons.live_tracking_soon');
        }
    }, [item.race_status, t]);

    const isTrackingDisabled = item.race_status === 'finished';

    // ── Render ──────────────────────────────────────────────────

    return (
        <View style={[commonStyles.card, profileStyles.eventCard]}>
            <View style={profileStyles.textsection}>
                <Text style={commonStyles.title}>{item.name}</Text>
                <Text style={commonStyles.text}>
                    {item.race_date_formatted} {item.race_time?.slice(0, 5)}
                </Text>
            </View>

            {isOwnProfile ? (
                // ── Two buttons side by side ──
                <View style={styles.buttonRow}>
                    <TouchableOpacity
                        style={[commonStyles.primaryButton, styles.halfButton, { borderRadius: 0 }]}
                        onPress={handleEditPress}
                        activeOpacity={0.8}
                    >
                        <Text style={commonStyles.primaryButtonText}>{editLabel}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[
                            commonStyles.primaryButton,
                            styles.halfButton,
                            styles.trackingButton,
                            { borderRadius: 0 },
                            isTrackingDisabled && styles.disabledButton,
                        ]}
                        onPress={isTrackingDisabled ? undefined : handleTrackingPress}
                        activeOpacity={isTrackingDisabled ? 1 : 0.8}
                        disabled={isTrackingDisabled}
                    >
                        <Text style={commonStyles.primaryButtonText}>{trackingLabel()}</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                // ── Single button (not own profile) ──
                <TouchableOpacity
                    style={[
                        commonStyles.primaryButton,
                        { borderRadius: 0 },
                        isTrackingDisabled && styles.disabledButton,
                    ]}
                    onPress={isTrackingDisabled ? undefined : handleTrackingPress}
                    activeOpacity={isTrackingDisabled ? 1 : 0.8}
                    disabled={isTrackingDisabled}
                >
                    <Text style={commonStyles.primaryButtonText}>{trackingLabel()}</Text>
                </TouchableOpacity>
            )}
        </View>
    );
});

EventCard.displayName = 'EventCard';

const styles = StyleSheet.create({
    buttonRow: {
        flexDirection: 'row',
    },
    halfButton: {
        flex: 1,
    },
    trackingButton: {
        backgroundColor: colors.primary ?? colors.primary,
        borderLeftWidth: 1,
        borderLeftColor: colors.white ?? '#fff',
    },
    disabledButton: {
        opacity: 0.5,
    },
});