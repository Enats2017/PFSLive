/**
 * Pure helpers for the auth screens. No React, no AsyncStorage, no network, so
 * they are tested directly:
 *   npx tsc src/services/authFlowGuards.ts src/services/deviceIdStore.ts src/services/authFlowGuards.test.ts --rootDir src --target es2019 --module commonjs --moduleResolution node --esModuleInterop --skipLibCheck --outDir .cardtest && node .cardtest/services/authFlowGuards.test.js
 *
 * Audit 2026-11-26 (auth/account). Same class as the Apple double charge fixed in
 * c8b1901: a second tap in the same frame passes a `loading` state that has not
 * re-rendered yet, and the server issues ONE token per account
 * (AuthToken::MAX_TOKENS_PER_USER = 1), so two logins or two verifies mint two
 * tokens and the older one is revoked - and the phone may keep the older one.
 */

/**
 * ✅ One submit at a time. A plain ref, not React state: two taps in the same
 * frame both see `loading === false`, a ref flipped synchronously does not.
 * Returns true and closes the gate, or false when a submit is already running.
 */
export function tryBeginSubmit(gate: { current: boolean }): boolean {
  if (gate.current) return false;
  gate.current = true;
  return true;
}

export function endSubmit(gate: { current: boolean }): void {
  gate.current = false;
}

/**
 * ✅ Newest request wins. Each token-issuing request takes a ticket; only the
 * holder of the LATEST ticket may write the token. The server revokes every
 * older token on each new one, so the newest request is the only one whose token
 * is alive - whatever order the responses come back in.
 */
export function createLatestRequestGate() {
  let issued = 0;
  return {
    begin(): number {
      issued += 1;
      return issued;
    },
    isLatest(ticket: number): boolean {
      return ticket === issued;
    },
  };
}

/** Shared by login and OTP verify: both issue the account's single token. */
export const tokenIssueGate = createLatestRequestGate();

export type OtpPurposeLike = 'registration' | 'forgot_password' | 'device_change' | 'email_change';

/**
 * ✅ Which copy a dead verification token gets.
 *
 * For registration and device_change the server NULLs the token on success. If
 * the success response was lost (network drop, app in background), the retry
 * comes back verification_token_invalid although the account IS verified / moved
 * - and "Please register again" then fails with email_exists. Those purposes get
 * copy that says "if you already finished, just log in". verification_conflict is
 * the new code a parallel verify of the same token now gets (verify_otp_api.php).
 */
export function otpTokenInvalidKey(purpose: OtpPurposeLike, code: string): string | null {
  if (code !== 'verification_token_invalid' && code !== 'verification_conflict') return null;
  if (purpose === 'registration' || purpose === 'device_change') {
    return 'tokenInvalidMaybeVerified';
  }
  return 'tokenInvalid';
}

/**
 * ✅ A registration code that can never be used again (second audit, AUB):
 * too many wrong codes or resends. The way forward is a new sign-up with the
 * same email (register_api keeps nothing in the way of that), so the stored
 * "resume this registration" entry must go and the copy must say so. Other
 * purposes keep their own messages.
 */
export function otpDeadEndKey(purpose: OtpPurposeLike, code: string): string | null {
  if (purpose !== 'registration') return null;
  return code === 'otp_max_attempts' || code === 'otp_too_many_attempts' || code === 'otp_max_resends'
    ? 'registerAgain'
    : null;
}

/**
 * ✅ A registration that has not been verified yet, kept so the code can still be
 * entered after the app was killed on the OTP screen. Before this the
 * verification_token lived only in navigation params: Login then answered
 * email_not_verified and said "enter the code we emailed you" with no screen
 * anywhere that could take that code.
 */
export interface PendingOtp {
  email: string;
  verification_token: string;
  savedAt: number;
}

// The server keeps the unverified row (and its token) until a new registration
// for the same email or device replaces it; resend works on the same token. A
// week covers "I'll do it tonight" without resurrecting ancient attempts.
export const PENDING_OTP_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function parsePendingOtp(raw: string | null): PendingOtp | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw);
    if (p && typeof p.email === 'string' && typeof p.verification_token === 'string'
        && p.verification_token.length === 64 && typeof p.savedAt === 'number') {
      return { email: p.email, verification_token: p.verification_token, savedAt: p.savedAt };
    }
  } catch { /* corrupt - treat as none */ }
  return null;
}

/** The stored registration may be resumed for this email right now. */
export function usablePendingOtp(
  pending: PendingOtp | null,
  email: string,
  now: number,
): PendingOtp | null {
  if (!pending) return null;
  if (pending.email.trim().toLowerCase() !== email.trim().toLowerCase()) return null;
  if (now - pending.savedAt < 0 || now - pending.savedAt > PENDING_OTP_MAX_AGE_MS) return null;
  return pending;
}

