/**
 * iapPurchaseFlow.ts - the pure decision logic behind useMembershipPlans'
 * Apple purchase handling. No React, no React Native, no expo-iap imports, so
 * `npm run test:iap-purchase-flow` can run it in plain Node.
 *
 * Why it exists (support case 2026-11-26, see document/support_replies.md):
 * Apple charged the EUR 5.95 activation but no verify call
 * ever reached apple_verify_purchase_api.php, and nothing retried it:
 *   - openiap-apple 2.2.1 (expo-iap 4.3.4) on initConnection only STORES
 *     unfinished transactions (processUnfinishedTransactions -> storePending);
 *     it never emits them to purchaseUpdatedListener.
 *   - Restore read Transaction.currentEntitlements (useIAP's default
 *     onlyIncludeActiveItemsIOS: true), which never holds a consumable, and
 *     did not emit to the listener either.
 * The hook now runs every transaction - listener, recovery pass, Restore -
 * through processPurchase() below, and picks what to recover / restore with
 * selectUnfinishedConsumables() / selectRestorable().
 */

/** true = consumable, false = subscription, null = no source knows the SKU yet. */
export type ResolveConsumable = (sku: string) => boolean | null;

/** The fields of an expo-iap Purchase this flow reads. */
export interface PurchaseLike {
  id?: string | null;
  transactionId?: string | null;
  transaction_id?: string | null;
  productId?: string | null;
  product_id?: string | null;
  expirationDateIOS?: number | string | null;
}

export type PurchaseOutcome =
  | 'no_transaction_id'
  | 'already_processed'
  | 'in_flight'
  | 'deferred'
  | 'verified'
  | 'verify_failed';

export interface PurchaseFlowDeps<R> {
  resolveConsumable: ResolveConsumable;
  /** Transactions verified in this screen session (dedupe). */
  processed: Set<string>;
  /** Transactions whose verify call is running right now. */
  processing: Set<string>;
  verify: (transactionId: string) => Promise<R>;
  /** expo-iap finishTransaction. Its failure is logged, never fatal. */
  finish: (purchase: PurchaseLike, isConsumable: boolean) => Promise<unknown>;
  log?: (...args: unknown[]) => void;
}

export interface PurchaseFlowResult<R> {
  outcome: PurchaseOutcome;
  transactionId: string | null;
  isConsumable: boolean | null;
  result?: R;
  error?: unknown;
}

export function transactionIdOf(purchase: PurchaseLike): string | null {
  const id = purchase.transactionId ?? purchase.id ?? purchase.transaction_id;
  return id ? String(id) : null;
}

export function skuOf(purchase: PurchaseLike): string {
  return String(purchase.productId ?? purchase.product_id ?? '');
}

/**
 * Verify one Apple transaction with the backend, then finish it.
 *
 * Order matters:
 *  - Consumable-or-not is decided BEFORE verifying. Deciding after would mean
 *    a deferral had already granted the entitlement and would verify the same
 *    transaction again on the replay.
 *  - finish() only AFTER a successful verify. A transaction that failed to
 *    verify stays unfinished in StoreKit, so selectUnfinishedConsumables()
 *    finds it again on the next visit - that is the retry.
 *  - Not marked processed on failure, for the same reason.
 */
export async function processPurchase<R>(
  purchase: PurchaseLike,
  deps: PurchaseFlowDeps<R>,
): Promise<PurchaseFlowResult<R>> {
  const log = deps.log ?? (() => {});
  const transactionId = transactionIdOf(purchase);
  if (!transactionId) {
    return { outcome: 'no_transaction_id', transactionId: null, isConsumable: null };
  }
  if (deps.processed.has(transactionId)) {
    log('⏭ Transaction already processed:', transactionId);
    return { outcome: 'already_processed', transactionId, isConsumable: null };
  }
  if (deps.processing.has(transactionId)) {
    return { outcome: 'in_flight', transactionId, isConsumable: null };
  }

  const sku = skuOf(purchase);
  const isConsumable = deps.resolveConsumable(sku);
  if (isConsumable === null) {
    // Neither StoreKit nor the backend catalog knows this product yet (the
    // launch case). Leave it unverified and unfinished; the recovery pass
    // picks it up once the catalog is in. Guessing "subscription" here is
    // what strands a consumable in the queue.
    log('⏸ Deferring transaction - product not known yet:', sku || '(no sku on purchase)');
    return { outcome: 'deferred', transactionId, isConsumable: null };
  }

  deps.processing.add(transactionId);
  try {
    const result = await deps.verify(transactionId);
    // A consumable MUST be finished as one: StoreKit will not sell the same
    // consumable again while one is unfinished, which a second EUR 5.95
    // activation needs. Subscriptions are finished as non-consumables.
    try {
      await deps.finish(purchase, isConsumable);
    } catch (err: any) {
      log('⚠️ finishTransaction warning:', err?.message);
    }
    deps.processed.add(transactionId);
    return { outcome: 'verified', transactionId, isConsumable, result };
  } catch (error) {
    return { outcome: 'verify_failed', transactionId, isConsumable, error };
  } finally {
    deps.processing.delete(transactionId);
  }
}

/**
 * From StoreKit's Transaction.all (getAvailablePurchases with
 * onlyIncludeActiveItemsIOS: false), the consumables - which are exactly the
 * paid-but-not-yet-credited activations: Transaction.all holds a consumable
 * only while it is unfinished (this app has no SK2ConsumableTransactionHistory
 * key), and processPurchase finishes one only after the backend verified it.
 * Subscriptions and unknown SKUs are left out: this pass is for activations.
 */
export function selectUnfinishedConsumables<P extends PurchaseLike>(
  purchases: readonly P[] | null | undefined,
  resolveConsumable: ResolveConsumable,
): P[] {
  return (purchases ?? []).filter((p) => resolveConsumable(skuOf(p)) === true);
}

/**
 * What Restore verifies: every unfinished consumable, plus each subscription
 * period still running at `nowMs`. Expired periods are skipped (the backend
 * would answer 'expired' anyway). Unknown SKUs are skipped. The same
 * transaction id is kept once.
 */
export function selectRestorable<P extends PurchaseLike>(
  purchases: readonly P[] | null | undefined,
  resolveConsumable: ResolveConsumable,
  nowMs: number,
): P[] {
  const seen = new Set<string>();
  return (purchases ?? []).filter((p) => {
    const id = transactionIdOf(p);
    if (id) {
      if (seen.has(id)) return false;
      seen.add(id);
    }
    const consumable = resolveConsumable(skuOf(p));
    if (consumable === true) return true;
    if (consumable === false) {
      const expires = Number(p.expirationDateIOS ?? 0);
      return Number.isFinite(expires) && expires > nowMs;
    }
    return false;
  });
}
