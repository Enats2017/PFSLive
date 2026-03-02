import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  Alert,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { AppHeader } from '../components/common/AppHeader'; // ✅ FIXED
import { commonStyles } from '../styles/common.styles'; // ✅ FIXED
import { optStyles } from '../styles/OtpScreen.styles'; // ✅ FIXED
import { OTPVerificationScreenProps } from '../types/navigation'; // ✅ FIXED
import { tokenService } from '../services/tokenService'; // ✅ FIXED
import { otpService } from '../services/otpService'; // ✅ FIXED
import { toastError } from '../../utils/toast'; // ✅ CORRECT (one level up)
import { usePendingRegistration } from '../hooks/usePendingRegistration'; // ✅ FIXED
import { API_CONFIG } from '../constants/config'; // ✅ FIXED

// ... rest of the component code remains the same

// ✅ CONSTANTS
const OTP_LENGTH = 6;
const INITIAL_COUNTDOWN = 60;

const OTPVerificationScreen: React.FC<OTPVerificationScreenProps> = ({
  navigation,
  route,
}) => {
  const { t } = useTranslation(['otp', 'common']);
  const { email, verification_token } = route.params;

  // ✅ HOOKS
  const { handleAfterAuth } = usePendingRegistration(navigation);

  // ✅ STATE
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(INITIAL_COUNTDOWN);
  const [canResend, setCanResend] = useState(false);
  const [error, setError] = useState('');

  const inputRefs = useRef<TextInput[]>([]);

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

  // ✅ HANDLE ERROR RESPONSE
  const handleErrorResponse = useCallback(
    (error: any) => {
      const data = error.response?.data;

      if (data?.error === 'otp_invalid') {
        setError(t('otp:errors.invalid'));
      } else if (data?.error === 'otp_expired') {
        setError(t('otp:errors.expired'));
      } else if (data?.error === 'otp_too_many_attempts') {
        setError(t('otp:errors.tooManyAttempts'));
      } else if (error.request) {
        toastError(
          t('otp:alerts.noConnection'),
          t('otp:alerts.noConnectionMessage')
        );
      } else {
        toastError(
          t('common:errors.generic'),
          t('otp:alerts.genericErrorMessage')
        );
      }
    },
    [t]
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

        if (data.success && data.data?.token) {
          await tokenService.saveToken(data.data.token);

          if (API_CONFIG.DEBUG) {
            console.log('✅ OTP verified, token saved');
          }

          await handleAfterAuth();
        }
      } catch (error: any) {
        handleErrorResponse(error);
      } finally {
        setLoading(false);
      }
    },
    [otp, verification_token, handleAfterAuth, handleErrorResponse, t]
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

        Alert.alert(
          t('otp:resendSuccess'),
          t('otp:resendSuccessMessage')
        );
      }
    } catch (error: any) {
      const data = error.response?.data;

      if (data?.error === 'otp_too_many_attempts') {
        setError(t('otp:errors.tooManyAttempts'));
      } else {
        Alert.alert(
          t('common:errors.generic'),
          t('otp:alerts.genericErrorMessage')
        );
      }
    } finally {
      setResending(false);
    }
  }, [canResend, resending, verification_token, t]);

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