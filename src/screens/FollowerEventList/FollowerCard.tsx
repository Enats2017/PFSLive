import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { ParticipantItem } from '../../services/followerEvent';
import { commonStyles, spacing } from '../../styles/common.styles';
import { detailsStyles } from '../../styles/details.styles';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { getImageUrl } from '../../constants/config'; // ✅ ADD THIS IMPORT

interface FanEventCardProps {
    item: ParticipantItem;
    isFollowed: boolean;
    isFollowLoading: boolean;
    onToggleFollow: () => void;
}

const FanEventCard: React.FC<FanEventCardProps> = ({
    item,
    isFollowed,
    isFollowLoading,
    onToggleFollow,
}) => {
    const { t } = useTranslation(['follower', 'common']);
    const navigation = useNavigation<any>();

    // ✅ FULL NAME
    const fullName = `${item.firstname} ${item.lastname}`.trim();

    // ✅ ADD: INITIALS FOR FALLBACK
    const initials = useMemo(() =>
        [item.firstname?.[0], item.lastname?.[0]]
            .filter(Boolean)
            .join('')
            .toUpperCase() || '?',
        [item.firstname, item.lastname]
    );

    // ✅ ADD: PROFILE IMAGE URI
    const profileImageUri = useMemo(() =>
        item.profile_picture && item.profile_picture.trim() !== ''
            ? getImageUrl(item.profile_picture)
            : null,
        [item.profile_picture]
    );

    return (
        <View
            style={[
                commonStyles.card,
                { padding: 0, overflow: 'hidden', marginBottom: spacing.lg },
            ]}
        >
            <View style={detailsStyles.topRow}>
                {/* ✅ UPDATED: AVATAR WITH PROFILE PICTURE SUPPORT */}
                <View style={detailsStyles.avatar}>
                    {profileImageUri ? (
                        <Image
                            source={{ uri: profileImageUri }}
                            style={detailsStyles.avatarImage}
                            resizeMode="cover"
                        />
                    ) : (
                        <View style={detailsStyles.avatarFallback}>
                            <Text style={detailsStyles.avatarInitials}>{initials}</Text>
                        </View>
                    )}
                </View>

                <LinearGradient
                    colors={['#e8341a', '#f4a100', '#1a73e8']}
                    start={{ x: 0, y: 1 }}
                    end={{ x: 1, y: 0 }}
                    style={detailsStyles.divider}
                />

                <View style={detailsStyles.info}>
                    <Text style={commonStyles.title}>{fullName}</Text>
                    <Text style={commonStyles.text}>
                        {item.city} | {item.country}
                    </Text>
                </View>
            </View>

            {/* BUTTONS ROW */}
            <View style={{ flexDirection: 'row', gap: 6 }}>
                <TouchableOpacity
                    style={[commonStyles.favoriteButton, { borderRadius: 0 }]}
                    activeOpacity={0.8}
                    onPress={() =>
                        navigation.navigate('ProfileScreen', {
                            customer_app_id: item.customer_app_id,
                        })
                    }
                >
                    <Text style={commonStyles.primaryButtonText}>
                        {t('follower:button.viewprofile')}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[
                        commonStyles.livetracking,
                        { 
                            borderRadius: 0,
                            opacity: isFollowLoading ? 0.6 : 1,
                        },
                    ]}
                    onPress={onToggleFollow}
                    disabled={isFollowLoading}
                    activeOpacity={0.8}
                >
                    {isFollowLoading ? (
                        <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                        <Text style={commonStyles.primaryButtonText}>
                            {isFollowed
                                ? t('follower:button.unfollow')
                                : t('follower:button.follower')}
                        </Text>
                    )}
                </TouchableOpacity>
            </View>
        </View>
    );
};

// ✅ KEEP AS IS - DEFAULT EXPORT (NO MEMO)
export default FanEventCard;