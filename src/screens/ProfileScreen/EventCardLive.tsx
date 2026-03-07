import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import { AthleteEvent } from '../../services/athleteProfileService';
import { commonStyles, spacing } from '../../styles/common.styles';
import { profileStyles } from '../../styles/Profile.styles';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'EditPersonalEvent'>;

export const EventCard = React.memo(({ item }: { item: AthleteEvent }) => {
    const { t } = useTranslation(['profile']);
    const navigation = useNavigation<NavigationProp>();

    const handlePress = useCallback(() => {
        if (item.event_source === 'custom') {
            navigation.navigate('EditPersonalEvent', { eventId: item.id });
            return;
        }

        navigation.navigate('EventDetails', {
            product_app_id: item.id,
            event_name: item.name,
            auto_register_id: null,
        });
    }, [item.event_source, item.id, item.name, navigation]);

    const getButtonText = useCallback(() => {
        if (item.event_source === 'custom') {
            return t('profile:buttons.edit_personal_event');
        }
        if (item.event_source === 'partner') {
            return t('profile:buttons.edit_live_tracking_event');
        }
        if (item.race_status === 'in_progress') {
            return t('profile:buttons.live_tracking_progress');
        }
        if (item.race_status === 'not_started') {
            return t('profile:buttons.live_tracking_soon');
        }
        return t('profile:buttons.enable_gps');
    }, [item.event_source, item.race_status, t]);

    return (
        <View style={[commonStyles.card, profileStyles.eventCard]}>
            <View style={profileStyles.textsection}>
                <Text style={commonStyles.title}>{item.name}</Text>
                <Text style={commonStyles.text}>
                    {item.race_date_formatted} {item.race_time?.slice(0, 5)}
                </Text>
            </View>
            <TouchableOpacity
                style={[commonStyles.primaryButton, { borderRadius: 0 }]}
                onPress={handlePress}
                activeOpacity={0.8}
            >
                <Text style={commonStyles.primaryButtonText}>{getButtonText()}</Text>
            </TouchableOpacity>
        </View>
    );
});

EventCard.displayName = 'EventCard';