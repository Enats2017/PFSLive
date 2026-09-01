#!/usr/bin/env node
// Does each deck row that carries the lime left accent actually render one?
//
//   node scripts/accent-check.mjs [--selftest]
//
// Resolution is IMPORT-AWARE on purpose. Grepping a pile of mapped files, or
// even matching a style key by name, both false-pass here: `card` is defined in
// a dozen stylesheets and only ONE of them carries the accent, so a component
// using a different `card` looked correct. This maps each component's local
// alias to the stylesheet it imports, then resolves `alias.key` in that file.
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

// board -> the component that renders one row of the list
const ROWS = {
  AthleteSearch:     'src/screens/FollowerEventList/FollowerCard.tsx',
  FavouriteAthletes: 'src/screens/FollowerEventList/FollowerCard.tsx',
  Favourites:        'src/screens/FavouriteScreen/FavouriteCard.tsx',
  FollowersList:     'src/screens/ProfileScreen/FollowerListCard.tsx',
  ParticipantList:   'src/screens/EventDetails/ParticipantCard.tsx',
  ParticipantSearch: 'src/screens/EventDetails/ParticipantCard.tsx',
  ParticipantHub:    'src/screens/ParticipantScreen/ParticipantScreen.tsx',
  ClaimBib:          'src/screens/EventDetails/ParticipantResult.tsx',
};

// style keys in one stylesheet that carry a lime left border
export function limeKeys(src) {
  const out = new Set();
  for (const m of src.matchAll(/^\s{2,6}([a-zA-Z][\w]*):\s*\{([\s\S]*?)^\s{2,6}\},/gm)) {
    if (/borderLeftWidth/.test(m[2]) && /lime/.test(m[2])) out.add(m[1]);
  }
  return out;
}

// local alias -> absolute stylesheet path, from the component's imports
function aliasMap(src, fileDir) {
  const map = new Map();
  for (const m of src.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"](\.[^'"]+)['"]/g)) {
    const target = resolve(fileDir, m[2]) + '.ts';
    if (!existsSync(target)) continue;
    for (const raw of m[1].split(',')) {
      const name = raw.trim().split(/\s+as\s+/).pop().trim();
      if (name) map.set(name, target);
    }
  }
  return map;
}

if (process.argv.includes('--selftest')) {
  const k = limeKeys('  a: {\n    borderLeftWidth: 3,\n    borderLeftColor: palette.lime,\n  },\n  b: {\n    padding: 4,\n  },');
  const ok1 = k.has('a') && !k.has('b');
  const ok2 = !limeKeys('  a: {\n    borderLeftWidth: 3,\n    borderLeftColor: palette.navy,\n  },').has('a');
  console.log(`  ${ok1 ? 'PASS' : 'FAIL'}  finds a lime left border, ignores a plain rule`);
  console.log(`  ${ok2 ? 'PASS' : 'FAIL'}  a navy left border is not a lime accent`);
  console.log(ok1 && ok2 ? '\nself-test passed' : '\nSELF-TEST FAILED');
  process.exit(ok1 && ok2 ? 0 : 1);
}

const cache = new Map();
const load = (p) => (cache.has(p) ? cache.get(p) : (cache.set(p, limeKeys(readFileSync(p, 'utf8'))), cache.get(p)));

console.log('\nLime row accent — the deck draws one on these rows');
console.log('──────────────────────────────────────────────────\n');
let missing = 0;
for (const [board, rel] of Object.entries(ROWS)) {
  const file = join(ROOT, rel);
  if (!existsSync(file)) { console.log(`  ${board.padEnd(20)} FILE MISSING`); missing++; continue; }
  const src = readFileSync(file, 'utf8');
  const aliases = aliasMap(src, dirname(file));
  const hits = [];
  for (const m of src.matchAll(/\b([a-zA-Z][\w]*)\.([a-zA-Z][\w]*)\b/g)) {
    const sheet = aliases.get(m[1]);
    if (sheet && load(sheet).has(m[2])) hits.push(`${m[1]}.${m[2]}`);
  }
  const uniq = [...new Set(hits)];
  if (uniq.length) console.log(`  ${board.padEnd(20)} ok   ${uniq.join(', ')}`);
  else { console.log(`  ${board.padEnd(20)} MISSING`); missing++; }
}
console.log(`\n  ${missing} row(s) without the accent the deck draws.`);
