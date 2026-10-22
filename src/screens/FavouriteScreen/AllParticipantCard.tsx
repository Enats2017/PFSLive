import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, useWindowDimensions } from 'react-native';
import { isNarrowWidth } from '../../utils/screenFit';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Participant } from '../../services/participantService';
import { commonStyles, palette } from '../../styles/common.styles';
import { favstyle } from '../../styles/favourite.style';

interface AllParticipantCardProps {
    item: Participant;
    product_app_id: number; 
    isFollowed: boolean;
    isLoading: boolean;
    onToggleFollow: () => void;
    password_protected?: 0 | 1;
}

const AllParticipantCard: React.FC<AllParticipantCardProps> = React.memo(({
    item,
    isFollowed,
    isLoading,
    onToggleFollow
}) => {
    const { width } = useWindowDimensions();
    const { t } = useTranslation(['details', 'follower']);

    const fullName = useMemo(() =>
        `${item.firstname ?? ''} ${item.lastname ?? ''}`.trim() ||
        t('details:participant.unknownName'),
        [item.firstname, item.lastname, t]
    );

    return (
        <View style={favstyle.participantcard}>
            {/* bibBoxGrow: a 5-digit bib wrapped inside the fixed 46x46 circle
                from x1.1 larger text; the circle now grows into a pill. */}
            <View style={[favstyle.bibBox, favstyle.bibBoxLime, favstyle.bibBoxGrow]}>
                {/* `primaryButtonText` is WHITE - on `bibBox`'s light fill the
                    bib number was invisible. `bibBoxText` was defined for this
                    and never wired up. */}
                <Text style={favstyle.bibBoxText}>{item.bib_number}</Text>
            </View>
            <View style={favstyle.content}>
                {/* Long names wrap inside the card instead of running into the
                    add button (review request).
                    15pt athlete-name style (was commonStyles.title, 20pt): in
                    ~131pt at 320pt "Vandenberghe" (153pt at 20) broke mid-word. */}
                {/* verify pass: 20pt title from 360pt as before; 15pt only below 360pt */}
                <Text numberOfLines={2} style={isNarrowWidth(width) ? favstyle.runnerName : commonStyles.title}>
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
                    <ActivityIndicator size="small" color={palette.navy} />
                ) : isFollowed ? (
                    <Ionicons name="checkmark" size={22} color={palette.navy} />
                ) : (
                    <Ionicons name="add" size={22} color={palette.placeholder} />
                )}
            </TouchableOpacity>
        </View>
    );
}, (prevProps, nextProps) => {
    return (
        prevProps.item.participant_app_id === nextProps.item.participant_app_id &&
        prevProps.item.bib_number === nextProps.item.bib_number &&
        prevProps.isFollowed === nextProps.isFollowed &&
        prevProps.isLoading === nextProps.isLoading &&
        prevProps.password_protected === nextProps.password_protected
    );
});

AllParticipantCard.displayName = 'AllParticipantCard';

export default AllParticipantCard;