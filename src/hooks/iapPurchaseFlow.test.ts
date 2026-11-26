/**
 * Tests for iapPurchaseFlow.ts. Run: npm run test:iap-purchase-flow
 *
 * No test framework in this repo - plain asserts, exit code 1 on failure.
 *
 * Support case 2026-11-26 (see document/support_replies.md):
 * Apple charged the EUR 5.95 activation, no verify call ever reached the API,
 * and nothing retried it - the plans screen was opened 9 more times. A fake
 * StoreKit queue and a fake (idempotent) backend replay that case and the edge
 * cases around it. The last block checks useMembershipplans.ts itself, so the
 * hook cannot drift back to the old Restore / no-recovery code.
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import {
  processPurchase,
  selectRestorable,
  selectUnfinishedConsumables,
  tryBeginPurchase,
  selectRecoverable,
  isTransientVerifyError,
  verifyWithRetry,
  isQueuedAction,
  restoreOutcome,
  isUserInitiatedEvent,
  validAppAccountToken,
  activationBuyBlock,
  openPaidConsumables,
  type PurchaseFlowDeps,
  type PurchaseLike,
  type ResolveConsumable,
} from './iapPurchaseFlow';

let passed = 0;
let failed = 0;
const pending: Promise<void>[] = [];
function test(name: string, fn: () => void | Promise<void>) {
  const run = (async () => {
    try {
      await fn();
      passed++;
      console.log(`  ok   ${name}`);
    } catch (e: any) {
      failed++;
      console.log(`  FAIL ${name}\n       ${e?.message ?? e}`);
    }
  })();
  pending.push(run);
}

// ── Catalog: what StoreKit / the backend say each SKU is ──
const SINGLE = 'com.livio.activation.single';
const SUB = 'com.livio.sub.basic.yearly';
const resolve: ResolveConsumable = (sku) =>
  sku === SINGLE ? true : sku === SUB ? false : null;

// ── Fake StoreKit: a transaction stays in Transaction.all while unfinished
//    (consumable) / always (subscription period), like the real one. ──
interface FakeTxn extends PurchaseLike {
  id: string;
  productId: string;
  finished?: boolean;
}
class FakeStore {
  txns: FakeTxn[] = [];
  finishCalls: { id: string; isConsumable: boolean }[] = [];
  buy(id: string, productId: string, extra: Partial<FakeTxn> = {}): FakeTxn {
    const t: FakeTxn = { id, transactionId: id, productId, ...extra };
    this.txns.push(t);
    return t;
  }
  /** getAvailablePurchases({ onlyIncludeActiveItemsIOS: false }) = Transaction.all */
  all(): FakeTxn[] {
    return this.txns.filter((t) => !(t.productId === SINGLE && t.finished)).map((t) => ({ ...t }));
  }
  /** Old Restore: onlyIncludeActiveItemsIOS: true = Transaction.currentEntitlements */
  currentEntitlements(now: number): FakeTxn[] {
    return this.txns.filter(
      (t) => t.productId !== SINGLE && Number(t.expirationDateIOS ?? 0) > now,
    );
  }
  async finish(p: PurchaseLike, isConsumable: boolean) {
    const id = String(p.transactionId ?? p.id);
    this.finishCalls.push({ id, isConsumable });
    const t = this.txns.find((x) => x.id === id);
    if (t) t.finished = true;
  }
}

// ── Fake backend: apple_verify_purchase_api.php is idempotent per txn ──
class FakeBackend {
  credited = new Map<string, number>(); // txn -> credits
  calls: string[] = [];
  failNext = 0;
  async verify(id: string): Promise<{ action: string }> {
    this.calls.push(id);
    if (this.failNext > 0) {
      this.failNext--;
      throw new Error('Network Error');
    }
    if (this.credited.has(id)) return { action: 'already_processed' };
    this.credited.set(id, 1);
    return { action: 'purchase_queued' };
  }
}

/** One mount of the plans screen = fresh in-memory dedupe sets. */
function session(store: FakeStore, backend: FakeBackend): PurchaseFlowDeps<{ action: string }> {
  return {
    resolveConsumable: resolve,
    processed: new Set<string>(),
    processing: new Set<string>(),
    verify: (id) => backend.verify(id),
    finish: (p, c) => store.finish(p, c),
  };
}

/** What the hook's recovery effect does on connect. */
async function recoveryPass(store: FakeStore, deps: PurchaseFlowDeps<{ action: string }>) {
  const picked = selectUnfinishedConsumables(store.all(), resolve);
  const outcomes = [];
  for (const p of picked) outcomes.push((await processPurchase(p, deps)).outcome);
  return outcomes;
}

console.log('\niapPurchaseFlow - support case 2026-11-26 (paid, never verified)');

