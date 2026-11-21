// src/components/Home/PreRaceCountdown.tsx
//
// ✅ "Starts in 2 d 4 h" on the next-race card, BEFORE Start is pressed.
//
// HomeScreen already computed the time to the gun — but only inside
// doStartGPSTracking, i.e. after the runner pressed Start. This shows it on
// the idle card days ahead. Read-only: it does not feed the race-start gate,
// which keeps its own fresh computation at Start time.
//
// startAtMs is real UTC ms, built by the caller with the same fake-UTC diff
// HomeScreen uses (race_datetime − server_datetime, both event-tz, anchored
// to Date.now() at fetch) — NOT getServerTime(), see HomeScreen ~474.

import React, { useEffect, useState } from 'react';
import { AppState, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { palette } from '../../styles/common.styles';
import { readinessStyles as s } from '../../styles/readiness.styles';

interface Props {
  startAtMs: number | null;
}

const MIN = 60_000;

export const PreRaceCountdown: React.FC<Props> = ({ startAtMs }) => {
  const { t } = useTranslation(['readiness']);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (startAtMs == null) return;
    // Fresh NOW, not the mount-time clock: a new start time (or a remount
    // from cache) would otherwise show a label up to 15 s — or, after the app
    // slept in the background with timers paused, hours — out of date.
    setNow(Date.now());
    // Minute resolution is all the label shows; 15s keeps it within a minute.
    const id = setInterval(() => setNow(Date.now()), 15_000);
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') setNow(Date.now());
    });
    return () => { clearInterval(id); sub.remove(); };
  }, [startAtMs]);

  if (startAtMs == null || !isFinite(startAtMs)) return null;

  const ms = startAtMs - now;
  // Past the gun: once tracking runs, the in-tracking status takes over (this
  // pill is only shown while NOT tracking). Gone 30 min after the gun.
  if (ms <= -30 * MIN) return null;

  let label: string;
  if (ms < 0) {
    // The race is under way and this runner hasn't pressed Start — say so,
    // not "starting soon".
    label = t('readiness:countdown.started');
  } else if (ms <= MIN) {
    label = t('readiness:countdown.startingSoon');
  } else {
    const days = Math.floor(ms / (24 * 60 * MIN));
    const hours = Math.floor((ms % (24 * 60 * MIN)) / (60 * MIN));
    const minutes = Math.floor((ms % (60 * MIN)) / MIN);
    const parts: string[] = [];
    if (days > 0) parts.push(t('readiness:countdown.days', { count: days }));
    if (hours > 0 || days > 0) parts.push(t('readiness:countdown.hours', { count: hours }));
    if (days === 0) parts.push(t('readiness:countdown.minutes', { count: minutes }));
    label = t('readiness:countdown.startsIn', { time: parts.join(' ') });
  }

  return (
    <View style={s.countdownPill} accessibilityRole="text">
      <Ionicons name="hourglass-outline" size={14} color={palette.noticeText} />
      <Text style={s.countdownText}>{label}</Text>
    </View>
  );
};

/**
 * Start moment from the server's own epoch (home_api next_race_start_ts,
 * computed in the event's timezone), anchored to the phone's clock via the
 * server's "now" — so a wrong phone clock or a DST change doesn't shift it.
 */
export const startMsFromServer = (
  startTs?: number,
  serverNowTs?: number,
  fetchedAtMs?: number,
): number | null => {
  const s = Number(startTs), n = Number(serverNowTs);
  if (!(s > 0) || !fetchedAtMs) return null;
  // home_api's answer can be up to ~45 s old (cache), so its "now" is stale:
  // use the absolute instant with the phone's clock — unless the phone's
  // clock is clearly wrong (> 10 min off the server), then the server's.
  if (n > 0 && Math.abs(n * 1000 - fetchedAtMs) > 10 * 60 * 1000) {
    return fetchedAtMs + (s - n) * 1000;
  }
  return s * 1000;
};

/** Same maths as HomeScreen's Start path, anchored to when the data arrived. */
export const computeRaceStartMs = (
  raceDate?: string,
  raceTime?: string,
  serverDatetime?: string,
  fetchedAtMs?: number,
): number | null => {
  if (!raceDate || !raceTime || !serverDatetime || !fetchedAtMs) return null;
  const serverFakeMs = new Date(serverDatetime.replace(' ', 'T') + 'Z').getTime();
  const raceFakeMs = new Date(`${raceDate}T${raceTime}Z`).getTime();
  const diff = raceFakeMs - serverFakeMs;
  return isNaN(diff) ? null : fetchedAtMs + diff;
};

/**
 * ✅ Time to the gun AT THE MOMENT Start is tapped (developer report
 * 2026-10-29: the "Race not started yet" popup said 11 minutes for a race 5-10
 * minutes away). It used home_api's next_race_in_hours, a figure the server
 * worked out when Home last loaded (plus up to ~45 s of API cache) and never
 * moved on — tap Start six minutes after Home loaded and it was six minutes
 * out. Measured from the same start instant as the card's countdown
 * (startAtMs), so popup and card agree. No start instant (a placeholder
 * 00:00 start): the server's hours, as before.
 */
export const msUntilStart = (
  startAtMs: number | null,
  nowMs: number,
  fallbackHours?: number,
): number => {
  if (startAtMs != null && isFinite(startAtMs)) return startAtMs - nowMs;
  return (Number(fallbackHours) || 0) * 60 * MIN;
};

/**
 * "2d 4h" / "1h 5m" / "7m" for the early-start popup. Whole minutes rounded
 * DOWN, like the card's countdown ("Starts in 5 min" for 5 min 40 s — the
 * popup used to round up and say 6); never below 1m before the gun.
 */
export const formatTimeToStart = (ms: number): string => {
  const totalMin = Math.max(1, Math.floor(ms / MIN));
  const days = Math.floor(totalMin / (24 * 60));
  const hours = Math.floor((totalMin % (24 * 60)) / 60);
  const minutes = totalMin % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};
