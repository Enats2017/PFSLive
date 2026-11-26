// ✅ Personal-event guards (app audit 2026-11-26).
//
// Pure helpers for the create / edit / delete flows, kept free of React and
// native imports so tests/personal_events/app.test.js can run them in plain
// Node. Each one closes a finding from the 2026-11-26 audit; the screens only
// wire them in.

/**
 * One submit at a time. Same shape as tryBeginPurchase (iapPurchaseFlow.ts,
 * the double-charge fix of the same day): `isSubmitting` is React state, so it
 * is only seen after a re-render and two taps in one frame both passed — two
 * POSTs, two events, two tracking sessions used up. A ref is set synchronously.
 */
export const tryBeginSubmit = (gate: { current: boolean }): boolean => {
  if (gate.current) return false;
  gate.current = true;
  return true;
};

export const endSubmit = (gate: { current: boolean }): void => {
  gate.current = false;
};

/**
 * Multipart create / edit carries a GPX of up to 10 MB. The shared 15 s
 * API_CONFIG.TIMEOUT expired while the server was still inserting: the runner
 * saw "failed", tapped Save again and got a second event. 90 s covers a 10 MB
 * upload on a slow uplink; the server also folds a repeat into the first event
 * (create_custom_event_api.php, duplicate window).
 */
export const UPLOAD_TIMEOUT_MS = 90000;

/** Field codes CreatePersonalEvent / EditPersonalEvent turn into an inline error. */
export const MAPPED_FIELD_CODES = [
  'name_required', 'event_type_required', 'category_id_required', 'category_id_invalid',
  'race_date_required', 'race_date_invalid', 'start_hour_invalid',
  'timezone_required', 'timezone_invalid',
  'gpx_too_large', 'gpx_invalid_type', 'gpx_invalid_content',
  'gpx_upload_failed', 'gpx_save_failed', 'gpx_read_failed',
] as const;

/**
 * True when none of the server's field codes is one the form can show. Those
 * fell into `default:` (a debug log), so the spinner stopped and nothing said
 * why — the screen must then show a generic message instead.
 */
export const hasNoMappedField = (fields: readonly string[] | undefined | null): boolean =>
  !(fields ?? []).some((f) => (MAPPED_FIELD_CODES as readonly string[]).includes(f));

/**
 * start_hour for the edit request. The service used to leave it out when the
 * field was cleared, and the server keeps a field it is not sent — so "clear
 * start time" said "updated" and kept the old time. Always sent now: '' means
 * cleared (the server stores 00:00, the same as a create without a time; an
 * older server ignores '' exactly as it ignored the missing field).
 */
export const editStartHourValue = (startTime: string): string => {
  const v = (startTime ?? '').trim();
  if (!v) return '';
  const parts = v.split(':');
  return parts.length >= 2 ? `${parts[0].padStart(2, '0')}:${parts[1]}` : v;
};

/**
 * The time zone to send with an edit, or undefined to keep the event's own.
 * Sending the phone's zone on every save re-zoned an event created in
 * Brussels when it was renamed abroad, moving its start by the offset. The
 * zone only means something next to the date / time it qualifies, so it is
 * sent when one of those changed.
 */
export const editTimezoneToSend = (p: {
  date: string;
  startTime: string;
  loadedDate: string;
  loadedStartTime: string;
  deviceTimezone: string;
  loadedTimezone?: string;
}): string | undefined => {
  // ✅ Second audit 2026-11-26: a start TIME moved abroad re-zoned the event to
  // the phone's zone too (09:00 Brussels became 09:00 Tokyo). The stored zone
  // is kept unless the DATE changed or the event has none.
  const dateChanged = (p.date ?? '') !== (p.loadedDate ?? '');
  const hasZone = !!(p.loadedTimezone ?? '').trim();
  // loadedTimezone undefined = a caller that does not know it: previous rule.
  if (p.loadedTimezone === undefined) {
    const changed = dateChanged || editStartHourValue(p.startTime) !== editStartHourValue(p.loadedStartTime);
    return changed ? p.deviceTimezone : undefined;
  }
  return dateChanged || !hasZone ? p.deviceTimezone : undefined;
};

