import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG, getApiEndpoint, getDeviceId } from '../constants/config';
import { apiClient } from '../services/api';
import { useFollowStore } from '../store/useFollowStore';
import { followerApi } from '../services/registerFollowerServices';

const STORAGE_KEY = 'followed_users';
// Set when an upload fails, cleared when one succeeds. Its only job is to say
// "local is ahead of the server", which syncFollowDataFromAPI must not trample.
const SYNC_PENDING_KEY = '@PFSLive:followSyncPending';
const STORAGE_KEY_BIBS = 'followed_bibs_by_product';
const FOLLOWER_ID_KEY = 'FOLLOWER_ID';
const DEVICE_ID_KEY = 'device_id';
// Set when the phone learned its follower_id but has not MERGED with the
// server row yet (the id can be learned from the fan-email / language screens,
// or the merge's download can fail). Every sync/restore merges first while set.
const ADOPT_PENDING_KEY = '@PFSLive:followAdoptPending';
// Unfollows made before that merge — the union would otherwise bring them back.
const REMOVED_BEFORE_ADOPT_KEY = '@PFSLive:followRemovedBeforeAdopt';

// Bumped on every local follow/unfollow. A server download that STARTED before
// a local change must not overwrite it when it lands (see syncFollowDataFromAPI).
let followWriteSeq = 0;
export function getFollowWriteSeq(): number { return followWriteSeq; }

/** The server said this device has no follower row — a real answer, unlike a
 *  timeout / 5xx / 429, which must never be read as "nothing to merge". */
function isFollowerNotFound(error: any): boolean {
  return error?.code === 'follower_not_found';
}

type RemovedBeforeAdopt = { customers: number[]; bibs: Record<string, string[]> };

async function readRemovedBeforeAdopt(): Promise<RemovedBeforeAdopt> {
  try {
    const raw = await AsyncStorage.getItem(REMOVED_BEFORE_ADOPT_KEY);
    const v = raw ? JSON.parse(raw) : null;
    return {
      customers: Array.isArray(v?.customers) ? v.customers : [],
      bibs: v?.bibs && typeof v.bibs === 'object' ? v.bibs : {},
    };
  } catch {
    return { customers: [], bibs: {} };
  }
}

/** Remember an unfollow while the phone has not merged with its server row. */
async function rememberRemovalIfUnadopted(customerId: number | null, productId?: number, bib?: string): Promise<void> {
  try {
    const hasId = toValidId(await AsyncStorage.getItem(FOLLOWER_ID_KEY)) !== null;
    const pending = (await AsyncStorage.getItem(ADOPT_PENDING_KEY)) === '1';
    if (hasId && !pending) return;
    const removed = await readRemovedBeforeAdopt();
    if (customerId !== null && !removed.customers.includes(customerId)) removed.customers.push(customerId);
    if (productId !== undefined && bib !== undefined) {
      const list = removed.bibs[String(productId)] ?? [];
      if (!list.includes(bib)) list.push(bib);
      removed.bibs[String(productId)] = list;
    }
    await AsyncStorage.setItem(REMOVED_BEFORE_ADOPT_KEY, JSON.stringify(removed));
  } catch { /* best effort */ }
}

let cache: Set<number> | null = null;
let bibCache: Map<number, Set<string>> | null = null;

function toValidId(id: any): number | null {
  if (id === null || id === undefined) return null;
  const parsed = Number(id);
  return !isNaN(parsed) && parsed > 0 ? parsed : null;
}

function toValidBib(bib: any): string | null {
  if (bib === null || bib === undefined) return null;
  const str = String(bib).trim();
  return str.length > 0 ? str : null;
}

async function loadCache(): Promise<Set<number>> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as any[]) : [];

    cache = new Set(
      parsed
        .map(toValidId)
        .filter((id): id is number => id !== null)
    );
  } catch (error) {
    console.warn('Failed to load customer cache:', error);
    cache = new Set();
  }
  return cache;
}

