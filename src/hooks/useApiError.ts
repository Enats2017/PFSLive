import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AppError, ErrorType } from '../services/api';

// ─── Codes that have custom messages in errorScreen/en.json ──────────────────
const CODE_MESSAGES = new Set([
  'results_not_available',
  'not_found_in_race_result',
  'no_data',
  'record_not_found',
  'distance_not_found',
  'payment_failed',
  'event_not_found',
  'registration_closed',
  'session_expired',
  'permission_denied',
  'maintenance',
  'participant_not_found'

]);

export interface ScreenError {
  type: ErrorType;
  title?: string;
  message?: string;
}

interface UseScreenErrorReturn {
  error: ScreenError | null;
  hasError: boolean;
  handleApiError: (err: unknown) => void;
  clearError: () => void;
}

export function useScreenError(): UseScreenErrorReturn {
  const { t } = useTranslation('errorScreen');
  const [error, setError] = useState<ScreenError | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const handleApiError = useCallback((err: unknown) => {
    if (err instanceof AppError) {
      const hasCustom = CODE_MESSAGES.has(err.code);
      setErrorCode(hasCustom ? err.code : null);
      setError({
        type:    err.type,
        title:   hasCustom ? t(`codes.${err.code}.title`)   : undefined,
        message: hasCustom ? t(`codes.${err.code}.message`) : undefined,
        // undefined → ErrorScreen uses default network/server/empty text from en.json
      });
    } else {
          setErrorCode(null);
      setError({ type: 'server' });
    }
  }, [t]);

   useEffect(() => {
    if (!error || !errorCode) {
      return;
    }
    setError((currentError) => {
      if (!currentError) {
        return null;
      }
      return {
        ...currentError,
        title: t(`codes.${errorCode}.title`),
        message: t(`codes.${errorCode}.message`),
      };
    });
  }, [t, errorCode]);

  const clearError = useCallback(() => { setError(null); setErrorCode(null)}, []);

  return {
    error,
    hasError: error !== null,
    handleApiError,
    clearError,
  };
}