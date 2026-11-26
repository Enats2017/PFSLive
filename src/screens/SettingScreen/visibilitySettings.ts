// ✅ Live-tracking visibility: what the server has vs what the tabs show
// (app audit 2026-11-26). Pure, so tests/personal_events/app.test.js runs it.
//
// The tabs were the only state. Tapping Private and closing the password sheet
// left "Private" on screen while the server stayed public, and the language
// picker then sent that unsaved tab with an empty password — the account went
// private with no password (every list showed it password-protected). Tapping
// Public without Save and then changing language made the account public.
// Only an explicit Save may change visibility; everything else sends, and
// falls back to, the last state the server confirmed.

export type Visibility = 'public' | 'private';

export interface SavedVisibility {
  visibility: Visibility;
  password: string;
}

/**
 * The settings a language change sends: the SAVED visibility, never the tabs —
 * and NONE when the settings never loaded (re-audit 2026-11-26): the screen's
 * default "public" then went out with the language and made a private account
 * public. null = a language-only update (update_customer_setting_api.php
 * accepts it since the same date).
 */
export const languageUpdateSettings = (saved: SavedVisibility | null) =>
  saved === null
    ? null
    : {
        live_tracking_visibility: saved.visibility,
        live_tracking_password: saved.visibility === 'private' ? saved.password : '',
      };

/** What the tabs return to when the password sheet is closed without saving. */
export const afterSheetDismissed = (saved: SavedVisibility | null): SavedVisibility => ({
  visibility: saved?.visibility ?? 'public',
  password: saved?.visibility === 'private' ? saved.password : '',
});
