import { useCallback, useRef, useState } from "react";
import {
  SuggestionItem,
  suggestionService,
} from "../services/followerScreenService";

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
          setSuggestions(
            tabFilters.length > 0
              ? results.filter((r) => r.tab && tabFilters.includes(r.tab))
              : results,
          );
          console.log("🔍 Final suggestions set:", suggestions.length);
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
