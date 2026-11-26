/**
 * appleIapRecovery.ts - verify paid-but-uncredited Apple transactions from
 * ANYWHERE in the app, not only while MembershipPlansScreen is mounted
 * (payments audit 2026-11-26 #7, #1).
 *
 * Why: the purchase listener and the on-connect recovery both live in
 * useMembershipPlans, i.e. only on the plans screen. A user who paid, whose
 * verify failed (or whose app was killed before it ran), and who never opened
 * that screen again was charged and never credited. This pass runs after
 * login / on launch / on return to the foreground (useAppleRecovery), opens
 * its own StoreKit connection, verifies what Transaction.all still holds, and
 * closes the connection again - unless the plans screen is open, whose useIAP
 * owns the connection then (endConnection is global in openiap).
 *
 * The decisions are the same pure ones the plans screen uses
 * (iapPurchaseFlow.processPurchase / selectRecoverable), and the dedupe sets
 * are SHARED with it (iapShared), so the two can never verify the same
 * transaction at the same time. The backend is idempotent on transaction id.
 */
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  initConnection,
  endConnection,
  getAvailablePurchases,
  finishTransaction,
} from "expo-iap";
import { membershipPlanService, PlanItem } from "./membershipplanservice";
import { appleVerifyService } from "./appleverifyservice";
import { tokenService } from "./tokenService";
import {
  processPurchase,
  selectRecoverable,
  openPaidConsumables,
  isTransientVerifyError,
  accountScopedKey,
  type ResolveConsumable,
} from "../hooks/iapPurchaseFlow";

/** Dedupe sets shared by the plans screen and this background pass. */
export const iapShared = {
  /** Verified (and finished) in this app session. */
  processed: new Set<string>(),
  /** Verify call running right now. */
  processing: new Set<string>(),
};

// ── Who owns the StoreKit connection ──
let plansScreenMounts = 0;
/** Called by useMembershipPlans on mount; the returned function on unmount. */
export function markPlansScreenMounted(): () => void {
  plansScreenMounts++;
  return () => {
    plansScreenMounts = Math.max(0, plansScreenMounts - 1);
  };
}

// ── Subscription periods this device already had confirmed ──
// Persisted so a member is not re-verified (one API call per running period)
// on every launch. Consumables never need it: one is in Transaction.all only
// while unfinished, and we finish only after a verify.
const CONFIRMED_KEY = "@PFSLive:iapConfirmedTxns";
const CONFIRMED_MAX = 50;

// ✅ Per account (second audit PYF): see iapPurchaseFlow.accountScopedKey.
async function scoped(base: string): Promise<string> {
  let id: number | null = null;
  try {
    id = await tokenService.getCustomerId();
  } catch {
    id = null;
  }
  return accountScopedKey(base, id);
}

export async function loadConfirmedTxns(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(await scoped(CONFIRMED_KEY));
    const list = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(list) ? list.map(String) : []);
  } catch {
    return new Set();
  }
}

export async function rememberConfirmedTxn(transactionId: string | null): Promise<void> {
  if (!transactionId) return;
  try {
    const set = await loadConfirmedTxns();
    if (set.has(transactionId)) return;
    const list = [...set, transactionId].slice(-CONFIRMED_MAX);
    await AsyncStorage.setItem(await scoped(CONFIRMED_KEY), JSON.stringify(list));
  } catch {
    // Only an optimisation: worst case the period is verified once more.
  }
}

// ── Two more persisted id sets (re-audit 2026-11-26) ──
// UNCONFIRMED (PN1): activations Apple charged whose verify has not succeeded.
//   The plans screen blocks Buy while one exists. It was in-memory only, so
//   leaving the screen or restarting the app made Buy live again until the next
//   recovery pass - a second EUR 5.95. Written by the screen AND this pass.
// PERMANENT (PN3): transactions the server refused for good (another account's
//   subscription, unknown product): skipped by the automatic passes instead of
//   being re-verified on every launch / visit. Restore still tries them.
const UNCONFIRMED_KEY = "@PFSLive:iapUnconfirmedTxns";
const PERMANENT_KEY = "@PFSLive:iapPermanentFailTxns";
const ID_SET_MAX = 50;

async function loadIdSet(key: string): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(key);
    const list = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(list) ? list.map(String) : []);
  } catch {
    return new Set();
  }
}

async function setIdIn(key: string, id: string | null, on: boolean): Promise<void> {
  if (!id) return;
  try {
    const set = await loadIdSet(key);
    if (on === set.has(id)) return;
    if (on) set.add(id);
    else set.delete(id);
    await AsyncStorage.setItem(key, JSON.stringify([...set].slice(-ID_SET_MAX)));
  } catch {
    // best effort: StoreKit's own unfinished queue is checked again on mount
  }
}

