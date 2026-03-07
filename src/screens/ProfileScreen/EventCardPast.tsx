import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { useTranslation } from 'react-i18next'
import { commonStyles } from '../../styles/common.styles'
import { profileStyles } from '../../styles/Profile.styles'
import { AthleteEvent } from '../../services/athleteProfileService'


interface Props {
    item: AthleteEvent
}

const EventCardPast = ({ item }: Props) => {
    const { t } = useTranslation(['profile'])
    return (
        <View style={[commonStyles.card, profileStyles.eventCard]}>
            <View style={profileStyles.textsection}>
                <Text style={commonStyles.title}>{item.name}</Text>
                <Text style={commonStyles.text}>
                    {item.race_date_formatted} {item.race_time?.slice(0, 5)}
                </Text>
            </View>
            <TouchableOpacity style={commonStyles.primaryButton}>
                <Text style={commonStyles.primaryButtonText}>
                    {t('profile:past.view_results')}
                </Text>
            </TouchableOpacity>
        </View>
    )
}

export default React.memo(EventCardPast)