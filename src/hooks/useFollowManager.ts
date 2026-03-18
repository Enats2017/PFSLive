import { useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

interface UseFollowManagerResult {
  followedUsers: Set<number>;
  followedBibs: Map<number, Set<string>>;
  followingInProgress: Set<string>;
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

export function useFollowManager(t: any, productAppId?: number): UseFollowManagerResult {
  const [followedUsers, setFollowedUsers] = useState<Set<number>>(new Set());
  const [followedBibs, setFollowedBibs] = useState<Map<number, Set<string>>>(new Map());
  const [followingInProgress, setFollowingInProgress] = useState<Set<string>>(new Set());

  const loadFollowedData = useCallback(async () => {
    try {
      const customers = await getFollowedUsers();
      setFollowedUsers(new Set(customers));

      const bibMap = new Map<number, Set<string>>();
      
      const allBibsRaw = await AsyncStorage.getItem('followed_bibs_by_product');
      if (allBibsRaw) {
        const allBibsParsed = JSON.parse(allBibsRaw) as Record<string, string[]>;
        
        Object.entries(allBibsParsed).forEach(([prodId, bibs]) => {
          const numProdId = Number(prodId);
          if (!isNaN(numProdId) && numProdId > 0 && Array.isArray(bibs) && bibs.length > 0) {
            bibMap.set(numProdId, new Set(bibs));
          }
        });
      }

      setFollowedBibs(bibMap);
    } catch (error) {
      console.error('Failed to load follow data:', error);
    }
  }, [productAppId]);

  useEffect(() => {
    clearCache();
    loadFollowedData();
  }, [loadFollowedData]);

  const refreshFollowedUsers = useCallback(async () => {
    clearCache();
    await loadFollowedData();
  }, [loadFollowedData]);

  const isFollowed = useCallback(
    (
      productIdOrCustomerId: number | null | undefined,
      bib?: string,
      customerAppId?: number | null
    ): boolean => {
      if (bib === undefined && customerAppId === undefined) {
        const customerId = productIdOrCustomerId;
        if (customerId === null || customerId === undefined || customerId <= 0) {
          return false;
        }
        return followedUsers.has(Number(customerId));
      }

      const productId = productIdOrCustomerId as number;
      
      if (customerAppId !== null && customerAppId !== undefined && customerAppId > 0) {
        const customerFollowed = followedUsers.has(Number(customerAppId));
        if (customerFollowed) {
          return true;
        }
      }

      if (bib && productId) {
        const bibSet = followedBibs.get(productId);
        return bibSet?.has(String(bib)) ?? false;
      }

      return false;
    },
    [followedUsers, followedBibs]
  );

  const isLoading = useCallback(
    (
      productIdOrCustomerId: number | null | undefined,
      bib?: string,
      customerAppId?: number | null
    ): boolean => {
      if (bib === undefined && customerAppId === undefined) {
        const customerId = productIdOrCustomerId;
        if (customerId === null || customerId === undefined || customerId <= 0) {
          return false;
        }
        const key = `customer:${customerId}`;
        return followingInProgress.has(key);
      }

      const productId = productIdOrCustomerId as number;
      const customerKey = customerAppId ? `customer:${customerAppId}` : null;
      const bibKey = bib && productId ? `product:${productId}:bib:${bib}` : null;

      return (
        (customerKey && followingInProgress.has(customerKey)) ||
        (bibKey && followingInProgress.has(bibKey)) ||
        false
      );
    },
    [followingInProgress]
  );

  const toggleFollow = useCallback(
    async (
      productIdOrCustomerId: number | null | undefined,
      bib?: string,
      customerAppId?: number | null
    ) => {
      // Customer-only mode
      if (bib === undefined && customerAppId === undefined) {
        const customerId = productIdOrCustomerId;
        
        if (customerId === null || customerId === undefined || customerId <= 0) {
          return;
        }

        const numericId = Number(customerId);
        const operationKey = `customer:${numericId}`;

        if (followingInProgress.has(operationKey)) {
          return;
        }

        const wasFollowed = followedUsers.has(numericId);
        const willFollow = !wasFollowed;

        setFollowingInProgress((prev) => new Set(prev).add(operationKey));

        setFollowedUsers((prev) => {
          const next = new Set(prev);
          if (willFollow) {
            next.add(numericId);
          } else {
            next.delete(numericId);
          }
          return next;
        });

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

          const updatedUsers = await getFollowedUsers();
          setFollowedUsers(new Set(updatedUsers));
        } catch (error) {
          console.error('Toggle follow error:', error);

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

      // Dual mode
      const productId = productIdOrCustomerId as number;
      
      if (!bib || !productId) {
        return;
      }

      const operationKey = customerAppId 
        ? `customer:${customerAppId}` 
        : `product:${productId}:bib:${bib}`;

      if (followingInProgress.has(operationKey)) {
        return;
      }

      const status = await getFollowStatus(productId, bib, customerAppId);
      const willFollow = !status.isFollowed;

      setFollowingInProgress((prev) => new Set(prev).add(operationKey));

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

        const updatedUsers = await getFollowedUsers();
        setFollowedUsers(new Set(updatedUsers));
        
        let updatedBibs: string[] = [];
        if (productId) {
          updatedBibs = await getFollowedBibs(productId);
          setFollowedBibs((prev) => {
            const next = new Map(prev);
            if (updatedBibs.length > 0) {
              next.set(productId, new Set(updatedBibs));
            } else {
              next.delete(productId);
            }
            return next;
          });
        }
      } catch (error) {
        console.error('Toggle follow error:', error);

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
    isFollowed: isFollowed as any,
    isLoading: isLoading as any,
    toggleFollow: toggleFollow as any,
    refreshFollowedUsers,
  };
}