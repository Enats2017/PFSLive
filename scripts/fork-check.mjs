#!/usr/bin/env node
// Have forked components drifted apart?
//
//   node scripts/fork-check.mjs [--selftest]
//
// Several components exist twice under different folders — two DistanceTabs,
// two ParticipantCards, three PastTabs. Editing one and not the other is the
// most expensive mistake in this redesign: it produced a white-on-white Map
// button and an entire un-redesigned participant-search row, and neither was
// visible to any check, because each file was internally consistent.
//
// This compares each fork set on the redesign's shared vocabulary. A set where
// one copy uses the shared components and another does not has drifted.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, basename, sep } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

// Markers of the redesigned vocabulary. A fork using none while its twin uses
// several has been left behind.
const MARKERS = [
  'EventListCard', 'cardActionRow', 'cardActionPrimary', 'cardActionSecondary',
  'rowAccent', 'cardAccent', 'menuCard', 'outlineButton', 'limeButton',
  'subHeader', 'tabBarUnderline', 'avatarInitials', 'rowMeta', 'NoticeCard',
  // screen-specific names introduced by the redesign
  'bibBoxText', 'participantMeta', 'cardAvatar', 'followLabel', 'resultButton',
  'cpHead', 'identityPlace', 'languagePill', 'nextCard', 'notArrivedCard',
];

export function score(src) {
  return MARKERS.reduce((n, m) => n + (src.includes(m) ? 1 : 0), 0);
}

/**
 * A tab that renders `<EventCardPast/>` is redesigned if that card is — the work
 * lives one level down. Scoring only the file itself flagged three sets that
 * were perfectly fine, which is exactly the kind of false alarm that trains you
 * to ignore a check.
 */
function scoreWithDelegates(file, readRel) {
  const src = readRel(file);
  let best = score(src);
  for (const m of src.matchAll(/import\s+(?:\{[^}]*\}|\w+)\s+from\s+'(\.[^']+)'/g)) {
    const child = readRel(file, m[1]);
    if (child) best = Math.max(best, score(child));
  }
  return best;
}

if (process.argv.includes('--selftest')) {
  const ok1 = score('<EventListCard/> and cardActionRow') === 2;
  const ok2 = score('<View style={s.oldThing}/>') === 0;
  console.log(`  ${ok1 ? 'PASS' : 'FAIL'}  counts redesign markers`);
  console.log(`  ${ok2 ? 'PASS' : 'FAIL'}  scores an untouched file zero`);
  const ok = ok1 && ok2;
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

const byName = new Map();
for (const f of files) {
  const b = basename(f);
  if (!byName.has(b)) byName.set(b, []);
  byName.get(b).push(f);
}

console.log('\nForked components — has one copy been left behind?');
console.log('──────────────────────────────────────────────────\n');
let drifted = 0;
for (const [name, group] of [...byName].sort()) {
  if (group.length < 2) continue;
  const readRel = (file, rel) => {
    if (!rel) return readFileSync(file, 'utf8');
    const base = file.slice(0, file.lastIndexOf(sep));
    for (const ext of ['.tsx', '.ts', '/index.tsx']) {
      const cand = join(base, rel + ext);
      try { return readFileSync(cand, 'utf8'); } catch { /* next */ }
    }
    return null;
  };
  const scored = group.map((f) => ({ f, n: scoreWithDelegates(f, readRel) }));
  const max = Math.max(...scored.map((s) => s.n));
  const min = Math.min(...scored.map((s) => s.n));
  // One copy speaks the new vocabulary and another speaks none of it.
  const isDrift = max > 0 && min === 0;
  if (isDrift) drifted++;
  console.log(`  ${name}${isDrift ? '   <-- DRIFTED' : ''}`);
  for (const s of scored) console.log(`      ${String(s.n).padStart(2)}  ${relative(ROOT, s.f)}`);
}
console.log(`\n  ${drifted} fork set(s) where one copy was left behind.`);
