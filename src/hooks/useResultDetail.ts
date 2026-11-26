// hooks/useResultDetail.ts
import { useState, useCallback, useEffect, useRef } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { resultDetail, ResultDetailResponse } from '../services/resultDetailsService';
import { rememberBibOwners } from '../utils/followStorage';
import { useScreenError } from "../hooks/useApiError";
import { isRateLimited } from '../services/api';
import { shouldPollResultDetail, effectiveParticipantStatus } from '../screens/ResultDetailsScreen/resultDetailView';

const POLL_INTERVAL_MS = 60_000; // 1 minute

export const useResultDetail = (
    product_app_id: number,
    product_option_value_app_id: number,
    bib: string,
    from_live: 0 | 1,
) => {
    const [data, setData] = useState<ResultDetailResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const { error, hasError, handleApiError, clearError } = useScreenError();
    const pollRef = useRef<NodeJS.Timeout | null>(null);
    // ✅ (app audit 2026-11-26) Polls only while this screen is on top: the
    // stack keeps it mounted under the live map it opens (Runner info → map),
    // and its 1-minute poll kept running there unseen.
    const isFocused = useIsFocused();
    // Only the newest request may set state: two quick taps on different
    // runners re-use this screen with new params, and the FIRST runner's
    // answer could land last and be shown under the second one's bib.
    const requestId = useRef(0);
    // When the shown data was fetched (epoch ms), and whether the polls since
    // have failed — the live card must not present old data as live.
    const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
    const [stale, setStale] = useState(false);
    // 429 Retry-After: no poll before this instant (epoch ms).
    const pausedUntil = useRef(0);

    // A spinner (non-silent) load still running: a silent poll must not
    // overtake it (review 2026-11-26). The poll's answer would win the
    // requestId check, the load's answer would be dropped — and with it the
    // only setLoading(false), leaving the spinner up for good. Happened when
    // the params changed on a stale live runner (the load and the re-armed
    // poll start in the same commit) or when Retry met the 60 s tick.
    const spinnerLoadsInFlight = useRef(0);

    const fetchDetail = useCallback(async (silent = false) => {
        if (silent && spinnerLoadsInFlight.current > 0) return;   // that load brings fresh data
        const id = ++requestId.current;
        if (!silent) spinnerLoadsInFlight.current++;
        try {
            if (!silent) setLoading(true);
            clearError();
            const result = await resultDetail.getResultDetail({
                product_app_id,
                product_option_value_app_id,
                bib,
                from_live,
            });
            if (id !== requestId.current) return;
            setData(result);
            // ✅ This runner's bib → account link (if their bib is followed) — see
            // followStorage rememberBibOwners (audit 2026-11-26 FN1). Fire-and-forget.
            void rememberBibOwners(product_app_id, [{ bib: (result as any)?.race_info?.bib ?? bib, customer_app_id: (result as any)?.race_info?.customer_app_id }]);
            setLastUpdatedAt(Date.now());
            setStale(false);
        } catch (e: any) {
            if (id !== requestId.current) return;
            // ✅ 429: no poll before the server's Retry-After (default 60 s).
            if (isRateLimited(e)) {
                const s = Number(e?.data?.retryAfter);
                pausedUntil.current = Date.now() + (Number.isFinite(s) && s > 0 ? s : 60) * 1000;
            }
            // ✅ Silent poll failures don't show error screen — keep showing
            // the last data, but marked stale: the live clock stops and the
            // card says when it was last updated (it used to keep counting
            // past a finish while every poll failed — app audit 2026-11-26).
            if (!silent) handleApiError(e);
            else setStale(true);
        } finally {
            if (!silent) spinnerLoadsInFlight.current = Math.max(0, spinnerLoadsInFlight.current - 1);
            // The NEWEST request ends the spinner, silent or not: whichever
            // answer is on screen, nothing is loading any more.
            if (id === requestId.current) setLoading(false);
        }
    }, [product_app_id, product_option_value_app_id, bib, from_live]);

    // ✅ Initial load
    useEffect(() => {
        fetchDetail();
    }, [fetchDetail]);

    const isLive = shouldPollResultDetail(
        data?.event?.race_status,
        effectiveParticipantStatus(data?.race_info?.participant_status, data?.race_info?.has_started),
    );

    // ✅ Poll every minute while the distance is in progress, BEFORE its gun too
    // (a page opened early used to stay on the upcoming card all race), and
    // after end_time for a runner still on course (see resultDetailView.ts).
    useEffect(() => {
        if (isLive && isFocused) {
            // Back on this screen after more than a poll period: refresh now.
            if (lastUpdatedAt !== null && Date.now() - lastUpdatedAt >= POLL_INTERVAL_MS && Date.now() >= pausedUntil.current) {
                fetchDetail(true);
            }
            pollRef.current = setInterval(() => {
                if (Date.now() < pausedUntil.current) return;   // 429: wait as asked
                fetchDetail(true); // silent — no loading spinner
            }, POLL_INTERVAL_MS);
        }

        return () => {
            if (pollRef.current) {
                clearInterval(pollRef.current);
                pollRef.current = null;
            }
        };
    // lastUpdatedAt is only read: each answer must not restart the timer.
    }, [isLive, isFocused, fetchDetail]);

    return { data, loading, hasError, error, clearError, retry: fetchDetail, stale, lastUpdatedAt };
};