test('listener never verified -> next plans visit credits it once and finishes it', async () => {
  const store = new FakeStore();
  const backend = new FakeBackend();
  store.buy('2000000000000001', SINGLE); // Apple charged, app never called verify

  // Old app: 9 more visits, initConnection only stored it, nothing emitted.
  assert.strictEqual(backend.calls.length, 0);

  // New app, next visit: recovery pass.
  const out = await recoveryPass(store, session(store, backend));
  assert.deepStrictEqual(out, ['verified']);
  assert.deepStrictEqual(backend.calls, ['2000000000000001']);
  assert.strictEqual(backend.credited.get('2000000000000001'), 1);
  assert.deepStrictEqual(store.finishCalls, [{ id: '2000000000000001', isConsumable: true }]);

  // Visit after that: finished consumables leave Transaction.all -> no call.
  const again = await recoveryPass(store, session(store, backend));
  assert.deepStrictEqual(again, []);
  assert.strictEqual(backend.calls.length, 1);
});

test('already credited by hand on the server -> recovery gets already_processed and only finishes it', async () => {
  const store = new FakeStore();
  const backend = new FakeBackend();
  store.buy('2000000000000001', SINGLE);
  backend.credited.set('2000000000000001', 1); // the 2026-11-26 manual verify

  const out = await recoveryPass(store, session(store, backend));
  assert.deepStrictEqual(out, ['verified']);
  assert.strictEqual(backend.credited.get('2000000000000001'), 1, 'not credited twice');
  assert.strictEqual(store.finishCalls.length, 1);
  assert.deepStrictEqual(await recoveryPass(store, session(store, backend)), []);
});

test('old Restore (currentEntitlements) never even sees the activation', () => {
  const store = new FakeStore();
  store.buy('2000000000000001', SINGLE);
  assert.deepStrictEqual(store.currentEntitlements(Date.now()), []);
  // New Restore does.
  const picked = selectRestorable(store.all(), resolve, Date.now());
  assert.deepStrictEqual(picked.map((p) => p.id), ['2000000000000001']);
});

console.log('\niapPurchaseFlow - retry on failure');

test('verify fails -> NOT finished, NOT marked processed, retried on the next visit', async () => {
  const store = new FakeStore();
  const backend = new FakeBackend();
  store.buy('T1', SINGLE);
  backend.failNext = 1;

  const deps1 = session(store, backend);
  assert.deepStrictEqual(await recoveryPass(store, deps1), ['verify_failed']);
  assert.strictEqual(store.finishCalls.length, 0, 'must stay unfinished');
  assert.strictEqual(deps1.processed.has('T1'), false);
  assert.strictEqual(deps1.processing.has('T1'), false, 'in-flight flag released');

  assert.deepStrictEqual(await recoveryPass(store, session(store, backend)), ['verified']);
  assert.strictEqual(backend.credited.get('T1'), 1);
  assert.strictEqual(store.finishCalls.length, 1);
});

test('verify fails in the same session -> a second attempt in that session still retries', async () => {
  const store = new FakeStore();
  const backend = new FakeBackend();
  const t = store.buy('T2', SINGLE);
  backend.failNext = 1;
  const deps = session(store, backend);
  assert.strictEqual((await processPurchase(t, deps)).outcome, 'verify_failed');
  assert.strictEqual((await processPurchase(t, deps)).outcome, 'verified');
});

test('finishTransaction throwing does not undo a verified purchase', async () => {
  const store = new FakeStore();
  const backend = new FakeBackend();
  const t = store.buy('T3', SINGLE);
  const logs: unknown[][] = [];
  const deps = {
    ...session(store, backend),
    finish: async () => { throw new Error('finish boom'); },
    log: (...a: unknown[]) => { logs.push(a); },
  };
  const r = await processPurchase(t, deps);
  assert.strictEqual(r.outcome, 'verified');
  assert.strictEqual(deps.processed.has('T3'), true);
  assert.ok(logs.some((l) => String(l[0]).includes('finishTransaction warning')));
});

console.log('\niapPurchaseFlow - dedupe, defer, finish type');

test('same transaction twice in one session -> one verify call', async () => {
  const store = new FakeStore();
  const backend = new FakeBackend();
  const t = store.buy('T4', SINGLE);
  const deps = session(store, backend);
  assert.strictEqual((await processPurchase(t, deps)).outcome, 'verified');
  assert.strictEqual((await processPurchase(t, deps)).outcome, 'already_processed');
  assert.strictEqual(backend.calls.length, 1);
});

test('listener + recovery racing on the same transaction -> second is in_flight, one verify call', async () => {
  const store = new FakeStore();
  const backend = new FakeBackend();
  const t = store.buy('T5', SINGLE);
  const deps = session(store, backend);
  const [a, b] = await Promise.all([processPurchase(t, deps), processPurchase(t, deps)]);
  assert.deepStrictEqual([a.outcome, b.outcome].sort(), ['in_flight', 'verified']);
  assert.strictEqual(backend.calls.length, 1);
});

test('unknown SKU -> deferred: no verify, no finish, not marked; verified once the catalog knows it', async () => {
  const store = new FakeStore();
  const backend = new FakeBackend();
  const t = store.buy('T6', 'com.livio.new.thing');
  const deps = session(store, backend);
  const r = await processPurchase(t, deps);
  assert.strictEqual(r.outcome, 'deferred');
  assert.strictEqual(backend.calls.length, 0);
  assert.strictEqual(store.finishCalls.length, 0);
  assert.strictEqual(deps.processing.has('T6'), false);

  const known = { ...deps, resolveConsumable: (s: string) => (s === 'com.livio.new.thing' ? true : resolve(s)) };
  assert.strictEqual((await processPurchase(t, known)).outcome, 'verified');
});

