import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";
import { Loader } from "../../components/Loader";
import type { RecordPage } from "../../app/domain/album";
import { useServiceQuery } from "../../app/hooks";
import { createRecordService } from "../../app/services/recordService";
import { useAuth } from "../../app/providers/AuthProvider";
import type { Category } from "../../app/domain/album";
import { useSeo } from "../../app/hooks/useSeo";

// Little per-format icon for the filter chips (slug-based, resilient to
// future categories via sensible fallbacks).
const categoryIcon = (slug: string): string => {
  if (slug.includes("boxset")) return "📦";
  if (slug.includes("-") || slug.includes("dvd")) return "🎁";
  switch (slug) {
    case "lp":
      return "💿";
    case "cd":
      return "📀";
    case "7":
    case "10":
      return "🔘";
    case "12":
      return "💿";
    default:
      return "🎵";
  }
};

/**
 * Full catalog listing — same behavior the homepage used to have
 * (search/category/availability via URL params + numbered pagination).
 * Lives at /catalogo/ so the landing can be a proper storefront.
 */
export const CatalogoPage = () => {
  useSeo({
    title: "Catálogo",
    description:
      "Todo el inventario de Moctezuma Records: LPs, CDs, sencillos y box sets de vinilo nuevos y usados, con gradación honesta. Busca por género, artista o formato."
  });
  const [searchParams, setSearchParams] = useSearchParams();
  const parsePage = useCallback((params: URLSearchParams) => {
    const raw = Number(params.get("page"));
    return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 1;
  }, []);

  const [page, setPage] = useState(() => parsePage(searchParams));
  const searchValue = (searchParams.get("search") ?? "").trim();
  const availableOnly = searchParams.get("available") !== "false"; // default true
  const categorySlug = (searchParams.get("category") ?? "").trim();
  const [categories, setCategories] = useState<Category[]>([]);
  const activeCategoryName = categories.find((c) => c.slug === categorySlug)?.name;
  const lastSearchRef = useRef(searchValue);
  const cacheRef = useRef(new Map<string, RecordPage>());

  // Both /records/ and /search/ return the same paginated envelope, so no
  // response reshaping is needed — just guard the pre-fetch undefined.
  const normalizeResponse = (payload?: RecordPage): RecordPage =>
    payload ?? { count: 0, next: null, previous: null, results: [] };

  useEffect(() => {
    const urlPage = parsePage(searchParams);
    if (urlPage !== page) {
      // URL is the source of truth; mirroring it into local state is an
      // intentional one-way sync bridge (back/forward navigation).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPage(urlPage);
    }
  }, [searchParams]);

  useEffect(() => {
    const current = parsePage(searchParams);
    if (current !== page) {
      const next = new URLSearchParams(searchParams);
      next.set("page", String(page));
      setSearchParams(next, { replace: true });
    }
  }, [page]);

  useEffect(() => {
    if (searchValue !== lastSearchRef.current) {
      lastSearchRef.current = searchValue;
      cacheRef.current = new Map();
      if (page !== 1) {
        // A new query must start on page 1; this reset is an intentional
        // state adjustment triggered by an external (URL) change.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPage(1);
      }
    }
  }, [searchValue]);

  // Reset page when category changes
  const lastCategoryRef = useRef(categorySlug);
  useEffect(() => {
    if (categorySlug !== lastCategoryRef.current) {
      lastCategoryRef.current = categorySlug;
      cacheRef.current = new Map();
      if (page !== 1) {
        // A new category must start on page 1 (see comment above).
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPage(1);
      }
    }
  }, [categorySlug]);

  // Reset page when toggle changes
  const lastAvailableRef = useRef(availableOnly);
  useEffect(() => {
    if (availableOnly !== lastAvailableRef.current) {
      lastAvailableRef.current = availableOnly;
      cacheRef.current = new Map();
      if (page !== 1) {
        // Toggling availability must start on page 1 (see comment above).
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPage(1);
      }
    }
  }, [availableOnly]);
  const { token } = useAuth();
  const recordService = useMemo(
    () =>
      createRecordService({
        // Public endpoint, but the token lets the maintenance middleware tell
        // an admin (full access) from a customer (503 while the window is open).
        getToken: () => token ?? null,
      }),
    [token]
  );

  // Fetch categories once
  useEffect(() => {
    recordService.getCategories().then(setCategories).catch(() => {});
  }, [recordService]);

  const fetchRecords = useCallback(async () => {
    const cacheKey = `${searchValue || "all"}::${page}::${availableOnly}::${categorySlug || "all"}`;
    const cached = cacheRef.current.get(cacheKey);
    if (cached) return cached;

    try {
      const response = searchValue
        ? await recordService.search({ query: searchValue, page, available: availableOnly || undefined, category: categorySlug || undefined })
        : await recordService.list({ page, available: availableOnly || undefined, category: categorySlug || undefined });
      const normalized = normalizeResponse(response);
      cacheRef.current.set(cacheKey, normalized);
      return normalized;
    } catch {
      return { count: 0, next: null, previous: null, results: [] };
    }
  }, [recordService, page, searchValue, availableOnly, categorySlug]);

  const { data, error, isLoading, isError } = useServiceQuery<RecordPage>(
    [recordService, page, searchValue, availableOnly, categorySlug],
    fetchRecords
  );

  if (isLoading)
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader />
      </div>
    );
  if (isError)
    return (
      <p>
        Failed to load:{" "}
        {error instanceof Error ? error.message : "Unknown error"}
      </p>
    );

  const toggleAvailable = () => {
    const next = new URLSearchParams(searchParams);
    if (availableOnly) {
      next.set("available", "false");
    } else {
      next.delete("available"); // default is true, so removing = true
    }
    next.set("page", "1");
    setSearchParams(next, { replace: true });
  };

  const setCategory = (slug: string) => {
    const next = new URLSearchParams(searchParams);
    if (slug) {
      next.set("category", slug);
    } else {
      next.delete("category");
    }
    next.set("page", "1");
    setSearchParams(next, { replace: true });
  };

  return (
    <section className="space-y-4">
      <h1 className="font-display text-2xl text-denim">Catálogo</h1>

      {/* ── Filter bar ── */}
      <div className="rounded-2xl border border-navy/10 bg-cream/80 p-3 shadow-card backdrop-blur sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-navy/50">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="h-3.5 w-3.5 text-orange"
            >
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
            Filtros
            {categorySlug ? (
              <button
                type="button"
                onClick={() => setCategory("")}
                className="ml-1 inline-flex items-center gap-1 rounded-full bg-coral/10 px-2 py-0.5 text-[10px] font-bold normal-case tracking-normal text-coral transition hover:bg-coral/20"
                aria-label="Quitar filtro de categoría"
              >
                ✕ {activeCategoryName}
              </button>
            ) : null}
          </p>

          <button
            type="button"
            onClick={toggleAvailable}
            className="group flex items-center gap-2.5"
            aria-label={availableOnly ? "Mostrar todos los discos" : "Mostrar solo discos disponibles"}
          >
            {/* Toggle track */}
            <span
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-navy/10 shadow-inner transition-colors duration-200 ${
                availableOnly ? "bg-orange" : "bg-navy/15"
              }`}
            >
              {/* Toggle thumb */}
              <span
                className={`inline-block h-4 w-4 rounded-full bg-cream shadow-sm transition-transform duration-200 ${
                  availableOnly ? "translate-x-[22px]" : "translate-x-[3px]"
                }`}
              />
            </span>
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-navy/70 transition group-hover:text-navy">
              Solo disponibles
            </span>
          </button>
        </div>

        {/* Category chips — single scrollable row on narrow screens */}
        {categories.length > 0 ? (
          <div className="-mx-1 mt-3 p-1 overflow-x-auto px-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex w-max gap-2 sm:w-auto sm:flex-wrap">
              <button
                type="button"
                onClick={() => setCategory("")}
                className={`flex shrink-0 items-center gap-1.5 rounded-pill border px-3.5 py-1.5 text-xs font-semibold transition ${
                  !categorySlug
                    ? "-translate-y-0.5 border-transparent bg-gradient-to-r from-orange to-amber text-charcoal shadow-panel ring-2 ring-orange/30"
                    : "border-navy/10 bg-white/80 text-navy hover:-translate-y-0.5 hover:border-orange/40 hover:text-orange"
                }`}
              >
                🎶 Todos
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.slug}
                  type="button"
                  onClick={() => setCategory(cat.slug)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-pill border px-3.5 py-1.5 text-xs font-semibold transition ${
                    categorySlug === cat.slug
                      ? "-translate-y-0.5 border-transparent bg-gradient-to-r from-orange to-amber text-charcoal shadow-panel ring-2 ring-orange/30"
                      : "border-navy/10 bg-white/80 text-navy hover:-translate-y-0.5 hover:border-orange/40 hover:text-orange"
                  }`}
                >
                  <span aria-hidden="true">{categoryIcon(cat.slug)}</span>
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(data?.results ?? []).map((record, index) => (
          <Card
            key={record.id}
            record={record}
            // First grid row is above the fold: load covers eagerly (LCP).
            priority={index < 3}
          />
        ))}
      </div>

      {data?.results?.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-2xl border border-navy/10 bg-cream/80 px-4 py-3 shadow-card sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-display text-lg text-denim">
              {searchValue ? "Disco no encontrado" : "Sin resultados"}
            </p>
            <p className="text-sm text-navy/70">
              {searchValue
                ? "No encontramos coincidencias para tu búsqueda."
                : "No hay discos que coincidan con estos filtros. Intenta con otros criterios."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {searchValue ? (
              <Button
                tone="outline"
                onClick={() =>
                  window.open(
                    "https://www.instagram.com/moctezuma_records/",
                    "_blank"
                  )
                }
                className="text-sm rounded-md"
              >
                Contáctame en Instagram para encargarlo
              </Button>
            ) : null}
            <Button
              tone="navy"
              onClick={() => {
                const next = new URLSearchParams(searchParams);
                next.delete("search");
                next.delete("category");
                next.delete("available");
                next.set("page", "1");
                setSearchParams(next, { replace: true });
              }}
              className="text-sm rounded-md"
            >
              Limpiar filtros
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-2 rounded-2xl border border-navy/10 bg-cream/80 px-4 py-3 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-navy/70">
          {data?.count ? (
            <>
              <span className="font-semibold text-denim">{data.count}</span>
              {" "}registros
            </>
          ) : null}
        </div>
        <Pagination
          page={page}
          totalPages={
            data?.count
              ? Math.max(1, Math.ceil(data.count / Math.max(1, data.results?.length ?? 1)))
              : 1
          }
          hasPrevious={!!data?.previous}
          hasNext={!!data?.next}
          onPageChange={setPage}
        />
      </div>
    </section>
  );
};

