import { useState, useCallback, useEffect } from 'react';
import {
  getFollowedUsers,
  followUser,
  unfollowUser,
  clearCache,
} from '../utils/followStorage';
import { toastSuccess, toastError } from '../../utils/toast';
import { API_CONFIG } from '../constants/config';

interface UseFollowManagerResult {
  followedUsers: Set<number>;
  followingInProgress: Set<number>;
  isFollowed: (customerId: number | null | undefined) => boolean;
  isLoading: (customerId: number | null | undefined) => boolean;
  toggleFollow: (customerId: number | null | undefined) => Promise<void>;
  refreshFollowedUsers: () => Promise<void>;
}

/**
 * ✅ OPTIMIZED FOLLOW MANAGER
 * 
 * Use this hook at the PARENT/SCREEN level, not in individual cards.
 * Loads followed users once and provides helpers for child components.
 */
export function useFollowManager(t: any): UseFollowManagerResult {
  const [followedUsers, setFollowedUsers] = useState<Set<number>>(new Set());
  const [followingInProgress, setFollowingInProgress] = useState<Set<number>>(new Set());

  // ✅ LOAD FOLLOWED USERS ON MOUNT
  const loadFollowedUsers = useCallback(async () => {
    try {
      const followed = await getFollowedUsers();
      setFollowedUsers(new Set(followed));

      if (API_CONFIG.DEBUG) {
        console.log('✅ useFollowManager: Loaded followed users:', followed);
      }
    } catch (error) {
      if (API_CONFIG.DEBUG) {
        console.error('❌ useFollowManager: Failed to load followed users:', error);
      }
    }
  }, []);

  useEffect(() => {
    clearCache();
    loadFollowedUsers();
  }, [loadFollowedUsers]);

  // ✅ REFRESH FOLLOWED USERS (for pull-to-refresh)
  const refreshFollowedUsers = useCallback(async () => {
    clearCache();
    await loadFollowedUsers();
  }, [loadFollowedUsers]);

  // ✅ CHECK IF USER IS FOLLOWED (WITH TYPE CONVERSION)
  const isFollowed = useCallback(
    (customerId: number | null | undefined): boolean => {
      // ✅ CONVERT TO NUMBER SAFELY
      const id = typeof customerId === 'number' 
        ? customerId 
        : typeof customerId === 'string' 
          ? Number(customerId) 
          : null;

      if (id === null || isNaN(id) || id <= 0) {
        return false;
      }

      const result = followedUsers.has(id);

      if (API_CONFIG.DEBUG) {
        console.log('🔍 isFollowed check:', {
          input: customerId,
          converted: id,
          type: typeof id,
          followedUsers: Array.from(followedUsers),
          result,
        });
      }

      return result;
    },
    [followedUsers]
  );

  // ✅ CHECK IF FOLLOW ACTION IS IN PROGRESS
  const isLoading = useCallback(
    (customerId: number | null | undefined): boolean => {
      const id = typeof customerId === 'number' 
        ? customerId 
        : typeof customerId === 'string' 
          ? Number(customerId) 
          : null;

      if (id === null || isNaN(id) || id <= 0) {
        return false;
      }

      return followingInProgress.has(id);
    },
    [followingInProgress]
  );

  // ✅ TOGGLE FOLLOW/UNFOLLOW
  const toggleFollow = useCallback(
    async (customerId: number | null | undefined) => {
      // ✅ CONVERT TO NUMBER SAFELY
      const id = typeof customerId === 'number' 
        ? customerId 
        : typeof customerId === 'string' 
          ? Number(customerId) 
          : null;

      if (id === null || isNaN(id) || id <= 0) {
        if (API_CONFIG.DEBUG) {
          console.warn('⚠️ useFollowManager: Invalid customerId:', customerId);
        }
        return;
      }

      if (followingInProgress.has(id)) {
        if (API_CONFIG.DEBUG) {
          console.log('⏸️ useFollowManager: Already processing:', id);
        }
        return;
      }

      const wasFollowed = followedUsers.has(id);
      const willFollow = !wasFollowed;

      if (API_CONFIG.DEBUG) {
        console.log('🔄 Toggle follow:', {
          id,
          wasFollowed,
          willFollow,
          followedUsers: Array.from(followedUsers),
        });
      }

      // ✅ OPTIMISTIC UPDATE
      setFollowedUsers((prev) => {
        const next = new Set(prev);
        if (willFollow) {
          next.add(id);
        } else {
          next.delete(id);
        }
        return next;
      });

      setFollowingInProgress((prev) => new Set(prev).add(id));

      try {
        if (willFollow) {
          await followUser(id);
          toastSuccess(
            t('follower:success.followTitle'),
            t('follower:success.followMessage')
          );
        } else {
          await unfollowUser(id);
          toastSuccess(
            t('follower:success.unfollowTitle'),
            t('follower:success.unfollowMessage')
          );
        }

        if (API_CONFIG.DEBUG) {
          console.log(
            `✅ useFollowManager: ${willFollow ? 'Followed' : 'Unfollowed'}:`,
            id
          );
        }
      } catch (error) {
        if (API_CONFIG.DEBUG) {
          console.error('❌ useFollowManager: Toggle error:', error);
        }

        // ✅ REVERT ON ERROR
        setFollowedUsers((prev) => {
          const next = new Set(prev);
          if (wasFollowed) {
            next.add(id);
          } else {
            next.delete(id);
          }
          return next;
        });

        toastError(t('follower:error.title'), t('follower:error.message'));
      } finally {
        setFollowingInProgress((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    },
    [followedUsers, followingInProgress, t]
  );

  return {
    followedUsers,
    followingInProgress,
    isFollowed,
    isLoading,
    toggleFollow,
    refreshFollowedUsers,
  };
}