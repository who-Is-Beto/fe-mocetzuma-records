import { API_BASE_URL } from "../config/api";
import type { Wishlist, WishlistRepository } from "../domain/wishlist";
import { http } from "../lib/httpClient";

type WishlistServiceConfig = {
  baseUrl?: string;
  getToken: () => string | null;
};

const withBase = (baseUrl: string, path: string) =>
  `${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}/`;

/** Repository for /wishlist/: the logged-in user's saved records. */
export function createWishlistService(config: WishlistServiceConfig): WishlistRepository {
  const baseUrl = config.baseUrl ?? API_BASE_URL;
  const token = () => config.getToken() ?? undefined;

  return {
    async get() {
      return http<Wishlist>(withBase(baseUrl, "/wishlist"), { token: token() });
    },
    async ids() {
      const data = await http<{ record_ids: number[] }>(withBase(baseUrl, "/wishlist/ids"), { token: token() });
      return data.record_ids;
    },
    async add(recordId) {
      await http(withBase(baseUrl, "/wishlist/items"), {
        method: "POST",
        token: token(),
        body: { record_id: Number(recordId) }
      });
    },
    async remove(recordId) {
      await http(withBase(baseUrl, `/wishlist/items/${recordId}`), { method: "DELETE", token: token() });
    }
  };
}
