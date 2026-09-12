import { create } from 'zustand';

/**
 * A "the follow graph moved" signal, so screens that show SERVER-derived follow
 * numbers know they must refetch.
 *
 * Why a store and not the existing machinery:
 *   - useFollowManager holds its state per hook instance, so a follow made on
 *     one screen is invisible to every other mounted screen.
 *   - followers_count / following_count are computed server-side, so the local
 *     AsyncStorage set that drives the heart icons cannot produce them.
 *   - OwnProfile deliberately does NOT refetch on focus (it takes a scroll-sync
 *     fast path), which is why its counts used to sit at whatever the first
 *     mount fetched.
 *
 * A monotonic counter rather than a boolean: a reader compares it against the
 * value it last fetched at, so it works with any number of independent readers
 * and needs no "consume"/reset step that could race between screens.
 *
 * This is deliberately NOT persisted. It marks "something changed during this
 * session"; a cold start refetches anyway.
 */
interface FollowState {
  /** Bumped once per follow/unfollow that the server accepted. */
  version: number;
  bump: () => void;
}

export const useFollowStore = create<FollowState>((set) => ({
  version: 0,
  bump: () => set((s) => ({ version: s.version + 1 })),
}));
