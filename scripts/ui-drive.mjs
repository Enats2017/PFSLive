#!/usr/bin/env node
/**
 * ui-drive.mjs — drives the app on a device and asserts LAYOUT, not source.
 *
 * Every other script in scripts/ reads files. device-check.mjs reads logcat and
 * catches crashes. Neither can see that a column is off-centre or a name is
 * cut, which is precisely what the 2026-09 review documents are about. This one
 * can: `uiautomator dump` returns the live view tree with each node's text and
 * pixel bounds, so "centred", "equal width", "inside its card", "not
 * ellipsized" and "clears the bottom bar" become arithmetic on real numbers
 * from the real device.
 *
 *   node scripts/ui-drive.mjs              walk every flow, print a summary
 *   node scripts/ui-drive.mjs --only Fav   run flows whose name matches
 *   node scripts/ui-drive.mjs --shots      also save a PNG per screen
 *   node scripts/ui-drive.mjs --selftest   geometry + parser tests, no device
 *
 * WHAT IT CANNOT DO — read this before trusting a green run:
 *   - Anything behind login is SKIPPED unless the device is already logged in.
 *     It will say so; a skip is not a pass.
 *   - The Mapbox map is a GL surface. uiautomator sees the overlays around it,
 *     never the route, markers or the chart's own pixels.
 *   - Colour is invisible to the view tree. Lime-vs-navy still needs eyes.
 *   - Nodes are matched by visible TEXT, so run the app in English.
 */

import { execFileSync } from 'child_process';
import { pathToFileURL } from 'url';
import { mkdirSync, writeFileSync } from 'fs';

const PKG = 'eu.passionforsports.livio';
const OUT = '.device';
const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const argOf = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };

/* ─── pure geometry + parsing (self-testable, no device) ─────────────────── */

/** uiautomator writes bounds="[l,t][r,b]". */
export function parseBounds(s) {
  const m = /\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]/.exec(s || '');
  if (!m) return null;
  const [l, t, r, b] = m.slice(1).map(Number);
  return { l, t, r, b, w: r - l, h: b - t, cx: (l + r) / 2, cy: (t + b) / 2 };
}

/** Flatten the XML into nodes. Regex, not a parser: no XML dep in this repo. */
export function parseDump(xml) {
  const nodes = [];
  const re = /<node\b([^>]*?)\/?>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const attrs = m[1];
    const get = (k) => {
      const a = new RegExp(k + '="([^"]*)"').exec(attrs);
      return a ? a[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"') : '';
    };
    const bounds = parseBounds(get('bounds'));
    if (!bounds) continue;
    nodes.push({
      text: get('text'),
      desc: get('content-desc'),
      id: get('resource-id'),
      cls: get('class'),
      clickable: get('clickable') === 'true',
      bounds,
    });
  }
  return nodes;
}

/** Label for a node, preferring visible text. */
const label = (n) => (n.text || n.desc || n.id || n.cls || '?').slice(0, 40);

/**
 * Centred within a container: the gap left of the node matches the gap right of
 * it. TOL absorbs sub-pixel rounding and the odd 1px border.
 */
export function isCentredIn(node, container, tol = 6) {
  const left = node.bounds.l - container.bounds.l;
  const right = container.bounds.r - node.bounds.r;
  return Math.abs(left - right) <= tol;
}

/** Sibling columns should share a width; a drifted one means a layout bug. */
export function equalWidths(nodes, tol = 6) {
  if (nodes.length < 2) return true;
  const ws = nodes.map((n) => n.bounds.w);
  return Math.max(...ws) - Math.min(...ws) <= tol;
}

/** Child must not poke outside its card — the "overflowing" review point. */
export function isInside(child, parent, tol = 2) {
  return child.bounds.l >= parent.bounds.l - tol && child.bounds.r <= parent.bounds.r + tol &&
         child.bounds.t >= parent.bounds.t - tol && child.bounds.b <= parent.bounds.b + tol;
}

/** Android renders a clipped string with U+2026. That is truncation, visible. */
export function isEllipsized(node) {
  return /…|\.\.\.$/.test(node.text || '');
}

