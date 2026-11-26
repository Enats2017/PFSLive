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
  selectRestorable,
  selectUnfinishedConsumables,
} from "./iapPurchaseFlow";
import { analyticsService, SubscriptionState } from "../services/analyticsService";

export type PlanId = "lite" | "basic" | "pro";

export const PLAN_IDS: PlanId[] = ["lite", "basic", "pro"];

// ✅ Restore result type
export type RestoreResult = "success" | "none" | null;

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
  const processedTransactions = useRef<Set<string>>(new Set());
  const processingRef = useRef<Set<string>>(new Set());
  const awaitingPurchaseRef = useRef(false);
  // Armed ONLY by requestPurchase, never by restorePurchases, so the error
  // listener can tell a failed purchase (owns purchaseError) from a failed
  // restore (owns restoreError) — awaitingPurchaseRef is armed by both.
  const purchaseIntentRef = useRef(false);

  console.log("🚀 useMembershipPlans mounted");

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

  // ── Load plans from backend ──
  const loadPlans = useCallback(async () => {
    try {
      setLoadingPlans(true);
      setPlansError(null);
      const data = await membershipPlanService.getApplePlans();
      setPlansData(data);

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
      setPlansError(error?.message || "Failed to load membership plans");
      console.error("❌ Error loading membership plans:", error);
      return null;
    } finally {
      setLoadingPlans(false);
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

  const requestPurchase = useCallback(
    async (params: Parameters<typeof rawRequestPurchase>[0]) => {
      awaitingPurchaseRef.current = true; // arm it — a real purchase attempt is starting
      purchaseIntentRef.current = true;
      setPurchaseButtonLoading(true);
      try {
        return await rawRequestPurchase(params);
      } catch (err) {
        awaitingPurchaseRef.current = false; // disarm if the call itself throws
        purchaseIntentRef.current = false;
        setPurchaseButtonLoading(false);
        throw err;
      }
    },
    [rawRequestPurchase],
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
    async (purchase: any, userInitiated: boolean): Promise<boolean> => {
      if (userInitiated) {
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
          verify: (id) => appleVerifyService.verifyPurchase(id),
          finish: (p, isConsumable) =>
            finishTransaction({ purchase: p as any, isConsumable }),
          log: console.log,
        });

        if (flow.outcome === "verified") {
          if (userInitiated) {
            setPurchaseResult(flow.result ?? null); // drives navigation
          } else {
            console.log("✅ Background-reconciled prior purchase:", flow.transactionId);
          }
          return true;
        }
        // NOT finished on verify_failed: the transaction stays in StoreKit's
        // unfinished queue, so the next recovery pass (next visit to this
        // screen) retries it.
        if (flow.outcome === "verify_failed" && userInitiated) {
          const err: any = flow.error;
          setPurchaseError(err?.message || "Verification failed");
        }
        return false;
      } finally {
        if (userInitiated) {
          setPurchaseLoading(false);
          awaitingPurchaseRef.current = false;
          purchaseIntentRef.current = false;
        }
      }
    },
    [resolveConsumable],
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
  const recoveryDoneRef = useRef(false);
  useEffect(() => {
    if (Platform.OS !== "ios") return;
    if (!connected || inAppSkus.length === 0 || recoveryDoneRef.current) return;
    recoveryDoneRef.current = true;

    (async () => {
      try {
        const all = await getStorePurchases({ onlyIncludeActiveItemsIOS: false });
        const unfinished = selectUnfinishedConsumables(all, resolveConsumable);
        if (unfinished.length === 0) return;
        console.log("🔁 Recovering unfinished consumables:", unfinished.length);
        let credited = false;
        for (const purchase of unfinished) {
          if (await handlePurchase(purchase, false)) credited = true;
        }
        // Show the activation the backend just granted.
        if (credited) await loadPlans();
      } catch (error: any) {
        console.warn("⚠️ Unfinished-transaction recovery failed:", error?.message);
      }
    })();
  }, [connected, inAppSkus, resolveConsumable, handlePurchase, loadPlans]);

  // ✅ ── Restore Purchases (Apple Guideline 3.1.1) ──
  // Reads StoreKit's transactions and verifies each one HERE, then reloads
  // plans and checks the backend entitlement (our source of truth).
  // It used to call useIAP's getAvailablePurchases() and wait for the
  // listener, but that call never emits to the listener (expo-iap's
  // alsoPublishToEventListenerIOS defaults to false) and, with
  // onlyIncludeActiveItemsIOS true, never returns a consumable - so Restore
  // verified nothing and could not recover an activation.
  const restorePurchases = useCallback(async () => {
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
      for (const purchase of toVerify) {
        await handlePurchase(purchase, false);
      }

      // Reload entitlement from backend (source of truth).
      const data = await loadPlans();

      const hasActive =
        data?.entitlement?.has_membership === true &&
        data?.entitlement?.status === "active";

      const outcome = hasActive ? "success" : "none";
      // The none/success ratio is the useful number here: "restore found
      // nothing" is a common paid-app complaint and is otherwise invisible
      // unless someone files a support ticket.
      void analyticsService.logRestorePurchases(outcome);
      setRestoreResult(outcome);
    } catch (error: any) {
      void analyticsService.logRestorePurchases("error");
      setRestoreError(error?.message || "Restore failed");
    } finally {
      setRestoreLoading(false);
      awaitingPurchaseRef.current = false;
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
  useEffect(() => {
    const subscription = purchaseUpdatedListener((purchase: any) => {
      void handlePurchase(purchase, awaitingPurchaseRef.current);
    });

    return () => subscription.remove();
  }, [handlePurchase]);

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

      if (error?.code === ErrorCode.UserCancelled) {
        console.log("ℹ️ User cancelled purchase - no action needed");
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
  };
}