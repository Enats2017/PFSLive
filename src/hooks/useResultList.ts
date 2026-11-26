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
import { useIsFocused } from "@react-navigation/native";
// ADD these two imports
import { AppError, ErrorType, isRateLimited } from "../services/api";
import { useScreenError, ScreenError } from "../hooks/useApiError";
import { useTranslation } from "react-i18next";
import { rememberBibOwners } from "../utils/followStorage";

export const TYPE_OPTIONS: FilterOption[] = [
  { label: "allrace:filter.results", value: "0" },
  { label: "allrace:filter.live", value: "1" },
];

const PRESERVED_CATEGORIES = ["favourite", "live_tracking"];

// "quiet": a background refresh of page 1 — no spinner, no error screen
// (second audit 2026-11-26, see the focus / live poll effects below).
type FetchMode = "initial" | "filter" | "paginate" | "refresh" | "quiet";

/** Back on the list after this long: refresh quietly. */
export const QUIET_REFRESH_AFTER_MS = 30_000;
/** While a race is in progress and the list is on screen: refresh this often. */
export const LIVE_LIST_POLL_MS = 60_000;

interface FetchOpts {
  povId?: number;
  live: 0 | 1;
  category: string;
  page: number;
  mode: FetchMode;
  checkpointIndex?: number | null;
}

/**
 * Append the next page without repeating a runner (app audit 2026-11-26).
 * Pages are offsets into a ranking that MOVES during a live race: a runner
 * pushed over the page boundary between the page-1 and page-2 requests came
 * back on page 2 as a second row. Same bib = same runner on one distance;
 * rows without a bib are never merged.
 */
export function appendResultsPage(prev: RaceResult[], next: RaceResult[]): RaceResult[] {
  const seen = new Set(prev.map((r) => String(r.bib ?? "").trim()).filter((b) => b !== ""));
  const fresh = (next ?? []).filter((r) => {
    const b = String(r.bib ?? "").trim();
    return b === "" || !seen.has(b);
  });
  return [...prev, ...fresh];
}

const posNum = (r: RaceResult | undefined): number | null => {
  const n = Number(String(r?.position ?? "").replace(/\D+$/, "").trim());
  return r && String(r.position ?? "").trim() !== "" && Number.isFinite(n) && n > 0 ? n : null;
};

/**
 * Did a runner fall between two pages? (re-audit 2026-11-26, live offset
 * pagination.) Only on the overall (scratch) list, where rows are in overall
 * position order: if the new page starts more than one place after the last
 * row shown, someone moved up from the new page's range into the pages
 * already shown after those were fetched — on neither page. Ties (5, 5, 7)
 * only cost one extra request.
 */
export function pageBoundaryGap(prev: RaceResult[], next: RaceResult[]): boolean {
  const last = posNum(prev[prev.length - 1]);
  const first = posNum(next[0]);
  return last !== null && first !== null && first > last + 1;
}

/**
 * The previous page fetched again (`again`) supplies the runners who moved
 * across the boundary; they are added (by bib) and the overall list is put
 * back in position order. Rows without a numeric position keep their place
 * at the end (DNF / DNS…).
 */
export function mergeBoundaryRefetch(prev: RaceResult[], again: RaceResult[], next: RaceResult[]): RaceResult[] {
  // The page fetched again is the fresher copy: its rows replace the ones
  // shown (new positions), runners it adds are appended, then the next page.
  const fresh = new Map(again.map((r) => [String(r.bib ?? "").trim(), r] as [string, RaceResult]));
  const updated = prev.map((r) => { const b = String(r.bib ?? "").trim(); return (b !== "" && fresh.get(b)) || r; });
  const all = appendResultsPage(appendResultsPage(updated, again), next);
  const ranked = all.filter((r) => posNum(r) !== null);
  const rest = all.filter((r) => posNum(r) === null);
  ranked.sort((a, b) => (posNum(a) as number) - (posNum(b) as number));
  return [...ranked, ...rest];
}

