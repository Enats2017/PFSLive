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
// ~1.5 h on the 100 km, CP1 at 8.3 km), and one who stopped before CP1. Someone
// who started must never read "Not started", so 'not_started' is not trusted
// alone: has_started (RR's own "Started" column, sent by the API since
// 2026-10-23) reads "In progress", and so does any runner while the distance is
// in progress (an older API without the field: what the card showed before).
// The START checkpoint is NOT used: RR fills its time with the gun for every
// entrant (rr_result_3_18: 52 runners with Started=0 all carry "16:00:00").
// The FavouriteItem fields it reads, declared here so the test compiles this
// file alone (importing services/favourites pulls in the api + i18n setup).
export interface FavouriteStatusInput {
  participant_status?: string | null;
  race_status: string;
  has_started?: boolean | null;
}

export function favouriteRunnerStatus(item: FavouriteStatusInput): string {
  const ps = String(item.participant_status ?? '').trim();
  if (ps === '') return item.race_status;          // older API / local row without the field
  if (ps !== 'not_started') return ps;              // finished | in_progress | DNF | DNS | DSQ | other feed code
  if (item.has_started === true) return 'in_progress';
  return item.race_status === 'in_progress' ? 'in_progress' : 'not_started';
}
