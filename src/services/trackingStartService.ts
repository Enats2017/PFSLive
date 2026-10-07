import axios from 'axios';
import { Platform } from 'react-native';
import * as Location from 'expo-location';
import * as Application from 'expo-application';
import * as Updates from 'expo-updates';
import { API_CONFIG, getApiEndpoint } from '../constants/config';
import { gpsService } from './gpsService';

// ✅ START PING — notify the backend that tracking started, the instant the
// user taps start. Written to oc_tracking_starts_app independently of
// coordinates, so Home detects a restart-after-stop even if the network
// drops and no coordinates flow for a while. Fire-and-forget: it must never
// block or fail the start of tracking.
//
// ✅ RETRIED. It used to be a single attempt, and at the Dinant start line
// (2026-10-04, ~4,000 runners on one cell) 4 runners tracked normally —
// 176-348 fixes each — with no oc_tracking_starts_app row at all, so they
// were missing from every "started tracking" count. Backoff 3s/10s/30s keeps
// all attempts inside the server's 60s start-dedupe window, so a retry after
// a request that did land (but timed out client-side) cannot double-count.
//
// ✅ Carries `diag` — platform, versions, OTA update id, permission level.
// 23 sessions in Sep-Oct sent this ping and then not one location; the
// device log only uploads on Stop, so nothing told us why. The server logs
// these fields on the TRACKING_START line.
//
// Lives here rather than inline in HomeScreen so the retry rules can be tested.

export const START_PING_DELAYS_MS = [0, 3000, 10000, 30000];

export type StartPingResult = 'sent' | 'rejected' | 'stopped' | 'gave_up' | 'skipped';

export const buildStartDiag = async (
  startedAfterGun: boolean,
): Promise<Record<string, string | boolean>> => {
  try {
    const perm = await gpsService.getPermissionState();
    const fg: any = await Location.getForegroundPermissionsAsync();
    return {
      platform: Platform.OS,
      os: String(Platform.Version),
      app: Application.nativeApplicationVersion ?? 'unknown',
      update: Updates.updateId ?? 'embedded',
      perm: perm.level,
      bg_perm: perm.background,
      precise: fg?.ios?.accuracy ?? fg?.android?.accuracy ?? 'unknown',
      started_after_gun: startedAfterGun,
    };
  } catch {
    return {};   // diagnostics must never block the ping
  }
};

export const sendTrackingStartPing = async (opts: {
  participantId: string | number | null | undefined;
  eventId: string | number | null | undefined;
  startedAfterGun: boolean;
  /** Re-checked before every attempt: false once the runner has pressed Stop. */
  isStillTracking: () => boolean;
  /** Injectable for tests; defaults to a real timer. */
  sleep?: (ms: number) => Promise<void>;
}): Promise<StartPingResult> => {
  const { participantId, eventId, startedAfterGun, isStillTracking } = opts;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  if (!participantId || !eventId) return 'skipped';

  const diag = await buildStartDiag(startedAfterGun);

  for (let attempt = 0; attempt < START_PING_DELAYS_MS.length; attempt++) {
    if (START_PING_DELAYS_MS[attempt] > 0) await sleep(START_PING_DELAYS_MS[attempt]);
    // Runner already pressed Stop — a late start row would only mislead.
    if (!isStillTracking()) return 'stopped';
    try {
      const headers = await API_CONFIG.getHeaders();
      await axios.post(
        getApiEndpoint(API_CONFIG.ENDPOINTS.SAVE_TRACKING_START),
        { participantId, eventId, diag },
        { headers, timeout: API_CONFIG.TIMEOUT },
      );
      if (API_CONFIG.DEBUG) console.log('✅ start ping sent', participantId, eventId);
      return 'sent';
    } catch (e: any) {
      // A 4xx (other than 429) is a definitive answer — retrying can't change it.
      const status = e?.response?.status;
      if (status && status >= 400 && status < 500 && status !== 429) {
        if (API_CONFIG.DEBUG) console.log('⚠️ start ping rejected', status);
        return 'rejected';
      }
      if (API_CONFIG.DEBUG) console.log(`⚠️ start ping failed (attempt ${attempt + 1}, non-blocking)`, e?.message);
    }
  }
  return 'gave_up';
};
