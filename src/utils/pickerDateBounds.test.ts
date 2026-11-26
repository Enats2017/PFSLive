/**
 * Tests for pickerDateBounds.ts. Run: npm run test:picker-date-bounds
 *
 * No test framework in this repo - plain asserts, exit code 1 on failure.
 *
 * Feedback #54 (2026-11-25, Android, app 1.0.9): a participant born 03-06-1962
 * could not enter that date; his account (8524) was created with 1970-01-01.
 * androidClamp() below is a line-for-line port of the clamp listener in
 * node_modules/@react-native-community/datetimepicker/android/.../
 * RNDatePickerDialogFragment.java + Common.minDateWithTimeZone() /
 * maxDateWithTimeZone(), so these tests reproduce the real device behaviour.
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { resolvePickerMinimumDate, defaultPickerMinimumDate } from './pickerDateBounds';

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

// ── Port of the native clamp (datetimepicker 8.4.4, Android >= O) ──────────
// Listener is installed only when a max OR min was passed. Without a min,
// minDateWithTimeZone() returns 0; without a max, maxDate is Long.MAX_VALUE.
function androidClamp(picked: Date, minimumDate?: Date, maximumDate?: Date): Date {
  if (!minimumDate && !maximumDate) return picked; // no listener installed
  const min = minimumDate
    ? new Date(minimumDate.getFullYear(), minimumDate.getMonth(), minimumDate.getDate(), 0, 0, 0, 0).getTime()
    : 0;
  const max = maximumDate
    ? new Date(maximumDate.getFullYear(), maximumDate.getMonth(), maximumDate.getDate(), 23, 59, 59, 999).getTime()
    : Number.MAX_SAFE_INTEGER;
  const ts = new Date(picked.getFullYear(), picked.getMonth(), picked.getDate(), 0, 0, 0).getTime();
  return new Date(Math.min(Math.max(ts, min), max));
}
const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const today = new Date();
const born1962 = new Date(1962, 5, 3); // 03-06-1962, feedback #54

console.log('== reproduction: the bug as shipped (maximumDate only) ==');

test('#54: 03-06-1962 with maximumDate and no minimumDate snaps to the epoch day', () => {
  // The epoch is 1970-01-01 00:00 UTC; in any timezone east of UTC (Belgium,
  // NL, FR) that is 1970-01-01 local - the exact value stored for 8524.
  const out = androidClamp(born1962, undefined, today);
  assert.ok(out.getFullYear() === 1970 || out.getFullYear() === 1969, `got ${ymd(out)}`);
  assert.notStrictEqual(ymd(out), '1962-06-03');
});

console.log('== resolvePickerMinimumDate ==');

test('maximumDate without minimumDate -> 1900-01-01 floor', () => {
  assert.strictEqual(ymd(resolvePickerMinimumDate(undefined, today)!), '1900-01-01');
});
test('caller minimumDate always wins (personal-event pickers pass their own)', () => {
  const min = new Date(2026, 10, 26);
  assert.strictEqual(resolvePickerMinimumDate(min, today), min);
  assert.strictEqual(resolvePickerMinimumDate(min, undefined), min);
});
test('no bounds at all -> undefined (library installs no clamp, keeps its 1900 default)', () => {
  assert.strictEqual(resolvePickerMinimumDate(undefined, undefined), undefined);
});
test('a fresh Date each call (no shared mutable instance)', () => {
  assert.notStrictEqual(defaultPickerMinimumDate(), defaultPickerMinimumDate());
});

console.log('== fixed behaviour through the native clamp ==');

const fixedMin = resolvePickerMinimumDate(undefined, today);
for (const [d, m, y] of [[3, 6, 1962], [31, 12, 1969], [1, 1, 1935], [15, 3, 1907], [1, 1, 1970], [10, 4, 1997]]) {
  test(`${d}-${m}-${y} survives with the floor`, () => {
    assert.strictEqual(ymd(androidClamp(new Date(y, m - 1, d), fixedMin, today)), `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  });
}
test('future date is still clamped to today (ced2613 behaviour kept)', () => {
  const future = new Date(today.getFullYear() + 3, 0, 1);
  assert.strictEqual(ymd(androidClamp(future, fixedMin, today)), ymd(today));
});

console.log('== source guards ==');

const src = fs.readFileSync(path.join(process.cwd(), 'src', 'components', 'FloatingLabelInput.tsx'), 'utf8');
test('FloatingLabelInput date pickers pass the resolved minimum, never the raw prop', () => {
  const dateBlocks = src.split('<DateTimePicker').slice(1).filter(b => /mode="date"/.test(b.slice(0, 200)));
  assert.strictEqual(dateBlocks.length, 2, 'expected the iOS and the Android date picker');
  for (const b of dateBlocks) {
    const props = b.slice(0, b.indexOf('/>'));
    assert.ok(/minimumDate=\{effectiveMinimumDate\}/.test(props), 'date picker without effectiveMinimumDate');
  }
  assert.ok(/resolvePickerMinimumDate\(minimumDate, maximumDate\)/.test(src));
});
test('birth-date fields still block the future (maximumDate kept) and stay optional', () => {
  for (const f of ['src/screens/AuthScreens/RegisterScreen.tsx', 'src/screens/AuthScreens/EditProfileScreen.tsx']) {
    const s = fs.readFileSync(path.join(process.cwd(), f), 'utf8');
    assert.ok(/isDatePicker[\s\S]{0,600}maximumDate=\{new Date\(\)\}/.test(s), f);
  }
  // DOB is optional (Apple): the picker floor must not turn into a required rule.
  const v = fs.readFileSync(path.join(process.cwd(), 'src/services/validation/authValidation.ts'), 'utf8');
  assert.ok(/\/\/ if \(!data\.dob\) \{/.test(v), 'dob_required must stay commented out');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
