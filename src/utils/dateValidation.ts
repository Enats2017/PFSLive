/**
 * Shared date guards for the personal-event forms.
 *
 * Both hooks (create + edit) used to carry their own copy of `isPastDate`,
 * and both got the parsing wrong in the same way — see the note below.
 */

/**
 * Parse a stored `"YYYY-MM-DD"` string into a LOCAL midnight Date.
 *
 * ✅ Deliberately NOT `new Date(str)` — that parses the date-only form as UTC
 * midnight, which lands on the *previous* day west of Greenwich. Mirrors
 * `parseDateValue` in `components/FloatingLabelInput.tsx`, which documents
 * the same trap.
 */
export const parseLocalDate = (dateString: string): Date | null => {
  if (!dateString) return null;
  const [y, m, d] = dateString.split('-').map(Number);
  if (!y || !m || !d) return null;
  const parsed = new Date(y, m - 1, d);
  return isNaN(parsed.getTime()) ? null : parsed;
};

/** Today at local midnight — the boundary every past-date check compares against. */
export const startOfToday = (): Date => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

/**
 * True when `dateString` ("YYYY-MM-DD") falls before today. Today itself is
 * allowed; an empty or unparseable value is not treated as past (the
 * required/format checks own those cases).
 */
export const isPastDate = (dateString: string): boolean => {
  const parsed = parseLocalDate(dateString);
  if (!parsed) return false;
  return parsed < startOfToday();
};

/** Today at local midnight as `"YYYY-MM-DD"`. */
export const getTodayDate = (): string => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};
