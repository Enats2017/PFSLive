import React, { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context'
import * as ImagePicker from 'expo-image-picker'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useTranslation } from 'react-i18next'
import FloatingLabelInput from '../../components/FloatingLabelInput'
import CountrySelector from '../../components/CountrySelector'
import { commonStyles, palette, colors } from '../../styles/common.styles'
import { ANALYTICS_SCREENS } from '../../constants/analyticsScreens'
import { EMAIL_REGEX, useEditProfile } from '../../hooks/Useeditprofile'
import { fetchProfileApi } from '../../services/profileServices'
import { tokenService } from '../../services/tokenService'
import { AppHeader } from '../../components/common/AppHeader'
import { profileStyles } from '../../styles/Profile.styles'
import { toastSuccess, toastError } from '../../../utils/toast'
import { API_CONFIG } from '../../constants/config'
import { useNavigation } from '@react-navigation/native'
import { saveLanguage, getLanguageCodeFromId } from '../../i18n';
import { useLanguageStore } from '../../store/useLanguageStore';
import EmailChangeConfirmModal from '../../components/EmailChangeConfirmModal'

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
    const [showEmailConfirm, setShowEmailConfirm] = useState(false)
    const [pendingBusy, setPendingBusy] = useState(false)

    // ✅ Language options — id matches API expectation
    const LANGUAGE_OPTIONS = [
        { label: t('profile:languages.english'), value: 1 },
        { label: t('profile:languages.dutch'),   value: 2 },
        { label: t('profile:languages.french'),  value: 3 },
    ]

    const navigation = useNavigation<any>()

    const genderOptions = GENDER_VALUES.map((value) => ({
        label: t(`profile:gender.${value}`),
        value
    }))

   const loadProfile = useCallback(async () => {
        try {
            setProfile(await fetchProfileApi())
        } catch (e: any) {
            setProfileError(e?.message || t('profile:errors.load_profile_failed'))
        }
    }, [t])

    useEffect(() => {
        loadProfile().finally(() => setProfileLoading(false))
    }, [loadProfile])

    const {
        form, setField,
        handleCountrySelect,
        errors,
        loading, success, emailChanged,
        picture, setPicture,
        removePicture, setRemovePicture,
        submit,
    } = useEditProfile(profile)

    const savedEmail = (profile?.email ?? '').trim().toLowerCase()
    const typedEmail = form.email.trim().toLowerCase()
    const emailDirty = !!savedEmail && typedEmail !== savedEmail

    const emailChangeReady = emailDirty && EMAIL_REGEX.test(typedEmail)

    const serverPendingEmail =
        profile?.pending_email && profile.pending_email.trim().toLowerCase() !== savedEmail
            ? profile.pending_email.trim()
            : null

    const genderDisplayValue =
        genderOptions.find(g => g.value === form.gender)?.label || ''

    const languageDisplayValue =
        LANGUAGE_OPTIONS.find(l => l.value === form.language_id)?.label || ''

    // ✅ SHOW IMAGE SOURCE PICKER
    const showImageSourcePicker = useCallback(() => {
        Alert.alert(
            t('profile:avatar.choose_source_title'),
            t('profile:avatar.choose_source_message'),
            [
                {
                    text: t('profile:avatar.take_photo'),
                    onPress: () => pickImageFromCamera(),
                },
                {
                    text: t('profile:avatar.choose_gallery'),
                    onPress: () => pickImageFromGallery(),
                },
                {
                    text: t('common:buttons.cancel'),
                    style: 'cancel',
                },
            ],
            { cancelable: true }
        )
    }, [t])

    // ✅ PICK IMAGE FROM CAMERA
    const pickImageFromCamera = useCallback(async () => {
        try {
            const permission = await ImagePicker.requestCameraPermissionsAsync()

            if (permission.status !== 'granted') {
                toastError(
                    t('profile:errors.permission_title'),
                    t('profile:errors.camera_permission')
                )
                return
            }

            const result = await ImagePicker.launchCameraAsync({
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
        } catch (error) {
            if (API_CONFIG.DEBUG) {
                console.error('❌ Camera error:', error)
            }
            toastError(
                t('profile:errors.permission_title'),
                t('profile:errors.generic_error')
            )
        }
    }, [setPicture, setRemovePicture, t])

    // ✅ PICK IMAGE FROM GALLERY
    const pickImageFromGallery = useCallback(async () => {
        try {
            const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()

            if (permission.status !== 'granted') {
                toastError(
                    t('profile:errors.permission_title'),
                    t('profile:errors.permission_message')
                )
                return
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: 'images',
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
        } catch (error) {
            if (API_CONFIG.DEBUG) {
                console.error('❌ Gallery picker error:', error)
            }
            toastError(
                t('profile:errors.permission_title'),
                t('profile:errors.generic_error')
            )
        }
    }, [setPicture, setRemovePicture, t])

    const { changeLanguage } = useLanguageStore();

    // The actual save. `emailOverride` is used by the pending-email banner; a
    // plain Save passes nothing and the form's own email is sent.
    const performSave = useCallback(async (emailOverride?: string) => {
        const result = await submit(emailOverride ? { email: emailOverride } : undefined)
        if (!result.ok) return false

        const langCode = getLanguageCodeFromId(form.language_id)
        if (langCode) {
            await saveLanguage(langCode)
            await changeLanguage(langCode, { screenName: ANALYTICS_SCREENS.EDIT_PROFILE, userInitiated: true })
        }

        if (result.isEmailChange && result.emailChangeToken && result.pendingEmail) {
            // ✅ The rest of the profile (name, city, DOB, language) is already
            // saved at this point. Say so before routing away, otherwise those
            // edits appear to vanish into the OTP screen with no confirmation.
            toastSuccess(
                t('profile:emailChange.code_sent_toast_title'),
                t('profile:emailChange.code_sent_toast_message', { email: result.pendingEmail }),
            )

            navigation.navigate('OTPVerificationScreen', {
                purpose: 'email_change',
                verification_token: result.emailChangeToken,
                email: result.pendingEmail,
            })
            return true
        }

        toastSuccess(t('profile:messages.success_profile_updated'))

        const customer_app_id = await tokenService.getCustomerId()
        navigation.navigate('OwnProfile', {
            customer_app_id: customer_app_id || 0,
            fromEdit: true,
        })
        return true
    }, [submit, navigation, t, form.language_id, changeLanguage])

     const handleSave = useCallback(async () => {
        if (emailChangeReady) {
            setShowEmailConfirm(true)
            return
        }
        // An obviously malformed address falls through on purpose: performSave
        // runs the real validation and surfaces the inline error, so the user
        // never gets prompted to confirm something that cannot be sent.
        await performSave()
    }, [emailChangeReady, performSave])

     const handleConfirmEmailChange = useCallback(async () => {
        // The modal stays up while the request is in flight — `loading` drives a
        // spinner on its confirm button. Close it either way afterwards: on
        // failure the inline field error needs a visible form behind it.
        await performSave()
        setShowEmailConfirm(false)
    }, [performSave])

    // ✅ Re-submitting the pending address mints a fresh OTP + token
    // (edit_profile_api.php compares against the *confirmed* email, so a still-
    // pending address reads as a new change), which is what the OTP screen needs.
    const handleVerifyPending = useCallback(async () => {
        if (!serverPendingEmail || pendingBusy) return
        setPendingBusy(true)
        try {
            const result = await submit({ email: serverPendingEmail })

            if (result.ok && result.emailChangeToken && result.pendingEmail) {
                navigation.navigate('OTPVerificationScreen', {
                    purpose: 'email_change',
                    verification_token: result.emailChangeToken,
                    email: result.pendingEmail,
                })
                return
            }

            // The realistic failure is email_already_taken — another account
            // claimed the address while it sat here unconfirmed. That error
            // arrives as an inline field error, but the field is showing the
            // *confirmed* address, so leaving it there would be misleading.
            // Clear it, say what happened, and re-read the pending state.
            setField('email', form.email)
            toastError(
                t('profile:emailChange.resend_failed_title'),
                t('profile:emailChange.resend_failed_message'),
            )
            await loadProfile()
        } finally {
            setPendingBusy(false)
        }
    }, [serverPendingEmail, pendingBusy, submit, navigation, t, loadProfile, setField, form.email])

    // ✅ Clearing the staged address needs an explicit flag — re-submitting the
    // confirmed email is a no-op server-side (and returns `no_changes` when
    // nothing else differs), because the change is only detected by comparing
    // against `email`, which never moved.
    const handleCancelPending = useCallback(async () => {
        if (!serverPendingEmail || pendingBusy) return
        setPendingBusy(true)
        try {
            const result = await submit(undefined, { cancelEmailChange: true })
            if (!result.ok) return
            toastSuccess(
                t('profile:emailChange.pending_cancelled_title'),
                t('profile:emailChange.pending_cancelled_message'),
            )
            await loadProfile()
        } finally {
            setPendingBusy(false)
        }
    }, [serverPendingEmail, pendingBusy, submit, t, loadProfile])

    const avatarUri: string | null = picture
        ? picture.uri
        : (profile?.profile_picture && !removePicture)
            ? (profile.profile_picture)
            : null

    const avatarInitials = [form.firstname[0], form.lastname[0]]
        .filter(Boolean).join('').toUpperCase() || '?'

    if (profileLoading) {
        return (
            <SafeAreaView style={commonStyles.container} edges={['bottom']}>
                <AppHeader title={t('common:band.account')} showLogo={true} showBack />
                <View style={commonStyles.centerContainer}>
                    <ActivityIndicator size="large" color={palette.danger} />
                </View>
            </SafeAreaView>
        )
    }

    if (profileError) {
        return (
            <SafeAreaView style={commonStyles.container} edges={['bottom']}>
                <AppHeader title={t('common:band.account')} showLogo={true} showBack />
                <View style={commonStyles.centerContainer}>
                    <Ionicons name="warning-outline" size={40} color={palette.danger} />
                    <Text style={commonStyles.errorText}>{profileError}</Text>
                </View>
            </SafeAreaView>
        )
    }

    return (
        <SafeAreaView style={commonStyles.container} edges={['bottom']}>
            <AppHeader title={t('common:band.account')} showLogo={true} showBack />
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
                            onPress={showImageSourcePicker}
                            activeOpacity={0.8}
                        >
                            {avatarUri ? (
                                <Image
                                    source={{ uri: avatarUri }}
                                    cachePolicy="memory-disk"
                                    style={profileStyles.avatar}
                                    contentFit="cover"
                                />
                            ) : (
                                <View style={[profileStyles.avatar, profileStyles.avatarFallback]}>
                                    <Text style={profileStyles.initials}>{avatarInitials}</Text>
                                </View>
                            )}
                            <View style={profileStyles.cameraBtn}>
                                <Ionicons name="camera" size={16} color={palette.surface} />
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

                    <View style={profileStyles.fieldRow}>
                      <View style={profileStyles.fieldHalf}>
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
                      </View>
                      <View style={profileStyles.fieldHalf}>
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
                      </View>
                    </View>

                     <View style={profileStyles.emailFieldWrapper}>
                        <FloatingLabelInput
                            label={t('profile:labels.email')}
                            value={form.email}
                            onChangeText={(value) => setField('email', value)}
                            iconName="mail-outline"
                            editable={!loading}
                            error={!!errors.email}
                            errorMessage={errors.email}
                            autoCapitalize="none"
                            keyboardType="email-address"
                        />

                        {/* ✅ Just-in-time, not ambient: only once the typed value
                            actually differs from the saved one. */}
                        {emailChangeReady && !errors.email && (
                            <View style={profileStyles.emailChangeHintRow}>
                                <Ionicons
                                    name="information-circle-outline"
                                    size={14}
                                    color={profileStyles.emailChangeHintIcon.color}
                                    style={profileStyles.emailChangeHintIcon}
                                />
                                <Text style={profileStyles.emailChangeHintText}>
                                    {t('profile:emailChange.hint', { email: form.email.trim() })}
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* ✅ An unconfirmed address from an earlier save. Without this
                        the pending state is invisible — the server holds it but
                        nothing in the app ever says so. Hidden mid-edit; the hint
                        above is the relevant message then. */}
                    {!!serverPendingEmail && !emailDirty && (
                        <View style={profileStyles.pendingEmailBanner}>
                            <View style={profileStyles.pendingEmailRow}>
                                <Ionicons name="time-outline" size={20} color={colors.warning} />
                                <Text style={profileStyles.pendingEmailText}>
                                    {t('profile:emailChange.pending_banner', { email: serverPendingEmail })}
                                </Text>
                            </View>

                            <View style={profileStyles.pendingEmailActions}>
                                <TouchableOpacity
                                    onPress={handleVerifyPending}
                                    disabled={pendingBusy}
                                    accessibilityRole="button"
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                >
                                    <Text style={profileStyles.pendingEmailAction}>
                                        {t('profile:emailChange.pending_verify')}
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={handleCancelPending}
                                    disabled={pendingBusy}
                                    accessibilityRole="button"
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                >
                                    <Text style={profileStyles.pendingEmailActionMuted}>
                                        {t('profile:emailChange.pending_cancel')}
                                    </Text>
                                </TouchableOpacity>

                                {pendingBusy && <ActivityIndicator size="small" color={colors.primary} />}
                            </View>
                        </View>
                    )}

                    <View style={profileStyles.fieldRow}>
                      <View style={profileStyles.fieldHalf}>
                        <CountrySelector
                            label={t('profile:labels.country')}
                            value={form.countryName}
                            onSelect={handleCountrySelect}
                            isoCode={form.country_iso}
                            error={errors.countryName}
                        />
                      </View>
                      <View style={profileStyles.fieldHalf}>
                        <FloatingLabelInput
                            label={t('profile:labels.city')}
                            value={form.city}
                            onChangeText={(v) => setField('city', v)}
                            iconName="location-outline"
                            editable={!loading}
                            error={!!errors.city}
                            errorMessage={errors.city}
                        />
                      </View>
                    </View>

                    <FloatingLabelInput
                        label={t('profile:labels.dob')}
                        value={form.dob}
                        onChangeText={(v) => setField('dob', v)}
                        iconName="calendar-outline"
                        isDatePicker
                                        // ← block future DOBs
                        pickerDoneLabel={t('common:buttons.done')}
                        pickerCancelLabel={t('common:buttons.cancel')}
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

                    {/* ✅ Language Selector */}
                    <FloatingLabelInput
                        label={t('profile:labels.language')}
                        value={languageDisplayValue}
                        onChangeText={(label) => {
                            const selected = LANGUAGE_OPTIONS.find(l => l.label === label)
                            if (selected) setField('language_id', selected.value)
                        }}
                        iconName="language-outline"
                        isDropdown
                        options={LANGUAGE_OPTIONS.map(l => l.label)}
                        editable={!loading}
                        error={false}
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
                            profileStyles.saveButton,
                            loading && profileStyles.saveBtnDisabled
                        ]}
                        onPress={handleSave}
                        disabled={loading}
                        activeOpacity={0.85}
                    >
                        {loading ? (
                            <ActivityIndicator color={palette.surface} size="small" />
                        ) : (
                            <Text style={commonStyles.primaryButtonText}>
                                {t('profile:buttons.save_changes')}
                            </Text>
                        )}
                    </TouchableOpacity>

                    {success && !emailChanged && (
                        <View style={profileStyles.successBanner}>
                            <Ionicons name="checkmark-circle" size={18} color={palette.lime} />
                            <Text style={profileStyles.successText}>
                                {t('profile:messages.success_profile_updated')}
                            </Text>
                        </View>
                    )}
                </ScrollView>
            </KeyboardAvoidingView>
            <EmailChangeConfirmModal
                visible={showEmailConfirm}
                newEmail={form.email.trim()}
                loading={loading}
                onConfirm={handleConfirmEmailChange}
                onClose={() => setShowEmailConfirm(false)}
            />
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