import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PersonalEvent } from '../services/editPersonalEventService';
import { isValidDate } from '../services/personalEventService';
import { isPastDate } from '../utils/dateValidation';

export interface EventTypeOption {
  label: string;
  value: number;
}

export interface CategoryOption {
  label: string;
  value: number;
}

export interface EditFormData {
  name: string;
  selectedEventType: EventTypeOption | null;
  selectedCategory: CategoryOption | null; 
  date: string;
  startTime: string;
}

export interface EditFormErrors {
  name?: string;
  eventType?: string;
  category?: string;   
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

const matchCategory = (raw: string | number | null, options: CategoryOption[]): CategoryOption | null => {
  if (!raw) return null;
  const n = Number(raw);
  return (!isNaN(n) && n > 0)
    ? options.find((o) => o.value === n) ?? null
    : null;
};

const INITIAL_FORM: EditFormData = { name: '', selectedEventType: null, selectedCategory: null, date: '', startTime: '' };

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

   const categoryOptions: CategoryOption[] = useMemo(
    () => [
      { label: t('personal:categoryTypes.walking'), value: 64 },
      { label: t('personal:categoryTypes.running'), value: 59 },
      { label: t('personal:categoryTypes.cycling'), value: 60 },
    ],
    [t],
  );

  const [formData, setFormData] = useState<EditFormData>(INITIAL_FORM);
  const [errors, setErrors] = useState<EditFormErrors>({});

  // ✅ The date the event already had when the screen loaded. An event that has
  // already started is still editable (name, category, GPX…), so validateForm
  // must not reject its own stored race_date as "past" — only a date the user
  // actively picks is held to that rule.
  const [loadedDate, setLoadedDate] = useState<string>('');

  const initFormFromEvent = useCallback(
    (event: PersonalEvent) => {
      setLoadedDate(event.race_date ?? '');
      setFormData({
        name: event.name ?? '',
        selectedEventType: matchEventType(event.event_type, eventTypeOptions),
        selectedCategory: matchCategory(event.category_id ?? null, categoryOptions), 
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
        field === 'selectedEventType' ? 'eventType' :
        field === 'selectedCategory' ? 'category' :   
        (field as keyof EditFormErrors);

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
      handleCategoryChange:   (v: CategoryOption | null) => setField('selectedCategory', v),
      handleDateChange: (v: string) => {
        // ✅ v === loadedDate means the user re-picked the event's own date,
        // which stays legal even once it is in the past — see loadedDate above.
        if (v !== loadedDate && isPastDate(v)) {
          setErrors((prev) => ({
            ...prev,
            date: t('personal:errors.pastDateNotAllowed'),
          }));
          return;
        }

        setField('date', v);
      },
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
    [setField, loadedDate, t],
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
    if (!formData.selectedCategory) {
      e.category = t('personal:errors.categoryRequired');
    }
    if (!formData.date.trim()) {
      e.date = t('personal:errors.dateRequired');
    } else if (!isValidDate(formData.date)) {
      e.date = t('personal:errors.invalidDate');
    } else if (formData.date !== loadedDate && isPastDate(formData.date)) {
      // ✅ Skipped while the date is still the one the event was loaded with —
      // see the loadedDate note above.
      e.date = t('personal:errors.pastDateNotAllowed');
    }
    // ✅ startTime optional — only validate format if provided
    if (formData.startTime.trim() && !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]/.test(formData.startTime)) {
      e.startTime = t('personal:errors.invalidStartTime');
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  }, [formData, loadedDate, t]);

  return {
    formData,
    errors,
    loadedDate,
    eventTypeOptions,
    categoryOptions,
    initFormFromEvent,
    setFieldError,
    clearAllErrors,
    validateForm,
    handlers,
  };
};