/**
 * ✅ Unsaved Edit Profile changes (re-audit A11). A rejected token found by
 * HomeScreen's poll logs out, and logging out removes the logged-in screen
 * group by conditional rendering - EditProfile is torn down with whatever was
 * typed, and React Navigation fires no beforeRemove for that. The draft is kept
 * while the form differs from the saved profile, cleared on Save or when the
 * user leaves on purpose, and offered back next time - same account only.
 * Passwords and the picked photo are never part of it.
 */
export const PROFILE_DRAFT_FIELDS = [
  'firstname', 'lastname', 'email', 'city', 'dob', 'gender',
  'countryName', 'country_id', 'country_iso', 'language_id', 'parentConsent',
] as const;
export type ProfileDraftField = typeof PROFILE_DRAFT_FIELDS[number];
export type ProfileDraftValues = Partial<Record<ProfileDraftField, string | number | boolean>>;
export interface ProfileDraft { customerId: number; savedAt: number; values: ProfileDraftValues }
export const PROFILE_DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** The draft fields of `form` that differ from `saved`; null when nothing differs. */
export function profileDraftDiff(
  form: Record<string, unknown>,
  saved: Record<string, unknown>,
): ProfileDraftValues | null {
  const out: ProfileDraftValues = {};
  let any = false;
  for (const k of PROFILE_DRAFT_FIELDS) {
    if (String(form[k] ?? '') !== String(saved[k] ?? '')) {
      out[k] = form[k] as any;
      any = true;
    }
  }
  return any ? out : null;
}

/** A stored draft worth restoring for this account right now, else null. */
export function usableProfileDraft(raw: string | null, customerId: number | null, now: number): ProfileDraftValues | null {
  if (!raw || !customerId) return null;
  try {
    const d = JSON.parse(raw) as ProfileDraft;
    if (!d || d.customerId !== customerId || typeof d.savedAt !== 'number') return null;
    if (now - d.savedAt < 0 || now - d.savedAt > PROFILE_DRAFT_MAX_AGE_MS) return null;
    const values: ProfileDraftValues = {};
    for (const k of PROFILE_DRAFT_FIELDS) if (d.values && k in d.values) values[k] = (d.values as any)[k];
    return Object.keys(values).length ? values : null;
  } catch {
    return null;
  }
}

/**
 * ✅ A Connect saved before login that is too old to replay (re-audit AN3).
 * It is dropped - replaying would register and can spend a session - but the
 * runner must be TOLD, or they believe the Connect went through.
 */
export function shouldNoticeExpiredConnect(
  productId: string | null | undefined,
  optionId: string | null | undefined,
  fresh: boolean,
): boolean {
  return !!productId && !!optionId && !fresh;
}

/**
 * ✅ The pending-email "verify" button failed on the ADDRESS itself (taken or
 * invalid) - the only case for "address taken" copy and resetting the field.
 * Anything else (offline, 401, 5xx) gets the normal save-failure message
 * (second audit 2026-11-26, AUE).
 */
export function pendingVerifyFailedOnField(fieldErrors: string[] | undefined): boolean {
  return !!fieldErrors && fieldErrors.some((c) => c === 'email_already_taken' || c === 'email_invalid' || c === 'email_too_long');
}

/**
 * ✅ What the edit-profile screen tells the user when Save fails. It used to say
 * nothing at all for anything but a mapped field error: offline, a 401, a 5xx, a
 * rejected photo (whose codes arrive in `fields` but had no field to land on).
 */
export type EditProfileFailure = 'session_expired' | 'picture' | 'network' | 'generic';

const PICTURE_CODES = new Set([
  'profile_picture_too_large',
  'profile_picture_invalid_type',
  'profile_picture_invalid',
  'profile_picture_save_failed',
  'profile_picture_partial',
  'profile_picture_server_error',
  'profile_picture_failed',
]);

export function isPictureErrorCode(code: string): boolean {
  return PICTURE_CODES.has(code);
}

export function classifyEditProfileFailure(err: {
  fields?: string[];
  code?: string;
  type?: string;
  message?: string;
}): EditProfileFailure {
  if (err.fields && err.fields.some(isPictureErrorCode)) return 'picture';
  const code = String(err.code ?? err.message ?? '').toLowerCase();
  if (code === 'unauthorized' || code === 'session_expired' || code === 'account_not_found') {
    return 'session_expired';
  }
  if (isPictureErrorCode(code)) return 'picture';
  if (err.type === 'network' || code === 'network_error') return 'network';
  return 'generic';
}
