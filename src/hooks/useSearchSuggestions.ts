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

const useSearchSuggestions = (
  apiKey: SuggestionKey,
  tabFilters: TabFilter[] = [],
): UseSearchSuggestionsReturn => {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
          const results = await suggestionService.getSuggestions({
            [apiKey]: text.trim(),
          }); 
          const filtered =
            tabFilters.length > 0
              ? results.filter((r) => r.tab && tabFilters.includes(r.tab))
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
    [apiKey, tabFilters],
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