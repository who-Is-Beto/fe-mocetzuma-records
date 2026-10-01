import { useEffect, useMemo, useState } from "react";
import type { Record } from "../domain/album";
import { createRecordService } from "../services/recordService";

export const SUGGESTION_MIN_CHARS = 2;
const SUGGESTION_LIMIT = 5;
const DEBOUNCE_MS = 250;

type State = { key: string; results: Record[]; error: boolean };

/**
 * Up to 5 records for the search bar's typeahead. Debounced, ignores queries
 * shorter than SUGGESTION_MIN_CHARS, aborts the previous request, and asks
 * the backend for page_size=5 (LIMIT in SQL — no client-side slicing).
 */
export function useRecordSuggestions(query: string, token: string | null, includeUnavailable = false) {
  const recordService = useMemo(() => createRecordService({ getToken: () => token }), [token]);
  const q = query.trim();
  const enabled = q.length >= SUGGESTION_MIN_CHARS;
  // Results are tagged with the request they answer: anything else is "loading".
  const key = `${q}|${includeUnavailable}`;
  const [state, setState] = useState<State>({ key: "", results: [], error: false });

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      recordService
        .search({
          query: q,
          page_size: SUGGESTION_LIMIT,
          // Same rule as the catalog: sold-out records only when the viewer
          // turned "Solo disponibles" off.
          available: includeUnavailable ? undefined : true,
          signal: controller.signal,
        })
        .then((page) => setState({ key, results: page.results ?? [], error: false }))
        .catch(() => {
          if (!controller.signal.aborted) setState({ key, results: [], error: true });
        });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q, key, enabled, includeUnavailable, recordService]);

  const settled = state.key === key;
  return {
    enabled,
    loading: enabled && !settled,
    results: enabled && settled ? state.results : [],
    error: enabled && settled && state.error,
  };
}
