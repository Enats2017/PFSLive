import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { AppHeader } from '../components/common/AppHeader'; // ✅ FIXED
import FloatingLabelInput from '../components/FloatingLabelInput'; // ✅ FIXED
import { authService } from '../services/authService'; // ✅ FIXED
import { validateLoginForm } from '../services/validation/authValidation'; // ✅ FIXED
import { commonStyles } from '../styles/common.styles'; // ✅ FIXED
import { loginStyles } from '../styles/login.styles'; // ✅ FIXED
import { LoginScreenProps } from '../types/navigation'; // ✅ FIXED
import { toastSuccess } from '../../utils/toast'; // ✅ CORRECT (one level up)
import { useAuthForm } from '../hooks/useAuthForm'; // ✅ FIXED
import { usePendingRegistration } from '../hooks/usePendingRegistration'; // ✅ FIXED

// ... rest of the component code remains the same

// ✅ CONSTANTS
const INITIAL_FORM_DATA = {
  email: '',
  password: '',
};

const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
  const { t } = useTranslation(['login', 'common']);

  // ✅ HOOKS
  const { formData, errors, setField, setErrors, clearAllErrors } =
    useAuthForm(INITIAL_FORM_DATA);
  const { handleAfterAuth } = usePendingRegistration(navigation);

  const [loading, setLoading] = useState(false);

  // ✅ HANDLE LOGIN
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

      if (data?.error === 'invalid_credentials') {
        setErrors({ password: t('login:errors.invalidCredentials') });
      } else if (data?.error === 'account_not_found') {
        setErrors({ email: t('login:errors.accountNotFound') });
      } else if (data?.error === 'device_not_allowed') {
        Alert.alert(
          t('login:alerts.deviceNotAllowed'),
          t('login:alerts.deviceNotAllowedMessage')
        );
      } else if (error.request) {
        Alert.alert(
          t('login:alerts.noConnection'),
          t('login:alerts.noConnectionMessage')
        );
      } else {
        Alert.alert(
          t('common:errors.generic'),
          t('login:alerts.genericErrorMessage')
        );
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
                  Alert.alert(
                    t('login:forgotPassword'),
                    'Forgot password feature coming soon.'
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