test('finish gets isConsumable true for the activation, false for a subscription', async () => {
  const store = new FakeStore();
  const backend = new FakeBackend();
  const deps = session(store, backend);
  await processPurchase(store.buy('T7', SINGLE), deps);
  await processPurchase(store.buy('T8', SUB, { expirationDateIOS: Date.now() + 86400000 }), deps);
  assert.deepStrictEqual(store.finishCalls, [
    { id: 'T7', isConsumable: true },
    { id: 'T8', isConsumable: false },
  ]);
});

test('no transaction id -> nothing happens', async () => {
  const store = new FakeStore();
  const backend = new FakeBackend();
  const r = await processPurchase({ productId: SINGLE }, session(store, backend));
  assert.strictEqual(r.outcome, 'no_transaction_id');
  assert.strictEqual(backend.calls.length, 0);
});

test('transaction id falls back transactionId -> id -> transaction_id', async () => {
  const backend = new FakeBackend();
  const store = new FakeStore();
  await processPurchase({ id: 'A1', productId: SINGLE }, session(store, backend));
  await processPurchase({ transaction_id: 'A2', productId: SINGLE }, session(store, backend));
  await processPurchase({ transactionId: 'A3', id: 'ignored', productId: SINGLE }, session(store, backend));
  assert.deepStrictEqual(backend.calls, ['A1', 'A2', 'A3']);
});

test('user-initiated purchase returns the backend result (drives navigation)', async () => {
  const store = new FakeStore();
  const backend = new FakeBackend();
  const r = await processPurchase(store.buy('T9', SINGLE), session(store, backend));
  assert.deepStrictEqual(r.result, { action: 'purchase_queued' });
});

console.log('\niapPurchaseFlow - selection');

test('selectUnfinishedConsumables keeps only consumables (no subs, no unknown SKUs)', () => {
  const list: PurchaseLike[] = [
    { id: 'c1', productId: SINGLE },
    { id: 's1', productId: SUB, expirationDateIOS: Date.now() + 1000 },
    { id: 'u1', productId: 'com.unknown' },
    { id: 'n1' },
  ];
  assert.deepStrictEqual(selectUnfinishedConsumables(list, resolve).map((p) => p.id), ['c1']);
  assert.deepStrictEqual(selectUnfinishedConsumables(null, resolve), []);
  assert.deepStrictEqual(selectUnfinishedConsumables(undefined, resolve), []);
});

test('selectRestorable: consumables + running subscriptions; not expired, unknown or duplicate', () => {
  const now = 1_800_000_000_000;
  const list: PurchaseLike[] = [
    { id: 'c1', productId: SINGLE },
    { id: 's-live', productId: SUB, expirationDateIOS: now + 1 },
    { id: 's-live-str', productId: SUB, expirationDateIOS: String(now + 5000) },
    { id: 's-old', productId: SUB, expirationDateIOS: now - 1 },
    { id: 's-equal', productId: SUB, expirationDateIOS: now },
    { id: 's-none', productId: SUB },
    { id: 's-bad', productId: SUB, expirationDateIOS: 'not-a-date' },
    { id: 'u1', productId: 'com.unknown', expirationDateIOS: now + 1 },
    { id: 'c1', productId: SINGLE },
  ];
  assert.deepStrictEqual(
    selectRestorable(list, resolve, now).map((p) => p.id),
    ['c1', 's-live', 's-live-str'],
  );
});

console.log('\niapPurchaseFlow - one purchase at a time (double charges 2026-10-15 .. 11-11)');

test('double tap: second purchase request is refused while the first is running', () => {
  const gate = { current: false };
  assert.strictEqual(tryBeginPurchase(gate), true, 'first tap starts');
  assert.strictEqual(tryBeginPurchase(gate), false, 'second tap, same frame, refused');
  assert.strictEqual(tryBeginPurchase(gate), false, 'third tap refused');
  assert.strictEqual(gate.current, true);
});

test('after the purchase ends (verified, cancelled or failed) the next purchase can start', () => {
  const gate = { current: false };
  assert.ok(tryBeginPurchase(gate));
  gate.current = false; // what handlePurchase / the error listener do
  assert.ok(tryBeginPurchase(gate));
});

test('replay of the real pattern: Buy tapped twice -> one Apple purchase, one charge, one credit', async () => {
  const store = new FakeStore();
  const backend = new FakeBackend();
  const gate = { current: false };
  const deps = session(store, backend);
  let n = 0;
  const tapBuy = () => {
    if (!tryBeginPurchase(gate)) return null; // hook: requestPurchase
    return store.buy(`T-tap-${n++}`, SINGLE); // Apple sheet -> charge
  };
  const first = tapBuy();
  const second = tapBuy(); // 6-23 s later in the logs, before the first was answered
  assert.ok(first);
  assert.strictEqual(second, null);
  await processPurchase(first!, deps);
  gate.current = false;
  assert.strictEqual(store.txns.length, 1, 'only one charge');
  assert.strictEqual(backend.credited.size, 1);
});