/**
 * True when the edit moves the gun (date or start time). Only then do the
 * start reminders of that event go (second audit 2026-11-26): a plain rename
 * of Home's next race cancelled its reminders on every save.
 */
export const editMovesGun = (p: { date: string; startTime: string; loadedDate: string; loadedStartTime: string }): boolean =>
  (p.date ?? '') !== (p.loadedDate ?? '') ||
  editStartHourValue(p.startTime) !== editStartHourValue(p.loadedStartTime);

/**
 * Top-level gpx_* codes the create endpoint returned without `fields` (second
 * audit 2026-11-26) — a file that can never succeed then got the generic
 * "try again later". Mapped to the file field like the validation codes.
 */
export const GPX_ERROR_CODES = ['gpx_too_large', 'gpx_invalid_type', 'gpx_invalid_content', 'gpx_upload_failed', 'gpx_save_failed', 'gpx_read_failed'] as const;
export const isGpxErrorCode = (code: string | null | undefined): boolean =>
  !!code && (GPX_ERROR_CODES as readonly string[]).includes(code);

// gpsService's TRACKING_PARAMS_KEY, re-declared by its literal value to avoid
// importing gpsService (same convention as locationQueueService).
export const TRACKING_PARAMS_KEY_LOCAL = '@PFSLive:trackingParams';

/**
 * True when the stored live session is tracking this participant row. Deleting
 * (or editing) a personal event while it was being tracked left the engine
 * running against a deleted participant: every fix came back
 * participant_not_found, a permanent reject, and was dropped.
 */
export const isTrackingParticipant = (
  rawParams: string | null | undefined,
  participantAppId: number | string | null | undefined,
): boolean => {
  if (!rawParams || participantAppId == null || String(participantAppId) === '' || String(participantAppId) === '0') return false;
  try {
    const p = JSON.parse(rawParams);
    return p?.participantId != null && String(p.participantId) === String(participantAppId);
  } catch {
    return false;
  }
};

/**
 * The server's "tracked a few minutes ago" refusal (re-audit 2026-11-26):
 * action / error stays tracking_already_started (app 1.0.9 shows it), with
 * reason 'tracking_recent' added. Temporary — the copy must say so.
 */
export const isTrackingRecent = (res: { reason?: unknown } | null | undefined): boolean =>
  !!res && res.reason === 'tracking_recent';

/** The tracked participant id from the stored session, or null. */
export const trackedParticipantFrom = (rawParams: string | null | undefined): string | null => {
  if (!rawParams) return null;
  try {
    const id = JSON.parse(rawParams)?.participantId;
    return id != null && String(id) !== '' && String(id) !== '0' ? String(id) : null;
  } catch {
    return null;
  }
};

// ── Draft kept across a login (finding 17) ─────────────────────────────────
// PersonalEvent is reachable logged out (the GPX share intent lands there).
// Save then answered 401 and the app went to Login; the login flow ends on
// Profile / Home, so the filled form and the shared file were gone. The form
// is kept for a day and put back the next time the screen opens.

export const PERSONAL_EVENT_DRAFT_KEY = '@PFSLive:personalEventDraft';
export const DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export interface PersonalEventDraft {
  savedAt: number;
  name: string;
  eventTypeId: number | null;
  categoryId: number | null;
  date: string;
  startTime: string;
  file: { uri: string; name: string; mimeType?: string; size?: number } | null;
}

export const serializeDraft = (d: Omit<PersonalEventDraft, 'savedAt'>, now: number): string =>
  JSON.stringify({ ...d, savedAt: now });

/**
 * True when a usable create draft waits (second audit 2026-11-26): after a
 * login the runner is brought back to the create form instead of Home.
 */
export const hasPendingDraft = (raw: string | null | undefined, now: number): boolean => parseDraft(raw, now) !== null;

