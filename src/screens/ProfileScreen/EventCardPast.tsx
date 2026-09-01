import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import { commonStyles, spacing, palette, radii, fonts } from '../../styles/common.styles';
import { profileStyles } from '../../styles/Profile.styles';
import { AthleteEvent } from '../../services/athleteProfileService';
import { Feather, MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { formatClockTime } from '../../utils/timeFormat';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface EventCardPastProps {
    item: AthleteEvent;
    isOwnProfile?: boolean;  // ← add
}

const EventCardPast = React.memo(({ item, isOwnProfile = true }: EventCardPastProps) => {
    const { t } = useTranslation(['profile', 'ownProfile']);
    const navigation = useNavigation<NavigationProp>();

    const canShowResultButton = useCallback(() => {
        return item.race_result_status === 1 && !!item.race_result_api_url;
    }, [item.race_result_status, item.race_result_api_url]);

    const handlePress = useCallback(() => {
        if (isOwnProfile) {
            navigation.navigate('ResultDetails', {
                product_app_id: Number(item.product_app_id),
                product_option_value_app_id: Number(item.product_option_value_app_id),
                bib: (item.bib_number),
                raceStatus: 'finished',
                from_live: 0,
            });
            return;
        } else {
            navigation.navigate('ResultDetails', {
                product_app_id: Number(item.product_app_id),
                product_option_value_app_id: Number(item.product_option_value_app_id),
                bib: item.bib_number,
                raceStatus: 'finished',
                from_live: 0,
            });
            // navigation.navigate('LiveTracking', {
            //     product_app_id: item.id,
            //     event_name: item.name,
            //     event_source: item.event_source,
            //     sourceScreen: 'FollowerDistanceScreen',
            //     sectionType: 'follower',
            //     sourceTab: 'past'
            // });
        }
    }, [item, isOwnProfile, navigation]);

    return (
        <View style={[commonStyles.card, { marginBottom: spacing.md }]}>
            <View style={styles.info}>
                <Text style={[commonStyles.title, { marginBottom: spacing.sm }]} numberOfLines={1}>{item.name}</Text>
                <View style={styles.dateRow}>
                    <MaterialCommunityIcons name="calendar-month-outline" size={16} color={palette.textMuted} style={{ marginRight: 4 }} />
                    {/* ✅ Same overflow guard as EventCardLive — see the note there. */}
                    <Text style={[commonStyles.date, { flexShrink: 1 }]} numberOfLines={1}>
                        {item.race_date_formatted} {formatClockTime(item.race_time)}
                    </Text>
                </View>
            </View>

            {canShowResultButton() && (
                <TouchableOpacity
                    style={styles.resultButton}
                    onPress={handlePress}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                >
                    <Text style={styles.resultButtonText}>{t('ownProfile:events.viewResult')}</Text>
                </TouchableOpacity>
            )}
        </View>
    );
});

EventCardPast.displayName = 'EventCardPast';

const styles = StyleSheet.create({
    info: {
        flex: 1,
        justifyContent: 'center',
    },

    dateRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },

    resultButton: {
        marginTop: spacing.md,
        minHeight: 48,
        borderRadius: radii.md,
        borderWidth: 1.5,
        borderColor: palette.navy,
        backgroundColor: palette.surface,
        alignItems: 'center',
        justifyContent: 'center',
    },
    resultButtonText: {
        fontFamily: fonts.display,
        fontSize: 13,
        color: palette.navy,
    },
});

export default EventCardPast;