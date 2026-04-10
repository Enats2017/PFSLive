import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import { AppHeader } from '../../components/common/AppHeader';
import FloatingLabelInput from '../../components/FloatingLabelInput';
import CountrySelector from '../../components/CountrySelector';
import { commonStyles, colors } from '../../styles/common.styles';
import { registerStyles } from '../../styles/Register.styles';
import { RegisterProps } from '../../types/navigation';
import { authService } from '../../services/authService';
import { validateRegisterForm } from '../../services/validation/authValidation';
import { toastError, toastSuccess } from '../../../utils/toast';
import { useAuthForm } from '../../hooks/useAuthForm';
import { API_CONFIG } from '../../constants/config';

// ✅ CONSTANTS
const INITIAL_FORM_DATA = {
  firstname: '',
  lastname: '',
  email: '',
  password: '',
  countryId: '',
  countryName: '',
  city: '',
  dob: '',
  gender: '',        // ✅ API key — 'male' | 'female' | 'other' (English, always)
  genderLabel: '',   // ✅ Display value — translated label shown in the input
  profileImage: '',
  acceptedTerms: false,
};

// ✅ STABLE GENDER KEYS — sent to API regardless of language
export const GENDER_KEYS = ['male', 'female', 'other'] as const;
export type GenderKey = typeof GENDER_KEYS[number];

// ✅ Map API field error codes → form field keys + language key
// Used to apply server-side validation errors back onto form fields
const FIELD_ERROR_MAP: Record<string, { field: string; i18nKey: string }> = {
  firstname_required:  { field: 'firstname', i18nKey: 'register:errors.firstnameRequired' },
  lastname_required:   { field: 'lastname',  i18nKey: 'register:errors.lastnameRequired' },
  email_invalid:       { field: 'email',     i18nKey: 'register:errors.emailInvalid' },
  email_too_long:      { field: 'email',     i18nKey: 'register:errors.emailInvalid' },
  city_required:       { field: 'city',      i18nKey: 'register:errors.cityRequired' },
  country_invalid:     { field: 'country',   i18nKey: 'register:errors.countryRequired' },
  dob_required:        { field: 'dob',       i18nKey: 'register:errors.dobRequired' },
  dob_invalid_format:  { field: 'dob',       i18nKey: 'register:errors.dobInvalid' },
  dob_underage:        { field: 'dob',       i18nKey: 'register:errors.dobUnderage' },
  dob_invalid:         { field: 'dob',       i18nKey: 'register:errors.dobInvalid' },
  gender_required:     { field: 'gender',    i18nKey: 'register:errors.genderRequired' },
  password_too_short:  { field: 'password',  i18nKey: 'register:errors.passwordShort' },
  password_too_long:   { field: 'password',  i18nKey: 'register:errors.passwordLong' },
  agree_required:      { field: 'terms',     i18nKey: 'register:errors.termsRequired' },
};

