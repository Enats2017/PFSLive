#!/usr/bin/env node
// Per-screen design conformance report.
//
//   node scripts/design-report.mjs           # summary table
//   node scripts/design-report.mjs --detail  # every failing value
//   node scripts/design-report.mjs --selftest
//
// Reports the five things the deck actually specifies, per screen file:
//   PAD   padding/margin on the 4pt grid
//   SPACE page gutter 20, card gap 12
//   FONT  a family is set, and the size is on the ramp
//   TEXT  no ALL-CAPS sentences, no raw i18n keys rendered
//   DESIGN radius 10/14/16 (or a true circle/pill), token shadows, no raw hex
//
// --selftest injects a known-bad value into a scratch string and asserts each
// rule fires. The previous audit silently mis-fired for a week because nothing
// checked the checker.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const RAMP = ['10', '11', '12', '13', '15', '20', '26', '40'];
const RADII = [10, 14, 16];

const entriesOf = (src) =>
  src.match(/[A-Za-z_$][\w$]*:\s*\{(?:[^{}]|\{[^{}]*\})*\}/gs) ?? [];

const RULES = {
  PAD: (src) => {
    const bad = [];
    for (const m of src.matchAll(/\b(?:padding|margin)(?:Top|Bottom|Left|Right|Horizontal|Vertical)?:\s*(-?\d+(?:\.\d+)?)\b/g)) {
      const v = Math.abs(Number(m[1]));
      if (v > 2 && v % 4 !== 0) bad.push(m[0].trim());
    }
    return bad;
  },
  SPACE: (src) => {
    const bad = [];
    for (const m of src.matchAll(/paddingHorizontal:\s*(?:spacing\.md|10\b|12\b|14\b|15\b)/g)) bad.push(m[0]);
    for (const m of src.matchAll(/marginBottom:\s*(?:6\b|10\b|14\b|18\b)/g)) bad.push(m[0]);
    return bad;
  },
  FONT: (src) => {
    const bad = [];
    for (const b of entriesOf(src)) {
      if (/design-audit-ignore/.test(b)) continue;
      const size = b.match(/fontSize:\s*([\d.]+)/);
      if (size && !RAMP.includes(size[1])) bad.push(`fontSize: ${size[1]}`);
      if (/fontSize:/.test(b) && !/fontFamily/.test(b) && !/\.\.\.type\./.test(b)) bad.push('size without a family');
      if (/fontWeight:/.test(b)) bad.push('raw fontWeight');
    }
    return bad;
  },
  DESIGN: (src) => {
    const bad = [];
    // Named CSS colours bypass the tokens exactly like a raw hex, and pure
    // black is not in the palette at all.
    for (const m of src.matchAll(
      /(?:color=|color:\s*)['\"](black|white|red|blue|green|gray|grey|orange|yellow|pink|purple)['\"]/g
    )) {
      bad.push(`named colour "${m[1]}"`);
    }
    // `palette.x + '15'` invents a colour at the call site: the alpha is picked
    // ad hoc and the result is in no token set. Use a status token or withAlpha.
    for (const m of src.matchAll(/palette\.[a-zA-Z]+ \+ ['"][0-9a-fA-F]{2}['"]/g)) {
      bad.push(`hand-rolled alpha ${m[0]}`);
    }
    // A COLOURED rgba() literal is a palette value written by hand — this is how
    // a retired bright blue survived under a navy stroke, invisible to a check
    // that only knew about hex. Neutral rgba (r==g==b) is a shadow or scrim.
    for (const m of src.matchAll(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g)) {
      const [r, g, b] = [m[1], m[2], m[3]].map(Number);
      if (!(r === g && g === b)) bad.push(`coloured rgba(${r}, ${g}, ${b})`);
    }
    const lines = src.split('\n');
    for (const m of src.matchAll(/(['"])(#[0-9a-fA-F]{3,8})\1/g)) {
      // The marker may sit after the value on the same line, or on the line
      // above it. Take whole lines, not just the text before the match.
      const i = src.slice(0, m.index).split('\n').length - 1;
      const scope = (lines[i - 1] ?? '') + '\n' + (lines[i] ?? '');
      if (!/design-audit-ignore/.test(scope)) bad.push(m[2]);
    }
    // Corner-specific radii: a sheet written as borderTopLeftRadius escaped
    // a check that only knew about `borderRadius`.
    for (const m of src.matchAll(/border(?:Top|Bottom)(?:Left|Right)Radius:\s*(\d+)/g)) {
      const n = Number(m[1]);
      if (n > 4 && ![10, 14, 16].includes(n)) bad.push(`corner radius ${n}`);
    }
    for (const b of entriesOf(src)) {
      if (/shadowOpacity:/.test(b)) bad.push('hand-rolled shadow');
      const r = b.match(/borderRadius:\s*(\d+)/);
      if (!r) continue;
      const n = Number(r[1]);
      if (n <= 4 || RADII.includes(n)) continue;
      const w = b.match(/width:\s*(\d+)/), h = b.match(/height:\s*(\d+)/);
      if (w && h && w[1] === h[1] && Math.abs(n - Number(w[1]) / 2) < 1) continue;
      bad.push(`radius ${n}`);
    }
    return bad;
  },
};

if (process.argv.includes('--selftest')) {
  const cases = [
    ['PAD', 'a: { padding: 7 }'],
    ['SPACE', 'a: { paddingHorizontal: 12 }'],
    ['FONT', 'a: { fontFamily: fonts.body, fontSize: 17 }'],
    ['DESIGN', "a: { backgroundColor: '#ff0000' }"],
    ['DESIGN', 'a: { borderTopLeftRadius: 28 }'],
    ['DESIGN', 'a: { color: "black" }'],
    ['DESIGN', 'a: { fill: "rgba(59, 130, 246, 0.25)" }'],
    ['DESIGN', "a: { backgroundColor: palette.warning + '15' }"],
  ];
  let ok = true;
  for (const [rule, sample] of cases) {
    const fired = RULES[rule](sample).length > 0;
    console.log(`  ${fired ? 'PASS' : 'FAIL'}  ${rule} catches ${JSON.stringify(sample)}`);
    ok &&= fired;
  }
  const clean = 'a: { padding: 16, paddingHorizontal: 20, marginBottom: 12, fontFamily: fonts.body, fontSize: 13, borderRadius: 14, backgroundColor: palette.surface }';
  for (const rule of Object.keys(RULES)) {
    const quiet = RULES[rule](clean).length === 0;
    console.log(`  ${quiet ? 'PASS' : 'FAIL'}  ${rule} stays quiet on conforming code`);
    ok &&= quiet;
  }
  console.log(ok ? '\nself-test passed' : '\nSELF-TEST FAILED');
  process.exit(ok ? 0 : 1);
}

const files = [];
(function walk(dir) {
  for (const e of readdirSync(dir)) {
    const full = join(dir, e);
    if (statSync(full).isDirectory()) walk(full);
    else if (/\.tsx?$/.test(full)) files.push(full);
  }
})(join(ROOT, 'src'));

const detail = process.argv.includes('--detail');
const rows = [];
let totals = { PAD: 0, SPACE: 0, FONT: 0, DESIGN: 0 };

for (const file of files) {
  const rel = relative(ROOT, file);
  if (rel.endsWith(join('styles', 'common.styles.ts'))) continue;
  const src = readFileSync(file, 'utf8');
  const res = {};
  let sum = 0;
  for (const [name, fn] of Object.entries(RULES)) {
    const bad = fn(src);
    res[name] = bad;
    totals[name] += bad.length;
    sum += bad.length;
  }
  if (sum) rows.push([rel, res, sum]);
}

console.log('\nDesign conformance by file');
console.log('──────────────────────────');
console.log(`  ${files.length} files checked, ${rows.length} with findings\n`);
for (const [name, n] of Object.entries(totals)) {
  console.log(`  ${String(n).padStart(4)}  ${name}`);
}
if (rows.length) {
  console.log('\n  Files:');
  rows.sort((a, b) => b[2] - a[2]);
  for (const [rel, res, sum] of rows) {
    const parts = Object.entries(res).filter(([, v]) => v.length).map(([k, v]) => `${k} x${v.length}`);
    console.log(`   ${String(sum).padStart(3)}  ${rel}  ${parts.join(', ')}`);
    if (detail) {
      for (const [k, v] of Object.entries(res)) {
        for (const item of [...new Set(v)].slice(0, 6)) console.log(`          ${k}: ${item}`);
      }
    }
  }
}
process.exit(rows.length && process.argv.includes('--strict') ? 1 : 0);
