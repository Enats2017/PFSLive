#!/usr/bin/env node
// Which DATA FIELDS did the redesign stop rendering?
//
//   node scripts/field-loss-check.mjs [--selftest]
//
// data-loss-check tracks i18n keys — the labels. This tracks the VALUES: every
// `item.x` / `raceInfo.x` / `profile.x` / `runnerInfo.x` a file read before the
// redesign, against what it reads now. A field that vanished is either a
// deliberate de-duplication or a value the screen quietly stopped showing.
//
// NOTE: the pattern is built with String.raw on purpose. Writing `\\b` through a
// shell heredoc collapses it to a literal backspace, which silently matches
// nothing — this file reported "0 fields lost" for exactly that reason once.
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const OBJECTS = ['item', 'raceInfo', 'runnerInfo', 'profile', 'participant', 'cp'];
const PATTERN = String.raw`\b(?:OBJ)\??\.([A-Za-z_][A-Za-z0-9_]*)\b`
  .replace('OBJ', OBJECTS.join('|'));

// Accessors that are plumbing or navigation, not displayed data.
const PLUMBING = new Set([
  'map', 'filter', 'length', 'forEach', 'some', 'every', 'find', 'includes', 'slice',
  'sort', 'reduce', 'push', 'join', 'trim', 'toString', 'then', 'catch', 'current',
  'value', 'labelKey', 'indexOf', 'split', 'replace', 'toFixed', 'padStart', 'key',
  'params', 'navigate', 'goBack', 'toLowerCase', 'toUpperCase', 'charAt', 'concat',
]);

export function fieldsOf(src) {
  // Strip string literals first. An i18n key like t('raceInfo.overallRanking')
  // is indistinguishable from a field read, and a real field access never sits
  // inside a quoted string — so dropping them removes the whole false-positive class.
  // Comments FIRST. An apostrophe in ordinary prose — "the women's rows" —
  // opens a phantom string literal for the stripper below, which then swallows
  // the real code after it and reports its fields as lost. Three fields were
  // wrongly flagged that way by a comment written moments earlier.
  const body = src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""');
  const out = new Set();
  for (const m of body.matchAll(new RegExp(PATTERN, 'g'))) {
    if (!PLUMBING.has(m[1])) out.add(m[1]);
  }
  return out;
}

if (process.argv.includes('--selftest')) {
  const before = fieldsOf('<Text>{item.nation_flag}</Text><Text>{item.age}</Text>{item.map(x=>x)}');
  const after = fieldsOf('<Text>{item.age}</Text>');
  const lost = [...before].filter((f) => !after.has(f));
  const ok1 = lost.length === 1 && lost[0] === 'nation_flag';
  const ok2 = !before.has('map');
  const ok3 = fieldsOf('{raceInfo?.wave}').has('wave');   // optional chaining
  const ok4 = !fieldsOf("t('raceInfo.overallRanking')").has('overallRanking');  // i18n key, not data
  // an apostrophe in prose must not swallow the code after it
  const ok5 = fieldsOf("{/* the women's rows */}<Text>{item.club}</Text>").has('club');
  console.log(`  ${ok1 ? 'PASS' : 'FAIL'}  detects a dropped field (${lost.join(',') || 'none'})`);
  console.log(`  ${ok2 ? 'PASS' : 'FAIL'}  ignores array plumbing`);
  console.log(`  ${ok3 ? 'PASS' : 'FAIL'}  reads through optional chaining`);
  console.log(`  ${ok4 ? 'PASS' : 'FAIL'}  ignores i18n keys that look like fields`);
  console.log(`  ${ok5 ? 'PASS' : 'FAIL'}  an apostrophe in a comment does not hide real fields`);
  const ok = ok1 && ok2 && ok3 && ok4 && ok5;
  console.log(ok ? '\nself-test passed' : '\nSELF-TEST FAILED');
  process.exit(ok ? 0 : 1);
}


// Baseline to compare against. Defaults to HEAD, which is the right answer
// while the work is still uncommitted. Once it is COMMITTED the tree is clean
// and HEAD makes this check vacuous - it reports 0 by construction, not by
// verification. Pass the branch base instead:
//   node scripts/field-loss-check.mjs <ref>
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

console.log('\nData fields the redesign stopped rendering');
console.log('──────────────────────────────────────────');
console.log('  Each is a judgement call: a de-duplicated value, or one to put back.\n');

let total = 0;
for (const file of changed) {
  const before = showAt(file);
  if (before === null) continue;
  let after;
  try {
    after = readFileSync(file, 'utf8');
  } catch { continue; } // deleted since BASE
  const now = fieldsOf(after);
  const lost = [...fieldsOf(before)].filter((f) => !now.has(f)).sort();
  if (lost.length) {
    total += lost.length;
    console.log(`  ${file}`);
    console.log(`      ${lost.join(', ')}`);
  }
}
console.log(`\n  ${total} field(s) no longer read across ${changed.length} changed screens.`);
