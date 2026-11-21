#!/usr/bin/env node
// Stale-pattern scan for screens NO mockup covers.
//
//   node scripts/legacy-check.mjs [--selftest]
//
// The other checks compare a screen to its artboard. Fifteen screens have no
// artboard, so nothing has ever checked them. What CAN be checked is that they
// don't still use devices the redesign retired — every one of these was found
// and fixed on a screen that did have a mockup, so a screen still doing it has
// simply never been touched.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

// route/component -> file
const UNCOVERED = {
  EventDetails:          'screens/EventDetails/EventDetails.tsx',
  ParticipantEvent:      'screens/ParticipantEvent/ParticipantEvent.tsx',
  EditPersonalEvent:     'screens/PersonalEventScreen/EditPersonalEvent.tsx',
  RaceResultScreen:      'screens/ParticipantEvent/RaceResultScreen.tsx',
  DeleteEventModal:      'components/DeleteEventModal.tsx',
  DeviceTransferModal:   'components/DeviceTransferModal.tsx',
  ErrorModal:            'components/ErrorModal.tsx',
  Fanemailmodal:         'components/Fanemailmodal.tsx',
  FeedbackSuccessModal:  'components/FeedbackSuccessModal.tsx',
  PurchaseStatusModal:   'components/PurchaseStatusModal.tsx',
  SuccessCelebration:    'components/SuccessCelebrationModal.tsx',
  TrackingPasswordModal: 'components/TrackingPasswordModal.tsx',
  UndoConfirmModal:      'components/UndoConfirmModal.tsx',
  UpdateRequiredModal:   'components/UpdateRequiredModal.tsx',
  ConfirmRaceResult:     'screens/EventDetails/ConfirmRaceResultModal.tsx',
};

// Each rule names a device the redesign retired, and where it was found before.
export const RULES = [
  { id: 'welded-button',
    why: 'square-cornered button fused to a card edge (fixed on ParticipantList, AthleteSearch)',
    test: (c) => /borderRadius:\s*0\b/.test(c) },
  { id: 'off-ramp-radius',
    why: 'a box radius outside 10/14/16 (circles exempt)',
    test: (c) => [...c.matchAll(/[a-zA-Z]\w*:\s*\{[^{}]*\}/g)].some((b) => {
      const r = b[0].match(/borderRadius:\s*(\d+)/);
      if (!r) return false;
      const n = +r[1];
      if (n <= 4 || [10, 14, 16, 999].includes(n)) return false;
      const w = b[0].match(/width:\s*(\d+)/), h = b[0].match(/height:\s*(\d+)/);
      if (w && h && w[1] === h[1] && Math.abs(n - +w[1] / 2) < 1) return false;  // circle
      return true;
    }) },
  { id: 'pipe-separator',
    why: 'a "|" between meta values where the deck uses "·"',
    test: (c) => /<Text[^>]*>\s*\|\s*<\/Text>/.test(c) },
  { id: 'hand-rolled-shadow',
    why: 'shadowOpacity outside the four shadow tokens',
    test: (c) => /shadowOpacity:/.test(c) },
  { id: 'named-colour',
    why: 'a CSS colour name instead of a token',
    test: (c) => /(?:color=|color:\s*)['"](black|white|red|blue|green|gray|grey)['"]/.test(c) },
  { id: 'coloured-rgba',
    why: 'a palette value written by hand (this is how the retired blue survived)',
    test: (c) => [...c.matchAll(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g)]
      .some((m) => !(m[1] === m[2] && m[2] === m[3])) },
  { id: 'raw-hex',
    why: 'a hex colour outside the palette',
    test: (c) => /(['"])#[0-9a-fA-F]{3,8}\1/.test(c) },
];

if (process.argv.includes('--selftest')) {
  const cases = [
    ['welded-button', 'a: { borderRadius: 0 }', true],
    ['welded-button', 'a: { borderRadius: 14 }', false],
    ['off-ramp-radius', 'a: { borderRadius: 30 }', true],
    ['off-ramp-radius', 'a: { borderRadius: 10 }', false],
    ['off-ramp-radius', 'a: { width: 60, height: 60, borderRadius: 30 }', false],
    ['coloured-rgba', "fill: 'rgba(59, 130, 246, .2)'", true],
    ['coloured-rgba', "fill: 'rgba(0, 0, 0, .2)'", false],
    ['pipe-separator', '<Text style={s.t}>|</Text>', true],
  ];
  let ok = true;
  for (const [id, sample, want] of cases) {
    const got = RULES.find((r) => r.id === id).test(sample);
    if (got !== want) ok = false;
    console.log(`  ${got === want ? 'PASS' : 'FAIL'}  ${id} on ${JSON.stringify(sample)} -> ${got}`);
  }
  console.log(ok ? '\nself-test passed' : '\nSELF-TEST FAILED');
  process.exit(ok ? 0 : 1);
}

console.log('\nScreens with no mockup — retired devices still in use');
console.log('─────────────────────────────────────────────────────\n');
let total = 0;
for (const [name, rel] of Object.entries(UNCOVERED)) {
  const f = join(ROOT, 'src', rel);
  if (!existsSync(f)) { console.log(`  ${name.padEnd(22)} FILE MISSING (${rel})`); continue; }
  const src = readFileSync(f, 'utf8');
  const hits = RULES.filter((r) => r.test(src));
  if (hits.length) {
    total += hits.length;
    console.log(`  ${name}`);
    for (const h of hits) console.log(`      ${h.id.padEnd(20)} ${h.why}`);
  }
}
console.log(`\n  ${total} retired device(s) across ${Object.keys(UNCOVERED).length} unmocked screens.`);
