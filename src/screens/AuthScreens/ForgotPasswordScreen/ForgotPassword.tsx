import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  StatusBar,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import EmailStep from './EmailStep';
import OtpStep from './OtpStep';
import NewPasswordStep from './NewPasswordStep';
import { ForgotPasswordScreenProps } from '../../../types/navigation';
import { AppHeader } from '../../../components/common/AppHeader';
import { commonStyles } from '../../../styles/common.styles';
import SuccessCelebrationModal from '../../../components/SuccessCelebrationModal';
import { toastSuccess } from '../../../../utils/toast';
import { forgotStyles } from '../../../styles/forgetPassword.styles';

type Step = 'email' | 'otp' | 'newPassword';
const STEPS: Step[] = ['email', 'otp', 'newPassword'];

const ForgotPassword: React.FC<ForgotPasswordScreenProps> = ({ navigation }) => {
  const { t } = useTranslation(['forget', 'common']);
  
  const [currentStep, setCurrentStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [verificationToken, setVerificationToken] = useState('');
  const [passwordResetToken, setPasswordResetToken] = useState('');
  const [successVisible, setSuccessVisible] = useState(false);

  const stepIndex = useMemo(() => STEPS.indexOf(currentStep), [currentStep]);

  const handleEmailNext = useCallback((submittedEmail: string, token: string) => {
    setEmail(submittedEmail);
    setVerificationToken(token);
    setCurrentStep('otp');
  }, []);

  const handleOtpNext = useCallback((resetToken: string) => {
    setPasswordResetToken(resetToken);
    setCurrentStep('newPassword');
  }, []);

  const handleResendOtp = useCallback(() => {
    toastSuccess(
      t('forget:emailStep.otp'),
      t('forget:emailStep.otpmsg')
    );
  }, [t]);

  const handleResetSuccess = useCallback(() => {
    setSuccessVisible(true);
  }, []);

  const handleSuccessClose = useCallback(() => {
    setSuccessVisible(false);
    navigation.reset({
      index: 0,
      routes: [{ name: 'LoginScreen' }],
    });
  }, [navigation]);

  const backStepMap = useMemo<Record<Step, () => void>>(() => ({
    email: () => navigation.goBack(),
    otp: () => setCurrentStep('email'),
    newPassword: () => setCurrentStep('otp'),
  }), [navigation]);

  const handleBack = useCallback(() => {
    backStepMap[currentStep]();
  }, [currentStep, backStepMap]);

  return (
    <SafeAreaView style={commonStyles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      <AppHeader showLogo={true} />
      
      {/* Progress Bar */}
      <View style={forgotStyles.progressContainer}>
        {STEPS.map((step, index) => (
          <View
            key={step}
            style={[
              forgotStyles.progressSegment,
              index <= stepIndex && forgotStyles.progressActive,
            ]}
          />
        ))}
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
      >
        <ScrollView
          contentContainerStyle={forgotStyles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {currentStep === 'email' && (
            <EmailStep
              onNext={handleEmailNext}
              onBack={handleBack}
            />
          )}

          {currentStep === 'otp' && (
            <OtpStep
              email={email}
              verificationToken={verificationToken}
              onNext={handleOtpNext}
              onBack={handleBack}
              onResend={handleResendOtp}
            />
          )}

          {currentStep === 'newPassword' && (
            <NewPasswordStep
              passwordResetToken={passwordResetToken}
              onSuccess={handleResetSuccess}
              onBack={handleBack}
            />
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Success Modal */}
      <SuccessCelebrationModal
        visible={successVisible}
        message={t('forget:passwordStep.successMessage')}
        title={t('forget:passwordStep.successTitle')}
        onClose={handleSuccessClose}
      />
    </SafeAreaView>
  );
};

ForgotPassword.displayName = 'ForgotPassword';

export default ForgotPassword;