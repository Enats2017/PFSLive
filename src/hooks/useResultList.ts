import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  resultList,
  RaceResult,
  Distance,
  Category,
  Pagination,
  FilterOption,
  Statistics,
  CheckpointListItem,
} from "../services/resultList";
import { API_CONFIG } from "../constants/config";
// ADD these two imports
import { AppError, ErrorType } from "../services/api";
import { useScreenError, ScreenError } from "../hooks/useApiError";
import { useTranslation } from "react-i18next";

export const TYPE_OPTIONS: FilterOption[] = [
  { label: "allrace:filter.results", value: "0" },
  { label: "allrace:filter.live", value: "1" },
];

const PRESERVED_CATEGORIES = ["favourite", "live_tracking"];

type FetchMode = "initial" | "filter" | "paginate" | "refresh";

interface FetchOpts {
  povId?: number;
  live: 0 | 1;
  category: string;
  page: number;
  mode: FetchMode;
  checkpointIndex?: number | null;
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
  const { t } = useTranslation(["allrace"]);

  const [selectedPovId, setSelectedPovId] = useState<number | undefined>(
    initial_pov_id,
  );

  const [selectedType, setSelectedType] = useState<FilterOption>(
    initialType ?? TYPE_OPTIONS[0],
  );
  const [selectedCategory, setSelectedCategory] = useState<string>("scratch");
  const [selectedCheckpoint, setSelectedCheckpoint] =
    useState<FilterOption | null>(null);

  const fromLive = useMemo<0 | 1>(
    () => (selectedType.value === "1" ? 1 : 0),
    [selectedType.value],
  );

  const isFavTab = selectedCategory === "favourite";

