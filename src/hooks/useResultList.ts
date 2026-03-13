import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
    resultList,
    RaceResult,
    Distance,
    Category,
    Pagination,
    FilterOption,
} from '../services/resultList';
import { API_CONFIG } from '../constants/config';

export const TYPE_OPTIONS: FilterOption[] = [
    { label: 'allrace:filter.results', value: '0' },
    { label: 'allrace:filter.live', value: '1' },
    { label: 'allrace:filter.favourite', value: 'fav' },
];

type FetchMode = 'initial' | 'filter' | 'paginate' | 'refresh';

interface FetchOpts {
    povId?: number; // ✅ NOW OPTIONAL
    live: 0 | 1;
    category: string;
    page: number;
    mode: FetchMode;
}

export const useResultList = (
    product_app_id: number,
    initial_pov_id?: number,
    followedIds?: Set<number>, // ✅ NOW OPTIONAL
) => {
    const isMounted = useRef(true);
    const requestLock = useRef(false);
    const hasFetched = useRef(false);

    // ✅ START WITH UNDEFINED IF NO initial_pov_id
    const [selectedPovId, setSelectedPovId] = useState<number | undefined>(initial_pov_id);
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

    const [initialLoad, setInitialLoad] = useState(true);
    const [filterLoad, setFilterLoad] = useState(false);
    const [pageLoad, setPageLoad] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const currentPage = useRef(1);

    // ✅ TOGGLE FAVORITE
    const toggleFav = useCallback((bib: string): void => {
        setFavBibs(prev => {
            const next = new Set(prev);
            next.has(bib) ? next.delete(bib) : next.add(bib);
            return next;
        });
    }, []);

    // ✅ FETCH DATA (HANDLES OPTIONAL povId)
    const fetchData = useCallback(async (opts: FetchOpts): Promise<void> => {
        if (requestLock.current) {
            if (API_CONFIG.DEBUG) {
                console.log('⏸️ Request already in progress, skipping');
            }
            return;
        }

        requestLock.current = true;

        const { povId, live, category, page, mode } = opts;

        try {
            // ✅ SET LOADING STATES
            if (mode === 'initial') setInitialLoad(true);
            if (mode === 'filter') setFilterLoad(true);
            if (mode === 'paginate') setPageLoad(true);
            if (mode === 'refresh') setRefreshing(true);

            setError(null);

            if (API_CONFIG.DEBUG) {
                console.log('📡 Fetching results:', {
                    product_app_id,
                    product_option_value_app_id: povId,
                    from_live: live,
                    filter_category: category,
                    page,
                    mode,
                });
            }

            const data = await resultList.getEventRanking({
                product_app_id,
                product_option_value_app_id: povId, // ✅ CAN BE UNDEFINED
                from_live: live,
                filter_category: category === 'scratch' ? '' : category,
                page,
            });

            if (!isMounted.current) return;

            // ✅ AUTO-SELECT FIRST DISTANCE IF NONE PROVIDED
            if (povId === undefined && data.distances.length > 0) {
                const firstDistance = data.distances[0];
                setSelectedPovId(firstDistance.product_option_value_app_id);

                if (API_CONFIG.DEBUG) {
                    console.log('✅ Auto-selected first distance:', {
                        id: firstDistance.product_option_value_app_id,
                        name: firstDistance.distance_name,
                    });
                }
            }

            // ✅ UPDATE DATA
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

            if (API_CONFIG.DEBUG) {
                console.log('✅ Results loaded:', {
                    distances: data.distances.length,
                    categories: data.categories.length,
                    results: data.results.length,
                    page: data.pagination.page,
                    total_pages: data.pagination.total_pages,
                });
            }
        } catch (e: any) {
            if (!isMounted.current) return;

            if (API_CONFIG.DEBUG) {
                console.error('❌ Fetch results error:', e);
            }

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

    // ✅ INITIAL FETCH
    useEffect(() => {
        isMounted.current = true;

        if (!hasFetched.current) {
            hasFetched.current = true;

            fetchData({
                povId: initial_pov_id, // ✅ CAN BE UNDEFINED
                live: 0,
                category: 'scratch',
                page: 1,
                mode: 'initial',
            });
        }

        return () => {
            isMounted.current = false;
        };
    }, [initial_pov_id, fetchData]);

    // ✅ DISTANCE SELECTED
    const onDistanceSelect = useCallback((opt: FilterOption): void => {
        const newId = Number(opt.value);
        if (newId === selectedPovId) return;

        if (API_CONFIG.DEBUG) {
            console.log('📍 Distance selected:', opt.label);
        }

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

    // ✅ TYPE SELECTED
    const onTypeSelect = useCallback((opt: FilterOption): void => {
        if (opt.value === selectedType.value) return;

        if (API_CONFIG.DEBUG) {
            console.log('🔄 Type selected:', opt.label);
        }

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

    // ✅ CATEGORY SELECTED
    const onCategorySelect = useCallback((opt: FilterOption): void => {
        if (opt.value === selectedCategory) return;

        if (API_CONFIG.DEBUG) {
            console.log('🏷️ Category selected:', opt.label);
        }

        setSelectedCategory(opt.value);

        fetchData({
            povId: selectedPovId,
            live: fromLive,
            category: opt.value,
            page: 1,
            mode: 'filter',
        });
    }, [selectedCategory, selectedPovId, fromLive, fetchData]);

    // ✅ PAGINATION
    const onEndReached = useCallback((): void => {
        if (pageLoad || filterLoad || initialLoad || isFavTab || !pagination) {
            return;
        }

        if (currentPage.current >= pagination.total_pages) {
            if (API_CONFIG.DEBUG) {
                console.log('⏸️ Already at last page');
            }
            return;
        }

        if (API_CONFIG.DEBUG) {
            console.log('📄 Loading next page:', currentPage.current + 1);
        }

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

    // ✅ REFRESH
    const onRefresh = useCallback((): void => {
        if (isFavTab) return;

        if (API_CONFIG.DEBUG) {
            console.log('🔄 Refreshing results');
        }

        fetchData({
            povId: selectedPovId,
            live: fromLive,
            category: selectedCategory,
            page: 1,
            mode: 'refresh',
        });
    }, [isFavTab, selectedPovId, fromLive, selectedCategory, fetchData]);

    // ✅ RETRY
    const retry = useCallback((): void => {
        if (API_CONFIG.DEBUG) {
            console.log('🔁 Retrying fetch');
        }

        fetchData({
            povId: selectedPovId,
            live: fromLive,
            category: selectedCategory,
            page: 1,
            mode: 'initial',
        });
    }, [selectedPovId, fromLive, selectedCategory, fetchData]);

    // ✅ MEMOIZED DROPDOWN OPTIONS
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

    // ✅ DISPLAY RESULTS
const displayResults = useMemo<RaceResult[]>(() => {
    if (!isFavTab) {
        return results.map((item, index) => ({
            ...item,
            category_rank: String(index + 1),
        }));
    }
    return results
        .filter(r => followedIds?.has(Number(r.customer_app_id)))
        .map((item, index) => ({
            ...item,
            category_rank: String(index + 1),
        }));
}, [isFavTab, results, followedIds]);

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