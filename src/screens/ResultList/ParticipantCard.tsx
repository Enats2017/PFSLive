import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Participant } from '../../services/participantService';
import { colors, commonStyles } from '../../styles/common.styles';
import { favstyle } from '../../styles/favourite.style';
import Entypo from '@expo/vector-icons/Entypo';
import { useNavigation } from '@react-navigation/native';

interface ParticipantCardProps {
    item: Participant;
    product_app_id: number;
    product_option_value_app_id: number; // ✅ required — callers pass ?? 0
    raceStatus?: 'finished' | 'in_progress' | 'not_started';
}

const ParticipantCard: React.FC<ParticipantCardProps> = React.memo(({
    item,
    product_app_id,
    product_option_value_app_id,
    raceStatus,
}) => {
    const { t } = useTranslation(['details']);
    const navigation = useNavigation<any>();

    const fullName = useMemo(() =>
        `${item.firstname ?? ''} ${item.lastname ?? ''}`.trim() ||
        t('details:participant.unknownName'),
        [item.firstname, item.lastname, t]
    );

    const handlePress = () => {
        navigation.navigate('ResultDetails', {
            product_app_id,
            product_option_value_app_id,
            bib: item.bib_number,
            from_live: 0,
            raceStatus,
        });
    };

    return (
        <TouchableOpacity style={favstyle.participantcard} onPress={handlePress}>
            <View style={favstyle.bibBox}>
                <Text style={commonStyles.primaryButtonText}>{item.bib_number}</Text>
            </View>
            <View style={favstyle.content}>
                <Text numberOfLines={1} style={commonStyles.title}>
                    {fullName}
                </Text>
                <Text style={commonStyles.subtitle}>{item.race_distance}</Text>
            </View>
            {/* ✅ View not TouchableOpacity — chevron is non-interactive */}
            <View style={favstyle.righticon}>
                <Entypo name="chevron-right" size={30} color={colors.gray500} />
            </View>
        </TouchableOpacity>
    );
}, (prevProps, nextProps) =>
    prevProps.item.participant_app_id === nextProps.item.participant_app_id &&
    prevProps.item.bib_number === nextProps.item.bib_number
);

ParticipantCard.displayName = 'ParticipantCard';

export default ParticipantCard;