async function loadBibCache(): Promise<Map<number, Set<string>>> {
  if (bibCache) return bibCache;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_BIBS);
    if (!raw) {
      bibCache = new Map();
      return bibCache;
    }

    const parsed = JSON.parse(raw) as Record<string, string[]>;
    bibCache = new Map();

    Object.entries(parsed).forEach(([productId, bibs]) => {
      const validProductId = toValidId(productId);
      if (validProductId !== null && Array.isArray(bibs)) {
        const bibSet = new Set(
          bibs
            .map(toValidBib)
            .filter((bib): bib is string => bib !== null)
        );
        if (bibSet.size > 0) {
          bibCache!.set(validProductId, bibSet);
        }
      }
    });
  } catch (error) {
    console.warn('Failed to load BIB cache:', error);
    bibCache = new Map();
  }
  return bibCache;
}

async function persistCache(set: Set<number>): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
  } catch (error) {
    console.warn('Failed to persist customer cache:', error);
    throw error;
  }
}

async function persistBibCache(map: Map<number, Set<string>>): Promise<void> {
  try {
    const obj: Record<number, string[]> = {};
    map.forEach((bibSet, productId) => {
      if (bibSet.size > 0) {
        obj[productId] = [...bibSet];
      }
    });
    await AsyncStorage.setItem(STORAGE_KEY_BIBS, JSON.stringify(obj));
  } catch (error) {
    console.warn('Failed to persist BIB cache:', error);
    throw error;
  }
}

// ✅ A follower_id for this device, with or without a push token.
//
// follower_id used to be minted ONLY by registering an Expo push token, so a
// user who denied notifications never had one and every follow returned early
// below — silently, with no pending flag, so it was never retried. Following
// looked fine on the phone and never reached the server (no follower counts,
// no restore after reinstall, nothing for the web). A token-less row fixes
// that; registerFollower() later UPSERTs the token onto the SAME row.
//
// `adopted` = this call is the first time the phone learned its id. The caller
// must then MERGE rather than let either side overwrite the other — see
// adoptServerFollowData.
let ensureInFlight: Promise<{ id: number | null; adopted: boolean }> | null = null;

export async function ensureFollowerId(): Promise<{ id: number | null; adopted: boolean }> {
  const existing = toValidId(await AsyncStorage.getItem(FOLLOWER_ID_KEY));
  if (existing !== null) return { id: existing, adopted: false };

  if (!ensureInFlight) {
    ensureInFlight = (async () => {
      try {
        const res = await followerApi.registerGuestFollower();
        const id = toValidId(res?.follower_id);
        if (id === null) return { id: null, adopted: false };
        // Merge still owed — whoever called us (follow, fan email, language).
        // Flag FIRST: an id without the flag would let the next sync push
        // local over the server row (crash, or an unfollow in between).
        await AsyncStorage.setItem(ADOPT_PENDING_KEY, '1');
        await AsyncStorage.setItem(FOLLOWER_ID_KEY, String(id));
        if (API_CONFIG.DEBUG) console.log('🆔 Token-less follower registered:', id);
        return { id, adopted: true };
      } catch (error) {
        if (API_CONFIG.DEBUG) console.warn('⚠️ Guest follower registration failed:', error);
        return { id: null, adopted: false };
      } finally {
        ensureInFlight = null;
      }
    })();
  }
  return ensureInFlight;
}

