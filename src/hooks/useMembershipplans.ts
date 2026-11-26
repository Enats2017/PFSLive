import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Platform } from "react-native";
import {
  useIAP,
  purchaseUpdatedListener,
  purchaseErrorListener,
  finishTransaction,
  getAvailablePurchases as getStorePurchases,
  ErrorCode,
} from "expo-iap";
import {
  membershipPlanService,
  PlanItem,
  MembershipPlansData,
} from "../services/membershipplanservice";
import {
  appleVerifyService,
  VerifyPurchaseResponse,
} from "../services/appleverifyservice";
import {
  processPurchase,
  selectRecoverable,
  selectRestorable,
  tryBeginPurchase,
  verifyWithRetry,
  isTransientVerifyError,
  isQueuedAction,
  restoreOutcome,
  isUserInitiatedEvent,
  validAppAccountToken,
  openPaidConsumables,
  type PurchaseFlowResult,
} from "./iapPurchaseFlow";
import {
  iapShared,
  markPlansScreenMounted,
  loadConfirmedTxns,
  rememberConfirmedTxn,
  loadUnconfirmedTxns,
  setUnconfirmedTxn,
  loadPermanentFailTxns,
  rememberPermanentFailTxn,
  onRecoveryCredited,
} from "../services/appleIapRecovery";
import { AppState } from "react-native";
import { analyticsService, SubscriptionState } from "../services/analyticsService";

export type PlanId = "lite" | "basic" | "pro";

export const PLAN_IDS: PlanId[] = ["lite", "basic", "pro"];

// ✅ Restore result type
// 'pending' / 'error' / 'other_account' added by the payments audit
// 2026-11-26 (#3, #11): Restore used to answer "nothing to restore" for a
// purchase it had just credited (the cron writes the membership later), for a
// verify that failed, and for a subscription bound to another account.
export type RestoreResult =
  | "success"
  | "none"
  | "pending"
  | "error"
  | "other_account"
  | "credited_other_account" // re-audit PN7
  | null;

// ✅ purchaseError value for "Apple charged, our server has not confirmed it"
// (audit #2). The screen shows its own copy for it - never "please try again",
// which is what bought the second activation.
export const PURCHASE_UNCONFIRMED = "purchase_unconfirmed";
export const PURCHASE_OTHER_ACCOUNT = "subscription_linked_to_other_account";
// The server credited the account the purchase was made FOR, not this one (PN7).
export const PURCHASE_CREDITED_OTHER = "credited_other_account";

// In-place retries of the verify call after a user-initiated purchase (#2).
const VERIFY_RETRY_DELAYS_MS = [2000, 5000];
// ...within ONE deadline for all attempts (re-audit PN8): the processing modal
// cannot be dismissed, and three 45 s calls kept the user there ~142 s.
const VERIFY_DEADLINE_MS = 40000;
// While a paid purchase is being activated, re-read the plans this often so
// the block lifts once the cron has run (re-audit PN4).
const PENDING_POLL_MS = 60000;
// openiap answered requestPurchase with nothing and no event followed (Ask to
// Buy / pending): release the one-purchase gate after this long (#8).
const PENDING_RELEASE_MS = 20000;
// StoreKit never connected: stop the full-screen spinner after this long (#9).
const PRICE_WAIT_MS = 10000;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

interface UseMembershipPlansResult {
  plansData: MembershipPlansData | null;
  loadingPlans: boolean;
  plansError: string | null;
  planByTier: Partial<Record<PlanId, PlanItem>>;
  // The one-off activation, when the backend sells one. Kept OUT of PlanId:
  // it is not a subscription tier and must not join the plan radio group.
  singlePlan: PlanItem | null;
  // The subscription tiers the backend ACTUALLY returned, in rank order.
  // Render from this, never from PLAN_IDS: a retired plan (Livio Lite) is
  // dropped from the catalog server-side, and a hardcoded list would keep
  // drawing a card for it with its stale fallback price and no way to buy it.
  visibleTiers: PlanId[];
  storeProducts: Record<string, string>;
  loadingPrices: boolean;
  defaultSelectedTier: PlanId | null;
  refetchPlans: () => Promise<void>;
  requestPurchase: (
    params: Parameters<ReturnType<typeof useIAP>["requestPurchase"]>[0],
  ) => ReturnType<ReturnType<typeof useIAP>["requestPurchase"]>;
  purchaseLoading: boolean;
  purchaseResult: VerifyPurchaseResponse | null;
  purchaseError: string | null;
  resetPurchase: () => void;
  // ✅ Restore purchases
  restorePurchases: () => Promise<void>;
  restoreLoading: boolean;
  restoreResult: RestoreResult;
  restoreError: string | null;
  resetRestore: () => void;
  purchaseButtonLoading: boolean;
  // ✅ Payments audit 2026-11-26
  /** An activation Apple charged that our server has not confirmed yet (#2). */
  unconfirmedPayment: boolean;
  /** Re-run the verify of what StoreKit still holds (the banner's button).
   *  Resolves true while a payment is STILL unconfirmed afterwards (PN6). */
  retryUnconfirmed: () => Promise<boolean>;
  /** The banner's retry is running (PN6). */
  retryingUnconfirmed: boolean;
  /** StoreKit not asked yet whether a paid activation is still open (PN1). */
  checkingStore: boolean;
  /** Paid and confirmed, the cron has not activated it yet (#4). */
  paymentPending: boolean;
  /** StoreKit is waiting for approval (Ask to Buy / deferred payment) (#8). */
  purchasePendingApproval: boolean;
  resetPendingApproval: () => void;
}

