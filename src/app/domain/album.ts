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
}
