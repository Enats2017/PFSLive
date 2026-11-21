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

// ✅ ...but only a REAL stay away counts (2026-10-28). On Android every request
// goes through the system's permission activity, even when the OS has decided
// to show nothing (e.g. location switched off for Livio in Settings): it pauses
// the app for a blink and finishes. That blink read as "the runner saw a dialog
// and said no", so the Start popup's "Open settings" re-showed the popup and
// never opened Settings — a loop. Nobody reads and answers a dialog this fast.
export const MIN_AWAY_MS = 700;

export function osShowedPrompt(awayMs: number, elapsedMs: number): boolean {
  return awayMs >= MIN_AWAY_MS || elapsedMs > NO_DIALOG_MAX_MS;
}

/** Start watching before the request; call done() once it settled (also on error). */
export function watchForOsPrompt(): { done(): boolean } {
  const startedAt = Date.now();
  let awayMs = 0;            // total time out of 'active'
  let leftAt: number | null = null;
  let sub: { remove(): void } | null = null;
  try {
    sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') { if (leftAt === null) leftAt = Date.now(); return; }
      if (leftAt !== null) { awayMs += Date.now() - leftAt; leftAt = null; }
    });
  } catch { /* no AppState (tests): elapsed time only */ }
  return {
    done() {
      try { sub?.remove(); } catch { /* already removed */ }
      sub = null;
      const now = Date.now();
      // Still away when the request settled: count up to now.
      const away = awayMs + (leftAt !== null ? now - leftAt : 0);
      return osShowedPrompt(away, now - startedAt);
    },
  };
}
