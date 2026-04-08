import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PersonalEvent } from '../services/editPersonalEventService';

export interface EventTypeOption {
  label: string;
  value: number;
}

export interface EditFormData {
  name: string;
  selectedEventType: EventTypeOption | null;
  date: string;
  startTime: string;
}

export interface EditFormErrors {
  name?: string;
  eventType?: string;
  date?: string;
  startTime?: string;
  file?: string;
}

const matchEventType = (raw: string, options: EventTypeOption[]): EventTypeOption | null => {
  if (!raw) return null;
  const n = Number(raw);
  return (!isNaN(n) && n > 0)
    ? options.find((o) => o.value === n) ?? null
    : options.find((o) => o.label === raw) ?? null;
};

const INITIAL_FORM: EditFormData = { name: '', selectedEventType: null, date: '', startTime: '' };

export const useEditPersonalEventForm = () => {
  const { t } = useTranslation(['personal']);

  const eventTypeOptions: EventTypeOption[] = useMemo(
    () => [
      { label: t('personal:eventTypes.organizedWithResults'), value: 1 },
      { label: t('personal:eventTypes.organizedWithoutResults'), value: 2 },
      { label: t('personal:eventTypes.training'), value: 3 },
    ],
    [t],
  );

  const [formData, setFormData] = useState<EditFormData>(INITIAL_FORM);
  const [errors, setErrors] = useState<EditFormErrors>({});

  const initFormFromEvent = useCallback(
    (event: PersonalEvent) => {
      setFormData({
        name: event.name ?? '',
        selectedEventType: matchEventType(event.event_type, eventTypeOptions),
        date: event.race_date ?? '',
        startTime: (event.start_hour ?? '').substring(0, 5), // "HH:MM:SS" → "HH:MM"
      });
    },
    [eventTypeOptions],
  );

  const setField = useCallback(
    <K extends keyof EditFormData>(field: K, value: EditFormData[K]) => {
      setFormData((prev) => {
        if (prev[field] === value) return prev;
        return { ...prev, [field]: value };
      });

      const errorKey: keyof EditFormErrors =
        field === 'selectedEventType' ? 'eventType' : (field as keyof EditFormErrors);

      setErrors((prev) => {
        if (!prev[errorKey]) return prev;
        return { ...prev, [errorKey]: undefined };
      });
    },
    [],
  );

  const handlers = useMemo(
    () => ({
      handleNameChange:      (v: string) => setField('name', v),
      handleEventTypeChange: (v: EventTypeOption) => setField('selectedEventType', v),
      handleDateChange:      (v: string) => setField('date', v),
      handleStartTimeChange: (v: string) => setField('startTime', v),
      // ✅ Clears start time — exposed so UI can show a clear button
      handleClearStartTime:  () => {
        setFormData((prev) => ({ ...prev, startTime: '' }));
        setErrors((prev) => {
          if (!prev.startTime) return prev;
          return { ...prev, startTime: undefined };
        });
      },
    }),
    [setField],
  );

  const setFieldError = useCallback(
    (field: keyof EditFormErrors, message: string) =>
      setErrors((prev) => ({ ...prev, [field]: message })),
    [],
  );

  const clearAllErrors = useCallback(() => setErrors({}), []);

  const validateForm = useCallback((): boolean => {
    const e: EditFormErrors = {};

    if (!formData.name.trim()) {
      e.name = t('personal:errors.nameRequired');
    }
    if (!formData.selectedEventType) {
      e.eventType = t('personal:errors.eventTypeRequired');
    }
    if (!formData.date) {
      e.date = t('personal:errors.dateRequired');
    }
    // ✅ startTime optional — only validate format if provided
    if (formData.startTime.trim() && !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]/.test(formData.startTime)) {
      e.startTime = t('personal:errors.invalidStartTime');
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  }, [formData, t]);

  return {
    formData,
    errors,
    eventTypeOptions,
    initFormFromEvent,
    setFieldError,
    clearAllErrors,
    validateForm,
    handlers,
  };
};