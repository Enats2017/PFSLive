#!/usr/bin/env node
/**
 * device-check.mjs — the on-device half of the check suite.
 *
 * Every other script in here reads source. This one reads the RUNNING app,
 * because the redesign's geometry (spacing, centring, truncation, clipping)
 * cannot be proved by arithmetic — and neither can a render-time crash.
 *
 * It is built to be run by hand and to print a SMALL report: the full logcat
 * goes to a file, and only deduplicated errors reach stdout. Paste the summary
 * block, not the log.
 *
 *   node scripts/device-check.mjs             launch the app, watch 20s, report
 *   node scripts/device-check.mjs --watch     keep watching while you navigate
 *                                             (Ctrl+C to stop and get a report)
 *   node scripts/device-check.mjs --shot home grab a screenshot to .device/
 *   node scripts/device-check.mjs --selftest  verify the parser, no device
 *
 * Notes that cost real time if you rediscover them:
 *   - App.tsx installs a global ErrorUtils handler that SWALLOWS uncaught JS
 *     errors in production builds. In a dev-client build they surface here; in
 *     a release build a screen can fail silently. Check with a dev build.
 *   - Errors are matched by tag AND by level, because Hermes logs some throws
 *     under ReactNativeJS at level E and others at W with an "Error:" body.
 */

import { execFileSync, spawn } from 'child_process';
import { mkdirSync, writeFileSync, appendFileSync } from 'fs';

const PKG = 'eu.passionforsports.livio';
const OUT_DIR = '.device';
const LOG = `${OUT_DIR}/logcat.txt`;

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const argOf = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };

/* ── log parsing ────────────────────────────────────────────────────────── */

// Tags worth surfacing. AndroidRuntime is a native crash; the rest are JS.
const ERROR_TAGS = /\b(AndroidRuntime|ReactNativeJS|ReactNative|SoLoader|Hermes|libc)\b/;
// Lines whose BODY reads like a failure even at a lower level.
const ERROR_BODY = /\b(FATAL EXCEPTION|Unhandled|Unable to|TypeError|ReferenceError|SyntaxError|RangeError|Invariant Violation|Warning: Failed prop|is not a function|undefined is not|Cannot read propert|Render Error|red ?box)\b/i;
// Chatter that is loud, harmless, and would drown the real signal.
const IGNORE = /\b(Accessing hidden|OpenGLRenderer|Choreographer|Davey|BpBinder|libEGL|ProxyAndroidLoggerBackend|chatty|GraphicBufferAllocator|CCodec|BufferQueue|NetworkSecurityConfig|InsetsController|ImeTracker)\b/;

export function classify(line) {
  if (!line || IGNORE.test(line)) return null;
  // logcat threadtime: "MM-DD HH:MM:SS.mmm  PID  TID L TAG: message"
  const m = line.match(/^\d\d-\d\d \d\d:\d\d:\d\d\.\d+\s+\d+\s+\d+\s+([VDIWEF])\s+([^:]+):\s?(.*)$/);
  const level = m ? m[1] : null;
  const tag = m ? m[2].trim() : null;
  const body = m ? m[3] : line;
  const isError =
    (level === 'E' || level === 'F') && (tag ? ERROR_TAGS.test(tag) : true) ||
    ERROR_BODY.test(body);
  if (!isError) return null;
  return { level: level ?? '?', tag: tag ?? '?', body: body.trim() };
}

/** Collapse repeats: the same fault re-renders every frame. */
export function summarise(entries) {
  const seen = new Map();
  for (const e of entries) {
    // Numbers and addresses differ per occurrence; key on the shape.
    const key = `${e.tag}|${e.body.replace(/0x[0-9a-f]+/gi, '#').replace(/\d+/g, '#').slice(0, 160)}`;
    const hit = seen.get(key);
    if (hit) hit.count++;
    else seen.set(key, { ...e, count: 1 });
  }
  return [...seen.values()].sort((a, b) => b.count - a.count);
}

/* ── self-test ──────────────────────────────────────────────────────────── */

