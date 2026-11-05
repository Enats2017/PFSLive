/**
 * Tests for freeTrackingStatus.ts. Run: npm run test:free-tracking-status
 *
 * No test framework in this repo - plain asserts, exit code 1 on failure.
 *
 * The backend states these mirror were measured against the real endpoints on
 * 2026-11-05, on a ticked distance, for somebody with NO website entry:
 *
 *   no membership              screen membership_required   tap membership_required
 *   membership, session left   screen available             tap registered (spends it)
 *   membership at its limit    screen limit_reached         tap limit_reached
 *
 * So the two states worth replacing are the two that block, and 'available'
 * must be left alone.
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import {
  freeTrackingModalStatus,
  type FreeTrackingDistanceLike,
  type ModalStatus,
} from './freeTrackingStatus';

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  PASS  ${name}`);
  } catch (e) {
    failed++;
    console.log(`  FAIL  ${name}\n        ${(e as Error).message}`);
  }
}

const d = (o: FreeTrackingDistanceLike): FreeTrackingDistanceLike => o;
const got = (o: FreeTrackingDistanceLike | null | undefined): ModalStatus | null =>
  freeTrackingModalStatus(o);

console.log('== the two blocked states on a ticked distance ==');

test('no membership -> free_not_registered, not membership_required', () => {
  assert.strictEqual(
    got(d({ registration_status: 'membership_required', free_tracking_included: 1, free_tracking_entitled: 0 })),
    'free_not_registered',
  );
});

test('at the limit -> free_not_registered, not limit_reached', () => {
  assert.strictEqual(
    got(d({ registration_status: 'limit_reached', free_tracking_included: 1, free_tracking_entitled: 0 })),
    'free_not_registered',
  );
});

console.log('\n== an entitled entrant is never diverted ==');

test('entitled + membership_required keeps the server status', () => {
  // Shouldn't happen (the gate lets an entrant through) but if the two ever
  // disagree, the server's answer wins rather than this file inventing one.
  assert.strictEqual(
    got(d({ registration_status: 'membership_required', free_tracking_included: 1, free_tracking_entitled: 1 })),
    'membership_required',
  );
});

test('entitled + limit_reached keeps the server status', () => {
  assert.strictEqual(
    got(d({ registration_status: 'limit_reached', free_tracking_included: 1, free_tracking_entitled: 1 })),
    'limit_reached',
  );
});

console.log('\n== states that must pass through untouched ==');

for (const s of ['available', 'registered', 'unavailable', 'membership_upcoming'] as const) {
  test(`${s} is untouched even when included=1 and entitled=0`, () => {
    assert.strictEqual(
      got(d({ registration_status: s, free_tracking_included: 1, free_tracking_entitled: 0 })),
      s,
    );
  });
}

test('available is untouched: a member may still spend a session', () => {
  // The whole point of not substituting this one - it was possible on any
  // distance before free tracking existed.
  assert.strictEqual(
    got(d({ registration_status: 'available', free_tracking_included: 1, free_tracking_entitled: 0 })),
    'available',
  );
});

console.log('\n== an ordinary paid distance is never affected ==');

for (const s of ['membership_required', 'limit_reached'] as const) {
  test(`${s} on an unticked distance stays ${s}`, () => {
    assert.strictEqual(
      got(d({ registration_status: s, free_tracking_included: 0, free_tracking_entitled: 0 })),
      s,
    );
  });
}

console.log('\n== missing fields fall back to today\'s behaviour ==');

test('an older API sending neither flag keeps the server status', () => {
  assert.strictEqual(got(d({ registration_status: 'membership_required' })), 'membership_required');
});

test('included sent but entitled absent keeps the server status', () => {
  // The backend can be uploaded before this app ships; until free_tracking_entitled
  // arrives there is nothing to decide on, and inventing one would promise the
  // wrong thing to an entrant.
  assert.strictEqual(
    got(d({ registration_status: 'membership_required', free_tracking_included: 1 })),
    'membership_required',
  );
});

test('nulls are treated as absent, not as zero-with-meaning', () => {
  assert.strictEqual(
    got(d({ registration_status: 'limit_reached', free_tracking_included: null, free_tracking_entitled: null })),
    'limit_reached',
  );
});

console.log('\n== degenerate input ==');

test('null distance -> null', () => { assert.strictEqual(got(null), null); });
test('undefined distance -> null', () => { assert.strictEqual(got(undefined), null); });
test('no registration_status -> null', () => {
  assert.strictEqual(got(d({ free_tracking_included: 1, free_tracking_entitled: 0 })), null);
});

console.log('\n== the copy exists in every language EventDetails has ==');

/* From the repo root, not __dirname: tsc emits this file into .cardtest/, where
   the sibling i18n folder does not exist. npm run always starts at the root. */
const i18nDir = path.join(process.cwd(), 'src', 'i18n', 'EventDetails');
const langs = fs.readdirSync(i18nDir).filter((f) => f.endsWith('.json'));

test(`found language files: ${langs.join(', ')}`, () => {
  assert.ok(langs.length >= 3, `expected at least en/nl/fr, got ${langs.join(',')}`);
});

