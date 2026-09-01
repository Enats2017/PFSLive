#!/usr/bin/env node
// Does every screen reserve the bottom safe area?
//
//   node scripts/safearea-check.mjs [--selftest]
//
// bottomNav.styles.ts states the contract explicitly: "The bottom safe-area
// inset is owned by the screen's SafeAreaView, not here — adding it in both
// places double-pads." Seventeen screens opted out with `edges={[]}`, so nobody
// supplied it and the last row (or the nav bar itself) sat under the Android
// gesture bar. A screen that renders a bottom nav or a fixed footer MUST take
// the bottom edge, because nothing below it will.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

export function offenders(src) {
  const bad = [];
  // An explicitly empty edges array reserves nothing on any side.
  if (/edges=\{\[\]\}/.test(src)) bad.push("edges={[]} — reserves no safe area at all");
  // The same hole written as a ternary: the landscape branch reserves
  // left/right and the PORTRAIT branch reserves nothing. Portrait is the normal
  // case and the one where the bottom inset actually matters — this shape hid
  // in 13 screens because the check only looked for the literal empty array.
  if (/edges=\{[^}]*\?[^}]*:\s*\[\]\}/.test(src)) {
    bad.push('edges ternary with an empty portrait branch');
  }
  // A non-empty array that omits bottom, on a screen that has a bottom nav.
  for (const m of src.matchAll(/edges=\{\[([^\]]*)\]\}/g)) {
    const list = m[1];
    if (list.trim() === '') continue;                   // already reported above
    if (!/bottom/.test(list) && /BottomNavigation/.test(src)) {
      bad.push(`edges omits 'bottom' on a screen with a bottom nav`);
    }
  }
  return [...new Set(bad)];
}

if (process.argv.includes('--selftest')) {
  const ok1 = offenders('<SafeAreaView edges={[]}>').length === 1;
  const ok2 = offenders("<SafeAreaView edges={['bottom']}>").length === 0;
  const ok3 = offenders("<SafeAreaView edges={['top']}><BottomNavigation/>").length === 1;
  const ok5 = offenders("edges={land ? ['left','right'] : []}").length === 1;
  const ok6 = offenders("edges={land ? ['left','right'] : ['bottom']}").length === 0;
  const ok4 = offenders("<SafeAreaView edges={['top','bottom']}><BottomNavigation/>").length === 0;
  console.log(`  ${ok1 ? 'PASS' : 'FAIL'}  catches an empty edges array`);
  console.log(`  ${ok2 ? 'PASS' : 'FAIL'}  quiet when bottom is reserved`);
  console.log(`  ${ok3 ? 'PASS' : 'FAIL'}  catches a bottom nav with no bottom edge`);
  console.log(`  ${ok4 ? 'PASS' : 'FAIL'}  quiet when both are present`);
  console.log(`  ${ok5 ? 'PASS' : 'FAIL'}  catches an empty portrait branch in a ternary`);
  console.log(`  ${ok6 ? 'PASS' : 'FAIL'}  quiet when the portrait branch reserves bottom`);
  const ok = ok1 && ok2 && ok3 && ok4 && ok5 && ok6;
  console.log(ok ? '\nself-test passed' : '\nSELF-TEST FAILED');
  process.exit(ok ? 0 : 1);
}

const files = [];
(function walk(dir) {
  for (const e of readdirSync(dir)) {
    const full = join(dir, e);
    if (statSync(full).isDirectory()) walk(full);
    else if (full.endsWith('.tsx')) files.push(full);
  }
})(join(ROOT, 'src/screens'));

console.log('\nBottom safe area');
console.log('────────────────\n');
let total = 0;
for (const f of files) {
  const bad = offenders(readFileSync(f, 'utf8'));
  if (bad.length) {
    total += bad.length;
    console.log(`  ${relative(ROOT, f)}`);
    for (const b of bad) console.log(`      ${b}`);
  }
}
console.log(`\n  ${total} screen(s) not reserving the bottom inset.`);
