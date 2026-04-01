import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import { commonStyles } from '../../styles/common.styles';
import { profileStyles } from '../../styles/Profile.styles';
import { AthleteEvent } from '../../services/athleteProfileService';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface EventCardPastProps {
    item: AthleteEvent;
    isOwnProfile?: boolean;  // ← add
}

const EventCardPast = React.memo(({ item, isOwnProfile = true }: EventCardPastProps) => {
    const { t } = useTranslation(['profile']);
    const navigation = useNavigation<NavigationProp>();

    const handlePress = useCallback(() => {
        if (isOwnProfile) {
            // own profile → results screen
            navigation.navigate('LiveTracking', {
                product_app_id: item.id,
                event_name: item.name,
                event_source: item.event_source,
                sourceScreen: 'FollowerDistanceScreen',
                sectionType: 'follower',
                sourceTab: 'past'
            });
            return;
        } else {
            navigation.navigate('LiveTracking', {
                product_app_id: item.id,
                event_name: item.name,
                event_source: item.event_source,
                sourceScreen: 'FollowerDistanceScreen',
                sectionType: 'follower',
                sourceTab: 'past'
            });
        }
    }, [item, isOwnProfile, navigation]);

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
                <Text style={commonStyles.primaryButtonText}>
                    {t('profile:past.view_results')}
                </Text>
            </TouchableOpacity>
        </View>
    );
});

EventCardPast.displayName = 'EventCardPast';

export default EventCardPast;