// ✅ NEW: Sync follow data to API
// `fromAdopt`: called by adoptServerFollowData itself. Never re-enter the merge
// from there — if storage can't clear the pending flag, that would loop.
async function syncFollowDataToAPI(fromAdopt = false): Promise<void> {
  try {
    // Get follower_id and device_id from storage
    // toValidId, not a truthy check: an old install may hold the string "null".
    let followerIdRaw: string | null = null;
    const storedId = toValidId(await AsyncStorage.getItem(FOLLOWER_ID_KEY));
    const deviceId = await getDeviceId();

    if (storedId === null && deviceId) {
      const { id } = await ensureFollowerId();
      // On the flag, not on `adopted`: if another caller (fan email) won the
      // ensure race we get adopted=false, but the merge is still owed.
      if (id !== null && !fromAdopt && (await AsyncStorage.getItem(ADOPT_PENDING_KEY)) === '1') {
        // First id for this phone: the server row may already hold follows
        // (same device_id used on the web). Merge both sides, then push.
        await adoptServerFollowData();
        return;
      }
      followerIdRaw = id !== null ? String(id) : null;
    } else if (storedId !== null) {
      if (!fromAdopt && (await AsyncStorage.getItem(ADOPT_PENDING_KEY)) === '1') {
        // Id learned elsewhere without the merge — do it before any push.
        await adoptServerFollowData();
        return;
      }
      followerIdRaw = String(storedId);
    }

    if (!followerIdRaw || !deviceId) {
      if (API_CONFIG.DEBUG) {
        console.log('⏭️ Skipping API sync: follower_id or device_id not found');
      }
      // Local is now ahead of the server — record it, so the next sync pushes
      // instead of the next download overwriting the follow.
      try { await AsyncStorage.setItem(SYNC_PENDING_KEY, '1'); } catch { /* silent */ }
      return;
    }

    const followerId = toValidId(followerIdRaw);
    if (followerId === null) {
      if (API_CONFIG.DEBUG) {
        console.log('⏭️ Skipping API sync: invalid follower_id');
      }
      return;
    }

    // Get current follow data
    const customerSet = await loadCache();
    const bibMap = await loadBibCache();

    // Build customer_app_id_string
    const customer_app_id_string = [...customerSet].join(',');

    // Build bib_number_string object
    const bib_number_string: Record<string, string> = {};
    bibMap.forEach((bibSet, productId) => {
      if (bibSet.size > 0) {
        bib_number_string[productId] = [...bibSet].join(',');
      }
    });

    const requestBody = {
      follower_id: followerId,
      device_id: deviceId,
      customer_app_id_string,
      bib_number_string,
    };

    if (API_CONFIG.DEBUG) {
      console.log('📡 Syncing follow data to API:', {
        follower_id: followerId,
        device_id: deviceId,
        customers: customer_app_id_string,
        bibs: bib_number_string,
      });
    }

    const headers = await API_CONFIG.getHeaders();

    await apiClient.post(
      getApiEndpoint(API_CONFIG.ENDPOINTS.SYNC_FOLLOW_DATA),
      requestBody,
      {
        headers,
        timeout: API_CONFIG.TIMEOUT,
      }
    );

    if (API_CONFIG.DEBUG) {
      console.log('✅ Follow data synced to API');
    }

    // ✅ Tell the screens that show SERVER-derived counts to refetch.
    //    Bumped here, after the POST resolves, so all four callers
    //    (followUser / unfollowUser / followBib / unfollowBib) are covered by
    //    one line. Deliberately NOT bumped in the catch below: when the sync
    //    failed the server state genuinely did not change, so a refetch would
    //    redisplay the old number and read as a second bug.
    useFollowStore.getState().bump();

    // Local and server agree again.
    try {
      await AsyncStorage.removeItem(SYNC_PENDING_KEY);
    } catch {
      // A failure here only risks one redundant re-upload later. Harmless.
    }
  } catch (error: any) {
    if (API_CONFIG.DEBUG) {
      console.error('❌ Failed to sync follow data to API:', error);
    }

    // Still don't throw — following has to keep working with no signal, which
    // at a race is exactly when people use it. But record that local is now
    // AHEAD of the server, so syncFollowDataFromAPI does not overwrite this
    // change with older server state and silently undo the follow. The retry
    // happens on the next follow action (this function posts the whole set) or
    // on the next download-sync, which pushes before it pulls.
    try {
      await AsyncStorage.setItem(SYNC_PENDING_KEY, '1');
    } catch {
      // If even the flag cannot be written we are no worse off than before.
    }
  }
}

export function clearCache(): void {
  cache = null;
  bibCache = null;
}

export async function getFollowedUsers(): Promise<number[]> {
  const set = await loadCache();
  return [...set];
}

export async function getFollowedBibs(productAppId: number): Promise<string[]> {
  const validProductId = toValidId(productAppId);
  if (validProductId === null) return [];

  const map = await loadBibCache();
  const bibSet = map.get(validProductId);
  return bibSet ? [...bibSet] : [];
}

