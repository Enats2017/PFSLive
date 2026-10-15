import { AppState } from 'react-native';

// ✅ Did the OS actually SHOW something for a permission request?
// Its answer can't tell: a silent auto-deny and a real refusal look the same,
// and canAskAgain stays true for both. Elapsed time alone misleads too —
// expo-location on iOS waits a fixed 1.5 s before answering "denied" when iOS
// shows no "Change to Always Allow" dialog, which read as a real refusal.
//
// A dialog or the OS Location page takes the app out of 'active'. Without
// that, only a wait well past expo's no-dialog timeout counts as "shown".
export const NO_DIALOG_MAX_MS = 2500;

export function osShowedPrompt(leftForeground: boolean, elapsedMs: number): boolean {
  return leftForeground || elapsedMs > NO_DIALOG_MAX_MS;
}

/** Start watching before the request; call done() once it settled (also on error). */
export function watchForOsPrompt(): { done(): boolean } {
  const startedAt = Date.now();
  let leftForeground = false;
  let sub: { remove(): void } | null = null;
  try {
    sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') leftForeground = true;
    });
  } catch { /* no AppState (tests): elapsed time only */ }
  return {
    done() {
      try { sub?.remove(); } catch { /* already removed */ }
      sub = null;
      return osShowedPrompt(leftForeground, Date.now() - startedAt);
    },
  };
}
