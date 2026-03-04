import React, { useState, useCallback } from 'react';
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
import { useTranslation } from 'react-i18next';
import { AppHeader } from '../components/common/AppHeader';
import FloatingLabelInput from '../components/FloatingLabelInput';
import { authService } from '../services/authService';
import { validateLoginForm } from '../services/validation/authValidation';
import { commonStyles } from '../styles/common.styles';
import { loginStyles } from '../styles/login.styles';
import { LoginScreenProps } from '../types/navigation';
import { toastSuccess, toastError } from '../../utils/toast';
import { useAuthForm } from '../hooks/useAuthForm';
import { usePendingRegistration } from '../hooks/usePendingRegistration';

const INITIAL_FORM_DATA = {
  email: '',
  password: '',
};

const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
  const { t } = useTranslation(['login', 'common']);

  const { formData, errors, setField, setErrors, clearAllErrors } =
    useAuthForm(INITIAL_FORM_DATA);
  const { handleAfterAuth } = usePendingRegistration(navigation);

  const [loading, setLoading] = useState(false);

  // ✅ HANDLE LOGIN WITH TOAST ERRORS
  const handleLogin = useCallback(async () => {
    clearAllErrors();

    // Validate form
    const validationErrors = validateLoginForm(
      {
        email: formData.email,
        password: formData.password,
      },
      t
    );

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      
      // ✅ SHOW FIRST VALIDATION ERROR AS TOAST
      const firstError = Object.values(validationErrors)[0];
      if (firstError) {
        toastError(t('login:errors.validationFailed'), firstError);
      }
      return;
    }

    setLoading(true);

    try {
      const response = await authService.login(
        formData.email.trim().toLowerCase(),
        formData.password
      );

      if (response.success) {
        toastSuccess(t('login:success'), t('login:welcomeBack'));
        await handleAfterAuth();
      }
    } catch (error: any) {
      const data = error.response?.data;
      const errorCode = data?.error || 'unknown_error';

      // ✅ HANDLE ALL ERROR CASES WITH TOAST
      switch (errorCode) {
        case 'email_invalid':
          setErrors({ email: t('login:errors.emailInvalid') });
          toastError(
            t('login:errors.emailInvalidTitle'),
            t('login:errors.emailInvalid')
          );
          break;

        case 'password_required':
          setErrors({ password: t('login:errors.passwordRequired') });
          toastError(
            t('login:errors.passwordRequiredTitle'),
            t('login:errors.passwordRequired')
          );
          break;

        case 'invalid_credentials':
          setErrors({ password: t('login:errors.invalidCredentials') });
          toastError(
            t('login:errors.invalidCredentialsTitle'),
            t('login:errors.invalidCredentials')
          );
          break;

        case 'email_not_verified':
          toastError(
            t('login:errors.emailNotVerifiedTitle'),
            t('login:errors.emailNotVerified')
          );
          break;

        case 'account_disabled':
          toastError(
            t('login:errors.accountDisabledTitle'),
            t('login:errors.accountDisabled')
          );
          break;

        case 'device_not_allowed':
          toastError(
            t('login:errors.deviceNotAllowedTitle'),
            t('login:errors.deviceNotAllowed')
          );
          break;

        case 'token_failed':
          toastError(
            t('login:errors.tokenFailedTitle'),
            t('login:errors.tokenFailed')
          );
          break;

        case 'account_not_found':
          setErrors({ email: t('login:errors.accountNotFound') });
          toastError(
            t('login:errors.accountNotFoundTitle'),
            t('login:errors.accountNotFound')
          );
          break;

        default:
          // ✅ NETWORK ERROR OR UNKNOWN ERROR
          if (error.request && !error.response) {
            toastError(
              t('login:errors.noConnectionTitle'),
              t('login:errors.noConnection')
            );
          } else {
            toastError(
              t('login:errors.genericErrorTitle'),
              t('login:errors.genericError')
            );
          }
          break;
      }
    } finally {
      setLoading(false);
    }
  }, [formData, clearAllErrors, setErrors, handleAfterAuth, t]);

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
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={loginStyles.inner}>
            {/* Header Section */}
            <View style={loginStyles.headerSection}>
              <View style={loginStyles.cardscetion}>
                <Image
                  source={require('../../assets/livio_logo.png')}
                  style={loginStyles.logo}
                  resizeMode="contain"
                />
                <View style={loginStyles.textSection}>
                  <Text style={commonStyles.title}>
                    {t('common:app_name')}
                  </Text>
                </View>
              </View>
              <Text style={loginStyles.title}>{t('login:title')}</Text>
              <Text style={loginStyles.subtitle}>{t('login:subtitle')}</Text>
            </View>

            {/* Form Section */}
            <View style={loginStyles.formSection}>
              <FloatingLabelInput
                label={t('login:email')}
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
                label={t('login:password')}
                value={formData.password}
                onChangeText={(value) => setField('password', value)}
                iconName="lock-closed-outline"
                isPassword
                required
                editable={!loading}
                error={!!errors.password}
                errorMessage={errors.password}
              />

              {/* Forgot Password */}
              <TouchableOpacity
                style={loginStyles.forgotButton}
                activeOpacity={0.7}
                onPress={() =>
                  toastError(
                    t('login:forgotPassword'),
                    t('login:errors.forgotPasswordComingSoon')
                  )
                }
                disabled={loading}
              >
                <Text style={loginStyles.forgotText}>
                  {t('login:forgotPassword')}
                </Text>
              </TouchableOpacity>

              {/* Login Button */}
              <TouchableOpacity
                style={[commonStyles.primaryButton, loading && { opacity: 0.7 }]}
                onPress={handleLogin}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={commonStyles.primaryButtonText}>
                    {t('login:loginButton')}
                  </Text>
                )}
              </TouchableOpacity>

              {/* Divider */}
              <View style={loginStyles.divider}>
                <View style={loginStyles.dividerLine} />
                <Text style={loginStyles.dividerText}>{t('login:or')}</Text>
                <View style={loginStyles.dividerLine} />
              </View>

              {/* Register Link */}
              <TouchableOpacity
                style={loginStyles.registerButton}
                onPress={() => navigation.navigate('Register')}
                activeOpacity={0.8}
                disabled={loading}
              >
                <Text style={loginStyles.registerText}>
                  {t('login:noAccount')}{' '}
                  <Text style={loginStyles.registerLink}>
                    {t('login:registerNow')}
                  </Text>
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default LoginScreen;