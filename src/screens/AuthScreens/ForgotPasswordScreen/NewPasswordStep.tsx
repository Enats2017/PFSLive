import React, { useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    Image,
    Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import FloatingLabelInput from '../../../components/FloatingLabelInput';
import { API_CONFIG, getApiEndpoint } from '../../../constants/config';
import { authService, ResetPasswordResponse } from '../../../services/authService';
import { forgotStyles } from '../../../styles/forgetPassword.styles';
import { commonStyles } from '../../../styles/common.styles';
import { useTranslation } from 'react-i18next';


// ─── Props ───────────────────────────────────────────────────────
interface NewPasswordStepProps {
    passwordResetToken: string;
    onSuccess: () => void;   // called after successful reset
    onBack: () => void;
}

// ─── Component ───────────────────────────────────────────────────
const NewPasswordStep: React.FC<NewPasswordStepProps> = ({
    passwordResetToken,
    onSuccess,
    onBack,
}) => {
    const { t } = useTranslation(['register', 'common', 'forget']);
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);

    // ── Validate ─────────────────────────────────────────────────
    const validate = (): boolean => {
        const newErrors: Record<string, string> = {};

        if (!password || password.length < 4)
            newErrors.password = 'Password must be at least 4 characters';

        if (password.length > 20)
            newErrors.password = 'Password must be less than 20 characters';

        if (!confirmPassword)
            newErrors.confirmPassword = 'Please confirm your password';

        if (password && confirmPassword && password !== confirmPassword)
            newErrors.confirmPassword = 'Passwords do not match';

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async () => {
        if (!validate()) return;
        setLoading(true);

        try {
            const response = await authService.resetPassword(
                passwordResetToken,
                password,
                confirmPassword,
            );

            if (response.success) {
                onSuccess();
            }

        } catch (error: any) {
            const errCode = error.response?.data?.error;

            switch (errCode) {
                case 'password_reset_token_invalid':
                case 'password_reset_token_expired':
                    Alert.alert(
                        'Session Expired',
                        'Your reset session has expired. Please start again.',
                    );
                    break;
                case 'password_too_short':
                    setErrors({ password: 'Password must be at least 4 characters' });
                    break;
                case 'password_too_long':
                    setErrors({ password: 'Password must be less than 200 characters' });
                    break;
                case 'password_mismatch':
                    setErrors({ confirmPassword: 'Passwords do not match' });
                    break;
                default:
                    if (error.request && !error.response) {
                        Alert.alert('No Connection', 'Please check your internet connection.');
                    } else {
                        Alert.alert('Error', 'Something went wrong. Please try again.');
                    }
                    break;
            }
        } finally {
            setLoading(false);
        }
    };
    return (
        <View style={forgotStyles.container}>
            <View style={forgotStyles.iconCircle}>
                <Ionicons name="shield-checkmark-outline" size={38} color="#FF5722" />
            </View>
            <Text style={commonStyles.title}>{t('forget:passwordStep.title')}</Text>
            <Text style={[commonStyles.subtitle, { textAlign: "center", marginTop: 12, marginBottom: 15, lineHeight: 22, }]}>
                {t('forget:passwordStep.subtitle')}
            </Text>
            <View style={forgotStyles.form}>
                <FloatingLabelInput
                    label={t('forget:passwordStep.newPassword')}
                    value={password}
                    onChangeText={(text) => {
                        setPassword(text);
                        if (errors.password) setErrors((p) => ({ ...p, password: '' }));
                    }}
                    iconName="lock-closed-outline"
                    isPassword
                    required
                    errorMessage={errors.password}
                />

                <FloatingLabelInput
                    label={t('forget:passwordStep.confirmPassword')}
                    value={confirmPassword}
                    onChangeText={(text) => {
                        setConfirmPassword(text);
                        if (errors.confirmPassword) setErrors((p) => ({ ...p, confirmPassword: '' }));
                    }}
                    iconName="lock-closed-outline"
                    isPassword
                    required
                    errorMessage={errors.confirmPassword}
                />

                <TouchableOpacity
                    style={[commonStyles.primaryButton, { marginTop: 12 }, loading && forgotStyles.buttonDisabled]}
                    onPress={handleSubmit}
                    disabled={loading}
                    activeOpacity={0.8}
                >
                    {loading
                        ? <ActivityIndicator color="#fff" size="small" />
                        : <Text style={commonStyles.primaryButtonText}>{t('forget:passwordStep.resetButton')}</Text>
                    }
                </TouchableOpacity>
            </View>
        </View>
    );
};



export default NewPasswordStep;