/** Numbered page navigation — shows up to 5 pages, always keeps first/last + arrows */
function Pagination({
  page,
  totalPages,
  hasPrevious,
  hasNext,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
  onPageChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;

  // Build visible page numbers: always show 1, last, and up to 5 around current
  const pages: (number | "...")[] = [];
  const maxVisible = 5;

  if (totalPages <= maxVisible + 2) {
    // Few pages total — show them all
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    // Always include page 1
    pages.push(1);

    // Calculate the window of pages around the current page
    const windowStart = Math.max(2, page - 2);
    const windowEnd = Math.min(totalPages - 1, page + 2);

    // Adjust window if it's too small or shifted
    if (windowStart > 2) pages.push("...");
    if (windowEnd < totalPages - 1) {
      // We'll add trailing "..." after the window
    }

    for (let i = windowStart; i <= windowEnd; i++) pages.push(i);

    if (windowEnd < totalPages - 1) pages.push("...");

    // Always include the last page
    pages.push(totalPages);
  }

  const btnClass = (p: number) =>
    `h-8 min-w-[2rem] rounded-pill border px-2.5 text-xs font-semibold shadow-sm transition hover:-translate-y-0.5 ${
      p === page
        ? "border-orange bg-orange text-charcoal"
        : "border-navy/10 bg-white/80 text-navy hover:border-orange hover:text-orange"
    }`;

  return (
    <nav className="flex items-center gap-1" aria-label="Paginación">
      <Button
        tone="outline"
        className="h-8 px-2.5 text-xs"
        onClick={() => onPageChange(Math.max(1, page - 1))}
        disabled={!hasPrevious}
        aria-label="Página anterior"
      >
        ←
      </Button>

      {pages.map((p, idx) =>
        p === "..." ? (
          <span
            key={`ellipsis-${idx}`}
            className="px-1.5 text-sm text-navy/40 select-none"
          >
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onPageChange(p)}
            aria-current={p === page ? "page" : undefined}
            className={btnClass(p)}
          >
            {p}
          </button>
        )
      )}

      <Button
        tone="navy"
        className="h-8 px-2.5 text-xs"
        onClick={() => onPageChange(page + 1)}
        disabled={!hasNext}
        aria-label="Página siguiente"
      >
        →
      </Button>
    </nav>
  );
}
