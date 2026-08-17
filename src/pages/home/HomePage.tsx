import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";
import { Loader } from "../../components/Loader";
import type { RecordPage, Record as RecordItem } from "../../app/domain/album";
import { useServiceQuery } from "../../app/hooks";
import { createRecordService } from "../../app/services/recordService";
import type { Category } from "../../app/domain/album";
import { usePageTitle } from "../../app/hooks/usePageTitle";
// optional: import { useAuth } from "../../app/providers/AuthProvider";

export const HomePage = () => {
  usePageTitle("Catálogo");
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
  const lastSearchRef = useRef(searchValue);
  const cacheRef = useRef(new Map<string, RecordPage>());

  const normalizeResponse = (
    payload: RecordPage | RecordItem[] | undefined
  ): RecordPage => {
    if (!payload) return { count: 0, next: null, previous: null, results: [] };
    if (Array.isArray(payload)) {
      return {
        count: payload.length,
        next: null,
        previous: null,
        results: payload
      };
    }
    // Some endpoints might return { results: [...] } without count
    return {
      count: payload.count ?? payload.results?.length ?? 0,
      next: payload.next ?? null,
      previous: payload.previous ?? null,
      results: payload.results ?? []
    };
  };

  useEffect(() => {
    const urlPage = parsePage(searchParams);
    if (urlPage !== page) {
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
        setPage(1);
      }
    }
  }, [availableOnly]);
  const recordService = useMemo(
    () =>
      createRecordService({
        // getToken: () => token ?? null,
      }),
    []
    // include `token` in deps if you wire auth: [token]
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
    } catch (_err) {
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-2xl text-denim">Catálogo</h1>

        <button
          type="button"
          onClick={toggleAvailable}
          className="group flex items-center gap-2.5 self-start"
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

      {/* Category filter chips */}
      {categories.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCategory("")}
            className={`rounded-pill border px-3 py-1 text-xs font-semibold shadow-sm transition hover:-translate-y-0.5 ${
              !categorySlug
                ? "border-orange bg-orange text-charcoal"
                : "border-navy/10 bg-white/80 text-navy hover:border-orange hover:text-orange"
            }`}
          >
            Todos
          </button>
          {categories.map((cat) => (
            <button
              key={cat.slug}
              type="button"
              onClick={() => setCategory(cat.slug)}
              className={`rounded-pill border px-3 py-1 text-xs font-semibold shadow-sm transition hover:-translate-y-0.5 ${
                categorySlug === cat.slug
                  ? "border-orange bg-orange text-charcoal"
                  : "border-navy/10 bg-white/80 text-navy hover:border-orange hover:text-orange"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(data?.results ?? []).map((record) => (
          <Card key={record.id} record={record} />
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
    let windowStart = Math.max(2, page - 2);
    let windowEnd = Math.min(totalPages - 1, page + 2);

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

