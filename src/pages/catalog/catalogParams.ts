import { RECORD_CONDITIONS, type RecordFilters, type RecordOrdering } from "../../app/domain/album";

/**
 * Catalog state lives in the URL so filtered views can be shared/bookmarked:
 * /catalogo?search=&category=&genere=&artist=&condition=NM,VG+&price_min=&price_max=
 *           &available=false&ordering=price_asc&page=2
 */
export type CatalogParams = {
  search: string;
  page: number;
  /** Records per page (PAGE_SIZES); drives the pagination scale. */
  page_size: number;
  /** Default true: only records with stock (`available=false` shows all). */
  available: boolean;
  category: string;
  genere: string;
  artist: string;
  condition: string[];
  price_min: string;
  price_max: string;
  ordering: RecordOrdering;
};

const ORDERINGS: RecordOrdering[] = ["newest", "price_asc", "price_desc"];

/** Multiples of 2 and 3, so the 2/3-column grid always ends on a full row. */
export const PAGE_SIZES = [12, 24, 48] as const;
export const DEFAULT_PAGE_SIZE = 24;
const PAGE_SIZE_KEY = "moctezuma-catalog-page-size";

/** The viewer's last choice (per browser); storage can be blocked, so guard it. */
export const storedPageSize = (): number => {
  try {
    const n = Number(localStorage.getItem(PAGE_SIZE_KEY));
    return (PAGE_SIZES as readonly number[]).includes(n) ? n : DEFAULT_PAGE_SIZE;
  } catch {
    return DEFAULT_PAGE_SIZE;
  }
};
export const rememberPageSize = (n: number) => {
  try {
    localStorage.setItem(PAGE_SIZE_KEY, String(n));
  } catch {
    /* private mode: the URL still carries it */
  }
};
const CONDITION_CODES = new Set<string>(RECORD_CONDITIONS.map((c) => c.code));

export const ORDERING_LABELS: { [K in RecordOrdering]: string } = {
  newest: "Más recientes",
  price_asc: "Precio: menor a mayor",
  price_desc: "Precio: mayor a menor",
};

const cleanPrice = (value: string | null) => {
  const n = Number((value ?? "").replace(",", "."));
  return value && Number.isFinite(n) && n >= 0 ? String(n) : "";
};

export function parseCatalogParams(sp: URLSearchParams, fallbackPageSize = DEFAULT_PAGE_SIZE): CatalogParams {
  const page = Math.floor(Number(sp.get("page")));
  const pageSize = Number(sp.get("page_size"));
  const ordering = sp.get("ordering") as RecordOrdering;
  return {
    search: (sp.get("search") ?? "").trim(),
    page: page > 0 ? page : 1,
    page_size: (PAGE_SIZES as readonly number[]).includes(pageSize) ? pageSize : fallbackPageSize,
    available: sp.get("available") !== "false",
    category: (sp.get("category") ?? "").trim(),
    genere: (sp.get("genere") ?? "").trim(),
    artist: (sp.get("artist") ?? "").trim(),
    condition: (sp.get("condition") ?? "").split(",").filter((c) => CONDITION_CODES.has(c)),
    price_min: cleanPrice(sp.get("price_min")),
    price_max: cleanPrice(sp.get("price_max")),
    ordering: ORDERINGS.includes(ordering) ? ordering : "newest",
  };
}

export type FilterPatch = Partial<Omit<CatalogParams, "page" | "search">>;

/** Apply a filter change to the URL; any filter change restarts at page 1. */
export function withFilters(sp: URLSearchParams, patch: FilterPatch): URLSearchParams {
  const next = new URLSearchParams(sp);
  Object.entries(patch).forEach(([key, value]) => {
    if (key === "available") {
      if (value) next.delete("available"); // default
      else next.set("available", "false");
    } else if (key === "ordering" && value === "newest") {
      next.delete("ordering"); // default
    } else if (key === "page_size") {
      next.set("page_size", String(value));
    } else if (Array.isArray(value)) {
      if (value.length) next.set(key, value.join(","));
      else next.delete(key);
    } else if (value) {
      next.set(key, String(value));
    } else {
      next.delete(key);
    }
  });
  next.delete("page");
  return next;
}

/** "Limpiar todo": drop the filters, keep the search box and the page size. */
export function clearedFilters(sp: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams();
  for (const key of ["search", "page_size"]) {
    const value = sp.get(key);
    if (value) next.set(key, value);
  }
  return next;
}

/** How many filters differ from the defaults (badge on the mobile button). */
export function activeFilterCount(p: CatalogParams): number {
  return (
    Number(Boolean(p.category)) +
    Number(Boolean(p.genere)) +
    Number(Boolean(p.artist)) +
    p.condition.length +
    Number(Boolean(p.price_min || p.price_max))
  );
}

export function toRecordFilters(p: CatalogParams): RecordFilters {
  return {
    page: p.page,
    page_size: p.page_size,
    // The backend only filters when `available` is truthy; omit for "all".
    available: p.available || undefined,
    category: p.category || undefined,
    genere: p.genere || undefined,
    artist: p.artist || undefined,
    condition: p.condition,
    price_min: p.price_min || undefined,
    price_max: p.price_max || undefined,
    ordering: p.ordering === "newest" ? undefined : p.ordering,
  };
}

/** "pink-floyd" -> "Pink Floyd" when no loaded record carries the real name. */
export const nameFromSlug = (slug: string) =>
  slug.replace(/-\d+$/, "").split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
