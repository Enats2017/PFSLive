import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
// ✅ PERSISTED until delivered (2026-10-19, event 19 review). The 3s/10s/30s
// retries are JS timers, and iOS suspends those the moment the phone is
// pocketed: p4566 pressed Start, went to the background 8s later, tracked the
// whole race — and the server never got its start row. Without that row home_api
// read the 🩺 interim log as a STOP and told the phone "no race" mid-race. So the
// ping is stored under PENDING_START_PING_KEY before the first attempt, and
// flushPendingStartPing() (called from the engine heartbeat and HomeScreen's
// queue timer, both of which run in background wakes) delivers it later. Cleared
// on success, on a definitive 4xx, and when the session ends (_doFullStop).
//
// Lives here rather than inline in HomeScreen so the retry rules can be tested.

export const PENDING_START_PING_KEY = '@PFSLive:pendingStartPing';
// Same literal as gpsService's TRACKING_PARAMS_KEY — re-declared to avoid an
// import cycle at load time (see CLAUDE.md on locally re-declared keys).
const TRACKING_PARAMS_KEY_LOCAL = '@PFSLive:trackingParams';

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
  try {
    await AsyncStorage.setItem(PENDING_START_PING_KEY, JSON.stringify({ participantId, eventId, diag }));
  } catch { /* silent — the in-line attempts below still run */ }
  const clearPending = async () => {
    try { await AsyncStorage.removeItem(PENDING_START_PING_KEY); } catch { /* silent */ }
  };

  for (let attempt = 0; attempt < START_PING_DELAYS_MS.length; attempt++) {
    if (START_PING_DELAYS_MS[attempt] > 0) await sleep(START_PING_DELAYS_MS[attempt]);
    // Runner already pressed Stop — a late start row would only mislead.
    if (!isStillTracking()) { await clearPending(); return 'stopped'; }
    try {
      const headers = await API_CONFIG.getHeaders();
      await axios.post(
        getApiEndpoint(API_CONFIG.ENDPOINTS.SAVE_TRACKING_START),
        { participantId, eventId, diag },
        { headers, timeout: API_CONFIG.TIMEOUT },
      );
      if (API_CONFIG.DEBUG) console.log('✅ start ping sent', participantId, eventId);
      await clearPending();
      return 'sent';
    } catch (e: any) {
      // A 4xx (other than 429) is a definitive answer — retrying can't change it.
      const status = e?.response?.status;
      if (status && status >= 400 && status < 500 && status !== 429) {
        if (API_CONFIG.DEBUG) console.log('⚠️ start ping rejected', status);
        await clearPending();
        return 'rejected';
      }
      if (API_CONFIG.DEBUG) console.log(`⚠️ start ping failed (attempt ${attempt + 1}, non-blocking)`, e?.message);
    }
  }
  // Left in PENDING_START_PING_KEY — flushPendingStartPing() keeps trying.
  return 'gave_up';
};

let _flushInFlight = false;

/**
 * One delivery attempt for a start ping that the in-line retries did not get
 * through. Only while the SAME session is still live: a ping for a session that
 * has ended (or been replaced) is dropped, never sent late. Safe to call often —
 * a no-op without a pending ping, and single-flight within a JS context.
 */
export const flushPendingStartPing = async (): Promise<StartPingResult | 'none'> => {
  if (_flushInFlight) return 'none';
  _flushInFlight = true;
  try {
    const raw = await AsyncStorage.getItem(PENDING_START_PING_KEY);
    if (!raw) return 'none';
    let pending: any = null;
    try { pending = JSON.parse(raw); } catch { /* corrupt — drop below */ }
    const paramsRaw = await AsyncStorage.getItem(TRACKING_PARAMS_KEY_LOCAL);
    let params: any = null;
    try { params = paramsRaw ? JSON.parse(paramsRaw) : null; } catch { /* treat as no session */ }
    const sameSession = !!pending && !!params
      && String(params.participantId) === String(pending.participantId)
      && String(params.eventId) === String(pending.eventId);
    if (!sameSession) {
      await AsyncStorage.removeItem(PENDING_START_PING_KEY);
      return 'stopped';
    }
    try {
      const headers = await API_CONFIG.getHeaders();
      await axios.post(
        getApiEndpoint(API_CONFIG.ENDPOINTS.SAVE_TRACKING_START),
        { participantId: pending.participantId, eventId: pending.eventId, diag: { ...(pending.diag || {}), late_ping: true } },
        { headers, timeout: API_CONFIG.TIMEOUT },
      );
      await AsyncStorage.removeItem(PENDING_START_PING_KEY);
      return 'sent';
    } catch (e: any) {
      const status = e?.response?.status;
      if (status && status >= 400 && status < 500 && status !== 429) {
        await AsyncStorage.removeItem(PENDING_START_PING_KEY);
        return 'rejected';
      }
      return 'gave_up';
    }
  } catch {
    return 'gave_up';
  } finally {
    _flushInFlight = false;
  }
};