for (const f of langs) {
  test(`${f} has registrationModal.free_not_registered with icon+title+description`, () => {
    const j = JSON.parse(fs.readFileSync(path.join(i18nDir, f), 'utf8'));
    const blk = j?.registrationModal?.free_not_registered;
    assert.ok(blk, 'the block is missing');
    for (const k of ['icon', 'title', 'description']) {
      assert.ok(typeof blk[k] === 'string' && blk[k].trim() !== '', `${k} is empty`);
    }
    // There IS a button, and it must not be a plans button: nothing is for
    // sale here, it opens Contact and Feedback.
    assert.ok(
      typeof blk.button === 'string' && blk.button.trim() !== '',
      'the contact button label is missing',
    );
    for (const sell of ['View plans', 'Get more sessions', 'Upgrade', 'plan', 'Plan']) {
      assert.ok(
        !String(blk.button).includes(sell),
        `the button reads like an upsell: "${blk.button}"`,
      );
    }
    // A dismiss beside it: a popup whose only button opens another screen
    // corners the reader. Reported by the user on 2026-11-05.
    assert.ok(
      typeof blk.notNowButton === 'string' && blk.notNowButton.trim() !== '',
      'the dismiss label is missing, so the popup has no way out but the backdrop',
    );
    // And the copy must not promise an e-mail change: the field is
    // editable={false} in EditProfileScreen ("Email cannot be changed here")
    // and the change flow is on an undeployed branch.
    for (const promise of ['account setting', 'accountinstelling', 'parametres du compte',
                           'change your e-mail', 'change your email',
                           'e-mailadres wijzigen', 'changer votre e-mail']) {
      assert.ok(
        !String(blk.description).toLowerCase().includes(promise.toLowerCase()),
        `the copy promises an e-mail change that the app cannot do: "${promise}"`,
      );
    }
  });
}

console.log('\n== the contact button goes to Contact and Feedback ==');

const modalSrc = fs.readFileSync(
  path.join(process.cwd(), 'src', 'components', 'RegistrationModal.tsx'),
  'utf8',
);

test('free_not_registered navigates to ContactFeedbackScreen, not the plans screen', () => {
  const at = modalSrc.indexOf("if (status === 'free_not_registered')");
  assert.ok(at > 0, 'no free_not_registered branch in the press handler');

  // The branch's OWN block only: slicing a fixed window would run past the
  // closing brace and pick up the plans navigation that legitimately follows
  // it, which is what a first version of this test did.
  const close = modalSrc.indexOf('\n  }', at);
  assert.ok(close > at, 'could not find the end of the branch');
  const branch = modalSrc.slice(at, close);

  assert.ok(
    branch.includes("navigate('ContactFeedbackScreen')"),
    'the branch does not open Contact and Feedback',
  );
  assert.ok(
    !branch.includes('MembershipPlansScreen'),
    'the branch itself reaches the plans screen',
  );
  // And it must return, or execution falls through to the plans navigation.
  assert.ok(/\breturn;/.test(branch), 'the branch does not return, so the plans screen wins');
  // Decided before the plans navigation, in source order.
  assert.ok(at < modalSrc.indexOf("navigate('MembershipPlansScreen')"), 'branch is too late');
});

test('the dismiss button closes the popup rather than navigating', () => {
  // The two-button row renders for connect_confirm AND free_not_registered,
  // and the secondary must call onClose. If the condition ever narrows back to
  // connect_confirm only, free_not_registered falls to the single-button
  // branch and loses its way out.
  assert.ok(
    modalSrc.includes("status === 'free_not_registered' && config.notNowLabel"),
    'the two-button row no longer covers free_not_registered',
  );
  const row = modalSrc.indexOf('<View style={styles.buttonRow}>');
  assert.ok(row > 0, 'the button row was not found');
  const firstBtn = modalSrc.slice(row, row + 700);
  assert.ok(
    firstBtn.includes('onPress={onClose}'),
    'the secondary button does not close the popup',
  );
  // It must not be the one that navigates.
  const upto = firstBtn.indexOf('onPress={onClose}');
  assert.ok(
    !firstBtn.slice(0, upto).includes('handleUpgradePress'),
    'the dismiss slot is wired to the navigating handler',
  );
});

test('free_not_registered is NOT an upgrade status', () => {
  const m = modalSrc.match(/UPGRADE_STATUSES[^=]*=\s*\[([^\]]*)\]/);
  assert.ok(m, 'UPGRADE_STATUSES not found');
  assert.ok(
    !m![1].includes('free_not_registered'),
    'listing it would make iOS render a plans button',
  );
});

test('ContactFeedbackScreen is a registered route', () => {
  const nav = fs.readFileSync(
    path.join(process.cwd(), 'src', 'navigation', 'AppNavigator.tsx'),
    'utf8',
  );
  assert.ok(
    nav.includes('name="ContactFeedbackScreen"'),
    'the route is not registered, so the button would throw',
  );
});

test('the Contact screen tolerates being opened with no params', () => {
  // The modal has no profile to hand it. The screen reads route.params?.profile
  // and the param is optional in RootStackParamList, so empty fields are the
  // worst case rather than a crash.
  const scr = fs.readFileSync(
    path.join(process.cwd(), 'src', 'screens', 'ProfileScreen', 'ContactFeedbackScreen.tsx'),
    'utf8',
  );
  assert.ok(scr.includes('route.params?.profile'), 'the screen reads params unguarded');
  const types = fs.readFileSync(
    path.join(process.cwd(), 'src', 'types', 'navigation.ts'),
    'utf8',
  );
  assert.ok(
    /ContactFeedbackScreen\?\s*:/.test(types),
    'the route param is not optional, so a param-less navigate would not type-check',
  );
});

test('every language that has free_not_registered also still has the two it replaces', () => {
  for (const f of langs) {
    const j = JSON.parse(fs.readFileSync(path.join(i18nDir, f), 'utf8'));
    const rm = j?.registrationModal ?? {};
    assert.ok(rm.membership_required, `${f} lost membership_required`);
    assert.ok(rm.limit_reached, `${f} lost limit_reached`);
  }
});

console.log(`\n  ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
