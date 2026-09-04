import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { ParticipantItem } from '../../services/followerEvent';
import { commonStyles, spacing, palette } from '../../styles/common.styles';
import { detailsStyles } from '../../styles/details.styles';
import { follow } from '../../styles/followerScreen.styles';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';

interface FanEventCardProps {
    /**
     * Which artboard this row follows. The deck draws ONE inline action per
     * row, and a different one per screen:
     *   'search'    17_AthleteSearch.png     - Follow (navy) / Following (fill)
     *   'favourite' 19_FavouriteAthletes.png - Remove (red outline)
     * The old shared "View profile + Follow" pair appears on neither. Profiles
     * are still reachable from the participant list, the fan hub and the
     * followers list.
     */
    variant: 'search' | 'favourite';
    item: ParticipantItem;
    isFollowed: boolean;
    isLoading: boolean;
    onToggleFollow: () => void;
    password_protected?: 0 | 1;
}

const FanEventCard: React.FC<FanEventCardProps> = ({
    variant,
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

                {variant === 'favourite' && (
                    // 19_FavouriteAthletes.png - one destructive action, in red.
                    <TouchableOpacity
                        style={[follow.removeChip, { opacity: isLoading ? 0.6 : 1 }]}
                        onPress={onToggleFollow}
                        disabled={isLoading}
                        activeOpacity={0.8}
                        accessibilityRole="button"
                    >
                        {isLoading ? (
                            <ActivityIndicator size="small" color={palette.danger} />
                        ) : (
                            <Text style={follow.removeChipText}>
                                {t('follower:button.remove')}
                            </Text>
                        )}
                    </TouchableOpacity>
                )}
            </View>

            {variant === 'search' && (
                /* 17_AthleteSearch.png draws a single inline Follow chip, which
                   leaves no room for the View button the 2026-09-04 review asks
                   for: avatar + two chips left about 68pt for the name. So the
                   search row uses the deck's OTHER two-action pattern, the one
                   22_ParticipantList uses - identity on top, actions on their
                   own row - and the name gets the full card width. */
                <View style={detailsStyles.cardActionRow}>
                    <TouchableOpacity
                        style={detailsStyles.cardActionSecondary}
                        activeOpacity={0.8}
                        accessibilityRole="button"
                        onPress={() =>
                            navigation.navigate('ProfileScreen', {
                                customer_app_id: item.customer_app_id,
                            })
                        }
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
                        accessibilityRole="button"
                    >
                        {isLoading ? (
                            <ActivityIndicator size="small" color={palette.surface} />
                        ) : (
                            <Text style={detailsStyles.cardActionPrimaryText}>
                                {isFollowed
                                    ? t('follower:button.following')
                                    : item?.password_protected === 1
                                        ? `🔒 ${t('follower:button.follower')}`
                                        : t('follower:button.follower')}
                            </Text>
                        )}
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
};

export default FanEventCard;