const RegisterScreen: React.FC<RegisterProps> = ({ navigation }) => {
  const { t } = useTranslation(['register', 'common']);

  // ✅ FORM STATE (CUSTOM HOOK)
  const { formData, errors, setField, setErrors, clearAllErrors } =
    useAuthForm(INITIAL_FORM_DATA);

  const [loading, setLoading] = useState(false);

  // ✅ GENDER OPTIONS — labels in user's language, values are stable English keys
  const GENDER_OPTIONS = useMemo(
    () => GENDER_KEYS.map(key => ({
      label: t(`register:Gender.${key}`),  // shown to user in their language
      value: key,                           // sent to API in English
    })),
    [t]
  );

  // ✅ Labels array for FloatingLabelInput display
  const GENDER_LABELS = useMemo(
    () => GENDER_OPTIONS.map(o => o.label),
    [GENDER_OPTIONS]
  );

  // ✅ Handle gender selection — store key for API, label for display
  const handleGenderSelect = useCallback(
    (selectedLabel: string) => {
      const option = GENDER_OPTIONS.find(o => o.label === selectedLabel);
      if (option) {
        setField('gender', option.value);       // 'male' / 'female' / 'other' → API
        setField('genderLabel', option.label);  // translated label → display
      }
    },
    [GENDER_OPTIONS, setField]
  );

  // ✅ Apply API field errors back onto form fields
  const applyApiFieldErrors = useCallback((fields: string[]) => {
    const newErrors: Record<string, string> = {};
    let hasUnmapped = false;

    fields.forEach(code => {
      if (code === 'device_id_required') {
        // Device issue — not a user-fixable form field, show toast
        toastError(t('register:alerts.genericError'), t('register:errors.deviceIdRequired'));
        return;
      }
      const mapping = FIELD_ERROR_MAP[code];
      if (mapping) {
        // Only set first error per field
        if (!newErrors[mapping.field]) {
          newErrors[mapping.field] = t(mapping.i18nKey);
        }
      } else {
        hasUnmapped = true;
      }
    });

    setErrors(newErrors);

    if (hasUnmapped) {
      toastError(t('register:alerts.genericError'), t('register:alerts.genericErrorMessage'));
    }
  }, [setErrors, t]);

  // ✅ SHOW IMAGE SOURCE PICKER
  const showImageSourcePicker = useCallback(() => {
    Alert.alert(
      t('register:imageSource.title'),
      t('register:imageSource.message'),
      [
        {
          text: t('register:imageSource.camera'),
          onPress: () => pickImageFromCamera(),
        },
        {
          text: t('register:imageSource.gallery'),
          onPress: () => pickImageFromGallery(),
        },
        {
          text: t('common:buttons.cancel'),
          style: 'cancel',
        },
      ],
      { cancelable: true }
    );
  }, [t]);

  // ✅ PICK IMAGE FROM CAMERA
  const pickImageFromCamera = useCallback(async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();

      if (!permission.granted) {
        toastError(
          t('register:alerts.permissionRequired'),
          t('register:alerts.cameraPermission')
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.[0]) {
        setField('profileImage', result.assets[0].uri);
      }
    } catch (error) {
      if (API_CONFIG.DEBUG) {
        console.error('❌ Camera error:', error);
      }
      toastError(
        t('common:errors.generic'),
        t('register:alerts.genericErrorMessage')
      );
    }
  }, [setField, t]);

  // ✅ PICK IMAGE FROM GALLERY
  const pickImageFromGallery = useCallback(async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        toastError(
          t('register:alerts.permissionRequired'),
          t('register:alerts.galleryPermission')
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.[0]) {
        setField('profileImage', result.assets[0].uri);
      }
    } catch (error) {
      if (API_CONFIG.DEBUG) {
        console.error('❌ Image picker error:', error);
      }
      toastError(
        t('common:errors.generic'),
        t('register:alerts.genericErrorMessage')
      );
    }
  }, [setField, t]);

  // ✅ REMOVE IMAGE
  const removeImage = useCallback(() => {
    setField('profileImage', '');
  }, [setField]);

  // ✅ HANDLE COUNTRY SELECT
  const handleCountrySelect = useCallback(
    (country: { country_id: string; name: string }) => {
      setField('countryId', country.country_id);
      setField('countryName', country.name);
    },
    [setField]
  );

  // ✅ HANDLE SUBMIT
  const handleSubmit = useCallback(async () => {
    clearAllErrors();

    const validationErrors = validateRegisterForm(
      {
        firstname: formData.firstname,
        lastname: formData.lastname,
        email: formData.email,
        password: formData.password,
        countryId: formData.countryId,
        city: formData.city,
        dob: formData.dob,
        gender: formData.gender,
        acceptedTerms: formData.acceptedTerms,
      },
      t
    );

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setLoading(true);

    try {
      const response = await authService.register({
        firstname: formData.firstname,
        lastname: formData.lastname,
        email: formData.email,
        password: formData.password,
        country_id: formData.countryId,
        city: formData.city,
        dob: formData.dob,
        gender: formData.gender,  // ✅ always English key: 'male'/'female'/'other'
        profileImage: formData.profileImage || undefined,
      });

      if (response.success && response.data?.verification_token) {
        toastSuccess(
          t('register:success'),
          t('register:welcome', { name: formData.firstname })
        );

        navigation.navigate('OTPVerificationScreen', {
          email: response.data.email || '',
          verification_token: response.data.verification_token ?? '',
          purpose: 'registration',
        });
      }
    } catch (error: any) {
      const data = error.response?.data;
      const errorCode = data?.error;
      const fields: string[] = data?.fields ?? [];

      if (API_CONFIG.DEBUG) {
        console.error('❌ Register error:', errorCode, fields);
      }

      // ✅ Field-level validation errors from API — map back onto form fields
      if (errorCode === 'validation_failed' && fields.length > 0) {
        applyApiFieldErrors(fields);
        return;
      }

      // ✅ Top-level error codes
      switch (errorCode) {
        case 'email_exists':
          setErrors({ email: t('register:alerts.email_exists') });
          break;
        case 'device_already_registered':
          setErrors({ device: t('register:errors.deviceAlreadyRegistered') });
          break;
        case 'country_not_found':
          setErrors({ country: t('register:errors.countryRequired') });
          break;
        case 'profile_picture_too_large':
          setErrors({ profileImage: t('register:errors.profilePictureTooLarge') });
          break;
        case 'profile_picture_invalid_type':
        case 'profile_picture_invalid':
          setErrors({ profileImage: t('register:errors.profilePictureInvalid') });
          break;
        case 'profile_picture_partial':
        case 'profile_picture_server_error':
        case 'profile_picture_failed':
        case 'profile_picture_save_failed':
          setErrors({ profileImage: t('register:errors.profilePictureFailed') });
          break;
        case 'registration_failed':
          toastError(t('register:alerts.genericError'), t('register:errors.registrationFailed'));
          break;
        default:
          if (error.request) {
            toastError(t('register:alerts.noConnection'), t('register:alerts.noConnectionMessage'));
          } else {
            toastError(t('register:alerts.genericError'), t('register:alerts.genericErrorMessage'));
          }
      }
    } finally {
      setLoading(false);
    }
  }, [formData, clearAllErrors, setErrors, applyApiFieldErrors, navigation, t]);

  return (
    <SafeAreaView style={commonStyles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      <AppHeader showLogo={true} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingBottom: 60,
            flexGrow: 1,
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ paddingHorizontal: 15 }}>
            {/* ✅ PROFILE IMAGE SECTION */}
            <View style={registerStyles.imagesection}>
              <TouchableOpacity onPress={showImageSourcePicker} activeOpacity={0.8}>
                <View style={registerStyles.imageWrapper}>
                  {formData.profileImage ? (
                    <>
                      <Image
                        source={{ uri: formData.profileImage }}
                        style={registerStyles.profileImage}
                      />
                      <TouchableOpacity
                        style={registerStyles.removeIcon}
                        onPress={removeImage}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="close" size={14} color="{colors.primary}" />
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <View style={registerStyles.placeholder}>
                        <Ionicons name="person-outline" size={40} color="#9ca3af" />
                      </View>
                      <View style={registerStyles.cameraIcon}>
                        <Ionicons name="camera-outline" size={18} color="#fff" />
                      </View>
                    </>
                  )}
                </View>
              </TouchableOpacity>
              <Text style={registerStyles.uploadPhotoText}>
                {t('register:uploadPhoto')}
              </Text>
              {/* ✅ Profile image error */}
              {errors.profileImage && (
                <Text style={registerStyles.errorText}>{errors.profileImage}</Text>
              )}
            </View>

            {/* Form Fields */}
            <FloatingLabelInput
              label={t('firstName')}
              value={formData.firstname}
              onChangeText={(value) => setField('firstname', value)}
              iconName="person-outline"
              required
              editable={!loading}
              error={!!errors.firstname}
              errorMessage={errors.firstname}
            />

            <FloatingLabelInput
              label={t('lastName')}
              value={formData.lastname}
              onChangeText={(value) => setField('lastname', value)}
              iconName="people-outline"
              required
              editable={!loading}
              error={!!errors.lastname}
              errorMessage={errors.lastname}
            />

            <FloatingLabelInput
              label={t('email')}
              value={formData.email}
              onChangeText={(value) => setField('email', value)}
              iconName="mail-outline"
              keyboardType="email-address"
              autoCapitalize="none"
              required
              editable={!loading}
              error={!!errors.email}
              errorMessage={errors.email}
            />

            <FloatingLabelInput
              label={t('password')}
              value={formData.password}
              onChangeText={(value) => setField('password', value)}
              iconName="lock-closed-outline"
              isPassword
              required
              editable={!loading}
              error={!!errors.password}
              errorMessage={errors.password}
            />

            <CountrySelector
              label={t('country')}
              value={formData.countryName}
              onSelect={handleCountrySelect}
              required
              error={errors.country}
              i18n={{
                title:             t('common:countrySelector.title'),
                searchPlaceholder: t('common:countrySelector.searchPlaceholder'),
                resultOne:         t('common:countrySelector.resultOne'),
                resultMany:        t('common:countrySelector.resultMany'),
                retry:             t('common:countrySelector.retry'),
                errorLoad:         t('common:countrySelector.errorLoad'),
                errorNetwork:      t('common:countrySelector.errorNetwork'),
                emptyResult:       t('common:countrySelector.emptyResult'),
              }}
            />

            <FloatingLabelInput
              label={t('city')}
              value={formData.city}
              onChangeText={(value) => setField('city', value)}
              iconName="location-outline"
              editable={!loading}
              error={!!errors.city}
              errorMessage={errors.city}
            />

            <FloatingLabelInput
              label={t('dateOfBirth')}
              value={formData.dob}
              onChangeText={(value) => setField('dob', value)}
              iconName="calendar-outline"
              isDatePicker
              datePickerPlaceholder={t('common:datePicker.placeholder')}
              required
              editable={!loading}
              error={!!errors.dob}
              errorMessage={errors.dob}
            />

            {/* ✅ Gender — displays translated label, stores English key for API */}
            <FloatingLabelInput
              label={t('register:Gender.gender')}
              value={formData.genderLabel}
              onChangeText={handleGenderSelect}
              iconName="people-outline"
              isDropdown
              options={GENDER_LABELS}
              editable={!loading}
              error={!!errors.gender}
              errorMessage={errors.gender}
            />

            {/* Terms & Conditions */}
            <View style={registerStyles.termsContainer}>
              <TouchableOpacity
                style={[
                  registerStyles.checkbox,
                  formData.acceptedTerms && registerStyles.checkboxActive,
                ]}
                onPress={() => setField('acceptedTerms', !formData.acceptedTerms)}
                activeOpacity={0.8}
                disabled={loading}
              >
                {formData.acceptedTerms && (
                  <Ionicons name="checkmark" size={16} color="#fff" />
                )}
              </TouchableOpacity>

              <TouchableOpacity disabled={loading}>
                <Text style={registerStyles.termsText}>
                  {t('termsAndConditions')}
                </Text>
              </TouchableOpacity>
            </View>
            {errors.terms && (
              <Text style={registerStyles.errorText}>{errors.terms}</Text>
            )}

            {/* Device Error */}
            {errors.device && (
              <Text style={registerStyles.errorText}>{errors.device}</Text>
            )}

            {/* Submit Button */}
            <View style={registerStyles.buttonSection}>
              <TouchableOpacity
                style={[commonStyles.primaryButton, loading && { opacity: 0.7 }]}
                onPress={handleSubmit}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={commonStyles.primaryButtonText}>
                    {t('common:buttons.save')}
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Divider */}
            <View style={registerStyles.divider}>
              <View style={registerStyles.dividerLine} />
              <Text style={registerStyles.dividerText}>{t('login:or')}</Text>
              <View style={registerStyles.dividerLine} />
            </View>

            {/* Login Link */}
            <TouchableOpacity
              style={registerStyles.registerButton}
              onPress={() => navigation.navigate('LoginScreen')}
              activeOpacity={0.8}
              disabled={loading}
            >
              <Text style={registerStyles.registerText}>
                {t('register:account')}{' '}
                <Text style={registerStyles.registerLink}>
                  {t('register:loginNow')}
                </Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default RegisterScreen;