export async function isUserFollowed(id: any): Promise<boolean> {
  const validId = toValidId(id);
  if (validId === null) return false;
  const set = await loadCache();
  return set.has(validId);
}

export async function isBibFollowed(productAppId: number, bib: string): Promise<boolean> {
  const validProductId = toValidId(productAppId);
  const validBib = toValidBib(bib);
  
  if (validProductId === null || validBib === null) return false;

  const map = await loadBibCache();
  const bibSet = map.get(validProductId);
  return bibSet?.has(validBib) ?? false;
}

export async function followUser(id: any): Promise<void> {
  const validId = toValidId(id);
  if (validId === null) {
    throw new Error(`Invalid customer ID: ${id}`);
  }

  try {
    const set = await loadCache();
    
    if (set.has(validId)) {
      return;
    }
    
    set.add(validId);
    cache = set;
    followWriteSeq++; // before any await — see syncFollowDataFromAPI
    await persistCache(set);
    
    // ✅ Sync to API after successful local save
    await syncFollowDataToAPI();
  } catch (error) {
    console.error('Follow user error:', error);
    throw error;
  }
}

export async function followBib(productAppId: number, bib: string): Promise<void> {
  const validProductId = toValidId(productAppId);
  const validBib = toValidBib(bib);

  if (validProductId === null || validBib === null) {
    throw new Error(`Invalid productAppId (${productAppId}) or bib (${bib})`);
  }

  try {
    const map = await loadBibCache();
    
    let bibSet = map.get(validProductId);
    if (!bibSet) {
      bibSet = new Set();
      map.set(validProductId, bibSet);
    }

    if (bibSet.has(validBib)) {
      return;
    }

    bibSet.add(validBib);
    bibCache = map;
    followWriteSeq++; // before any await — see syncFollowDataFromAPI
    await persistBibCache(map);
    
    // ✅ Sync to API after successful local save
    await syncFollowDataToAPI();
  } catch (error) {
    console.error('Follow BIB error:', error);
    throw error;
  }
}

export async function unfollowUser(id: any): Promise<void> {
  const validId = toValidId(id);
  if (validId === null) {
    throw new Error(`Invalid customer ID: ${id}`);
  }

  try {
    const set = await loadCache();
    
    if (!set.has(validId)) {
      return;
    }
    
    set.delete(validId);
    cache = set;
    followWriteSeq++; // before any await — see syncFollowDataFromAPI
    await persistCache(set);
    await rememberRemovalIfUnadopted(validId);
    
    // ✅ Sync to API after successful local save
    await syncFollowDataToAPI();
  } catch (error) {
    console.error('Unfollow user error:', error);
    throw error;
  }
}

export async function unfollowBib(productAppId: number, bib: string): Promise<void> {
  const validProductId = toValidId(productAppId);
  const validBib = toValidBib(bib);

  if (validProductId === null || validBib === null) {
    throw new Error(`Invalid productAppId (${productAppId}) or bib (${bib})`);
  }

  try {
    const map = await loadBibCache();
    const bibSet = map.get(validProductId);

    if (!bibSet || !bibSet.has(validBib)) {
      return;
    }

    bibSet.delete(validBib);

    if (bibSet.size === 0) {
      map.delete(validProductId);
    }

    bibCache = map;
    followWriteSeq++; // before any await — see syncFollowDataFromAPI
    await persistBibCache(map);
    await rememberRemovalIfUnadopted(null, validProductId, validBib);
    
    // ✅ Sync to API after successful local save
    await syncFollowDataToAPI();
  } catch (error) {
    console.error('Unfollow BIB error:', error);
    throw error;
  }
}

export async function getFollowStatus(
  productAppId: number,
  bib: string,
  customerAppId?: number | null
): Promise<{ isFollowed: boolean; followType: 'customer' | 'bib' | null }> {
  try {
    const validCustomerId = toValidId(customerAppId);
    if (validCustomerId !== null) {
      const customerFollowed = await isUserFollowed(validCustomerId);
      if (customerFollowed) {
        return { isFollowed: true, followType: 'customer' };
      }
    }

    const bibFollowed = await isBibFollowed(productAppId, bib);
    if (bibFollowed) {
      return { isFollowed: true, followType: 'bib' };
    }

    return { isFollowed: false, followType: null };
  } catch (error) {
    console.error('Get follow status error:', error);
    return { isFollowed: false, followType: null };
  }
}

