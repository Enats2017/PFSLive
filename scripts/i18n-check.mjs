#!/usr/bin/env node
// Copy and translation checks across en / fr / nl.
//
//   node scripts/i18n-check.mjs
//   node scripts/i18n-check.mjs --selftest
//
// The app serves Belgium and its neighbours, so French and Dutch are not an
// afterthought: they run 20-40% longer than English and they are where the
// leaks hide. This checks:
//
//   PARITY       every key exists in all three languages
//   PLACEHOLDER  {{name}} tokens match English exactly
//   LEAK         a French value identical to the Dutch one (fr filled with nl)
//   CAPS         no ALL-CAPS sentences (the style uppercases, not the string)
//   WHITESPACE   no leading/trailing/double spaces
//   SPELLING     British English (favourite, not favorite)
//   WIDTH        strings in width-constrained places that will truncate
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const I18N = join(ROOT, 'src', 'i18n');
const LANGS = ['en', 'fr', 'nl'];
const PLACEHOLDER = /\{\{\s*([\w.]+)\s*\}\}/g;

// Width budgets in points, measured off the artboards.
const BUDGETS = [
  { name: 'bottom nav label', match: /^common:nav\./, px: 10, budget: 89 },
  { name: 'lime band title', match: /^common:band\./, px: 12, budget: 350, weight: 0.62 },
  { name: 'result-detail tab', match: /^Resultdetails:tabs\./, px: 15, budget: 150 },
];

const flatten = (obj, prefix = '', out = {}) => {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object') flatten(v, key, out);
    else if (typeof v === 'string') out[key] = v;
  }
  return out;
};

const width = (text, px, weight = 0.55) => text.length * px * weight;

// Literal copy between JSX tags. Screaming constants are excluded.
const JSX_TEXT = />\s*([A-Z][A-Za-z][A-Za-z '&,.!?-]{4,60})\s*</g;

// English copy inside a template literal: two or more words before an
// interpolation, or after one. JSX_TEXT cannot see these.
const TEMPLATE_TEXT = /`([A-Z][a-z]+(?: [a-z]+){1,8}:?) ?\$\{/g;

const findings = {
  PARITY: [], PLACEHOLDER: [], LEAK: [], CAPS: [], WHITESPACE: [], SPELLING: [], WIDTH: [],
  HARDCODED: [], MAPPING: [], ORPHAN: [],
};

if (process.argv.includes('--selftest')) {
  const caps = (v) => {
    const letters = [...v].filter((c) => /\p{L}/u.test(c));
    return letters.length >= 4 && letters.every((c) => c === c.toUpperCase()) && v.split(/\s+/).length > 1;
  };
  const checks = [
    ['CAPS fires', caps('SHOW ALL EVENTS') === true],
    ['CAPS quiet', caps('Show all events') === false],
    ['WHITESPACE fires', ' x '.trim() !== ' x '],
    ['SPELLING fires', /\bfavorite/i.test('Add to favorite')],
    ['SPELLING quiet', /\bfavorite/i.test('Add to favourite') === false],
    ['WIDTH fires', width('Persoonlijk evenement bewerken', 12, 0.62) > 200],
    ['HARDCODED fires', new RegExp(JSX_TEXT.source).test('<Text>Processing Payment</Text>')],
    ['HARDCODED quiet', new RegExp(JSX_TEXT.source).test("<Text>{t('a:b')}</Text>") === false],
    ['HARDCODED template fires', new RegExp(TEMPLATE_TEXT.source).test('`Race starts in: ${x}`')],
    ['HARDCODED template quiet', new RegExp(TEMPLATE_TEXT.source).test('`${a}-${b}`') === false],
  ];
  let ok = true;
  for (const [label, pass] of checks) {
    console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${label}`);
    ok &&= pass;
  }
  console.log(ok ? '\nself-test passed' : '\nSELF-TEST FAILED');
  process.exit(ok ? 0 : 1);
}

