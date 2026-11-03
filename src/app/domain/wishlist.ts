/**
 * Wishlist ("Favoritos"): records a user saved for later. Mirrors
 * apiApp/views/wishlist.py — every call acts on the logged-in user's own list.
 */
import type { Record } from "./album";

export type WishlistItem = {
  id: number;
  record: Record;
  added_at: string;
};

/** GET /wishlist/ — newest first. */
export type Wishlist = {
  count: number;
  items: WishlistItem[];
};

export interface WishlistRepository {
  get(): Promise<Wishlist>;
  /** Just the saved record ids (every card's heart state). */
  ids(): Promise<number[]>;
  add(recordId: number | string): Promise<void>;
  /** Idempotent: removing a record that isn't saved succeeds. */
  remove(recordId: number | string): Promise<void>;
}
