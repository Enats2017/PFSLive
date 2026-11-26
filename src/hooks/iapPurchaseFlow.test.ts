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
  assert.ok(/!connected \|\| inAppSkus\.length === 0 \|\| recoveryDoneRef\.current/.test(code));
  assert.ok(/selectUnfinishedConsumables\(all, resolveConsumable\)/.test(code));
});

test('listener, recovery and Restore all go through handlePurchase -> processPurchase', () => {
  assert.ok(/purchaseUpdatedListener\(\(purchase: any\) => \{\s*void handlePurchase\(purchase, awaitingPurchaseRef\.current\)/.test(code));
  assert.ok(/handlePurchase\(purchase, false\)/.test(code));
  assert.ok(/selectRestorable\(all, resolveConsumable, Date\.now\(\)\)/.test(code));
  assert.ok(/processPurchase<VerifyPurchaseResponse>\(purchase,/.test(code));
  // Only one place calls the verify API.
  assert.strictEqual((code.match(/appleVerifyService\.verifyPurchase\(/g) ?? []).length, 1);
});

test('native layer is still openiap-apple 2.2.1 (the unfinished-not-emitted behaviour this relies on)', () => {
  const v = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'node_modules', 'expo-iap', 'openiap-versions.json'), 'utf8'),
  );
  assert.strictEqual(v.apple, '2.2.1', 'expo-iap upgraded: re-check processUnfinishedTransactions / Transaction.all');
});

Promise.all(pending).then(() => {
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
});
