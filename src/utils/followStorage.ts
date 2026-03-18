import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'followed_users';
const STORAGE_KEY_BIBS = 'followed_bibs_by_product'; // ✅ NEW: For BIB-based follows

let cache: Set<number> | null = null;
let bibCache: Map<number, Set<string>> | null = null; // ✅ NEW: product_app_id → Set<bib>
let lock: Promise<void> = Promise.resolve();

// ✅ Central converter — always returns valid number or null
function toValidId(id: any): number | null {
  if (id === null || id === undefined) return null;
  const parsed = Number(id);
  return !isNaN(parsed) && parsed > 0 ? parsed : null;
}

// ✅ NEW: Validate BIB string
function toValidBib(bib: any): string | null {
  if (bib === null || bib === undefined) return null;
  const str = String(bib).trim();
  return str.length > 0 ? str : null;
}

function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const next = lock.then(fn);
  lock = next.then(() => {}, () => {});
  return next;
}

// ✅ Load customer-based cache (existing system)
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
    console.log('📦 Customer cache loaded:', [...cache]);
  } catch {
    cache = new Set();
  }
  return cache;
}

// ✅ NEW: Load BIB-based cache
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

    // Convert parsed object to Map<number, Set<string>>
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

    console.log('📦 BIB cache loaded:', Object.fromEntries(bibCache));
  } catch (error) {
    console.warn('⚠️ Failed to load BIB cache:', error);
    bibCache = new Map();
  }
  return bibCache;
}

// ✅ Persist customer-based cache
async function persistCache(set: Set<number>): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
    console.log('💾 Customer cache saved:', [...set]);
  } catch {
    console.warn('⚠️ Failed to persist customer cache');
  }
}

// ✅ NEW: Persist BIB-based cache
async function persistBibCache(map: Map<number, Set<string>>): Promise<void> {
  try {
    const obj: Record<number, string[]> = {};
    map.forEach((bibSet, productId) => {
      if (bibSet.size > 0) {
        obj[productId] = [...bibSet];
      }
    });
    await AsyncStorage.setItem(STORAGE_KEY_BIBS, JSON.stringify(obj));
    console.log('💾 BIB cache saved:', obj);
  } catch (error) {
    console.warn('⚠️ Failed to persist BIB cache:', error);
  }
}

// ✅ Clear all caches
export function clearCache(): void {
  cache = null;
  bibCache = null;
  console.log('🗑️ All caches cleared');
}

// ✅ Get all followed customer IDs (existing)
export async function getFollowedUsers(): Promise<number[]> {
  const set = await loadCache();
  return [...set];
}

// ✅ NEW: Get all followed BIBs for a product
export async function getFollowedBibs(productAppId: number): Promise<string[]> {
  const validProductId = toValidId(productAppId);
  if (validProductId === null) return [];

  const map = await loadBibCache();
  const bibSet = map.get(validProductId);
  return bibSet ? [...bibSet] : [];
}

// ✅ Check if customer is followed (existing)
export async function isUserFollowed(id: any): Promise<boolean> {
  const validId = toValidId(id);
  if (validId === null) return false;
  const set = await loadCache();
  const result = set.has(validId);
  console.log(`🔍 isUserFollowed(${validId}):`, result);
  return result;
}

// ✅ NEW: Check if BIB is followed for a product
export async function isBibFollowed(productAppId: number, bib: string): Promise<boolean> {
  const validProductId = toValidId(productAppId);
  const validBib = toValidBib(bib);
  
  if (validProductId === null || validBib === null) return false;

  const map = await loadBibCache();
  const bibSet = map.get(validProductId);
  const result = bibSet?.has(validBib) ?? false;
  
  console.log(`🔍 isBibFollowed(product:${validProductId}, bib:${validBib}):`, result);
  return result;
}

// ✅ Follow customer (existing)
export async function followUser(id: any): Promise<void> {
  const validId = toValidId(id);
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
    console.log(`✅ Followed customer: ${validId} | Total: ${set.size}`);
  });
}

