/**
 * Bazar (flea-market event) domain types.
 *
 * Single source of truth shared by the public page, the checkout picker,
 * the orders detail and the admin manager — pages must never import types
 * from each other.
 */

/** A bazar event as returned by GET /bazares/ and the admin endpoints. */
export type Bazar = {
  id: number;
  name: string;
  slug: string;
  image: string | null;
  image_url: string | null;
  date: string; // YYYY-MM-DD
  schedule: string;
  address: string;
  google_maps_url: string;
  created_at: string;
};

/** Pickup info embedded in an order when shipped_to === 'bazar'. */
export type PickupBazar = {
  id: number;
  name: string;
  date: string;
  schedule: string;
  address: string;
  google_maps_url: string;
};
