// hooks/useResultDetail.ts
import { useState, useCallback, useEffect } from 'react';
import { resultDetail, ResultDetailResponse } from '../services/resultDetailsService';

export const useResultDetail = (
    product_app_id: number,
    product_option_value_app_id: number,
    bib: string,
    from_live: 0 | 1,
) => {
    const [data, setData] = useState<ResultDetailResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchDetail = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const result = await resultDetail.getResultDetail({
                product_app_id,
                product_option_value_app_id,
                bib,
                from_live,
            });
            setData(result);
        } catch (e: any) {
            setError(e?.message ?? 'Failed to load');
        } finally {
            setLoading(false);
        }
    }, [product_app_id, product_option_value_app_id, bib, from_live]);

    useEffect(() => {
        fetchDetail();
    }, [fetchDetail]);

    return { data, loading, error, retry: fetchDetail };
};