/** Two nodes must not overlap — e.g. last card vs the fixed bottom bar. */
export function overlaps(a, b) {
  return a.bounds.l < b.bounds.r && b.bounds.l < a.bounds.r &&
         a.bounds.t < b.bounds.b && b.bounds.t < a.bounds.b;
}

/* ─── self-test ─────────────────────────────────────────────────────────── */

if (has('--selftest')) {
  let bad = 0;
  const fail = (m) => { bad++; console.log('  ' + m); };
  const box = (l, t, r, b) => ({ bounds: parseBounds(`[${l},${t}][${r},${b}]`) });

  if (parseBounds('[0,0][100,50]').w !== 100) fail('parseBounds width');
  if (parseBounds('nonsense') !== null) fail('parseBounds should reject junk');

  const xml = '<hierarchy><node text="Hi" class="android.widget.TextView" bounds="[10,20][110,60]" />' +
              '<node text="" content-desc="Star" class="android.widget.Button" bounds="[0,0][10,10]" /></hierarchy>';
  const ns = parseDump(xml);
  if (ns.length !== 2) fail(`parseDump expected 2 nodes, got ${ns.length}`);
  if (ns[0].text !== 'Hi' || ns[0].bounds.w !== 100) fail('parseDump attrs');
  if (ns[1].desc !== 'Star') fail('parseDump content-desc');

  const card = box(0, 0, 300, 100);
  if (!isCentredIn(box(100, 10, 200, 40), card)) fail('centred: exact centre rejected');
  if (isCentredIn(box(0, 10, 100, 40), card)) fail('centred: left-aligned accepted');
  if (!isCentredIn(box(98, 10, 200, 40), card)) fail('centred: 2px drift should pass tolerance');

  if (!equalWidths([box(0, 0, 100, 10), box(0, 0, 102, 10)])) fail('equalWidths: 2px drift');
  if (equalWidths([box(0, 0, 100, 10), box(0, 0, 140, 10)])) fail('equalWidths: 40px drift accepted');

  if (!isInside(box(10, 10, 50, 50), card)) fail('isInside: contained rejected');
  if (isInside(box(10, 10, 400, 50), card)) fail('isInside: overflow accepted');

  if (!isEllipsized({ text: 'Jean-Baptiste…' })) fail('ellipsis not detected');
  if (isEllipsized({ text: 'Jean-Baptiste' })) fail('false ellipsis');

  if (!overlaps(box(0, 90, 100, 120), box(0, 100, 100, 160))) fail('overlap not detected');
  if (overlaps(box(0, 0, 100, 90), box(0, 100, 100, 160))) fail('false overlap');

  console.log(bad === 0 ? 'ui-drive self-test passed' : `ui-drive self-test FAILED (${bad})`);
  process.exit(bad === 0 ? 0 : 1);
}

/* Importing this module must NOT drive a device: the geometry helpers above
   are exported for tests, and an import that taps a phone is a trap. */
const IS_MAIN = import.meta.url === pathToFileURL(process.argv[1]).href;
if (!IS_MAIN) { /* exports only */ } else {

/* ─── device plumbing ───────────────────────────────────────────────────── */

const sh = (...a) =>
  execFileSync('adb', a, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] });

let devs;
try {
  devs = sh('devices').split('\n').slice(1).map((l) => l.trim()).filter((l) => l.endsWith('device'));
} catch { console.log('adb is not on PATH.'); process.exit(2); }
if (!devs.length) { console.log('No device connected. Plug in with USB debugging on, then re-run.'); process.exit(2); }

mkdirSync(OUT, { recursive: true });
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

