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

export type ShippingQuote = {
  title: string;
  total: number | string;
  currency: string;
  courier: string;
  serviceType: string;
  deliveryCommitment?: string;
};

export type ShippingQuoteResponse = {
  zip_code: string;
  subtotal: number | string;
  currency: string;
  selected: ShippingQuote;
  quotes: ShippingQuote[];
};

// Sepomex colonia data for a ZIP (one ZIP can cover several colonias).
export type ShippingLocation = {
  zipCode: string;
  neighborhood: string;
  city: string;
  state: string;
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
  quoteShipping(
    cartCode: string,
    zip: string
  ): Promise<ShippingQuoteResponse>;
  fetchLocations(zip: string): Promise<{ zip: string; locations: ShippingLocation[] }>;
  removeItem(cartCode: string, recordId: string | number): Promise<CartResponse>;
  removeAll(cartCode: string): Promise<CartResponse>;
  createCheckoutSession(
    cartCode: string,
    shippedTo: "store" | "home" | "bazar",
    shippingDetails?: ShippingDetails,
    bazarId?: number
  ): Promise<{ checkout_url?: string; session_id?: string }>;
  // Fallback for when the Stripe webhook can't reach the backend (local dev):
  // asks the server to fulfill a paid session on return from checkout.
  completeCheckoutSession(sessionId: string): Promise<{ message?: string }>;
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
      return http<CartResponse[]>(withBase(baseUrl, "/cart"), {
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
    async quoteShipping(cartCode: string, zip: string) {
      return http<ShippingQuoteResponse>(withBase(baseUrl, "/shipping/quote"), {
        method: "POST",
        token: getToken?.() ?? undefined,
        body: {
          cart_code: cartCode,
          zip
        }
      });
    },
    async fetchLocations(zip: string) {
      return http<{ zip: string; locations: ShippingLocation[] }>(
        withBase(baseUrl, "/shipping/locations"),
        {
          method: "GET",
          token: getToken?.() ?? undefined,
          query: { zip }
        }
      );
    },
    async createCheckoutSession(
      cartCode: string,
      shippedTo: "store" | "home" | "bazar",
      shippingDetails?: ShippingDetails,
      bazarId?: number
    ) {
      return http<{ checkout_url?: string; session_id?: string }>(
        withBase(baseUrl, "/create-checkout-session"),
        {
          method: "POST",
          token: getToken?.() ?? undefined,
          body: {
            cart_code: cartCode,
            shipped_to: shippedTo,
            ...(shippingDetails ? { shipping_details: shippingDetails } : {}),
            ...(bazarId != null ? { bazar_id: bazarId } : {})
          }
        }
      );
    },
    // Fallback for when the Stripe webhook can't reach the backend (e.g. local
    // dev): asks the server to fulfill a paid session on return from checkout.
    async completeCheckoutSession(sessionId: string) {
      return http<{ message?: string }>(
        withBase(baseUrl, "/checkout/complete"),
        {
          method: "POST",
          token: getToken?.() ?? undefined,
          body: { session_id: sessionId }
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
