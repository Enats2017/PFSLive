import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useIAP, purchaseUpdatedListener, finishTransaction } from "expo-iap";
import {
  membershipPlanService,
  PlanItem,
  MembershipPlansData,
} from "../services/membershipplanservice";
import {
  appleVerifyService,
  VerifyPurchaseResponse,
} from "../services/appleverifyservice";

export type PlanId = "lite" | "basic" | "pro";

export const PLAN_IDS: PlanId[] = ["lite", "basic", "pro"];

interface UseMembershipPlansResult {
  plansData: MembershipPlansData | null;
  loadingPlans: boolean;
  plansError: string | null;
  planByTier: Partial<Record<PlanId, PlanItem>>;
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
}

export function useMembershipPlans(): UseMembershipPlansResult {
  const [plansData, setPlansData] = useState<MembershipPlansData | null>(null);
  const [loadingPlans, setLoadingPlans] = useState<boolean>(true);
  const [plansError, setPlansError] = useState<string | null>(null);
  const [purchaseLoading, setPurchaseLoading] = useState<boolean>(false);
  const [purchaseResult, setPurchaseResult] =
    useState<VerifyPurchaseResponse | null>(null);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
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
  console.log("11111", awaitingPurchaseRef);

  console.log("🚀 useMembershipPlans mounted");

  const resetPurchase = useCallback(() => {
    setPurchaseError(null);
    setPurchaseResult(null);
    setPurchaseLoading(false);
  }, []);

  // ── Load plans from backend ──
  const loadPlans = useCallback(async () => {
    try {
      setLoadingPlans(true);
      setPlansError(null);
      const data = await membershipPlanService.getApplePlans();
      setPlansData(data);
    } catch (error: any) {
      setPlansError(error?.message || "Failed to load membership plans");
      console.error("❌ Error loading membership plans:", error);
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

  // ── Fetch StoreKit prices once connected + SKUs ready ──
  useEffect(() => {
    if (!connected || productSkus.length === 0) return;

    const loadPrices = async () => {
      try {
        setLoadingPrices(true);
        console.log("📡 Fetching StoreKit prices for:", productSkus);
        await fetchProducts({ skus: productSkus, type: "subs" });
      } catch (error) {
        console.error("❌ Error fetching store prices:", error);
      } finally {
        setLoadingPrices(false); // ✅ always resolves, never hangs
      }
    };

    loadPrices();
  }, [connected, productSkus, fetchProducts]);

  const requestPurchase = useCallback(
    async (params: Parameters<typeof rawRequestPurchase>[0]) => {
      awaitingPurchaseRef.current = true; // arm it — a real purchase attempt is starting
      try {
        return await rawRequestPurchase(params);
      } catch (err) {
        awaitingPurchaseRef.current = false; // disarm if the call itself throws (e.g. sync validation error)
        throw err;
      }
    },
    [rawRequestPurchase],
  );

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

  // ── Purchase listener — fires after Apple confirms payment ──
  useEffect(() => {
    const subscription = purchaseUpdatedListener(async (purchase: any) => {
      const transactionId =
        purchase.transactionId ?? purchase.id ?? purchase.transaction_id;

      if (!transactionId) return;

      if (processedTransactions.current.has(transactionId)) {
        console.log("⏭ Transaction already processed:", transactionId);
        awaitingPurchaseRef.current = false;
        return;
      }
      if (processingRef.current.has(transactionId)) return;
      const isUserInitiatedThisSession = awaitingPurchaseRef.current;

      processingRef.current.add(transactionId);
      if (isUserInitiatedThisSession) {
        setPurchaseLoading(true);
        setPurchaseError(null);
        setPurchaseResult(null);
      }

      try {
        const result = await appleVerifyService.verifyPurchase(transactionId);
        await finishTransaction({ purchase, isConsumable: false }).catch(
          (err) => {
            console.warn("⚠️ finishTransaction warning:", err?.message);
          },
        );
        processedTransactions.current.add(transactionId);
        if (isUserInitiatedThisSession) {
          setPurchaseResult(result); // drives navigation
        } else {
          console.log(
            "✅ Background-reconciled prior purchase:",
            transactionId,
          );
        }
      } catch (error: any) {
        if (isUserInitiatedThisSession) {
          setPurchaseError(error?.message || "Verification failed");
        }
      } finally {
        processingRef.current.delete(transactionId);
        if (isUserInitiatedThisSession) setPurchaseLoading(false);
        awaitingPurchaseRef.current = false;
      }
    });

    return () => subscription.remove();
  }, []);

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
    storeProducts,
    loadingPrices,
    defaultSelectedTier,
    refetchPlans: loadPlans,
    requestPurchase,
    purchaseLoading,
    purchaseResult,
    purchaseError,
    resetPurchase,
  };
}
