import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { AppHeader } from '../../components/common/AppHeader';
import FloatingLabelInput from '../../components/FloatingLabelInput';
import { API_CONFIG } from '../../constants/config';
import { useEditPersonalEventForm } from '../../hooks/Useeditpersonaleventform';
import { parseLocalDate, startOfToday } from '../../utils/dateValidation';
import { useEditFileUpload } from '../../hooks/Useeditfileupload';
import { getPersonalEvent, updatePersonalEvent, formatFileSize, getDeviceTimezone } from '../../services/editPersonalEventService';
import { tokenService } from '../../services/tokenService';
import { commonStyles, spacing, palette } from '../../styles/common.styles';
import { personalStyles } from '../../styles/personalEvent.styles';
import { EditPersonalEventpops } from '../../types/navigation';
import { toastError, toastSuccess } from '../../../utils/toast';
import { FileCard } from '../../components/FileCard';
import { useLandscapeSidePadding, useSafeAreaEdges } from '../../hooks/useLandscapeSidePadding';
import { tryBeginSubmit, endSubmit, hasNoMappedField, editTimezoneToSend, isTrackingRecent, editMovesGun } from './personalEventGuards';
import {
  EDIT_EVENT_DRAFT_KEY, EditDraftValues, editDraftSnapshot, editDraftDiff, serializeEditDraft, usableEditDraft,
} from './personalEventGuards';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { startReminderService } from '../../services/startReminderService';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MB = MAX_FILE_SIZE / 1_048_576;

