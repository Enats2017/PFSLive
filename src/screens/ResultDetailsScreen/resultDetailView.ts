// Which card the result detail screen shows, and whether it keeps polling.
// Pure, so it can be tested without React: npm run test:result-detail-view
//
// 2026-10-23 (Grizzly100 pre-race), two fixes to the rules ResultDetails had inline:
//  1. The race status came from route.params.raceStatus — the DISTANCE status
//     the previous screen had when it was tapped — and never changed. A detail
//     opened before the gun (a 23km runner's page at 10:00, gun 17:00) stayed on
//     the upcoming card for the whole race, and useResultDetail did not poll a
//     not_started race either. Now the live event.race_status from each response
//     wins; the param only covers the first render.
//  2. After the distance's end_time race_status is 'finished', which put a
//     runner still ON COURSE (participant_status 'in_progress') on the final
//     card. They now keep the live card, and polling continues for them.
// Everything else is the previous inline rule, unchanged: out-of-race codes
// (DNF / DNS / DSQ) get the final card, as before.

export type ResultDetailView = 'live' | 'final' | 'upcoming' | null;

export function resultDetailRaceStatus(paramStatus: string | undefined, eventStatus: string | undefined | null): string | undefined {
  const live = String(eventStatus ?? '').trim();
  return live !== '' ? live : paramStatus;
}

export function resultDetailView(raceStatus: string | undefined, participantStatus: string | undefined): ResultDetailView {
  const ps = participantStatus;
  if (raceStatus === 'finished' && ps === 'in_progress') return 'live';                         // fix 2
  if (raceStatus === 'in_progress' && (ps === 'in_progress' || ps === 'not_started')) return 'live';
  if (raceStatus === 'finished' || (raceStatus === 'in_progress' && ps !== 'not_started' && ps !== 'in_progress')) return 'final';
  if (raceStatus === 'not_started' || ps === 'not_started') return 'upcoming';
  return null;
}

export function shouldPollResultDetail(raceStatus: string | undefined | null, participantStatus: string | undefined | null): boolean {
  if (raceStatus === 'in_progress' || raceStatus === 'not_started') return true;               // not_started: fix 1
  return raceStatus === 'finished' && participantStatus === 'in_progress';                      // fix 2
}

// The live card's header label. After end_time the distance reads 'finished',
// but the live card is only shown then for a runner still on course.
export function raceLiveStatus(eventStatus: string | undefined | null, participantStatus: string | undefined | null): string {
  if (eventStatus === 'finished' && participantStatus === 'in_progress') return 'in_progress';
  return eventStatus || 'in_progress';
}
