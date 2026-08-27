import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../styles/common.styles';
import { fanstyle } from '../styles/fan.styles';
import { EventItem } from '../services/followerEvent';
import { formatEventDate } from '../utils/dateFormatter';

interface EventCardProps {
    item: EventItem;
    t: any;
}

const EventCard: React.FC<EventCardProps> = ({ item, t }) => {
    const uri = item.event_image?.trim();
    // ✅ expo-image, not RN Image. This card renders ~10 at a time in the fan
    // "Next Events" slider, and RN Image decodes each banner with no disk cache
    // and no reliable downsampling — the bitmap-memory profile Play's new
    // threshold targets. expo-image caches to memory AND disk and decodes to the
    // view size (160x112 dp here) instead of the source size.
    //
    // The hand-rolled `loadedCache` Set that used to live here is gone: it only
    // ever tracked "has this URI loaded once this session" to skip the spinner,
    // which expo-image's own cache does properly, including across launches.
    const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>(
        uri ? 'loading' : 'error'
    );

    return (
        <View style={fanstyle.eventCard}>
            <View style={fanstyle.eventImg}>
                {uri && status !== 'error' && (
                    <Image
                        source={{ uri }}
                        style={StyleSheet.absoluteFill}
                        // expo-image: contentFit replaces RN's resizeMode
                        contentFit="cover"
                        cachePolicy="memory-disk"
                        // Lets the list recycle the underlying view between cards
                        // instead of holding a bitmap per row.
                        recyclingKey={uri}
                        transition={150}
                        onLoad={() => setStatus('loaded')}
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
