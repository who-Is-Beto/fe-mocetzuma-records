import { API_BASE_URL } from "../config/api";
import type {
  ShippingLocation,
  ShippingQuoteResponse
} from "../domain/shipping";
import { http } from "../lib/httpClient";

type ShippingServiceConfig = {
  baseUrl?: string;
  getToken?: () => string | null;
};

const withBase = (baseUrl: string, path: string) =>
  `${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}/`;

/**
 * Repository for the /shipping/ API — ZIP autocomplete (Sepomex) and courier
 * quotes for a cart. Requires the authenticated user's cart code.
 */
export function createShippingService(config: ShippingServiceConfig = {}): {
  quote(cartCode: string, zip: string): Promise<ShippingQuoteResponse>;
  locations(
    zip: string
  ): Promise<{ zip: string; locations: ShippingLocation[] }>;
} {
  const baseUrl = config.baseUrl ?? API_BASE_URL;
  const getToken = config.getToken;

  return {
    async quote(cartCode, zip) {
      return http<ShippingQuoteResponse>(withBase(baseUrl, "/shipping/quote"), {
        method: "POST",
        token: getToken?.() ?? undefined,
        body: { cart_code: cartCode, zip }
      });
    },
    async locations(zip) {
      return http<{ zip: string; locations: ShippingLocation[] }>(
        withBase(baseUrl, "/shipping/locations"),
        {
          token: getToken?.() ?? undefined,
          query: { zip }
        }
      );
    }
  };
}