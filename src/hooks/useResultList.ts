
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
    resultList,
    RaceResult,
    Distance,
    Category,
    Pagination,
    FilterOption,
} from '../services/resultList';

export const TYPE_OPTIONS: FilterOption[] = [
    { label: 'allrace:filter.results', value: '0' },
    { label: 'allrace:filter.live', value: '1' },
    { label: 'allrace:filter.favourite', value: 'fav' },
];

type FetchMode = 'initial' | 'filter' | 'paginate' | 'refresh';

interface FetchOpts {
    povId: number;
    live: 0 | 1;
    category: string;
    page: number;
    mode: FetchMode;
}

export const useResultList = (
    product_app_id: number,
    initial_pov_id: number,
) => {

    const isMounted = useRef(true);
    const requestLock = useRef(false);
    const [selectedPovId, setSelectedPovId] = useState<number>(initial_pov_id);
    const [selectedType, setSelectedType] = useState<FilterOption>(TYPE_OPTIONS[0]);
    const [selectedCategory, setSelectedCategory] = useState<string>('scratch');

    const fromLive = useMemo<0 | 1>(
        () => selectedType.value === '1' ? 1 : 0,
        [selectedType.value]
    );

    const isFavTab = selectedType.value === 'fav';
    const [distances, setDistances] = useState<Distance[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [results, setResults] = useState<RaceResult[]>([]);
    const [pagination, setPagination] = useState<Pagination | null>(null);
    const [favBibs, setFavBibs] = useState<Set<string>>(new Set());
    const toggleFav = useCallback((bib: string): void => {
        setFavBibs(prev => {
            const next = new Set(prev);
            next.has(bib) ? next.delete(bib) : next.add(bib);
            return next;
        });
    }, []);
    const [initialLoad, setInitialLoad] = useState(true);
    const [filterLoad, setFilterLoad] = useState(false);
    const [pageLoad, setPageLoad] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const currentPage = useRef(1);
    const fetchData = useCallback(async (opts: FetchOpts): Promise<void> => {

        if (requestLock.current) return;
        requestLock.current = true;

        const { povId, live, category, page, mode } = opts;

        try {

            if (mode === 'initial') setInitialLoad(true);
            if (mode === 'filter') setFilterLoad(true);
            if (mode === 'paginate') setPageLoad(true);
            if (mode === 'refresh') setRefreshing(true);

            setError(null);

            const data = await resultList.getEventRanking({
                product_app_id,
                product_option_value_app_id: povId,
                from_live: live,
                filter_category: category === 'scratch' ? '' : category,
                page,
            });

            if (!isMounted.current) return;

            if (mode !== 'paginate') {
                setDistances(data.distances);
                setCategories(data.categories);
            }

            setResults(prev =>
                mode === 'paginate'
                    ? [...prev, ...data.results]
                    : data.results
            );

            setPagination(data.pagination);
            currentPage.current = page;

        } catch (e: any) {

            if (!isMounted.current) return;

            setError(e?.message ?? 'Failed to load. Tap to retry.');

        } finally {

            if (!isMounted.current) return;

            requestLock.current = false;

            setInitialLoad(false);
            setFilterLoad(false);
            setPageLoad(false);
            setRefreshing(false);
        }

    }, [product_app_id]);
    useEffect(() => {
        isMounted.current = true;
        fetchData({
            povId: initial_pov_id,
            live: 0,
            category: 'scratch',
            page: 1,
            mode: 'initial',
        });

        return () => {
            isMounted.current = false;
        };

    }, []);
    const onDistanceSelect = useCallback((opt: FilterOption): void => {
        const newId = Number(opt.value);
        if (newId === selectedPovId) return;
        setSelectedPovId(newId);
        setSelectedCategory('scratch');
        setFavBibs(new Set());

        fetchData({
            povId: newId,
            live: fromLive,
            category: 'scratch',
            page: 1,
            mode: 'filter',
        });

    }, [selectedPovId, fromLive, fetchData]);

    // ── Type selected 
    const onTypeSelect = useCallback((opt: FilterOption): void => {

        if (opt.value === selectedType.value) return;

        setSelectedType(opt);
        setSelectedCategory('scratch');

        if (opt.value === 'fav') return;

        const newLive: 0 | 1 = opt.value === '1' ? 1 : 0;

        fetchData({
            povId: selectedPovId,
            live: newLive,
            category: 'scratch',
            page: 1,
            mode: 'filter',
        });

    }, [selectedType.value, selectedPovId, fetchData]);

    // ── Category selected 
    const onCategorySelect = useCallback((opt: FilterOption): void => {

        if (opt.value === selectedCategory) return;

        setSelectedCategory(opt.value);

        fetchData({
            povId: selectedPovId,
            live: fromLive,
            category: opt.value,
            page: 1,
            mode: 'filter',
        });

    }, [selectedCategory, selectedPovId, fromLive, fetchData]);

    // ── Pagination 
    const onEndReached = useCallback((): void => {

        if (
            pageLoad ||
            filterLoad ||
            initialLoad ||
            isFavTab ||
            !pagination
        ) return;

        if (currentPage.current >= pagination.total_pages) return;

        fetchData({
            povId: selectedPovId,
            live: fromLive,
            category: selectedCategory,
            page: currentPage.current + 1,
            mode: 'paginate',
        });

    }, [
        pageLoad,
        filterLoad,
        initialLoad,
        isFavTab,
        pagination,
        selectedPovId,
        fromLive,
        selectedCategory,
        fetchData,
    ]);

    // ── Refresh 
    const onRefresh = useCallback((): void => {

        if (isFavTab) return;

        fetchData({
            povId: selectedPovId,
            live: fromLive,
            category: selectedCategory,
            page: 1,
            mode: 'refresh',
        });

    }, [isFavTab, selectedPovId, fromLive, selectedCategory, fetchData]);

    // ── Retry 
    const retry = useCallback((): void => {

        fetchData({
            povId: selectedPovId,
            live: fromLive,
            category: selectedCategory,
            page: 1,
            mode: 'initial',
        });

    }, [selectedPovId, fromLive, selectedCategory, fetchData]);

    // ── Memo dropdown options 
    const distanceOptions = useMemo<FilterOption[]>(() =>
        distances.map(d => ({
            label: d.distance_name,
            value: String(d.product_option_value_app_id),
        })),
        [distances]
    );

    const categoryOptions = useMemo<FilterOption[]>(() =>
        categories.map(c => ({
            label: c.label,
            value: c.key,
        })),
        [categories]
    );

    const selectedDistanceLabel = useMemo(
        () =>
            distances.find(
                d => d.product_option_value_app_id === selectedPovId
            )?.distance_name ?? '—',
        [distances, selectedPovId]
    );

    const selectedCategoryLabel = useMemo(
        () =>
            categories.find(
                c => c.key === selectedCategory
            )?.label ?? 'Scratch',
        [categories, selectedCategory]
    );
    const displayResults = useMemo<RaceResult[]>(() => {
        const list = isFavTab
            ? results.filter(r => favBibs.has(r.bib))
            : results;

        return list.map((item, index) => ({
            ...item,
            category_rank: String(index + 1),
        }));

    }, [isFavTab, results, favBibs]);

    return {
        results,
        displayResults,
        pagination,
        selectedPovId,
        selectedType,
        selectedCategory,
        fromLive,
        isFavTab,
        favBibs,
        initialLoad,
        filterLoad,
        pageLoad,
        refreshing,
        error,
        toggleFav,
        onDistanceSelect,
        onTypeSelect,
        onCategorySelect,
        onEndReached,
        onRefresh,
        retry,
        distanceOptions,
        categoryOptions,
        selectedDistanceLabel,
        selectedCategoryLabel,
    };
};