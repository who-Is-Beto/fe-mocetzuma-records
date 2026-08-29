import { useCallback, useMemo } from "react";
import type { Order } from "../domain/orders";
import { createOrdersService } from "../services/ordersService";
import { extractErrorMessage } from "../lib/httpClient";
import { useServiceQuery } from "./useServiceQuery";

type Options = {
  token: string | null;
  /**
   * Fetch only while true. The page gates this on the email-verification
   * flow (unverified sessions cannot list orders yet and get a 403 with
   * code `email_not_verified`).
   */
  enabled?: boolean;
};

/**
 * The authenticated user's orders (GET /orders/). The raw service error is
 * exposed so pages can special-case the email-verification 403.
 */
export function useOrders({ token, enabled = true }: Options): {
  orders: Order[];
  isLoading: boolean;
  isError: boolean;
  /** Human-readable failure message, null while loading/ok. */
  error: string | null;
  /** Raw error (e.g. HttpError 403 email_not_verified) for page-level logic. */
  rawError: unknown;
  refetch: () => Promise<Order[] | undefined>;
} {
  const ordersService = useMemo(
    () => createOrdersService({ getToken: () => token }),
    [token]
  );
  const fetcher = useCallback(
    () => ordersService.getMine(),
    [ordersService]
  );

  const { data, isLoading, isError, error, refetch } = useServiceQuery<Order[]>(
    [ordersService],
    fetcher,
    { enabled: Boolean(token) && enabled }
  );

  return {
    orders: data ?? [],
    isLoading,
    isError,
    error: isError
      ? extractErrorMessage(error, "Error al cargar tus órdenes.")
      : null,
    rawError: isError ? error : null,
    refetch
  };
}