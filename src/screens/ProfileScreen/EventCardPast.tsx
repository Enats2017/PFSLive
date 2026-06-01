import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import { colors, commonStyles, spacing } from '../../styles/common.styles';
import { profileStyles } from '../../styles/Profile.styles';
import { AthleteEvent } from '../../services/athleteProfileService';
import { Feather, MaterialCommunityIcons,Ionicons } from '@expo/vector-icons';
import { formatClockTime } from '../../utils/timeFormat';

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
        <View style={[commonStyles.card, { flexDirection: 'row', alignItems: 'center', marginBottom:spacing.md }]}>
            <View style={styles.info}>
                <Text style={[commonStyles.title, { marginBottom: spacing.sm }]} numberOfLines={1}>{item.name}</Text>
                <View style={styles.dateRow}>
                    <MaterialCommunityIcons name="calendar-month-outline" size={16} color="#888" style={{ marginRight: 4 }} />
                    <Text style={commonStyles.date}>
                        {item.race_date_formatted} {formatClockTime(item.race_time)}
                    </Text>
                </View>
            </View>

            <TouchableOpacity
                style={styles.iconButtonBlue}
                onPress={handlePress}
                activeOpacity={0.8}
            >
                <Ionicons name="bar-chart-outline" size={23} color={colors.primaryDark} />
            </TouchableOpacity>
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
   
    iconButtonBlue: {
        backgroundColor: colors.themeiColor,
        borderRadius: 8,
        width: 45,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
});

export default EventCardPast;