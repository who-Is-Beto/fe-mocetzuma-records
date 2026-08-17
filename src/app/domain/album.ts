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
  description?: string;
  cover_image_url?: string;
  slug: string;
  stock: number;
  release_date?: string | number;
  featured?: boolean;
  items_inside?: number;
  genere?: string | number | { id?: string | number; name?: string; slug?: string };
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

export interface RecordRepository {
  list(params?: { page?: number; available?: boolean; category?: string }): Promise<RecordPage>;
  search(params: { query: string; page?: number; available?: boolean; category?: string }): Promise<RecordPage>;
  getRecordById(id: string): Promise<Record>;
  getRecordBySlug(slug: string): Promise<Record>;
  getCategories(): Promise<Category[]>;
}
