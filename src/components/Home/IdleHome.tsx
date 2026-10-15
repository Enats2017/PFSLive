// src/components/Home/IdleHome.tsx
//
// ✅ Home when there is NO upcoming race — which is most users, most of the
// time. It used to be a title and two buttons, with nothing to come back for.
//
// Top to bottom (the live-now section above it stays in HomeScreen):
//  1. "No race coming up" + Find a race → the event list
//  2. The next few upcoming events, from the SAME event_list_api call the
//     event list makes (eventService.getEvents) — no new endpoint.
// Every section hides itself when empty; a failed fetch just hides section 2.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { commonStyles } from '../../styles/common.styles';
import { readinessStyles as s } from '../../styles/readiness.styles';
import { eventService, EventItem } from '../../services/eventService';
import { formatEventDate } from '../../utils/timeFormat';
import { analyticsService } from '../../services/analyticsService';

const MAX_EVENTS = 5;
/** One retry after a failed fetch (a race-day network blip hid the section). */
export const IDLE_RETRY_MS = 3000;

/** The next few upcoming events; retried once on failure. */
export async function loadUpcomingEvents(retryMs = IDLE_RETRY_MS): Promise<EventItem[]> {
  const once = async () =>
    ((await eventService.getEvents({ page_past: 1, page_live: 1, page_upcoming: 1 })).tabs?.upcoming ?? []).slice(0, MAX_EVENTS);
  try {
    return await once();
  } catch {
    await new Promise((r) => setTimeout(r, retryMs));
    return once();
  }
}

export const IdleHome: React.FC = () => {
  const { t, i18n } = useTranslation(['readiness', 'common']);
  const navigation = useNavigation<any>();
  const [events, setEvents] = useState<EventItem[]>([]);

  const monthsShort = useMemo(
    () => t('common:monthsShort', { returnObjects: true }) as string[],
    [t],
  );

  // Refetched when the language changes: event names/dates come back in the
  // language_id the request carries.
  useEffect(() => {
    let cancelled = false;
    loadUpcomingEvents()
      .then((list) => {
        if (!cancelled) setEvents(list);
      })
      .catch(() => { /* section simply stays hidden */ });
    return () => { cancelled = true; };
  }, [i18n.language]);

  const openEvent = useCallback((item: EventItem) => {
    void analyticsService.logInteraction('home', 'idle_upcoming_event', 'tap');
    navigation.navigate('EventDetails', {
      product_app_id: Number(item.product_app_id),
      event_name: item.name,
      event_image: item.event_image ?? '',
      auto_register_id: null,
    });
  }, [navigation]);

  return (
    <View>
      <View style={[commonStyles.card, { marginBottom: 0 }]}>
        <Text style={s.emptyTitle}>{t('readiness:idle.noRaceTitle')}</Text>
        <Text style={s.emptyBody}>{t('readiness:idle.noRaceBody')}</Text>
        <TouchableOpacity
          style={commonStyles.primaryButton}
          onPress={() => {
            void analyticsService.logInteraction('home', 'idle_find_race', 'tap');
            navigation.navigate('ParticipantEvent');
          }}
          accessibilityRole="button"
          activeOpacity={0.8}
        >
          <Text style={commonStyles.primaryButtonText}>{t('readiness:idle.findRace')}</Text>
        </TouchableOpacity>
      </View>

      {events.length > 0 && (
        <>
          <Text style={s.sectionLabel}>{t('readiness:idle.upcomingEvents')}</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.eventRow}
            nestedScrollEnabled
          >
            {events.map((item) => (
              <TouchableOpacity
                key={item.product_app_id}
                style={s.eventTile}
                onPress={() => openEvent(item)}
                accessibilityRole="button"
                activeOpacity={0.85}
              >
                {!!item.event_image && (
                  <Image source={{ uri: item.event_image }} style={s.eventImage} contentFit="cover" cachePolicy="memory-disk" />
                )}
                <View style={s.eventTileBody}>
                  <Text style={s.eventTileName} numberOfLines={2}>{item.name}</Text>
                  <Text style={s.eventTileMeta} numberOfLines={1}>
                    {[formatEventDate(item.race_date, monthsShort), item.city].filter(Boolean).join(' · ')}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </>
      )}
    </View>
  );
};