if (has('--selftest')) {
  const fixtures = [
    ['09-07 11:02:03.123  4211  4230 E ReactNativeJS: TypeError: undefined is not a function', true],
    ['09-07 11:02:03.123  4211  4230 E AndroidRuntime: FATAL EXCEPTION: main', true],
    ['09-07 11:02:03.123  4211  4230 I ReactNativeJS: Warning: Failed prop type: bad', true],
    ['09-07 11:02:03.123  4211  4230 D OpenGLRenderer: davey! duration=700ms', false],
    ['09-07 11:02:03.123  4211  4230 E chatty: uid=1000 expire 4 lines', false],
    ['09-07 11:02:03.123  4211  4230 I ReactNativeJS: fetched 12 events', false],
    ['09-07 11:02:03.123  4211  4230 E libc: Fatal signal 11', true],
  ];
  let bad = 0;
  for (const [line, want] of fixtures) {
    const got = classify(line) !== null;
    if (got !== want) { bad++; console.log(`  MISMATCH want=${want} got=${got}  ${line.slice(0, 70)}`); }
  }
  // Dedup must collapse varying numbers but keep distinct faults apart.
  const s = summarise([
    classify('09-07 11:02:03.1  1 2 E ReactNativeJS: Cannot read property x of undefined at line 12'),
    classify('09-07 11:02:04.2  1 2 E ReactNativeJS: Cannot read property x of undefined at line 99'),
    classify('09-07 11:02:05.3  1 2 E ReactNativeJS: Invariant Violation: text strings must be rendered'),
  ]);
  if (s.length !== 2) { bad++; console.log(`  dedup: expected 2 groups, got ${s.length}`); }
  if (s[0].count !== 2) { bad++; console.log(`  dedup: expected count 2, got ${s[0].count}`); }
  console.log(bad === 0 ? 'device-check self-test passed' : `device-check self-test FAILED (${bad})`);
  process.exit(bad === 0 ? 0 : 1);
}

/* ── device helpers ─────────────────────────────────────────────────────── */

const adb = (...a) => execFileSync('adb', a, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });

function devices() {
  try {
    return adb('devices').split('\n').slice(1)
      .map((l) => l.trim()).filter(Boolean)
      .filter((l) => l.endsWith('device')).map((l) => l.split(/\s+/)[0]);
  } catch { return null; }
}

const list = devices();
if (list === null) { console.log('adb is not on PATH. Install platform-tools, then re-run.'); process.exit(2); }
if (list.length === 0) {
  console.log('No device. Plug in over USB with debugging on (or `adb connect <ip>:5555`), then re-run.');
  process.exit(2);
}
if (list.length > 1) console.log(`note: ${list.length} devices; adb will use the first unless ANDROID_SERIAL is set`);

mkdirSync(OUT_DIR, { recursive: true });

if (has('--shot')) {
  const name = argOf('--shot') || 'shot';
  const path = `${OUT_DIR}/${name}.png`;
  writeFileSync(path, execFileSync('adb', ['exec-out', 'screencap', '-p'], { maxBuffer: 64 * 1024 * 1024 }));
  console.log(`saved ${path}`);
  process.exit(0);
}

let installed = '';
try { installed = adb('shell', 'dumpsys', 'package', PKG, '|', 'grep', 'versionName') || ''; } catch { /* below */ }
if (!/versionName/.test(installed)) {
  try { installed = adb('shell', 'dumpsys', 'package', PKG); } catch { installed = ''; }
}
if (!installed.trim()) {
  console.log(`${PKG} is not installed on this device. Build and install a dev client first:`);
  console.log('  npm run android');
  process.exit(2);
}
const version = (installed.match(/versionName=(\S+)/) || [])[1] || 'unknown';

/* ── run ────────────────────────────────────────────────────────────────── */

const watch = has('--watch');
const seconds = Number(argOf('--seconds') || (watch ? 0 : 20));

try { adb('logcat', '-c'); } catch { /* some ROMs refuse; harmless */ }
try {
  adb('shell', 'monkey', '-p', PKG, '-c', 'android.intent.category.LAUNCHER', '1');
} catch {
  console.log('could not launch the app; watching anyway');
}

writeFileSync(LOG, '');
const found = [];
const proc = spawn('adb', ['logcat', '-v', 'threadtime']);
let carry = '';
proc.stdout.on('data', (buf) => {
  const text = carry + buf.toString('utf8');
  const lines = text.split('\n');
  carry = lines.pop() ?? '';
  for (const line of lines) {
    appendFileSync(LOG, line + '\n');
    const hit = classify(line);
    if (hit) found.push(hit);
  }
});

function report(reason) {
  try { proc.kill(); } catch { /* already gone */ }
  const groups = summarise(found);
  const crashed = groups.some((g) => /AndroidRuntime|FATAL|libc/.test(g.tag + g.body));
  console.log('');
  console.log('──────── device check ────────');
  console.log(`app        ${PKG} ${version}`);
  console.log(`watched    ${reason}`);
  console.log(`verdict    ${crashed ? 'CRASH' : groups.length ? 'ERRORS' : 'clean'}`);
  console.log(`distinct   ${groups.length}${groups.length ? ` (${found.length} occurrences)` : ''}`);
  for (const g of groups.slice(0, 12)) {
    console.log(`  [${g.level}] ${g.tag} x${g.count}: ${g.body.slice(0, 150)}`);
  }
  if (groups.length > 12) console.log(`  … ${groups.length - 12} more, see ${LOG}`);
  console.log(`full log   ${LOG}`);
  console.log('──────────────────────────────');
  process.exit(crashed ? 1 : 0);
}

process.on('SIGINT', () => report('until you stopped it'));
if (seconds > 0) setTimeout(() => report(`${seconds}s after launch`), seconds * 1000);
else console.log(`watching ${PKG} — navigate the app, then press Ctrl+C for the report.`);
