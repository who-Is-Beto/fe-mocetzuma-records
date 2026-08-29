import { useCallback, useEffect, useMemo, useState } from "react";
import type { Order } from "../domain/orders";
import { createOrdersService } from "../services/ordersService";
import { extractErrorMessage } from "../lib/httpClient";

type Options = {
  token: string | null;
};

/**
 * Admin order manager (GET /orders/all/ + PATCH /orders/:id/update/).
 * `updateOrder` patches the server and replaces the row in place; throws on
 * failure so the page can surface its own toast.
 */
export function useAdminOrders({ token }: Options): {
  orders: Order[];
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
  updateOrder(
    orderId: number | string,
    changes: Partial<Pick<Order, "status" | "shipping_link">>
  ): Promise<Order>;
} {
  const ordersService = useMemo(
    () => createOrdersService({ getToken: () => token }),
    [token]
  );
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await ordersService.all();
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      // Swallowing keeps the mount effect free of unhandled rejections;
      // the page renders `error` instead.
      setError(extractErrorMessage(err, "Error al cargar los pedidos."));
    } finally {
      setLoading(false);
    }
  }, [ordersService, token]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateOrder = useCallback(
    async (
      orderId: number | string,
      changes: Partial<Pick<Order, "status" | "shipping_link">>
    ): Promise<Order> => {
      const updated = await ordersService.update(orderId, changes);
      setOrders((prev) =>
        prev.map((o) => (String(o.id) === String(orderId) ? updated : o))
      );
      return updated;
    },
    [ordersService]
  );

  return { orders, loading, error, load, updateOrder };
}