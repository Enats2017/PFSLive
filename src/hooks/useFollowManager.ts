import { useState, useCallback, useEffect } from 'react';
import {
  getFollowedUsers,
  getFollowedBibs,
  smartFollow,
  smartUnfollow,
  getFollowStatus,
  clearCache,
  followUser,
  unfollowUser,
} from '../utils/followStorage';
import { toastSuccess, toastError } from '../../utils/toast';
import { API_CONFIG } from '../constants/config';

interface UseFollowManagerResult {
  followedUsers: Set<number>;
  followedBibs: Map<number, Set<string>>;
  followingInProgress: Set<string>;
  // ✅ OVERLOADED SIGNATURES - SUPPORT BOTH PATTERNS
  isFollowed: {
    (customerId: number | null | undefined): boolean;
    (productAppId: number, bib: string, customerAppId?: number | null): boolean;
  };
  isLoading: {
    (customerId: number | null | undefined): boolean;
    (productAppId: number, bib: string, customerAppId?: number | null): boolean;
  };
  toggleFollow: {
    (customerId: number | null | undefined): Promise<void>;
    (productAppId: number, bib: string, customerAppId?: number | null): Promise<void>;
  };
  refreshFollowedUsers: () => Promise<void>;
}

/**
 * ✅ ENHANCED FOLLOW MANAGER - DUAL MODE
 * 
 * MODE 1 (Customer-only): useFollowManager(t)
 *   - isFollowed(customerId)
 *   - toggleFollow(customerId)
 * 
 * MODE 2 (Dual system): useFollowManager(t, productAppId)
 *   - isFollowed(productId, bib, customerId)
 *   - toggleFollow(productId, bib, customerId)
 */
