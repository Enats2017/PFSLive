// src/utils/locationPopupCopy.ts
//
// ✅ Which title/body the Home location popup shows. Pure so it can be tested.
//
// Two situations open the same popup:
//  - the START flow (permission or Location missing before tracking): a pitch —
//    why to allow — and "then press Start again";
//  - the MID-RACE warning banner (tracking already running): a problem report.
//    Never "press Start again" there — the visible button is Stop, and stopping
//    to restart mid-race would split the runner's session.
// "No GPS position" mid-race (indoors, tunnel) is neither a permission nor a
// Location-off problem, so it gets its own copy and no settings steps.

import type { PermissionBlockReason } from './deviceSettings';

export interface LocationPopupCopy {
  titleKey: string;
  bodyKey: string;
  /** Show the platform "how to fix in Settings" line. */
  showSettingsSteps: boolean;
}

export function locationPopupCopy(opts: {
  midRace: boolean;
  noFix: boolean;
  reason: PermissionBlockReason;
  platform: string;
}): LocationPopupCopy {
  const { midRace, noFix, reason, platform } = opts;
  if (midRace && noFix) {
    return { titleKey: 'home:gpsHealth.titleNoFix', bodyKey: 'home:gpsHealth.blockedBodyNoFix', showSettingsSteps: false };
  }
  const titleKey = midRace ? 'home:gpsHealth.titleMidRace' : 'home:gpsHealth.title';
  const bodyKey =
    reason === 'location_off'
      ? (midRace ? 'home:gpsHealth.blockedBodyLocationOffMidRace' : 'home:gpsHealth.blockedBodyLocationOff')
      : reason === 'denied'
        ? 'home:gpsHealth.blockedBodyDenied'
        : 'home:gpsHealth.blockedBody';
  // Android's Location-off deep link lands exactly on the switch — no steps needed.
  const showSettingsSteps = !(platform === 'android' && reason === 'location_off');
  return { titleKey, bodyKey, showSettingsSteps };
}