/** The stored draft, or null when there is none, it is unreadable or older than a day. */
export const parseDraft = (raw: string | null | undefined, now: number): PersonalEventDraft | null => {
  if (!raw) return null;
  try {
    const d = JSON.parse(raw);
    if (!d || typeof d.savedAt !== 'number' || now - d.savedAt > DRAFT_MAX_AGE_MS || now < d.savedAt - 60000) return null;
    return {
      savedAt: d.savedAt,
      name: typeof d.name === 'string' ? d.name : '',
      eventTypeId: typeof d.eventTypeId === 'number' ? d.eventTypeId : null,
      categoryId: typeof d.categoryId === 'number' ? d.categoryId : null,
      date: typeof d.date === 'string' ? d.date : '',
      startTime: typeof d.startTime === 'string' ? d.startTime : '',
      file: d.file && typeof d.file.uri === 'string' && typeof d.file.name === 'string' ? d.file : null,
    };
  } catch {
    return null;
  }
};

// ── Unsaved EDIT kept across a logout (re-audit A11) ────────────────────────
// HomeScreen logs out when the server rejects the token; that unmounts this
// screen by conditional rendering (no beforeRemove), and the unsaved edit was
// lost. Same scheme as profileDraftService (EditProfile): the CHANGED fields
// are kept while they differ from the loaded event, per event and account,
// for a day, never a file; offered back the next time that event's edit
// screen opens; dropped on save and on an intentional leave (beforeRemove).

export const EDIT_EVENT_DRAFT_KEY = '@PFSLive:editPersonalEventDraft';
export const EDIT_DRAFT_FIELDS = ['name', 'eventTypeId', 'categoryId', 'date', 'startTime'] as const;
export type EditDraftField = typeof EDIT_DRAFT_FIELDS[number];
export type EditDraftValues = Partial<{ name: string; eventTypeId: number | null; categoryId: number | null; date: string; startTime: string }>;

/** The edit form as plain values (option objects → their ids). */
export const editDraftSnapshot = (form: {
  name: string;
  selectedEventType: { value: number } | null;
  selectedCategory: { value: number } | null;
  date: string;
  startTime: string;
}): Required<EditDraftValues> => ({
  name: form.name ?? '',
  eventTypeId: form.selectedEventType?.value ?? null,
  categoryId: form.selectedCategory?.value ?? null,
  date: form.date ?? '',
  startTime: form.startTime ?? '',
});

/** Only the fields that differ from the loaded event, or null when none do. */
export const editDraftDiff = (current: EditDraftValues, baseline: EditDraftValues): EditDraftValues | null => {
  const out: EditDraftValues = {};
  let any = false;
  for (const k of EDIT_DRAFT_FIELDS) {
    if (String(current[k] ?? '') !== String(baseline[k] ?? '')) {
      (out as any)[k] = current[k] ?? null;
      any = true;
    }
  }
  return any ? out : null;
};

export const serializeEditDraft = (eventId: number, customerId: number, values: EditDraftValues, now: number): string =>
  JSON.stringify({ eventId, customerId, savedAt: now, values });

/** The stored edit draft for THIS event and account, younger than a day — else null. */
export const usableEditDraft = (
  raw: string | null | undefined,
  eventId: number,
  customerId: number | null,
  now: number,
): EditDraftValues | null => {
  if (!raw || !customerId || !eventId) return null;
  try {
    const d = JSON.parse(raw);
    if (!d || d.eventId !== eventId || d.customerId !== customerId || typeof d.savedAt !== 'number') return null;
    if (now - d.savedAt < 0 || now - d.savedAt > DRAFT_MAX_AGE_MS) return null;
    const values: EditDraftValues = {};
    for (const k of EDIT_DRAFT_FIELDS) if (d.values && k in d.values) (values as any)[k] = d.values[k];
    return Object.keys(values).length ? values : null;
  } catch {
    return null;
  }
};
