import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import FontAwesome from '@expo/vector-icons/FontAwesome'
import { useNavigation } from '@react-navigation/native'
import { commonStyles } from '../styles/common.styles'
import { AthleteProfile } from '../services/athleteProfileService'
import { profileStyles } from '../styles/Profile.styles'

interface Props {
    profile: AthleteProfile | null
    fetchError: string
}

const ProfileCard = ({ profile, fetchError }: Props) => {
    const navigation = useNavigation()

    const fullName = profile
        ? `${profile.firstname} ${profile.lastname}`.toUpperCase()
        : ''

    const isOwn = profile?.is_own_profile === 1

    return (
        <View style={[profileStyles.profileCard]}>
            {!!fetchError && (
                <View style={profileStyles.errorRow}>
                    <Ionicons name="warning-outline" size={16} color="#e8341a" />
                    <Text style={commonStyles.errorText}>{fetchError}</Text>
                </View>
            )}

            <Text style={commonStyles.title}>{fullName || '—'}</Text>
            <View style={profileStyles.avatarWrapper}>
                <View style={profileStyles.avatar}>
                    {profile?.profile_picture ? (
                        <Image
                            source={{ uri: profile.profile_picture }}
                            style={profileStyles.avatarImage}
                            resizeMode="cover"
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

            {/* Name */}

            {isOwn ? (
                <TouchableOpacity
                    style={commonStyles.primaryButton}
                    onPress={() => navigation.navigate('EditProfileScreen' as never)}
                >
                    <Text style={commonStyles.primaryButtonText}>Edit Profile</Text>
                </TouchableOpacity>
            ) : (
                <TouchableOpacity
                    style={commonStyles.primaryButton}
                    onPress={() => console.log('Add to favourite')}
                >
                    <Ionicons name="heart-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
                    <Text style={commonStyles.primaryButtonText}>Add to Favourite</Text>
                </TouchableOpacity>
            )}
        </View>
    )
}

export default ProfileCard
