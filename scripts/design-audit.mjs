#!/usr/bin/env node
// Design-token conformance audit.
//
//   node scripts/design-audit.mjs          # summary
//   node scripts/design-audit.mjs --list   # every offending line
//   node scripts/design-audit.mjs --selftest
//
// --selftest asserts each check fires on a known-bad line and stays quiet on a
// token-conforming one — including the CRLF case, where a trailing \r used to
// defeat the comment strip and turn every documented old value into a "finding".
//
// Reports where src/ still bypasses the token layer in src/styles/common.styles.ts.
// This is a progress meter for the redesign migration, not a gate — it exits 0
// unless --strict is passed, so it can run in CI once the count reaches zero.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const SRC = join(ROOT, 'src');

// The token layer itself is allowed to name raw values — that is its job.
const EXEMPT = new Set([
  join('src', 'styles', 'common.styles.ts'),
]);

// Structural checks run per style block rather than per line, since a font size
// and its family live on different lines of the same object.
const BLOCK_CHECKS = [
  {
    name: 'fontSize without a font family',
    // Nothing set fontFamily before the redesign, so Poppins and Inter loaded at
    // startup but never actually rendered. A size with no family is that bug.
    test: (b) => /fontSize:/.test(b) && !/fontFamily/.test(b) && !/\.\.\.type\./.test(b),
  },
  { name: 'hand-rolled shadow', test: (b) => /shadowOpacity:/.test(b) },
  { name: 'raw fontWeight', test: (b) => /fontWeight:/.test(b) },
  {
    // The deck's page gutter is 20 everywhere; 12 was the old app's.
    name: 'page gutter off the scale',
    test: (b) => /paddingHorizontal:\s*(?:spacing\.md|10\b|12\b|14\b|15\b)/.test(b),
  },
  {
    name: 'card gap off the scale',
    test: (b) => /marginBottom:\s*(?:6\b|10\b|14\b|18\b)/.test(b),
  },
  {
    // The approved ramp. Compare the captured number rather than relying on
    // a lookahead, which is what broke here.
    name: 'font size off the ramp',
    test: (b) => {
      const m = b.match(/fontSize:\s*([\d.]+)/);
      return !!m && !['10', '11', '12', '13', '15', '20', '26', '40'].includes(m[1]);
    },
  },
  {
    // A radius taken from the SPACING scale (borderRadius: spacing.sm) is not a
    // literal, so the off-scale check below cannot see it.
    name: 'radius from the spacing scale',
    test: (b) => /borderRadius:\s*(?:spacing|space)\./.test(b),
  },
  {
    name: 'off-scale radius',
    test: (b) => {
      const m = b.match(/borderRadius:\s*(\d+)/);
      if (!m) return false;
      const r = Number(m[1]);
      if (r <= 4 || [10, 14, 16].includes(r)) return false;
      // A circle's radius is half its side — legitimately outside the scale.
      const w = b.match(/width:\s*(\d+)/);
      const h = b.match(/height:\s*(\d+)/);
      if (w && h && w[1] === h[1] && Math.abs(r - Number(w[1]) / 2) < 1) return false;
      return true;
    },
  },
];

