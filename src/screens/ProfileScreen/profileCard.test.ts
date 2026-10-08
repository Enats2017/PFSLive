/**
 * The six display states of the profile card, plus the copy each one renders.
 *
 * This repo has no test framework, so this is a plain script: no jest, no new
 * dependency. Run it with the toolchain already here —
 *
 *     npm run test:card
 *
 * which compiles this and profileCard.ts with the project's own tsc and runs
 * the result on node. profileCard.ts is deliberately RN-free so that works.
 *
 * WHAT IT ACTUALLY COVERS, and what it cannot
 *
 *   It asserts the DECISION (which of the six states, and whether the extra
 *   "it won't use a session" line belongs) and the RESOLVED STRINGS, read out
 *   of the real en/fr/nl dictionaries with the real interpolation. So a wrong
 *   state, a missing key, or a placeholder that does not get substituted all
 *   fail here.
 *
 *   It does NOT render React Native. Whether the line fits the card, wraps
 *   badly or sits in the wrong place is still a device check — but that is a
 *   layout question, and layout is not what gets the copy wrong.
 */

import { resolveProfileCard, CardProfileInput, CardState, CardExtraLine } from './profileCard';

/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require('fs');
const path = require('path');

// Read from the PROJECT ROOT, not relative to this file: the compiled copy of
// this test runs from a temp directory, so a relative require would not
// resolve. `npm run` sets cwd to the project root.
const i18nDir = path.join(process.cwd(), 'src', 'i18n', 'OwnProfile');
const dict = (f: string) => JSON.parse(fs.readFileSync(path.join(i18nDir, f), 'utf8'));

const DICTS: Record<string, any> = {
  en: dict('en.json'),
  fr: dict('fr.json'),
  nl: dict('nl.json'),
};

let pass = 0;
let fail = 0;

function ck(label: string, got: unknown, want: unknown): void {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  const shown = typeof got === 'string' ? JSON.stringify(got) : JSON.stringify(got);
  console.log(
    '  [' + (ok ? ' ok ' : 'FAIL') + '] ' + label.padEnd(58) + ' ' + shown +
      (ok ? '' : '   want ' + JSON.stringify(want)),
  );
  ok ? pass++ : fail++;
}

/** The i18next lookup this screen uses, reduced to what these keys need:
 *  dotted path, then {{placeholder}} substitution. A missing key returns the
 *  key itself, exactly as i18next renders it — which is the failure mode this
 *  is here to catch. */
function t(lang: string, key: string, vars: Record<string, string | number> = {}): string {
  const path = key.replace(/^ownProfile:/, '').split('.');
  let node: any = DICTS[lang];
  for (const seg of path) {
    if (node === undefined || node === null || typeof node !== 'object') { return key; }
    node = node[seg];
  }
  if (typeof node !== 'string') { return key; }
  return node.replace(/\{\{(\w+)\}\}/g, (_m, name) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : '{{' + name + '}}');
}

/** The same mapping OwnProfile.tsx performs, so what is asserted is the copy a
 *  viewer would actually read. */
function render(lang: string, profile: CardProfileInput) {
  const card = resolveProfileCard(profile);

  const freeLabel =
    card.freeEventName !== null
      ? card.freeEventName
      : t(lang, 'membershipCard.freeRacesCount', { count: card.freeEventCount });

  const extra =
    card.extraLine === 'alsoIncluded'
      ? t(lang, 'membershipCard.freeAlsoIncluded', { event: freeLabel })
      : card.extraLine === 'stillAvailable'
        ? t(lang, 'membershipCard.freeStillAvailable', { event: freeLabel })
        : null;

  let iosTitle: string;
  if (card.state === 'free_only') {
    iosTitle = t(lang, 'membershipCard.freeIncludedTitle');
  } else if (card.state === 'no_membership') {
    iosTitle = t(lang, 'membershipCard.noMembershipTitle');
  } else {
    iosTitle = 'Livio Pro ' + t(lang, 'membershipCard.liteTitle');
  }

  let androidTitle: string;
  switch (card.state) {
    case 'event_activation':
      androidTitle = t(lang, 'tracking.eventOnly', { event: card.activationEventName ?? '' });
      break;
    case 'unlimited':
      androidTitle = t(lang, 'tracking.unlimited');
      break;
    case 'sessions_left':
      androidTitle = t(lang, 'tracking.remaining', { count: card.remaining });
      break;
    case 'free_only':
      androidTitle = t(lang, 'tracking.freeIncluded', { event: freeLabel });
      break;
    default:
      androidTitle = t(lang, 'tracking.exhausted');
  }

  const activationLine =
    card.activationExtra !== null
      ? t(lang, 'membershipCard.alsoActivation', { event: card.activationExtra })
      : null;

  return { state: card.state, extra, iosTitle, androidTitle, freeLabel, activationLine };
}

