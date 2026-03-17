import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ActivityIndicator,
    TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { otpService } from '../../../services/otpService';
import { toastError } from '../../../../utils/toast';
import { forgotStyles } from '../../../styles/forgetPassword.styles';
import { commonStyles, colors } from '../../../styles/common.styles'; // ✅ IMPORT colors

// ─── Constants ───────────────────────────────────────────────────
const OTP_LENGTH = 6;
const INITIAL_COUNTDOWN = 60;

// ─── Props ───────────────────────────────────────────────────────
interface OtpStepProps {
    email: string;
    verificationToken: string;
    onNext: (passwordResetToken: string) => void;
    onBack: () => void;
    onResend: () => void;
}

// ─── Component ───────────────────────────────────────────────────
const OtpStep: React.FC<OtpStepProps> = ({
    email,
    verificationToken,
    onNext,
    onBack,
    onResend,
}) => {
    const { t } = useTranslation(['forget', 'otp', 'common']);

    const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [resending, setResending] = useState(false);
    const [countdown, setCountdown] = useState(INITIAL_COUNTDOWN);
    const [canResend, setCanResend] = useState(false);

    const inputRefs = useRef<TextInput[]>([]);

    // ── Countdown ────────────────────────────────────────────────
    useEffect(() => {
        if (countdown <= 0) { setCanResend(true); return; }
        const timer = setTimeout(() => setCountdown((p) => p - 1), 1000);
        return () => clearTimeout(timer);
    }, [countdown]);

    // ── Toast error helper ───────────────────────────────────────
    const showError = useCallback((titleKey: string, msgKey: string) => {
        toastError(t(titleKey), t(msgKey));
    }, [t]);

    // ── Error handler — centralized ──────────────────────────────
    const handleError = useCallback((errCode: string, err: any) => {
        switch (errCode) {
            case 'verification_token_invalid':
                setError(t('otp:errors.tokenInvalid'));
                showError('otp:errors.tokenInvalidTitle', 'otp:errors.tokenInvalid');
                break;
            case 'otp_invalid':
            case 'otp_incorrect':
                setError(t('otp:errors.invalid'));
                showError('otp:errors.invalidTitle', 'otp:errors.invalid');
                break;
            case 'otp_expired':
                setError(t('otp:errors.expired'));
                showError('otp:errors.expiredTitle', 'otp:errors.expired');
                break;
            case 'otp_max_attempts':
            case 'otp_too_many_attempts':
                setError(t('otp:errors.tooManyAttempts'));
                showError('otp:errors.tooManyAttemptsTitle', 'otp:errors.tooManyAttempts');
                break;
            case 'token_failed':
                showError('otp:errors.tokenFailedTitle', 'otp:errors.tokenFailed');
                break;
            default:
                if (err.request && !err.response) {
                    showError('otp:errors.noConnectionTitle', 'otp:errors.noConnection');
                } else {
                    showError('otp:errors.genericErrorTitle', 'otp:errors.genericError');
                }
                break;
        }
    }, [t, showError]);

    // ── OTP input ────────────────────────────────────────────────
    const handleChange = useCallback((text: string, index: number) => {
        const cleaned = text.replace(/[^0-9]/g, '').slice(-1);
        const newOtp = [...otp];
        newOtp[index] = cleaned;
        setOtp(newOtp);
        setError('');

        if (cleaned && index < OTP_LENGTH - 1) {
            inputRefs.current[index + 1]?.focus();
        }

        if (cleaned && index === OTP_LENGTH - 1) {
            const full = [...newOtp.slice(0, OTP_LENGTH - 1), cleaned].join('');
            if (full.length === OTP_LENGTH) handleVerify(full);
        }
    }, [otp]);

    // ── Backspace ────────────────────────────────────────────────
    const handleKeyPress = useCallback((key: string, index: number) => {
        if (key === 'Backspace' && !otp[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    }, [otp]);

    // ── Verify OTP ───────────────────────────────────────────────
    const handleVerify = useCallback(async (code?: string) => {
        const otpCode = code ?? otp.join('');

        if (otpCode.length < OTP_LENGTH) {
            setError(t('otp:errors.incomplete'));
            return;
        }

        setLoading(true);
        setError('');

        try {
            const data = await otpService.verify({
                verification_token: verificationToken,
                otp: otpCode,
                purpose: 'forgot_password',
            });

            if (data.success && data.data?.password_reset_token) {
                onNext(data.data.password_reset_token);
            }

        } catch (err: any) {
            handleError(err.response?.data?.error ?? 'unknown_error', err);
        } finally {
            setLoading(false);
        }
    }, [otp, verificationToken, onNext, handleError, t]);

    // ── Resend OTP ───────────────────────────────────────────────
    const handleResend = useCallback(async () => {
        if (!canResend || resending) return;

        setResending(true);
        setError('');

        try {
            const data = await otpService.resend({
                verification_token: verificationToken,
                purpose: 'forgot_password',
            });

            if (data.success) {
                setCountdown(INITIAL_COUNTDOWN);
                setCanResend(false);
                setOtp(Array(OTP_LENGTH).fill(''));
                inputRefs.current[0]?.focus();
                onResend();
            }
        } catch (err: any) {
            handleError(err.response?.data?.error ?? 'unknown_error', err);
        } finally {
            setResending(false);
        }
    }, [canResend, resending, verificationToken, onResend, handleError]);

    // ── Render ───────────────────────────────────────────────────
    return (
        <View style={forgotStyles.container}>

            {/* Icon */}
            <View style={forgotStyles.iconCircle}>
                <Ionicons name="mail-open-outline" size={38} color={colors.primary} /> {/* ✅ USE colors.primary */}
            </View>

            {/* Title & Subtitle */}
            <Text style={commonStyles.title}>
                {t('forget:otpStep.title')}
            </Text>
            <Text style={commonStyles.subtitle}>
                {t('forget:otpStep.subtitle')}
            </Text>
            <Text style={forgotStyles.email}>{email}</Text>

            {/* OTP Inputs */}
            <View style={forgotStyles.otpRow}>
                {otp.map((digit, index) => (
                    <TextInput
                        key={index}
                        ref={(ref) => { if (ref) inputRefs.current[index] = ref; }}
                        style={[
                            forgotStyles.otpInput,
                            digit ? forgotStyles.otpFilled : {},
                            !!error ? forgotStyles.otpError : {},
                        ]}
                        value={digit}
                        onChangeText={(text) => handleChange(text, index)}
                        onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
                        keyboardType="number-pad"
                        maxLength={1}
                        selectTextOnFocus
                        textAlign="center"
                    />
                ))}
            </View>

            {/* Error */}
            {!!error && (
                <Text style={forgotStyles.errorText}>
                    <Ionicons name="alert-circle-outline" size={13} color="#ef4444" /> {error}
                </Text>
            )}

            {/* Verify Button */}
            <TouchableOpacity
                style={[
                    commonStyles.primaryButton,
                    { width: "100%" },
                    loading && { opacity: 0.7 },
                ]}
                onPress={() => handleVerify()}
                disabled={loading}
                activeOpacity={0.8}
            >
                {loading
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={commonStyles.primaryButtonText}>
                        {t('otp:verifyButton')}
                    </Text>
                }
            </TouchableOpacity>

            {/* Resend */}
            <View style={forgotStyles.resendRow}>
                <Text style={commonStyles.subtitle}>{t('otp:didntReceive')}</Text>
                {canResend ? (
                    <TouchableOpacity onPress={handleResend} disabled={resending}>
                        {resending
                            ? <ActivityIndicator size="small" color={colors.primary} />
                            : <Text style={forgotStyles.resendLink}>
                                {t('forget:otpStep.resendOtp')}
                            </Text>
                        }
                    </TouchableOpacity>
                ) : (
                    <Text style={forgotStyles.countdown}>
                        {t('forget:otpStep.resendIn', {
                            seconds: String(countdown).padStart(2, '0')
                        })}
                    </Text>
                )}
            </View>

            {/* Back */}
            <TouchableOpacity
                style={forgotStyles.backButton}
                onPress={onBack}
                activeOpacity={0.7}
            >
                <Ionicons name="arrow-back-outline" size={16} color="#6b7280" />
                <Text style={commonStyles.subtitle}>
                    {t('forget:otpStep.changeEmail')}
                </Text>
            </TouchableOpacity>

        </View>
    );
};

OtpStep.displayName = 'OtpStep';

export default OtpStep;