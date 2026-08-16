import { API_BASE_URL } from "../config/api";
import type { Record } from "../domain/album";
import { http } from "../lib/httpClient";

export type CartItem = {
  id: number | string;
  record: Record;
  quantity: number;
  subtotal: number;
};

export type CartResponse = {
  id: number | string;
  user: number | string | null;
  cart_code: string;
  created_at: string;
  updated_at: string;
  cart_items: CartItem[];
  total_price: number | string;
};

export type ShippingDetails = {
  fullName: string;
  phone: string;
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
  zip: string;
  reference: string;
};

export type CartRepository = {
  getCarts(): Promise<CartResponse[]>;
  getCart(cartCode: string): Promise<CartResponse>;
  addItem(
    recordId: string | number,
    cartCode?: string | null,
    quantity?: number,
    email?: string
  ): Promise<CartResponse>;
  updateItem(itemId: string | number, quantity: number): Promise<CartResponse>;
  removeItem(cartCode: string, recordId: string | number): Promise<{ message?: string }>;
  removeAll(cartCode: string): Promise<{ message?: string }>;
  createCheckoutSession(
    cartCode: string,
    shippedTo: "store" | "home" | "bazar",
    shippingDetails?: ShippingDetails
  ): Promise<{ checkout_url?: string; session_id?: string }>;
};

type CartServiceConfig = {
  baseUrl?: string;
  getToken?: () => string | null;
};

const withBase = (baseUrl: string, path: string) =>
  `${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}/`;

export function createCartService(config: CartServiceConfig = {}): CartRepository {
  const baseUrl = config.baseUrl ?? API_BASE_URL;
  const getToken = config.getToken;

  return {
    async getCarts() {
      return http<CartResponse[]>(withBase(baseUrl, "/carts"), {
        token: getToken?.() ?? undefined
      });
    },
    async getCart(cartCode: string) {
      return http<CartResponse>(withBase(baseUrl, `/cart/${encodeURIComponent(cartCode)}`), {
        token: getToken?.() ?? undefined
      });
    },
    async addItem(
      recordId: string | number,
      cartCode?: string | null,
      quantity = 1,
      email?: string
    ) {
      return http<CartResponse>(withBase(baseUrl, "/cart/add"), {
        method: "POST",
        token: getToken?.() ?? undefined,
        body: {
          cart_code: cartCode ?? undefined,
          record_id: recordId,
          email,
          // backend defaults to 1; include quantity only if provided
          ...(quantity ? { quantity } : {})
        }
      });
    },
    async updateItem(itemId: string | number, quantity: number) {
      return http<CartResponse>(withBase(baseUrl, "/cart/update"), {
        method: "PUT",
        token: getToken?.() ?? undefined,
        body: {
          item_id: itemId,
          quantity
        }
      });
    },
    async createCheckoutSession(
      cartCode: string,
      shippedTo: "store" | "home" | "bazar",
      shippingDetails?: ShippingDetails
    ) {
      return http<{ checkout_url?: string; session_id?: string }>(
        withBase(baseUrl, "/create-checkout-session"),
        {
          method: "POST",
          token: getToken?.() ?? undefined,
          body: {
            cart_code: cartCode,
            shipped_to: shippedTo,
            ...(shippingDetails ? { shipping_details: shippingDetails } : {})
          }
        }
      );
    },
    async removeItem(cartCode: string, recordId: string | number) {
      return http<{ message?: string }>(withBase(baseUrl, "/cart/remove"), {
        method: "DELETE",
        token: getToken?.() ?? undefined,
        body: {
          cart_code: cartCode,
          record_id: recordId
        }
      });
    },
    async removeAll(cartCode: string) {
      return http<{ message?: string }>(withBase(baseUrl, "/cart/remove-all"), {
        method: "DELETE",
        token: getToken?.() ?? undefined,
        body: {
          cart_code: cartCode
        }
      });
    }
  };
}