// ── fixtures ────────────────────────────────────────────────────────────────
const race = (name: string, date: string) => ({ event_id: 13, event_name: name, race_date: date });

const BRUSSELS = race('Trail de Bruxelles', '2027-04-10');
const EPIC = race('Epic Trail', '2027-05-02');

const member = (remaining: number | null, unlimited = false) => ({
  has_membership: true, unlimited, remaining,
});

// ══════════════════════════════════════════════════════════════════════════
console.log('\nThe six display states (§6.1 of the plan)\n');

// 1. membership with sessions left, plus a free race
{
  const r = render('en', { membership_info: member(5), free_events: [BRUSSELS] });
  ck('1. sessions left -> state', r.state, 'sessions_left');
  ck('   android names the count', r.androidTitle, 'You have 5 live tracking session(s) left.');
  ck('   and the free line is ADDED', r.extra,
     "Trail de Bruxelles is included — it won't use a session.");
}

// 2. membership exhausted, plus a free race  <- the highest-value row
{
  const r = render('en', { membership_info: member(0), free_events: [BRUSSELS] });
  ck('2. exhausted -> state', r.state, 'exhausted');
  ck('   android still says none left', r.androidTitle, 'You have no live tracking sessions left.');
  ck('   but the card does NOT stop there', r.extra,
     "You can still track Trail de Bruxelles — it's included.");
}

// 3. unlimited: no extra line, because there is no session to save
{
  const r = render('en', { membership_info: member(null, true), free_events: [BRUSSELS] });
  ck('3. unlimited -> state', r.state, 'unlimited');
  ck('   no extra line (it would be noise)', r.extra, null);
}

// 4. the EUR 5.95 activation: unchanged, and no extra line
{
  const r = render('en', {
    membership_info: {
      has_membership: true, unlimited: false, remaining: 1,
      event_only: 1, event_activations: [{ event_name: 'Chouffe Trail', remaining: 1 }],
    },
    free_events: [BRUSSELS],
  });
  ck('4. activation -> state', r.state, 'event_activation');
  ck('   android keeps the activation copy', r.androidTitle,
     'Your Livio activation is valid for Chouffe Trail.');
  ck('   no extra line (two event names contradict)', r.extra, null);
}

// 4b-4e. the activation beside other cover (live-DB check, 2026-10-08)
{
  const two = render('en', {
    membership_info: {
      has_membership: true, unlimited: false, remaining: 2, event_only: 1,
      event_activations: [
        { event_name: 'Trail de Bruxelles', remaining: 1 },
        { event_name: 'GTLC Winter', remaining: 1 },
      ],
    },
  });
  ck('4b. two activations -> BOTH events named', two.androidTitle,
     'Your Livio activation is valid for Trail de Bruxelles & GTLC Winter.');

  const act = [{ event_name: 'Chouffe Trail', remaining: 1 }];
  const pro = render('en', { membership_info: { ...member(5), event_only: 0, event_activations: act } });
  ck('4c. Pro + activation -> still the count', pro.androidTitle, 'You have 5 live tracking session(s) left.');
  ck('    plus the activation line', pro.activationLine, 'Also valid: your Livio activation for Chouffe Trail.');

  const spent = render('en', { membership_info: { ...member(0), event_only: 0, event_activations: act } });
  ck('4d. Pro USED UP + activation -> exhausted', spent.state, 'exhausted');
  ck('    but the activation is not hidden', spent.activationLine,
     'Also valid: your Livio activation for Chouffe Trail.');

  const unl = render('en', { membership_info: { ...member(null, true), event_only: 0, event_activations: act } });
  ck('4e. unlimited + activation -> no line (noise)', unl.activationLine, null);

  const both = render('en', {
    membership_info: { ...member(3), event_only: 0, event_activations: act }, free_events: [BRUSSELS],
  });
  ck('4f. Pro + activation + free race -> both lines', [both.extra, both.activationLine], [
    "Trail de Bruxelles is included — it won't use a session.",
    'Also valid: your Livio activation for Chouffe Trail.',
  ]);
}

// 5. a free race and nothing else: the free race IS the card
{
  const r = render('en', { membership_info: null, free_events: [BRUSSELS] });
  ck('5. free only -> state', r.state, 'free_only');
  ck('   ios title is NOT "No Active Membership"', r.iosTitle, 'Tracking included');
  ck('   android names the race', r.androidTitle,
     'Tracking included for Trail de Bruxelles.');
}

