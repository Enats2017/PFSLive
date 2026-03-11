import React, { useCallback, useEffect, useState } from 'react'
import {
    View, Text, TouchableOpacity, ScrollView, StatusBar, ActivityIndicator, Alert, Image,
    KeyboardAvoidingView, Platform
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as ImagePicker from 'expo-image-picker'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useTranslation } from 'react-i18next'
import FloatingLabelInput from '../../components/FloatingLabelInput'
import CountrySelector from '../../components/CountrySelector'
import { commonStyles } from '../../styles/common.styles'
import { useEditProfile } from '../../hooks/Useeditprofile'
import { fetchProfileApi } from '../../services/profileServices'
import { tokenService } from '../../services/tokenService'
import { AppHeader } from '../../components/common/AppHeader'
import { profileStyles } from '../../styles/Profile.styles'
import { toastSuccess } from '../../../utils/toast'
import { getImageUrl } from '../../constants/config'
import { useNavigation } from '@react-navigation/native'

const GENDER_VALUES = [
    'male',
    'female',
    'other',
    'prefer_not_to_say'
] as const

const EditProfileScreen = () => {
    const { t } = useTranslation(['profile', 'common'])
    const [profileLoading, setProfileLoading] = useState(true)
    const [profileError, setProfileError] = useState('')
    const [profile, setProfile] = useState<Awaited<ReturnType<typeof fetchProfileApi>> | null>(null)
    
    // ✅ USE ANY TYPE FOR NAVIGATION
    const navigation = useNavigation<any>()
    
    const genderOptions = GENDER_VALUES.map((value) => ({
        label: t(`profile:gender.${value}`),
        value
    }))

    useEffect(() => {
        fetchProfileApi()
            .then(setProfile)
            .catch((e) => setProfileError(e.message || t('profile:errors.load_profile_failed')))
            .finally(() => setProfileLoading(false))
    }, [t])

    const {
        form, setField,
        handleCountrySelect,
        errors,
        loading, success, emailChanged,
        picture, setPicture,
        removePicture, setRemovePicture,
        submit,
    } = useEditProfile(profile)

    const genderDisplayValue =
        genderOptions.find(g => g.value === form.gender)?.label || ''

    const pickAvatar = useCallback(async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
        if (status !== 'granted') {
            Alert.alert(
                t('profile:errors.permission_title'),
                t('profile:errors.permission_message')
            )
            return
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        })
        if (!result.canceled && result.assets[0]) {
            const asset = result.assets[0]
            const ext = asset.uri.split('.').pop() ?? 'jpg'
            setPicture({
                uri: asset.uri,
                name: `profile_${Date.now()}.${ext}`,
                type: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
            })
            setRemovePicture(false)
        }
    }, [setPicture, setRemovePicture, t])

    /* ── submit ── */
    const handleSave = useCallback(async () => {
        const ok = await submit()
        if (ok) {
            toastSuccess(t('profile:messages.success_profile_updated'))
            
            // ✅ GET CUSTOMER_APP_ID FROM TOKEN SERVICE
            const customer_app_id = await tokenService.getCustomerId()
            
            // ✅ NAVIGATE WITH fromEdit FLAG (NO TYPE ERRORS)
            navigation.navigate('ProfileScreen', {
                customer_app_id: customer_app_id || 0,
                fromEdit: true,
            })
        }
    }, [submit, navigation, t])

    const avatarUri: string | null = picture
        ? picture.uri
        : (profile?.profile_picture && !removePicture)
            ? getImageUrl(profile.profile_picture)
            : null

    const avatarInitials = [form.firstname[0], form.lastname[0]]
        .filter(Boolean).join('').toUpperCase() || '?'

    if (profileLoading) {
        return (
            <SafeAreaView style={commonStyles.container} edges={['top']}>
                <StatusBar barStyle="dark-content" />
                <AppHeader showLogo={true} />
                <View style={commonStyles.centerContainer}>
                    <ActivityIndicator size="large" color="#e8341a" />
                </View>
            </SafeAreaView>
        )
    }

    if (profileError) {
        return (
            <SafeAreaView style={commonStyles.container} edges={['top']}>
                <StatusBar barStyle="dark-content" />
                <AppHeader showLogo={true} />
                <View style={commonStyles.centerContainer}>
                    <Ionicons name="warning-outline" size={40} color="#e8341a" />
                    <Text style={commonStyles.errorText}>{profileError}</Text>
                </View>
            </SafeAreaView>
        )
    }

    return (
        <SafeAreaView style={commonStyles.container} edges={['top']}>
            <StatusBar barStyle="dark-content" />
            <AppHeader showLogo={true} />
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={10}
            >
                <ScrollView
                    contentContainerStyle={profileStyles.content}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <View style={profileStyles.profileCard}>
                        <TouchableOpacity 
                            style={profileStyles.avatarWrapper} 
                            onPress={pickAvatar} 
                            activeOpacity={0.8}
                        >
                            {avatarUri ? (
                                <Image
                                    source={{ uri: avatarUri }}
                                    style={profileStyles.avatar}
                                    resizeMode="cover"
                                />
                            ) : (
                                <View style={[profileStyles.avatar, profileStyles.avatarFallback]}>
                                    <Text style={profileStyles.initials}>{avatarInitials}</Text>
                                </View>
                            )}
                            <View style={profileStyles.cameraBtn}>
                                <Ionicons name="camera" size={16} color="#fff" />
                            </View>
                        </TouchableOpacity>

                        {avatarUri && (
                            <TouchableOpacity
                                style={profileStyles.removeBtn}
                                onPress={() => { setPicture(null); setRemovePicture(true) }}
                                activeOpacity={0.8}
                            >
                                <Text style={profileStyles.removeBtnText}>
                                    {t('profile:avatar.remove_photo')}
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    <FloatingLabelInput
                        label={t('profile:labels.first_name')}
                        value={form.firstname}
                        onChangeText={(v) => setField('firstname', v)}
                        iconName="person-outline"
                        required
                        editable={!loading}
                        error={!!errors.firstname}
                        errorMessage={errors.firstname}
                    />

                    <FloatingLabelInput
                        label={t('profile:labels.last_name')}
                        value={form.lastname}
                        onChangeText={(v) => setField('lastname', v)}
                        iconName="people-outline"
                        required
                        editable={!loading}
                        error={!!errors.lastname}
                        errorMessage={errors.lastname}
                    />

                    <FloatingLabelInput
                        label={t('profile:labels.email')}
                        value={form.email}
                        onChangeText={() => {}}
                        iconName="mail-outline"
                        editable={false}
                        error={false}
                    />
                    <Text style={profileStyles.readOnlyHint}>
                        {t('profile:messages.email_readonly')}
                    </Text>

                    <CountrySelector
                        label={t('profile:labels.country')}
                        value={form.countryName}
                        onSelect={handleCountrySelect}
                        isoCode={form.country_iso}
                        error={errors.countryName}
                    />

                    <FloatingLabelInput
                        label={t('profile:labels.city')}
                        value={form.city}
                        onChangeText={(v) => setField('city', v)}
                        iconName="location-outline"
                        editable={!loading}
                        error={!!errors.city}
                        errorMessage={errors.city}
                    />

                    <FloatingLabelInput
                        label={t('profile:labels.dob')}
                        value={form.dob}
                        onChangeText={(v) => setField('dob', v)}
                        iconName="calendar-outline"
                        isDatePicker
                        editable={!loading}
                        error={!!errors.dob}
                        errorMessage={errors.dob}
                    />

                    <FloatingLabelInput
                        label={t('profile:labels.gender')}
                        value={genderDisplayValue}
                        onChangeText={(label) => {
                            const selected = genderOptions.find(g => g.label === label)
                            if (selected) setField('gender', selected.value)
                        }}
                        iconName="people-outline"
                        isDropdown
                        options={genderOptions.map(g => g.label)}
                        editable={!loading}
                        error={!!errors.gender}
                        errorMessage={errors.gender}
                    />

                    <SectionHeader 
                        title={t('profile:sections.change_password')} 
                        subtitle={t('profile:sections.password_hint')} 
                    />

                    <FloatingLabelInput
                        label={t('profile:labels.new_password')}
                        value={form.password}
                        onChangeText={(v) => setField('password', v)}
                        iconName="lock-closed-outline"
                        isPassword
                        editable={!loading}
                        error={!!errors.password}
                        errorMessage={errors.password}
                    />

                    <FloatingLabelInput
                        label={t('profile:labels.confirm_password')}
                        value={form.confirmPassword}
                        onChangeText={(v) => setField('confirmPassword', v)}
                        iconName="lock-open-outline"
                        isPassword
                        editable={!loading}
                        error={!!errors.confirmPassword}
                        errorMessage={errors.confirmPassword}
                    />

                    <TouchableOpacity
                        style={[
                            commonStyles.primaryButton, 
                            loading && profileStyles.saveBtnDisabled
                        ]}
                        onPress={handleSave}
                        disabled={loading}
                        activeOpacity={0.85}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" size="small" />
                        ) : (
                            <Text style={commonStyles.primaryButtonText}>
                                {t('profile:buttons.save_changes')}
                            </Text>
                        )}
                    </TouchableOpacity>

                    {success && !emailChanged && (
                        <View style={profileStyles.successBanner}>
                            <Ionicons name="checkmark-circle" size={18} color="#2e7d32" />
                            <Text style={profileStyles.successText}>
                                {t('profile:messages.success_profile_updated')}
                            </Text>
                        </View>
                    )}
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    )
}

const SectionHeader = ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <View style={profileStyles.sectionHeader}>
        <Text style={profileStyles.sectionTitle}>{title}</Text>
        {subtitle && <Text style={profileStyles.sectionSubtitle}>{subtitle}</Text>}
        <View style={profileStyles.sectionLine} />
    </View>
)

export default EditProfileScreen