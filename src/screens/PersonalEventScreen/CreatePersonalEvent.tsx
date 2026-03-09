import React, { useState, useCallback, useMemo } from 'react';
import {
  KeyboardAvoidingView,
  ScrollView,
  StatusBar,
  Platform,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader } from '../../components/common/AppHeader';
import { commonStyles, spacing, colors } from '../../styles/common.styles';
import { PersonalEventProps } from '../../types/navigation';
import FloatingLabelInput from '../../components/FloatingLabelInput';
import { Ionicons } from '@expo/vector-icons';
import { personalStyles } from '../../styles/personalEvent.styles';
import { useTranslation } from 'react-i18next';
import { toastError, toastSuccess } from '../../../utils/toast';
import RegistrationModal from '../../components/RegistrationModal';
import ErrorModal from '../../components/ErrorModal';
import { 
  createPersonalEvent, 
  formatFileSize,
  getDeviceTimezone,
} from '../../services/personalEventService';
import { API_CONFIG } from '../../constants/config';
import { usePersonalEventForm } from '../../hooks/usePersonalEventForm';
import { useFileUpload } from '../../hooks/useFileUpload';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const CreatePersonalEvent: React.FC<PersonalEventProps> = ({ navigation }) => {
  const { t } = useTranslation(['personal', 'common', 'details']);

  const EVENT_TYPE_OPTIONS = useMemo(
    () => [
      { label: t('personal:eventTypes.organizedWithResults'), value: 1 },
      { label: t('personal:eventTypes.organizedWithoutResults'), value: 2 },
      { label: t('personal:eventTypes.training'), value: 3 },
    ],
    [t]
  );

  const {
    formData,
    errors,
    handlers,
    setFieldError,
    clearAllErrors,
    validateForm,
    resetForm,
  } = usePersonalEventForm();

  const { selectedFile, pickFile, viewFile, removeFile, clearFile } = useFileUpload(
    MAX_FILE_SIZE,
    (message) => setFieldError('file', message)
  );

  const [isSubmitting, setIsSubmitting] = useState(false);

  // ✅ MODAL STATES (REUSE SAME PATTERN AS useRegistrationHandler)
  const [registrationModalVisible, setRegistrationModalVisible] = useState(false);
  type RegistrationStatus = 'membership_required' | 'limit_reached' | null;
  const [registrationStatus, setRegistrationStatus] = useState<RegistrationStatus>(null);
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorTitleKey, setErrorTitleKey] = useState('');
  const [errorMessageKey, setErrorMessageKey] = useState('');

  // ✅ SHOW ERROR MODAL HELPER
  const showErrorModal = useCallback((titleKey: string, messageKey: string) => {
    setErrorTitleKey(titleKey);
    setErrorMessageKey(messageKey);
    setErrorModalVisible(true);
  }, []);

  // ✅ FORM SUBMISSION WITH ACTION HANDLING
  const handleSubmit = useCallback(async () => {
    clearAllErrors();

    if (!validateForm()) return;
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);

      const deviceTimezone = getDeviceTimezone();

      const response = await createPersonalEvent({
        name: formData.name.trim(),
        eventTypeId: formData.selectedEventType?.value ?? null,
        date: formData.date,
        startTime: formData.startTime,
        timezone: deviceTimezone,
        selectedFile: selectedFile || undefined,
      });

      if (API_CONFIG.DEBUG) {
        console.log('📡 Create Personal Event Response:', {
          success: response.success,
          action: response.action,
        });
      }

      // ✅ CHECK ACTION FIELD (SAME PATTERN AS useRegistrationHandler)
      const action = response.action || 'unknown_error';

      // ✅ HANDLE NON-SUCCESS ACTIONS
      if (action !== 'registered' && action !== 'success') {
        if (API_CONFIG.DEBUG) {
          console.log('⚠️ Non-success action received:', action);
        }

        switch (action) {
          case 'membership_required':
            setRegistrationStatus('membership_required');
            setRegistrationModalVisible(true);
            break;

          case 'limit_reached':
            setRegistrationStatus('limit_reached');
            setRegistrationModalVisible(true);
            break;

          case 'customer_invalid':
            showErrorModal(
              'personal:errors.customerInvalidTitle',
              'personal:errors.customerInvalidMessage'
            );
            break;

          case 'validation_error':
          case 'missing_parameters':
            showErrorModal(
              'personal:errors.validationErrorTitle',
              'personal:errors.validationErrorMessage'
            );
            break;

          case 'unauthorized':
          case 'token_invalid':
          case 'token_expired':
            navigation.navigate('LoginScreen');
            break;

          default:
            showErrorModal(
              'personal:errors.createFailedTitle',
              'personal:errors.createFailedMessage'
            );
            break;
        }
        return;
      }

      // ✅ SUCCESS CASE
      if (response.success) {
        toastSuccess(
          t('personal:success.title'),
          response.message || t('personal:success.message')
        );

        resetForm();
        clearFile();

        navigation.goBack();
      } else {
        throw new Error(response.message || 'API_ERROR');
      }
    } catch (error: any) {
      if (API_CONFIG.DEBUG) {
        console.error('❌ Submit error:', error);
      }

      // ✅ HANDLE VALIDATION ERRORS
      if (error.message?.startsWith('VALIDATION_ERROR:')) {
        const validationMessage = error.message.replace('VALIDATION_ERROR: ', '');
        toastError(t('common:errors.validation'), validationMessage);
        return;
      }

      // ✅ HANDLE NETWORK ERRORS
      const message =
        error.message === 'API_ERROR'
          ? t('personal:errors.createFailed')
          : error.message;

      toastError(t('common:errors.generic'), message);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    clearAllErrors,
    validateForm,
    isSubmitting,
    formData,
    selectedFile,
    resetForm,
    clearFile,
    navigation,
    showErrorModal,
    t,
  ]);

  return (
    <SafeAreaView style={commonStyles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      <AppHeader showLogo={true} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
      >
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={personalStyles.section}>
            <Text style={commonStyles.title}>{t('personal:title')}</Text>
          </View>

          <View style={personalStyles.formContainer}>
            {/* Event Name */}
            <View style={personalStyles.fieldWrapper}>
              <FloatingLabelInput
                label={t('personal:name')}
                value={formData.name}
                onChangeText={handlers.handleNameChange}
                iconName="person-circle-outline"
                required
                editable={!isSubmitting}
                error={!!errors.name}
              />
              {errors.name && (
                <Text style={personalStyles.errorText}>{errors.name}</Text>
              )}
            </View>

            {/* Event Type */}
            <View style={personalStyles.fieldWrapper}>
              <FloatingLabelInput
                label={t('personal:type')}
                value={formData.selectedEventType?.label ?? ''}
                onChangeText={() => {}}
                isDropdown
                options={EVENT_TYPE_OPTIONS}
                onSelect={handlers.handleEventTypeChange}
                required
                editable={!isSubmitting}
                error={!!errors.eventType}
              />
              {errors.eventType && (
                <Text style={personalStyles.errorText}>{errors.eventType}</Text>
              )}
            </View>

            {/* Date */}
            <View style={personalStyles.fieldWrapper}>
              <FloatingLabelInput
                label={t('personal:date')}
                value={formData.date}
                onChangeText={handlers.handleDateChange}
                iconName="calendar-outline"
                isDatePicker
                required
                editable={!isSubmitting}
                error={!!errors.date}
              />
              {errors.date && (
                <Text style={personalStyles.errorText}>{errors.date}</Text>
              )}
            </View>

            {/* Start Time */}
            <View style={personalStyles.fieldWrapper}>
              <FloatingLabelInput
                label={t('personal:startTime')}
                value={formData.startTime}
                onChangeText={handlers.handleStartTimeChange}
                iconName="time-outline"
                isTimePicker
                required
                editable={!isSubmitting}
                error={!!errors.startTime}
              />
              {errors.startTime && (
                <Text style={personalStyles.errorText}>{errors.startTime}</Text>
              )}
            </View>

            {/* GPX File Upload */}
            <View style={{ marginTop: spacing.md }}>
              {!selectedFile ? (
                <TouchableOpacity
                  style={[
                    personalStyles.uploadBox,
                    errors.file && personalStyles.uploadBoxError,
                  ]}
                  onPress={pickFile}
                  activeOpacity={0.8}
                  disabled={isSubmitting}
                >
                  <Ionicons
                    name="cloud-upload-outline"
                    size={40}
                    color={colors.primary}
                  />
                  <Text style={personalStyles.uploadTitle}>
                    {t('personal:file.uploadTitle')}
                  </Text>
                  <Text style={personalStyles.uploadSubtitle}>
                    {t('personal:file.uploadSubtitle', {
                      size: MAX_FILE_SIZE / (1024 * 1024),
                    })}
                  </Text>
                </TouchableOpacity>
              ) : (
                <View style={personalStyles.fileCard}>
                  <View style={personalStyles.fileLeft}>
                    <View style={personalStyles.fileIconContainer}>
                      <Ionicons
                        name="document-outline"
                        size={28}
                        color={colors.primary}
                      />
                    </View>
                    <View style={personalStyles.fileDetails}>
                      <Text numberOfLines={1} style={personalStyles.fileName}>
                        {selectedFile.name}
                      </Text>
                      <Text style={personalStyles.fileSize}>
                        {formatFileSize(selectedFile.size)}
                      </Text>
                    </View>
                  </View>
                  <View style={personalStyles.actions}>
                    <TouchableOpacity
                      style={personalStyles.actionButton}
                      onPress={viewFile}
                      disabled={isSubmitting}
                    >
                      <Ionicons name="eye-outline" size={20} color={colors.gray600} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={personalStyles.actionButton}
                      onPress={removeFile}
                      disabled={isSubmitting}
                    >
                      <Ionicons name="close-circle" size={20} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              {errors.file && (
                <Text style={personalStyles.errorText}>{errors.file}</Text>
              )}
            </View>

            <Text style={personalStyles.subtitle}>{t('personal:fileInfo')}</Text>

            {/* Submit Button */}
            <TouchableOpacity
              style={[
                commonStyles.primaryButton,
                { marginTop: spacing.xxxl, marginBottom: spacing.xl },
                isSubmitting && { opacity: 0.6 },
              ]}
              onPress={handleSubmit}
              disabled={isSubmitting}
              activeOpacity={0.8}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={commonStyles.primaryButtonText}>
                  {t('personal:button.save')}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ✅ REGISTRATION MODAL (REUSE SAME COMPONENT) */}
      <RegistrationModal
        visible={registrationModalVisible}
        status={registrationStatus}
        distanceName={formData.name || t('personal:title')}
        onClose={() => {
          setRegistrationModalVisible(false);
          setRegistrationStatus(null);
        }}
      />

      {/* ✅ ERROR MODAL (REUSE SAME COMPONENT) */}
      <ErrorModal
        visible={errorModalVisible}
        titleKey={errorTitleKey}
        messageKey={errorMessageKey}
        onClose={() => setErrorModalVisible(false)}
      />
    </SafeAreaView>
  );
};

export default CreatePersonalEvent;