import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { commonStyles, spacing } from '../styles/common.styles';
import { AthleteProfile } from '../services/athleteProfileService';
import { profileStyles } from '../styles/Profile.styles';
import { getImageUrl, API_CONFIG } from '../constants/config';
import { useFollow } from '../hooks/useFollow'

import { useTranslation } from 'react-i18next';

interface Props {
    profile: AthleteProfile | null;
    fetchError: string;
    customer_app_id: number;
}


const ProfileCard = ({ profile, fetchError, customer_app_id }: Props) => {
    const { t } = useTranslation('follower');
    console.log(profile);
    const navigation = useNavigation();
    const { isFollowed, isLoading, toggleFollow } = useFollow(customer_app_id);

    const fullName = profile
        ? `${profile.firstname} ${profile.lastname}`.toUpperCase()
        : '';

    const isOwn = profile?.is_own_profile === 1;
    if (API_CONFIG.DEBUG) {
        console.log('RAW PROFILE IMAGE:', profile?.profile_picture);
        console.log('FIXED PROFILE IMAGE:', getImageUrl(profile?.profile_picture));
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

            {/* ✅ NAME (MOVED TO TOP) */}
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
                {!!profile?.is_own_profile && (
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
                            width: '90%', // ✅ Full width with margins
                            alignSelf: 'center',
                            marginTop: spacing.sm,
                        }
                    ]}
                    onPress={() => navigation.navigate('EditProfileScreen' as never)}
                    activeOpacity={0.8}
                >
                    <Text style={commonStyles.primaryButtonText}>Edit Profile</Text>
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
                            opacity: isLoading ? 0.6 : 1,
                        }
                    ]}
                    onPress={toggleFollow}
                    disabled={isLoading}
                    activeOpacity={0.8}
                >
                    {isLoading ? (
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
                                {isFollowed ? t('button.unfollow') : t('button.favourite')}
                            </Text>
                        </>
                    )}
                </TouchableOpacity>
            )}
        </View>
    );
};

export default ProfileCard;