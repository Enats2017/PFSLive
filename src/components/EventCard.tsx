import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { palette, radii, withAlpha } from '../styles/common.styles';
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
                            <ActivityIndicator size="small" color={palette.navy} />
                        ) : (
                            <Ionicons name="image-outline" size={22} color={palette.ink} />
                        )}
                    </View>
                )}
            </View>

            <View style={fanstyle.eventInfo}>
                {/* 2 lines (was 1): "Trail Festival…" was cut at larger iOS text sizes */}
                {/* 3 lines (was 2): names >= ~29 chars were cut at x1.35 (audit 2026-10-22) */}
                <Text style={fanstyle.eventName} numberOfLines={3}>{item.name}</Text>
                <View style={fanstyle.eventDateRow}>
                    <Text style={fanstyle.eventDate}>{formatEventDate(item.race_date, t)}</Text>
                    <Ionicons name="calendar-outline" size={15} color={palette.ink} />
                </View>
            </View>
        </View>
    );
};

/**
 * ✅ Stand-in for an EventCard while the "Next events" row loads (developer
 * report 2026-10-29: on a slow network the row was blank). Same card, same
 * 160 x 112 image box and the image box's own spinner, so the row keeps its
 * size and nothing jumps when the real cards arrive; grey bars where the
 * name and date go.
 */
export const EventCardSkeleton: React.FC<{ label?: string }> = ({ label }) => (
    <View
        style={fanstyle.eventCard}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={label}
    >
        <View style={[fanstyle.eventImg, styles.skeletonFill]}>
            <View style={styles.overlay}>
                <ActivityIndicator size="small" color={palette.navy} />
            </View>
        </View>
        <View style={fanstyle.eventInfo}>
            <View>
                <View style={[styles.skeletonBar, { width: '90%' }]} />
                <View style={[styles.skeletonBar, { width: '60%' }]} />
            </View>
            <View style={[styles.skeletonBar, { width: '70%', marginTop: 12, marginBottom: 0 }]} />
        </View>
    </View>
);

const styles = StyleSheet.create({
    skeletonFill: {
        backgroundColor: palette.fill,
    },
    skeletonBar: {
        height: 12,
        borderRadius: radii.pill,
        backgroundColor: palette.fill,
        marginBottom: 8,
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: withAlpha(palette.surface, 0.20),
    },
});

export default EventCard;