// ── wiring: what does index.ts actually load, per language? ────────────────
const indexSrc = readFileSync(join(I18N, 'index.ts'), 'utf8');
const symbolFolder = {};
for (const m of indexSrc.matchAll(/import\s+(\w+)\s+from\s+["']\.\/([\w]+)\/\w+\.json["']/g)) {
  symbolFolder[m[1]] = m[2];
}
const aliasFolders = {};
for (const lang of LANGS) {
  const block = indexSrc.match(new RegExp(`\\n\\s*${lang}:\\s*\\{([\\s\\S]*?)\\n\\s*\\},\\n`));
  if (!block) continue;
  for (const m of block[1].matchAll(/(\w+)\s*:\s*(\w+)/g)) {
    const folder = symbolFolder[m[2]];
    if (!folder) continue;
    (aliasFolders[m[1]] ??= {})[lang] = folder;
  }
}
const wiredFolders = new Set();
for (const [alias, langs] of Object.entries(aliasFolders)) {
  Object.values(langs).forEach((f) => wiredFolders.add(f));
  const distinct = new Set(Object.values(langs));
  if (distinct.size > 1) {
    findings.MAPPING.push(`${alias} loads different folders per language: ${JSON.stringify(langs)}`);
  }
  for (const lang of LANGS) {
    if (!langs[lang]) findings.MAPPING.push(`${alias} has no ${lang} entry in index.ts`);
  }
}

const namespaces = readdirSync(I18N).filter((d) => statSync(join(I18N, d)).isDirectory());

for (const ns of namespaces) {
  if (!wiredFolders.has(ns)) {
    findings.ORPHAN.push(`${ns}/ is not imported by index.ts`);
    continue;
  }
  const data = {};
  for (const lang of LANGS) {
    const p = join(I18N, ns, `${lang}.json`);
    if (existsSync(p)) data[lang] = flatten(JSON.parse(readFileSync(p, 'utf8')));
  }
  if (!data.en) continue;

  for (const lang of ['fr', 'nl']) {
    if (!data[lang]) continue;
    for (const k of Object.keys(data.en)) {
      if (!(k in data[lang])) findings.PARITY.push(`${ns}:${k} missing in ${lang}`);
    }
  }

  for (const [k, en] of Object.entries(data.en)) {
    const base = (en.match(PLACEHOLDER) ?? []).sort().join(',');
    for (const lang of ['fr', 'nl']) {
      const v = data[lang]?.[k];
      if (v === undefined) continue;
      if ((v.match(PLACEHOLDER) ?? []).sort().join(',') !== base) {
        findings.PLACEHOLDER.push(`${ns}:${k} [${lang}] ${JSON.stringify(v.slice(0, 40))}`);
      }
    }
    const fr = data.fr?.[k], nl = data.nl?.[k];
    if (fr && nl && fr === nl && fr !== en && fr.length > 12 && /\p{L}{4}/u.test(fr)) {
      findings.LEAK.push(`${ns}:${k} fr==nl ${JSON.stringify(fr.slice(0, 40))}`);
    }
  }

  for (const lang of LANGS) {
    for (const [k, v] of Object.entries(data[lang] ?? {})) {
      const letters = [...v].filter((c) => /\p{L}/u.test(c));
      if (letters.length >= 4 && letters.every((c) => c === c.toUpperCase()) && v.split(/\s+/).length > 1) {
        findings.CAPS.push(`${ns}:${k} [${lang}] ${JSON.stringify(v.slice(0, 40))}`);
      }
      if (v !== v.trim() || /\s{2}/.test(v)) findings.WHITESPACE.push(`${ns}:${k} [${lang}]`);
      if (/\bfavorite/i.test(v)) findings.SPELLING.push(`${ns}:${k} [${lang}]`);
      for (const b of BUDGETS) {
        if (!b.match.test(`${ns}:${k}`)) continue;
        const est = width(v, b.px, b.weight);
        if (est > b.budget) {
          findings.WIDTH.push(`${b.name} ${ns}:${k} [${lang}] ~${Math.round(est)}pt > ${b.budget}pt ${JSON.stringify(v)}`);
        }
      }
    }
  }
}

// Hardcoded user-facing English in JSX.
const walkTsx = (dir) => {
  for (const e of readdirSync(dir)) {
    const full = join(dir, e);
    if (statSync(full).isDirectory()) { walkTsx(full); continue; }
    if (!full.endsWith('.tsx')) continue;
    const src = readFileSync(full, 'utf8');
    for (const m of src.matchAll(new RegExp(TEMPLATE_TEXT.source, 'g'))) {
      const before = src.slice(0, m.index);
      const line = before.split('\n').length;
      // Debug logging is not user-facing copy.
      if (/console\.\w+\([^\n]*$/.test(before.split('\n').pop())) continue;
      findings.HARDCODED.push(`${full.split(/[\\/]src[\\/]/)[1]}:${line} template ${JSON.stringify(m[1])}`);
    }
    for (const m of src.matchAll(new RegExp(JSX_TEXT.source, 'g'))) {
      const text = m[1].trim();
      if (/^[A-Z_]+$/.test(text)) continue;
      const line = src.slice(0, m.index).split('\n').length;
      findings.HARDCODED.push(`${full.split(/[\\/]src[\\/]/)[1]}:${line} ${JSON.stringify(text)}`);
    }
  }
};
walkTsx(join(ROOT, 'src'));

console.log('\ni18n check — en / fr / nl');
console.log('─────────────────────────');
let total = 0;
for (const [name, list] of Object.entries(findings)) {
  console.log(`  ${String(list.length).padStart(4)}  ${name}`);
  total += list.length;
}
for (const [name, list] of Object.entries(findings)) {
  if (!list.length) continue;
  console.log(`\n  ${name}:`);
  for (const item of list.slice(0, 12)) console.log(`     ${item}`);
  if (list.length > 12) console.log(`     … ${list.length - 12} more`);
}
// ORPHAN is informational — dead namespace folders that predate this work.
// Everything else is a real defect.
const blocking = total - findings.ORPHAN.length;
process.exit(blocking && process.argv.includes('--strict') ? 1 : 0);
