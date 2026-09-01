#!/usr/bin/env node
// Does each screen show the CONTENT its artboard shows?
//
//   node scripts/content-check.mjs [--selftest] [Board]
//
// The structure check asks "is the right kind of block here". This asks the
// harder question: every LABEL the deck puts on a screen -- "Wave", "Splits",
// "Average pace" -- does the screen actually render those words? A screen can
// have every block in the right style and still be missing half the data.
//
// Deck labels are matched against the i18n VALUES the screen renders, so a
// label present under a different key still counts.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const DECK = 'D:/temp_chrome_download/livio/Livio_UI_source';
const I18N = join(ROOT, 'src/i18n');

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// A deck string is a LABEL if it is words, not a data value.
export function isLabel(s) {
  const t = s.trim();
  if (t.length < 3 || t.length > 34) return false;
  if (!/[a-zA-Z]/.test(t)) return false;
  if (/^\d/.test(t)) return false;                       // "80 km", "1 / 130"
  if (/\d{1,2}:\d{2}/.test(t)) return false;             // times
  if (/^(bib|wave)\s+\d/i.test(t)) return false;         // "Bib 412"
  if (/[·—]/.test(t)) return false;                      // composed meta lines
  return true;
}

if (process.argv.includes('--selftest')) {
  const cases = [
    ['Average pace', true], ['Splits', true], ['Elevation gain', true],
    ['8:12:04', false], ['80 km', false], ['1 / 130', false],
    ['Bib 412', false], ['Amfreville Sous Les Monts · France', false],
  ];
  let ok = true;
  for (const [s, want] of cases) {
    const got = isLabel(s);
    if (got !== want) ok = false;
    console.log(`  ${got === want ? 'PASS' : 'FAIL'}  ${JSON.stringify(s)} -> ${got}`);
  }
  console.log(ok ? '\nself-test passed' : '\nSELF-TEST FAILED');
  process.exit(ok ? 0 : 1);
}

// every English string the app has, flattened
const values = new Set();
for (const dir of readdirSync(I18N)) {
  const f = join(I18N, dir, 'en.json');
  if (!existsSync(f)) continue;
  const walk = (o) => {
    for (const v of Object.values(o)) {
        // Values that normalise away (emoji, bullets, punctuation) become the
      // empty string, and `label.includes('')` is always true -- which silently
      // matched every label against nothing.
        if (typeof v === 'string') {
        const n = norm(v);
        if (n.length >= 3) values.add(n);
        const stem = norm(v.replace(/\{\{[^}]*\}\}/g, ' '));
        if (stem.length >= 3) values.add(stem);
      }
      else if (v && typeof v === 'object') walk(v);
    }
  };
  try { walk(JSON.parse(readFileSync(f, 'utf8'))); } catch {}
}

const MAP = JSON.parse(readFileSync(join(ROOT, 'scripts/content-map.json'), 'utf8'));
const only = process.argv[2];

console.log('\nContent vs artboard — deck labels with no copy in the app');
console.log('─────────────────────────────────────────────────────────\n');
let total = 0;
for (const [board, files] of Object.entries(MAP)) {
  if (only && board !== only) continue;
  const art = join(DECK, `${board}.dc.html`);
  if (!existsSync(art)) continue;
  const raw = readFileSync(art, 'utf8');
  const html = raw.slice(raw.indexOf('</helmet>') + 1);
  const LABEL_POS = /(class="meta"|class="p"|color: #4A5A6A|letter-spacing: \.08em|border: 1\.5px solid #0f2447|background: #0f2447; color: #fff)/;
  const labels = [...new Set(
    [...html.matchAll(/<(?:div|span|button)([^>]*)>([^<]{2,60})</g)]
      .filter((m) => LABEL_POS.test(m[1]))
      .filter((m) => isLabel(m[2].replace(/&[a-z]+;/g, ' ')) && !/&middot;|·/.test(m[2]))
      .map((m) => m[2].replace(/&[a-z]+;/g, ' ').trim())
  )];
  const code = files
    .map((f) => (existsSync(join(ROOT, 'src', f)) ? readFileSync(join(ROOT, 'src', f), 'utf8') : ''))
    .join('\n');
  const missing = labels.filter((l) => {
    const n = norm(l);
    if (values.has(n)) return false;                       // exact copy exists
    // Only the "app string contains the deck label" direction is evidence.
    // The reverse counted "Average pace" as present because the app has "Pace"
    // somewhere -- which is exactly the missing-data case being looked for.
    for (const v of values) if (v.includes(n)) return false;
    return !code.toLowerCase().includes(l.toLowerCase());   // or a literal in code
  });
  if (missing.length) {
    total += missing.length;
    console.log(`  ${board}`);
    for (const m of missing) console.log(`      ${m}`);
  }
}
console.log(`\n  ${total} deck label(s) with no counterpart in the app.`);
