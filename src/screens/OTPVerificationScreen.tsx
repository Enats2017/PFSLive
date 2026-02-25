import React, { useState, useRef, useEffect } from 'react';
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
import axios from 'axios';
import { AppHeader } from '../components/common/AppHeader';
import { commonStyles } from '../styles/common.styles';
import { OTPVerificationScreenProps } from '../types/navigation';
import { API_CONFIG, getApiEndpoint } from '../constants/config';
import { tokenService } from '../services/tokenService';
import { optStyles } from '../styles/OtpScreen.styles';
import { toastError } from '../../utils/toast';

const OTP_LENGTH = 6;

const OTPVerificationScreen: React.FC<OTPVerificationScreenProps> = ({ navigation, route }) => {
    const { t } = useTranslation(['otp', 'common']);
    // Get params from Register screen
    const { email, verification_token } = route.params;
    const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
    const [loading, setLoading] = useState(false);
    const [resending, setResending] = useState(false);
    const [countdown, setCountdown] = useState(60);
    const [canResend, setCanResend] = useState(false);
    const [error, setError] = useState('');

    const inputRefs = useRef<TextInput[]>([]);

    // ── Countdown timer
    useEffect(() => {
        if (countdown <= 0) {
            setCanResend(true);
            return;
        }
        const timer = setTimeout(() => setCountdown((prev) => prev - 1), 1000);
        return () => clearTimeout(timer);
    }, [countdown]);

    // ── Handle OTP input
    const handleOtpChange = (text: string, index: number) => {
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
    };

    const handleKeyPress = (key: string, index: number) => {
        if (key === 'Backspace' && !otp[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handleVerify = async (otpCode?: string) => {
        const code = otpCode ?? otp.join('');

        if (code.length < OTP_LENGTH) {
            setError(t('otp:errors.incomplete'));
            return;
        }

        setLoading(true);
        setError('');

        try {
            const requestBody = {
                verification_token: verification_token,
                otp: code,
            };

            console.log(requestBody);
            const headers = await API_CONFIG.getHeaders();
            const response = await axios.post(
                getApiEndpoint(API_CONFIG.ENDPOINTS.VERIFY_OTP),
                requestBody,
                {
                    headers,

                }
            );
            console.log('OTP Response:', response.data);
            if (response.data.success && response.data.data?.token) {
                await tokenService.saveToken(response.data.data.token);
                console.log(' OTP verified, token saved');
                navigation.reset({
                    index: 0,
                    routes: [{ name: 'Home' }],
                });
            }

        } catch (error: any) {
            console.log('OTP Error:', JSON.stringify(error.response?.data));
            const data = error.response?.data;
            if (data?.error === 'otp_invalid') {
                setError(t('otp:errors.invalid'));
            } else if (data?.error === 'otp_expired') {
                setError(t('otp:errors.expired'));
            } else if (data?.error === 'otp_too_many_attempts') {
                setError(t('otp:errors.tooManyAttempts'));
            } else if (error.request) {
                toastError(t('otp:alerts.noConnection'), t('otp:alerts.noConnectionMessage'));
            } else {
                 toastError(t('common:errors.generic'), t('otp:alerts.genericErrorMessage'));
            }

        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        if (!canResend) return;
        setResending(true);
        setError('');
        try {
            const requestBody = {
                verification_token: verification_token
            }
            const headers = await API_CONFIG.getHeaders();
            const response = await axios.post(
                getApiEndpoint(API_CONFIG.ENDPOINTS.RESEND_OTP),
                requestBody,
                {
                    headers,
                    timeout: API_CONFIG.TIMEOUT,
                }
            );

            if (response.data.success) {
                setCountdown(60);
                setCanResend(false);
                setOtp(Array(OTP_LENGTH).fill(''));
                inputRefs.current[0]?.focus();
                Alert.alert(t('otp:resendSuccess'), t('otp:resendSuccessMessage'));
            }

        } catch (error: any) {
            const data = error.response?.data;
            if (data?.error === 'otp_too_many_attempts') {
                setError(t('otp:errors.tooManyAttempts'));
            } else {
                Alert.alert(t('common:errors.generic'), t('otp:alerts.genericErrorMessage'));
            }
        } finally {
            setResending(false);
        }
    };

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
                    <View style={optStyles.headerSection}>
                        <View style={optStyles.iconCircle}>
                            <Ionicons name="mail-outline" size={40} color="#FF5722" />
                        </View>
                        <Text style={optStyles.title}>{t('otp:title')}</Text>
                        <Text style={optStyles.subtitle}>
                            {t('otp:subtitle')}
                        </Text>
                        <Text style={optStyles.email}>{email}</Text>
                    </View>

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
                                    !!error ? optStyles.otpInputError : {},
                                ]}
                                value={digit}
                                onChangeText={(text) => handleOtpChange(text, index)}
                                onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
                                keyboardType="number-pad"
                                maxLength={1}
                                selectTextOnFocus
                                textAlign="center"
                            />
                        ))}
                    </View>
                    {!!error && (
                        <Text style={optStyles.errorText}>
                            <Ionicons name="alert-circle-outline" size={13} color="#ef4444" /> {error}
                        </Text>
                    )}

                    <TouchableOpacity
                        style={[commonStyles.primaryButton, loading && { opacity: 0.7 }, optStyles.verifyButton]}
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
