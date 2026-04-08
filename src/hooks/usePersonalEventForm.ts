import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  isValidDate,
  isValidTime,
  isValidEventType,
} from '../services/personalEventService';

interface FieldErrors {
  name?: string;
  eventType?: string;
  date?: string;
  startTime?: string;
  file?: string;
}

interface EventType {
  label: string;
  value: number;
}

const getTodayDate = (): string => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const isPastDate = (dateString: string): boolean => {
  if (!dateString) return false;
  const inputDate = new Date(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  inputDate.setHours(0, 0, 0, 0);
  return inputDate < today;
};

export const usePersonalEventForm = () => {
  // ✅ All validation messages come from the language file via t()
  const { t } = useTranslation(['personal']);

  const [formData, setFormData] = useState({
    name: '',
    selectedEventType: null as EventType | null,
    date: getTodayDate(),
    startTime: '', // optional — empty by default
  });

  const [errors, setErrors] = useState<FieldErrors>({});

  const handleFieldChange = useCallback(
    <K extends keyof typeof formData>(field: K, errorKey: keyof FieldErrors) =>
      (value: typeof formData[K]) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
        if (errors[errorKey]) {
          setErrors((prev) => {
            const next = { ...prev };
            delete next[errorKey];
            return next;
          });
        }
      },
    [errors]
  );

  const handleNameChange = useCallback(
    (value: string) => handleFieldChange('name', 'name')(value),
    [handleFieldChange]
  );

  const handleEventTypeChange = useCallback(
    (value: EventType | null) => handleFieldChange('selectedEventType', 'eventType')(value),
    [handleFieldChange]
  );

  const handleDateChange = useCallback(
    (value: string) => {
      if (isPastDate(value)) {
        setErrors((prev) => ({
          ...prev,
          date: t('personal:errors.pastDateNotAllowed'),
        }));
        return;
      }
      handleFieldChange('date', 'date')(value);
    },
    [handleFieldChange, t]
  );

  const handleStartTimeChange = useCallback(
    (value: string) => handleFieldChange('startTime', 'startTime')(value),
    [handleFieldChange]
  );

  const handleClearStartTime = useCallback(() => {
    setFormData((prev) => ({ ...prev, startTime: '' }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next.startTime;
      return next;
    });
  }, []);

  const setFieldError = useCallback((field: keyof FieldErrors, message: string) => {
    setErrors((prev) => ({ ...prev, [field]: message }));
  }, []);

  const clearAllErrors = useCallback(() => setErrors({}), []);

  // ✅ All error messages from personal:errors.* language keys — no hardcoded strings
  const validateForm = useCallback((): boolean => {
    const newErrors: FieldErrors = {};
    const { name, selectedEventType, date, startTime } = formData;

    if (!name.trim()) {
      newErrors.name = t('personal:errors.nameRequired');
    }

    if (!isValidEventType(selectedEventType?.value ?? null)) {
      newErrors.eventType = t('personal:errors.eventTypeRequired');
    }

    if (!date.trim()) {
      newErrors.date = t('personal:errors.dateRequired');
    } else if (!isValidDate(date)) {
      newErrors.date = t('personal:errors.invalidDate');
    } else if (isPastDate(date)) {
      newErrors.date = t('personal:errors.pastDateNotAllowed');
    }

    // startTime optional — only validate format if provided
    if (startTime.trim() && !isValidTime(startTime)) {
      newErrors.startTime = t('personal:errors.invalidStartTime');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData, t]);

  const resetForm = useCallback(() => {
    setFormData({
      name: '',
      selectedEventType: null,
      date: getTodayDate(),
      startTime: '',
    });
    setErrors({});
  }, []);

  return {
    formData,
    errors,
    handlers: {
      handleNameChange,
      handleEventTypeChange,
      handleDateChange,
      handleStartTimeChange,
      handleClearStartTime,
    },
    setFieldError,
    clearAllErrors,
    validateForm,
    resetForm,
  };
};