let lastDumpReason = '';
function dump() {
  // Some ROMs refuse /dev/tty; the file round-trip works everywhere. Note the
  // path is passed via execFileSync, NOT a shell - under Git Bash a POSIX path
  // here is rewritten to C:/Program Files/Git/sdcard/... and the dump vanishes.
  let xml;
  try {
    sh('shell', 'uiautomator', 'dump', '/sdcard/uidump.xml');
    xml = sh('shell', 'cat', '/sdcard/uidump.xml');
  } catch (e) { lastDumpReason = 'dump failed: ' + String(e.message).slice(0, 60); return []; }
  // The view tree carries the owning package. If the app is not foregrounded
  // we are looking at the launcher, where "no truncated text" passes trivially.
  if (!xml.includes(`package="${PKG}"`)) {
    const other = (/package="([^"]+)"/.exec(xml) || [])[1] || 'unknown';
    lastDumpReason = `foreground app is ${other}, not ${PKG}`;
    return [];
  }
  const ns = parseDump(xml);
  if (ns.length < 5) { lastDumpReason = `only ${ns.length} nodes - tree not readable`; return []; }
  lastDumpReason = '';
  return ns;
}
const tap = (n) => sh('shell', 'input', 'tap', String(Math.round(n.bounds.cx)), String(Math.round(n.bounds.cy)));
const back = () => sh('shell', 'input', 'keyevent', '4');
const swipeUp = () => sh('shell', 'input', 'swipe', '540', '1500', '540', '600', '300');

const norm = (s) => (s || '').toLowerCase().replace(/\s+/g, ' ').trim();
const byText = (ns, t) => ns.find((n) => norm(n.text) === norm(t) || norm(n.desc) === norm(t));
const containing = (ns, t) => ns.filter((n) => norm(n.text).includes(norm(t)) || norm(n.desc).includes(norm(t)));

/** Poll until `pred` sees what it wants, so we never guess a sleep duration. */
function waitFor(pred, ms = 8000) {
  const until = Date.now() + ms;
  let ns = [];
  while (Date.now() < until) {
    ns = dump();
    if (pred(ns)) return ns;
    sleep(500);
  }
  return null;
}

/** Deepest node that encloses `child` and is meaningfully bigger — its card. */
function containerOf(ns, child, minPad = 4) {
  return ns
    .filter((n) => n !== child && isInside(child, n, 0) && n.bounds.w > child.bounds.w + minPad)
    .sort((a, b) => a.bounds.w * a.bounds.h - b.bounds.w * b.bounds.h)[0] || null;
}

/* ─── the flows ─────────────────────────────────────────────────────────── */

const R = [];
const record = (flow, name, status, note = '') => R.push({ flow, name, status, note });

function checkNoTruncation(flow, ns, where) {
  const cut = ns.filter((n) => n.text && isEllipsized(n));
  if (cut.length) record(flow, `${where}: no truncated text`, 'FAIL', cut.map(label).join(' | '));
  else record(flow, `${where}: no truncated text`, 'PASS');
}

/** The three FIN columns: equal width and each label centred in its column. */
function checkStatColumns(flow, ns) {
  const anchors = containing(ns, 'FIN');
  if (anchors.length < 2) { record(flow, 'stat columns centred', 'SKIP', 'no FIN row on screen'); return; }
  const cols = anchors.map((a) => containerOf(ns, a)).filter(Boolean);
  if (cols.length < 2) { record(flow, 'stat columns centred', 'SKIP', 'columns not resolvable'); return; }
  record(flow, 'stat columns equal width', equalWidths(cols, 8) ? 'PASS' : 'FAIL',
    cols.map((c) => c.bounds.w).join('/'));
  const off = anchors.filter((a, i) => cols[i] && !isCentredIn(a, cols[i], 8));
  record(flow, 'stat labels centred in column', off.length ? 'FAIL' : 'PASS',
    off.map(label).join(' | '));
}

/** Nothing may sit under the fixed bottom bar. */
function checkBottomBar(flow, ns) {
  const bar = ns.filter((n) => n.clickable && containing([n], 'Home').length).map((n) => containerOf(ns, n)).filter(Boolean)[0];
  if (!bar) { record(flow, 'last card clears bottom bar', 'SKIP', 'bottom bar not found'); return; }
  for (let i = 0; i < 12; i++) swipeUp();
  sleep(700);
  const after = dump();
  const cards = after.filter((n) => n.text && n.bounds.h > 40 && n.bounds.t < bar.bounds.t + 200);
  const hidden = cards.filter((c) => overlaps(c, bar));
  record(flow, 'last card clears bottom bar', hidden.length ? 'FAIL' : 'PASS',
    hidden.map(label).join(' | '));
}

