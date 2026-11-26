/**
 * ✅ Lower bound handed to the native date picker.
 *
 * WHY THIS EXISTS (feedback #54, 2026-11-25 - "I cannot make an account with
 * my birth date 03-06-1962"): @react-native-community/datetimepicker 8.x on
 * Android 8+ installs a clamp listener whenever maximumDate OR minimumDate is
 * set, and when only maximumDate is given its Common.minDateWithTimeZone()
 * returns 0 - the Unix epoch. Every date before 1 January 1970 is then snapped
 * up to 01-01-1970 while the user scrolls the spinner. Commit ced2613
 * (2026-10-01) added maximumDate={new Date()} to the birth-date fields, and
 * from 2026-10-17 prod has 24 Android accounts with dob exactly 1970-01-01
 * and almost no pre-1970 Android dates any more (iOS unaffected).
 *
 * Passing an explicit minimum avoids the epoch fallback. 1900-01-01 is the
 * library's own DEFAULT_MIN_DATE for the no-bounds case, and well below the
 * backend's 120-year limit, so it never refuses a real birth date.
 */
export const DEFAULT_PICKER_MIN_DATE_PARTS = { year: 1900, month: 0, day: 1 } as const;

export const defaultPickerMinimumDate = (): Date =>
  new Date(
    DEFAULT_PICKER_MIN_DATE_PARTS.year,
    DEFAULT_PICKER_MIN_DATE_PARTS.month,
    DEFAULT_PICKER_MIN_DATE_PARTS.day,
  );

/**
 * The caller's minimumDate when given; otherwise 1900-01-01 whenever a
 * maximumDate is set (the case that falls back to the epoch). With neither
 * bound the library applies no clamp and its own 1900 default, so undefined is
 * passed through unchanged.
 */
export const resolvePickerMinimumDate = (
  minimumDate: Date | undefined,
  maximumDate: Date | undefined,
): Date | undefined => {
  if (minimumDate) return minimumDate;
  if (maximumDate) return defaultPickerMinimumDate();
  return undefined;
};
