import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import Toast from 'react-native-toast-message';
import { AppHeader } from '../../components/common/AppHeader';
import { Button } from '../../components/ui';
import { commonStyles, palette } from '../../styles/common.styles';
import { optStyles } from '../../styles/OtpScreen.styles';
import { OTPVerificationScreenProps } from '../../types/navigation';
import { tokenService } from '../../services/tokenService';
import { otpService } from '../../services/otpService';
import { toastSuccess } from '../../../utils/toast';
import { usePendingRegistration } from '../../hooks/usePendingRegistration';
import { API_CONFIG, getDeviceId } from '../../constants/config';
import { useAuth } from '../../context/AuthContext';
import { analyticsService } from '../../services/analyticsService';

const OTP_LENGTH = 6;
const INITIAL_COUNTDOWN = 60;

const OTPVerificationScreen: React.FC<OTPVerificationScreenProps> = ({
  navigation,
  route,
}) => {
  const { t } = useTranslation(['otp', 'common']);
  const { email, verification_token, purpose } = route.params;
  const { login } = useAuth(); // ✅ get login() from context

  // ✅ Moving an account to a new phone reuses this whole screen; only the
  // copy and a couple of analytics calls differ.
  const isDeviceChange = purpose === 'device_change';

  const { handleAfterAuth } = usePendingRegistration(navigation);

  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(INITIAL_COUNTDOWN);
  const [canResend, setCanResend] = useState(false);
  const [error, setError] = useState('');

  const inputRefs = useRef<TextInput[]>([]);

  const showErrorToast = useCallback((title: string, message: string) => {
    Toast.show({
      type: "error",
      text1: title,
      text2: message,
      position: "top",
      visibilityTime: 4000,
    });
  }, []);

  useEffect(() => {
    if (countdown <= 0) {
      setCanResend(true);
      return;
    }
    const timer = setTimeout(() => setCountdown((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleOtpChange = useCallback(
    (text: string, index: number) => {
      const cleaned = text.replace(/[^0-9]/g, '').slice(-1);
      const newOtp = [...otp];
      newOtp[index] = cleaned;
      setOtp(newOtp);
      setError('');

      if (cleaned && index < OTP_LENGTH - 1) {
        inputRefs.current[index + 1]?.focus();
      }

      if (cleaned && index === OTP_LENGTH - 1) {
        const fullOtp = [...newOtp.slice(0, OTP_LENGTH - 1), cleaned].join('');
        if (fullOtp.length === OTP_LENGTH) handleVerify(fullOtp);
      }
    },
    [otp]
  );

  const handleKeyPress = useCallback(
    (key: string, index: number) => {
      if (key === 'Backspace' && !otp[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    },
    [otp]
  );

  const handleVerify = useCallback(
    async (otpCode?: string) => {
      const code = otpCode ?? otp.join('');
      if (code.length < OTP_LENGTH) {
        setError(t('otp:errors.incomplete'));
        return;
      }

      setLoading(true);
      setError('');

      try {
        // The server bound the target device when the code was requested and
        // refuses to complete on any other handset, so this must be sent.
        const data = await otpService.verify({
          verification_token,
          otp: code,
          purpose,
          ...(isDeviceChange ? { device_id: await getDeviceId() } : {}),
        });

        if (data.success && data.data?.token) {
          const customerId = data.data?.customer?.customer_app_id ?? 0;
          await tokenService.saveToken(data.data.token);
          await tokenService.saveCustomerId(customerId);

          if (API_CONFIG.DEBUG) console.log('✅ OTP verified, token saved');

          void analyticsService.logAuthStep(
            isDeviceChange ? 'device_change_verified' : 'otp_verified',
          );
          // sign_up fires HERE, not on the register call — this is the first
          // moment the account is actually usable. A token is also issued, so
          // a registration is a login too.
          if (purpose === 'registration') {
            void analyticsService.logSignUp('email');
          }
          void analyticsService.logLogin(isDeviceChange ? 'device_change' : 'otp');

          toastSuccess(
            isDeviceChange ? t('otp:deviceChange.successTitle') : t('otp:success.title'),
            isDeviceChange ? t('otp:deviceChange.successMessage') : t('otp:success.message'),
          );
          // Was: login() with no argument. AuthContext types login as
          // (userId: string) => void and AppNavigator passes it straight to
          // analyticsService.setUserIdentity — so every OTP-verified user (i.e.
          // every NEW registration) was calling setUserId(analytics, undefined)
          // and never got a Firebase user ID attached.
          login(customerId ? String(customerId) : '');
          await handleAfterAuth();
        }
      } catch (error: any) {
        const errorData = error.response?.data;
        const errorCode = errorData?.error || 'unknown_error';

        // Failures are the point of this funnel: otp_sent -> otp_verified is
        // where entrants are lost, and the error CODE says why. Never the
        // message, never the code the user typed.
        void analyticsService.logAuthStep('otp_failed', errorCode);

        switch (errorCode) {
          case 'verification_token_invalid':
            setError(t('otp:errors.tokenInvalid'));
            showErrorToast(t('otp:errors.tokenInvalidTitle'), t('otp:errors.tokenInvalid'));
            break;
          case 'otp_invalid':
          case 'otp_incorrect':
            setError(t('otp:errors.invalid'));
            showErrorToast(t('otp:errors.invalidTitle'), t('otp:errors.invalid'));
            break;
          case 'otp_expired':
            setError(t('otp:errors.expired'));
            showErrorToast(t('otp:errors.expiredTitle'), t('otp:errors.expired'));
            break;
          case 'already_verified':
            showErrorToast(t('otp:errors.alreadyVerifiedTitle'), t('otp:errors.alreadyVerified'));
            setTimeout(() => navigation.replace('LoginScreen'), 2000);
            break;
          case 'otp_max_attempts':
          case 'otp_too_many_attempts':
            setError(t('otp:errors.tooManyAttempts'));
            showErrorToast(t('otp:errors.tooManyAttemptsTitle'), t('otp:errors.tooManyAttempts'));
            break;
          case 'token_failed':
            showErrorToast(t('otp:errors.tokenFailedTitle'), t('otp:errors.tokenFailed'));
            break;
          // ── device transfer ──────────────────────────────────────────
          case 'device_change_device_mismatch':
            // The code was entered on a phone other than the one that asked
            // for it. The pending transfer is burned server-side.
            setError(t('otp:errors.deviceMismatch'));
            showErrorToast(
              t('otp:errors.deviceMismatchTitle'),
              t('otp:errors.deviceMismatch'),
            );
            break;
          case 'device_change_conflict':
            showErrorToast(t('otp:errors.conflictTitle'), t('otp:errors.conflict'));
            break;
          case 'device_already_registered':
            showErrorToast(
              t('otp:errors.deviceTakenTitle'),
              t('otp:errors.deviceTaken'),
            );
            break;
          case 'otp_max_resends':
            setError(t('otp:errors.maxResends'));
            showErrorToast(t('otp:errors.maxResendsTitle'), t('otp:errors.maxResends'));
            break;
          case 'account_disabled':
            showErrorToast(
              t('otp:errors.accountDisabledTitle'),
              t('otp:errors.accountDisabled'),
            );
            break;
          default:
            if (error.request && !error.response) {
              showErrorToast(t('otp:errors.noConnectionTitle'), t('otp:errors.noConnection'));
            } else {
              showErrorToast(t('otp:errors.genericErrorTitle'), t('otp:errors.genericError'));
            }
            break;
        }
      } finally {
        setLoading(false);
      }
    },
    // `purpose` / `isDeviceChange` must be listed: they now drive which request
    // is sent and which copy is shown, so a stale closure would submit the
    // wrong purpose.
    [otp, verification_token, purpose, isDeviceChange, handleAfterAuth, login, showErrorToast, t, navigation]
  );

  const handleResend = useCallback(async () => {
    if (!canResend || resending) return;
    setResending(true);
    setError('');

    try {
      const data = await otpService.resend({ verification_token, purpose });
      if (data.success) {
        setCountdown(INITIAL_COUNTDOWN);
        setCanResend(false);
        setOtp(Array(OTP_LENGTH).fill(''));
        inputRefs.current[0]?.focus();
        void analyticsService.logAuthStep('otp_resent');
        toastSuccess(t('otp:resendSuccess'), t('otp:resendSuccessMessage'));
      }
    } catch (error: any) {
      const errorData = error.response?.data;
      const errorCode = errorData?.error || 'unknown_error';
      switch (errorCode) {
        case 'otp_too_many_attempts':
        case 'otp_max_attempts':
          setError(t('otp:errors.tooManyAttempts'));
          showErrorToast(t('otp:errors.tooManyAttemptsTitle'), t('otp:errors.tooManyAttempts'));
          break;
        case 'verification_token_invalid':
          showErrorToast(t('otp:errors.tokenInvalidTitle'), t('otp:errors.tokenInvalid'));
          break;
        case 'otp_max_resends':
          // Resends are capped per request. Uncapped, they reset the wrong-code
          // counter and let a 6-digit code be brute-forced indefinitely.
          setError(t('otp:errors.maxResends'));
          showErrorToast(t('otp:errors.maxResendsTitle'), t('otp:errors.maxResends'));
          break;
        case 'account_disabled':
          showErrorToast(
            t('otp:errors.accountDisabledTitle'),
            t('otp:errors.accountDisabled'),
          );
          break;
        default:
          if (error.request && !error.response) {
            showErrorToast(t('otp:errors.noConnectionTitle'), t('otp:errors.noConnection'));
          } else {
            showErrorToast(t('otp:errors.genericErrorTitle'), t('otp:errors.genericError'));
          }
          break;
      }
    } finally {
      setResending(false);
    }
  }, [canResend, resending, verification_token, purpose, showErrorToast, t]);

  return (
    <SafeAreaView style={commonStyles.container} edges={['bottom']}>
      <AppHeader title={t('common:band.verifyEmail')} showLogo={true} showBack />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={optStyles.inner}
          keyboardShouldPersistTaps="handled"
        >
          <View style={optStyles.headerSection}>
            <View style={optStyles.iconCircle}>
              <Ionicons
                name={isDeviceChange ? 'phone-portrait-outline' : 'mail-outline'}
                size={40}
                color="{palette.navy}"
              />
            </View>
            <Text style={optStyles.title}>
              {isDeviceChange ? t('otp:deviceChange.title') : t('otp:title')}
            </Text>
            <Text style={optStyles.subtitle}>
              {isDeviceChange ? t('otp:deviceChange.subtitle') : t('otp:subtitle')}
            </Text>
            <Text style={optStyles.email}>{email ?? ''}</Text>
          </View>

          <View style={optStyles.otpContainer}>
            {otp.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => { if (ref) inputRefs.current[index] = ref; }}
                style={[
                  optStyles.otpInput,
                  digit ? optStyles.otpInputFilled : {},
                  error ? optStyles.otpInputError : {},
                ]}
                value={digit}
                onChangeText={(text) => handleOtpChange(text, index)}
                onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
                keyboardType="number-pad"
                maxLength={1}
                selectTextOnFocus
                textAlign="center"
                editable={!loading}
              />
            ))}
          </View>

          {!!error && (
            <Text style={optStyles.errorText}>
              <Ionicons name="alert-circle-outline" size={13} color={palette.danger} /> {error}
            </Text>
          )}

          <Button
            label={t('otp:verifyButton')}
            onPress={() => handleVerify()}
            loading={loading}
            style={optStyles.verifyButton}
          />

          <View style={optStyles.resendContainer}>
            <Text style={optStyles.resendLabel}>{t('otp:didntReceive')} </Text>
            {canResend ? (
              <TouchableOpacity onPress={handleResend} disabled={resending}>
                {resending ? (
                  <ActivityIndicator size="small" color={palette.warning} />
                ) : (
                  <Text style={optStyles.resendLink}>{t('otp:resend')}</Text>
                )}
              </TouchableOpacity>
            ) : (
              <Text style={optStyles.countdown}>{t('otp:resendIn')} {countdown}s</Text>
            )}
          </View>

          {/* 05_OTP.png: where the code actually went, and a way back if the
              address was mistyped. */}
          <View style={optStyles.notArrivedCard}>
            <Text style={optStyles.notArrivedTitle}>{t('otp:notArrived.title')}</Text>
            <Text style={optStyles.notArrivedBody}>{t('otp:notArrived.spam')}</Text>
            <View style={optStyles.notArrivedRow}>
              <Text style={optStyles.notArrivedBody}>{t('otp:notArrived.wrongAddress')}</Text>
              <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button">
                <Text style={optStyles.notArrivedLink}>{t('otp:notArrived.changeEmail')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default OTPVerificationScreen;