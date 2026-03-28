import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  resultList,
  RaceResult,
  Distance,
  Category,
  Pagination,
  FilterOption,
} from "../services/resultList";
import { API_CONFIG } from "../constants/config";
// ADD these two imports
import { AppError, ErrorType } from "../services/api";
import { useScreenError, ScreenError } from "../hooks/useApiError";

export const TYPE_OPTIONS: FilterOption[] = [
  { label: "allrace:filter.results", value: "0" },
  { label: "allrace:filter.live", value: "1" },
  { label: "allrace:filter.favourite", value: "fav" },
];

type FetchMode = "initial" | "filter" | "paginate" | "refresh";

interface FetchOpts {
  povId?: number;
  live: 0 | 1;
  category: string;
  page: number;
  mode: FetchMode;
}

export const useResultList = (
  product_app_id: number,
  initial_pov_id?: number,
  followedUsers?: Set<number>,
  initialType?: FilterOption,
  followedBibs?: Map<number, Set<string>>,
) => {
  const isMounted = useRef(true);
  const requestLock = useRef(false);
  const hasFetched = useRef(false);

  const [selectedPovId, setSelectedPovId] = useState<number | undefined>(
    initial_pov_id,
  );

  const [selectedType, setSelectedType] = useState<FilterOption>(
    initialType ?? TYPE_OPTIONS[0],
  );
  const [selectedCategory, setSelectedCategory] = useState<string>("scratch");

  const fromLive = useMemo<0 | 1>(
    () => (selectedType.value === "1" ? 1 : 0),
    [selectedType.value],
  );

  const isFavTab = selectedType.value === "fav";

  const [distances, setDistances] = useState<Distance[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [results, setResults] = useState<RaceResult[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [favBibs, setFavBibs] = useState<Set<string>>(new Set());
  const [initialLoad, setInitialLoad] = useState(true);
  const [filterLoad, setFilterLoad] = useState(false);
  const [pageLoad, setPageLoad] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [raceStatus, setRaceStatus] = useState<string>("");
  const [showUtmbIndex, setShowUtmbIndex] = useState(false);

  const { error, hasError, handleApiError, clearError } = useScreenError();

  const currentPage = useRef(1);

  const toggleFav = useCallback((bib: string): void => {
    setFavBibs((prev) => {
      const next = new Set(prev);
      next.has(bib) ? next.delete(bib) : next.add(bib);
      return next;
    });
  }, []);

  const fetchData = useCallback(
    async (opts: FetchOpts): Promise<void> => {
      if (requestLock.current) {
        if (API_CONFIG.DEBUG) {
          console.log("⏸️ Request already in progress, skipping");
        }
        return;
      }

      requestLock.current = true;

      const { povId, live, category, page, mode } = opts;

      try {
        if (mode === "initial") setInitialLoad(true);
        if (mode === "filter") setFilterLoad(true);
        if (mode === "paginate") setPageLoad(true);
        if (mode === "refresh") setRefreshing(true);

        clearError();

        if (API_CONFIG.DEBUG) {
          console.log("📡 Fetching results:", {
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
          product_option_value_app_id: povId,
          from_live: live,
          filter_category: category === "scratch" ? "" : category,
          page,
        });

        if (!isMounted.current) return;

        if (data.event?.race_status) {
          setRaceStatus(data.event.race_status);

          if (API_CONFIG.DEBUG) {
            console.log("✅ Race Status:", data.event.race_status);
          }
        }

        if (data.event?.show_utmb_index !== undefined) {
          setShowUtmbIndex(data.event.show_utmb_index === 1);

          if (API_CONFIG.DEBUG) {
            console.log(
              "✅ Show UTMB Index:",
              data.event.show_utmb_index === 1,
            );
          }
        }

        if ((povId === undefined || povId === 0) && data.distances.length > 0) {
          const firstDistance = data.distances[0];
          setSelectedPovId(firstDistance.product_option_value_app_id);

          if (API_CONFIG.DEBUG) {
            console.log("✅ Auto-selected first distance:", {
              id: firstDistance.product_option_value_app_id,
              name: firstDistance.distance_name,
            });
          }
        }

        if (mode !== "paginate") {
          setDistances(data.distances);
          setCategories(data.categories);
        }

        setResults((prev) =>
          mode === "paginate" ? [...prev, ...data.results] : data.results,
        );

        setPagination(data.pagination);
        currentPage.current = page;

        if (API_CONFIG.DEBUG) {
          console.log("✅ Results loaded:", {
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
          console.error("❌ Fetch results error:", e);
        }

        handleApiError(e);
      } finally {
        if (!isMounted.current) return;

        requestLock.current = false;
        setInitialLoad(false);
        setFilterLoad(false);
        setPageLoad(false);
        setRefreshing(false);
      }
    },
    [product_app_id],
  );

  useEffect(() => {
    isMounted.current = true;

    if (!hasFetched.current) {
      hasFetched.current = true;

      fetchData({
        povId: initial_pov_id,
        live: 0,
        category: "scratch",
        page: 1,
        mode: "initial",
      });
    }

    return () => {
      isMounted.current = false;
    };
  }, [initial_pov_id, fetchData]);

  const onDistanceSelect = useCallback(
    (opt: FilterOption): void => {
      const newId = Number(opt.value);
      if (newId === selectedPovId) return;

      if (API_CONFIG.DEBUG) {
        console.log("📍 Distance selected:", opt.label);
      }

      setSelectedPovId(newId);
      setSelectedCategory("scratch");
      setFavBibs(new Set());

      fetchData({
        povId: newId,
        live: fromLive,
        category: "scratch",
        page: 1,
        mode: "filter",
      });
    },
    [selectedPovId, fromLive, fetchData],
  );

  const onTypeSelect = useCallback(
    (opt: FilterOption): void => {
      if (opt.value === selectedType.value) return;

      if (API_CONFIG.DEBUG) {
        console.log("🔄 Type selected:", opt.label);
      }

      setSelectedType(opt);
      setSelectedCategory("scratch");

      // ✅ For favourite tab, don't fetch - we'll filter locally
      if (opt.value === "fav") return;

      const newLive: 0 | 1 = opt.value === "1" ? 1 : 0;

      fetchData({
        povId: selectedPovId,
        live: newLive,
        category: "scratch",
        page: 1,
        mode: "filter",
      });
    },
    [selectedType.value, selectedPovId, fetchData],
  );

  const onCategorySelect = useCallback(
    (opt: FilterOption): void => {
      if (opt.value === selectedCategory) return;

      if (API_CONFIG.DEBUG) {
        console.log("🏷️ Category selected:", opt.label);
      }

      setSelectedCategory(opt.value);

      fetchData({
        povId: selectedPovId,
        live: fromLive,
        category: opt.value,
        page: 1,
        mode: "filter",
      });
    },
    [selectedCategory, selectedPovId, fromLive, fetchData],
  );

  const onEndReached = useCallback((): void => {
    if (pageLoad || filterLoad || initialLoad || isFavTab || !pagination) {
      return;
    }

    if (currentPage.current >= pagination.total_pages) {
      if (API_CONFIG.DEBUG) {
        console.log("⏸️ Already at last page");
      }
      return;
    }

    if (API_CONFIG.DEBUG) {
      console.log("📄 Loading next page:", currentPage.current + 1);
    }

    fetchData({
      povId: selectedPovId,
      live: fromLive,
      category: selectedCategory,
      page: currentPage.current + 1,
      mode: "paginate",
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

  const onRefresh = useCallback((): void => {
    if (isFavTab) return;

    if (API_CONFIG.DEBUG) {
      console.log("🔄 Refreshing results");
    }

    fetchData({
      povId: selectedPovId,
      live: fromLive,
      category: selectedCategory,
      page: 1,
      mode: "refresh",
    });
  }, [isFavTab, selectedPovId, fromLive, selectedCategory, fetchData]);

  const retry = useCallback((): void => {
    if (API_CONFIG.DEBUG) {
      console.log("🔁 Retrying fetch");
    }

    fetchData({
      povId: selectedPovId,
      live: fromLive,
      category: selectedCategory,
      page: 1,
      mode: "initial",
    });
  }, [selectedPovId, fromLive, selectedCategory, fetchData]);

  const distanceOptions = useMemo<FilterOption[]>(
    () =>
      distances.map((d) => ({
        label: d.distance_name,
        value: String(d.product_option_value_app_id),
      })),
    [distances],
  );

  const categoryOptions = useMemo<FilterOption[]>(
    () =>
      categories.map((c) => ({
        label: c.label,
        value: c.key,
      })),
    [categories],
  );

  const selectedDistanceLabel = useMemo(
    () =>
      distances.find((d) => d.product_option_value_app_id === selectedPovId)
        ?.distance_name ?? "—",
    [distances, selectedPovId],
  );

  const currentPovId = useMemo(() => {
    const unique = distances.filter(
      (d, index, self) =>
        index ===
        self.findIndex(
          (x) =>
            x.product_option_value_app_id === d.product_option_value_app_id,
        ),
    );
    return (
      unique.find((d) => d.is_selected === 1)?.product_option_value_app_id ??
      unique[0]?.product_option_value_app_id
    );
  }, [distances]);

  const selectedCategoryLabel = useMemo(
    () =>
      categories.find((c) => c.key === selectedCategory)?.label ?? "Scratch",
    [categories, selectedCategory],
  );

  // ✅ FILTER RESULTS BASED ON FOLLOW STATUS
  const displayResults = useMemo<RaceResult[]>(() => {
    if (!isFavTab) {
      return results.map((item, index) => ({
        ...item,
        category_rank: String(index + 1),
      }));
    }

    // ✅ Filter by BOTH customer_app_id AND BIB
    const filtered = results.filter((result) => {
      // Check customer-based follow
      if (
        result.customer_app_id &&
        followedUsers?.has(Number(result.customer_app_id))
      ) {
        return true;
      }

      // Check BIB-based follow
      if (result.bib && product_app_id && followedBibs) {
        const bibSet = followedBibs.get(product_app_id);
        if (bibSet?.has(String(result.bib))) {
          return true;
        }
      }

      return false;
    });

    return filtered.map((item, index) => ({
      ...item,
      category_rank: String(index + 1),
    }));
  }, [isFavTab, results, followedUsers, followedBibs, product_app_id]);

  return {
    results,
    raceStatus,
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
    currentPovId,
    showUtmbIndex,
    hasError, 
    clearError,
  };
};
