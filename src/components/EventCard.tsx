import React, { useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../styles/common.styles';
import { fanstyle } from '../styles/fan.styles';
import { EventItem } from '../services/followerEvent';
import { formatEventDate } from '../utils/dateFormatter';


const loadedCache = new Set<string>();

interface EventCardProps {
    item: EventItem;
    t: any;
}

const EventCard: React.FC<EventCardProps> = ({ item, t }) => {
    const uri = item.event_image?.trim();
    const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>(
        uri && loadedCache.has(uri) ? 'loaded' : uri ? 'loading' : 'error'
    );

    return (
        <View style={fanstyle.eventCard}>
            <View style={fanstyle.eventImg}>
                {uri && status !== 'error' && (
                    <Image
                        source={{ uri }}
                        style={StyleSheet.absoluteFill}
                        resizeMode="cover"
                        onLoad={() => {
                            loadedCache.add(uri);
                            setStatus('loaded');
                        }}
                        onError={() => setStatus('error')}
                    />
                )}

                {status !== 'loaded' && (
                    <View style={styles.overlay}>
                        {status === 'loading' ? (
                            <ActivityIndicator size="small" color={colors.primary} />
                        ) : (
                            <Ionicons name="image-outline" size={22} color={colors.primaryDark} />
                        )}
                    </View>
                )}
            </View>

            <View style={fanstyle.eventInfo}>
                <Text style={fanstyle.eventName} numberOfLines={1}>{item.name}</Text>
                <View style={fanstyle.eventDateRow}>
                    <Text style={fanstyle.eventDate}>{formatEventDate(item.race_date, t)}</Text>
                    <Ionicons name="calendar-outline" size={15} color={colors.primaryDark} />
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.white + '33',
    },
});

export default EventCard;