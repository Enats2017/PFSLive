// Which get_profile_api errors mean "this login belongs to an account that no
// longer exists". Pure, so it is tested without React or the API client:
// npm run test:profile-load-error
//
// (2026-10-30 support ticket) A participant deleted his account (GDPR), then
// reinstalled the app. iOS keeps Keychain items across an uninstall, so the
// SecureStore token came back with the reinstall. The server had deleted the
// oc_customer_app row but not the oc_customer_app_token rows, so the token still
// verified. home_api never answered "unauthorized" and the app stayed logged in.
// get_profile_api filters on the customer row and answered account_not_found,
// which EditProfileScreen printed as raw text. The app has no logout button, so
// he was stuck as a user that no longer exists.
//
// The server now revokes the tokens on deletion, but a phone can still hold a
// token for a missing or disabled (status 0) account. Both come back as
// account_not_found, and in both cases the only way forward is the login screen,
// so the app treats the code exactly like an expired session.

const DELETED_ACCOUNT_CODES = new Set(['account_not_found']);

/** Does this profile API error code mean the logged-in account is gone? */
export function isDeletedAccountCode(code: unknown): boolean {
  if (typeof code !== 'string') return false;
  return DELETED_ACCOUNT_CODES.has(code.trim().toLowerCase());
}
