import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, AppState } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { FollowingLiveEvent } from './HomeScreen';
import { commonStyles, spacing, palette, space } from '../styles/common.styles';
import { homeStyles } from '../styles/home.styles';
import { formatClockTime } from '../utils/timeFormat';
import { useTranslation } from 'react-i18next';

interface Props {
    events: FollowingLiveEvent[];
    onRoutePress: (event: FollowingLiveEvent) => void;
}

function formatCountdown(totalSec: number): string {
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const pad = (n: number) => String(n).padStart(2, '0');
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/**
 * Seconds to the gun: `starts_in_seconds` was true when the list arrived.
 *
 * ✅ Measured from when THIS list arrived, not from when the section mounted
 * (app audit 2026-11-26). Home refetches on every focus and every 5 min while
 * the section stays mounted, so "fresh starts_in − time since mount" counted
 * the elapsed time twice: back on Home after 10 min, a race 20 min away read
 * 10 min, and Live showed before the gun.
 */
export function secondsToStart(startsInSeconds: number | null | undefined, receivedAtMs: number, nowMs: number): number {
    const elapsed = Math.max(0, Math.floor((nowMs - receivedAtMs) / 1000));
    return Math.max(0, (startsInSeconds || 0) - elapsed);
}

const FollowingLiveEventsSection: React.FC<Props> = ({ events, onRoutePress }) => {
    const { t } = useTranslation(['home', 'common']);
    // A new `events` array = a new answer from home_api: re-anchor on it.
    const receivedAt = useMemo(() => Date.now(), [events]);
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        setNow(Date.now());
        const hasUpcoming = events.some(e => e.race_status === 'upcoming');
        if (!hasUpcoming) return;
        const interval = setInterval(() => {
            setNow(Date.now());
        }, 1000);
        // Timers pause in the background: read the clock again on return.
        const sub = AppState.addEventListener('change', (next) => {
            if (next === 'active') setNow(Date.now());
        });

        return () => { clearInterval(interval); sub.remove(); };
    }, [events]);

    return (
        <View style={homeStyles.section_followers}>
            <View style={homeStyles.header}>
                <Text style={homeStyles.sectionLabel}>
                    {t('home:followingEvents.sectionTitle')}
                </Text>
            </View>

            {events.map((event, eventIdx) => {
                const remainingSec = secondsToStart(event.starts_in_seconds, receivedAt, now);
                const isLive = event.race_status === 'in_progress' || (event.race_status === 'upcoming' && remainingSec === 0);
                const isUpcoming = event.race_status === 'upcoming' && remainingSec > 0;

                // A single event can appear once per distance, so product_app_id alone
                // is no longer unique across rows (it started colliding when the feed
                // began returning per-distance rows). Compose it with the distance id
                // (product_option_value_app_id) — and fall back to the row index — so
                // every card has a stable, unique key.
                const rowKey = `${event.product_app_id}-${event.product_option_value_app_id ?? 'na'}-${eventIdx}`;

                return (
                    <View
                        key={rowKey}
                        style={[
                            commonStyles.card,
                            {
                                borderWidth: 1,
                                borderColor: palette.border,
                                marginBottom: spacing.md,
                            },
                        ]}
                    >

                        <View style={homeStyles.cardTop}>
                            {/* Left: name + time */}
                            <View style={homeStyles.eventBody}>
                                {/* No line limit (was 1): long event names were cut with "…" —
                                    the name column is flex 1 beside the countdown, so it wraps. */}
                                <Text style={commonStyles.title}>
                                    {event.event_name}
                                </Text>
                               
                                <View style={homeStyles.eventMeta}>
                                    <Ionicons name="time-outline" size={13} color={palette.textMuted} />
                                    <Text style={commonStyles.date}>
                                        {formatClockTime(event.race_time)}
                                    </Text>
                                </View>
                                 {event.race_distance ? (
                                    <View style={homeStyles.eventMeta}>
                                        <Ionicons name="location" size={13} color={palette.textBody} />  {/* ✅ map icon for distance */}
                                        <Text style={[commonStyles.date, homeStyles.eventMetaShrink]}>
                                            {event.race_distance}
                                        </Text>
                                    </View>
                                ) : null}
                            </View>

                            <View style={homeStyles.countdownBlock}>
                                {isLive && (
                                    <View style={homeStyles.liveBadge}>
                                        <View style={homeStyles.liveDot} />
                                        <Text style={homeStyles.liveText}>
                                            {t('home:followingEvents.live')}
                                        </Text>
                                    </View>
                                )}
                                {isUpcoming && (
                                    <>
                                        <Text style={commonStyles.date}>
                                            {t('home:followingEvents.startsIn')}
                                        </Text>
                                        <Text style={homeStyles.countdownValue}>
                                            {remainingSec > 0 ? formatCountdown(remainingSec) : '00:00'}
                                        </Text>
                                    </>
                                )}
                            </View>
                        </View>

                        <View style={homeStyles.divider} />

                        {event.followed_participants?.length > 0 && (
                            <View style={{ marginBottom: spacing.md }}>
                                <Text style={homeStyles.followLabel}>
                                    {t('home:followingEvents.youFollow')}
                                </Text>
                                {event.followed_participants.map((p) => {
                                    const name = [p.firstname, p.lastname].filter(Boolean).join(' ');
                                    const initials = [p.firstname, p.lastname]
                                        .filter(Boolean).map((n) => n[0]).join('').toUpperCase() || '?';
                                    return (
                                        <View key={p.participant_app_id} style={homeStyles.followRow}>
                                            <View style={homeStyles.followAvatar}>
                                                <Text style={homeStyles.followAvatarText}>{initials}</Text>
                                            </View>
                                            {/* 2 lines (was 1): ~123pt beside "Bib 12345" cut most names (audit 2026-10-22) */}
                                            <Text style={homeStyles.followName} numberOfLines={2}>{name}</Text>
                                            {!!p.bib_number && (
                                                <Text style={homeStyles.followBib}>
                                                    {t('common:bib', 'Bib')} {p.bib_number}
                                                </Text>
                                            )}
                                        </View>
                                    );
                                })}
                            </View>
                        )}

                        <TouchableOpacity
                            style={[homeStyles.followerBtn, { flexDirection: 'row', gap: space.sm }]}
                            onPress={() => onRoutePress(event)}
                            
                        >
                            <MaterialIcons name="person-add-alt-1" size={24} color={palette.ink} />
                            <Text style={homeStyles.followerText}>
                                {t('home:followingEvents.routeButton')}
                            </Text>
                        </TouchableOpacity>

                        <Text style={homeStyles.followCaption}>
                            {t('home:followingEvents.opensEventPage')}
                        </Text>
                    </View>
                );
            })}
        </View>
    );
};

export default FollowingLiveEventsSection;