// Search Participant's list state: the first load, the debounced search and
// the next pages. Moved out of SearchParticipant.tsx (app audit 2026-11-26) so
// the request ordering can be tested: node tests/results/app.test.js
//
// What it fixes there:
//  1. Out-of-order answers. Type "jan", pause, type "janssens": when the "jan"
//     answer landed last it replaced the list under "N results for
//     'janssens'". Now only the newest search's answer is applied (generation).
//  2. A page 2 of the OLD search that arrived after the new search's page 1
//     was appended to it. Pages carry the generation they were asked for.
//  3. Back from a runner's details, useFocusEffect re-ran fetch(1, '') — the
//     list went unfiltered while the box still showed the query — and set
//     isInitialLoad again, so the next keystroke was swallowed. The list now
//     loads once on mount and keeps its query, pages and scroll on return.
//  4. Two quick onEndReached calls loaded the same next page twice (the guard
//     was state, seen stale by the second call). A ref guards it now.
import { useCallback, useEffect, useRef, useState } from 'react';
import { participantService, Participant } from '../../services/participantService';
import { API_CONFIG } from '../../constants/config';

export interface ParticipantSearchOptions {
  productId: number;
  productOptionValueAppId?: number | string;
  /** Called once per completed page-1 search with a non-empty query. */
  onSearched?: (total: number) => void;
  onError: (err: unknown) => void;
  clearError: () => void;
  debounceMs?: number;
}

export function useParticipantSearch(opts: ParticipantSearchOptions) {
  const { productId, productOptionValueAppId, debounceMs = 500 } = opts;
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Bumped by every page-1 load: an answer for an older generation is dropped.
  const generation = useRef(0);
  const loadingMoreRef = useRef(false);
  const mounted = useRef(true);
  const firstSearchEffect = useRef(true);
  // Latest callbacks without making fetchParticipants depend on them.
  const cb = useRef(opts);
  cb.current = opts;

  const fetchParticipants = useCallback(async (pageNum: number, search: string) => {
    const gen = pageNum === 1 ? ++generation.current : generation.current;
    const isCurrent = () => mounted.current && gen === generation.current;
    try {
      if (pageNum === 1) {
        setLoading(true);
        cb.current.clearError();
      } else {
        loadingMoreRef.current = true;
        setLoadingMore(true);
      }

      if (API_CONFIG.DEBUG) {
        console.log(`📡 Fetching participants page ${pageNum}`, { search: search || '(none)', product_app_id: productId });
      }

      const result = await participantService.getParticipants({
        product_app_id: productId,
        product_option_value_app_id: productOptionValueAppId as any,
        page: pageNum,
        filter_name: search,
      });

      if (!isCurrent()) {
        if (API_CONFIG.DEBUG) console.log('⏭️ Participants answer dropped (a newer search is on screen)', { pageNum, search });
        return;
      }

      setParticipants(prev => {
        if (pageNum === 1) return result.participants;
        const existingIds = new Set(prev.map(p => participantService.getParticipantId(p)));
        const newItems = result.participants.filter(p => !existingIds.has(participantService.getParticipantId(p)));
        return [...prev, ...newItems];
      });
      setPage(pageNum);
      setTotalPages(result.pagination.total_pages);

      if (pageNum === 1 && search.trim().length > 0) {
        cb.current.onSearched?.(result.pagination.total ?? result.participants.length);
      }
    } catch (err) {
      if (API_CONFIG.DEBUG) console.error('❌ Error fetching participants:', (err as any)?.message);
      if (pageNum === 1 && isCurrent()) cb.current.onError(err);
    } finally {
      if (pageNum === 1) {
        if (isCurrent()) setLoading(false);
      } else {
        loadingMoreRef.current = false;
        if (mounted.current) setLoadingMore(false);
      }
    }
  }, [productId, productOptionValueAppId]);

  // First load, once (was: on every focus — see 3. above).
  useEffect(() => {
    mounted.current = true;
    fetchParticipants(1, '');
    return () => { mounted.current = false; };
  }, [fetchParticipants]);

  // Debounced search on every change of the text after the first render.
  useEffect(() => {
    if (firstSearchEffect.current) { firstSearchEffect.current = false; return; }
    const timer = setTimeout(() => { fetchParticipants(1, searchText); }, debounceMs);
    return () => clearTimeout(timer);
  }, [searchText, fetchParticipants]);

  const loadMore = useCallback(() => {
    if (page >= totalPages || loadingMoreRef.current) return;
    fetchParticipants(page + 1, searchText);
  }, [page, totalPages, searchText, fetchParticipants]);

  const retry = useCallback(() => { fetchParticipants(1, searchText); }, [fetchParticipants, searchText]);

  return { participants, loading, loadingMore, searchText, setSearchText, page, totalPages, loadMore, retry };
}
