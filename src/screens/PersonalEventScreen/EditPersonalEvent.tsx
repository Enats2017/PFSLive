import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';

import { AppHeader } from '../../components/common/AppHeader';
import FloatingLabelInput from '../../components/FloatingLabelInput';
import { API_CONFIG } from '../../constants/config';
import { useEditPersonalEventForm } from '../../hooks/Useeditpersonaleventform';
import { useEditFileUpload, } from '../../hooks/Useeditfileupload';
import { getPersonalEvent, updatePersonalEvent, formatFileSize, getDeviceTimezone } from '../../services/editPersonalEventService';
import { commonStyles, colors, spacing } from '../../styles/common.styles';
import { personalStyles } from '../../styles/personalEvent.styles';
import { EditPersonalEventpops } from '../../types/navigation';
import { toastError, toastSuccess } from '../../../utils/toast';
import { FileCard } from '../../components/FileCard';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MB = MAX_FILE_SIZE / 1_048_576;

const EditPersonalEvent: React.FC<EditPersonalEventpops> = ({ route, navigation }) => {
  const { eventId } = route.params;
  const { t } = useTranslation(['personal', 'common']);


  const {
    formData, errors, eventTypeOptions,
    initFormFromEvent, setFieldError, clearAllErrors, validateForm, handlers,
  } = useEditPersonalEventForm();

  const {
    existingFile, selectedFile, shouldRemoveGpx,
    initExistingFile, pickFile, viewNewFile, discardNewFile,
    removeExistingFile, undoRemoveExistingFile,
  } = useEditFileUpload({
    maxFileSize: MAX_FILE_SIZE,
    onFileError: (msg) => setFieldError('file', msg),
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const hasFetched = useRef(false);

  // ─── Load event ─────────────────────────────────────────────────────────
  useEffect(() => {

    if (hasFetched.current) return;
    hasFetched.current = true;

    let cancelled = false;

    const loadEvent = async () => {
      try {
        const event = await getPersonalEvent(eventId);
        if (cancelled) return;
        initFormFromEvent(event);
        if (event.gpx_path) {
          initExistingFile(event.gpx_path);
        }

      } catch (err: any) {
        if (cancelled) return;
        if (API_CONFIG.DEBUG) {
          console.error('❌ Load event:', err?.message);
        }
        toastError(
          t('common:errors.generic'),
          t('personal:errors.loadFailed')
        );
        navigation.goBack();
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }

      }
    };
    loadEvent();
    return () => {
      cancelled = true;
    };

  }, [eventId, initFormFromEvent, initExistingFile, navigation, t]);


  // ─── Submit 
  const handleSubmit = useCallback(async () => {
    clearAllErrors();
    if (!validateForm() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const response = await updatePersonalEvent({
        eventId,
        name: formData.name.trim(),
        eventTypeId: formData.selectedEventType?.value ?? null,
        date: formData.date,
        startTime: formData.startTime,
        timezone: getDeviceTimezone(),
        selectedFile: selectedFile ?? undefined,
        removeGpx: shouldRemoveGpx,
      });

      toastSuccess(t('personal:success.title'), response.message || t('personal:success.editMessage'));
      navigation.navigate('ProfileScreen', {
        customer_app_id: eventId
      });
    } catch (err: any) {
      if (API_CONFIG.DEBUG) console.error('❌ Update event:', err?.message);
      toastError(
        t('common:errors.generic'),
        err.message === 'API_ERROR' ? t('personal:errors.updateFailed') : err.message,
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [clearAllErrors, validateForm, isSubmitting, eventId, formData, selectedFile, shouldRemoveGpx, navigation, t]);

  // ─── Derived UI state ────────────────────────────────────────────────────
  const showNewFile = !!selectedFile;
  const showExistingFile = !selectedFile && !!existingFile && !existingFile.removed;
  const showUploadBox = !selectedFile && (!existingFile || existingFile.removed);

  // ─── Loading ─────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <SafeAreaView style={commonStyles.container} edges={['top']}>
        <StatusBar barStyle="dark-content" />
        <AppHeader showLogo />
        <View style={commonStyles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={commonStyles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      <AppHeader showLogo />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
      >
        <ScrollView

          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={personalStyles.section}>
            <Text style={commonStyles.title}>{t('personal:editTitle')}</Text>
          </View>

          <View style={personalStyles.formContainer}>
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
              {errors.name && <Text style={personalStyles.errorText}>{errors.name}</Text>}
            </View>

            {/* Event Type */}
            <View style={personalStyles.fieldWrapper}>
              <FloatingLabelInput
                label={t('personal:type')}
                value={formData.selectedEventType?.label ?? ''}
                onChangeText={() => { }}
                isDropdown
                options={eventTypeOptions}
                onSelect={handlers.handleEventTypeChange}
                required
                editable={!isSubmitting}
                error={!!errors.eventType}
              />
              {errors.eventType && <Text style={personalStyles.errorText}>{errors.eventType}</Text>}
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
              {errors.date && <Text style={personalStyles.errorText}>{errors.date}</Text>}
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
              {errors.startTime && <Text style={personalStyles.errorText}>{errors.startTime}</Text>}
            </View>

            {/* GPX File */}
            <View style={personalStyles.fileSection}>

              {/* A — Upload box */}
              {showUploadBox && (
                <>
                  {existingFile?.removed && (
                    <TouchableOpacity
                      onPress={undoRemoveExistingFile}
                      disabled={isSubmitting}
                      style={personalStyles.undoBtn}
                    >
                      <Text style={personalStyles.undoText}>{t('personal:file.undoRemove')}</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[personalStyles.uploadBox, errors.file && personalStyles.uploadBoxError]}
                    onPress={pickFile}
                    activeOpacity={0.8}
                    disabled={isSubmitting}
                  >
                    <Ionicons name="cloud-upload-outline" size={40} color={colors.primary} />
                    <Text style={personalStyles.uploadTitle}>{t('personal:file.uploadTitle')}</Text>
                    <Text style={personalStyles.uploadSubtitle}>
                      {t('personal:file.uploadSubtitle', { size: MB })}
                    </Text>
                  </TouchableOpacity>
                </>
              )}

              {/* B — Existing server file */}
              {showExistingFile && (
                <FileCard
                  fileName={existingFile!.name}
                  fileSubtitle={t('personal:file.existingFile')}
                  disabled={isSubmitting}
                  swapIcon="swap-horizontal-outline"
                  onSwapOrView={pickFile}
                  onRemoveOrDiscard={removeExistingFile}
                />
              )}

              {/* C — Newly picked file */}
              {showNewFile && (
                <FileCard
                  fileName={selectedFile!.name}
                  fileSubtitle={formatFileSize(selectedFile!.size)}
                  disabled={isSubmitting}
                  swapIcon="eye-outline"
                  onSwapOrView={viewNewFile}
                  onRemoveOrDiscard={discardNewFile}
                />
              )}

              {errors.file && <Text style={personalStyles.errorText}>{errors.file}</Text>}
            </View>

            <Text style={personalStyles.subtitle}>{t('personal:fileInfo')}</Text>

            {/* Submit */}
            <TouchableOpacity
              style={[commonStyles.primaryButton, personalStyles.submitBtn, isSubmitting && personalStyles.disabled]}
              onPress={handleSubmit}
              disabled={isSubmitting}
              activeOpacity={0.8}
            >
              {isSubmitting
                ? <ActivityIndicator size="small" color={colors.white} />
                : <Text style={commonStyles.primaryButtonText}>{t('personal:button.save')}</Text>
              }
            </TouchableOpacity>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default EditPersonalEvent;
