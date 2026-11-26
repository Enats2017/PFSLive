// ✅ The GPX kept with a personal-event draft (re-audit 2026-11-26, N5).
//
// The draft (personalEventGuards.ts, finding 17) stored the shared file's own
// URI. On Android that is a content:// grant from WhatsApp / Drive which dies
// with the process — after the login detour the restored file failed at Save.
// The file is now COPIED into the app's document folder when the draft is
// saved, the draft points at the copy, and the folder is emptied once the
// event is created (or the draft is dropped).
//
// The file-system calls are passed in (expo-file-system/legacy in the app) so
// tests/personal_events/app.test.js can run this in plain Node.

export interface DraftFs {
  documentDirectory: string | null;
  makeDirectoryAsync(uri: string, opts?: { intermediates?: boolean }): Promise<void>;
  copyAsync(opts: { from: string; to: string }): Promise<void>;
  deleteAsync(uri: string, opts?: { idempotent?: boolean }): Promise<void>;
}

export const DRAFT_DIR_NAME = 'personal_event_draft/';

export const draftDir = (fs: DraftFs): string | null =>
  fs.documentDirectory ? fs.documentDirectory + DRAFT_DIR_NAME : null;

/** Name safe for a file path: letters, digits, dot, dash, underscore. */
const safeName = (name: string): string =>
  (name || 'route.gpx').replace(/[^A-Za-z0-9._-]+/g, '_').slice(-80) || 'route.gpx';

/**
 * Copy `uri` into the draft folder and return the copy's URI. Any earlier
 * draft copy is removed first (one draft at a time). On failure the original
 * URI is returned — a file that may still work beats none.
 */
export async function persistDraftFile(fs: DraftFs, uri: string, name: string, now: number): Promise<string> {
  const dir = draftDir(fs);
  if (!dir || !uri) return uri;
  if (uri.startsWith(dir)) return uri;        // already the kept copy
  try {
    await fs.deleteAsync(dir, { idempotent: true });
    await fs.makeDirectoryAsync(dir, { intermediates: true });
    const to = `${dir}${now}_${safeName(name)}`;
    await fs.copyAsync({ from: uri, to });
    return to;
  } catch {
    return uri;
  }
}

/** Remove every kept draft copy. Never throws. */
export async function clearDraftFiles(fs: DraftFs): Promise<void> {
  const dir = draftDir(fs);
  if (!dir) return;
  try { await fs.deleteAsync(dir, { idempotent: true }); } catch { /* nothing kept */ }
}
