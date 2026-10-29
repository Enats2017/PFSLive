// src/components/NextEventsPlaceholder.tsx
//
// ✅ What the "Next events" row shows instead of its cards (developer report
// 2026-10-29): skeleton cards while loading, and a short message with "Try
// again" when it failed. Used by the Participant hub and the Fan hub; null once
// the cards are there (status 'ready').

import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { palette } from '../styles/common.styles';
import { fanstyle } from '../styles/fan.styles';
import { EventCardSkeleton } from './EventCard';
import type { NextEventsStatus } from '../hooks/useNextEvents';

/** Skeletons shown while loading: as many cards as fit the first view. */
export const NEXT_EVENTS_SKELETONS = 3;

interface Props {
    status: NextEventsStatus;
    onRetry: () => void;
    t: any;
}

const NextEventsPlaceholder: React.FC<Props> = ({ status, onRetry, t }) => {
    if (status === 'ready') return null;

    if (status === 'loading') {
        return (
            <ScrollView
                horizontal
                scrollEnabled={false}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={fanstyle.sliderContent}
            >
                {Array.from({ length: NEXT_EVENTS_SKELETONS }, (_, i) => (
                    <EventCardSkeleton key={i} label={i === 0 ? t('common:loading.loading') : undefined} />
                ))}
            </ScrollView>
        );
    }

    // 'network' | 'server' — the app's own error copy (errorScreen namespace).
    return (
        <View style={fanstyle.nextEventsError}>
            <Feather name={status === 'network' ? 'wifi-off' : 'alert-circle'} size={18} color={palette.textMuted} />
            <Text style={fanstyle.nextEventsErrorText}>{t(`errorScreen:${status}.title`)}</Text>
            <TouchableOpacity
                onPress={onRetry}
                activeOpacity={0.7}
                accessibilityRole="button"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
                <Text style={fanstyle.viewAllText}>{t(`errorScreen:${status}.button`)}</Text>
            </TouchableOpacity>
        </View>
    );
};

export default NextEventsPlaceholder;