export function useFollowManager(t: any, productAppId?: number): UseFollowManagerResult {
  const [followedUsers, setFollowedUsers] = useState<Set<number>>(new Set());
  const [followedBibs, setFollowedBibs] = useState<Map<number, Set<string>>>(new Map());
  const [followingInProgress, setFollowingInProgress] = useState<Set<string>>(new Set());

  // ✅ LOAD ALL FOLLOWED DATA
  const loadFollowedData = useCallback(async () => {
    try {
      // Load customer follows
      const customers = await getFollowedUsers();
      setFollowedUsers(new Set(customers));

      // Load BIB follows if productAppId provided
      const bibMap = new Map<number, Set<string>>();
      
      if (productAppId) {
        const bibs = await getFollowedBibs(productAppId);
        if (bibs.length > 0) {
          bibMap.set(productAppId, new Set(bibs));
        }
      }

      setFollowedBibs(bibMap);

      if (API_CONFIG.DEBUG) {
        console.log('✅ useFollowManager: Loaded data:', {
          customers,
          bibs: Object.fromEntries(bibMap),
          mode: productAppId ? 'dual' : 'customer-only',
        });
      }
    } catch (error) {
      if (API_CONFIG.DEBUG) {
        console.error('❌ useFollowManager: Failed to load data:', error);
      }
    }
  }, [productAppId]);

  useEffect(() => {
    clearCache();
    loadFollowedData();
  }, [loadFollowedData]);

  // ✅ REFRESH ALL DATA
  const refreshFollowedUsers = useCallback(async () => {
    clearCache();
    await loadFollowedData();
  }, [loadFollowedData]);

  // ✅ CHECK IF FOLLOWED (POLYMORPHIC - SUPPORTS BOTH PATTERNS)
  const isFollowed = useCallback(
    (
      productIdOrCustomerId: number | null | undefined,
      bib?: string,
      customerAppId?: number | null
    ): boolean => {
      // ✅ PATTERN 1: isFollowed(customerId) - Customer-only mode
      if (bib === undefined && customerAppId === undefined) {
        const customerId = productIdOrCustomerId;
        if (customerId === null || customerId === undefined || customerId <= 0) {
          return false;
        }
        const result = followedUsers.has(Number(customerId));
        
        if (API_CONFIG.DEBUG) {
          console.log('🔍 isFollowed (customer-only):', {
            customerId,
            result,
          });
        }
        
        return result;
      }

      // ✅ PATTERN 2: isFollowed(productId, bib, customerId) - Dual mode
      const productId = productIdOrCustomerId as number;
      
      // Priority 1: Check customer follow
      if (customerAppId !== null && customerAppId !== undefined && customerAppId > 0) {
        const customerFollowed = followedUsers.has(Number(customerAppId));
        if (customerFollowed) {
          return true;
        }
      }

      // Priority 2: Check BIB follow
      if (bib && productId) {
        const bibSet = followedBibs.get(productId);
        const bibFollowed = bibSet?.has(String(bib)) ?? false;

        if (API_CONFIG.DEBUG) {
          console.log('🔍 isFollowed (dual):', {
            productId,
            bib,
            customerAppId,
            customerFollowed: followedUsers.has(Number(customerAppId || 0)),
            bibFollowed,
            result: bibFollowed,
          });
        }

        return bibFollowed;
      }

      return false;
    },
    [followedUsers, followedBibs]
  );

  // ✅ CHECK IF LOADING (POLYMORPHIC)
  const isLoading = useCallback(
    (
      productIdOrCustomerId: number | null | undefined,
      bib?: string,
      customerAppId?: number | null
    ): boolean => {
      // ✅ PATTERN 1: isLoading(customerId) - Customer-only mode
      if (bib === undefined && customerAppId === undefined) {
        const customerId = productIdOrCustomerId;
        if (customerId === null || customerId === undefined || customerId <= 0) {
          return false;
        }
        const key = `customer:${customerId}`;
        return followingInProgress.has(key);
      }

      // ✅ PATTERN 2: isLoading(productId, bib, customerId) - Dual mode
      const productId = productIdOrCustomerId as number;
      const customerKey = customerAppId ? `customer:${customerAppId}` : null;
      const bibKey = bib && productId ? `product:${productId}:bib:${bib}` : null;

      const loading = 
        (customerKey && followingInProgress.has(customerKey)) ||
        (bibKey && followingInProgress.has(bibKey)) ||
        false;

      return loading;
    },
    [followingInProgress]
  );

  // ✅ TOGGLE FOLLOW (POLYMORPHIC)
  const toggleFollow = useCallback(
    async (
      productIdOrCustomerId: number | null | undefined,
      bib?: string,
      customerAppId?: number | null
    ) => {
      // ✅ PATTERN 1: toggleFollow(customerId) - Customer-only mode
      if (bib === undefined && customerAppId === undefined) {
        const customerId = productIdOrCustomerId;
        
        if (customerId === null || customerId === undefined || customerId <= 0) {
          if (API_CONFIG.DEBUG) {
            console.warn('⚠️ toggleFollow (customer-only): Invalid customerId:', customerId);
          }
          return;
        }

        const numericId = Number(customerId);
        const operationKey = `customer:${numericId}`;

        if (followingInProgress.has(operationKey)) {
          if (API_CONFIG.DEBUG) {
            console.log('⏸️ toggleFollow: Already processing:', operationKey);
          }
          return;
        }

        const wasFollowed = followedUsers.has(numericId);
        const willFollow = !wasFollowed;

        if (API_CONFIG.DEBUG) {
          console.log('🔄 Toggle follow (customer-only):', {
            customerId: numericId,
            wasFollowed,
            willFollow,
          });
        }

        // ✅ OPTIMISTIC UPDATE
        setFollowedUsers((prev) => {
          const next = new Set(prev);
          if (willFollow) {
            next.add(numericId);
          } else {
            next.delete(numericId);
          }
          return next;
        });

        setFollowingInProgress((prev) => new Set(prev).add(operationKey));

        try {
          if (willFollow) {
            await followUser(numericId);
            toastSuccess(
              t('follower:success.followTitle'),
              t('follower:success.followMessage')
            );
          } else {
            await unfollowUser(numericId);
            toastSuccess(
              t('follower:success.unfollowTitle'),
              t('follower:success.unfollowMessage')
            );
          }

          if (API_CONFIG.DEBUG) {
            console.log(
              `✅ toggleFollow (customer-only): ${willFollow ? 'Followed' : 'Unfollowed'}:`,
              numericId
            );
          }
        } catch (error) {
          if (API_CONFIG.DEBUG) {
            console.error('❌ toggleFollow: Toggle error:', error);
          }

          // ✅ REVERT ON ERROR
          setFollowedUsers((prev) => {
            const next = new Set(prev);
            if (wasFollowed) {
              next.add(numericId);
            } else {
              next.delete(numericId);
            }
            return next;
          });

          toastError(t('follower:error.title'), t('follower:error.message'));
        } finally {
          setFollowingInProgress((prev) => {
            const next = new Set(prev);
            next.delete(operationKey);
            return next;
          });
        }

        return;
      }

      // ✅ PATTERN 2: toggleFollow(productId, bib, customerId) - Dual mode
      const productId = productIdOrCustomerId as number;
      
      if (!bib || !productId) {
        if (API_CONFIG.DEBUG) {
          console.warn('⚠️ toggleFollow (dual): Missing productId or bib');
        }
        return;
      }

      const operationKey = customerAppId 
        ? `customer:${customerAppId}` 
        : `product:${productId}:bib:${bib}`;

      if (followingInProgress.has(operationKey)) {
        if (API_CONFIG.DEBUG) {
          console.log('⏸️ toggleFollow: Already processing:', operationKey);
        }
        return;
      }

      // Check current follow status
      const status = await getFollowStatus(productId, bib, customerAppId);
      const willFollow = !status.isFollowed;

      if (API_CONFIG.DEBUG) {
        console.log('🔄 Toggle follow (dual):', {
          productId,
          bib,
          customerAppId,
          currentStatus: status,
          willFollow,
        });
      }

      // ✅ OPTIMISTIC UPDATE
      if (willFollow) {
        if (customerAppId !== null && customerAppId !== undefined && customerAppId > 0) {
          setFollowedUsers((prev) => new Set(prev).add(Number(customerAppId)));
        } else {
          setFollowedBibs((prev) => {
            const next = new Map(prev);
            const bibSet = next.get(productId) || new Set();
            bibSet.add(String(bib));
            next.set(productId, bibSet);
            return next;
          });
        }
      } else {
        if (status.followType === 'customer' && customerAppId) {
          setFollowedUsers((prev) => {
            const next = new Set(prev);
            next.delete(Number(customerAppId));
            return next;
          });
        } else if (status.followType === 'bib') {
          setFollowedBibs((prev) => {
            const next = new Map(prev);
            const bibSet = next.get(productId);
            if (bibSet) {
              bibSet.delete(String(bib));
              if (bibSet.size === 0) {
                next.delete(productId);
              }
            }
            return next;
          });
        }
      }

      setFollowingInProgress((prev) => new Set(prev).add(operationKey));

      try {
        if (willFollow) {
          await smartFollow(productId, bib, customerAppId);
          toastSuccess(
            t('follower:success.followTitle'),
            t('follower:success.followMessage')
          );
        } else {
          await smartUnfollow(productId, bib, customerAppId);
          toastSuccess(
            t('follower:success.unfollowTitle'),
            t('follower:success.unfollowMessage')
          );
        }

        if (API_CONFIG.DEBUG) {
          console.log(
            `✅ toggleFollow (dual): ${willFollow ? 'Followed' : 'Unfollowed'}:`,
            { productId, bib, customerAppId, followType: status.followType }
          );
        }
      } catch (error) {
        if (API_CONFIG.DEBUG) {
          console.error('❌ toggleFollow: Toggle error:', error);
        }

        // ✅ REVERT ON ERROR
        if (willFollow) {
          if (customerAppId !== null && customerAppId !== undefined && customerAppId > 0) {
            setFollowedUsers((prev) => {
              const next = new Set(prev);
              next.delete(Number(customerAppId));
              return next;
            });
          } else {
            setFollowedBibs((prev) => {
              const next = new Map(prev);
              const bibSet = next.get(productId);
              if (bibSet) {
                bibSet.delete(String(bib));
                if (bibSet.size === 0) {
                  next.delete(productId);
                }
              }
              return next;
            });
          }
        } else {
          if (status.followType === 'customer' && customerAppId) {
            setFollowedUsers((prev) => new Set(prev).add(Number(customerAppId)));
          } else if (status.followType === 'bib') {
            setFollowedBibs((prev) => {
              const next = new Map(prev);
              const bibSet = next.get(productId) || new Set();
              bibSet.add(String(bib));
              next.set(productId, bibSet);
              return next;
            });
          }
        }

        toastError(t('follower:error.title'), t('follower:error.message'));
      } finally {
        setFollowingInProgress((prev) => {
          const next = new Set(prev);
          next.delete(operationKey);
          return next;
        });
      }
    },
    [followedUsers, followedBibs, followingInProgress, t]
  );

  return {
    followedUsers,
    followedBibs,
    followingInProgress,
    isFollowed: isFollowed as any, // TypeScript workaround for overloads
    isLoading: isLoading as any,
    toggleFollow: toggleFollow as any,
    refreshFollowedUsers,
  };
}