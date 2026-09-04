import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import FloatingLabelInput from '../../../components/FloatingLabelInput';
import { authService } from '../../../services/authService';
import { commonStyles, palette } from '../../../styles/common.styles';
import { forgotStyles } from '../../../styles/forgetPassword.styles';
import { analyticsService } from '../../../services/analyticsService';
import { Button } from '../../../components/ui';

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
    setError('');

    try {
      const response = await authService.forgotPassword(email.trim().toLowerCase());

      if (response.success && response.data?.verification_token) {
        // Reset requested — the email address itself is never sent.
        void analyticsService.logAuthStep('reset_requested');
        onNext(email.trim().toLowerCase(), response.data.verification_token);
      } else {
        setError(t('forget:emailStep.errors.emailNotFound'));
      }
    } catch (err: any) {
      const errCode = err.response?.data?.error;

      if (errCode === 'email_invalid') {
        setError(t('forget:emailStep.errors.emailInvalid'));
      } else if (err.request && !err.response) {
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
        <Ionicons name="lock-open-outline" size={38} color={palette.navy} />
      </View>

      {/* Title & Subtitle */}
      <Text style={[commonStyles.title, forgotStyles.stepTitle]}>
        {t('forget:emailStep.title')}
      </Text>
      <Text style={[commonStyles.subtitle, forgotStyles.subtitle]}>
        {t('forget:emailStep.subtitle')}
      </Text>

      {/* Email Input */}
      <View style={forgotStyles.form}>
        <FloatingLabelInput
          label={t('forget:emailStep.email')}
          value={email}
          onChangeText={handleEmailChange}
          iconName="mail-outline"
          keyboardType="email-address"
          autoCapitalize="none"
          required
          errorMessage={error}
        />

        {/* Send OTP Button */}
        <Button
          label={t('forget:emailStep.sendOtpButton')}
          onPress={handleSendOtp}
          loading={loading}
          style={{ marginTop: 12 }}
        />

        {/* ✅ FIX: Back to Login - Wrap icon and text separately */}
        <TouchableOpacity
          style={forgotStyles.backButton}
          onPress={onBack}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back-outline" size={20} color={palette.textMuted} />
          <Text style={forgotStyles.backButtonText}>
            {t('forget:emailStep.backtologin')}
          </Text>
        </TouchableOpacity>

        {/* 06_ForgotPassword.png: tell people what the next two screens are,
            so a reset that takes three steps does not look like a dead end. */}
        <View style={forgotStyles.nextCard}>
          <Text style={forgotStyles.nextTitle}>{t('forget:emailStep.next.title')}</Text>
          {([1, 2, 3] as const).map((n) => (
            <View key={n} style={forgotStyles.nextRow}>
              <View style={forgotStyles.nextNum}>
                <Text style={forgotStyles.nextNumText}>{n}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={forgotStyles.nextStepTitle}>
                  {t(`forget:emailStep.next.s${n}`)}
                </Text>
                <Text style={forgotStyles.nextStepSub}>
                  {t(`forget:emailStep.next.s${n}sub`)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
};

EmailStep.displayName = 'EmailStep';

export default EmailStep;