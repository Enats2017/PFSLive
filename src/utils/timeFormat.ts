import i18n from '../i18n';

/**
 * Convert a Race Result time-of-day ("HH:MM:SS" or "HH:MM", 24h) into a
 * display string. AM/PM labels come from the active language's `allrace:time`
 * block so they can be localized (or left blank for 24h locales).
 *
 * Behaviour is driven by translation keys under `allrace:time`:
 *   use12h : "1" → 12-hour clock with am/pm suffix, "0"/absent → return 24h as-is
 *   am     : suffix for 00:00–11:59  (e.g. "AM", "" , "v.m.")
 *   pm     : suffix for 12:00–23:59  (e.g. "PM", "" , "n.m.")
 *
 * Examples (use12h="1", am="AM", pm="PM"):
 *   "11:00:26" → "11:00 AM"
 *   "14:31:03" → "2:31 PM"
 *   "00:05:00" → "12:05 AM"
 * With use12h="0" (e.g. FR/NL keep 24h): "14:31:03" → "14:31"
 *
 * Invalid / empty input returns the original string untouched.
 */
export const formatClockTime = (raw?: string | null): string => {
  if (!raw || typeof raw !== 'string') return raw ?? '';
  const trimmed = raw.trim();
  if (trimmed === '' || trimmed === '-' || trimmed === '--') return trimmed;

  const parts = trimmed.split(':');
  if (parts.length < 2) return trimmed; // not a clock value — leave as-is

  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (Number.isNaN(h) || Number.isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    return trimmed; // unparseable — don't mangle it
  }

  const mm = m.toString().padStart(2, '0');

  // Read locale prefs from the allrace:time namespace.
  // `t` with a default keeps it safe if keys are missing.
  const use12h = i18n.t('allrace:time.use12h', { defaultValue: '0' }) === '1';

  if (!use12h) {
    // 24h locales: HH:MM (no seconds, zero-padded hour)
    return `${h.toString().padStart(2, '0')}:${mm}`;
  }

  const isPm = h >= 12;
  let h12 = h % 12;
  if (h12 === 0) h12 = 12; // 0 → 12 AM, 12 → 12 PM

  const suffix = isPm
    ? i18n.t('allrace:time.pm', { defaultValue: 'PM' })
    : i18n.t('allrace:time.am', { defaultValue: 'AM' });

  // Suffix may be empty (locale chooses not to show am/pm) — trim trailing space.
  return `${h12}:${mm}${suffix ? ' ' + suffix : ''}`.trim();
};