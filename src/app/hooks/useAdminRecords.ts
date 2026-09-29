import { useCallback, useMemo, useRef, useState } from "react";
import type { Record, RecordPage } from "../domain/album";
import type { PaymentMethod, SaleResult } from "../domain/sales";
import { createRecordService } from "../services/recordService";
import { createSalesService } from "../services/salesService";
import { extractErrorMessage } from "../lib/httpClient";

type Options = {
  token: string | null;
};

/** One line of the "Vender" ticket. */
export type SellLine = { record: Record; quantity: number; price?: string };

/** How the ticket was paid; `commission_rate` (%) only applies to card. */
export type SellPayment = { payment_method: PaymentMethod; commission_rate?: string };

/**
 * Admin record manager: paginated list, tokenized search across every page,
 * registering a sale (the "Vender" ticket) and record deletion.
 */
export function useAdminRecords({ token }: Options): {
  records: Record[];
  totalCount: number;
  hasNext: boolean;
  loading: boolean;
  error: string | null;
  /** Load a page or search results. Returns false when the request failed. */
  loadPage(query: string, pageNum: number): Promise<boolean>;
  /** Register one sale with every ticket line; throws on failure (e.g. no stock). */
  sell(lines: SellLine[], payment: SellPayment): Promise<SaleResult>;
  /** Full record for the edit form: list rows lack description, weight, etc. */
  loadForEdit(id: string | number): Promise<Record>;
  remove(id: string | number): Promise<{ message?: string }>;
} {
  const recordService = useMemo(
    () => createRecordService({ getToken: () => token }),
    [token]
  );
  const salesService = useMemo(
    () => createSalesService({ getToken: () => token }),
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
    async (lines: SellLine[], payment: SellPayment): Promise<SaleResult> => {
      const result = await salesService.register({
        items: lines.map(({ record, quantity, price }) => ({ record: record.id, quantity, price })),
        ...payment
      });
      // The server decremented stock atomically; mirror it in the list.
      const sold = new Map(lines.map((l) => [l.record.id, l.quantity]));
      setRecords((prev) =>
        prev.map((r) =>
          sold.has(r.id) ? { ...r, stock: (r.stock ?? 0) - (sold.get(r.id) ?? 0) } : r
        )
      );
      return result;
    },
    [salesService]
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

  const loadForEdit = useCallback(
    (id: string | number) => recordService.getForEdit(id),
    [recordService]
  );

  return { records, totalCount, hasNext, loading, error, loadPage, sell, loadForEdit, remove };
}