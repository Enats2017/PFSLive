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
  // ✅ StoreKit keeps the period a user upgraded AWAY from in Transaction.all,
  // with its original (future) expiry. Verifying it would credit the old tier
  // next to the new one (audit 2026-11-26 #12), so the selectors skip it.
  isUpgradedIOS?: boolean | null;
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

/**
 * One purchase at a time. Returns true and closes the gate when no purchase
 * is in progress; false (leave the gate as is) when one already is. A plain
 * ref, not React state, so two taps in the same frame cannot both pass.
 * Support 2026-11-26: a second tap while the first purchase was starting
 * opened a second Apple sheet - 22 activations + 1 subscription charged twice.
 */
export function tryBeginPurchase(gate: { current: boolean }): boolean {
  if (gate.current) return false;
  gate.current = true;
  return true;
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
      if (p.isUpgradedIOS === true) return false; // ✅ upgraded away from (#12)
      const expires = Number(p.expirationDateIOS ?? 0);
      return Number.isFinite(expires) && expires > nowMs;
    }
    return false;
  });
}

/* ══════════════════════════════════════════════════════════════════════
 *  Payments audit 2026-11-26 - everything below. Same rule as above: pure,
 *  no React / RN / expo-iap, so npm run test:iap-purchase-flow covers it.
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ✅ What the automatic recovery pass verifies (audit #1). It used to be
 * consumables only, so a SUBSCRIPTION whose verify failed (network, timeout,
 * app killed between Apple's confirmation and our call) was charged and never
 * credited: the SUBSCRIBED webhook defers to the verify call and cannot even
 * find the customer until one has run. Now: every unfinished consumable, plus
 * every running, not-upgraded-away subscription period this device has not
 * already had confirmed (`confirmed`, persisted by the caller), so a member
 * does not cost one API call per period on every launch. The backend answers
 * an already-known period with already_processed.
 */
export function selectRecoverable<P extends PurchaseLike>(
  purchases: readonly P[] | null | undefined,
  resolveConsumable: ResolveConsumable,
  nowMs: number,
  confirmed: ReadonlySet<string>,
  // ✅ Transactions the server answered with a FINAL refusal (re-audit PN3:
  // subscription_linked_to_other_account, unknown_product, ...). Re-verifying
  // them on every launch / visit can only get the same answer. Restore
  // (selectRestorable) still sends them - that is the user asking again.
  permanent: ReadonlySet<string> = new Set(),
): P[] {
  return selectRestorable(purchases, resolveConsumable, nowMs).filter((p) => {
    const id = transactionIdOf(p);
    if (id && permanent.has(id)) return false;
    if (resolveConsumable(skuOf(p)) === true) return true; // unfinished = not credited
    return !!id && !confirmed.has(id);
  });
}

/**
 * ✅ The activations Apple charged that our server has not credited yet
 * (re-audit PN1): every unfinished consumable in Transaction.all - we finish one
 * only after a verify - minus the ones the server refused for good. While any
 * exists the app must not sell another; this is read from StoreKit, so it
 * survives leaving the screen and restarting the app.
 */
export function openPaidConsumables<P extends PurchaseLike>(
  purchases: readonly P[] | null | undefined,
  resolveConsumable: ResolveConsumable,
  permanent: ReadonlySet<string> = new Set(),
): string[] {
  return selectUnfinishedConsumables(purchases, resolveConsumable)
    .map(transactionIdOf)
    .filter((id): id is string => !!id && !permanent.has(id));
}

/** The AppError shape api.ts throws, as far as this module needs it. */
export interface VerifyErrorLike {
  type?: string;
  code?: string;
  message?: string;
}

// Backend codes that will answer the same way however often we retry.
const PERMANENT_VERIFY_CODES = new Set([
  'transaction_id_invalid',
  'bundle_mismatch',
  'unknown_product',
  'subscription_linked_to_other_account',
]);

/**
 * ✅ true when retrying the verify call can succeed (audit #2): no response,
 * a timeout, a 5xx, an expired session, a rate limit, or Apple's lookup
 * failing on our server. The four codes above are final.
 */
export function isTransientVerifyError(err: unknown): boolean {
  const e = (err ?? {}) as VerifyErrorLike;
  const code = String(e.code ?? e.message ?? '').toLowerCase();
  if (PERMANENT_VERIFY_CODES.has(code)) return false;
  return true;
}

/**
 * ✅ Verify with in-place retries (audit #2). One failed POST after Apple had
 * already charged used to show "please try again" - and trying again bought a
 * SECOND activation. A short backoff absorbs the blip / slow Apple lookup
 * before anything is shown. Only transient errors are retried.
 */
