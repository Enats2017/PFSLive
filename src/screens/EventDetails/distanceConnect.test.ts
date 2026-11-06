/**
 * Tests for distanceConnect.ts. Run: npm run test:distance-connect
 *
 * No test framework in this repo - plain asserts, exit code 1 on failure.
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { canShowConnectButton } from './distanceConnect';

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

test('a closed distance has no button, signed in or not', () => {
  assert.strictEqual(canShowConnectButton({ registration_closed: 1, registration_status: 'unavailable' }), false);
  assert.strictEqual(canShowConnectButton({ registration_closed: 1 }), false);
});

test('a runner already on a closed distance keeps the button, to undo', () => {
  assert.strictEqual(canShowConnectButton({ registration_closed: 1, registration_status: 'registered' }), true);
});

test('an open distance keeps the button in every state', () => {
  for (const s of ['available', 'registered', 'membership_required', 'limit_reached', 'membership_upcoming']) {
    assert.strictEqual(canShowConnectButton({ registration_closed: 0, registration_status: s }), true, s);
  }
});

test('unavailable alone keeps the button: an event not configured yet', () => {
  assert.strictEqual(canShowConnectButton({ registration_closed: 0, registration_status: 'unavailable' }), true);
});

test('an API without the field keeps the button', () => {
  assert.strictEqual(canShowConnectButton({ registration_status: 'available' }), true);
  assert.strictEqual(canShowConnectButton({}), true);
});

const root = path.resolve(process.cwd(), 'src');

test('the closed popup exists in all three languages, with its own text', () => {
  for (const lang of ['en', 'fr', 'nl']) {
    const m = JSON.parse(fs.readFileSync(path.join(root, 'i18n/EventDetails', `${lang}.json`), 'utf8')).registrationModal;
    assert.ok(m.closed && m.closed.icon && m.closed.title && m.closed.description, lang);
    assert.notStrictEqual(m.closed.description, m.unavailable.description, lang);
  }
});

test('the card and the popup use it', () => {
  const tab = fs.readFileSync(path.join(root, 'screens/EventDetails/DistanceTab.tsx'), 'utf8');
  assert.ok(tab.includes('canShowConnectButton(item)'), 'DistanceTab hides the button');
  assert.ok(tab.includes('item.free_tracking_included === 1 && canShowConnectButton(item)'), 'no included badge on a closed distance');
  assert.ok(tab.includes('registrationClosed={selectedItem?.registration_closed === 1}'), 'DistanceTab passes it to the popup');
  const modal = fs.readFileSync(path.join(root, 'components/RegistrationModal.tsx'), 'utf8');
  assert.ok(modal.includes("details:registrationModal.closed"), 'the popup reads the closed text');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
