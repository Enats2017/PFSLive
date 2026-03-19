import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import FloatingLabelInput from '../../../components/FloatingLabelInput';
import { authService } from '../../../services/authService';
import { forgotStyles } from '../../../styles/forgetPassword.styles';
import { commonStyles, colors } from '../../../styles/common.styles';

interface NewPasswordStepProps {
  passwordResetToken: string;
  onSuccess: () => void;
  onBack: () => void;
}

const NewPasswordStep: React.FC<NewPasswordStepProps> = ({
  passwordResetToken,
  onSuccess,
  onBack,
}) => {
  const { t } = useTranslation(['forget', 'common']);
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!password || password.length < 4) {
      newErrors.password = t('forget:passwordStep.errors.passwordShort');
    }

    if (password.length > 20) {
      newErrors.password = t('forget:passwordStep.errors.passwordLong');
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = t('forget:passwordStep.errors.confirmRequired');
    }

    if (password && confirmPassword && password !== confirmPassword) {
      newErrors.confirmPassword = t('forget:passwordStep.errors.passwordMismatch');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [password, confirmPassword, t]);

  const handleSubmit = useCallback(async () => {
    if (!validate()) return;
    
    setLoading(true);
    setErrors({});

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
            t('forget:passwordStep.errors.sessionExpired'),
            t('forget:passwordStep.errors.sessionExpiredMessage'),
          );
          break;

        case 'password_too_short':
          setErrors({ password: t('forget:passwordStep.errors.passwordShort') });
          break;

        case 'password_too_long':
          setErrors({ password: t('forget:passwordStep.errors.passwordLong') });
          break;

        case 'password_mismatch':
          setErrors({ confirmPassword: t('forget:passwordStep.errors.passwordMismatch') });
          break;

        default:
          if (error.request && !error.response) {
            Alert.alert(
              t('forget:passwordStep.errors.noConnection'),
              t('forget:passwordStep.errors.noConnectionMessage'),
            );
          } else {
            Alert.alert(
              t('forget:passwordStep.errors.genericError'),
              t('forget:passwordStep.errors.genericErrorMessage'),
            );
          }
          break;
      }
    } finally {
      setLoading(false);
    }
  }, [validate, passwordResetToken, password, confirmPassword, onSuccess, t]);

  const handlePasswordChange = useCallback((text: string) => {
    setPassword(text);
    if (errors.password) {
      setErrors((prev) => ({ ...prev, password: '' }));
    }
  }, [errors.password]);

  const handleConfirmPasswordChange = useCallback((text: string) => {
    setConfirmPassword(text);
    if (errors.confirmPassword) {
      setErrors((prev) => ({ ...prev, confirmPassword: '' }));
    }
  }, [errors.confirmPassword]);

  return (
    <View style={forgotStyles.container}>
      {/* Icon */}
      <View style={forgotStyles.iconCircle}>
        <Ionicons name="shield-checkmark-outline" size={38} color={colors.primary} />
      </View>

      {/* Title & Subtitle */}
      <Text style={commonStyles.title}>
        {t('forget:passwordStep.title')}
      </Text>
      <Text style={[commonStyles.subtitle, forgotStyles.subtitle]}>
        {t('forget:passwordStep.subtitle')}
      </Text>

      {/* Form */}
      <View style={forgotStyles.form}>
        <FloatingLabelInput
          label={t('forget:passwordStep.newPassword')}
          value={password}
          onChangeText={handlePasswordChange}
          iconName="lock-closed-outline"
          isPassword
          required
          errorMessage={errors.password}
        />

        <FloatingLabelInput
          label={t('forget:passwordStep.confirmPassword')}
          value={confirmPassword}
          onChangeText={handleConfirmPasswordChange}
          iconName="lock-closed-outline"
          isPassword
          required
          errorMessage={errors.confirmPassword}
        />

        {/* Reset Button */}
        <TouchableOpacity
          style={[
            commonStyles.primaryButton,
            { marginTop: 12 },
            loading && { opacity: 0.7 }
          ]}
          onPress={handleSubmit}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={commonStyles.primaryButtonText}>
              {t('forget:passwordStep.resetButton')}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

NewPasswordStep.displayName = 'NewPasswordStep';

export default NewPasswordStep;