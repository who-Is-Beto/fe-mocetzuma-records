import { API_BASE_URL } from "../config/api";
import type { Record as AlbumRecord } from "../domain/album";
import { http } from "../lib/httpClient";

export type OrderItem = {
  id: number | string;
  record: AlbumRecord;
  quantity: number;
  price: number | string;
};

export type Order = {
  id: number | string;
  stripe_checkout_session_id: string;
  amount: number | string;
  currency: string;
  user_email: string;
  shipped_to: "store" | "home" | "bazar";
  shipping_details: Record<string, string | null | undefined>;
  ship_link?: string | null;
  status: "paid" | "pending" | "failed" | string;
  created_at: string;
  updated_at: string;
  order_items: OrderItem[];
};

type OrdersServiceConfig = {
  baseUrl?: string;
  getToken?: () => string | null;
};

const withBase = (baseUrl: string, path: string) =>
  `${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}/`;

export function createOrdersService(config: OrdersServiceConfig = {}) {
  const baseUrl = config.baseUrl ?? API_BASE_URL;
  const getToken = config.getToken;

  return {
    async getOrders() {
      return http<Order[]>(withBase(baseUrl, "/orders"), {
        token: getToken?.() ?? undefined
      });
    }
  };
}
