#!/usr/bin/env node
// Did the redesign drop any data a screen used to show?
//
//   node scripts/data-loss-check.mjs
//   node scripts/data-loss-check.mjs --selftest
//
// Restyling is safe; RE-LAYING-OUT is where fields go missing. For every file
// changed against HEAD, this extracts the data expressions it renders — object
// fields (`item.bib`, `profile?.city`), translation keys, and interpolations —
// and reports anything present in HEAD but absent now.
//
// It reads the WORKING TREE against `git show HEAD:<path>`, so it only judges
// this branch's changes.
import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';

// `item.bib_number`, `profile?.followers_count`, `data?.race_info?.name`
const FIELD = /\b(?:item|profile|data|raceInfo|event|cp|checkpoint|participant|user|plan|result|stats|statistics)\??\.[\w.?]+/g;
// t('ns:key') and t(`ns:${x}`)
const TKEY = /t\(\s*['"`]([\w:.\-${}]+)['"`]/g;

const clean = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '');

const extract = (src) => {
  const code = clean(src);
  const out = new Set();
  for (const m of code.matchAll(FIELD)) out.add(m[0].replace(/\?\./g, '.'));
  for (const m of code.matchAll(TKEY)) out.add(`t:${m[1]}`);
  return out;
};

if (process.argv.includes('--selftest')) {
  const before = extract("<Text>{item.bib}</Text><Text>{t('a:b')}</Text>");
  const after = extract("<Text>{item.bib}</Text>");
  const lost = [...before].filter((x) => !after.has(x));
  const ok1 = lost.length === 1 && lost[0] === 't:a:b';
  const same = [...before].filter((x) => !extract("<Text>{item.bib}</Text><Text>{t('a:b')}</Text>").has(x));
  const ok2 = same.length === 0;
  console.log(`  ${ok1 ? 'PASS' : 'FAIL'}  detects a removed field`);
  console.log(`  ${ok2 ? 'PASS' : 'FAIL'}  quiet when nothing was removed`);
  console.log(ok1 && ok2 ? '\nself-test passed' : '\nSELF-TEST FAILED');
  process.exit(ok1 && ok2 ? 0 : 1);
}

const changed = execSync('git diff --name-only HEAD', { encoding: 'utf8' })
  .split('\n')
  .filter((f) => f.endsWith('.tsx') || f.endsWith('.ts'))
  .filter((f) => existsSync(f));

let totalLost = 0;
const rows = [];

for (const file of changed) {
  let head;
  try {
    head = execSync(`git show HEAD:${file}`, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  } catch {
    continue; // new file — nothing to lose
  }
  const before = extract(head);
  const after = extract(readFileSync(file, 'utf8'));
  const lost = [...before].filter((x) => !after.has(x));
  if (lost.length) {
    rows.push([file, lost]);
    totalLost += lost.length;
  }
}

console.log('\nData-loss check (working tree vs HEAD)');
console.log('──────────────────────────────────────');
console.log(`  ${changed.length} changed files, ${rows.length} with something no longer rendered\n`);
rows.sort((a, b) => b[1].length - a[1].length);
for (const [file, lost] of rows) {
  console.log(`  ${String(lost.length).padStart(3)}  ${file}`);
  for (const item of lost.slice(0, 10)) console.log(`         ${item}`);
  if (lost.length > 10) console.log(`         … ${lost.length - 10} more`);
}
console.log(`\n  ${totalLost} expressions no longer referenced.`);
console.log('  Each needs a human call: deliberate (a duplicate title, a key that');
console.log('  moved) or an accident (a field the screen should still show).');
