// UserFavouriteList hides a row the moment its athlete is unfollowed (see
// removedIds there). If that unfollow FAILS, useFollowManager rolls the follow
// back — and the row used to stay hidden anyway until the next visit, so the
// list said "not following" for an athlete the phone (and server) still
// follows. Pure so it can be tested without rendering the screen.

/**
 * removedIds minus every id that is followed again and no longer being
 * toggled (= the unfollow was rolled back). Returns `prev` itself when nothing
 * changed, so a state setter using it does not re-render.
 */
export function pruneRestoredRemovals(
  prev: Set<number>,
  followedUsers: Set<number>,
  inProgressKeys: Set<string>,
): Set<number> {
  let changed = false;
  const next = new Set<number>();
  prev.forEach((id) => {
    if (followedUsers.has(id) && !inProgressKeys.has(`customer:${id}`)) changed = true;
    else next.add(id);
  });
  return changed ? next : prev;
}
