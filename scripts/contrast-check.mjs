#!/usr/bin/env node
// Does every OUTLINED / LIGHT button carry a readable label?
//
//   node scripts/contrast-check.mjs [--selftest]
//
// A shared button style was changed from filled navy to outlined white, but one
// of its two consumers still used the white label style — white on white, and
// invisible on the screen. Nothing caught it: every colour is a token, the
// radius is on scale, the label renders and the string exists. Only the PAIRING
// of background and label was wrong, and no check looked at pairs.
//
// So: any file using a light-background button style must also use that style's
// matching *Text style, and never a light-on-light one.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

/** light-background button style -> the label style it requires */
export const PAIRS = {
  routeButton: 'routeButtonText',
  cardActionSecondary: 'cardActionSecondaryText',
  outlineButton: 'outlineButtonText',
  limeButton: 'limeButtonText',
};

/** Label styles that render LIGHT text — fatal on a light button. */
const LIGHT_TEXT = [
  'primaryButtonText',
  'resultsButtonText',
  'cardActionPrimaryText',
  'activeTabText',
];

export function findMismatch(src) {
  const bad = [];
  for (const [btn, want] of Object.entries(PAIRS)) {
    if (!src.includes(btn)) continue;
    if (src.includes(want)) continue;          // correct pair present
    for (const light of LIGHT_TEXT) {
      if (src.includes(light)) bad.push(`${btn} + ${light}`);
    }
  }
  return bad;
}

if (process.argv.includes('--selftest')) {
  const ok1 = findMismatch('style={s.routeButton}><Text style={c.primaryButtonText}>').length === 1;
  const ok2 = findMismatch('style={s.routeButton}><Text style={s.routeButtonText}>').length === 0;
  const ok3 = findMismatch('<Text style={c.primaryButtonText}>').length === 0;  // no light button
  console.log(`  ${ok1 ? 'PASS' : 'FAIL'}  catches a light label on a light button`);
  console.log(`  ${ok2 ? 'PASS' : 'FAIL'}  quiet when the pair matches`);
  console.log(`  ${ok3 ? 'PASS' : 'FAIL'}  quiet when there is no light button`);
  const ok = ok1 && ok2 && ok3;
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
})(join(ROOT, 'src'));

console.log('\nButton / label contrast');
console.log('───────────────────────\n');
let total = 0;
for (const f of files) {
  const bad = findMismatch(readFileSync(f, 'utf8'));
  if (bad.length) {
    total += bad.length;
    console.log(`  ${relative(ROOT, f)}`);
    for (const b of bad) console.log(`      ${b}`);
  }
}
console.log(`\n  ${total} light-on-light button label(s).`);
