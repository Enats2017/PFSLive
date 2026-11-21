// Display helpers for Home's tracking card (02_Home-Tracking-Active.png).

/** "00:42:18" since the session began; "00:00:00" while no start is stamped. */
export function formatElapsed(startedAt: number | null, nowMs: number): string {
  if (!startedAt) return '00:00:00';
  const secs = Math.max(0, Math.floor((nowMs - startedAt) / 1000));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(secs / 3600))}:${pad(Math.floor((secs % 3600) / 60))}:${pad(secs % 60)}`;
}

/**
 * "1.23" km. Two decimals (developer report 2026-10-30): one decimal moved only
 * every 100 m, so a walker saw "1.0" for minutes and read it as whole km.
 * Rounded DOWN, so the card never shows a distance not yet covered.
 */
export function formatSessionKm(km: number): string {
  if (!Number.isFinite(km) || km <= 0) return '0.00';
  return (Math.floor(km * 100 + 1e-9) / 100).toFixed(2);
}
