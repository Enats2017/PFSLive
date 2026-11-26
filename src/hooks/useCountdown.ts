import { useState, useEffect, useMemo } from 'react';
import { AppState } from 'react-native';

// ✅ Counted against the WALL CLOCK, not by ticks (app audit 2026-11-26).
// It used to subtract 1 per setInterval tick from the value it got at mount.
// JS timers pause while the app is in the background, so after an hour away
// the badge was an hour behind ("2h 10m" for a race 10 minutes off) and showed
// Live that much late; new props from a refetch were ignored too. Now the
// target instant is fixed from the props (re-anchored only when they change)
// and every tick — and every return to the foreground — reads Date.now().
export const useCountdown = (initialDays: number, initialHours: number, initialMinutes: number, status: string) => {
  const inputSeconds = (initialDays * 86400) + (initialHours * 3600) + (initialMinutes * 60);
  // When the countdown reaches 0, as an epoch ms. New props → new anchor.
  const targetMs = useMemo(() => Date.now() + inputSeconds * 1000, [inputSeconds]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setNow(Date.now());
    if (status !== 'not_started' || inputSeconds <= 0) return;

    const interval = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= targetMs) clearInterval(interval);
    }, 1000);
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') setNow(Date.now());
    });

    return () => { clearInterval(interval); sub.remove(); };
  }, [status, targetMs]);

  const totalSeconds = Math.max(0, Math.round((targetMs - now) / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return { days, hours, minutes, seconds, totalSeconds };
};
