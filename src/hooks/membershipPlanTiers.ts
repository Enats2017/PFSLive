/**
 * Which subscription tiers the iOS plans screen draws, kept out of the hook so
 * it can be tested without React or StoreKit (npm run test:plan-tiers).
 *
 * Why it exists: the website took Livio Pro and Livio Unlimited off sale
 * (oc_membership.sale_disabled = 1), and apple_get_plans_api.php stopped
 * returning them. The screen then shows only what the backend sent - the
 * one-off activation, or nothing - instead of drawing the old subscription
 * cards from a hardcoded list. Hide only: no copy changes.
 */

export type PlanId = "lite" | "basic" | "pro";

export const PLAN_IDS: PlanId[] = ["lite", "basic", "pro"];

export interface TierPlan {
  tier: string;
  rank: number;
}

/**
 * The subscription tiers the backend ACTUALLY returned, in rank order.
 *
 * No fallback to PLAN_IDS any more. The old fallback ("an empty plan screen
 * is worse than a stale one") meant that the day the backend returned only the
 * single activation, the screen drew Lite, Pro and Unlimited again - cards with
 * no product behind them, a price spinner that never stops and a dead button.
 * A plan the backend did not send is not for sale.
 */
export function visibleSubscriptionTiers(plans: TierPlan[] | null | undefined): PlanId[] {
  if (!plans) return [];
  return plans
    .filter((plan) => PLAN_IDS.includes(plan.tier as PlanId))
    .sort((a, b) => a.rank - b.rank)
    .map((plan) => plan.tier as PlanId);
}
