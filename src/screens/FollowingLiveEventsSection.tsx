import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { FollowingLiveEvent } from './HomeScreen';
import { colors, commonStyles, spacing } from '../styles/common.styles';
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
                <Text style={commonStyles.subtitle}>
                    {t('home:followingEvents.sectionTitle')}
                </Text>
            </View>

            {events.map((event) => {
                const remainingSec = Math.max(0, (event.starts_in_seconds || 0) - elapsed);
                const isLive = event.race_status === 'in_progress' || (event.race_status === 'upcoming' && remainingSec === 0);
                const isUpcoming = event.race_status === 'upcoming' && remainingSec > 0;

                return (
                    <View
                        key={event.product_app_id}
                        style={[
                            commonStyles.card,
                            {
                                borderWidth: 0.5,
                                borderColor: isLive ? 'rgba(163,45,45,0.3)' : 'rgba(0,0,0,0.12)',
                                marginBottom: spacing.md,
                            },
                        ]}
                    >

                        <View style={homeStyles.cardTop}>
                            {/* Left: name + time */}
                            <View style={homeStyles.eventBody}>
                                <Text style={[commonStyles.title,{marginBottom:spacing.xs}]} numberOfLines={1}>
                                    {event.event_name}
                                </Text>
                                {event.race_distance ? (
                                    <View style={[homeStyles.eventMeta,{marginBottom:spacing.xs}]}>
                                        <Ionicons name="map-outline" size={13} color={colors.gray700} />  {/* ✅ map icon for distance */}
                                        <Text style={commonStyles.date}>
                                            {event.race_distance}
                                        </Text>
                                    </View>
                                ) : null}
                                <View style={homeStyles.eventMeta}>
                                    <Ionicons name="time-outline" size={13} color="#888780" />
                                    <Text style={commonStyles.date}>
                                        {formatClockTime(event.race_time)}
                                    </Text>
                                </View>
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

                        <TouchableOpacity
                            style={[commonStyles.primaryButton, { flexDirection: 'row', gap: 6 }]}
                            onPress={() => onRoutePress(event)}
                            activeOpacity={0.7}
                        >
                            <MaterialIcons name="route" size={16} color={colors.white} />
                            <Text style={commonStyles.primaryButtonText}>
                                {t('home:followingEvents.routeButton')}
                            </Text>
                        </TouchableOpacity>
                    </View>
                );
            })}
        </View>
    );
};

export default FollowingLiveEventsSection;