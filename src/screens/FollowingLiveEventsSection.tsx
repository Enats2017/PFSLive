import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { FollowingLiveEvent } from './HomeScreen';
import { colors, commonStyles, spacing } from '../styles/common.styles';
import { homeStyles } from '../styles/home.styles';
import { formatClockTime } from '../utils/timeFormat';
import { useTranslation } from 'react-i18next';

interface Props {
    events: FollowingLiveEvent[];
    serverDatetime: string;
    onRoutePress: (event: FollowingLiveEvent) => void;
}

function parseServerDatetime(serverDatetime: string): number {
    return new Date(serverDatetime.replace(' ', 'T') + 'Z').getTime();
}

function getMs(date: string, time: string): number {
    return new Date(`${date}T${time}Z`).getTime();
}

function formatCountdown(ms: number): string {
    const totalSec = Math.round(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const pad = (n: number) => String(n).padStart(2, '0');
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

const FollowingLiveEventsSection: React.FC<Props> = ({ events, serverDatetime, onRoutePress }) => {
    const { t } = useTranslation(['home', 'common']);
    const [serverOffset] = useState<number>(() => {
        const serverMs = parseServerDatetime(serverDatetime);
        return serverMs - Date.now();
    });
    const [now, setNow] = useState<number>(() => parseServerDatetime(serverDatetime));
    useEffect(() => {
        const interval = setInterval(() => {
            setNow(Date.now() + serverOffset);
        }, 1000);
        return () => clearInterval(interval);
    }, [serverOffset]);

    return (
        <View style={homeStyles.section_followers}>
            <View style={homeStyles.header}>
                <Text style={commonStyles.subtitle}>{t('home:followingEvents.sectionTitle')}</Text>
            </View>
            {events.map((event) => {
                const raceMs = getMs(event.race_date, event.race_time);
                const diff = raceMs - now;
                const isLive = event.race_status === 'in_progress';        
                const isUpcoming = event.race_status === 'upcoming'; 
                return (
                    <View key={event.product_app_id} style={[commonStyles.card, {  borderWidth: 0.5, borderColor: 'rgba(0,0,0,0.12)', marginBottom:spacing.md}]}>
                        <View style={homeStyles.cardTop}>
                            <View style={homeStyles.eventBody}>
                                <Text style={commonStyles.title} numberOfLines={1}>
                                    {event.event_name}
                                </Text>
                                <View style={homeStyles.eventMeta}>
                                    <Ionicons name="time-outline" size={13} color="#888780" />
                                    <Text style={commonStyles.date}>{formatClockTime(event.race_time)}</Text>
                                </View>
                            </View>
                            <View style={homeStyles.countdownBlock}>
                                {isLive ? (
                                    <View style={homeStyles.liveBadge}>
                                        <View style={homeStyles.liveDot} />
                                        <Text style={homeStyles.liveText}>{t('home:followingEvents.live')}</Text>
                                    </View>
                                ) : isUpcoming ? (
                                    <>
                                        <Text style={commonStyles.date}>{t('home:followingEvents.startsIn')}</Text>
                                        <Text style={homeStyles.countdownValue}>{formatCountdown(diff)}</Text>
                                    </>
                                ) : null}
                            </View>
                        </View>
                        <View style={homeStyles.divider} />
                        <TouchableOpacity
                            style={[commonStyles.primaryButton,{flexDirection:'row',gap:6}]}
                            onPress={() => onRoutePress(event)}
                            activeOpacity={0.7}
                        >
                            <MaterialIcons name="route" size={16} color={colors.white} />
                            <Text style={commonStyles.primaryButtonText}>{t('home:followingEvents.routeButton')}</Text>
                        </TouchableOpacity>
                    </View>
                );
            })}
        </View>
    );
};



export default FollowingLiveEventsSection;