import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useNavigation } from '@react-navigation/native';
import { commonStyles, spacing } from '../styles/common.styles';
import { AthleteProfile } from '../services/athleteProfileService';
import { profileStyles } from '../styles/Profile.styles';
import { getImageUrl, API_CONFIG } from '../constants/config';

interface Props {
    profile: AthleteProfile | null;
    fetchError: string;
}

const ProfileCard = ({ profile, fetchError }: Props) => {
    const navigation = useNavigation();

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
                            width: '90%', // ✅ Full width with margins
                            alignSelf: 'center',
                            marginTop: spacing.sm,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }
                    ]}
                    onPress={() => console.log('Add to favourite')}
                    activeOpacity={0.8}
                >
                    <Ionicons name="heart-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
                    <Text style={commonStyles.primaryButtonText}>Add to Favourite</Text>
                </TouchableOpacity>
            )}
        </View>
    );
};

export default ProfileCard;