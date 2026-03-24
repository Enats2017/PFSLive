import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG, getApiEndpoint, getDeviceId } from '../constants/config';
import { apiClient } from '../services/api';

const STORAGE_KEY = 'followed_users';
const STORAGE_KEY_BIBS = 'followed_bibs_by_product';
const FOLLOWER_ID_KEY = 'FOLLOWER_ID';
const DEVICE_ID_KEY = 'device_id';

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

// ✅ NEW: Sync follow data to API
async function syncFollowDataToAPI(): Promise<void> {
  try {
    // Get follower_id and device_id from storage
    const followerIdRaw = await AsyncStorage.getItem(FOLLOWER_ID_KEY);
    const deviceId = await getDeviceId();

    if (!followerIdRaw || !deviceId) {
      if (API_CONFIG.DEBUG) {
        console.log('⏭️ Skipping API sync: follower_id or device_id not found');
      }
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
  } catch (error: any) {
    if (API_CONFIG.DEBUG) {
      console.error('❌ Failed to sync follow data to API:', error);
    }
    // Don't throw - sync failure shouldn't break the app
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
    await persistCache(set);
    
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
    await persistBibCache(map);
    
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