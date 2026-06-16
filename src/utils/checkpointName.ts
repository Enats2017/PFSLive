import type { TFunction } from 'i18next';

/**
 * Display name for a route checkpoint. An explicit GPX/custom name always
 * wins; only when it's blank (e.g. the Start/Finish the backend synthesises
 * from the track endpoints when the GPX has no depart/arrivee waypoint) do we
 * fall back to a localised "Start" / "Finish".
 */
export const getCheckpointName = (
  t: TFunction,
  name: string | null | undefined,
  isStart: boolean,
  isFinish: boolean,
): string => {
  const trimmed = (name ?? '').trim();
  if (trimmed !== '') return trimmed;
  if (isStart)  return t('livetracking:start');
  if (isFinish) return t('livetracking:finish');
  return '';
};