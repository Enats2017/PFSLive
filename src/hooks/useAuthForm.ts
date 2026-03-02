import { useState, useCallback } from 'react';

interface UseAuthFormReturn<T> {
  formData: T;
  errors: Record<string, string | undefined>;
  setField: <K extends keyof T>(field: K, value: T[K]) => void;
  setError: (field: string, message: string) => void;
  clearError: (field: string) => void;
  setErrors: (errors: Record<string, string | undefined>) => void;
  clearAllErrors: () => void;
  resetForm: (initialData: T) => void;
}

export const useAuthForm = <T extends Record<string, any>>(
  initialData: T
): UseAuthFormReturn<T> => {
  const [formData, setFormData] = useState<T>(initialData);
  const [errors, setErrorsState] = useState<Record<string, string | undefined>>({});

  const setField = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when user types
    setErrorsState((prev) => {
      const newErrors = { ...prev };
      delete newErrors[field as string];
      return newErrors;
    });
  }, []);

  const setError = useCallback((field: string, message: string) => {
    setErrorsState((prev) => ({ ...prev, [field]: message }));
  }, []);

  const clearError = useCallback((field: string) => {
    setErrorsState((prev) => {
      const newErrors = { ...prev };
      delete newErrors[field];
      return newErrors;
    });
  }, []);

  const setErrors = useCallback((errors: Record<string, string | undefined>) => {
    setErrorsState(errors);
  }, []);

  const clearAllErrors = useCallback(() => {
    setErrorsState({});
  }, []);

  const resetForm = useCallback((initialData: T) => {
    setFormData(initialData);
    setErrorsState({});
  }, []);

  return {
    formData,
    errors,
    setField,
    setError,
    clearError,
    setErrors,
    clearAllErrors,
    resetForm,
  };
};