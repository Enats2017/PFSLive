import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { palette, radii, shadows, space, fonts, type } from '../styles/common.styles';
import { Badge, BadgeTone } from './ui';

interface EventListCardProps {
  name: string;
  date: string;
  city?: string;
  country?: string;
  imageUrl?: string | null;
  /** LIVE / TODAY / a start time — omit for no badge. */
  badgeLabel?: string;
  badgeTone?: BadgeTone;
  /** Draw the badge in caps — status words only, never data. */
  badgeCaps?: boolean;
  onPress: () => void;
}

/**
 * ✅ 08_EventList.png — one card shape for every event list in the app.
 *
 * The three tabs (live, past, upcoming) each had their own copy of this row,
 * differing only in the analytics label, so they drifted apart. The artwork is a
 * fixed 104pt plate on the left: event logos are wordmarks with their own
 * padding and aspect, so they are contained on white rather than cropped to
 * fill, which is what made them look arbitrarily zoomed before.
 */
export const EventListCard: React.FC<EventListCardProps> = React.memo(({
  name,
  date,
  city,
  country,
  imageUrl,
  badgeLabel,
  badgeTone = 'lime',
  badgeCaps = false,
  onPress,
}) => {
  const uri = imageUrl?.trim();
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>(uri ? 'loading' : 'error');
  const place = [city, country].filter(Boolean).join(', ');

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={[name, date, place].filter(Boolean).join(', ')}
    >
      <View style={styles.thumb}>
        {uri && status !== 'error' && (
          <Image
            source={{ uri }}
            style={StyleSheet.absoluteFill}
            contentFit="contain"
            cachePolicy="memory-disk"
            recyclingKey={uri}
            transition={150}
            onLoad={() => setStatus('loaded')}
            onError={() => setStatus('error')}
          />
        )}
        {status !== 'loaded' && (
          <View style={[styles.thumbOverlay, status === 'error' && styles.thumbFallback]}>
            {status === 'loading'
              ? <ActivityIndicator size="small" color={palette.navy} />
              : <Text style={styles.thumbFallbackText} numberOfLines={3}>{name}</Text>}
          </View>
        )}
      </View>

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.name} numberOfLines={2}>{name}</Text>
          {!!badgeLabel && <Badge label={badgeLabel} tone={badgeTone} caps={badgeCaps} />}
        </View>

        <View style={styles.metaRow}>
          <Ionicons name="calendar-outline" size={13} color={palette.textMuted} />
          <Text style={styles.meta} numberOfLines={1}>{date}</Text>
        </View>

        {!!place && (
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={13} color={palette.textMuted} />
            <Text style={styles.meta} numberOfLines={1}>{place}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
});

EventListCard.displayName = 'EventListCard';

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: palette.surface,
    borderRadius: radii.md,
    overflow: 'hidden',
    marginBottom: space.md,
    ...shadows.card,
  },
  // Clips the image itself. `card` sets overflow: 'hidden' with a borderRadius,
  // but it also carries elevation (shadows.card) - and on Android an elevated
  // view does not reliably clip children to its rounded corners, so the
  // absolutely-filled image spilled past the card edge. This container has no
  // elevation, so its clip holds.
  thumb: {
    width: 104,
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderTopLeftRadius: radii.md,
    borderBottomLeftRadius: radii.md,
  },
  thumbOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.page,
  },
  thumbFallback: {
    backgroundColor: palette.navy,
    paddingHorizontal: space.sm,
  },
  thumbFallbackText: {
    fontFamily: fonts.display,
    fontSize: 12,
    color: palette.lime,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  body: {
    flex: 1,
    minWidth: 0,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  name: {
    ...type.h3,
    flex: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.sm,
  },
  meta: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: palette.textMuted,
    flex: 1,
  },
});
