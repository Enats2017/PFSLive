import { useState, useCallback, useEffect } from 'react';
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

// ✅ HELPER FUNCTIONS
const getTodayDate = (): string => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const getCurrentTime = (): string => {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

const isPastDate = (dateString: string): boolean => {
  if (!dateString) return false;
  
  const inputDate = new Date(dateString);
  const today = new Date();
  
  // Set time to start of day for accurate comparison
  today.setHours(0, 0, 0, 0);
  inputDate.setHours(0, 0, 0, 0);
  
  return inputDate < today;
};

export const usePersonalEventForm = () => {
  const { t } = useTranslation(['personal']);

  // ✅ CONSOLIDATED STATE WITH DEFAULTS
  const [formData, setFormData] = useState({
    name: '',
    selectedEventType: null as EventType | null,
    date: getTodayDate(), // ✅ Default to today
    startTime: getCurrentTime(), // ✅ Default to current time
  });

  const [errors, setErrors] = useState<FieldErrors>({});

  // ✅ GENERIC FIELD HANDLER
  const handleFieldChange = useCallback(
    <K extends keyof typeof formData>(field: K, errorKey: keyof FieldErrors) =>
      (value: typeof formData[K]) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
        if (errors[errorKey]) {
          setErrors((prev) => {
            const newErrors = { ...prev };
            delete newErrors[errorKey];
            return newErrors;
          });
        }
      },
    [errors]
  );

  // ✅ SPECIFIC HANDLERS
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
      // ✅ PREVENT PAST DATES
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

  // ✅ ERROR HANDLERS
  const setFieldError = useCallback((field: keyof FieldErrors, message: string) => {
    setErrors((prev) => ({ ...prev, [field]: message }));
  }, []);

  const clearAllErrors = useCallback(() => {
    setErrors({});
  }, []);

  // ✅ VALIDATION
  const validateForm = useCallback((): boolean => {
    const newErrors: FieldErrors = {};
    const { name, selectedEventType, date, startTime } = formData;

    if (!name.trim()) {
      newErrors.name = t('personal:errors.nameRequired');
    }

    if (!selectedEventType) {
      newErrors.eventType = t('personal:errors.eventTypeRequired');
    }

    if (!date.trim()) {
      newErrors.date = t('personal:errors.dateRequired');
    } else if (!isValidDate(date)) {
      newErrors.date = t('personal:errors.invalidDate');
    } else if (isPastDate(date)) {
      // ✅ VALIDATE PAST DATE
      newErrors.date = t('personal:errors.pastDateNotAllowed');
    }

    if (!startTime.trim()) {
      newErrors.startTime = t('personal:errors.startTimeRequired');
    } else if (!isValidTime(startTime)) {
      newErrors.startTime = t('personal:errors.invalidStartTime');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData, t]);

  // ✅ RESET FORM (WITH DEFAULTS)
  const resetForm = useCallback(() => {
    setFormData({
      name: '',
      selectedEventType: null,
      date: getTodayDate(), // ✅ Reset to today
      startTime: getCurrentTime(), // ✅ Reset to current time
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
    },
    setFieldError,
    clearAllErrors,
    validateForm,
    resetForm,
  };
};