import { useCallback, useMemo, useRef, useState } from "react";
import type { Record, RecordPage } from "../domain/album";
import { createRecordService } from "../services/recordService";
import { extractErrorMessage } from "../lib/httpClient";

type Options = {
  token: string | null;
};

/**
 * Admin record manager: paginated list, tokenized search across every page,
 * the sell-modal stock patch and record deletion. Mirrors the previous
 * ManageRecordsTab logic exactly.
 */
export function useAdminRecords({ token }: Options): {
  records: Record[];
  totalCount: number;
  hasNext: boolean;
  loading: boolean;
  error: string | null;
  /** Load a page or search results. Returns false when the request failed. */
  loadPage(query: string, pageNum: number): Promise<boolean>;
  sell(
    id: string | number,
    patch: { stock: number; final_sale_price?: number | string }
  ): Promise<Record>;
  remove(id: string | number): Promise<{ message?: string }>;
} {
  const recordService = useMemo(
    () => createRecordService({ getToken: () => token }),
    [token]
  );
  const [records, setRecords] = useState<Record[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Guards against stale responses clobbering newer ones (rapid search/paging).
  // Mirror of the previous AbortController-based race protection.
  const loadSeqRef = useRef(0);

  const loadPage = useCallback(
    async (query: string, pageNum: number): Promise<boolean> => {
      if (!token) return false;
      const seq = ++loadSeqRef.current;
      setLoading(true);
      setError(null);
      try {
        // Both /records/ and /search/ return the same paginated envelope
        // (count/next/previous/results); search pages through matches too.
        const data: RecordPage = query.trim()
          ? await recordService.search({ query: query.trim(), page: pageNum })
          : await recordService.list({ page: pageNum });
        if (seq !== loadSeqRef.current) return false; // stale response
        setRecords(data.results ?? []);
        setTotalCount(data.count ?? 0);
        setHasNext(Boolean(data.next));
        return true;
      } catch (err) {
        if (seq !== loadSeqRef.current) return false;
        setError(extractErrorMessage(err, "Error al cargar los discos."));
        return false;
      } finally {
        if (seq === loadSeqRef.current) setLoading(false);
      }
    },
    [recordService, token]
  );

  const sell = useCallback(
    async (
      id: string | number,
      patch: { stock: number; final_sale_price?: number | string }
    ): Promise<Record> => {
      const updated = await recordService.update(id, patch);
      setRecords((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                stock: patch.stock,
                final_sale_price:
                  patch.final_sale_price != null && patch.final_sale_price !== ""
                    ? patch.final_sale_price
                    : r.final_sale_price
              }
            : r
        )
      );
      return updated;
    },
    [recordService]
  );

  const remove = useCallback(
    async (id: string | number): Promise<{ message?: string }> => {
      const result = await recordService.remove(id);
      setRecords((prev) => prev.filter((r) => r.id !== id));
      setTotalCount((count) => Math.max(0, count - 1));
      return result;
    },
    [recordService]
  );

  return { records, totalCount, hasNext, loading, error, loadPage, sell, remove };
}