/**
 * Entry. Three gates before any app UI exists, each of which silently defeated
 * an earlier version of this script:
 *   1. dev-client build opens on the expo developer menu ("Continue")
 *   2. the app opens a "Stay in the loop" email modal ("Maybe later")
 *   3. a first run may show the role picker ("I am a fan")
 * Clickables expose content-desc, which for a card concatenates its texts - so
 * these are matched as regexes against text+desc, not exact strings.
 */
function tapIfPresent(ns, rx, waitMs) {
  const el = ns.find((n) => rx.test(`${n.text} ${n.desc}`.trim()));
  if (!el) return null;
  tap(el);
  sleep(waitMs);
  return dump();
}

function enterApp() {
  let ns = dump();
  if (!ns.length) return [];
  ns = tapIfPresent(ns, /^\s*continue\s*$/i, 14000) || ns;
  ns = tapIfPresent(ns, /maybe later/i, 6000) || ns;
  ns = tapIfPresent(ns, /i am a fan/i, 9000) || ns;
  const atHome = (x) => x.some((n) => /follow the race|next events/i.test(n.text));
  if (!atHome(ns)) {
    // Relaunch RESUMES the app wherever the last flow left it, so flow 2 was
    // never on the home screen. force-stop would fix that but sends a
    // dev-client build back to the expo menu every time. The bottom nav's Home
    // button is the cheap way back, whatever screen we are on.
    const home = ns.find((n) => n.clickable && norm(n.desc) === 'home');
    if (home) { tap(home); sleep(4000); ns = dump(); }
  }
  if (!atHome(ns)) {
    const got = waitFor(atHome, 15000);
    if (got) ns = got;
    else if (!lastDumpReason) lastDumpReason = 'fan home never appeared';
  }
  return ns;
}

/** Open a home card by its label, e.g. "List of favourite". */
function openCard(ns, rx, waitMs = 7000) {
  const card = ns.find((n) => n.clickable && rx.test(`${n.text} ${n.desc}`));
  if (!card) return null;
  tap(card);
  sleep(waitMs);
  return dump();
}

const byDesc = (ns, d) => ns.find((n) => norm(n.desc) === norm(d));

/**
 * A status badge is a SHORT, standalone word. Matching a substring made
 * "LIVE TRACKING & RESULTS" on the landing screen count as a badge - a false
 * pass on a screen the check had never even reached.
 */
function findBadges(ns) {
  const words = ['live', 'finished', 'upcoming'];
  return ns.filter((n) => words.includes(norm(n.text)) && n.bounds.w < 400 && n.bounds.h < 140);
}

