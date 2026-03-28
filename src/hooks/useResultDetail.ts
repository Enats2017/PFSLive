// hooks/useResultDetail.ts
import { useState, useCallback, useEffect } from 'react';
import { resultDetail, ResultDetailResponse } from '../services/resultDetailsService';
import { AppError, ErrorType } from "../services/api";
import { useScreenError, ScreenError } from "../hooks/useApiError";

export const useResultDetail = (
    product_app_id: number,
    product_option_value_app_id: number,
    bib: string,
    from_live: 0 | 1,
) => {
    const [data, setData] = useState<ResultDetailResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const { error, hasError, handleApiError, clearError } = useScreenError();

    const fetchDetail = useCallback(async () => {
        try {
            setLoading(true);
           clearError();
            const result = await resultDetail.getResultDetail({
                product_app_id,
                product_option_value_app_id,
                bib,
                from_live,
            });
            setData(result);
        } catch (e: any) {
            handleApiError(e);
            
        } finally {
            setLoading(false);
        }
    }, [product_app_id, product_option_value_app_id, bib, from_live]);

    useEffect(() => {
        fetchDetail();
    }, [fetchDetail]);

    return { data, loading,  hasError, error, clearError, retry: fetchDetail, };
};