/**
 * Where the iOS (and fallback Android) device id is read from. Pure: the
 * SecureStore calls are injected, so the decision is tested without a device
 * (see authFlowGuards.test.ts).
 *
 * ✅ WHY (audit 2026-11-26, finding 7). The id was stored with expo-secure-store's
 * default WHEN_UNLOCKED, which iOS refuses to read while the phone is locked. The
 * read threw, was turned into "nothing stored", and getDeviceId() then fell back
 * to the CURRENT IDFV and cached it for the whole JS session. After a reinstall
 * the stored id is the OLD IDFV (the Keychain survives uninstall) and the account
 * is locked to it, so a process started in the background while locked (silent
 * push, background fetch, Transistor relaunch) sent a different device_id until it
 * died: a login there was refused device_not_allowed and offered a transfer that
 * moved the account to an id the next cold start no longer uses.
 *
 * Now:
 *  - A read that THROWS is not "nothing stored". The caller gets a value for this
 *    call only - never cached, never written - so the next call after unlock
 *    reads the real one.
 *  - The id is copied to a second key written with AFTER_FIRST_UNLOCK (readable
 *    while locked once unlocked after boot). The old key is never deleted or
 *    rewritten in place: SecureStore cannot change an existing item's
 *    accessibility without delete + re-add, and a crash in between would lose the
 *    id = lock the account. Reading v2 first, legacy second, is crash-safe and
 *    pure JS (OTA-safe on 1.0.9). AFTER_FIRST_UNLOCK, NOT ..._THIS_DEVICE_ONLY:
 *    the legacy item rides an encrypted backup to a new iPhone today, and the
 *    account's device lock should keep moving with it the same way.
 */

export type StoredRead =
  | { kind: 'found'; value: string }
  | { kind: 'empty' }
  | { kind: 'failed' };

export interface DeviceIdStoreDeps {
  readV2: () => Promise<string | null>;
  readLegacy: () => Promise<string | null>;
  writeV2: (value: string) => Promise<void>;
}

async function attempt(read: () => Promise<string | null>): Promise<StoredRead> {
  try {
    const v = await read();
    return v ? { kind: 'found', value: v } : { kind: 'empty' };
  } catch {
    return { kind: 'failed' };
  }
}

/**
 * ✅ What getDeviceId() answers when the store held NO usable id.
 *
 *  - Read failed + an OS id (IDFV): answer it for this call only. Never cache
 *    it - the stored id the account is locked to may differ and becomes
 *    readable once the phone unlocks.
 *  - Read failed + no OS id: a generated id, but the SAME one for the whole
 *    session (`sessionFallback`), kept in memory only - never cached as the
 *    device id, never persisted. A fresh random id per call changed device_id /
 *    X-Device-Id on every request (rate-limit buckets, follower rows, device
 *    lock) - review 2026-11-26.
 *  - Store empty (fresh install): the OS id or a generated one, persisted and
 *    cached as before.
 */
export function resolveUnstoredDeviceId(args: {
  readFailed: boolean;
  osId: string;
  sessionFallback: string | null;
  generate: () => string;
}): { id: string; persistAndCache: boolean; sessionFallback: string | null } {
  const { readFailed, osId, sessionFallback, generate } = args;
  if (!readFailed) {
    // Reuse a stand-in this session already sent, so the id does not change
    // mid-session the moment the Keychain becomes readable.
    return { id: osId || sessionFallback || generate(), persistAndCache: true, sessionFallback };
  }
  if (osId) return { id: osId, persistAndCache: false, sessionFallback };
  const fallback = sessionFallback ?? generate();
  return { id: fallback, persistAndCache: false, sessionFallback: fallback };
}

/**
 * found  → the id the account is locked to (safe to cache).
 * empty  → genuinely nothing stored anywhere (fresh install: generate + persist).
 * failed → at least one store could not be read (locked Keychain): do NOT cache,
 *          do NOT persist a replacement.
 */
export async function readStoredDeviceIdFrom(deps: DeviceIdStoreDeps): Promise<StoredRead> {
  const v2 = await attempt(deps.readV2);
  if (v2.kind === 'found') return v2;

  const legacy = await attempt(deps.readLegacy);
  if (legacy.kind === 'found') {
    // Copy forward so the next locked read finds it. Best effort only - the
    // legacy key stays the source of truth until v2 holds the same value.
    try { await deps.writeV2(legacy.value); } catch { /* retried next read */ }
    return legacy;
  }

  if (v2.kind === 'failed' || legacy.kind === 'failed') return { kind: 'failed' };
  return { kind: 'empty' };
}