// ✅ NEW: Follow BIB for a product
export async function followBib(productAppId: number, bib: string): Promise<void> {
  const validProductId = toValidId(productAppId);
  const validBib = toValidBib(bib);

  if (validProductId === null || validBib === null) {
    console.warn('⚠️ followBib — invalid params:', { productAppId, bib });
    return;
  }

  return withLock(async () => {
    const map = await loadBibCache();
    
    let bibSet = map.get(validProductId);
    if (!bibSet) {
      bibSet = new Set();
      map.set(validProductId, bibSet);
    }

    if (bibSet.has(validBib)) {
      console.log(`⚠️ BIB already followed: product=${validProductId}, bib=${validBib}`);
      return;
    }

    bibSet.add(validBib);
    await persistBibCache(map);
    console.log(`✅ Followed BIB: product=${validProductId}, bib=${validBib} | Total in product: ${bibSet.size}`);
  });
}

// ✅ Unfollow customer (existing)
export async function unfollowUser(id: any): Promise<void> {
  const validId = toValidId(id);
  if (validId === null) {
    console.warn('⚠️ unfollowUser — invalid id:', id);
    return;
  }
  return withLock(async () => {
    const set = await loadCache();
    if (!set.has(validId)) {
      console.log(`⚠️ Customer not followed: ${validId}`);
      return;
    }
    set.delete(validId);
    await persistCache(set);
    console.log(`❌ Unfollowed customer: ${validId} | Total: ${set.size}`);
  });
}

// ✅ NEW: Unfollow BIB for a product
export async function unfollowBib(productAppId: number, bib: string): Promise<void> {
  const validProductId = toValidId(productAppId);
  const validBib = toValidBib(bib);

  if (validProductId === null || validBib === null) {
    console.warn('⚠️ unfollowBib — invalid params:', { productAppId, bib });
    return;
  }

  return withLock(async () => {
    const map = await loadBibCache();
    const bibSet = map.get(validProductId);

    if (!bibSet || !bibSet.has(validBib)) {
      console.log(`⚠️ BIB not followed: product=${validProductId}, bib=${validBib}`);
      return;
    }

    bibSet.delete(validBib);

    // Remove product entry if no more BIBs
    if (bibSet.size === 0) {
      map.delete(validProductId);
    }

    await persistBibCache(map);
    console.log(`❌ Unfollowed BIB: product=${validProductId}, bib=${validBib} | Remaining in product: ${bibSet.size}`);
  });
}

// ✅ NEW: Combined check - returns type of follow (customer vs bib)
export async function getFollowStatus(
  productAppId: number,
  bib: string,
  customerAppId?: number | null
): Promise<{ isFollowed: boolean; followType: 'customer' | 'bib' | null }> {
  // Priority 1: Check if customer is followed
  const validCustomerId = toValidId(customerAppId);
  if (validCustomerId !== null) {
    const customerFollowed = await isUserFollowed(validCustomerId);
    if (customerFollowed) {
      return { isFollowed: true, followType: 'customer' };
    }
  }

  // Priority 2: Check if BIB is followed
  const bibFollowed = await isBibFollowed(productAppId, bib);
  if (bibFollowed) {
    return { isFollowed: true, followType: 'bib' };
  }

  return { isFollowed: false, followType: null };
}

// ✅ NEW: Smart follow - decides whether to follow customer or BIB
export async function smartFollow(
  productAppId: number,
  bib: string,
  customerAppId?: number | null
): Promise<void> {
  const validCustomerId = toValidId(customerAppId);

  if (validCustomerId !== null) {
    // Has customer_app_id → follow customer
    await followUser(validCustomerId);
  } else {
    // No customer_app_id → follow BIB
    await followBib(productAppId, bib);
  }
}

// ✅ NEW: Smart unfollow - decides whether to unfollow customer or BIB
export async function smartUnfollow(
  productAppId: number,
  bib: string,
  customerAppId?: number | null
): Promise<void> {
  const validCustomerId = toValidId(customerAppId);

  // Try to unfollow customer first
  if (validCustomerId !== null) {
    const customerFollowed = await isUserFollowed(validCustomerId);
    if (customerFollowed) {
      await unfollowUser(validCustomerId);
      return;
    }
  }

  // If not following customer, try to unfollow BIB
  const bibFollowed = await isBibFollowed(productAppId, bib);
  if (bibFollowed) {
    await unfollowBib(productAppId, bib);
  }
}