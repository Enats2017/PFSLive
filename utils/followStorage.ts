import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'followed_users';

let cache: Set<number> | null = null;
let lock: Promise<void> = Promise.resolve();

// ✅ Central converter — always returns valid number or null
function toValidId(id: any): number | null {
  if (id === null || id === undefined) return null;
  const parsed = Number(id);
  return !isNaN(parsed) && parsed > 0 ? parsed : null;
}

function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const next = lock.then(fn);
  lock = next.then(() => {}, () => {});
  return next;
}

// ✅ Always parse everything to number when loading
async function loadCache(): Promise<Set<number>> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as any[]) : [];

    // ✅ Convert ALL values to number — fixes mixed string/number in storage
    cache = new Set(
      parsed
        .map(toValidId)
        .filter((id): id is number => id !== null)
    );
    console.log('📦 Cache loaded as numbers:', [...cache]);
  } catch {
    cache = new Set();
  }
  return cache;
}

async function persistCache(set: Set<number>): Promise<void> {
  try {
    // ✅ Always saves as numbers
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
    console.log('💾 Saved to AsyncStorage:', [...set]);
  } catch {
    console.warn('⚠️ Failed to persist cache');
  }
}

export function clearCache(): void {
  cache = null;
  console.log('🗑️ Cache cleared');
}

export async function getFollowedUsers(): Promise<number[]> {
  const set = await loadCache();
  return [...set];
}

export async function isUserFollowed(id: any): Promise<boolean> {
  const validId = toValidId(id); // ✅ convert to number before check
  if (validId === null) return false;
  const set = await loadCache();
  const result = set.has(validId);
  console.log(`🔍 isUserFollowed(${validId}):`, result, '| cache:', [...set]);
  return result;
}

export async function followUser(id: any): Promise<void> {
  const validId = toValidId(id); // ✅ always number
  if (validId === null) {
    console.warn('⚠️ followUser — invalid id:', id);
    return;
  }
  return withLock(async () => {
    const set = await loadCache();
    if (set.has(validId)) {
      console.log(`⚠️ Already followed: ${validId}`);
      return;
    }
    set.add(validId);
    await persistCache(set);
    console.log(`✅ Followed: ${validId} | Total: ${set.size}`);
  });
}

export async function unfollowUser(id: any): Promise<void> {
  const validId = toValidId(id); // ✅ always number
  if (validId === null) {
    console.warn('⚠️ unfollowUser — invalid id:', id);
    return;
  }
  return withLock(async () => {
    const set = await loadCache();
    if (!set.has(validId)) {
      console.log(`⚠️ Not followed: ${validId}`);
      return;
    }
    set.delete(validId);
    await persistCache(set);
    console.log(`❌ Unfollowed: ${validId} | Total: ${set.size}`);
  });
}