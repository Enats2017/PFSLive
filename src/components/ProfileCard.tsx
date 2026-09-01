import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useNavigation } from '@react-navigation/native';
import { commonStyles, spacing, palette } from '../styles/common.styles';
import { AthleteProfile } from '../services/athleteProfileService';
import { profileStyles } from '../styles/Profile.styles';
import { API_CONFIG } from '../constants/config';
import { useTranslation } from 'react-i18next';

interface ProfileCardProps {
    profile: AthleteProfile | null;
    customer_app_id: number;
    isFollowed: boolean;
    isFollowLoading: boolean;
    onToggleFollow: () => void;
    password_protected?: 0 | 1;
}

const ProfileCard: React.FC<ProfileCardProps> = React.memo(({
    profile,
    password_protected,
    customer_app_id,
    isFollowed,
    isFollowLoading,
    onToggleFollow,
}) => {
    const { t } = useTranslation(['follower', 'profile', 'ownProfile']);
    const navigation = useNavigation();

    const fullName = profile
        ? `${profile.firstname} ${profile.lastname}`
        : '';

    const isOwn = profile?.is_own_profile === 1;

    if (API_CONFIG.DEBUG) {
        console.log('ProfileCard render:', {
            customer_app_id,
            isFollowed,
            isFollowLoading,
            isOwn,
        });
    }

    return (
        <View style={profileStyles.profileCard}>
            <View style={profileStyles.identityRow}>
                <View style={profileStyles.avatarWrapper}>
                <View style={profileStyles.avatar}>
                    {profile?.profile_picture ? (
                        <Image
                            source={{ uri:(profile.profile_picture) || undefined }}
                            cachePolicy="memory-disk"
                            style={profileStyles.avatar}
                        />
                    ) : (
                        <Ionicons name="person" size={50} color={palette.textMuted} />
                    )}
                </View>
                {isOwn && (
                    <TouchableOpacity
                        style={profileStyles.editIcon}
                        onPress={() => navigation.navigate('EditProfileScreen' as never)}
                    >
                        <FontAwesome name="pencil" size={14} color={palette.surface} />
                    </TouchableOpacity>
                )}
                </View>

                <View style={profileStyles.identityText}>
                    <Text style={profileStyles.identityName} numberOfLines={1}>
                        {fullName || '—'}
                    </Text>
                    {!!(profile?.city || profile?.country) && (
                        <Text style={profileStyles.identityPlace} numberOfLines={1}>
                            {[profile?.city, profile?.country].filter(Boolean).join(' · ')}
                        </Text>
                    )}
                    <Text style={profileStyles.identityMeta} numberOfLines={1}>
                        {`${profile?.races_count ?? 0} ${t('ownProfile:profile.races')}`}
                        {'   '}
                        {`${profile?.followers_count ?? 0} ${t('ownProfile:profile.followers')}`}
                        {'   '}
                        {`${profile?.following_count ?? 0} ${t('ownProfile:profile.following')}`}
                    </Text>
                </View>
            </View>

            {/* ✅ BUTTON - FULL WIDTH */}
            {isOwn ? (
                <TouchableOpacity
                    style={[
                        commonStyles.primaryButton,
                        {
                            alignSelf: 'stretch',
                            marginTop: spacing.md,
                        }
                    ]}
                    onPress={() => navigation.navigate('EditProfileScreen' as never)}
                    activeOpacity={0.8}
                >
                    <Text style={commonStyles.primaryButtonText}>
                        {t('profile:buttons.editProfile')}
                    </Text>
                </TouchableOpacity>
            ) : (
                <TouchableOpacity
                    style={[
                        commonStyles.primaryButton,
                        {
                            alignSelf: 'stretch',
                            marginTop: spacing.md,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            opacity: isFollowLoading ? 0.6 : 1,
                        }
                    ]}
                    onPress={onToggleFollow}
                    disabled={isFollowLoading}
                    activeOpacity={0.8}
                >
                    {isFollowLoading ? (
                        <ActivityIndicator size="small" color={palette.surface} />
                    ) : (
                        <>
                            <Ionicons
                                name={isFollowed ? 'heart' : 'heart-outline'}
                                size={16}
                                color={palette.surface}
                                style={{ marginRight: 8 }}
                            />
                            <Text style={commonStyles.primaryButtonText}>
                                {isFollowed
                                    ? t('follower:button.unfollow')
                                    : password_protected === 1
                                        ? `🔒 ${t('follower:button.follower')}`
                                        : t('follower:button.follower')}
                            </Text>
                        </>
                    )}
                </TouchableOpacity>
            )}
        </View>
    );
}, (prevProps, nextProps) => {
    // ✅ OPTIMIZED MEMO COMPARISON
    return (
        prevProps.customer_app_id === nextProps.customer_app_id &&
        prevProps.isFollowed === nextProps.isFollowed &&
        prevProps.isFollowLoading === nextProps.isFollowLoading &&
        prevProps.profile?.firstname === nextProps.profile?.firstname &&
        prevProps.profile?.lastname === nextProps.profile?.lastname &&
        prevProps.profile?.profile_picture === nextProps.profile?.profile_picture &&
        prevProps.profile?.is_own_profile === nextProps.profile?.is_own_profile &&
        prevProps.password_protected === nextProps.password_protected
    );
});

ProfileCard.displayName = 'ProfileCard';

export default ProfileCard;