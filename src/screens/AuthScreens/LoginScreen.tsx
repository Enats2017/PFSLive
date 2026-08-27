import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { AppHeader } from '../../components/common/AppHeader';
import FloatingLabelInput from '../../components/FloatingLabelInput';
import DeviceTransferModal from '../../components/DeviceTransferModal';
import { authService } from '../../services/authService';
import { validateLoginForm } from '../../services/validation/authValidation';
import { commonStyles } from '../../styles/common.styles';
import { loginStyles } from '../../styles/login.styles';
import { LoginScreenProps } from '../../types/navigation';
import { toastSuccess, toastError } from '../../../utils/toast';
import { useAuthForm } from '../../hooks/useAuthForm';
import { usePendingRegistration } from '../../hooks/usePendingRegistration';
import { useAuth } from '../../context/AuthContext';
import { useDimensions } from '../../hooks/useDimensions';
import { analyticsService } from '../../services/analyticsService';

const INITIAL_FORM_DATA = {
  email: '',
  password: '',
};

const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
  const { t } = useTranslation(['login', 'common']);
  const { login } = useAuth(); // ✅ get login() from context
  const { width } = useDimensions();
  const insets = useSafeAreaInsets(); 
  const isGestureNav = insets.bottom > 0;
  const isLandscape = width 

  const { formData, errors, setField, setErrors, clearAllErrors } =
    useAuthForm(INITIAL_FORM_DATA);
  const { handleAfterAuth } = usePendingRegistration(navigation);

  const [loading, setLoading] = useState(false);

  // ✅ Device transfer. Offered when login comes back `device_not_allowed`,
  // i.e. the account is bound to a different phone. The password stays in
  // formData and is handed straight to requestDeviceChange — it is never
  // persisted and never put into navigation params, which are serializable.
  const [deviceModalVisible, setDeviceModalVisible] = useState(false);
  const [deviceRequestLoading, setDeviceRequestLoading] = useState(false);

  const handleLogin = useCallback(async () => {
    clearAllErrors();

    const validationErrors = validateLoginForm(
      { email: formData.email, password: formData.password },
      t
    );

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      const firstError = Object.values(validationErrors)[0];
      if (firstError) toastError(t('login:errors.validationFailed'), firstError);
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
        // GA4 recommended event — fires only on a confirmed successful login.
        void analyticsService.logLogin('password');
        const customerId = response.data?.customer?.customer_app_id;
        login(customerId ? String(customerId) : ''); // ✅ flip isLoggedIn → auth screens unmount, protected screens mount
        await handleAfterAuth();
      }
    } catch (error: any) {
      const data = error.response?.data;
      const errorCode = data?.error || 'unknown_error';

      switch (errorCode) {
        case 'email_invalid':
          setErrors({ email: t('login:errors.emailInvalid') });
          toastError(t('login:errors.emailInvalidTitle'), t('login:errors.emailInvalid'));
          break;
        case 'password_required':
          setErrors({ password: t('login:errors.passwordRequired') });
          toastError(t('login:errors.passwordRequiredTitle'), t('login:errors.passwordRequired'));
          break;
        case 'invalid_credentials':
          setErrors({ password: t('login:errors.invalidCredentials') });
          toastError(t('login:errors.invalidCredentialsTitle'), t('login:errors.invalidCredentials'));
          break;
        case 'email_not_verified':
          toastError(t('login:errors.emailNotVerifiedTitle'), t('login:errors.emailNotVerified'));
          break;
        case 'account_disabled':
          toastError(t('login:errors.accountDisabledTitle'), t('login:errors.accountDisabled'));
          break;
        case 'device_not_allowed':
          // Was a dead-end toast telling the user to email support. The
          // password has already been verified server-side to reach this
          // error, so offer the transfer instead of ending the journey here.
          setDeviceModalVisible(true);
          break;
        case 'device_already_registered':
          // This phone belongs to a different account, so the transfer flow
          // cannot help — it would be refused for the same reason. Say so
          // directly rather than opening a modal that leads nowhere.
          toastError(
            t('login:deviceTransfer.errors.deviceTakenTitle'),
            t('login:deviceTransfer.errors.deviceTaken'),
          );
          break;
        case 'token_failed':
          toastError(t('login:errors.tokenFailedTitle'), t('login:errors.tokenFailed'));
          break;
        case 'account_not_found':
          setErrors({ email: t('login:errors.accountNotFound') });
          toastError(t('login:errors.accountNotFoundTitle'), t('login:errors.accountNotFound'));
          break;
        default:
          if (error.request && !error.response) {
            toastError(t('login:errors.noConnectionTitle'), t('login:errors.noConnection'));
          } else {
            toastError(t('login:errors.genericErrorTitle'), t('login:errors.genericError'));
          }
          break;
      }
    } finally {
      setLoading(false);
    }
  }, [formData, clearAllErrors, setErrors, handleAfterAuth, login, t]);

  const handleDeviceTransfer = useCallback(async () => {
    setDeviceRequestLoading(true);

    try {
      const email = formData.email.trim().toLowerCase();
      const response = await authService.requestDeviceChange(email, formData.password);

      if (response.success && response.data?.verification_token) {
        setDeviceModalVisible(false);
        void analyticsService.logAuthStep('device_change_requested');

        navigation.navigate('OTPVerificationScreen', {
          email,
          verification_token: response.data.verification_token,
          purpose: 'device_change',
        });
      }
    } catch (error: any) {
      const data = error.response?.data;
      const errorCode = data?.error || 'unknown_error';

      void analyticsService.logAuthStep('device_change_failed', errorCode);
      setDeviceModalVisible(false);

      switch (errorCode) {
        case 'device_change_cooldown':
          toastError(
            t('login:deviceTransfer.errors.cooldownTitle'),
            t('login:deviceTransfer.errors.cooldown', {
              days: data?.data?.retry_after_days ?? 30,
            }),
          );
          break;
        case 'device_change_too_many_requests':
        case 'device_change_too_soon':
          toastError(
            t('login:deviceTransfer.errors.tooManyRequestsTitle'),
            t('login:deviceTransfer.errors.tooManyRequests'),
          );
          break;
        case 'device_already_registered':
          toastError(
            t('login:deviceTransfer.errors.deviceTakenTitle'),
            t('login:deviceTransfer.errors.deviceTaken'),
          );
          break;
        case 'device_change_recent_password_reset':
          toastError(
            t('login:deviceTransfer.errors.recentPasswordResetTitle'),
            t('login:deviceTransfer.errors.recentPasswordReset'),
          );
          break;
        case 'device_change_not_needed':
          toastError(
            t('login:deviceTransfer.errors.notNeededTitle'),
            t('login:deviceTransfer.errors.notNeeded'),
          );
          break;
        case 'device_id_invalid':
        case 'device_id_required':
          toastError(
            t('login:deviceTransfer.errors.deviceIdTitle'),
            t('login:deviceTransfer.errors.deviceId'),
          );
          break;
        case 'invalid_credentials':
          setErrors({ password: t('login:errors.invalidCredentials') });
          toastError(
            t('login:errors.invalidCredentialsTitle'),
            t('login:errors.invalidCredentials'),
          );
          break;
        default:
          if (error.request && !error.response) {
            toastError(t('login:errors.noConnectionTitle'), t('login:errors.noConnection'));
          } else {
            toastError(t('login:errors.genericErrorTitle'), t('login:errors.genericError'));
          }
          break;
      }
    } finally {
      setDeviceRequestLoading(false);
    }
  }, [formData, navigation, setErrors, t]);

  return (
    <SafeAreaView style={commonStyles.container} edges={isLandscape && !isGestureNav ? ['top', 'left','right'] : ['top']}>
      <StatusBar barStyle="dark-content" />
      <AppHeader showLogo={true} showBack />

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
            <View style={loginStyles.headerSection}>
              <View style={loginStyles.cardscetion}>
                <Image
                  source={require('../../../assets/livio_logo_transparent.png')}
                  style={loginStyles.logo}
                  contentFit="contain"
                />
              </View>
              <Text style={loginStyles.title}>{t('login:title')}</Text>
              <Text style={loginStyles.subtitle}>{t('login:subtitle')}</Text>
            </View>

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

              <TouchableOpacity
                style={loginStyles.forgotButton}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('ForgotPassword')}
                disabled={loading}
              >
                <Text style={loginStyles.forgotText}>{t('login:forgotPassword')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[commonStyles.primaryButton, loading && { opacity: 0.7 }]}
                onPress={handleLogin}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={commonStyles.primaryButtonText}>{t('login:loginButton')}</Text>
                )}
              </TouchableOpacity>

              <View style={loginStyles.divider}>
                <View style={loginStyles.dividerLine} />
                <Text style={loginStyles.dividerText}>{t('login:or')}</Text>
                <View style={loginStyles.dividerLine} />
              </View>

              <TouchableOpacity
                style={loginStyles.registerButton}
                onPress={() => navigation.navigate('RegisterScreen')}
                activeOpacity={0.8}
                disabled={loading}
              >
                <Text style={loginStyles.registerText}>
                  {t('login:noAccount')}{' '}
                  <Text style={loginStyles.registerLink}>{t('login:registerNow')}</Text>
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <DeviceTransferModal
        visible={deviceModalVisible}
        email={formData.email.trim().toLowerCase()}
        loading={deviceRequestLoading}
        onConfirm={handleDeviceTransfer}
        onClose={() => setDeviceModalVisible(false)}
      />
    </SafeAreaView>
  );
};

export default LoginScreen;