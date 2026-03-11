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
  isFollowed: (customerId: number | null) => boolean;
  isLoading: (customerId: number | null) => boolean;
  toggleFollow: (customerId: number | null) => Promise<void>;
  refreshFollowedUsers: () => Promise<void>;
}

/**
 * ✅ OPTIMIZED FOLLOW MANAGER
 * 
 * Use this hook at the PARENT/SCREEN level, not in individual cards.
 * Loads followed users once and provides helpers for child components.
 * 
 * @example
 * ```typescript
 * function ParticipantTab() {
 *   const { isFollowed, isLoading, toggleFollow } = useFollowManager(t);
 * 
 *   return participants.map(p => (
 *     <Card
 *       isFollowed={isFollowed(p.customer_app_id)}
 *       isLoading={isLoading(p.customer_app_id)}
 *       onToggle={() => toggleFollow(p.customer_app_id)}
 *     />
 *   ));
 * }
 * ```
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
        console.log('✅ useFollowManager: Loaded followed users:', followed.length);
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

  // ✅ CHECK IF USER IS FOLLOWED
  const isFollowed = useCallback(
    (customerId: number | null): boolean => {
      if (customerId === null || customerId <= 0) return false;
      return followedUsers.has(customerId);
    },
    [followedUsers]
  );

  // ✅ CHECK IF FOLLOW ACTION IS IN PROGRESS
  const isLoading = useCallback(
    (customerId: number | null): boolean => {
      if (customerId === null || customerId <= 0) return false;
      return followingInProgress.has(customerId);
    },
    [followingInProgress]
  );

  // ✅ TOGGLE FOLLOW/UNFOLLOW
  const toggleFollow = useCallback(
    async (customerId: number | null) => {
      if (customerId === null || customerId <= 0) {
        if (API_CONFIG.DEBUG) {
          console.warn('⚠️ useFollowManager: Invalid customerId:', customerId);
        }
        return;
      }

      if (followingInProgress.has(customerId)) {
        if (API_CONFIG.DEBUG) {
          console.log('⏸️ useFollowManager: Already processing:', customerId);
        }
        return;
      }

      const wasFollowed = followedUsers.has(customerId);
      const willFollow = !wasFollowed;

      // ✅ OPTIMISTIC UPDATE
      setFollowedUsers((prev) => {
        const next = new Set(prev);
        if (willFollow) {
          next.add(customerId);
        } else {
          next.delete(customerId);
        }
        return next;
      });

      setFollowingInProgress((prev) => new Set(prev).add(customerId));

      try {
        if (willFollow) {
          await followUser(customerId);
          toastSuccess(
            t('follower:success.followTitle'),
            t('follower:success.followMessage')
          );
        } else {
          await unfollowUser(customerId);
          toastSuccess(
            t('follower:success.unfollowTitle'),
            t('follower:success.unfollowMessage')
          );
        }

        if (API_CONFIG.DEBUG) {
          console.log(
            `✅ useFollowManager: ${willFollow ? 'Followed' : 'Unfollowed'}:`,
            customerId
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
            next.add(customerId);
          } else {
            next.delete(customerId);
          }
          return next;
        });

        toastError(t('follower:error.title'), t('follower:error.message'));
      } finally {
        setFollowingInProgress((prev) => {
          const next = new Set(prev);
          next.delete(customerId);
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