export async function smartFollow(
  productAppId: number,
  bib: string,
  customerAppId?: number | null
): Promise<void> {
  const validCustomerId = toValidId(customerAppId);

  if (validCustomerId !== null) {
    await followUser(validCustomerId);
  } else {
    await followBib(productAppId, bib);
  }
}

export async function smartUnfollow(
  productAppId: number,
  bib: string,
  customerAppId?: number | null
): Promise<void> {
  const validCustomerId = toValidId(customerAppId);

  if (validCustomerId !== null) {
    const customerFollowed = await isUserFollowed(validCustomerId);
    if (customerFollowed) {
      await unfollowUser(validCustomerId);
      return;
    }
  }

  const bibFollowed = await isBibFollowed(productAppId, bib);
  if (bibFollowed) {
    await unfollowBib(productAppId, bib);
  }
}

// ✅ Export sync function for manual triggers if needed
export { syncFollowDataToAPI };

/** True when a local follow/unfollow has not reached the server yet. */
export async function hasPendingFollowSync(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(SYNC_PENDING_KEY)) === '1';
  } catch {
    return false;
  }
}

/**
 * First-adoption merge: UNION of what the phone has and what the server row
 * has, saved locally and pushed back. Used only when the phone has just learned
 * its follower_id — neither side is authoritative at that moment, and a plain
 * download would wipe follows made while the phone had no id.
 */
type ServerFollowData = {
  follower_id?: number;
  followed_customers?: number[];
  followed_bibs?: Record<string, string[]>;
};

export async function adoptServerFollowData(prefetched?: ServerFollowData): Promise<void> {
  try {
    let server: ServerFollowData = prefetched ?? {};
    if (!prefetched) {
      try {
        server = await followerApi.getFollowerDataByDevice();
      } catch (error) {
        if (!isFollowerNotFound(error)) {
          // Offline / 5xx / rate-limited: we do NOT know the server's list, so
          // pushing ours would overwrite it. Keep both flags; retry next sync.
          try {
            await AsyncStorage.setItem(ADOPT_PENDING_KEY, '1');
            await AsyncStorage.setItem(SYNC_PENDING_KEY, '1');
          } catch { /* silent */ }
          return;
        }
        server = {}; // the device has no row yet — nothing to merge in
      }
    }

    const removed = await readRemovedBeforeAdopt();

    const customers = await loadCache();
    (server.followed_customers ?? [])
      .map(toValidId)
      .forEach((id) => { if (id !== null && !removed.customers.includes(id)) customers.add(id); });
    cache = customers;
    await persistCache(customers);

    const bibs = await loadBibCache();
    Object.entries(server.followed_bibs ?? {}).forEach(([productId, list]) => {
      const pid = toValidId(productId);
      if (pid === null || !Array.isArray(list)) return;
      const gone = removed.bibs[String(pid)] ?? [];
      const set = bibs.get(pid) ?? new Set<string>();
      list.map(toValidBib).forEach((b) => { if (b !== null && !gone.includes(b)) set.add(b); });
      if (set.size > 0) bibs.set(pid, set);
    });
    bibCache = bibs;
    await persistBibCache(bibs);

    try {
      await AsyncStorage.multiRemove([ADOPT_PENDING_KEY, REMOVED_BEFORE_ADOPT_KEY]);
      await AsyncStorage.setItem(SYNC_PENDING_KEY, '1');
    } catch { /* silent */ }
    await syncFollowDataToAPI(true);
  } catch (error) {
    if (API_CONFIG.DEBUG) console.warn('⚠️ adoptServerFollowData failed:', error);
  }
}

/**
 * Follow restore for a phone WITHOUT a push token (HomeScreen mount).
 * Deliberately does not create a follower row just because the app opened:
 * a row is only created when there is something to keep (local follows).
 *  - phone knows its id      → normal download (pending-aware)
 *  - server knows the device → learn the id, then merge (reinstall / web)
 *  - neither, but local follows exist → create the row, then push
 */
