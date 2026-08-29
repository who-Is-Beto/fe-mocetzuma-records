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

export interface RecordRepository {
  list(params?: { page?: number; available?: boolean; category?: string }): Promise<RecordPage>;
  search(params: { query: string; page?: number; available?: boolean; category?: string }): Promise<RecordPage>;
  getRecordById(id: string): Promise<Record>;
  getRecordBySlug(slug: string): Promise<Record>;
  getCategories(): Promise<Category[]>;
  /** Admin catalog options. */
  getGenres(): Promise<Genere[]>;
  searchArtists(query: string): Promise<Artist[]>;
  createArtist(name: string): Promise<Artist>;
  /** Admin record CRUD. */
  create(input: RecordInput): Promise<Record>;
  update(id: string | number, patch: Partial<RecordInput>): Promise<Record>;
  remove(id: string | number): Promise<{ message?: string }>;
}
