import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { followUser, unfollowUser, isUserFollowed } from '../../utils/followStorage';
import { toastError, toastSuccess } from '../../utils/toast';

interface UseFollowResult {
  isFollowed: boolean;
  isLoading: boolean;
  toggleFollow: () => Promise<void>;
  canFollow: boolean;
}

export function useFollow(customerId: number | null): UseFollowResult {
  const [isFollowed, setIsFollowed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const canFollow = customerId !== null && customerId > 0;

  useEffect(() => {
    if (!canFollow || customerId === null) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const followed = await isUserFollowed(customerId);
        if (!cancelled) setIsFollowed(followed);
      } catch {
        // Silently fail — isFollowed stays false
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [customerId, canFollow]);

  const toggleFollow = useCallback(async () => {
    if (isLoading) return;
    if (!canFollow) return;
    if (customerId === null) return;

    setIsLoading(true);
    const next = !isFollowed;
    setIsFollowed(next);
    try {
      if (next) {
        await followUser(customerId);
        toastSuccess('Following', 'You have successfully added to favourites.');
      } else {
        await unfollowUser(customerId);
        toastSuccess('Unfollowed', 'You have been removed from favourites.');
      }
    } catch {
      setIsFollowed(!next);
      toastError('Error', 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [isFollowed, isLoading, customerId, canFollow]);

  return { isFollowed, isLoading, toggleFollow, canFollow };
}