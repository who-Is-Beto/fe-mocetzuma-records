import { useCallback, useMemo } from "react";
import { createBazarService } from "../services/bazarService";
import { useServiceQuery } from "./useServiceQuery";
import { extractErrorMessage } from "../lib/httpClient";
import type { Bazar } from "../domain/bazares";

type Options = {
  /**
   * Fetch only while true (e.g. the checkout picker fetches once its option
   * is selected). Defaults to immediate.
   */
  enabled?: boolean;
};

/**
 * Public list of upcoming bazares (GET /bazares/): soonest first, past
 * events already filtered out server-side.
 */
export function useUpcomingBazares({ enabled = true }: Options = {}): {
  bazares: Bazar[];
  isLoading: boolean;
  isError: boolean;
  /** Human-readable failure message, null while loading/ok. */
  error: string | null;
  retry: () => void;
} {
  const bazarService = useMemo(() => createBazarService(), []);
  const fetcher = useCallback(() => bazarService.getUpcoming(), [bazarService]);

  const { data, isLoading, isError, error, refetch } = useServiceQuery<Bazar[]>(
    [bazarService],
    fetcher,
    { enabled }
  );

  return {
    bazares: data ?? [],
    isLoading,
    isError,
    error: isError
      ? extractErrorMessage(error, "No pudimos cargar los bazares.")
      : null,
    retry: () => {
      void refetch().catch(() => {
        // The hook already surfaced the error; swallowing keeps callers simple.
      });
    }
  };
}
