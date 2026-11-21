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
  // Not a button, but the same trap: a light-filled circle whose matching navy
  // label style existed and was never wired up, so the bib number was drawn in
  // white on `palette.fill` and could not be read.
  bibBox: 'bibBoxText',
};

/** Label styles that render LIGHT text — fatal on a light button. */
const LIGHT_TEXT = [
  'primaryButtonText',
  'resultsButtonText',
  'cardActionPrimaryText',
  'activeTabText',
];

// Judge each BUTTON OCCURRENCE, not the file. The first version bailed out as
// soon as the correct label style appeared anywhere in the file - so a screen
// with three `routeButton`s, two labelled correctly and one white-on-white,
// read as clean. That is exactly the bug it exists to catch, and it shipped.
/**
 * Comments are not code. A note explaining WHY a light label style must not be
 * used here was itself read as a use of it, so the fixed file kept reporting the
 * bug it had just fixed. `://` is spared so URLs survive.
 */
export function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

export function findMismatch(rawSrc) {
  const src = stripComments(rawSrc);
  const bad = [];
  for (const [btn, want] of Object.entries(PAIRS)) {
    let from = 0;
    for (;;) {
      const at = src.indexOf(btn, from);
      if (at === -1) break;
      from = at + btn.length;
      // `routeButtonText` contains `routeButton` - skip the label style itself.
      if (src.startsWith(want, at)) continue;

      // Look only as far as this button's own element: the next occurrence of
      // any pair key, or the closing tag, whichever comes first.
      let end = src.indexOf('</TouchableOpacity>', from);
      if (end === -1) end = src.length;
      for (const other of Object.keys(PAIRS)) {
        const nxt = src.indexOf(other, from);
        if (nxt !== -1 && nxt < end) end = nxt;
      }
      const window = src.slice(from, end);

      if (window.includes(want)) continue;      // correctly labelled
      for (const light of LIGHT_TEXT) {
        if (window.includes(light)) bad.push(`${btn} + ${light}`);
      }
    }
  }
  return bad;
}

if (process.argv.includes('--selftest')) {
  const ok1 = findMismatch('style={s.routeButton}><Text style={c.primaryButtonText}></TouchableOpacity>').length === 1;
  const ok2 = findMismatch('style={s.routeButton}><Text style={s.routeButtonText}></TouchableOpacity>').length === 0;
  const ok3 = findMismatch('<Text style={c.primaryButtonText}>').length === 0;  // no light button
  // The regression this check was rewritten for: one bad occurrence hiding
  // behind two good ones in the same file.
  const mixed =
    'style={s.routeButton}><Text style={s.routeButtonText}></TouchableOpacity>' +
    'style={s.routeButton}><Text style={s.routeButtonText}></TouchableOpacity>' +
    'style={s.routeButton}><Text style={c.primaryButtonText}></TouchableOpacity>';
  const ok4 = findMismatch(mixed).length === 1;
  // A comment naming a light label style is not a use of it. The fixed file
  // kept reporting its own fix until the scanner stopped reading comments.
  const commented =
    'style={s.routeButton}>' +
    '{/* primaryButtonText is WHITE - do not use it here */}' +
    '<Text style={s.routeButtonText}></TouchableOpacity>';
  const ok5 = findMismatch(commented).length === 0;
  const ok6 = stripComments('const u = "https://a.b"; // note').includes('https://a.b');
  console.log(`  ${ok1 ? 'PASS' : 'FAIL'}  catches a light label on a light button`);
  console.log(`  ${ok2 ? 'PASS' : 'FAIL'}  quiet when the pair matches`);
  console.log(`  ${ok3 ? 'PASS' : 'FAIL'}  quiet when there is no light button`);
  console.log(`  ${ok4 ? 'PASS' : 'FAIL'}  catches one bad occurrence among good ones`);
  console.log(`  ${ok5 ? 'PASS' : 'FAIL'}  does not read a comment as a use`);
  console.log(`  ${ok6 ? 'PASS' : 'FAIL'}  leaves a URL alone`);
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
