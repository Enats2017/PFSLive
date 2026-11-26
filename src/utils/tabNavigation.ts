// Where a race screen's bottom tab bar should take the user. Pure, so it is
// tested against the real @react-navigation/routers: node tests/results/app.test.js
//
// (app audit 2026-11-26) React Navigation 7's navigate() no longer goes BACK to
// a screen already in the stack — it only reuses the route on top, and pushes
// a new one otherwise. So every Results ↔ Map tap pushed another screen:
//   Home > ResultList > LiveTracking > ResultList > LiveTracking > …
// The native stack keeps the screens underneath mounted, so each LiveTracking
// copy kept its own 60 s / 10 s poll, location watcher and Mapbox view —
// several maps polling at once on one phone, behind a venue IP's rate limit.
//
// The tab bar now returns to the copy that is already open FOR THIS RACE
// (pop back to it, its state intact), and only pushes when there is none.
// A screen for another race with the same name is never reused — its state
// (distance, participants, filters) belongs to that race. A custom event's map
// is never reused either: custom ids are another id space (see liveMapBibs).

export interface TabRouteLike {
  name: string;
  params?: Record<string, any> | undefined;
}

/**
 * How many screens to pop to reach the open `targetName` screen for this race,
 * or 0 when there is none below the current screen (→ navigate as before:
 * that pushes, or updates the params of the screen on top).
 *
 * `productAppId` null/undefined matches by name only (HomeScreen).
 */
export function tabPopCount(
  routes: TabRouteLike[],
  index: number,
  targetName: string,
  productAppId?: string | number | null,
): number {
  if (!Array.isArray(routes) || index < 0 || index >= routes.length) return 0;
  if (routes[index]?.name === targetName) return 0;   // already there: navigate updates params
  for (let i = index - 1; i >= 0; i--) {
    const r = routes[i];
    if (r?.name !== targetName) continue;
    if (productAppId === null || productAppId === undefined) return index - i;
    if (r.params?.event_source === 'custom') continue;
    if (String(r.params?.product_app_id ?? '') === String(productAppId)) return index - i;
  }
  return 0;
}

export interface TabPlan {
  /** Screens to pop (0 = navigate as before). */
  pops: number;
  /** Route key to update before popping back to it, and the params to merge. */
  setParamsKey?: string;
  setParams?: Record<string, any>;
}

/**
 * The whole tab-bar move. Besides tabPopCount: popping back to an open map
 * must carry the distance picked meanwhile (re-audit 2026-11-26): Map →
 * Results → choose another distance → Map returned to the older map, which
 * kept showing the old distance. The map's route gets the new
 * selectedDistanceLabel merged in (setParams) and LiveTrackingScreen switches
 * when that param changes.
 */
export function tabPlan(
  routes: Array<TabRouteLike & { key?: string }>,
  index: number,
  targetName: string,
  params?: Record<string, any>,
): TabPlan {
  const pid = targetName === 'HomeScreen' ? null : (params?.product_app_id ?? null);
  const pops = tabPopCount(routes, index, targetName, pid);
  if (pops <= 0) return { pops: 0 };
  const target = routes[index - pops];
  const label = params?.selectedDistanceLabel;
  if (targetName === 'LiveTracking' && label !== undefined && label !== null && label !== ''
      && target?.key && String(target.params?.selectedDistanceLabel ?? '') !== String(label)) {
    return { pops, setParamsKey: target.key, setParams: { selectedDistanceLabel: label } };
  }
  return { pops };
}
