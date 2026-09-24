import { useCallback, useRef, useState } from "react";
import {
  SuggestionItem,
  suggestionService,
} from "../services/followerScreenService";
import { analyticsService } from "../services/analyticsService";

export type SuggestionKey = "filter_name" | "filter_name_past_suggestion";
export type TabFilter = "past" | "live" | "upcoming";

export interface UseSearchSuggestionsReturn {
  query: string;
  suggestions: SuggestionItem[];
  loading: boolean;
  dropdownVisible: boolean;
  handleSearch: (text: string) => void;
  clearSuggestions: () => void;
}

const DEBOUNCE_MS = 350;

/**
 * @param apiKey Which suggestion endpoint(s) to query. Pass an ARRAY only when a
 *   screen genuinely needs both — ParticipantScreen lists past events alongside
 *   live/upcoming, so it needs the pair. FollowerScreen mounts this hook twice,
 *   one key each, and must stay on one key per call: querying both from both
 *   hooks fired four requests per settled search where two were needed, and half
 *   of every response was then thrown away by `tabFilters` anyway.
 */
const useSearchSuggestions = (
  apiKey: SuggestionKey | SuggestionKey[],
  tabFilters: TabFilter[] = [],
): UseSearchSuggestionsReturn => {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Both call sites pass array literals, which are a fresh reference on every
  // render — as a useCallback dep they would rebuild handleSearch each time.
  // Comparing the joined string instead keeps it stable until the values change.
  const keySig = (Array.isArray(apiKey) ? apiKey : [apiKey]).join(",");
  const tabSig = tabFilters.join(",");

  const clearSuggestions = useCallback(() => {
    setSuggestions([]);
    setDropdownVisible(false);
    setQuery("");
  }, []);

  const handleSearch = useCallback(
    (text: string) => {
      setQuery(text);
      if (timer.current) clearTimeout(timer.current);

      if (!text.trim()) {
        setSuggestions([]);
        setDropdownVisible(false);
        return;
      }

      setLoading(true);
      setDropdownVisible(true);

      timer.current = setTimeout(async () => {
        try {
          // One request per requested key, not one per key that exists.
          const keys = keySig.split(",") as SuggestionKey[];
          const tabs = (tabSig ? tabSig.split(",") : []) as TabFilter[];
          const responses = await Promise.all(
            keys.map((key) => suggestionService.getSuggestions({ [key]: text.trim() })),
          );
          const results = responses.flat();
          const filtered =
            tabs.length > 0
              ? results.filter((r) => r.tab && tabs.includes(r.tab))
              : results;
          setSuggestions(filtered);

          // One event per completed search — inside the debounce, after results
          // resolve. Not per keystroke. Instrumented HERE rather than at the three
          // call sites (FollowerScreen x2, ParticipantScreen) because the hook owns
          // the debounce and the response: a caller-side call would fire on every
          // render instead of once per settled search.
          // Count only, never the query text — free text is unbounded and would
          // blow GA4's cardinality limit.
          void analyticsService.logSearchPerformed("event", filtered.length);

          // Was: suggestions.length — that reads the STALE closure value (the
          // previous render's state), so it always logged the old count.
          console.log("🔍 Final suggestions set:", filtered.length);
        } catch {
          setSuggestions([]);
        } finally {
          setLoading(false);
        }
      }, DEBOUNCE_MS);
    },
    [keySig, tabSig],
  );

  return {
    query,
    suggestions,
    loading,
    dropdownVisible,
    handleSearch,
    clearSuggestions,
  };
};

export default useSearchSuggestions;