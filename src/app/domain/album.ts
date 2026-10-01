export type Record = {
  id: string;
  title: string;
  condition: string;
  category: {
    id: string;
    name: string;
    slug: string;
    description?: string;
    image_url?: string;
  };
  artist: {
    id: string;
    name: string;
    slug: string;
  };
  price: number | string;
  discount_percentage?: number;
  discount_porcentage?: number;
  description?: string;
  cover_image_url?: string;
  images?: string[];
  slug: string;
  stock: number;
  release_date?: string | number;
  featured?: boolean;
  items_inside?: number;
  genere?: string | number | { id?: string | number; name?: string; slug?: string };
  cost_price?: number | string;
  sell_price?: number | string;
  final_sale_price?: number | string | null;
  weight_grams?: number | null;
  /** Admin responses only: whose units the stock is; empty = store stock. */
  owners?: RecordOwnerStock[];
};

/** How many of a record's stock belong to one owner (they add up to `stock`). */
export type RecordOwnerStock = {
  owner: number;
  owner_name: string;
  quantity: number;
};

export type RecordPage = {
  count: number;
  next: string | null;
  previous: string | null;
  results: Record[];
};

export interface Category {
  id: number | string;
  name: string;
  slug: string;
}

export type Genere = {
  id: number;
  name: string;
  slug: string;
};

export type Artist = {
  id: number;
  name: string;
  slug: string;
};

/** Who a record belongs to; gets an email every time one of their records sells. */
export type Owner = {
  id: number;
  name: string;
  email: string;
};

/** Writable record payload for POST /records/create/ and PATCH update. */
export type RecordInput = {
  title: string;
  artist: number | null;
  description: string | null;
  condition: string;
  genere: number | null;
  cover_image_url: string | null;
  price: number;
  cost_price: number;
  discount_porcentage: number;
  stock: number;
  images: string[];
  release_date: number | null;
  featured: boolean;
  items_inside: number;
  weight_grams: number | null;
  category: number | null;
  /** [] = store stock; one owner gets the whole stock; several must add up to `stock`. */
  owners: { owner: number; quantity?: number }[];
};

/**
 * Compute the effective (discounted) price from `price` and `discount_porcentage`.
 * Always derives from source-of-truth fields so it's resilient to stale `sell_price`.
 */
export function getEffectivePrice(record: Record): {
  original: number;
  effective: number;
  discount: number;
  hasDiscount: boolean;
} {
  const original = Number(record.price) || 0;
  const discount = Number(record.discount_porcentage ?? record.discount_percentage) || 0;
  const effective = discount > 0
    ? Math.round(original * (1 - discount / 100) * 100) / 100
    : original;
  return { original, effective, discount, hasDiscount: discount > 0 };
}

/** Backend CONDITIONS codes (vinyl grading), best first. */
export const RECORD_CONDITIONS = [
  { code: "M", label: "Mint" },
  { code: "NM", label: "Near Mint" },
  { code: "NM-", label: "Near Mint -" },
  { code: "VG+", label: "Very Good +" },
  { code: "VG", label: "Very Good" },
  { code: "G", label: "Good" },
  { code: "F", label: "Fair" },
  { code: "P", label: "Poor" },
] as const;

export type RecordOrdering = "newest" | "price_asc" | "price_desc";

/** Query params shared by /records/ and /search/ (see apply_record_filters). */
export type RecordFilters = {
  page?: number;
  /** Server-side LIMIT (e.g. 5 for search suggestions). */
  page_size?: number;
  available?: boolean;
  category?: string;
  genere?: string;
  artist?: string;
  condition?: string[];
  price_min?: string;
  price_max?: string;
  ordering?: RecordOrdering;
  signal?: AbortSignal;
};

/** GET /artists/<id>/usage/: records pointing at the artist + closest other name. */
export type ArtistUsage = { records_count: number; suggestion: Artist | null };

/** Where the artist's records go when it is deleted (required when in use). */
export type ArtistReassign = { reassign_to: Artist["id"] } | { new_artist_name: string } | { [key: string]: never };

export type ArtistDeleteResult = {
  deleted: Artist["id"];
  reassigned: number;
  reassigned_to: Artist | null;
};

export interface RecordRepository {
  list(params?: RecordFilters): Promise<RecordPage>;
  search(params: RecordFilters & { query: string }): Promise<RecordPage>;
  getRecordById(id: string): Promise<Record>;
  getRecordBySlug(slug: string): Promise<Record>;
  getCategories(): Promise<Category[]>;
  /** Admin catalog options. */
  getGenres(): Promise<Genere[]>;
  searchArtists(query: string): Promise<Artist[]>;
  createArtist(name: string): Promise<Artist>;
  getArtistUsage(id: Artist["id"]): Promise<ArtistUsage>;
  /** Reassignment + delete run in one DB transaction (409 artist_in_use without a target). */
  deleteArtist(id: Artist["id"], reassign: ArtistReassign): Promise<ArtistDeleteResult>;
  getOwners(): Promise<Owner[]>;
  createOwner(input: { name: string; email: string }): Promise<Owner>;
  /** Existing records with the same title (+ artist), ignoring case/accents. */
  findMatches(title: string, artist: string): Promise<Record[]>;
  /** Admin record CRUD. */
  /** Full record for the edit form (private fields included; list rows are partial). */
  getForEdit(id: string | number): Promise<Record>;
  create(input: RecordInput): Promise<Record>;
  update(id: string | number, patch: Partial<RecordInput>): Promise<Record>;
  remove(id: string | number): Promise<{ message?: string }>;
}
