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
     * Which screen this row is on. Both variants show View plus a second
     * action; only the second differs:
     *   'search'    17_AthleteSearch.png     - View + Follow / Following
     *   'favourite' 19_FavouriteAthletes.png - View + Remove (red)
     *
     * Both artboards draw a SINGLE inline chip, but the 2026-09-04 reviews
     * asked for View on both screens, and three controls beside a 60pt avatar
     * leave about 68pt for the name. So both use the deck's other two-action
     * pattern instead (22_ParticipantList.png): identity on top, buttons on
     * their own row. This is a deliberate departure from those two artboards.
     */
    variant: 'search' | 'favourite';
    item: ParticipantItem;
    isFollowed: boolean;
    isLoading: boolean;
    onToggleFollow: () => void;
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
                        {/* City + country is one phrase: it wraps rather than being cut. */}
                        <Text style={commonStyles.text} numberOfLines={2}>
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

            {/* Both variants carry two actions, so both use the deck's
                two-action pattern (22_ParticipantList.png): identity on top,
                buttons on their own row. Inline chips do not fit - avatar plus
                two of them left about 68pt for the name. */}
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

                {variant === 'favourite' ? (
                    <TouchableOpacity
                        style={[detailsStyles.cardActionDanger, { opacity: isLoading ? 0.6 : 1 }]}
                        onPress={onToggleFollow}
                        disabled={isLoading}
                        activeOpacity={0.8}
                        accessibilityRole="button"
                    >
                        {isLoading ? (
                            <ActivityIndicator size="small" color={palette.danger} />
                        ) : (
                            <Text style={detailsStyles.cardActionDangerText}>
                                {t('follower:button.remove')}
                            </Text>
                        )}
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity
                        style={[detailsStyles.cardActionPrimary, { opacity: isLoading ? 0.6 : 1 }]}
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
                )}
            </View>
        </View>
    );
};

export default FanEventCard;