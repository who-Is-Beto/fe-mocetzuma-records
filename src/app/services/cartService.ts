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
    async addItem(
      recordId: string | number,
      cartCode?: string | null,
      quantity = 1
    ) {
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
      return http<{ checkout_url: { url?: string } }>(
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
      return http<CartResponse>(withBase(baseUrl, "/cart/remove"), {
        method: "DELETE",
        token: getToken?.() ?? undefined,
        body: {
          cart_code: cartCode,
          record_id: recordId
        }
      });
    },
    async removeAll(cartCode: string) {
      return http<CartResponse>(withBase(baseUrl, "/cart/remove-all"), {
        method: "DELETE",
        token: getToken?.() ?? undefined,
        body: {
          cart_code: cartCode
        }
      });
    }
  };
}
