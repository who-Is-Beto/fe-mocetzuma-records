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
  /** A record can be in several genres (possibly none). */
  generes?: Genere[];
  cost_price?: number | string;
  sell_price?: number | string;
  final_sale_price?: number | string | null;
  weight_grams?: number | null;
  /** Admin responses only: whose units the stock is; empty = store stock. */
  owners?: RecordOwnerStock[];
  /** Set on a copy of another record in a different condition (the group's first record). */
  variant_of?: number | null;
  /** This record and its copies in other conditions, best condition first; [] when it's the only one. */
  copies?: RecordCopy[];
};

/** One copy of a release in the condition picker: its own condition, price and stock. */
export type RecordCopy = {
  id: number;
  slug: string;
  condition: string;
  price: string;
  sell_price: string;
  discount_porcentage: number;
  stock: number;
  cover_image_url?: string | null;
  images?: string[];
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
  /** GET /categories/ only: records using this format. */
  records_count?: number;
}

export type Genere = {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  /** GET /generes/ only: records in this genre. */
  records_count?: number;
};

/** Admin create/edit body for a format or genre. The slug is never sent: it
 * is set once from the first name and kept on rename (URLs, shipping weights). */
export type CatalogTermInput = { name: string; description?: string | null };

/** DELETE /categories/<id>/delete/: where its records were moved. */
export type CategoryDeleteResult = {
  deleted: Category["id"];
  reassigned: number;
  reassigned_to: Category | null;
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
  generes: number[];
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
  /** Another condition of this record (the server links it to the group's first one). */
  variant_of?: number | null;
};

/**
 * Compute the effective (discounted) price from `price` and `discount_porcentage`.
 * Always derives from source-of-truth fields so it's resilient to stale `sell_price`.
 */
export function getEffectivePrice(
  record: Pick<Record, "price" | "discount_porcentage" | "discount_percentage">
): {
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

/** Backend CONDITIONS codes (vinyl grading), best first; `hint` explains it to buyers. */
export const RECORD_CONDITIONS = [
  { code: "M", label: "Mint", hint: "Nuevo, sin abrir o sin tocar." },
  { code: "NM", label: "Near Mint", hint: "Casi nuevo: sin marcas visibles." },
  { code: "NM-", label: "Near Mint -", hint: "Casi nuevo, con mínimas señales de uso." },
  { code: "VG+", label: "Very Good +", hint: "Ligeras marcas de uso; suena muy bien." },
  { code: "VG", label: "Very Good", hint: "Marcas visibles y algo de ruido en los silencios." },
  { code: "G", label: "Good", hint: "Desgaste evidente; se escucha con ruido." },
  { code: "F", label: "Fair", hint: "Muy desgastado; para completar colección." },
  { code: "P", label: "Poor", hint: "Dañado; solo como pieza de colección." },
] as const;

export const conditionInfo = (code: string) => RECORD_CONDITIONS.find((c) => c.code === code);

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
  /** Every copy as its own row (Punto de venta); by default one row per release. */
  all_copies?: boolean;
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
  /** Admin: formats and genres. */
  createCategory(input: CatalogTermInput): Promise<Category>;
  updateCategory(id: Category["id"], input: Partial<CatalogTermInput>): Promise<Category>;
  /** 409 category_in_use when records use it and no `reassign_to` is given. */
  deleteCategory(id: Category["id"], reassignTo?: Category["id"]): Promise<CategoryDeleteResult>;
  createGenre(input: CatalogTermInput): Promise<Genere>;
  updateGenre(id: Genere["id"], input: Partial<CatalogTermInput>): Promise<Genere>;
  /** Its records stay; they only lose this genre. */
  deleteGenre(id: Genere["id"]): Promise<{ deleted: Genere["id"]; records_count: number }>;
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