// 6. nothing at all: untouched
{
  const r = render('en', { membership_info: null, free_events: [] });
  ck('6. nothing -> state', r.state, 'no_membership');
  ck('   ios title unchanged', r.iosTitle, 'No Active Membership');
  ck('   android title unchanged', r.androidTitle, 'You have no live tracking sessions left.');
  ck('   no extra line', r.extra, null);
}

console.log('\nThe branch that was easiest to get wrong\n');
// 'no_membership' is reached by remaining = 0 AND by no membership at all, so
// free_only has to be tested ahead of it - otherwise the one person who should
// be reassured reads "you have no sessions left".
{
  const spent = render('en', { membership_info: member(0), free_events: [] });
  const free = render('en', { membership_info: null, free_events: [BRUSSELS] });
  ck('a spent membership and a free race differ',
     spent.androidTitle !== free.androidTitle, true);
  ck('  the free one is never told it has nothing',
     free.androidTitle.indexOf('no live tracking') === -1, true);
}

console.log('\nMore than one free race is counted, not listed\n');
{
  const r = render('en', { membership_info: member(3), free_events: [BRUSSELS, EPIC] });
  ck('two races -> a count, not two names', r.freeLabel, '2 race(s)');
  ck('  neither name leaks into the line',
     r.extra!.indexOf('Trail de Bruxelles') === -1 && r.extra!.indexOf('Epic Trail') === -1, true);
  const one = render('en', { membership_info: member(3), free_events: [EPIC] });
  ck('one race -> named', one.freeLabel, 'Epic Trail');
}

console.log('\nEvery string resolves in all three languages\n');
// A missing key renders as the raw key with no error, so this is not something
// to eyeball. t() above returns the key itself on a miss, exactly as i18next
// does, which is what makes this assertable.
for (const lang of ['en', 'fr', 'nl']) {
  const states: Array<[string, CardProfileInput]> = [
    ['sessions_left', { membership_info: member(5), free_events: [BRUSSELS] }],
    ['exhausted',     { membership_info: member(0), free_events: [BRUSSELS] }],
    ['unlimited',     { membership_info: member(null, true), free_events: [BRUSSELS] }],
    ['free_only',     { membership_info: null, free_events: [BRUSSELS] }],
    ['no_membership', { membership_info: null, free_events: [] }],
    ['two_free',      { membership_info: member(2), free_events: [BRUSSELS, EPIC] }],
    ['activation_extra', { membership_info: { ...member(0), event_only: 0,
                           event_activations: [{ event_name: 'Chouffe Trail', remaining: 1 }] } }],
  ];
  let raw: string[] = [];
  for (const [name, profile] of states) {
    const r = render(lang, profile);
    for (const [what, value] of Object.entries({
      iosTitle: r.iosTitle, androidTitle: r.androidTitle,
      extra: r.extra ?? '', freeLabel: r.freeLabel, activationLine: r.activationLine ?? '',
    })) {
      const v = String(value);
      // An unresolved key still looks like one: dotted, no spaces.
      if (v !== '' && /^[a-zA-Z]+\.[a-zA-Z.]+$/.test(v)) { raw.push(name + '.' + what + '=' + v); }
      if (v.indexOf('{{') !== -1) { raw.push(name + '.' + what + ' has an unsubstituted placeholder: ' + v); }
    }
  }
  ck(lang + ': no raw keys, no unsubstituted placeholders', raw, []);
}

// And the three languages must not silently share a string where they should
// differ - a copy-paste of en into fr would pass everything above.
{
  const en = render('en', { membership_info: null, free_events: [BRUSSELS] });
  const fr = render('fr', { membership_info: null, free_events: [BRUSSELS] });
  const nl = render('nl', { membership_info: null, free_events: [BRUSSELS] });
  ck('fr is actually translated', fr.iosTitle !== en.iosTitle, true);
  ck('nl is actually translated', nl.iosTitle !== en.iosTitle, true);
  ck('  and fr differs from nl', fr.iosTitle !== nl.iosTitle, true);
}

console.log('\nThe payment-processing card still wins\n');
{
  const r = render('en', {
    in_process_payment: 1, membership_info: null, free_events: [BRUSSELS],
  });
  ck('a pending payment outranks the free card', r.state, 'payment_processing');
}

console.log('\nNothing explodes on a server that predates free_events\n');
{
  const r = render('en', { membership_info: member(4) });   // no free_events key
  ck('absent free_events -> no extra line', r.extra, null);
  ck('  and the normal card is unchanged', r.state, 'sessions_left');
  const empty = render('en', {});
  ck('an empty profile -> no_membership', empty.state, 'no_membership');
}

console.log('\n  ' + pass + ' passed, ' + fail + ' failed\n');
process.exit(fail === 0 ? 0 : 1);
