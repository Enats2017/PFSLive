import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
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
import { AppHeader } from '../components/common/AppHeader';
import { commonStyles } from '../styles/common.styles';
import { optStyles } from '../styles/OtpScreen.styles';
import { OTPVerificationScreenProps } from '../types/navigation';
import { tokenService } from '../services/tokenService';
import { otpService } from '../services/otpService';
import { toastSuccess } from '../../utils/toast';
import { usePendingRegistration } from '../hooks/usePendingRegistration';
import { API_CONFIG } from '../constants/config';

const OTP_LENGTH = 6;
const INITIAL_COUNTDOWN = 60;

const OTPVerificationScreen: React.FC<OTPVerificationScreenProps> = ({
  navigation,
  route,
}) => {
  const { t } = useTranslation(['otp', 'common']);
  const { email, verification_token } = route.params;

  const { handleAfterAuth } = usePendingRegistration(navigation);

  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(INITIAL_COUNTDOWN);
  const [canResend, setCanResend] = useState(false);
  const [error, setError] = useState('');

  const inputRefs = useRef<TextInput[]>([]);

  // ✅ CUSTOM TOAST ERROR (LOCAL TO THIS SCREEN)
  const showErrorToast = useCallback((title: string, message: string) => {
    Toast.show({
      type: "error",
      text1: title,
      text2: message,
      position: "top",
      visibilityTime: 4000,
    });
  }, []);

  // ✅ COUNTDOWN TIMER
  useEffect(() => {
    if (countdown <= 0) {
      setCanResend(true);
      return;
    }

    const timer = setTimeout(() => setCountdown((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  // ✅ HANDLE OTP INPUT
  const handleOtpChange = useCallback(
    (text: string, index: number) => {
      const cleaned = text.replace(/[^0-9]/g, '').slice(-1);
      const newOtp = [...otp];
      newOtp[index] = cleaned;
      setOtp(newOtp);
      setError('');

      // Auto move to next input
      if (cleaned && index < OTP_LENGTH - 1) {
        inputRefs.current[index + 1]?.focus();
      }

      // Auto submit when all filled
      if (cleaned && index === OTP_LENGTH - 1) {
        const fullOtp = [...newOtp.slice(0, OTP_LENGTH - 1), cleaned].join('');
        if (fullOtp.length === OTP_LENGTH) {
          handleVerify(fullOtp);
        }
      }
    },
    [otp]
  );

  // ✅ HANDLE BACKSPACE
  const handleKeyPress = useCallback(
    (key: string, index: number) => {
      if (key === 'Backspace' && !otp[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    },
    [otp]
  );

  // ✅ VERIFY OTP
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
        const data = await otpService.verify({
          verification_token,
          otp: code,
        });

        // ✅ HANDLE SUCCESS
        if (data.success && data.data?.token) {
          await tokenService.saveToken(data.data.token);

          if (API_CONFIG.DEBUG) {
            console.log('✅ OTP verified, token saved');
          }

          toastSuccess(t('otp:success.title'), t('otp:success.message'));
          await handleAfterAuth();
        }
      } catch (error: any) {
        const errorData = error.response?.data;
        const errorCode = errorData?.error || 'unknown_error';

        // ✅ HANDLE ALL ERROR CASES WITH TOAST
        switch (errorCode) {
          case 'verification_token_invalid':
            setError(t('otp:errors.tokenInvalid'));
            showErrorToast(
              t('otp:errors.tokenInvalidTitle'),
              t('otp:errors.tokenInvalid')
            );
            break;

          case 'otp_invalid':
          case 'otp_incorrect':
            setError(t('otp:errors.invalid'));
            showErrorToast(
              t('otp:errors.invalidTitle'),
              t('otp:errors.invalid')
            );
            break;

          case 'otp_expired':
            setError(t('otp:errors.expired'));
            showErrorToast(
              t('otp:errors.expiredTitle'),
              t('otp:errors.expired')
            );
            break;

          case 'already_verified':
            showErrorToast(
              t('otp:errors.alreadyVerifiedTitle'),
              t('otp:errors.alreadyVerified')
            );
            // Navigate away since already verified
            setTimeout(() => {
              navigation.replace('LoginScreen');
            }, 2000);
            break;

          case 'otp_max_attempts':
          case 'otp_too_many_attempts':
            setError(t('otp:errors.tooManyAttempts'));
            showErrorToast(
              t('otp:errors.tooManyAttemptsTitle'),
              t('otp:errors.tooManyAttempts')
            );
            break;

          case 'token_failed':
            showErrorToast(
              t('otp:errors.tokenFailedTitle'),
              t('otp:errors.tokenFailed')
            );
            break;

          default:
            // ✅ NETWORK ERROR OR UNKNOWN ERROR
            if (error.request && !error.response) {
              showErrorToast(
                t('otp:errors.noConnectionTitle'),
                t('otp:errors.noConnection')
              );
            } else {
              showErrorToast(
                t('otp:errors.genericErrorTitle'),
                t('otp:errors.genericError')
              );
            }
            break;
        }
      } finally {
        setLoading(false);
      }
    },
    [otp, verification_token, handleAfterAuth, showErrorToast, t, navigation]
  );

  // ✅ RESEND OTP
  const handleResend = useCallback(async () => {
    if (!canResend || resending) return;

    setResending(true);
    setError('');

    try {
      const data = await otpService.resend({ verification_token });

      if (data.success) {
        setCountdown(INITIAL_COUNTDOWN);
        setCanResend(false);
        setOtp(Array(OTP_LENGTH).fill(''));
        inputRefs.current[0]?.focus();

        toastSuccess(
          t('otp:resendSuccess'),
          t('otp:resendSuccessMessage')
        );
      }
    } catch (error: any) {
      const errorData = error.response?.data;
      const errorCode = errorData?.error || 'unknown_error';

      switch (errorCode) {
        case 'otp_too_many_attempts':
        case 'otp_max_attempts':
          setError(t('otp:errors.tooManyAttempts'));
          showErrorToast(
            t('otp:errors.tooManyAttemptsTitle'),
            t('otp:errors.tooManyAttempts')
          );
          break;

        case 'verification_token_invalid':
          showErrorToast(
            t('otp:errors.tokenInvalidTitle'),
            t('otp:errors.tokenInvalid')
          );
          break;

        default:
          if (error.request && !error.response) {
            showErrorToast(
              t('otp:errors.noConnectionTitle'),
              t('otp:errors.noConnection')
            );
          } else {
            showErrorToast(
              t('otp:errors.genericErrorTitle'),
              t('otp:errors.genericError')
            );
          }
          break;
      }
    } finally {
      setResending(false);
    }
  }, [canResend, resending, verification_token, showErrorToast, t]);

  return (
    <SafeAreaView style={commonStyles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      <AppHeader showLogo={true} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={optStyles.inner}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header Section */}
          <View style={optStyles.headerSection}>
            <View style={optStyles.iconCircle}>
              <Ionicons name="mail-outline" size={40} color="#FF5722" />
            </View>
            <Text style={optStyles.title}>{t('otp:title')}</Text>
            <Text style={optStyles.subtitle}>{t('otp:subtitle')}</Text>
            <Text style={optStyles.email}>{email ?? ''}</Text>
          </View>

          {/* OTP Input */}
          <View style={optStyles.otpContainer}>
            {otp.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => {
                  if (ref) inputRefs.current[index] = ref;
                }}
                style={[
                  optStyles.otpInput,
                  digit ? optStyles.otpInputFilled : {},
                  error ? optStyles.otpInputError : {},
                ]}
                value={digit}
                onChangeText={(text) => handleOtpChange(text, index)}
                onKeyPress={({ nativeEvent }) =>
                  handleKeyPress(nativeEvent.key, index)
                }
                keyboardType="number-pad"
                maxLength={1}
                selectTextOnFocus
                textAlign="center"
                editable={!loading}
              />
            ))}
          </View>

          {/* Error Message */}
          {!!error && (
            <Text style={optStyles.errorText}>
              <Ionicons name="alert-circle-outline" size={13} color="#ef4444" />{' '}
              {error}
            </Text>
          )}

          {/* Verify Button */}
          <TouchableOpacity
            style={[
              commonStyles.primaryButton,
              loading && { opacity: 0.7 },
              optStyles.verifyButton,
            ]}
            onPress={() => handleVerify()}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={commonStyles.primaryButtonText}>
                {t('otp:verifyButton')}
              </Text>
            )}
          </TouchableOpacity>

          {/* Resend Section */}
          <View style={optStyles.resendContainer}>
            <Text style={optStyles.resendLabel}>{t('otp:didntReceive')} </Text>
            {canResend ? (
              <TouchableOpacity onPress={handleResend} disabled={resending}>
                {resending ? (
                  <ActivityIndicator size="small" color="#FF5722" />
                ) : (
                  <Text style={optStyles.resendLink}>{t('otp:resend')}</Text>
                )}
              </TouchableOpacity>
            ) : (
              <Text style={optStyles.countdown}>
                {t('otp:resendIn')} {countdown}s
              </Text>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default OTPVerificationScreen;