export const loadUnconfirmedTxns = () => loadIdSet(UNCONFIRMED_KEY);
export const setUnconfirmedTxn = (id: string | null, on: boolean) => setIdIn(UNCONFIRMED_KEY, id, on);
// Per account (PYF). UNCONFIRMED stays per device on purpose: it mirrors
// StoreKit's own unfinished queue, which is the Apple ID's, not the login's.
export const loadPermanentFailTxns = async () => loadIdSet(await scoped(PERMANENT_KEY));
export const rememberPermanentFailTxn = async (id: string | null) => setIdIn(await scoped(PERMANENT_KEY), id, true);

// ── "Something was just credited" (PN5) ──
// A pass that started before the plans screen mounted credits a purchase the
// screen does not know about; the screen subscribes and reloads its plans.
const creditedListeners = new Set<() => void>();
export function onRecoveryCredited(cb: () => void): () => void {
  creditedListeners.add(cb);
  return () => {
    creditedListeners.delete(cb);
  };
}
function notifyCredited() {
  creditedListeners.forEach((cb) => {
    try {
      cb();
    } catch {
      // a listener's failure is its own
    }
  });
}

/** Consumable-or-subscription from the backend catalog ('single' = the activation). */
export function resolverFromCatalog(plans: readonly PlanItem[]): ResolveConsumable {
  const consumable = new Set<string>();
  const subs = new Set<string>();
  plans.forEach((p) => (p.tier === "single" ? consumable : subs).add(p.product_id));
  return (sku) => (consumable.has(sku) ? true : subs.has(sku) ? false : null);
}

const MIN_INTERVAL_MS = 10 * 60 * 1000;
let running = false;
let lastRunAt = 0;

export interface RecoveryResult {
  ran: boolean;
  verified: number;
  failed: number;
}

/**
 * One background pass. Never throws. `force` skips the 10-minute throttle
 * (used right after login).
 */
export async function runAppleRecovery(force = false): Promise<RecoveryResult> {
  const none: RecoveryResult = { ran: false, verified: 0, failed: 0 };
  if (Platform.OS !== "ios") return none;
  // The plans screen runs the same pass on its own connection.
  if (plansScreenMounts > 0 || running) return none;
  if (!force && Date.now() - lastRunAt < MIN_INTERVAL_MS) return none;
  running = true;
  lastRunAt = Date.now();
  let opened = false;
  const result: RecoveryResult = { ran: true, verified: 0, failed: 0 };
  try {
    opened = await initConnection();
    if (!opened) return result;
    const all = await getAvailablePurchases({ onlyIncludeActiveItemsIOS: false });
    // Most people hold nothing: no API call at all then.
    if (!all || all.length === 0) return result;

    const plans = await membershipPlanService.getApplePlans();
    const resolve = resolverFromCatalog(plans?.plans ?? []);
    const confirmed = await loadConfirmedTxns();
    const permanent = await loadPermanentFailTxns();
    // ✅ Every paid, uncredited activation StoreKit still holds is "unconfirmed"
    // (PN1) until its verify succeeds - persisted, so the plans screen blocks
    // Buy from its first frame even after a restart.
    for (const id of openPaidConsumables(all as any[], resolve, permanent)) {
      await setUnconfirmedTxn(id, true);
    }
    const todo = selectRecoverable(all as any[], resolve, Date.now(), confirmed, permanent);

    for (const purchase of todo) {
      const flow = await processPurchase(purchase, {
        resolveConsumable: resolve,
        processed: iapShared.processed,
        processing: iapShared.processing,
        verify: (id) => appleVerifyService.verifyPurchase(id),
        finish: (p, isConsumable) => finishTransaction({ purchase: p as any, isConsumable }),
        log: console.log,
      });
      if (flow.outcome === "verified") {
        result.verified++;
        if (flow.isConsumable === false) await rememberConfirmedTxn(flow.transactionId);
        await setUnconfirmedTxn(flow.transactionId, false);
      } else if (flow.outcome === "verify_failed") {
        result.failed++;
        // A final refusal is not retried on every launch (PN3), and does not
        // block buying: it is not a payment we are still confirming.
        if (!isTransientVerifyError(flow.error)) {
          await rememberPermanentFailTxn(flow.transactionId);
          await setUnconfirmedTxn(flow.transactionId, false);
        }
      }
    }
    if (result.verified > 0) {
      console.log("✅ Background Apple recovery credited:", result.verified);
      notifyCredited(); // PN5: an open plans screen reloads
    }
    return result;
  } catch (error: any) {
    console.warn("⚠️ Background Apple recovery failed:", error?.message);
    return result;
  } finally {
    // Only close what we opened, and never under an open plans screen.
    if (opened && plansScreenMounts === 0) {
      try {
        await endConnection();
      } catch {
        // nothing to do
      }
    }
    running = false;
  }
}