export async function verifyWithRetry<R>(
  verify: () => Promise<R>,
  delaysMs: readonly number[],
  sleep: (ms: number) => Promise<void>,
  // ✅ One deadline across ALL attempts (re-audit PN8). Each call may take up
  // to the 45 s request timeout, so three attempts kept the user behind the
  // non-dismissable "processing" modal for ~142 s. Past the deadline the
  // caller shows "payment received, we're confirming" (with a close button)
  // and the recovery passes carry on; the server is idempotent, so a call
  // still in flight completing later is harmless.
  // `timer` bounds one attempt (defaults to `sleep`); split out so a test clock
  // can tell waiting between attempts from the per-attempt cap.
  opts: { deadlineMs?: number; now?: () => number; timer?: (ms: number) => Promise<void> } = {},
): Promise<R> {
  const now = opts.now ?? (() => Date.now());
  const end = opts.deadlineMs != null ? now() + opts.deadlineMs : Infinity;
  const timedOut = () => Object.assign(new Error('network_error'), { type: 'network', code: 'network_error' });
  let lastError: unknown;
  for (let attempt = 0; attempt <= delaysMs.length; attempt++) {
    if (attempt > 0) {
      if (now() + delaysMs[attempt - 1] >= end) break;
      await sleep(delaysMs[attempt - 1]);
    }
    const left = end - now();
    if (left <= 0) { lastError = lastError ?? timedOut(); break; }
    try {
      if (left === Infinity) return await verify();
      return await Promise.race([
        verify(),
        (opts.timer ?? sleep)(left).then((): R => { throw timedOut(); }),
      ]);
    } catch (err) {
      lastError = err;
      if (!isTransientVerifyError(err)) break;
    }
  }
  throw lastError;
}

/** Verify actions that mean "an order was just queued" (membership comes from the cron). */
export function isQueuedAction(action: unknown): boolean {
  return action === 'purchase_queued' || action === 'upgrade_queued' || action === 'renewal_queued';
}

export type RestoreOutcome =
  | 'success'
  | 'pending'
  | 'none'
  | 'error'
  | 'other_account'
  // ✅ re-audit PN7: the purchase was made from another Livio account and the
  // server credited THAT account (appAccountToken) - not "being activated".
  | 'credited_other_account';

/**
 * ✅ What Restore tells the user (audit #3, #11). It read only the entitlement
 * right after verifying, but the membership row is written later by the cron,
 * so a Restore that had just credited a purchase said "nothing to restore" -
 * and so did one whose verify calls had all failed.
 */
export function restoreOutcome(r: {
  hasActive: boolean;
  queued: number;
  failed: number;
  otherAccount: number;
  paymentPending: boolean;
  creditedOther?: number;
}): RestoreOutcome {
  if (r.hasActive) return 'success';
  if (r.queued > 0 || r.paymentPending) return 'pending';
  if ((r.creditedOther ?? 0) > 0) return 'credited_other_account';
  if (r.otherAccount > 0) return 'other_account';
  if (r.failed > 0) return 'error';
  return 'none';
}

/**
 * ✅ Is this listener event the purchase the user just started (audit #14)?
 * "A purchase is armed" alone also matched any other transaction StoreKit
 * delivered while the sheet was open, which then navigated as the user's
 * success and released the one-purchase gate early. An event without a SKU
 * keeps the old behaviour.
 */
export function isUserInitiatedEvent(
  armed: boolean,
  pendingSku: string | null,
  purchase: PurchaseLike,
): boolean {
  if (!armed) return false;
  const sku = skuOf(purchase);
  if (!pendingSku || !sku) return true;
  return sku === pendingSku;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * ✅ The appAccountToken apple_get_plans_api hands out (audit #5) - only a
 * well-formed UUID is passed to StoreKit; anything else (an older server sends
 * nothing) means "no token", exactly the previous behaviour.
 */
export function validAppAccountToken(token: unknown): string | null {
  return typeof token === 'string' && UUID_RE.test(token) ? token.toLowerCase() : null;
}

/**
 * ✅ May the activation be bought right now (audit #2, #4, #16)?
 *  - 'busy'        a purchase is starting / being verified (c8b1901)
 *  - 'unconfirmed' Apple charged an earlier one we have not confirmed yet -
 *                  buying again is exactly how the 22 double charges happened
 *  - 'pending'     paid and confirmed, the cron has not activated it yet
 *  - 'action'      the backend does not sell it to this account (hidden)
 */
//  - 'checking'    re-audit PN1: StoreKit has not been asked yet whether it
//                  still holds a paid, uncredited activation (first seconds
//                  after the screen opens) - not sellable until it answers
export type BuyBlock = null | 'busy' | 'checking' | 'unconfirmed' | 'pending' | 'action';
export function activationBuyBlock(s: {
  busy: boolean;
  unconfirmed: boolean;
  paymentPending: boolean;
  action: string | null | undefined;
  checking?: boolean;
}): BuyBlock {
  if (s.busy) return 'busy';
  if (s.unconfirmed) return 'unconfirmed';
  if (s.checking) return 'checking';
  if (s.paymentPending) return 'pending';
  if (s.action && s.action !== 'subscribe') return 'action';
  return null;
}
