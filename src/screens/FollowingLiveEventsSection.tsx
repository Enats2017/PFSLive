import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { FollowingLiveEvent } from './HomeScreen';
import { commonStyles, spacing, palette } from '../styles/common.styles';
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

const FollowingLiveEventsSection: React.FC<Props> = ({ events, onRoutePress }) => {
    const { t } = useTranslation(['home', 'common']);
    const mountTimeRef = useRef(Date.now());
    const [elapsed, setElapsed] = useState(0);

    useEffect(() => {
        const hasUpcoming = events.some(e => e.race_status === 'upcoming');
        if (!hasUpcoming) return;
        const interval = setInterval(() => {
            setElapsed(Math.floor((Date.now() - mountTimeRef.current) / 1000));
        }, 1000);

        return () => clearInterval(interval);
    }, [events]);

    return (
        <View style={homeStyles.section_followers}>
            <View style={homeStyles.header}>
                <Text style={homeStyles.sectionLabel}>
                    {t('home:followingEvents.sectionTitle')}
                </Text>
            </View>

            {events.map((event, eventIdx) => {
                const remainingSec = Math.max(0, (event.starts_in_seconds || 0) - elapsed);
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
                                <Text style={commonStyles.title} numberOfLines={1}>
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
                                        <Text style={commonStyles.date}>
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
                                            <Text style={homeStyles.followName} numberOfLines={1}>{name}</Text>
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
                            style={[homeStyles.followerBtn, { flexDirection: 'row', gap: 6 }]}
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