import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, useWindowDimensions } from 'react-native';
import { isNarrowWidth } from '../../utils/screenFit';
import { useTranslation } from 'react-i18next';
import { Participant } from '../../services/participantService';
import { commonStyles, palette } from '../../styles/common.styles';
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
    const { width } = useWindowDimensions();
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
                <Text style={favstyle.bibBoxText}>
                    {(fullName || '?').split(/\s+/).filter(Boolean).slice(0, 2)
                        .map((n) => n[0]).join('').toUpperCase() || '?'}
                </Text>
            </View>
            <View style={favstyle.content}>
                {/* 2 lines in the 15pt athlete-name style (was 1 line of the 20pt
                    commonStyles.title): ~131pt at 320pt cut most full names to
                    "…". Same as AllParticipantCard. */}
                {/* verify pass: 20pt title from 360pt as before; 15pt only below 360pt */}
                <Text numberOfLines={2} style={isNarrowWidth(width) ? favstyle.runnerName : commonStyles.title}>
                    {fullName}
                </Text>
                {/* 2 lines (was 1): a long distance name pushed off the end */}
                <Text style={favstyle.participantMeta} numberOfLines={2}>
                    {[
                        item.bib_number ? `${t('details:tracking.bib')} ${item.bib_number}` : null,
                        item.race_distance,
                    ].filter(Boolean).join(' · ')}
                </Text>
            </View>
            {/* ✅ View not TouchableOpacity — chevron is non-interactive */}
            <View style={favstyle.righticon}>
                <Entypo name="chevron-right" size={30} color={palette.textMuted} />
            </View>
        </TouchableOpacity>
    );
}, (prevProps, nextProps) =>
    prevProps.item.participant_app_id === nextProps.item.participant_app_id &&
    prevProps.item.bib_number === nextProps.item.bib_number
);

ParticipantCard.displayName = 'ParticipantCard';

export default ParticipantCard;