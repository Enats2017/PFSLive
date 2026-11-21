// src/hooks/useNextEvents.ts
//
// ✅ The "Next events" row on the Participant hub and the Fan hub (developer
// report 2026-10-29): both screens fetched it with `catch { }` and no state but
// the list, so on a slow network the row stayed BLANK until the answer came —
// and for good when it failed. The row now knows whether it is loading, loaded
// or failed (network / server), so the screen can show skeleton cards and a
// "Try again" instead of nothing.

import { useCallback, useEffect, useRef, useState } from 'react';
import { eventService, EventItem } from '../services/followerEvent';

export type NextEventsStatus = 'loading' | 'ready' | 'network' | 'server';

/** How many cards the row shows at most. */
export const NEXT_EVENTS_MAX = 6;

type Tabs = { live: EventItem[]; upcoming: EventItem[] };

/**
 * Live first, then upcoming, from both pages; an event on two pages (or in
 * both tabs) once. Pure — the same merge both screens used to inline.
 */
export function mergeNextEvents(pages: Tabs[], max: number = NEXT_EVENTS_MAX): EventItem[] {
    const seen = new Set<string>();
    return [
        ...pages.flatMap(p => p.live || []),
        ...pages.flatMap(p => p.upcoming || []),
    ].filter(e => {
        const id = String(e.product_app_id);
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
    }).slice(0, max);
}

/** A failed load → which state: no connection, nothing to show (api.ts
 *  maps "no data" answers to `empty` — not a failure), or anything else. */
export function nextEventsErrorStatus(err: any): NextEventsStatus {
    if (err?.type === 'empty') return 'ready';
    return err?.type === 'network' ? 'network' : 'server';
}

export function useNextEvents() {
    const [events, setEvents] = useState<EventItem[]>([]);
    const [status, setStatus] = useState<NextEventsStatus>('loading');
    // Only the newest load may set state (a retry while the first is still
    // in flight on a slow network), and none after the screen is gone.
    const loadId = useRef(0);

    const load = useCallback(async () => {
        const id = ++loadId.current;
        setStatus('loading');
        try {
            const [page1, page2] = await Promise.all([
                eventService.getEvents({ page_live: 1, page_upcoming: 1 }),
                eventService.getEvents({ page_live: 2, page_upcoming: 2 }),
            ]);
            if (id !== loadId.current) return;
            setEvents(mergeNextEvents([page1.tabs, page2.tabs]));
            setStatus('ready');
        } catch (err) {
            if (id !== loadId.current) return;
            const next = nextEventsErrorStatus(err);
            if (next === 'ready') setEvents([]);
            setStatus(next);
        }
    }, []);

    useEffect(() => {
        void load();
        return () => { loadId.current++; };
    }, [load]);

    return { events, status, reload: load };
}