test('already double-charged (old app): the lost second charge is credited on the next visit', async () => {
  const store = new FakeStore();
  const backend = new FakeBackend();
  const first = store.buy('A-first', SINGLE);
  store.buy('A-second', SINGLE); // confirmed after the screen had navigated away
  await processPurchase(first, session(store, backend)); // the one the old app verified
  const out = await recoveryPass(store, session(store, backend));
  assert.deepStrictEqual(out, ['verified']);
  assert.deepStrictEqual([...backend.credited.keys()].sort(), ['A-first', 'A-second']);
});

console.log('\nuseMembershipplans.ts wiring (source checks)');

const hookSrc = fs.readFileSync(path.join(process.cwd(), 'src', 'hooks', 'useMembershipplans.ts'), 'utf8');
const code = hookSrc.replace(/\/\/.*$/gm, ''); // ignore comments

test('Restore + recovery read Transaction.all (onlyIncludeActiveItemsIOS: false), twice', () => {
  const n = (code.match(/getStorePurchases\(\{\s*onlyIncludeActiveItemsIOS:\s*false\s*\}\)/g) ?? []).length;
  assert.strictEqual(n, 2);
});

test('useIAP getAvailablePurchases is no longer used (it never returns a consumable)', () => {
  assert.ok(!/getAvailablePurchases[,\s]*\}\s*=\s*useIAP\(/.test(code));
  assert.ok(!/await getAvailablePurchases\(\)/.test(code));
});

test('recovery runs on connect, iOS only, once per mount, after the catalog is in', () => {
  assert.ok(/Platform\.OS !== "ios"/.test(code));
  // audit #1: any catalog (subscriptions too), not only when an activation is sold
  assert.ok(/!connected \|\| productSkus\.length === 0 \|\| recoveryDoneRef\.current/.test(code));
  assert.ok(/selectRecoverable\(all, resolveConsumable, Date\.now\(\), confirmed(, permanent)?\)/.test(code));
});

