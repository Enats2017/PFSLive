import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
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
import { useLandscapeSidePadding, useSafeAreaEdges } from '../../../hooks/useLandscapeSidePadding';

type Step = 'email' | 'otp' | 'newPassword';
const STEPS: Step[] = ['email', 'otp', 'newPassword'];

const ForgotPassword: React.FC<ForgotPasswordScreenProps> = ({ navigation }) => {
  const { t } = useTranslation(['forget', 'common']);
  // ✅ Notch clearance for the body in landscape (edges are ['bottom'] here).
  const sidePadding = useLandscapeSidePadding();
  const safeEdges = useSafeAreaEdges();   // + Android 3-button landscape sides
  
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
    <SafeAreaView style={commonStyles.container} edges={safeEdges}>
      <AppHeader title={t('common:band.resetPassword')} showLogo={true} showBack />
      
      {/* Progress Bar */}
      {/* ✅ sidePadding here and on the KAV (not one wrapper View): the KAV must
          stay a direct child of the screen-top SafeAreaView for offset 0 to hold. */}
      {/* (margins, not padding: progressContainer's own paddingHorizontal must survive) */}
      <View style={[forgotStyles.progressContainer, { marginLeft: sidePadding.paddingLeft, marginRight: sidePadding.paddingRight }]}>
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
        style={[{ flex: 1 }, sidePadding]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        // ✅ 0, not 60: RN's KAV measures its own onLayout frame (relative to a
        // parent that starts at the screen top — headerShown is false), so
        // AppHeader + progress bar are already counted; 60 added a dead gap.
        keyboardVerticalOffset={0}
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