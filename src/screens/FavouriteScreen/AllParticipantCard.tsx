import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Participant } from '../../services/participantService';
import { colors, commonStyles } from '../../styles/common.styles';
import { favstyle } from '../../styles/favourite.style';

interface AllParticipantCardProps {
    item: Participant;
    product_app_id: number; 
    isFollowed: boolean;
    isLoading: boolean;
    onToggleFollow: () => void;
}

const AllParticipantCard: React.FC<AllParticipantCardProps> = React.memo(({
    item,
    isFollowed,
    isLoading,
    onToggleFollow
}) => {
    const { t } = useTranslation(['details', 'follower']);

    const fullName = useMemo(() =>
        `${item.firstname ?? ''} ${item.lastname ?? ''}`.trim() ||
        t('details:participant.unknownName'),
        [item.firstname, item.lastname, t]
    );

    return (
        <View style={favstyle.participantcard}>
            <View style={favstyle.bibBox}>
                <Text style={commonStyles.primaryButtonText}>{item.bib_number}</Text>
            </View>
            <View style={favstyle.content}>
                <Text numberOfLines={1} style={commonStyles.title}>
                    {fullName}
                </Text>
                <Text style={commonStyles.subtitle}>{item.race_distance}</Text>
            </View>
            <TouchableOpacity
                style={[
                    favstyle.addBtn,
                    isFollowed && favstyle.addBtnActive
                ]}
                activeOpacity={0.8}
                onPress={onToggleFollow}
                disabled={isLoading}
            >
                {isLoading ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                ) : isFollowed ? (
                    <Ionicons name="checkmark" size={22} color={colors.primary} />
                ) : (
                    <Ionicons name="add" size={22} color="#999" />
                )}
            </TouchableOpacity>
        </View>
    );
}, (prevProps, nextProps) => {
    return (
        prevProps.item.participant_app_id === nextProps.item.participant_app_id &&
        prevProps.item.bib_number === nextProps.item.bib_number &&
        prevProps.isFollowed === nextProps.isFollowed &&
        prevProps.isLoading === nextProps.isLoading
    );
});

AllParticipantCard.displayName = 'AllParticipantCard';

export default AllParticipantCard;