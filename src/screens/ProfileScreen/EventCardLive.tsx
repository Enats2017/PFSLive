
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
 /* ── Status badge ── */
 export const  StatusBadge = ({ status }: { status?: string }) => {
    const { t } = useTranslation(['profile'])
    const config: Record<string, { bg: string; dot: string; label: string }> = {
        in_progress: { bg: '#fff0ee', dot: '#e8341a', label: t('profile:status.live') },
        not_started: { bg: '#f0f4ff', dot: '#1a73e8', label: t('profile:status.soon') },
        finished: { bg: '#f4f4f4', dot: '#888', label: t('profile:status.finished') },
    }
    const c = status ? config[status] : null
    if (!c) return null
    return (
        <View style={[profileStyles.badge, { backgroundColor: c.bg }]}>
            <View style={[profileStyles.badgeDot, { backgroundColor: c.dot }]} />
            <Text style={[profileStyles.badgeText, { color: c.dot }]}>{c.label}</Text>
        </View>
    )
}

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

        // navigation.navigate('MyEventDetailsScreen', {
        //     eventId: item.id
        // })

    }

    const getButtonText = () => {
        if (item.event_source === 'custom') {
            return t('profile:buttons.edit_personal_event')
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
            <StatusBadge status={item.race_status} />
            <View style={profileStyles.textsection}>
                <Text style={commonStyles.title}>{item.name}</Text>
                <Text style={commonStyles.text}>
                    {item.race_date} {item.race_time?.slice(0, 5)}
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

