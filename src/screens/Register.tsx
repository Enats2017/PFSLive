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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import { AppHeader } from '../components/common/AppHeader'; // ✅ FIXED
import FloatingLabelInput from '../components/FloatingLabelInput'; // ✅ FIXED
import CountrySelector from '../components/CountrySelector'; // ✅ FIXED
import { commonStyles } from '../styles/common.styles'; // ✅ FIXED
import { registerStyles } from '../styles/Register.styles'; // ✅ FIXED
import { RegisterProps } from '../types/navigation'; // ✅ FIXED
import { authService } from '../services/authService'; // ✅ FIXED
import { validateRegisterForm } from '../services/validation/authValidation'; // ✅ FIXED
import { toastError, toastSuccess } from '../../utils/toast'; // ✅ CORRECT (one level up)
import { useAuthForm } from '../hooks/useAuthForm'; // ✅ FIXED
import { API_CONFIG } from '../constants/config'; // ✅ FIXED

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
  gender: '',
  profileImage: '',
  acceptedTerms: false,
};

const Register: React.FC<RegisterProps> = ({ navigation }) => {
  const { t } = useTranslation(['register', 'common']);

  // ✅ FORM STATE (CUSTOM HOOK)
  const { formData, errors, setField, setErrors, clearAllErrors } =
    useAuthForm(INITIAL_FORM_DATA);

  const [loading, setLoading] = useState(false);

  // ✅ MEMOIZED GENDER OPTIONS
  const GENDER_OPTIONS = useMemo(
    () => [
      t('register:Gender.male'),
      t('register:Gender.female'),
      t('register:Gender.other'),
    ],
    [t]
  );

  // ✅ IMAGE PICKER
  const pickImage = useCallback(async () => {
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

    // Validate form
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
        gender: formData.gender,
        profileImage: formData.profileImage || undefined,
      });

      if (response.success && response.data?.verification_token) {
        toastSuccess(
          t('register:success'),
          t('register:welcome', { name: formData.firstname })
        );

        navigation.navigate('OTPVerificationScreen', {
          email: response.data.email ?? formData.email,
          verification_token: response.data.verification_token,
        });
      }
    } catch (error: any) {
      const data = error.response?.data;

      if (data?.error === 'email_exists') {
        setErrors({ email: t('register:alerts.email_exists') });
      } else if (data?.error === 'device_already_registered') {
        setErrors({
          device: t('register:errors.deviceAlreadyRegistered'),
        });
      } else if (data?.error === 'device_not_allowed') {
        toastError(
          t('register:alerts.deviceNotAllowed'),
          t('register:alerts.deviceNotAllowedMessage')
        );
      } else if (error.request) {
        toastError(
          t('register:alerts.noConnection'),
          t('register:alerts.noConnectionMessage')
        );
      } else {
        toastError(
          t('register:alerts.genericError'),
          t('register:alerts.genericErrorMessage')
        );
      }
    } finally {
      setLoading(false);
    }
  }, [formData, clearAllErrors, setErrors, navigation, t]);

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
            {/* Profile Image Section */}
            <View style={registerStyles.imagesection}>
              <TouchableOpacity onPress={pickImage} activeOpacity={0.8}>
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
                        <Ionicons name="close" size={14} color="#FF5722" />
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
              required
              editable={!loading}
              error={!!errors.dob}
              errorMessage={errors.dob}
            />

            <FloatingLabelInput
              label={t('register:Gender.gender')}
              value={formData.gender}
              onChangeText={(value) => setField('gender', value)}
              iconName="people-outline"
              isDropdown
              options={GENDER_OPTIONS}
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

export default Register;