  const [distances, setDistances] = useState<Distance[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [results, setResults] = useState<RaceResult[]>([]);
  const [checkpointsList, setCheckpointsList] = useState<CheckpointListItem[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [favBibs, setFavBibs] = useState<Set<string>>(new Set());
  const [initialLoad, setInitialLoad] = useState(true);
  const [filterLoad, setFilterLoad] = useState(false);
  const [pageLoad, setPageLoad] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [raceStatus, setRaceStatus] = useState<string>("");
  const [raceProgressStatus, setRaceProgressStatus] = useState<string>("");
  const [showUtmbIndex, setShowUtmbIndex] = useState(false);
  const [statistics, setStatistics] = useState<Statistics>({
    crossed: 0,
    expected: 0,
    started: 0,
    dnf: 0,
  });

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

      const { povId, live, category, page, mode, checkpointIndex } = opts;

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
            checkpoint_index: checkpointIndex,
            page,
            mode,
          });
        }

        const data = await resultList.getEventRanking({
          product_app_id,
          product_option_value_app_id: povId,
          from_live: live,
          filter_category: category === "scratch" ? "" : category,
          checkpoint_index: checkpointIndex ?? null,
          page,
        });

        if (!isMounted.current) return;

        if (data.event?.race_status) {
          setRaceStatus(data.event.race_status);
          setRaceProgressStatus(data.event.race_progress_status ?? "");

          if (API_CONFIG.DEBUG) {
            console.log("✅ Race Status:", data.event.race_status);
            console.log(
              "✅ Race Progress Status:",
              data.event.race_progress_status,
            );
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

        // Keep the checkpoint list from the backend. It's event-level and always
        // populated when a start list exists, so the filter survives an empty
        // results set. Only update when the backend sends a non-empty list, so a
        // zero-crossing checkpoint response (empty results) doesn't wipe it.
        if (Array.isArray(data.checkpoints_list) && data.checkpoints_list.length > 0) {
          setCheckpointsList(data.checkpoints_list);
        }

        setStatistics(data.statistics);

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
        checkpointIndex: null,
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
      //setSelectedCategory("scratch");
      setFavBibs(new Set());
      setSelectedCheckpoint(null);

      const shouldPreserve = PRESERVED_CATEGORIES.includes(selectedCategory);
      const categoryToSend = shouldPreserve ? selectedCategory : "scratch";
      if (!shouldPreserve) setSelectedCategory("scratch");

      fetchData({
        povId: newId,
        live: fromLive,
        category: categoryToSend,
        page: 1,
        mode: "filter",
        checkpointIndex: null,
      });
    },
    [selectedPovId, fromLive, selectedCategory, fetchData],
  );

  const onTypeSelect = useCallback(
    (opt: FilterOption): void => {
      if (opt.value === selectedType.value) return;

      if (API_CONFIG.DEBUG) {
        console.log("🔄 Type selected:", opt.label);
      }

      setSelectedType(opt);
      //setSelectedCategory("scratch");

      //if (opt.value === "fav") return;

      const newLive: 0 | 1 = opt.value === "1" ? 1 : 0;
      const shouldPreserve = PRESERVED_CATEGORIES.includes(selectedCategory);
      const categoryToSend = shouldPreserve ? selectedCategory : "scratch";
      if (!shouldPreserve) setSelectedCategory("scratch");

      fetchData({
        povId: selectedPovId,
        live: newLive,
        category: categoryToSend,
        page: 1,
        mode: "filter",
        checkpointIndex: selectedCheckpoint
          ? Number(selectedCheckpoint.value)
          : null,
      });
    },
    [
      selectedType.value,
      selectedPovId,
      selectedCategory,
      selectedCheckpoint,
      fetchData,
    ],
  );

  const onCategorySelect = useCallback(
    (opt: FilterOption): void => {
      if (opt.value === selectedCategory) return;

      if (API_CONFIG.DEBUG) {
        console.log("🏷️ Category selected:", opt.label);
      }

      setSelectedCategory(opt.value);

      //if (opt.value === 'favourite') return;

      fetchData({
        povId: selectedPovId,
        live: fromLive,
        category: opt.value,
        page: 1,
        mode: "filter",
        checkpointIndex: selectedCheckpoint
          ? Number(selectedCheckpoint.value)
          : null,
      });
    },
    [selectedCategory, selectedPovId, fromLive, selectedCheckpoint, fetchData],
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
      checkpointIndex: selectedCheckpoint
        ? Number(selectedCheckpoint.value)
        : null,
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
    selectedCheckpoint,
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
      checkpointIndex: selectedCheckpoint
        ? Number(selectedCheckpoint.value)
        : null,
    });
  }, [
    isFavTab,
    selectedPovId,
    fromLive,
    selectedCategory,
    selectedCheckpoint,
    fetchData,
  ]);

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
      checkpointIndex: selectedCheckpoint
        ? Number(selectedCheckpoint.value)
        : null,
    });
  }, [
    selectedPovId,
    fromLive,
    selectedCategory,
    selectedCheckpoint,
    fetchData,
  ]);

  const distanceOptions = useMemo<FilterOption[]>(
    () =>
      distances.map((d) => ({
        label: d.distance_name,
        value: String(d.product_option_value_app_id),
      })),
    [distances],
  );

  const categoryOptions = useMemo<FilterOption[]>(
    () => [
      ...categories.map((c) => ({
        label: c.label,
        value: c.key,
      })),
      {
        label: t("allrace:filter.favourite"),
        value: "favourite",
      },
      {
        label: t("allrace:filter.liveTracking"),
        value: "live_tracking",
      },
    ],
    [categories, t],
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

  const selectedCategoryLabel = useMemo(() => {
    if (selectedCategory === "favourite") return t("allrace:filter.favourite");
    if (selectedCategory === "live_tracking")
      return t("allrace:filter.liveTracking");
    return (
      categories.find((c) => c.key === selectedCategory)?.label ?? "Scratch"
    );
  }, [categories, selectedCategory, t]);

  // category_rank is now assigned by the backend based on checkpoint_index,
  // so the list is rendered directly from results without re-deriving rank/order client-side.
  const displayResults = useMemo<RaceResult[]>(() => results, [results]);

  const checkpointOptions = useMemo<FilterOption[]>(() => {
    const allOption: FilterOption = {
      label: t("allrace:filter.all"),
      value: "",
    };

    // Prefer the backend event-level list (survives empty results).
    if (checkpointsList.length > 0) {
      return [
        allOption,
        ...checkpointsList
          .filter((cp) => !cp.is_start)
          .map((cp, displayIndex) => ({
            label: cp.name?.trim() ? cp.name : `Checkpoint ${displayIndex + 1}`,
            value: String(cp.checkpoint_index),
          })),
      ];
    }

    // Fallback: derive from results (older backend without checkpoints_list).
    if (results.length === 0) {
      return [allOption];
    }

    const representative = results.reduce(
      (best, r) =>
        (r.checkpoints?.length ?? 0) > (best.checkpoints?.length ?? 0)
          ? r
          : best,
      results[0],
    );

    const allCheckpoints = representative.checkpoints ?? [];

    return [
      allOption,
      ...allCheckpoints
        .map((cp, index) => ({ cp, index }))
        .filter(({ cp }) => !cp.is_start)
        .map(({ cp, index }, displayIndex) => ({
          label: cp.name?.trim() ? cp.name : `Checkpoint ${displayIndex + 1}`,
          value: String(index),
        })),
    ];
  }, [checkpointsList, results, t]);

  const onCheckpointSelect = useCallback(
    (opt: FilterOption): void => {
      // "All" selected
      if (opt.value === "") {
        if (API_CONFIG.DEBUG) {
          console.log("📍 All checkpoints selected");
        }

        setSelectedCheckpoint(null);

        fetchData({
          povId: selectedPovId,
          live: fromLive,
          category: selectedCategory,
          page: 1,
          mode: "filter",
          checkpointIndex: null,
        });

        return;
      }

      // Same checkpoint clicked again -> reset to All
      const isClearing = opt.value === selectedCheckpoint?.value;
      const nextCheckpoint = isClearing ? null : opt;

      if (API_CONFIG.DEBUG) {
        console.log(
          isClearing
            ? "📍 Checkpoint cleared"
            : `📍 Checkpoint selected: ${opt.label}`,
        );
      }

      setSelectedCheckpoint(nextCheckpoint);

      fetchData({
        povId: selectedPovId,
        live: fromLive,
        category: selectedCategory,
        page: 1,
        mode: "filter",
        checkpointIndex: nextCheckpoint ? Number(nextCheckpoint.value) : null,
      });
    },
    [selectedCheckpoint, selectedPovId, fromLive, selectedCategory, fetchData],
  );

  return {
    results,
    raceStatus,
    raceProgressStatus,
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
    selectedCheckpoint, // ← currently selected checkpoint FilterOption
    checkpointOptions, // ← dropdown options derived from results[0].checkpoints
    onCheckpointSelect,
    statistics,
  };
};