test('listener, recovery and Restore all go through handlePurchase -> processPurchase', () => {
  // audit #14: user-initiated only for the SKU being bought
  assert.ok(/purchaseUpdatedListener\(\(purchase: any\) => \{\s*const userInitiated = isUserInitiatedEvent\(awaitingPurchaseRef\.current, pendingSkuRef\.current, purchase\);\s*void handlePurchase\(purchase, userInitiated\)/.test(code));
  assert.ok(/handlePurchase\(purchase, false\)/.test(code));
  assert.ok(/selectRestorable\(all, resolveConsumable, Date\.now\(\)\)/.test(code));
  assert.ok(/processPurchase<VerifyPurchaseResponse>\(purchase,/.test(code));
  // The verify API is called from ONE deps.verify (with retry for the user's own purchase).
  const v = code.slice(code.indexOf('verify: (id) =>'), code.indexOf('finish: (p, isConsumable)'));
  assert.strictEqual((v.match(/appleVerifyService\.verifyPurchase\(/g) ?? []).length, 2);
  assert.strictEqual((code.match(/appleVerifyService\.verifyPurchase\(/g) ?? []).length, 2);
});

test('requestPurchase checks the one-purchase gate before calling StoreKit', () => {
  const i = code.indexOf('const requestPurchase = useCallback(');
  const gate = code.indexOf('tryBeginPurchase(purchaseIntentRef)', i);
  const raw = code.indexOf('rawRequestPurchase(finalParams)', i);
  assert.ok(i > 0 && gate > i && raw > gate, 'gate must come before rawRequestPurchase');
});

test('Restore does not clear awaitingPurchaseRef (would strand the purchase gate)', () => {
  const r = code.slice(code.indexOf('const restorePurchases = useCallback('), code.indexOf('}, [handlePurchase, loadPlans, resolveConsumable]);'));
  assert.ok(r.length > 100, 'restore block found');
  assert.ok(!/awaitingPurchaseRef\.current\s*=/.test(r));
});

test('activation Buy button is disabled while a purchase is starting (purchaseButtonLoading)', () => {
  const screen = fs.readFileSync(path.join(process.cwd(), 'src', 'screens', 'ProfileScreen', 'MembershipPlansScreen.tsx'), 'utf8');
  // 'busy' = purchaseLoading || purchaseButtonLoading (activationBuyBlock)
  assert.ok(/busy: purchaseLoading \|\| purchaseButtonLoading/.test(screen));
  assert.ok(/onPress=\{handleBuyActivation\}[\s\S]{0,900}?disabled=\{activationBlock === 'busy'( \|\| activationBlock === 'checking')?\}/.test(screen));
});

test('native layer is still openiap-apple 2.2.1 (the unfinished-not-emitted behaviour this relies on)', () => {
  const v = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'node_modules', 'expo-iap', 'openiap-versions.json'), 'utf8'),
  );
  assert.strictEqual(v.apple, '2.2.1', 'expo-iap upgraded: re-check processUnfinishedTransactions / Transaction.all');
});


/* ══════════════════════════════════════════════════════════════════════
 *  Payments audit 2026-11-26 (#1 .. #17, app side). Each block fails on
 *  c8b1901: the helpers did not exist and the hook / screen / services did
 *  not do it.
 * ══════════════════════════════════════════════════════════════════════ */
console.log('\npayments audit 2026-11-26 - decisions');

const NOW = Date.UTC(2026, 10, 26);
const YEAR = 365 * 24 * 3600 * 1000;

test('#1 subscription whose verify failed is picked up by the automatic pass (it was consumables only)', async () => {
  const store = new FakeStore();
  const backend = new FakeBackend();
  store.buy('3000000000000001', SUB, { expirationDateIOS: NOW + YEAR }); // charged, verify failed
  // Old pass: never sees it.
  assert.deepStrictEqual(selectUnfinishedConsumables(store.all(), resolve), []);
  // New pass: verifies it once, then remembers it as confirmed.
  const confirmed = new Set<string>();
  const picked = selectRecoverable(store.all(), resolve, NOW, confirmed);
  assert.deepStrictEqual(picked.map((p) => p.id), ['3000000000000001']);
  const flow = await processPurchase(picked[0], session(store, backend));
  assert.strictEqual(flow.outcome, 'verified');
  assert.strictEqual(backend.credited.get('3000000000000001'), 1);
  confirmed.add('3000000000000001');
  assert.deepStrictEqual(selectRecoverable(store.all(), resolve, NOW, confirmed), []);
});

test('#1 the automatic pass skips expired periods, unknown SKUs, and keeps unfinished activations', () => {
  const store = new FakeStore();
  store.buy('a', SUB, { expirationDateIOS: NOW - 1 });
  store.buy('b', 'com.other.app.thing');
  store.buy('c', SINGLE);
  assert.deepStrictEqual(selectRecoverable(store.all(), resolve, NOW, new Set(['c'])).map((p) => p.id), ['c']);
});

test('#12 a period the user upgraded AWAY from is neither restored nor recovered', () => {
  const store = new FakeStore();
  store.buy('basic-1', SUB, { expirationDateIOS: NOW + YEAR, isUpgradedIOS: true });
  store.buy('pro-2', SUB, { expirationDateIOS: NOW + YEAR });
  assert.deepStrictEqual(selectRestorable(store.all(), resolve, NOW).map((p) => p.id), ['pro-2']);
  assert.deepStrictEqual(selectRecoverable(store.all(), resolve, NOW, new Set()).map((p) => p.id), ['pro-2']);
});

test('#2 a transient verify failure is retried in place before anything is shown', async () => {
  const backend = new FakeBackend();
  backend.failNext = 2;
  const slept: number[] = [];
  const r = await verifyWithRetry(() => backend.verify('t1'), [2000, 5000], async (ms) => { slept.push(ms); });
  assert.deepStrictEqual(r, { action: 'purchase_queued' });
  assert.deepStrictEqual(slept, [2000, 5000]);
  assert.strictEqual(backend.calls.length, 3);
});

test('#2 a final server answer is not retried', async () => {
  let calls = 0;
  const err = Object.assign(new Error('unknown_product'), { type: 'empty', code: 'unknown_product' });
  await assert.rejects(
    verifyWithRetry(async () => { calls++; throw err; }, [1, 1], async () => {}),
    /unknown_product/,
  );
  assert.strictEqual(calls, 1);
  assert.strictEqual(isTransientVerifyError({ type: 'network', code: 'network_error' }), true);
  assert.strictEqual(isTransientVerifyError({ type: 'server', code: 'session_expired' }), true);
  assert.strictEqual(isTransientVerifyError({ type: 'empty', code: 'subscription_linked_to_other_account' }), false);
});

test('#2 #4 #16 the activation cannot be bought while one is unconfirmed, pending, or not sold', () => {
  const base = { busy: false, unconfirmed: false, paymentPending: false, action: 'subscribe' };
  assert.strictEqual(activationBuyBlock(base), null);
  assert.strictEqual(activationBuyBlock({ ...base, busy: true }), 'busy');
  assert.strictEqual(activationBuyBlock({ ...base, unconfirmed: true }), 'unconfirmed');
  assert.strictEqual(activationBuyBlock({ ...base, paymentPending: true }), 'pending');
  assert.strictEqual(activationBuyBlock({ ...base, action: 'hidden' }), 'action');
});

test('#3 #11 Restore outcome: queued = pending (not "nothing"), failures = error, other account named', () => {
  const b = { hasActive: false, queued: 0, failed: 0, otherAccount: 0, paymentPending: false };
  assert.strictEqual(restoreOutcome(b), 'none');
  assert.strictEqual(restoreOutcome({ ...b, hasActive: true, failed: 1 }), 'success');
  assert.strictEqual(restoreOutcome({ ...b, queued: 1 }), 'pending');
  assert.strictEqual(restoreOutcome({ ...b, paymentPending: true }), 'pending');
  assert.strictEqual(restoreOutcome({ ...b, failed: 1 }), 'error');
  assert.strictEqual(restoreOutcome({ ...b, otherAccount: 1, failed: 1 }), 'other_account');
  assert.ok(isQueuedAction('purchase_queued') && isQueuedAction('upgrade_queued') && isQueuedAction('renewal_queued'));
  assert.ok(!isQueuedAction('already_processed') && !isQueuedAction('expired'));
});

test('#14 only an event for the SKU being bought is the user\'s purchase', () => {
  assert.strictEqual(isUserInitiatedEvent(true, SINGLE, { id: '1', productId: SINGLE }), true);
  assert.strictEqual(isUserInitiatedEvent(true, SINGLE, { id: '2', productId: SUB }), false);
  assert.strictEqual(isUserInitiatedEvent(false, SINGLE, { id: '3', productId: SINGLE }), false);
  assert.strictEqual(isUserInitiatedEvent(true, null, { id: '4', productId: SUB }), true); // old behaviour
});

test('#5 only a well-formed appAccountToken is passed to StoreKit', () => {
  assert.strictEqual(validAppAccountToken('A1B2C3D4-0000-4000-8000-00000000002A'), 'a1b2c3d4-0000-4000-8000-00000000002a');
  assert.strictEqual(validAppAccountToken(undefined), null);
  assert.strictEqual(validAppAccountToken('42'), null);
});

console.log('\npayments audit 2026-11-26 - wiring (source checks)');

// A missing file reads as '' so each check FAILS on its own (old code had no
// appleIapRecovery.ts / useAppleRecovery.ts) instead of crashing the run.
const read = (...p: string[]) => {
  try {
    return fs.readFileSync(path.join(process.cwd(), 'src', ...p), 'utf8').replace(/\/\/.*$/gm, '');
  } catch {
    return '';
  }
};
const screenCode = read('screens', 'ProfileScreen', 'MembershipPlansScreen.tsx');
const verifySrc = read('services', 'appleverifyservice.ts');
const recoverySrc = read('services', 'appleIapRecovery.ts');

test('#2 verify call waits longer than the 15 s default and the user\'s purchase retries', () => {
  assert.ok(/timeout: VERIFY_TIMEOUT_MS/.test(verifySrc));
  assert.ok(/VERIFY_TIMEOUT_MS = 45000/.test(verifySrc));
  assert.ok(/userInitiated\s*\?\s*verifyWithRetry\(/.test(code));
});

test('#2 a failed verify shows our "charged, do not buy again" copy, not the raw code', () => {
  assert.ok(/setPurchaseError\(code === PURCHASE_OTHER_ACCOUNT \? PURCHASE_OTHER_ACCOUNT : PURCHASE_UNCONFIRMED\)/.test(code));
  assert.ok(/purchaseError === PURCHASE_UNCONFIRMED\s*\?\s*t\('membership:purchase\.unconfirmedBody'\)/.test(screenCode));
  assert.ok(/unconfirmedPayment && \(/.test(screenCode), 'unconfirmed banner');
});

test('#5 the appAccountToken from apple_get_plans is attached to the purchase request', () => {
  assert.ok(/appAccountTokenRef\.current = validAppAccountToken\(data\?\.app_account_token\)/.test(code));
  assert.ok(/apple: \{ \.\.\.apple, appAccountToken: token \}/.test(code));
});

test('#7 an app-level pass exists, shares the dedupe sets and leaves the plans screen\'s connection alone', () => {
  assert.ok(/iapShared\.processed/.test(code) && /iapShared\.processing/.test(code));
  assert.ok(/useEffect\(\(\) => markPlansScreenMounted\(\), \[\]\)/.test(code));
  assert.ok(/if \(plansScreenMounts > 0 \|\| running\) return none;/.test(recoverySrc));
  assert.ok(/if \(opened && plansScreenMounts === 0\)/.test(recoverySrc));
  assert.ok(/selectRecoverable\(all as any\[\], resolve, Date\.now\(\), confirmed(, permanent)?\)/.test(recoverySrc));
  const hook = read('hooks', 'useAppleRecovery.ts');
  assert.ok(/runAppleRecovery\(true\)/.test(hook) && /AppState\.addEventListener/.test(hook));
});

test('#8 an empty requestPurchase result releases the gate after a while; deferred payment is not an error', () => {
  assert.ok(/result == null \|\| \(Array\.isArray\(result\) && result\.length === 0\)/.test(code));
  assert.ok(/purchaseSeqRef\.current !== seq/.test(code));
  assert.ok(/ErrorCode\.DeferredPayment/.test(code));
});

test('#9 the price spinner cannot hold the screen forever', () => {
  assert.ok(/if \(!loadingPlans && productSkus\.length === 0\) setLoadingPrices\(false\)/.test(code));
  assert.ok(/setTimeout\(\(\) => setLoadingPrices\(false\), PRICE_WAIT_MS\)/.test(code));
});

test('#15 Restore refuses to run during a purchase or twice at once, and its button is disabled then', () => {
  assert.ok(/if \(purchaseIntentRef\.current \|\| restoreRunningRef\.current\) return;/.test(code));
  assert.ok(/disabled=\{restoreLoading \|\| purchaseLoading \|\| purchaseButtonLoading\}/.test(screenCode));
});

test('#3 Restore counts queued / failed verifies and reports pending / error / other account', () => {
  assert.ok(/isQueuedAction\(flow\.result\?\.action\)/.test(code));
  assert.ok(/restoreOutcome\(\{/.test(code));
  assert.ok(/restoreResult === "pending"/.test(screenCode) && /restoreResult === "error"/.test(screenCode)
    && /restoreResult === "other_account"/.test(screenCode));
});

test('#4 a paid-but-not-active purchase blocks buying and changes the banner', () => {
  assert.ok(/paymentPending: plansData\?\.entitlement\?\.payment_pending === true/.test(code));
  assert.ok(/if \(paymentPending\) \{\s*Alert\.alert/.test(screenCode));
  assert.ok(/if \(paymentPending\) return t\('membership:infoBanner\.paymentPending'\)/.test(screenCode));
});

test('#16 the activation respects the backend action; #17 the current plan opens Apple\'s manage page', () => {
  assert.ok(/action: singlePlan\?\.action/.test(screenCode));
  assert.ok(/activationBlock === 'action'/.test(screenCode));
  assert.ok(/apiPlan\.action === 'current'\) \{\s*Linking\.openURL\(MANAGE_SUBSCRIPTIONS_URL\)/.test(screenCode));
});

test('every new Membership string exists in en, fr and nl', () => {
  const keys = ['infoBanner.paymentPending', 'restorePending.title', 'restorePending.message',
    'restoreOtherAccount.title', 'restoreOtherAccount.message', 'purchase.unconfirmedBody',
    'purchase.otherAccountBody', 'unconfirmed.title', 'unconfirmed.message', 'unconfirmed.banner',
    'unconfirmed.retry', 'paymentPending.title', 'paymentPending.message', 'pendingApproval.title',
    'pendingApproval.message'];
  const files = ['en', 'fr', 'nl'].map((l) =>
    JSON.parse(fs.readFileSync(path.join(process.cwd(), 'src', 'i18n', 'Membership', `${l}.json`), 'utf8')));
  for (const k of keys) {
    const vals = files.map((f) => k.split('.').reduce((o: any, x) => o?.[x], f));
    assert.ok(vals.every((v) => typeof v === 'string' && v.length > 0), `missing ${k}`);
    assert.ok(vals[0] !== vals[1] && vals[0] !== vals[2], `${k} not translated`);
  }
  for (const k of keys) assert.ok(new RegExp(`membership:${k.replace('.', '\\.')}`).test(screenCode), `${k} not used`);
});


/* ══════════════════════════════════════════════════════════════════════
 *  Re-audit 2026-11-26 (PN1, PN3 .. PN8, app side). Each fails on the code
 *  before this round (scratchpad before_reaudit).
 * ══════════════════════════════════════════════════════════════════════ */
console.log('\nre-audit 2026-11-26 - decisions');

test('PN1 a paid, uncredited activation StoreKit still holds blocks Buy (read from StoreKit, not memory)', () => {
  const store = new FakeStore();
  store.buy('p1', SINGLE);
  store.buy('p2', SINGLE, { finished: true });       // credited + finished: not open
  store.buy('p3', SINGLE);                            // refused for good: not a payment we confirm
  store.buy('s1', SUB, { expirationDateIOS: NOW + YEAR });
  assert.deepStrictEqual(openPaidConsumables(store.all(), resolve, new Set(['p3'])), ['p1']);
  const base = { busy: false, unconfirmed: false, paymentPending: false, action: 'subscribe' };
  assert.strictEqual(activationBuyBlock({ ...base, checking: true }), 'checking');
  assert.strictEqual(activationBuyBlock({ ...base, checking: true, unconfirmed: true }), 'unconfirmed');
  assert.strictEqual(activationBuyBlock({ ...base, checking: false }), null);
});

test('PN3 a transaction the server refused for good is not re-verified by the automatic passes', () => {
  const store = new FakeStore();
  store.buy('o1', SUB, { expirationDateIOS: NOW + YEAR });   // another account's subscription
  store.buy('o2', SINGLE);                                   // unknown_product
  assert.deepStrictEqual(selectRecoverable(store.all(), resolve, NOW, new Set(), new Set(['o1', 'o2'])), []);
  // Restore (the user asking) still tries them.
  assert.deepStrictEqual(selectRestorable(store.all(), resolve, NOW).map((p) => p.id).sort(), ['o1', 'o2']);
});

test('PN7 Restore that credited ANOTHER account says so (not "being activated", not "nothing")', () => {
  const b = { hasActive: false, queued: 0, failed: 0, otherAccount: 0, paymentPending: false };
  assert.strictEqual(restoreOutcome({ ...b, creditedOther: 1 }), 'credited_other_account');
  assert.strictEqual(restoreOutcome({ ...b, creditedOther: 1, queued: 1 }), 'pending');
});

test('PN8 one deadline across all verify attempts: a hanging verify gives up at the deadline, not after ~142 s', async () => {
  let clock = 0;
  let calls = 0;
  const sleepFake = async (ms: number) => { clock += ms; };
  const hang = () => { calls++; return new Promise<never>(() => {}); };
  // A real 2 s guard: the old code awaited the hanging call forever.
  const guard = new Promise<never>((_, rej) => setTimeout(() => rej(new Error('still waiting - no deadline')), 2000));
  await assert.rejects(
    Promise.race([
      verifyWithRetry(hang, [2000, 5000], sleepFake, { deadlineMs: 40000, now: () => clock, timer: sleepFake } as any),
      guard,
    ]),
    (e: any) => e?.code === 'network_error',
  );
  assert.strictEqual(calls, 1, 'no retry after the deadline is used up');
  assert.ok(clock <= 40000, `waited ${clock} ms`);
});

test('PN8 fast transient failures still retry within the deadline', async () => {
  let clock = 0;
  const backend = new FakeBackend();
  backend.failNext = 2;
  const r = await verifyWithRetry(() => backend.verify('d1'), [2000, 5000], async (ms) => { clock += ms; },
    { deadlineMs: 40000, now: () => clock, timer: () => new Promise<void>(() => {}) });
  assert.deepStrictEqual(r, { action: 'purchase_queued' });
  assert.strictEqual(backend.calls.length, 3);
});

console.log('\nre-audit 2026-11-26 - wiring (source checks)');

test('PN1 the unconfirmed block is persisted, restored on mount, rebuilt from StoreKit, and shared with the app-level pass', () => {
  assert.ok(/void setUnconfirmedTxn\(id, on\)/.test(code), 'markUnconfirmed persists');
  assert.ok(/loadUnconfirmedTxns\(\)\.then\(/.test(code), 'restored on mount');
  assert.ok(/open\.forEach\(\(id\) => markUnconfirmed\(id, true\)\)/.test(code), 'rebuilt from StoreKit');
  assert.ok(/checking: checkingStore/.test(screenCode), 'Buy waits for the StoreKit check');
  assert.ok(/setUnconfirmedTxn\(id, true\)/.test(recoverySrc) && /setUnconfirmedTxn\(flow\.transactionId, false\)/.test(recoverySrc));
});

test('PN3 permanent refusals are remembered and skipped by both automatic passes', () => {
  assert.ok(/selectRecoverable\(all, resolveConsumable, Date\.now\(\), confirmed, permanent\)/.test(code));
  assert.ok(/selectRecoverable\(all as any\[\], resolve, Date\.now\(\), confirmed, permanent\)/.test(recoverySrc));
  assert.ok(/rememberPermanentFailTxn\(flow\.transactionId\)/.test(code) && /rememberPermanentFailTxn\(flow\.transactionId\)/.test(recoverySrc));
});

test('PN4 payment_pending is refreshed on foreground and while pending', () => {
  assert.ok(/if \(s === "active"\) void loadPlans\(true\)/.test(code));
  assert.ok(/setInterval\(\(\) => void loadPlans\(true\), PENDING_POLL_MS\)/.test(code));
});

test('PN5 the screen reloads when a purchase is credited outside the user\'s own flow', () => {
  assert.ok(/if \(!userInitiated && flow\.outcome === "verified"\) void loadPlans\(true\)/.test(code));
  assert.ok(/onRecoveryCredited\(\(\) => void loadPlans\(true\)\)/.test(code));
  assert.ok(/notifyCredited\(\)/.test(recoverySrc));
});

test('PN6 "Check again now" shows progress and answers', () => {
  assert.ok(/onPress=\{handleRetryUnconfirmed\}/.test(screenCode));
  assert.ok(/retryingUnconfirmed \? \(\s*<ActivityIndicator/.test(screenCode));
  assert.ok(/membership:unconfirmed\.retryStillTitle/.test(screenCode) && /membership:unconfirmed\.retryDoneTitle/.test(screenCode));
});

test('PN7 the user is told when the purchase went to the account it was bought for', () => {
  assert.ok(/flow\.result\?\.action === PURCHASE_CREDITED_OTHER/.test(code));
  assert.ok(/restoreResult === "credited_other_account"/.test(screenCode));
  assert.ok(/purchaseError === PURCHASE_CREDITED_OTHER/.test(screenCode));
});

test('PN8 the user\'s purchase verify uses the single deadline', () => {
  assert.ok(/deadlineMs: VERIFY_DEADLINE_MS/.test(code));
  assert.ok(/VERIFY_DEADLINE_MS = 40000/.test(code));
});

test('every re-audit Membership string exists in en, fr and nl', () => {
  const keys = ['unconfirmed.retryDoneTitle', 'unconfirmed.retryDoneMessage', 'unconfirmed.retryStillTitle',
    'unconfirmed.retryStillMessage', 'restoreCreditedOther.title', 'restoreCreditedOther.message', 'purchase.creditedOtherBody'];
  const files = ['en', 'fr', 'nl'].map((l) =>
    JSON.parse(fs.readFileSync(path.join(process.cwd(), 'src', 'i18n', 'Membership', `${l}.json`), 'utf8')));
  for (const k of keys) {
    const vals = files.map((f) => k.split('.').reduce((o: any, x) => o?.[x], f));
    assert.ok(vals.every((v) => typeof v === 'string' && v.length > 0), `missing ${k}`);
    assert.ok(vals[0] !== vals[1] && vals[0] !== vals[2], `${k} not translated`);
    assert.ok(new RegExp(`membership:${k.replace('.', '\\.')}`).test(screenCode), `${k} not used`);
  }
});

Promise.all(pending).then(() => {
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
});