const EditPersonalEvent: React.FC<EditPersonalEventpops> = ({ route, navigation }) => {
  const { eventId } = route.params;
  const { t } = useTranslation(['personal', 'common']);
  // ✅ Notch clearance for the body in landscape (edges are ['bottom']).
  const sidePadding = useLandscapeSidePadding();
  const safeEdges = useSafeAreaEdges();   // + Android 3-button landscape sides

  const {
    formData,
    errors,
    eventTypeOptions,
    categoryOptions,
    initFormFromEvent,
    setFieldError,
    clearAllErrors,
    validateForm,
    handlers,
    loadedDate,
    loadedStartTime,
    loadedTimezone,
  } = useEditPersonalEventForm();

  // ✅ Normally today, but an already-started event keeps its own race_date
  // selectable so the picker can still open on the value being edited.
  const minDate = useMemo(() => {
    const today = startOfToday();
    const loaded = parseLocalDate(loadedDate);
    return loaded && loaded < today ? loaded : today;
  }, [loadedDate]);

  const {
    existingFile,
    selectedFile,
    shouldRemoveGpx,
    initExistingFile,
    pickFile,
    isPickingFile,
    viewNewFile,
    discardNewFile,
    removeExistingFile,
    undoRemoveExistingFile,
  } = useEditFileUpload({
    maxFileSize: MAX_FILE_SIZE,
    onFileError: (msg) => setFieldError('file', msg),
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // ✅ Synchronous submit gate (audit 2026-11-26) — see CreatePersonalEvent.
  const submitGateRef = useRef(false);
  const hasFetched = useRef(false);

  // ✅ UNSAVED EDIT SURVIVES A LOGOUT (re-audit A11) — same scheme as
  // EditProfileScreen / profileDraftService. A 401 on Home logs out and this
  // screen is removed by conditional rendering (no beforeRemove), so the
  // changed fields are kept on disk while they differ from the loaded event,
  // and offered back the next time THIS event's edit screen opens for the
  // same account (< 24 h, never a file). Save or an intentional leave
  // discards the draft.
  const loadedOkRef = useRef(false);
  const draftOffRef = useRef(false);
  const keepDraftOnLeaveRef = useRef(false);
  const draftRestoredRef = useRef(false);
  const [baseline, setBaseline] = useState<EditDraftValues | null>(null);
  const [customerIdForDraft, setCustomerIdForDraft] = useState<number | null>(null);
  const [draftChecked, setDraftChecked] = useState(false);
  const isBusy = isSubmitting || isPickingFile;

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    let cancelled = false;

    const loadEvent = async () => {
      try {
        if (API_CONFIG.DEBUG) console.log('📡 Loading personal event:', eventId);
        const event = await getPersonalEvent(eventId);
        if (cancelled) return;
        if (API_CONFIG.DEBUG) console.log('✅ Event loaded:', event);
        initFormFromEvent(event);
        loadedOkRef.current = true;
        if (event.gpx_path) initExistingFile(event.gpx_path);
      } catch (err: any) {
        if (cancelled) return;
        if (API_CONFIG.DEBUG) console.error('❌ Load event failed:', err?.message);
        toastError(t('common:errors.generic'), t('personal:errors.loadFailed'));
        // Not an intentional leave: a kept draft must survive a failed load.
        keepDraftOnLeaveRef.current = true;
        navigation.goBack();
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    loadEvent();
    return () => { cancelled = true; };
  }, [eventId, initFormFromEvent, initExistingFile, navigation, t]);

  useEffect(() => {
    void tokenService.getCustomerId().then(setCustomerIdForDraft).catch(() => { /* no draft */ });
  }, []);

  // The loaded event, as the draft compares against it (set once).
  useEffect(() => {
    if (!isLoading && loadedOkRef.current && baseline === null) setBaseline(editDraftSnapshot(formData));
  }, [isLoading, formData, baseline]);

  // Offer a kept draft back once — then the writer below may run.
  useEffect(() => {
    if (!baseline || !customerIdForDraft || draftRestoredRef.current) return;
    draftRestoredRef.current = true;
    (async () => {
      let values: EditDraftValues | null = null;
      try {
        values = usableEditDraft(await AsyncStorage.getItem(EDIT_EVENT_DRAFT_KEY), eventId, customerIdForDraft, Date.now());
      } catch { /* nothing restored */ }
      if (values && !draftOffRef.current) {
        if (values.name !== undefined) handlers.handleNameChange(values.name ?? '');
        const type = eventTypeOptions.find((o) => o.value === values.eventTypeId);
        if (type) handlers.handleEventTypeChange(type);
        const cat = categoryOptions.find((o) => o.value === values.categoryId);
        if (cat) handlers.handleCategoryChange(cat);
        if (values.date) handlers.handleDateChange(values.date);
        if (values.startTime !== undefined) {
          if (values.startTime) handlers.handleStartTimeChange(values.startTime);
          else handlers.handleClearStartTime();
        }
        toastSuccess(t('personal:draft.restoredTitle'), t('personal:draft.restoredMessage'));
      }
      setDraftChecked(true);
    })();
  }, [baseline, customerIdForDraft, eventId, handlers, eventTypeOptions, categoryOptions, t]);

  // Keep the changed fields while they differ from the loaded event.
  useEffect(() => {
    if (!baseline || !customerIdForDraft || !draftChecked || draftOffRef.current) return;
    const timer = setTimeout(() => {
      if (draftOffRef.current) return;
      const diff = editDraftDiff(editDraftSnapshot(formData), baseline);
      void (diff
        ? AsyncStorage.setItem(EDIT_EVENT_DRAFT_KEY, serializeEditDraft(eventId, customerIdForDraft, diff, Date.now()))
        : AsyncStorage.removeItem(EDIT_EVENT_DRAFT_KEY)).catch(() => { /* silent */ });
    }, 400);
    return () => clearTimeout(timer);
  }, [formData, baseline, customerIdForDraft, draftChecked, eventId]);

  // Leaving on purpose (Back / navigation) — a logout fires no beforeRemove.
  useEffect(() => {
    const unsub = navigation.addListener('beforeRemove', () => {
      draftOffRef.current = true;
      if (keepDraftOnLeaveRef.current) return;
      void AsyncStorage.removeItem(EDIT_EVENT_DRAFT_KEY).catch(() => { /* silent */ });
    });
    return unsub;
  }, [navigation]);

  // ✅ Map API field error codes → form field errors using language keys
  // PHP edit API returns identical field codes to the create API
  const applyApiFieldErrors = useCallback((fields: string[]) => {
    fields.forEach((code) => {
      switch (code) {
        case 'name_required':
          setFieldError('name', t('personal:errors.nameRequired'));
          break;
        case 'event_type_required':
          setFieldError('eventType', t('personal:errors.eventTypeRequired'));
          break;
        case 'race_date_required':
          setFieldError('date', t('personal:errors.dateRequired'));
          break;
        case 'category_id_required':
          setFieldError('category', t('personal:errors.categoryRequired'));
          break;
        case 'category_id_invalid':
          setFieldError('category', t('personal:errors.categoryInvalid'));
          break;
        case 'race_date_invalid':
          setFieldError('date', t('personal:errors.invalidDate'));
          break;
        case 'start_hour_invalid':
          setFieldError('startTime', t('personal:errors.invalidStartTime'));
          break;
        // ✅ Mapped since the 2026-11-26 audit: unmapped, the form said nothing.
        case 'timezone_required':
        case 'timezone_invalid':
          setFieldError('startTime', t('personal:errors.timezoneInvalid'));
          break;
        case 'gpx_too_large':
          setFieldError('file', t('personal:errors.fileTooLarge', { size: MAX_FILE_SIZE / (1024 * 1024) }));
          break;

        case 'gpx_invalid_type':
        case 'gpx_invalid_content':
          setFieldError('file', t('personal:errors.invalidFileType'));
          break;
        case 'gpx_upload_failed':
        case 'gpx_save_failed':
        case 'gpx_read_failed':
          setFieldError('file', t('personal:errors.filePickFailed'));
          break;
        default:
          if (API_CONFIG.DEBUG) console.log('⚠️ Unhandled API field error:', code);
          break;
      }
    });
  }, [setFieldError, t]);

  const handleSubmit = useCallback(async () => {
    if (submitGateRef.current) return;
    clearAllErrors();
    if (!validateForm() || isSubmitting) return;
    if (!tryBeginSubmit(submitGateRef)) return;

    setIsSubmitting(true);

    try {
      if (API_CONFIG.DEBUG) console.log('📤 Updating personal event:', eventId);

      const response = await updatePersonalEvent({
        eventId,
        name: formData.name.trim(),
        eventTypeId: formData.selectedEventType?.value ?? null,
        categoryId: formData.selectedCategory?.value ?? null,
        date: formData.date,
        startTime: formData.startTime,
        // ✅ Only when date or time changed (audit 2026-11-26) — a rename made
        // abroad no longer moves the start by the zone offset.
        timezone: editTimezoneToSend({
          date: formData.date,
          startTime: formData.startTime,
          loadedDate,
          loadedStartTime,
          deviceTimezone: getDeviceTimezone(),
          loadedTimezone,   // a time-only edit keeps the event's zone
        }),
        selectedFile: selectedFile ?? undefined,
        removeGpx: shouldRemoveGpx,
      });

      if (API_CONFIG.DEBUG) console.log('✅ Update response:', response);

      // ✅ Handle API field-level validation errors — map to inline form errors
      if (!response.success && response.fields && response.fields.length > 0) {
        // ✅ Codes the form cannot show get a toast (audit 2026-11-26) — the
        // form used to stay silent and the spinner just stopped.
        if (hasNoMappedField(response.fields)) {
          // ✅ Short title (layout audit 2026-11-26): a toast title is ONE line, and
          // "Something went wrong. Please try again." was cut with "…" below ~430pt.
          toastError(t('personal:errors.validationErrorTitle'), t('personal:errors.updateFailed'));
        } else {
          applyApiFieldErrors(response.fields);
        }
        return;
      }

      // ✅ Handle top-level API error codes using language keys
      if (!response.success) {
        switch (response.message) {
          case 'event_not_found':
            toastError(t('common:errors.generic'), t('personal:errors.eventNotFound'));
            break;
          case 'no_changes':
            toastError(t('common:errors.generic'), t('personal:errors.noChanges'));
            break;
          // Server lock (2026-10-30): > 10 min tracked — same rule that hides Edit on Profile.
          case 'tracking_already_started':
            // ✅ reason 'tracking_recent' = tracked minutes ago, temporary
            // (re-audit 2026-11-26) — not the permanent "can no longer be edited".
            toastError(t('common:errors.generic'), isTrackingRecent(response)
              ? t('personal:errors.trackingRecent')
              : t('personal:errors.trackingStarted'));
            break;
          case 'product_custom_app_id_invalid':
            toastError(t('common:errors.generic'), t('personal:errors.invalidEventId'));
            break;
          default:
            toastError(t('common:errors.generic'), t('personal:errors.updateFailed'));
            break;
        }
        return;
      }

      // ✅ Only when this event owns the reminders (re-audit 2026-11-26):
      // cancel() also dropped the real next race's. Home re-plans from the
      // new date on its next answer.
      // Second audit: and only when the gun moved — a rename keeps them.
      if (editMovesGun({ date: formData.date, startTime: formData.startTime, loadedDate, loadedStartTime })) {
        void startReminderService.cancelIfFor(route.params.participantId);
      }
      // ✅ Saved: the kept draft is obsolete (re-audit A11).
      draftOffRef.current = true;
      void AsyncStorage.removeItem(EDIT_EVENT_DRAFT_KEY).catch(() => { /* silent */ });
      toastSuccess(t('personal:success.title'), t('personal:success.editMessage'));

      const customer_app_id = await tokenService.getCustomerId();
      if (API_CONFIG.DEBUG) console.log('🔑 Customer ID from storage:', customer_app_id);

      navigation.navigate('OwnProfile', {
        customer_app_id: customer_app_id || 0,
        fromEdit: true,
      });
    } catch (err: any) {
      if (API_CONFIG.DEBUG) console.error('❌ Update event failed:', err?.message);
      toastError(
        t('common:errors.generic'),
        err.message === 'API_ERROR' ? t('personal:errors.updateFailed') : err.message
      );
    } finally {
      setIsSubmitting(false);
      endSubmit(submitGateRef);
    }
  }, [
    clearAllErrors, validateForm, isSubmitting, eventId,
    formData, selectedFile, shouldRemoveGpx, navigation,
    applyApiFieldErrors, t, loadedDate, loadedStartTime, loadedTimezone,
  ]);

  const showNewFile = !!selectedFile;
  const showExistingFile = !selectedFile && !!existingFile && !existingFile.removed;
  const showUploadBox = !selectedFile && (!existingFile || existingFile.removed);

  if (isLoading) {
    return (
      <SafeAreaView style={commonStyles.container} edges={safeEdges}>
        <AppHeader title={t('common:band.editPersonalEvent')} showLogo showBack />
        <View style={commonStyles.centerContainer}>
          <ActivityIndicator size="large" color={palette.navy} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={commonStyles.container} edges={safeEdges}>
      <AppHeader title={t('common:band.editPersonalEvent')} showLogo showBack />

      <KeyboardAvoidingView
        style={[{ flex: 1 }, sidePadding]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        // ✅ 0, not 80: RN's KAV uses its onLayout frame, relative to a
        // SafeAreaView that starts at the screen top (headerShown false), so
        // AppHeader is already counted. 80 lifted the form 80pt clear of the
        // keyboard — in landscape that left ~0-20pt of form while typing.
        keyboardVerticalOffset={0}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
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
              {errors.name && <Text style={personalStyles.errorText}>{errors.name}</Text>}
            </View>

            <View style={personalStyles.fieldWrapper}>
              <FloatingLabelInput
                label={t('personal:category')}
                value={formData.selectedCategory?.label ?? ''}
                onChangeText={() => { }}
                isDropdown
                options={categoryOptions}
                onSelect={handlers.handleCategoryChange}
                required
                editable={!isSubmitting}
                error={!!errors.category}
              />
              {errors.category && (
                <Text style={personalStyles.errorText}>{errors.category}</Text>
              )}
            </View>

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
                // ✅ Past dates greyed out in the picker; handleDateChange still
                // guards, since some Android OEM pickers ignore minimumDate.
                minimumDate={minDate}
                required
                editable={!isSubmitting}
                error={!!errors.date}
              />
              {errors.date && <Text style={personalStyles.errorText}>{errors.date}</Text>}
            </View>

            {/* Start Time — optional */}
            <View style={personalStyles.fieldWrapper}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <FloatingLabelInput
                    label={t('personal:startTime')}
                    value={formData.startTime}
                    onChangeText={handlers.handleStartTimeChange}
                    iconName="time-outline"
                    isTimePicker
                    editable={!isSubmitting}
                    error={!!errors.startTime}
                  />
                </View>
                {formData.startTime ? (
                  <TouchableOpacity
                    onPress={handlers.handleClearStartTime}
                    disabled={isSubmitting}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={{ marginLeft: 8, marginBottom: 8 }}
                  >
                    <Ionicons name="close-circle" size={22} color={palette.textMuted} />
                  </TouchableOpacity>
                ) : null}
              </View>
              {errors.startTime && <Text style={personalStyles.errorText}>{errors.startTime}</Text>}
            </View>

            {/* GPX File */}
            <View style={personalStyles.fileSection}>
              {showUploadBox && (
                <>
                  {existingFile?.removed && (
                    <TouchableOpacity
                      onPress={undoRemoveExistingFile}
                      disabled={isBusy}
                      style={personalStyles.undoBtn}
                    >
                      <Text style={personalStyles.undoText}>{t('personal:file.undoRemove')}</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[personalStyles.uploadBox, errors.file && personalStyles.uploadBoxError]}
                    onPress={pickFile}
                    activeOpacity={0.8}
                    disabled={isBusy}
                  >
                    {isPickingFile ? (                    
                      <>
                        <ActivityIndicator size="large" color={palette.navy} />
                        <Text style={personalStyles.uploadTitle}>
                          {t('personal:file.loading')}
                        </Text>
                      </>
                    ) : (
                      <>
                        <Ionicons name="cloud-upload-outline" size={40} color={palette.navy} />
                        <Text style={personalStyles.uploadTitle}>{t('personal:file.uploadTitle')}</Text>
                        <Text style={personalStyles.uploadSubtitle}>
                          {t('personal:file.uploadSubtitle', { size: MB })}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </>
              )}

              {showExistingFile && (
                <FileCard
                  fileName={existingFile!.name}
                  fileSubtitle={t('personal:file.existingFile')}
                  disabled={isBusy} 
                  swapIcon="swap-horizontal-outline"
                  onSwapOrView={pickFile}
                  onRemoveOrDiscard={removeExistingFile}
                />
              )}

              {showNewFile && (
                <FileCard
                  fileName={selectedFile!.name}
                  fileSubtitle={formatFileSize(selectedFile!.size)}
                  disabled={isBusy}
                  swapIcon="eye-outline"
                  onSwapOrView={viewNewFile}
                  onRemoveOrDiscard={discardNewFile}
                />
              )}

              {errors.file && <Text style={personalStyles.errorText}>{errors.file}</Text>}
            </View>

            <Text style={personalStyles.subtitle}>{t('personal:fileInfo')}</Text>

            <TouchableOpacity
              style={[
                commonStyles.primaryButton,
                personalStyles.submitBtn,
                isBusy && personalStyles.disabled,
              ]}
              onPress={handleSubmit}
              disabled={isBusy}
              activeOpacity={0.8}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color={palette.surface} />
              ) : (
                <Text style={commonStyles.primaryButtonText}>{t('personal:button.save')}</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default EditPersonalEvent;