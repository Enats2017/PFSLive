/**
 * Tests for membershipPlanTiers.ts. Run: npm run test:plan-tiers
 *
 * Livio Pro and Livio Unlimited left sale on 2026-11-10: apple_get_plans_api.php
 * stops returning their tiers (oc_membership.sale_disabled = 1). The plans
 * screen must HIDE them - no subscription cards, no "Continue with" bar, no
 * "Just one race?" divider, no yearly-renewal note - and change no text.
 *
 * No test framework in this repo - plain asserts, exit code 1 on failure.
 */
import assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { visibleSubscriptionTiers } from './membershipPlanTiers';

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  PASS  ${name}`);
  } catch (e) {
    failed++;
    console.log(`  FAIL  ${name}\n        ${(e as Error).message}`);
  }
}

const plan = (tier: string, rank: number) => ({ tier, rank });
const root = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(root, rel), 'utf8');

console.log('== visible subscription tiers ==');

test('only the single activation returned -> no subscription cards (no fallback)', () => {
  assert.deepStrictEqual(visibleSubscriptionTiers([plan('single', 4)]), []);
});
test('empty catalog -> no cards', () => {
  assert.deepStrictEqual(visibleSubscriptionTiers([]), []);
});
test('no data yet -> no cards', () => {
  assert.deepStrictEqual(visibleSubscriptionTiers(null), []);
});
test('plans back on sale -> drawn in rank order, single left out', () => {
  assert.deepStrictEqual(
    visibleSubscriptionTiers([plan('single', 4), plan('basic', 2), plan('pro', 1)]),
    ['pro', 'basic'],
  );
});
test('an unknown tier is never drawn', () => {
  assert.deepStrictEqual(visibleSubscriptionTiers([plan('gold', 0)]), []);
});

console.log('== the hook and the screen hide, and only hide ==');

test('the hook no longer falls back to PLAN_IDS', () => {
  const src = read('src/hooks/useMembershipplans.ts');
  assert.ok(!/returned\.length > 0 \? returned : PLAN_IDS/.test(src), 'fallback still present');
  assert.ok(src.includes('visibleSubscriptionTiers('), 'hook does not use visibleSubscriptionTiers');
});
test('an empty catalog clears the price spinner', () => {
  const src = read('src/hooks/useMembershipplans.ts');
  assert.ok(/plansData && productSkus\.length === 0\) setLoadingPrices\(false\)/.test(src), 'no empty-catalog guard');
});
test('the CTA bar, the divider and the yearly note are gated on subscriptions', () => {
  const src = read('src/screens/ProfileScreen/MembershipPlansScreen.tsx');
  assert.ok(/\{sellsSubscriptions && \(\s*<View style=\{\[styles\.ctaWrapper/.test(src), 'CTA bar not gated');
  assert.ok(/\{sellsSubscriptions && \(\s*<Text style=\{styles\.footerNote\}/.test(src), 'footer note not gated');
  assert.ok(/\{sellsSubscriptions && \(\s*<View style=\{styles\.activationDivider\}/.test(src), 'divider not gated');
});
test('restore purchases and the subscription info stay for existing subscribers', () => {
  const src = read('src/screens/ProfileScreen/MembershipPlansScreen.tsx');
  assert.ok(/onPress=\{restorePurchases\}/.test(src), 'restore button gone');
  assert.ok(/\{t\('membership:subscriptionInfo'\)\}/.test(src), 'subscription info gone');
});
test('no new text: the screen asks only for keys that already exist', () => {
  const src = read('src/screens/ProfileScreen/MembershipPlansScreen.tsx');
  const en = JSON.parse(read('src/i18n/Membership/en.json').replace(/^﻿/, ''));
  const keys = Array.from(src.matchAll(/t\('membership:([A-Za-z0-9_.]+)'/g)).map((m) => m[1]);
  assert.ok(keys.length > 10, 'found too few keys to be meaningful');
  for (const k of keys) {
    const v = k.split('.').reduce((o: any, p) => (o ? o[p] : undefined), en);
    assert.ok(v !== undefined, `unknown key membership:${k}`);
  }
});
test('no i18n file differs from master (git)', () => {
  let out = '';
  try {
    out = execSync('git diff --name-only master -- src/i18n', { cwd: root, encoding: 'utf8' });
  } catch (e) {
    // no git here (e.g. a copied tree): nothing to compare against
    return;
  }
  assert.strictEqual(out.trim(), '', 'changed: ' + out.trim());
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
