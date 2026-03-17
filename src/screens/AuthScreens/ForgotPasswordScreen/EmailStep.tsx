import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import FloatingLabelInput from '../../../components/FloatingLabelInput';
import { authService } from '../../../services/authService';
import { commonStyles } from '../../../styles/common.styles';
import { useTranslation } from 'react-i18next';
import { forgotStyles } from '../../../styles/forgetPassword.styles';

interface EmailStepProps {
    onNext: (email: string, verificationToken: string) => void;
    onBack: () => void;
}

const EmailStep: React.FC<EmailStepProps> = ({ onNext, onBack }) => {
    const { t } = useTranslation(['common', 'forget']);
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const validate = useCallback((): boolean => {
        if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) {
            setError(t('forget:emailStep.errors.emailInvalid'));
            return false;
        }
        setError('');
        return true;
    }, [email, t]);

    const handleEmailChange = useCallback((text: string) => {
        setEmail(text);
        if (error) setError('');
    }, [error]);

    const handleSendOtp = useCallback(async () => {
        if (!validate()) return;
        setLoading(true);

        try {
            const response = await authService.forgotPassword(email.trim().toLowerCase());

            if (response.success && response.data?.verification_token) {
                onNext(email.trim().toLowerCase(), response.data.verification_token);
            } else {
                setError(t('forget:emailStep.errors.emailNotFound'));
            }

        } catch (err: any) {
            const errCode = err.response?.data?.error;

            if (errCode === 'email_invalid') {
                setError(t('forget:emailStep.errors.emailInvalid'));
            } else if (err.request) {
                setError(t('forget:emailStep.errors.noConnection'));
            } else {
                setError(t('forget:emailStep.errors.genericError'));
            }
        } finally {
            setLoading(false);
        }
    }, [email, validate, onNext, t]);

    return (
        <View style={forgotStyles.container}>
            {/* Icon */}
            <View style={forgotStyles.iconCircle}>
                <Ionicons name="lock-open-outline" size={38} color="#FF5722" />
            </View>

            {/* Title & Subtitle */}
            <Text style={commonStyles.title}>{t('forget:emailStep.title')}</Text>
            <Text style={[commonStyles.subtitle, { textAlign: "center", marginTop: 12, marginBottom: 15, lineHeight: 22, }]}>
                {t('forget:emailStep.subtitle')}
            </Text>

            {/* Email Input */}
            <View style={forgotStyles.form}>
                <FloatingLabelInput
                    label={t('email')}
                    value={email}
                   onChangeText={handleEmailChange}
                    iconName="mail-outline"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    required
                    errorMessage={error}

                />

                {/* Send OTP Button */}
                <TouchableOpacity
                    style={[commonStyles.primaryButton, { marginTop: 12 }, loading && { opacity: 0.7 }]}
                    onPress={handleSendOtp}
                    disabled={loading}
                    activeOpacity={0.8}
                >
                    {loading ? (
                        <ActivityIndicator color="#fff" size="small" />
                    ) : (
                        <Text style={commonStyles.primaryButtonText}>{t('forget:emailStep.sendOtpButton')}</Text>
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    style={forgotStyles.backButton}
                    onPress={onBack}
                    activeOpacity={0.7}
                >
                    <Ionicons name="arrow-back-outline" size={20} color="#6b7280" />
                    <Text style={commonStyles.subtitle}>{t('forget:emailStep.backtologin')}</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};



export default EmailStep;
