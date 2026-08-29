import { API_BASE_URL } from "../config/api";
import type { Order } from "../domain/orders";
import { http } from "../lib/httpClient";

type OrdersServiceConfig = {
  baseUrl?: string;
  getToken?: () => string | null;
};

const withBase = (baseUrl: string, path: string) =>
  `${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}/`;

/**
 * Repository for the /orders/ API — customer orders, the admin list and
 * admin status/link updates.
 */
export function createOrdersService(config: OrdersServiceConfig = {}): {
  getMine(): Promise<Order[]>;
  all(): Promise<Order[]>;
  update(
    orderId: number | string,
    changes: Partial<Pick<Order, "status" | "shipping_link">>
  ): Promise<Order>;
} {
  const baseUrl = config.baseUrl ?? API_BASE_URL;
  const getToken = config.getToken;

  return {
    async getMine() {
      return http<Order[]>(withBase(baseUrl, "/orders"), {
        token: getToken?.() ?? undefined
      });
    },
    async all() {
      return http<Order[]>(withBase(baseUrl, "/orders/all"), {
        token: getToken?.() ?? undefined
      });
    },
    async update(orderId, changes) {
      return http<Order>(withBase(baseUrl, `/orders/${orderId}/update`), {
        method: "PATCH",
        token: getToken?.() ?? undefined,
        body: changes
      });
    }
  };
}