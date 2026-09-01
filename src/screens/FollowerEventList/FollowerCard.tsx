import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { ParticipantItem } from '../../services/followerEvent';
import { commonStyles, spacing, palette } from '../../styles/common.styles';
import { detailsStyles } from '../../styles/details.styles';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { analyticsService } from '../../services/analyticsService';
import { ANALYTICS_SCREENS, ANALYTICS_BUTTONS, ANALYTICS_PARAMS } from '../../constants/analyticsScreens';

interface FanEventCardProps {
    /**
     * Which screen this card is rendered on. Required: the card is shared by
     * the athlete-search screen and the user's own favourites list, and it used
     * to hardcode PARTICIPANT_LIST — so ui_screen conflated three unrelated
     * screens, one of which (the in-event participant list) genuinely uses that
     * value. Same prop pattern as the ResultList cards.
     */
    analyticsScreenName: string;
    item: ParticipantItem;
    isFollowed: boolean;
    isLoading: boolean;
    onToggleFollow: () => void;
    password_protected?: 0 | 1;
}

const FanEventCard: React.FC<FanEventCardProps> = ({
    analyticsScreenName,
    item,
    isFollowed,
    isLoading,
    onToggleFollow,
}) => {
    const { t } = useTranslation(['follower', 'common']);
    const navigation = useNavigation<any>();
    const [avatarLoading, setAvatarLoading] = useState(true);

    const fullName = useMemo(() =>
        `${item.firstname} ${item.lastname}`.trim(),
        [item.firstname, item.lastname]
    );

    const initials = useMemo(() =>
        [item.firstname?.[0], item.lastname?.[0]]
            .filter(Boolean)
            .join('')
            .toUpperCase() || '?',
        [item.firstname, item.lastname]
    );

    const profileImageUri = useMemo(() =>
        item.profile_picture && item.profile_picture.trim() !== ''
            ? (item.profile_picture)
            : null,
        [item.profile_picture]
    );

    const flagImageUri = useMemo(() =>
        item.flag_url && item.flag_url.trim() !== ''
            ? (item.flag_url)
            : null,
        [item.flag_url]
    );

    useEffect(() => {
        setAvatarLoading(true);
    }, [profileImageUri]);

    return (
        <View
            style={[
                commonStyles.card,
                commonStyles.cardAccent,
                { padding: 0, marginTop: spacing.md },
            ]}
        >
            <View style={detailsStyles.topRow}>
                <View style={detailsStyles.avatar}>
                    {profileImageUri ? (
                        <>
                            <Image
                                source={{ uri: profileImageUri }}
                                cachePolicy="memory-disk"
                                style={detailsStyles.avatarImage}
                                contentFit="cover"
                                onLoad={() => setAvatarLoading(false)}
                                onError={() => setAvatarLoading(false)}
                            />
                            {avatarLoading && (
                                <ActivityIndicator
                                    size="small"
                                    color={palette.placeholder}
                                    style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        right: 0,
                                        bottom: 0,
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                    }}
                                />
                            )}
                        </>
                    ) : (
                        <View style={detailsStyles.avatarFallback}>
                            <Text style={detailsStyles.avatarInitials}>{initials}</Text>
                        </View>
                    )}
                </View>


                <View style={detailsStyles.info}>
                    <Text style={commonStyles.title}>{fullName}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={commonStyles.text} numberOfLines={1}>
                            {[item.city, item.country].filter(Boolean).join(' · ')}
                        </Text>
                        {flagImageUri && (
                            <>
                                <Image
                                    source={{ uri: flagImageUri }}
                                    cachePolicy="memory-disk"
                                    style={{
                                        width: 20,
                                        height: 14,
                                        borderRadius: 2,
                                    }}
                                    contentFit="cover"
                                />
                            </>
                        )}
                    </View>
                </View>
            </View>

            <View style={detailsStyles.cardActionRow}>
                <TouchableOpacity
                    style={detailsStyles.cardActionSecondary}
                    activeOpacity={0.8}
                    onPress={ async () => {
                        await analyticsService.logInteraction(
                            analyticsScreenName,
                            ANALYTICS_BUTTONS.VIEW_PROFILE,
                            'tap',
                            {
                                [ANALYTICS_PARAMS.PARTICIPANT_ID]: item.customer_app_id,
                            }
                        );
                        navigation.navigate('ProfileScreen', {
                            customer_app_id: item.customer_app_id,
                        })
                    }}
                >
                    <Text style={detailsStyles.cardActionSecondaryText}>
                        {t('follower:button.viewprofile')}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[
                        detailsStyles.cardActionPrimary,
                        { opacity: isLoading ? 0.6 : 1 },
                    ]}
                    onPress={onToggleFollow}
                    disabled={isLoading}
                    activeOpacity={0.8}
                >
                    {isLoading ? (
                        <ActivityIndicator size="small" color={palette.surface} />
                    ) : (
                        <Text style={detailsStyles.cardActionPrimaryText}>
                            {isFollowed
                                ? t('follower:button.unfollow')
                                : item?.password_protected === 1
                                    ? `🔒 ${t('follower:button.follower')}`
                                    : t('follower:button.follower')}
                        </Text>
                    )}
                </TouchableOpacity>
            </View>
        </View>
    );
};

export default FanEventCard;