const CHECKS = [
  { name: 'hex colours', re: /#[0-9a-fA-F]{3,8}\b/g },
  { name: 'legacy blue accent', re: /colors\.accent\b/g },
  { name: 'old lime', re: /#[dD]5[dD][aA]28/g },
  { name: 'rainbow gradient', re: /#e8341a/gi },
];

// A line with its comments removed. The \r strip is load-bearing: see the note
// on the split below.
const stripComments = (line) =>
  line.replace(/\r$/, '').replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '');

if (process.argv.includes('--selftest')) {
  const fires = (line) => {
    const code = stripComments(line);
    return CHECKS.some((c) => code.match(c.re));
  };
  const cases = [
    ['fires on a raw hex',              () => fires("  backgroundColor: '#ff0000',"), true],
    ['fires on a raw hex under CRLF',   () => fires("  backgroundColor: '#ff0000',\r"), true],
    ['fires on colors.accent',          () => fires('  tint: colors.accent,'), true],
    ['fires on code with a comment after', () => fires("  c: '#ff0000', // keep\r"), true],
    ['quiet on a hex in a trailing comment', () => fires('  c: palette.navy, // #0f2a3f\r'), false],
    ['quiet on a hex in a whole-line comment', () => fires('  // was #0f2a3f before\r'), false],
    ['quiet on colors.accent in a comment', () => fires('  // colors.accent was the old blue\r'), false],
    ['quiet on a token reference',      () => fires('  backgroundColor: palette.surface,\r'), false],
    ['block: fires on a size with no family', () =>
      BLOCK_CHECKS[0].test('a: { fontSize: 13 }'), true],
    ['block: quiet when the family is set', () =>
      BLOCK_CHECKS[0].test('a: { fontFamily: fonts.body, fontSize: 13 }'), false],
  ];
  let ok = true;
  for (const [name, run, expected] of cases) {
    const got = run();
    const pass = got === expected;
    ok &&= pass;
    console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}`);
  }
  console.log(ok ? '\nself-test passed' : '\nSELF-TEST FAILED');
  process.exit(ok ? 0 : 1);
}

const files = [];
(function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full);
    else if (/\.tsx?$/.test(full)) files.push(full);
  }
})(SRC);

const list = process.argv.includes('--list');
const totals = new Map(CHECKS.map((c) => [c.name, 0]));
const perFile = [];

for (const file of files) {
  const rel = relative(ROOT, file);
  if (EXEMPT.has(rel)) continue;
  // Split on \r?\n, not \n: this repo checks out CRLF, and a trailing \r left on
  // each line silently defeated the comment strip below — `.` does not cross \r
  // and `$` (no /m) sits after it, so `//...$` never matched. Every hex in a
  // comment was being counted as a live token bypass.
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  let fileCount = 0;

  lines.forEach((line, i) => {
    // Strip comments first: a hex value quoted in a comment documents the token,
    // it does not bypass it, and counting those inflates the number.
    const code = stripComments(line);
    if (!code.trim()) return;

    // An explicit, greppable opt-out for the handful of values that genuinely
    // cannot reference a token (platform APIs taking their own colour formats).
    // The marker goes on the line itself or the line above it.
    if (/design-audit-ignore/.test(line) || /design-audit-ignore/.test(lines[i - 1] ?? '')) return;

    for (const check of CHECKS) {
      const hits = code.match(check.re);
      if (!hits) continue;
      totals.set(check.name, totals.get(check.name) + hits.length);
      fileCount += hits.length;
      if (list) console.log(`${rel}:${i + 1}  [${check.name}]  ${code.trim().slice(0, 100)}`);
    }
  });

  // Structural checks, per style block (one level of nesting so shadowOffset fits).
  const source = readFileSync(file, 'utf8');
  // Match NAMED style entries (`cardTitle: { ... }`), not any brace block:
  // pairing a radius from one entry with a width from the next produced false
  // positives on every circle in a stylesheet.
  const entries = source.match(/[A-Za-z_$][\w$]*:\s*\{(?:[^{}]|\{[^{}]*\})*\}/gs) ?? [];
  for (const block of entries) {
    if (/design-audit-ignore/.test(block)) continue;
    for (const check of BLOCK_CHECKS) {
      if (!check.test(block)) continue;
      totals.set(check.name, (totals.get(check.name) ?? 0) + 1);
      fileCount += 1;
      if (list) console.log(`${rel}  [${check.name}]`);
    }
  }

  if (fileCount) perFile.push([rel, fileCount]);
}

console.log('\nDesign-token audit');
console.log('──────────────────');
for (const [name, count] of totals) {
  console.log(`  ${String(count).padStart(4)}  ${name}`);
}
console.log(`\n  ${perFile.length} of ${files.length} files still bypass the tokens.`);

perFile.sort((a, b) => b[1] - a[1]);
console.log('\n  Worst offenders:');
for (const [file, count] of perFile.slice(0, 12)) {
  console.log(`    ${String(count).padStart(4)}  ${file}`);
}

const total = [...totals.values()].reduce((a, b) => a + b, 0);
if (process.argv.includes('--strict') && total > 0) process.exit(1);
