import { API_BASE_URL } from "../config/api";
import type { Record } from "../domain/album";
import { http } from "../lib/httpClient";

type CartItem = {
  id: number | string;
  record: Record;
  quantity: number;
  subtotal: number;
};

export type CartResponse = {
  id: number | string;
  user: number | string;
  cart_code: string;
  created_at: string;
  updated_at: string;
  cart_items: CartItem[];
  total_price: number | string;
};

type CartServiceConfig = {
  baseUrl?: string;
  getToken?: () => string | null;
};

const withBase = (baseUrl: string, path: string) =>
  `${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}/`;

export function createCartService(config: CartServiceConfig = {}) {
  const baseUrl = config.baseUrl ?? API_BASE_URL;
  const getToken = config.getToken;

  return {
    async getCarts() {
      return http<CartResponse[]>(withBase(baseUrl, "/carts"), {
        token: getToken?.() ?? undefined
      });
    },
    async addItem(recordId: string | number, cartCode?: string | null, quantity = 1) {
      return http<CartResponse>(withBase(baseUrl, "/cart/add"), {
        method: "POST",
        token: getToken?.() ?? undefined,
        body: {
          cart_code: cartCode ?? undefined,
          record_id: recordId,
          // backend defaults to 1; include quantity only if provided
          ...(quantity ? { quantity } : {})
        }
      });
    }
  };
}