export function useMembershipPlans(): UseMembershipPlansResult {
  const [plansData, setPlansData] = useState<MembershipPlansData | null>(null);
  const [loadingPlans, setLoadingPlans] = useState<boolean>(true);
  const [plansError, setPlansError] = useState<string | null>(null);
  const [purchaseLoading, setPurchaseLoading] = useState<boolean>(false);
  const [purchaseResult, setPurchaseResult] =
    useState<VerifyPurchaseResponse | null>(null);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);

  // ✅ Restore state
  const [restoreLoading, setRestoreLoading] = useState<boolean>(false);
  const [restoreResult, setRestoreResult] = useState<RestoreResult>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const [purchaseButtonLoading, setPurchaseButtonLoading] = useState(false);

  // ✅ Payments audit 2026-11-26 state
  const [unconfirmedPayment, setUnconfirmedPayment] = useState(false);
  const [purchasePendingApproval, setPurchasePendingApproval] = useState(false);
  // Consumables Apple charged whose verify has not succeeded yet. A Set, so
  // a later successful verify of exactly that transaction clears the block.
  const unconfirmedIdsRef = useRef<Set<string>>(new Set());
  // ✅ Persisted too (re-audit PN1, shared with the app-level pass): in memory
  // only, the block was gone after leaving the screen or a restart.
  const markUnconfirmed = useCallback((id: string | null, on: boolean) => {
    if (!id) return;
    if (on) unconfirmedIdsRef.current.add(id);
    else unconfirmedIdsRef.current.delete(id);
    setUnconfirmedPayment(unconfirmedIdsRef.current.size > 0);
    void setUnconfirmedTxn(id, on);
  }, []);
  // ✅ Until StoreKit has been asked whether it still holds a paid, uncredited
  // activation, the activation is not sold (PN1). iOS only (no IAP elsewhere).
  const [checkingStore, setCheckingStore] = useState<boolean>(Platform.OS === "ios");
  const [retryingUnconfirmed, setRetryingUnconfirmed] = useState(false);
  useEffect(() => {
    let alive = true;
    loadUnconfirmedTxns().then((ids) => {
      if (!alive || ids.size === 0) return;
      ids.forEach((id) => unconfirmedIdsRef.current.add(id));
      setUnconfirmedPayment(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const {
    connected,
    products,
    fetchProducts,
    subscriptions,
    requestPurchase: rawRequestPurchase,
  } = useIAP();
  const [storeProducts, setStoreProducts] = useState<Record<string, string>>(
    {},
  );
  const [loadingPrices, setLoadingPrices] = useState<boolean>(true);
  // ✅ Shared with the app-level recovery pass (services/appleIapRecovery,
  // audit #7), so the two can never verify the same transaction at once.
  const processedTransactions = useRef<Set<string>>(iapShared.processed);
  const processingRef = useRef<Set<string>>(iapShared.processing);
  const awaitingPurchaseRef = useRef(false);
  // Armed ONLY by requestPurchase, never by restorePurchases, so the error
  // listener can tell a failed purchase (owns purchaseError) from a failed
  // restore (owns restoreError) — awaitingPurchaseRef is armed by both.
  const purchaseIntentRef = useRef(false);
  // ✅ The SKU the user is buying right now (audit #14): only a listener
  // event for THIS product is the user's purchase.
  const pendingSkuRef = useRef<string | null>(null);
  // Bumped on every purchase start, so a stale pending-release timer (#8)
  // can never open the gate of a LATER purchase.
  const purchaseSeqRef = useRef(0);
  const restoreRunningRef = useRef(false);
  // apple_get_plans' appAccountToken for this account (#5), null on an older server.
  const appAccountTokenRef = useRef<string | null>(null);

  console.log("🚀 useMembershipPlans mounted");

  // ✅ Tell the app-level recovery pass that this screen owns the StoreKit
  // connection while mounted (useIAP's endConnection is global).
  useEffect(() => markPlansScreenMounted(), []);

  const resetPurchase = useCallback(() => {
    setPurchaseError(null);
    setPurchaseResult(null);
    setPurchaseLoading(false);
  }, []);

  // ✅ Reset restore state
  const resetRestore = useCallback(() => {
    setRestoreError(null);
    setRestoreResult(null);
    setRestoreLoading(false);
  }, []);

  const resetPendingApproval = useCallback(() => setPurchasePendingApproval(false), []);

  // ── Load plans from backend ──
  // `silent` (re-audit PN4/PN5): a background refresh - no full-screen spinner,
  // and a failure keeps the plans already shown instead of an error screen.
  const loadPlans = useCallback(async (silent: boolean = false) => {
    try {
      if (!silent) {
        setLoadingPlans(true);
        setPlansError(null);
      }
      const data = await membershipPlanService.getApplePlans();
      setPlansData(data);
      appAccountTokenRef.current = validAppAccountToken(data?.app_account_token);

      // Synced HERE rather than in MembershipPlansScreen so it also covers the
      // restore path and refetchPlans — restorePurchases() calls loadPlans() to
      // re-read entitlement, and that is exactly when the property is most
      // likely to change. Runs on EVERY entitlement resolve, not just after a
      // purchase; otherwise a lapsed user stays marked active forever.
      //
      // NOTE: `expired` is not derivable from this payload — has_membership
      // false reads identically for someone who never subscribed and someone
      // whose subscription ended, so both report `free`. If the API ever
      // exposes a lapsed flag, map it here.
      if (data?.entitlement) {
        const { has_membership, status, source } = data.entitlement;
        const state: SubscriptionState = !has_membership
          ? "free"
          : status === "grace"
            ? "grace"
            : "active";
        void analyticsService.setSubscriptionState(state, source);
      }
      return data; // ✅ return so restore can check entitlement immediately
    } catch (error: any) {
      if (!silent) setPlansError(error?.message || "Failed to load membership plans");
      console.error("❌ Error loading membership plans:", error);
      return null;
    } finally {
      if (!silent) setLoadingPlans(false);
    }
  }, []);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  // ── Build SKU list from API response ──
  const productSkus = useMemo(() => {
    if (!plansData) return [];
    return plansData.plans.map((plan) => plan.product_id);
  }, [plansData]);

  // The one-off activation is a CONSUMABLE, not a subscription, so StoreKit
  // will not return it from a 'subs' query - it would come back priceless and
  // unbuyable. Split the catalog by what each plan actually is. 'single' is the
  // tier the backend sends for it (apple_get_plans_api planCatalog).
  const { subSkus, inAppSkus } = useMemo(() => {
    const subs: string[] = [];
    const inApp: string[] = [];
    (plansData?.plans ?? []).forEach((plan) => {
      (plan.tier === "single" ? inApp : subs).push(plan.product_id);
    });
    return { subSkus: subs, inAppSkus: inApp };
  }, [plansData]);

  // The purchase listener below is registered once (deps []), so it cannot read
  // plansData directly. A ref keeps the consumable set current for it.
  const consumableSkusRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    consumableSkusRef.current = new Set(inAppSkus);
  }, [inAppSkus]);

  const subSkusRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    subSkusRef.current = new Set(subSkus);
  }, [subSkus]);

  // StoreKit's own answer, which does NOT depend on our API having replied:
  // fetchProducts({ type: "in-app" }) lands in `products`, { type: "subs" } in
  // `subscriptions`. Preferred over the backend catalog for exactly that
  // reason - StoreKit replays an unfinished transaction at launch, and that can
  // arrive before the plans request comes back.
  const storeConsumableIdsRef = useRef<Set<string>>(new Set());
  const storeSubIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const idsOf = (list: any[]) =>
      new Set(
        (list || [])
          .map((item: any) => item?.id ?? item?.productId)
          .filter((id: any): id is string => typeof id === "string" && id !== ""),
      );
    storeConsumableIdsRef.current = idsOf(products as any[]);
    storeSubIdsRef.current = idsOf(subscriptions as any[]);
  }, [products, subscriptions]);

  /**
   * true = consumable, false = subscription, null = nothing knows this product
   * yet. StoreKit is asked first because it is authoritative and independent of
   * our API; the backend catalog is the fallback for the window before StoreKit
   * has returned. null is NOT "subscription" - see the deferral in the purchase
   * listener. Stable (deps []), so the listener can close over it.
   */
  const resolveConsumable = useCallback((sku: string): boolean | null => {
    if (!sku) return null;
    if (storeConsumableIdsRef.current.has(sku)) return true;
    if (storeSubIdsRef.current.has(sku)) return false;
    if (consumableSkusRef.current.has(sku)) return true;
    if (subSkusRef.current.has(sku)) return false;
    return null;
  }, []);

  // ── Fetch StoreKit prices once connected + SKUs ready ──
  useEffect(() => {
    if (!connected || productSkus.length === 0) return;

    const loadPrices = async () => {
      try {
        setLoadingPrices(true);
        console.log("📡 Fetching StoreKit prices for:", productSkus);
        if (subSkus.length > 0) {
          await fetchProducts({ skus: subSkus, type: "subs" });
        }
        if (inAppSkus.length > 0) {
          await fetchProducts({ skus: inAppSkus, type: "in-app" });
        }
      } catch (error) {
        console.error("❌ Error fetching store prices:", error);
      } finally {
        setLoadingPrices(false); // ✅ always resolves, never hangs
      }
    };

    loadPrices();
  }, [connected, productSkus, subSkus, inAppSkus, fetchProducts]);

  // ✅ The price spinner can never block the screen for good (audit #9). It
  // was cleared only by the price fetch above, which needs a StoreKit
  // connection AND a catalog: with initConnection failing, or a plans request
  // that failed / came back empty, the whole screen spun forever - Restore and
  // the plans error's Retry button included.
  useEffect(() => {
    if (!loadingPlans && productSkus.length === 0) setLoadingPrices(false);
  }, [loadingPlans, productSkus]);
  useEffect(() => {
    const t = setTimeout(() => setLoadingPrices(false), PRICE_WAIT_MS);
    return () => clearTimeout(t);
  }, []);

  const releasePurchaseGate = useCallback(() => {
    awaitingPurchaseRef.current = false;
    purchaseIntentRef.current = false;
    pendingSkuRef.current = null;
    setPurchaseButtonLoading(false);
  }, []);

  const requestPurchase = useCallback(
    async (params: Parameters<typeof rawRequestPurchase>[0]) => {
      // ✅ ONE purchase at a time (support 2026-11-26). A second tap while the
      // first purchase is still starting - double tap on Buy, or Continue then
      // Buy - opened a second Apple sheet: 22 activations and 1 subscription
      // (2026-10-15 .. 11-11) were charged twice, 6-23 s apart, adjacent
      // transaction ids. Only the first was verified; the screen had already
      // navigated away when the second arrived. purchaseIntentRef is a ref, so
      // it blocks a second tap in the same frame, before any re-render.
      // Released by the error listener (cancel/fail), by handlePurchase
      // (verified or not) and by the throw below.
      if (!tryBeginPurchase(purchaseIntentRef)) {
        console.log("⏭ Purchase already in progress - ignoring second request");
        return null;
      }
      awaitingPurchaseRef.current = true; // arm it — a real purchase attempt is starting
      const seq = ++purchaseSeqRef.current;
      setPurchaseButtonLoading(true);
      setPurchasePendingApproval(false);

      // ✅ appAccountToken (audit #5): the server can then credit the account
      // the purchase was made FOR, even when a later recovery runs under
      // somebody else's login on this phone. Plain JS -> the native decoder
      // already reads it (openiap RequestPurchaseIosProps), no rebuild needed.
      // No token from the server = exactly the old request.
      const apple = (params as any)?.request?.apple;
      pendingSkuRef.current = apple?.sku ?? null;
      const token = appAccountTokenRef.current;
      const finalParams =
        token && apple
          ? ({
              ...params,
              request: { ...(params as any).request, apple: { ...apple, appAccountToken: token } },
            } as typeof params)
          : params;

      try {
        const result: any = await rawRequestPurchase(finalParams);
        // ✅ Nothing back and (so far) no event (audit #8): openiap returns
        // nil for a pending StoreKit result (Ask to Buy). Neither listener
        // fires then, and the gate + spinner stayed on until the screen was
        // left. Wait a while for a late event, then release - and say why.
        const empty = result == null || (Array.isArray(result) && result.length === 0);
        if (empty) {
          setTimeout(() => {
            if (purchaseSeqRef.current !== seq || !purchaseIntentRef.current) return;
            console.log("⏸ No purchase event after requestPurchase - treating as pending approval");
            releasePurchaseGate();
            setPurchasePendingApproval(true);
          }, PENDING_RELEASE_MS);
        }
        return result;
      } catch (err) {
        awaitingPurchaseRef.current = false; // disarm if the call itself throws
        purchaseIntentRef.current = false;
        pendingSkuRef.current = null;
        setPurchaseButtonLoading(false);
        throw err;
      }
    },
    [rawRequestPurchase, releasePurchaseGate],
  );

  // ── One verify path for every Apple transaction ──
  // Used by the purchase listener, the unfinished-transaction recovery and
  // Restore, so all three verify, finish and dedupe the same way. The decisions
  // (dedupe, defer an unknown SKU, finish only after a verify) live in
  // iapPurchaseFlow.processPurchase, covered by npm run test:iap-purchase-flow.
  // `userInitiated` = a purchase the user started on this screen; only that
  // one drives the processing/error modal and the navigation on success.
  // Stable: it reads refs and setters only, so the once-registered listener
  // can close over it.
  const handlePurchase = useCallback(
    async (
      purchase: any,
      userInitiated: boolean,
    ): Promise<PurchaseFlowResult<VerifyPurchaseResponse>> => {
      if (userInitiated) {
        // The purchase event arrived: the pending-approval timer (#8) of this
        // purchase must not release the gate while we verify.
        purchaseSeqRef.current++;
        setPurchaseLoading(true);
        setPurchaseError(null);
        setPurchaseResult(null);
        setPurchaseButtonLoading(false);
      }
      try {
        const flow = await processPurchase<VerifyPurchaseResponse>(purchase, {
          resolveConsumable,
          processed: processedTransactions.current,
          processing: processingRef.current,
          // ✅ The user just paid: retry a transient failure in place before
          // anything is shown (audit #2).
          verify: (id) =>
            userInitiated
              ? verifyWithRetry(() => appleVerifyService.verifyPurchase(id), VERIFY_RETRY_DELAYS_MS, sleep, {
                  deadlineMs: VERIFY_DEADLINE_MS, // PN8: one cap for all attempts
                })
              : appleVerifyService.verifyPurchase(id),
          finish: (p, isConsumable) =>
            finishTransaction({ purchase: p as any, isConsumable }),
          log: console.log,
        });

        if (flow.outcome === "verified") {
          markUnconfirmed(flow.transactionId, false);
          // Subscription periods are remembered so the automatic pass does not
          // re-verify them on every visit (selectRecoverable).
          if (flow.isConsumable === false) void rememberConfirmedTxn(flow.transactionId);
          if (userInitiated) {
            if (flow.result?.action === PURCHASE_CREDITED_OTHER) {
              // PN7: not THIS account's purchase - say so, do not navigate as a success.
              setPurchaseError(PURCHASE_CREDITED_OTHER);
            } else {
              setPurchaseResult(flow.result ?? null); // drives navigation
            }
          } else {
            console.log("✅ Background-reconciled prior purchase:", flow.transactionId);
          }
          return flow;
        }
        // NOT finished on verify_failed: the transaction stays in StoreKit's
        // unfinished queue, so the next recovery pass (next visit to this
        // screen, or the app-level pass) retries it.
        if (flow.outcome === "verify_failed") {
          const err: any = flow.error;
          const code = String(err?.code ?? err?.message ?? "");
          // ✅ A charged activation that is not confirmed blocks buying another
          // (audit #2) - only for failures a retry can fix.
          if (flow.isConsumable === true && isTransientVerifyError(err)) {
            markUnconfirmed(flow.transactionId, true);
          }
          // ✅ A final refusal is remembered and not re-verified by every
          // automatic pass (re-audit PN3); it is not a payment we are confirming.
          if (!isTransientVerifyError(err)) {
            void rememberPermanentFailTxn(flow.transactionId);
            markUnconfirmed(flow.transactionId, false);
          }
          if (userInitiated) {
            // Never the raw code, never "try again": Apple has charged.
            setPurchaseError(code === PURCHASE_OTHER_ACCOUNT ? PURCHASE_OTHER_ACCOUNT : PURCHASE_UNCONFIRMED);
          }
        }
        return flow;
      } finally {
        if (userInitiated) {
          setPurchaseLoading(false);
          awaitingPurchaseRef.current = false;
          purchaseIntentRef.current = false;
          pendingSkuRef.current = null;
        }
      }
    },
    [resolveConsumable, markUnconfirmed],
  );

  // ✅ ── Recover paid-but-never-verified transactions (support 2026-11-26) ──
  // A purchase only reaches our API through purchaseUpdatedListener, and that
  // listener lives only while this screen is mounted. If the verify call does
  // not happen (screen left, verify request failed, product deferred above),
  // the EUR 5.95 is charged by Apple but never credited, and NOTHING retried it:
  //   - openiap-apple 2.2.1 (expo-iap 4.3.4) on initConnection only STORES
  //     unfinished transactions (processUnfinishedTransactions -> storePending);
  //     it never emits them to the listener.
  //   - Restore read Transaction.currentEntitlements, which never contains a
  //     consumable, and did not emit to the listener either.
  // Support case 2026-11-26: a participant opened this screen 9 times
  // after paying and was never credited.
  //
  // So: on connect, ask StoreKit for Transaction.all and verify every
  // CONSUMABLE in it. Transaction.all holds a consumable only while it is
  // unfinished (no SK2ConsumableTransactionHistory key in this app), and we
  // finish one only after the backend verified it - so whatever is there is
  // paid and not yet credited. The backend is idempotent (APPLE_VERIFY DUP).
  //
  // ✅ Audit 2026-11-26 #1: plus every running SUBSCRIPTION period this device
  // has not had confirmed yet (selectRecoverable). A subscription whose verify
  // failed was charged and never credited - the SUBSCRIBED webhook defers to
  // this verify call and cannot even find the customer until one has run.
  // The same pass also runs app-wide (services/appleIapRecovery, #7).
  const runRecoveryPass = useCallback(async () => {
    const all = await getStorePurchases({ onlyIncludeActiveItemsIOS: false });
    // An unconfirmed activation that is no longer in Transaction.all was
    // finished - i.e. verified, e.g. by the app-level pass meanwhile: lift the block.
    const permanent = await loadPermanentFailTxns();
    const open = openPaidConsumables(all, resolveConsumable, permanent);
    const stillOpen = new Set(open);
    [...unconfirmedIdsRef.current].forEach((id) => {
      if (!stillOpen.has(id)) markUnconfirmed(id, false);
    });
    // ✅ Every paid activation StoreKit still holds unfinished is unconfirmed
    // until its verify succeeds (re-audit PN1) - read from StoreKit itself, so
    // the block survives leaving the screen and a restart.
    open.forEach((id) => markUnconfirmed(id, true));
    setCheckingStore(false);
    const confirmed = await loadConfirmedTxns();
    const todo = selectRecoverable(all, resolveConsumable, Date.now(), confirmed, permanent);
    if (todo.length === 0) return;
    console.log("🔁 Recovering unverified transactions:", todo.length);
    let credited = false;
    for (const purchase of todo) {
      const flow = await handlePurchase(purchase, false);
      if (flow.outcome === "verified") credited = true;
    }
    // Show the activation the backend just granted.
    if (credited) await loadPlans(true);
  }, [resolveConsumable, handlePurchase, loadPlans, markUnconfirmed]);

  const recoveryDoneRef = useRef(false);
  useEffect(() => {
    if (Platform.OS !== "ios") return;
    if (!connected || productSkus.length === 0 || recoveryDoneRef.current) return;
    recoveryDoneRef.current = true;

    (async () => {
      try {
        await runRecoveryPass();
      } catch (error: any) {
        console.warn("⚠️ Unfinished-transaction recovery failed:", error?.message);
      } finally {
        setCheckingStore(false); // persisted unconfirmed ids still block (PN1)
      }
    })();
  }, [connected, productSkus, runRecoveryPass]);

  // StoreKit never connected: stop "checking" after a while; without a
  // connection a purchase cannot start anyway (PN1).
  useEffect(() => {
    const t = setTimeout(() => setCheckingStore(false), 15000);
    return () => clearTimeout(t);
  }, []);

  // The "we're confirming your payment" banner's button: one more pass now.
  // ✅ With a loading state and an answer (re-audit PN6): it did nothing
  // visible. Resolves true while a payment is still unconfirmed.
  const retryUnconfirmed = useCallback(async () => {
    setRetryingUnconfirmed(true);
    try {
      await runRecoveryPass();
    } catch (error: any) {
      console.warn("⚠️ Retry of unconfirmed payment failed:", error?.message);
    } finally {
      setRetryingUnconfirmed(false);
    }
    return unconfirmedIdsRef.current.size > 0;
  }, [runRecoveryPass]);

  // ✅ Keep payment_pending fresh (re-audit PN4): it was read once per load,
  // so a user who stayed on the screen stayed blocked after the cron had run.
  // Silent re-read on return to the foreground, and every minute while pending.
  const paymentPendingNow = plansData?.entitlement?.payment_pending === true;
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void loadPlans(true);
    });
    return () => sub.remove();
  }, [loadPlans]);
  useEffect(() => {
    if (!paymentPendingNow) return;
    const t = setInterval(() => void loadPlans(true), PENDING_POLL_MS);
    return () => clearInterval(t);
  }, [paymentPendingNow, loadPlans]);

  // ✅ A background pass that began before this screen opened credited
  // something (re-audit PN5): show it.
  useEffect(() => onRecoveryCredited(() => void loadPlans(true)), [loadPlans]);

  // ✅ ── Restore Purchases (Apple Guideline 3.1.1) ──
  // Reads StoreKit's transactions and verifies each one HERE, then reloads
  // plans and checks the backend entitlement (our source of truth).
  // It used to call useIAP's getAvailablePurchases() and wait for the
  // listener, but that call never emits to the listener (expo-iap's
  // alsoPublishToEventListenerIOS defaults to false) and, with
  // onlyIncludeActiveItemsIOS true, never returns a consumable - so Restore
  // verified nothing and could not recover an activation.
  const restorePurchases = useCallback(async () => {
    // ✅ Not during a purchase (audit #15): Restore could take the just-bought
    // transaction first, and the user's purchase then ended with no result,
    // no error and no navigation. And not twice at once (two taps, one frame).
    if (purchaseIntentRef.current || restoreRunningRef.current) return;
    restoreRunningRef.current = true;
    try {
      setRestoreLoading(true);
      setRestoreError(null);
      setRestoreResult(null);

      // Allow previously-seen transactions to re-verify on restore,
      // otherwise the dedupe guard would skip them.
      processedTransactions.current.clear();

      // Transaction.all: unfinished consumables + every subscription period.
      // Only the periods still running are worth a verify call; the backend
      // answers an expired one with 'expired' anyway.
      const all = await getStorePurchases({ onlyIncludeActiveItemsIOS: false });
      const toVerify = selectRestorable(all, resolveConsumable, Date.now());
      let queued = 0;
      let failed = 0;
      let otherAccount = 0;
      let creditedOther = 0;
      for (const purchase of toVerify) {
        const flow = await handlePurchase(purchase, false);
        if (flow.outcome === "verified" && isQueuedAction(flow.result?.action)) queued++;
        // PN7: credited to the account it was bought FOR, not this one
        if (flow.outcome === "verified" && flow.result?.action === PURCHASE_CREDITED_OTHER) creditedOther++;
        if (flow.outcome === "verify_failed") {
          const err: any = flow.error;
          if (String(err?.code ?? err?.message ?? "") === PURCHASE_OTHER_ACCOUNT) otherAccount++;
          else failed++;
        }
      }

      // Reload entitlement from backend (source of truth).
      const data = await loadPlans();

      const hasActive =
        data?.entitlement?.has_membership === true &&
        data?.entitlement?.status === "active";

      const outcome = restoreOutcome({
        hasActive,
        queued,
        failed,
        otherAccount,
        paymentPending: data?.entitlement?.payment_pending === true,
        creditedOther,
      });
      // The none/success ratio is the useful number here: "restore found
      // nothing" is a common paid-app complaint and is otherwise invisible
      // unless someone files a support ticket.
      void analyticsService.logRestorePurchases(
        outcome === "success" || outcome === "pending" ? "success" : outcome === "none" ? "none" : "error",
      );
      setRestoreResult(outcome);
    } catch (error: any) {
      void analyticsService.logRestorePurchases("error");
      setRestoreError(error?.message || "Restore failed");
    } finally {
      setRestoreLoading(false);
      restoreRunningRef.current = false;
      // Restore no longer arms awaitingPurchaseRef, so it must not clear it
      // either: clearing it during a purchase made that purchase's result
      // look non-user-initiated and left the one-purchase gate closed.
    }
  }, [handlePurchase, loadPlans, resolveConsumable]);

  // ── Map subscriptions → price lookup ──
  useEffect(() => {
    const all = [...(subscriptions || []), ...(products || [])];
    if (all.length === 0) return;

    const priceMap: Record<string, string> = {};
    all.forEach((product: any) => {
      const id = product.id ?? product.productId;
      const price = product.displayPrice ?? product.localizedPrice;
      if (id && price) priceMap[id] = price;
    });

    if (Object.keys(priceMap).length > 0) {
      console.log("✅ StoreKit prices loaded:", priceMap);
      setStoreProducts(priceMap);
      setLoadingPrices(false);
    }
  }, [subscriptions, products]);

  // ── Purchase listener — fires after Apple confirms a purchase ──
  // The work is in handlePurchase above (shared with recovery and Restore).
  // ✅ User-initiated only when it is the product being bought (audit #14).
  useEffect(() => {
    const subscription = purchaseUpdatedListener((purchase: any) => {
      const userInitiated = isUserInitiatedEvent(awaitingPurchaseRef.current, pendingSkuRef.current, purchase);
      void handlePurchase(purchase, userInitiated).then((flow) => {
        // ✅ A purchase arriving on its own (Ask to Buy approved while the
        // screen is open) was verified but never shown (re-audit PN5).
        if (!userInitiated && flow.outcome === "verified") void loadPlans(true);
      });
    });

    return () => subscription.remove();
  }, [handlePurchase, loadPlans]);

  // ── Purchase ERROR listener — the other half of the purchase lifecycle ──
  // expo-iap does NOT reject requestPurchase when the user dismisses the Apple
  // sheet: cancellations and StoreKit failures arrive here instead, never as a
  // throw. Without this listener the Continue button's spinner is armed by
  // requestPurchase and nothing ever disarms it, so a cancelled purchase leaves
  // the button spinning until MembershipPlansScreen is remounted. A real
  // failure was also silent — purchaseError only ever came from the verify step.
  useEffect(() => {
    const subscription = purchaseErrorListener((error) => {
      // Always disarm the button, whatever the cause — this is the stuck-spinner fix.
      setPurchaseButtonLoading(false);

      // A restore that fails reports through restoreError; don't double-report,
      // and don't disarm awaitingPurchaseRef out from under an in-flight
      // restore — restorePurchases owns that flag for the length of its run.
      if (!purchaseIntentRef.current) return;
      purchaseIntentRef.current = false;
      awaitingPurchaseRef.current = false;
      pendingSkuRef.current = null;

      if (error?.code === ErrorCode.UserCancelled) {
        console.log("ℹ️ User cancelled purchase - no action needed");
        return;
      }

      // ✅ Ask to Buy / deferred payment is not a failure (audit #8): nothing
      // is charged yet, the purchase arrives later if approved.
      if (error?.code === ErrorCode.DeferredPayment) {
        console.log("⏸ Purchase awaiting approval (deferred payment)");
        setPurchasePendingApproval(true);
        return;
      }

      console.error("❌ Purchase failed:", error?.code, error?.message);
      setPurchaseError(error?.message || "Purchase failed");
    });

    return () => subscription.remove();
  }, []);

  const visibleTiers = useMemo<PlanId[]>(() => {
    if (!plansData) return [];
    const returned = plansData.plans
      .filter((plan) => PLAN_IDS.includes(plan.tier as PlanId))
      .sort((a, b) => a.rank - b.rank)
      .map((plan) => plan.tier as PlanId);
    // Only fall back to the full list if the API gave us nothing usable at
    // all - an empty plan screen is worse than a stale one.
    return returned.length > 0 ? returned : PLAN_IDS;
  }, [plansData]);

  const singlePlan = useMemo<PlanItem | null>(
    () => plansData?.plans.find((plan) => plan.tier === "single") ?? null,
    [plansData],
  );

  // ── planByTier map ──
  const planByTier = useMemo(() => {
    const map: Partial<Record<PlanId, PlanItem>> = {};
    if (plansData) {
      plansData.plans.forEach((plan) => {
        map[plan.tier as PlanId] = plan;
      });
    }
    return map;
  }, [plansData]);

  // ── Default selected tier from entitlement ──
  const defaultSelectedTier = useMemo<PlanId | null>(() => {
    if (!plansData) return null;
    const { has_membership, status, tier } = plansData.entitlement;
    if (
      has_membership &&
      status === "active" &&
      PLAN_IDS.includes(tier as PlanId)
    ) {
      return tier as PlanId;
    }
    return null;
  }, [plansData]);

  return {
    plansData,
    loadingPlans,
    plansError,
    planByTier,
    singlePlan,
    visibleTiers,
    storeProducts,
    loadingPrices,
    defaultSelectedTier,
    refetchPlans: async () => {   // ✅ void wrapper
      await loadPlans();
    },
    requestPurchase,
    purchaseLoading,
    purchaseResult,
    purchaseError,
    resetPurchase,
    // ✅ Restore purchases
    restorePurchases,
    restoreLoading,
    restoreResult,
    restoreError,
    resetRestore,
    purchaseButtonLoading,
    // ✅ Payments audit 2026-11-26
    unconfirmedPayment,
    retryUnconfirmed,
    paymentPending: plansData?.entitlement?.payment_pending === true,
    retryingUnconfirmed,
    checkingStore,
    purchasePendingApproval,
    resetPendingApproval,
  };
}
