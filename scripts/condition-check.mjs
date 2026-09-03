#!/usr/bin/env node
// Did the redesign drop any SHOW/HIDE rule?
//
//   node scripts/condition-check.mjs [--selftest]
//
// Screens hide things for good reasons: UTMB index only when the event has one,
// a Follow button only when there is someone to follow, a results button only
// once results exist. Restructuring a screen can silently delete a guard, and
// the result always renders — which looks fine on the one event you test with
// and wrong on every other.
//
// This extracts each file's JSX guards at git HEAD and compares them with now.
// A guard that vanished is a rule that no longer applies. Judgement is still
// required: some were removed on purpose.
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

/** `{cond && (`, `{cond ? `, and `cond ? x : y` inside JSX props. */
const GUARD = /\{\s*([^{}]{2,90}?)\s*&&\s*\(/g;
const TERNARY = /\{\s*([^{}?]{2,70}?)\s*\?\s/g;

// A ternary inside a style object — `{ borderWidth: 0.5, borderColor: isLive ? …`
// — is not a show/hide rule, and reporting it buries the ones that are.
const NOISE = /^(true|false|\d+|''|""|\s*)$/;
const STYLE_FRAGMENT = /^[[{]|:\s|,\s*[a-zA-Z]+:/;

export function guardsOf(src) {
  // Comments first — prose apostrophes otherwise open phantom strings.
  const body = src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
  const out = new Set();
  for (const re of [GUARD, TERNARY]) {
    for (const m of body.matchAll(re)) {
      const g = m[1].replace(/\s+/g, ' ').trim();
      if (!NOISE.test(g) && !STYLE_FRAGMENT.test(g)) out.add(g);
    }
  }
  return out;
}

if (process.argv.includes('--selftest')) {
  const before = guardsOf('{showUtmbIndex && hasUtmbIndex && (<X/>)}{isLive ? <A/> : <B/>}');
  const after = guardsOf('{isLive ? <A/> : <B/>}');
  const lost = [...before].filter((g) => !after.has(g));
  const ok1 = lost.length === 1 && lost[0].includes('showUtmbIndex');
  const ok2 = guardsOf("{/* it's fine */}{cond && (<X/>)}").has('cond');
  const ok3 = !guardsOf('{true && (<X/>)}').has('true');
  const ok4 = guardsOf('{[a, isLive ? 1 : 2]}').size === 0;   // style fragment, not a rule
  console.log(`  ${ok1 ? 'PASS' : 'FAIL'}  detects a dropped guard (${lost.join(' | ') || 'none'})`);
  console.log(`  ${ok2 ? 'PASS' : 'FAIL'}  an apostrophe in a comment does not hide guards`);
  console.log(`  ${ok3 ? 'PASS' : 'FAIL'}  ignores constant guards`);
  console.log(`  ${ok4 ? 'PASS' : 'FAIL'}  ignores ternaries inside style objects`);
  const ok = ok1 && ok2 && ok3 && ok4;
  console.log(ok ? '\nself-test passed' : '\nSELF-TEST FAILED');
  process.exit(ok ? 0 : 1);
}


// Baseline to compare against. Defaults to HEAD, which is the right answer
// while the work is still uncommitted. Once it is COMMITTED the tree is clean
// and HEAD makes this check vacuous - it reports 0 by construction, not by
// verification. Pass the branch base instead:
//   node scripts/condition-check.mjs <ref>
// The redesign baseline is f471d86 (the commit design_newv0.2 forked from).
const BASE = process.argv.slice(2).find((a) => !a.startsWith('--')) || 'HEAD';

// `git show` writes "fatal: path ... exists on disk, but not in <ref>" to
// stderr for every file added since BASE, and `git diff` warns about line
// endings. Both are expected, not errors, so keep stderr out of the report.
const QUIET = { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] };
const showAt = (file) => {
  try {
    return execSync(`git show ${BASE}:"${file}"`, QUIET);
  } catch {
    return null; // added since BASE - nothing to lose
  }
};

const changed = execSync(`git diff --name-only ${BASE} -- "src/**/*.tsx"`, QUIET)
  .split('\n').map((s) => s.trim()).filter(Boolean);

console.log('\nShow/hide rules the redesign dropped');
console.log('────────────────────────────────────');
console.log('  A guard present before and gone now. Some were deliberate —');
console.log('  each still needs a human call.\n');

let total = 0;
for (const file of changed) {
  const before = showAt(file);
  if (before === null) continue;
  let after;
  try {
    after = readFileSync(file, 'utf8');
  } catch { continue; } // deleted since BASE
  const now = guardsOf(after);
  const lost = [...guardsOf(before)].filter((g) => !now.has(g));
  if (lost.length) {
    total += lost.length;
    console.log(`  ${file}`);
    for (const g of lost) console.log(`      ${g}`);
  }
}
console.log(`\n  ${total} guard(s) no longer present across ${changed.length} changed screens.`);
