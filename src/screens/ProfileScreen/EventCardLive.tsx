
import { useNavigation } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { RootStackParamList } from '../../types/navigation'
import { AthleteEvent } from '../../services/athleteProfileService'
import { commonStyles } from '../../styles/common.styles'
import { profileStyles } from '../../styles/Profile.styles'
import { View, Text, TouchableOpacity } from 'react-native'
type NavigationProp = NativeStackNavigationProp<
    RootStackParamList,
    'EditPersonalEvent'
>


export const EventCard = ({ item }: { item: AthleteEvent }) => {
    const { t } = useTranslation(['profile'])
    const navigation = useNavigation<NavigationProp>()
    console.log(item?.id);
    const handlePress = () => {
        if (item.event_source === 'custom') {
            navigation.navigate('EditPersonalEvent', {
                eventId: item.id
            })
            return
        }

        navigation.navigate('EventDetails', {
            product_app_id: item.id,
            event_name: item.name,
            auto_register_id: null
        })

    }

    const getButtonText = () => {
        if (item.event_source === 'custom') {
            return t('profile:buttons.edit_personal_event')
        }
        if (item.event_source === 'partner') {
            return t('profile:buttons.edit_live_peronal_event')
        }

        if (item.race_status === 'in_progress') {
            return t('profile:buttons.live_tracking_progress')
        }
        if (item.race_status == 'not_started') {
            return t('profile:buttons.live_tracking_soon')
        }
        return t('profile:buttons.enable_gps')
    }

    return (
        <View style={[commonStyles.card, profileStyles.eventCard]}>
            <View style={profileStyles.textsection}>
                <Text style={commonStyles.title}>{item.name}</Text>
                <Text style={commonStyles.text}>
                    {item.race_date_formatted} {item.race_time?.slice(0, 5)}
                </Text>
            </View>
            <TouchableOpacity
                style={commonStyles.primaryButton}
                onPress={handlePress}
            >
                <Text style={commonStyles.primaryButtonText}>
                    {getButtonText()}
                </Text>

            </TouchableOpacity>

        </View>

    )
}

