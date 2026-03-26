import React from 'react';
import { View, Text, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useNavigation } from '@react-navigation/native';
import { commonStyles, spacing } from '../styles/common.styles';
import { AthleteProfile } from '../services/athleteProfileService';
import { profileStyles } from '../styles/Profile.styles';
import { getImageUrl, API_CONFIG } from '../constants/config';
import { useTranslation } from 'react-i18next';

interface ProfileCardProps {
    profile: AthleteProfile | null;
    fetchError: string;
    customer_app_id: number;
    isFollowed: boolean;
    isFollowLoading: boolean;
    onToggleFollow: () => void;
    password_protected?: 0 | 1;
}

const ProfileCard: React.FC<ProfileCardProps> = React.memo(({
    profile,
    password_protected,
    fetchError,
    customer_app_id,
    isFollowed,
    isFollowLoading,
    onToggleFollow,
}) => {
    const { t } = useTranslation(['follower', 'profile']);
    const navigation = useNavigation();

    const fullName = profile
        ? `${profile.firstname} ${profile.lastname}`.toUpperCase()
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
            {/* ✅ ERROR MESSAGE */}
            {!!fetchError && (
                <View style={profileStyles.errorRow}>
                    <Ionicons name="warning-outline" size={16} color="#e8341a" />
                    <Text style={commonStyles.errorText}>{fetchError}</Text>
                </View>
            )}

            {/* ✅ NAME */}
            <Text style={[commonStyles.title, { marginBottom: spacing.sm }]}>
                {fullName || '—'}
            </Text>

            {/* ✅ AVATAR */}
            <View style={profileStyles.avatarWrapper}>
                <View style={profileStyles.avatar}>
                    {profile?.profile_picture ? (
                        <Image
                            source={{ uri: getImageUrl(profile.profile_picture) || undefined }}
                            style={profileStyles.avatar}
                        />
                    ) : (
                        <Ionicons name="person" size={50} color="#555" />
                    )}
                </View>
                {isOwn && (
                    <TouchableOpacity
                        style={profileStyles.editIcon}
                        onPress={() => navigation.navigate('EditProfileScreen' as never)}
                    >
                        <FontAwesome name="pencil" size={14} color="#fff" />
                    </TouchableOpacity>
                )}
            </View>

            {/* ✅ BUTTON - FULL WIDTH */}
            {isOwn ? (
                <TouchableOpacity
                    style={[
                        commonStyles.primaryButton,
                        {
                            width: '90%',
                            alignSelf: 'center',
                            marginTop: spacing.sm,
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
                            width: '90%',
                            alignSelf: 'center',
                            marginTop: spacing.sm,
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
                        <ActivityIndicator size="small" color="#fff" />
                    ) : (
                        <>
                            <Ionicons
                                name={isFollowed ? 'heart' : 'heart-outline'}
                                size={16}
                                color="#fff"
                                style={{ marginRight: 6 }}
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
        prevProps.fetchError === nextProps.fetchError &&
    prevProps.password_protected    === nextProps.password_protected 
    );
});

ProfileCard.displayName = 'ProfileCard';

export default ProfileCard;