export const useResultList = (
  product_app_id: number,
  initial_pov_id?: number,
  followedUsers?: Set<number>,
  initialType?: FilterOption,
  followedBibs?: Map<number, Set<string>>,
) => {
  const isMounted = useRef(true);
  // ✅ Newest request wins (app audit 2026-11-26). This was a lock that
  // SKIPPED any fetch while another was running — but the dropdowns had
  // already changed state, so a distance / category / type / checkpoint picked
  // while page 2 (or the first load) was still loading left the OLD distance's
  // rows under the NEW label, and the next page then appended the new
  // distance's rows to them. Now a filter, refresh or retry always runs and an
  // older answer still in flight is dropped (latestSeq). Only a page load
  // waits for nothing else to be running (inFlight), so one page never loads
  // twice and never lands on top of a filter change.
  const latestSeq = useRef(0);
  const inFlight = useRef(0);
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
  // The rows on screen, readable from fetchData (boundary check below).
  const resultsRef = useRef<RaceResult[]>([]);
  resultsRef.current = results;
  const [checkpointsList, setCheckpointsList] = useState<CheckpointListItem[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [favBibs, setFavBibs] = useState<Set<string>>(new Set());
  const [initialLoad, setInitialLoad] = useState(true);
  const [filterLoad, setFilterLoad] = useState(false);
  const [pageLoad, setPageLoad] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // ✅ Loading the NEXT page failed: the rows already shown stay, the list
  // footer offers a retry (it used to swap the whole list for the error screen).
  const [pageError, setPageError] = useState(false);
  const [raceStatus, setRaceStatus] = useState<string>("");
  const [raceProgressStatus, setRaceProgressStatus] = useState<string>("");
  const [showUtmbIndex, setShowUtmbIndex] = useState(false);
  const [statistics, setStatistics] = useState<Statistics>({
    crossed: 0,
    expected: 0,
    started: 0,
    dnf: 0,
  });
   const [raceDate, setRaceDate] = useState<string | null>(null);

  const { error, hasError, handleApiError, clearError } = useScreenError();

  const currentPage = useRef(1);
  // When the list on screen was last fetched (epoch ms), and the 429 pause.
  const lastFetchAt = useRef(0);
  const pausedUntil = useRef(0);

  const toggleFav = useCallback((bib: string): void => {
    setFavBibs((prev) => {
      const next = new Set(prev);
      next.has(bib) ? next.delete(bib) : next.add(bib);
      return next;
    });
  }, []);

  const fetchData = useCallback(
    async (opts: FetchOpts): Promise<void> => {
      const { povId, live, category, page, mode, checkpointIndex } = opts;

      if (mode === "paginate" && inFlight.current > 0) {
        if (API_CONFIG.DEBUG) {
          console.log("⏸️ Request already in progress, skipping page", page);
        }
        return;
      }

      const seq = ++latestSeq.current;
      inFlight.current++;
      // Still the newest request? An older one's answer must not touch state.
      const isLatest = () => isMounted.current && seq === latestSeq.current;

      try {
        if (mode === "initial") setInitialLoad(true);
        if (mode === "filter") setFilterLoad(true);
        if (mode === "paginate") setPageLoad(true);
        if (mode === "refresh") setRefreshing(true);
        // A filter / refresh replaces the list: a page load it overtook
        // (dropped below) no longer owns the footer spinner.
        if (mode !== "paginate") setPageLoad(false);

        if (mode !== "quiet") {
          clearError();
          setPageError(false);
        }

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

        if (!isLatest()) {
          if (API_CONFIG.DEBUG) console.log("⏭️ Results answer dropped (a newer request is on screen)", { seq, mode, page });
          return;
        }

        // ✅ Live, overall list: a runner who moved up across the page
        // boundary between two page requests was on neither page. When the
        // new page starts with a gap, fetch the previous page once more and
        // merge (re-audit 2026-11-26). One extra request, only on a gap.
        let boundaryRows: RaceResult[] | null = null;
        if (mode === "paginate" && page > 1 && category === "scratch" && checkpointIndex == null
            && data.event?.race_status === "in_progress"
            && pageBoundaryGap(resultsRef.current, data.results)) {
          try {
            const again = await resultList.getEventRanking({
              product_app_id,
              product_option_value_app_id: povId,
              from_live: live,
              filter_category: "",
              checkpoint_index: null,
              page: page - 1,
            });
            if (!isLatest()) return;
            boundaryRows = again.results ?? [];
          } catch {
            // The page itself arrived — show it; the gap stays until a refresh.
            if (!isLatest()) return;
          }
        }

        if (data.event?.race_status) {
          setRaceStatus(data.event.race_status);
          setRaceDate(data.event?.product_race_date ?? null);
          setRaceProgressStatus(data.event.race_progress_status ?? "");

          if (API_CONFIG.DEBUG) {
            console.log("✅ Race Status:", data.event.race_status);
            console.log(
              "✅ Race Progress Status:",
              data.event.race_progress_status,
            );
          }
        }
        setShowUtmbIndex(data.event?.show_utmb_index === 1);

        // if (data.event?.show_utmb_index !== undefined) {
        //   setShowUtmbIndex(data.event.show_utmb_index === 1);

        //   if (API_CONFIG.DEBUG) {
        //     console.log(
        //       "✅ Show UTMB Index:",
        //       data.event.show_utmb_index === 1,
        //     );
        //   }
        // }

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

        // ✅ bib → athlete links for followed bibs on this page (followStorage
        // rememberBibOwners, audit 2026-11-26 FN1). Fire-and-forget.
        void rememberBibOwners(product_app_id, data.results as any[]);
        setResults((prev) =>
          mode !== "paginate" ? data.results
            : boundaryRows ? mergeBoundaryRefetch(prev, boundaryRows, data.results)
            : appendResultsPage(prev, data.results),
        );

        // Keep the checkpoint list from the backend. It's event-level and always
        // populated when a start list exists, so the filter survives an empty
        // results set. Only update when the backend sends a non-empty list, so a
        // zero-crossing checkpoint response (empty results) doesn't wipe it.
        if (Array.isArray(data.checkpoints_list) && data.checkpoints_list.length > 0) {
          setCheckpointsList(data.checkpoints_list);
        }

        // A response without statistics must not crash the strip.
        setStatistics(data.statistics ?? { crossed: 0, expected: 0, started: 0, dnf: 0 });

        setPagination(data.pagination);
        currentPage.current = page;
        lastFetchAt.current = Date.now();
        // A quiet refresh that got through: the list is good again.
        if (mode === "quiet") clearError();

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
        if (!isLatest()) return;

        if (API_CONFIG.DEBUG) {
          console.error("❌ Fetch results error:", e);
        }

        // ✅ 429: no quiet refresh before the server's Retry-After.
        if (isRateLimited(e)) {
          const s = Number(e?.data?.retryAfter);
          pausedUntil.current = Date.now() + (Number.isFinite(s) && s > 0 ? s : 60) * 1000;
        }
        // ✅ A failed NEXT page keeps the rows on screen (footer retry); a
        // failed QUIET refresh keeps the list as it is (the next one retries).
        if (mode === "paginate") setPageError(true);
        else if (mode !== "quiet") handleApiError(e);
      } finally {
        inFlight.current = Math.max(0, inFlight.current - 1);
        // Only the newest request ends the spinners; an overtaken one would
        // end the spinner of the filter load that is still running.
        if (isLatest()) {
          setInitialLoad(false);
          setFilterLoad(false);
          setPageLoad(false);
          setRefreshing(false);
        }
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

  // ✅ The list is no longer stale on return or during a race (second audit
  // 2026-11-26). The tab bar now pops back to the list that is already open
  // (utils/tabNavigation), whose focus only re-read the follows and which never
  // polled — the ranking froze at whatever it was when first opened.
  //  - back on the list after 30 s or more: refresh page 1 quietly;
  //  - race in progress and the list on screen: the same every 60 s.
  // Only while the user is at the top of the list (page 1 loaded) — a refresh
  // replaces the rows, and would throw away the pages scrolled to. Never over a
  // request in flight, never inside a 429 pause, never while not focused.
  const isFocused = useIsFocused();
  const quietArgs = useRef({ selectedPovId, fromLive, selectedCategory, selectedCheckpoint });
  quietArgs.current = { selectedPovId, fromLive, selectedCategory, selectedCheckpoint };
  const quietRefresh = useCallback((): void => {
    if (inFlight.current > 0 || currentPage.current !== 1 || Date.now() < pausedUntil.current) return;
    const a = quietArgs.current;
    fetchData({
      povId: a.selectedPovId,
      live: a.fromLive,
      category: a.selectedCategory,
      page: 1,
      mode: "quiet",
      checkpointIndex: a.selectedCheckpoint ? Number(a.selectedCheckpoint.value) : null,
    });
  }, [fetchData]);
  const focusSeen = useRef(false);
  useEffect(() => {
    if (!isFocused) return;
    if (!focusSeen.current) { focusSeen.current = true; return; }   // the mount's own load
    if (lastFetchAt.current > 0 && Date.now() - lastFetchAt.current >= QUIET_REFRESH_AFTER_MS) quietRefresh();
  }, [isFocused, quietRefresh]);
  useEffect(() => {
    if (!isFocused || raceStatus !== "in_progress") return;
    const id = setInterval(quietRefresh, LIVE_LIST_POLL_MS);
    return () => clearInterval(id);
  }, [isFocused, raceStatus, quietRefresh]);

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
    pageError,   // ← next page failed; footer retry (calls onEndReached)
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
     raceDate,
  };
};
