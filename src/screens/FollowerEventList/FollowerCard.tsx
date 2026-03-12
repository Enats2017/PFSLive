import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { ParticipantItem } from '../../services/followerEvent';
import { commonStyles, spacing } from '../../styles/common.styles';
import { detailsStyles } from '../../styles/details.styles';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';

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

    const fullName = `${item.firstname} ${item.lastname}`.trim();

    return (
        <View
            style={[
                commonStyles.card,
                { padding: 0, overflow: 'hidden', marginBottom: spacing.lg },
            ]}
        >
            <View style={detailsStyles.topRow}>
                <View style={detailsStyles.avatar}>
                    <Ionicons
                        name="person-circle-outline"
                        size={55}
                        color="#9ca3af"
                        style={detailsStyles.logo}
                    />
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

// ✅ CRITICAL: Use default export (NOT React.memo for now to debug)
export default FanEventCard;