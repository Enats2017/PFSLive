// ✅ TRACKING LIFECYCLE LOCK (2026-11-26 audit of the Start/Stop layer).
//
// Same bug class as the two payment bugs found that day (a double tap that
// charged twice; a write that only happened while one screen was mounted):
//
//  - Stop had no re-entry guard. A second Stop (impatient tap while the first
//    one tore the engine down), or the 1 s finish tick and the foreground
//    handler both seeing raceFinished, ran the whole stop twice: two drains,
//    two log uploads, two toasts.
//  - Start was let through while a Stop was still draining / uploading (up to
//    ~42 s on a bad network — the Start button is back on screen from the
//    moment isGPSActive goes false). The old Stop then wrote into the NEW
//    session: it set logUploaded=1 (so the new session's finish log was never
//    uploaded), wiped its sent counter, and its stop log landing after the new
//    start ping made home_api and the watch cron treat the restart as stopped.
//
// Module-level, not a React ref: a Stop keeps running after HomeScreen is
// remounted (the header's home icon resets the stack), and the NEW instance
// must see that Stop too. No React, no native modules — the tracking harness
// tests it directly.
//
// Also carries a one-way "a session was started by a screen that is gone"
// signal: a Start that finished after its HomeScreen unmounted told nobody, so
// the new HomeScreen showed Start over a running engine.

// A Stop still "running" after this is hung (an await that never settles):
// it no longer blocks Start / Stop. drainForStop (30 s) + the log upload (12 s
// hard timeout) + teardown stay well inside it.
export const STOP_STUCK_MS = 120 * 1000;

let _stoppingAt = 0;
let _stopping = false;
// ✅ When the current claim began — touchStop never moves it (2026-11-26 second
// audit): a truly hung Stop, touched on every foreground, could hold the lock
// for ever. No claim outlives STOP_HARD_MAX_MS.
let _claimedAt = 0;
export const STOP_HARD_MAX_MS = 10 * 60 * 1000;
let _claim = 0;
// Who holds the lock: a real Stop, or HomeScreen's retry of an earlier Stop /
// finish log upload (drain-pending-finish). The retry is short (one upload,
// 12 s hard timeout) and must never cost a Stop or a Start (2026-11-26 re-audit:
// the finish Stop was REFUSED while the retry held the lock and the finish flag
// was lost — "Tracking active" over a stopped engine).
export type LockHolder = 'stop' | 'logRetry';
let _holder: LockHolder | null = null;
// Bumped by every real Stop: a Start compares it before / after the engine came
// up, so a Stop from ANY screen (also a new HomeScreen after a remount) during
// the start takes the fresh engine straight down (no orphan engine).
let _stopEpoch = 0;
// How long a Stop / Start waits for the log retry before giving up.
export const LOG_RETRY_WAIT_MS = 20 * 1000;
const POLL_MS = 250;
const _startedListeners = new Set<() => void>();
// ✅ APP-WIDE Start guard (2026-11-26 final check). HomeScreen's startingRef /
// startingAtRef used to be per screen: Start, the header's home icon (a NEW
// HomeScreen), Start again while the first was still waiting → two
// startWatchingPosition at once. HomeScreen now uses THESE two objects as its
// refs, so every existing guard and its finally act app-wide unchanged.
export const START_CLAIM_MS = 60 * 1000;   // = HomeScreen START_STUCK_MS
const _startingRef = { current: false };
const _startingAtRef = { current: 0 };
// Bumped right before an engine start: a Stop that was suspended (iOS, phone
// locked) and resumes after a NEW session started must not write into it.
let _startEpoch = 0;

export const trackingLifecycle = {
  /** True while a Stop (or the log retry) holds the lock (and is not hung). */
  isStopping(now: number = Date.now()): boolean {
    return _stopping && now - _stoppingAt < STOP_STUCK_MS && now - _claimedAt < STOP_HARD_MAX_MS;
  },

  /** Who holds the lock right now, or null. */
  holder(now: number = Date.now()): LockHolder | null {
    return this.isStopping(now) ? _holder : null;
  },

  /** Number of real Stops begun so far in this JS context. */
  stopEpoch(): number {
    return _stopEpoch;
  },

  /** The shared Start guard refs (HomeScreen's startingRef / startingAtRef). */
  startingRef: _startingRef,
  startingAtRef: _startingAtRef,

  /** A Start is running anywhere in the app (and not hung). */
  isStarting(now: number = Date.now()): boolean {
    return _startingRef.current && now - _startingAtRef.current < START_CLAIM_MS;
  },

  /** An engine start is about to happen (see _startEpoch). */
  noteEngineStart(): void {
    _startEpoch++;
  },
  startEpoch(): number {
    return _startEpoch;
  },

  /**
   * The lock holder is still alive: refresh its STOP_STUCK_MS clock. Called at
   * a Stop's milestones and when the app comes back to the foreground — an iOS
   * Stop suspended with the phone locked must not look "hung" and let a Start
   * in beside it when it resumes (2026-11-26 final check).
   */
  touchStop(now: number = Date.now()): void {
    if (_stopping) _stoppingAt = now;
  },

  /**
   * Claim the lock. Synchronous, so two callers in the same tick cannot both
   * get it. null = someone else holds it — the caller must not run beside it.
   * Returns a release function bound to THIS claim: a hung Stop that settles
   * late cannot release a newer one.
   */
  beginStop(now: number = Date.now(), kind: LockHolder = 'stop'): (() => void) | null {
    if (this.isStopping(now)) return null;
    _stopping = true;
    _stoppingAt = now;
    _claimedAt = now;
    _holder = kind;
    if (kind === 'stop') _stopEpoch++;
    const mine = ++_claim;
    return () => {
      if (_claim === mine) { _stopping = false; _holder = null; }
    };
  },

  /**
   * Wait until nobody holds the lock (true), or give up after maxMs (false).
   * Counted in polls, not by the clock, so a frozen clock cannot hang it.
   */
  async waitUntilFree(maxMs: number): Promise<boolean> {
    for (let i = 0; i * POLL_MS < maxMs; i++) {
      if (!this.isStopping()) return true;
      await new Promise((r) => setTimeout(r, POLL_MS));
    }
    return !this.isStopping();
  },

  /**
   * A Stop arriving while only the log retry holds the lock waits for it
   * (≤ LOG_RETRY_WAIT_MS) — and stops waiting the moment a REAL Stop holds it
   * (2026-11-26 second audit: two Stops waiting on the retry both ran, one after
   * the other — the second a full Stop with home ids and an extra toast).
   */
  async waitForLogRetry(): Promise<void> {
    for (let i = 0; i * POLL_MS < LOG_RETRY_WAIT_MS; i++) {
      if (this.holder() !== 'logRetry') return;
      await new Promise((r) => setTimeout(r, POLL_MS));
    }
  },

  /** A Start finished on a HomeScreen that is no longer mounted. */
  notifySessionStarted(): void {
    for (const cb of [..._startedListeners]) {
      try { cb(); } catch { /* a listener must never break the start */ }
    }
  },

  /** Subscribe (the mounted HomeScreen); returns the unsubscribe. */
  onSessionStarted(cb: () => void): () => void {
    _startedListeners.add(cb);
    return () => { _startedListeners.delete(cb); };
  },
};