export async function restoreFollowsWithoutToken(): Promise<void> {
  const knownId = toValidId(await AsyncStorage.getItem(FOLLOWER_ID_KEY));

  const seq = followWriteSeq;
  let server: ServerFollowData | null = null;
  try {
    server = await followerApi.getFollowerDataByDevice();
  } catch (error) {
    // Only a real "no row" lets us go on; a timeout/5xx means we don't know
    // what the server holds — touch nothing, try again on the next launch.
    if (!isFollowerNotFound(error)) return;
    server = null;
  }

  if (knownId !== null) {
    if ((await AsyncStorage.getItem(ADOPT_PENDING_KEY)) === '1') {
      await adoptServerFollowData(server ?? {});
      return;
    }
    if (server) {
      await syncFollowDataFromAPI(server.followed_customers ?? [], server.followed_bibs ?? {}, seq);
    }
    return;
  }

  const serverId = toValidId(server?.follower_id);
  if (server && serverId !== null) {
    await AsyncStorage.setItem(ADOPT_PENDING_KEY, '1');
    await AsyncStorage.setItem(FOLLOWER_ID_KEY, String(serverId));
    await adoptServerFollowData(server);
    return;
  }

  const local = await loadCache();
  const localBibs = await loadBibCache();
  if (local.size === 0 && localBibs.size === 0) return;

  const { id } = await ensureFollowerId();
  if (id !== null) await adoptServerFollowData({});
}

export async function syncFollowDataFromAPI(
  followed_customers: number[],
  followed_bibs: Record<string, string[]>,
  /** getFollowWriteSeq() taken BEFORE the download started. If the user
   *  followed/unfollowed while it was in flight, the download is older than
   *  the phone — push instead of overwriting. */
  startedAtSeq?: number,
): Promise<void> {
  try {
    // The id was learned without a merge (e.g. by registering a push token on
    // a phone that only had local follows) — merge, never overwrite.
    if ((await AsyncStorage.getItem(ADOPT_PENDING_KEY)) === '1') {
      await adoptServerFollowData({ followed_customers, followed_bibs });
      return;
    }
    if (startedAtSeq !== undefined && startedAtSeq !== followWriteSeq) {
      await syncFollowDataToAPI();
      return;
    }
    // This OVERWRITES local storage, so it must never run while local holds a
    // change the server has not seen — that is how a follow made offline used
    // to disappear a moment later. Push local up instead; if that succeeds the
    // flag clears and the next call proceeds normally, and if it fails local
    // stays authoritative until it can be delivered.
    if (await hasPendingFollowSync()) {
      if (API_CONFIG.DEBUG) {
        console.log('⏭️ Local follow data not yet synced — pushing instead of overwriting');
      }
      await syncFollowDataToAPI();
      return;
    }

    const customerSet = new Set(
      followed_customers
        .map(toValidId)
        .filter((id): id is number => id !== null)
    );

    const bibMap = new Map<number, Set<string>>();
    Object.entries(followed_bibs).forEach(([productId, bibs]) => {
      const validProductId = toValidId(productId);
      if (validProductId !== null && Array.isArray(bibs) && bibs.length > 0) {
        const bibSet = new Set(
          bibs.map(toValidBib).filter((b): b is string => b !== null)
        );
        if (bibSet.size > 0) {
          bibMap.set(validProductId, bibSet);
        }
      }
    });
    // Re-check after the awaits above: a follow that landed meanwhile wins.
    // Both caches are swapped in the same tick, before any further await.
    if (startedAtSeq !== undefined && startedAtSeq !== followWriteSeq) {
      await syncFollowDataToAPI();
      return;
    }
    cache = customerSet;
    bibCache = bibMap;
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...customerSet]));
    await persistBibCache(bibMap);

    if (API_CONFIG.DEBUG) {
      console.log('✅ Follow data synced from API:', {
        customers: customerSet.size,
        products: bibMap.size,
      });
    }
  } catch (error) {
    console.error('❌ Failed to sync follow data from API:', error);
    throw error;
  }
}