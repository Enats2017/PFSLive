// hooks/useResultDetail.ts
import { useState, useCallback, useEffect, useRef } from 'react';
import { resultDetail, ResultDetailResponse } from '../services/resultDetailsService';
import { useScreenError } from "../hooks/useApiError";
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

    const fetchDetail = useCallback(async (silent = false) => {
        try {
            if (!silent) setLoading(true);
            clearError();
            const result = await resultDetail.getResultDetail({
                product_app_id,
                product_option_value_app_id,
                bib,
                from_live,
            });
            setData(result);
        } catch (e: any) {
            // ✅ Silent poll failures don't show error screen — keep showing stale data
            if (!silent) handleApiError(e);
        } finally {
            if (!silent) setLoading(false);
        }
    }, [product_app_id, product_option_value_app_id, bib, from_live]);

    // ✅ Initial load
    useEffect(() => {
        fetchDetail();
    }, [fetchDetail]);

    // ✅ Poll every minute while the distance is in progress, BEFORE its gun too
    // (a page opened early used to stay on the upcoming card all race), and
    // after end_time for a runner still on course (see resultDetailView.ts).
    useEffect(() => {
        const isLive = shouldPollResultDetail(
            data?.event?.race_status,
            effectiveParticipantStatus(data?.race_info?.participant_status, data?.race_info?.has_started),
        );

        if (isLive) {
            pollRef.current = setInterval(() => {
                fetchDetail(true); // silent — no loading spinner
            }, POLL_INTERVAL_MS);
        }

        return () => {
            if (pollRef.current) {
                clearInterval(pollRef.current);
                pollRef.current = null;
            }
        };
    }, [data?.event?.race_status, data?.race_info?.participant_status, data?.race_info?.has_started, fetchDetail]);

    return { data, loading, hasError, error, clearError, retry: fetchDetail };
};