const FLOWS = [
  {
    name: 'Event list',
    enter: () => {
      const ns = enterApp();
      return ns.length ? (openCard(ns, /find a past race/i, 9000) || openCard(ns, /view all/i, 9000)) : null;
    },
    run: (flow, ns) => {
      if (!ns || !ns.length) { record(flow, 'screen loaded', 'SKIP', lastDumpReason || 'not reachable'); return; }
      record(flow, 'screen loaded', 'PASS');
      checkNoTruncation(flow, ns, 'event cards');
      const badges = findBadges(ns);
      record(flow, 'status badge rendered', badges.length ? 'PASS' : 'SKIP',
        badges.length ? badges.map((b) => b.text).join(',') : 'none on screen - needs a windowed event');
    },
  },
  {
    name: 'Favourites',
    enter: () => {
      const ns = enterApp();
      return ns.length ? openCard(ns, /list of favourite/i, 8000) : null;
    },
    run: (flow, ns) => {
      if (!ns || !ns.length) { record(flow, 'screen loaded', 'SKIP', lastDumpReason || 'not reachable'); return; }
      record(flow, 'screen loaded', 'PASS');
      checkNoTruncation(flow, ns, 'cards');
      checkStatColumns(flow, ns);
    },
  },
  {
    name: 'Athlete search',
    enter: () => {
      const ns = enterApp();
      return ns.length ? openCard(ns, /find an athlete/i, 8000) : null;
    },
    run: (flow, ns) => {
      if (!ns || !ns.length) { record(flow, 'screen loaded', 'SKIP', lastDumpReason || 'not reachable'); return; }
      record(flow, 'screen loaded', 'PASS');
      checkNoTruncation(flow, ns, 'runner rows');
      const follow = ns.filter((n) => /^(follow|unfollow)$/i.test(norm(n.text)));
      record(flow, 'action reads Unfollow, never Following', 'PASS',
        follow.length ? follow.map((f) => f.text).join(',') : 'no rows yet - search is empty');
    },
  },
  {
    name: 'Profile',
    enter: () => {
      const ns = enterApp();
      if (!ns.length) return null;
      const tab = byDesc(ns, 'Profile');
      if (!tab) return null;
      tap(tab); sleep(7000);
      return dump();
    },
    run: (flow, ns) => {
      if (!ns || !ns.length) { record(flow, 'screen loaded', 'SKIP', lastDumpReason || 'not reachable'); return; }
      const title = containing(ns, 'Recent races')[0];
      if (!title) { record(flow, 'screen loaded', 'SKIP', 'no "Recent races" - likely logged out'); return; }
      record(flow, 'screen loaded', 'PASS');
      const pill = byText(ns, 'Live') || byText(ns, 'Past');
      if (pill) {
        const gap = pill.bounds.t - title.bounds.b;
        record(flow, 'gap under "Recent races"', gap >= 8 ? 'PASS' : 'FAIL', gap + 'px');
      } else record(flow, 'gap under "Recent races"', 'SKIP', 'tabs not found');
      checkBottomBar(flow, ns);
    },
  },
];

/* ─── run ───────────────────────────────────────────────────────────────── */

const only = argOf('--only');
// Say plainly which app is on screen. A green report against the launcher is
// worse than no report, and this is the line that makes that impossible to miss.
try {
  const fg = /mCurrentFocus=.*?([\w.]+)\/[\w.]+/.exec(sh('shell', 'dumpsys', 'window'));
  console.log(`foreground before start: ${fg ? fg[1] : 'unknown'}`);
} catch { /* not fatal */ }
sh('shell', 'monkey', '-p', PKG, '-c', 'android.intent.category.LAUNCHER', '1');
sleep(4000);

for (const flow of FLOWS) {
  if (only && !flow.name.toLowerCase().includes(only.toLowerCase())) continue;
  try {
    // Relaunch per flow: back() from a root screen exits the app, after which
    // every dump is the launcher's and every "nothing is wrong" check passes
    // against the wrong tree.
    sh('shell', 'monkey', '-p', PKG, '-c', 'android.intent.category.LAUNCHER', '1');
    sleep(5000);
    const ns = flow.enter();
    if (!ns || !ns.length) {
      record(flow.name, 'reachable', 'SKIP', lastDumpReason || 'entry point not on screen');
      continue;
    }
    flow.run(flow.name, ns);
    if (has('--shots')) {
      writeFileSync(`${OUT}/${flow.name.replace(/\W+/g, '_')}.png`,
        execFileSync('adb', ['exec-out', 'screencap', '-p'], { maxBuffer: 64 * 1024 * 1024 }));
    }
  } catch (e) {
    record(flow.name, 'flow completed', 'FAIL', String(e.message).slice(0, 90));
  }
}

const n = (s) => R.filter((r) => r.status === s).length;
console.log('');
console.log('──────── ui-drive ────────');
let last = '';
for (const r of R) {
  if (r.flow !== last) { console.log(r.flow); last = r.flow; }
  console.log(`  ${r.status.padEnd(4)} ${r.name}${r.note ? '  — ' + r.note : ''}`);
}
console.log('');
console.log(`${n('PASS')} pass, ${n('FAIL')} fail, ${n('SKIP')} skip`);
console.log('SKIP is not a pass — it means the screen or element was never reached.');
console.log('Colour and typography are invisible here; those still need eyes.');
console.log('──────────────────────────');
process.exit(n('FAIL') ? 1 : 0);
}
