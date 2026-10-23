// The badge status of one followed runner (FavouriteCard). Pure, so it can be
// tested without React: npm run test:favourite-status
//
// The card used item.race_status, which is the DISTANCE's status (2026-10-23,
// Grizzly100 pre-race): a runner who had finished read "In progress" until the
// distance's end_time, a DNF read "In progress", and at end_time every runner
// still on course flipped to "Finished". participant_status is the runner's own
// (get_favourite_all_events_api.php): DNF/DNS/DSQ from Pos., 'finished' once the
// finish is crossed, 'in_progress' once a checkpoint AFTER the start is crossed,
// else 'not_started'.
//
// That last case is also every runner between the start line and CP1 (up to
// ~1.5 h on the 100 km, CP1 at 8.3 km), so 'not_started' is not trusted alone:
// a crossed START mat, or a distance that is in progress, still reads
// "In progress" — what the card showed before for that stretch.
// The three FavouriteItem fields it reads, declared here so the test compiles
// this file alone (importing services/favourites pulls in the api + i18n setup).
export interface FavouriteStatusInput {
  participant_status?: string | null;
  race_status: string;
  checkpoints?: ReadonlyArray<{ is_start?: boolean; is_crossed?: boolean }> | null;
}

export function favouriteRunnerStatus(item: FavouriteStatusInput): string {
  const ps = String(item.participant_status ?? '').trim();
  if (ps === '') return item.race_status;          // older API / local row without the field
  if (ps !== 'not_started') return ps;              // finished | in_progress | DNF | DNS | DSQ | other feed code
  const startCrossed = (item.checkpoints ?? []).some((cp) => cp.is_start === true && cp.is_crossed === true);
  if (startCrossed || item.race_status === 'in_progress') return 'in_progress';
  return 'not_started';
}
