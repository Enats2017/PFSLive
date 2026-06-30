import { useState, useEffect, useMemo, useCallback } from 'react';
import { useIAP } from 'expo-iap';
import {
    membershipPlanService,
    PlanItem,
    MembershipPlansData,
} from '../services/membershipplanservice';

export type PlanId = 'lite' | 'basic' | 'pro';

export const PLAN_IDS: PlanId[] = ['lite', 'basic', 'pro'];

const PRODUCT_SKUS = [
    'com.livio.sub.lite.yearly',
    'com.livio.sub.basic.yearly',
    'com.livio.sub.pro.yearly',
];

interface UseMembershipPlansResult {
    plansData: MembershipPlansData | null;
    loadingPlans: boolean;
    plansError: string | null;
    planByTier: Partial<Record<PlanId, PlanItem>>;
    storeProducts: Record<string, string>;
    loadingPrices: boolean;
    defaultSelectedTier: PlanId | null;
    refetchPlans: () => Promise<void>;
}

export function useMembershipPlans(): UseMembershipPlansResult {
    const [plansData, setPlansData] = useState<MembershipPlansData | null>(null);
    const [loadingPlans, setLoadingPlans] = useState<boolean>(true);
    const [plansError, setPlansError] = useState<string | null>(null);

    const { connected, products, fetchProducts } = useIAP();
    const [storeProducts, setStoreProducts] = useState<Record<string, string>>({});
    const [loadingPrices, setLoadingPrices] = useState<boolean>(true);

    const loadPlans = useCallback(async () => {
        try {
            setLoadingPlans(true);
            setPlansError(null);
            const data = await membershipPlanService.getApplePlans();
            setPlansData(data);
        } catch (error: any) {
            setPlansError(error?.message || 'Failed to load membership plans');
            console.error('❌ Error loading membership plans:', error);
        } finally {
            setLoadingPlans(false);
        }
    }, []);

    useEffect(() => {
        loadPlans();
    }, [loadPlans]);

    useEffect(() => {
        if (!connected) return;

        const loadPrices = async () => {
            try {
                setLoadingPrices(true);
                await fetchProducts({
                    skus: PRODUCT_SKUS,
                    type: 'subs',
                });
            } catch (error) {
                console.error('❌ Error fetching store prices:', error);
                setLoadingPrices(false);
            }
        };

        loadPrices();
    }, [connected, fetchProducts]);

    useEffect(() => {
        if (!products || products.length === 0) return;

        const priceMap: Record<string, string> = {};
        products.forEach((product: any) => {
            if (product.id && product.displayPrice) {
                priceMap[product.id] = product.displayPrice;
            } else if (product.productId && product.localizedPrice) {
                priceMap[product.productId] = product.localizedPrice;
            }
        });

        setStoreProducts(priceMap);
        setLoadingPrices(false);
    }, [products]);

    const planByTier = useMemo(() => {
        const map: Partial<Record<PlanId, PlanItem>> = {};
        if (plansData) {
            plansData.plans.forEach((plan) => {
                map[plan.tier as PlanId] = plan;
            });
        }
        return map;
    }, [plansData]);

    const defaultSelectedTier = useMemo<PlanId | null>(() => {
        if (!plansData) return null;
        const { has_membership, status, tier } = plansData.entitlement;
        if (has_membership && status === 'active' && PLAN_IDS.includes(tier as PlanId)) {
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
    };
}