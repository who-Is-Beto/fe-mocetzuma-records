import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";
import { Loader } from "../../components/Loader";
import { Modal } from "../../components/Modal";
import type { Artist, Category, Genere, RecordPage } from "../../app/domain/album";
import { useServiceQuery } from "../../app/hooks";
import { createRecordService } from "../../app/services/recordService";
import { useAuth } from "../../app/providers/AuthProvider";
import { useSeo } from "../../app/hooks/useSeo";
import { ActiveFilterChips, AvailabilitySwitch, CatalogFilterPanel, SortSelect } from "./CatalogFilters";
import {
  activeFilterCount,
  clearedFilters,
  nameFromSlug,
  parseCatalogParams,
  rememberPageSize,
  storedPageSize,
  toRecordFilters,
  withFilters,
  type FilterPatch,
} from "./catalogParams";

const EMPTY_PAGE: RecordPage = { count: 0, next: null, previous: null, results: [] };

/**
 * Full catalog listing. Every filter lives in the URL (see catalogParams.ts),
 * so filtered views — including an artist's page, /catalogo?artist=<slug> —
 * can be shared and bookmarked. Filtering and pagination run in the database
 * (/records/ and /search/ share apply_record_filters on the backend).
 */
export const CatalogoPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  // No ?page_size= → the viewer's last choice (localStorage), else 24.
  const [fallbackPageSize] = useState(storedPageSize);
  const params = useMemo(
    () => parseCatalogParams(searchParams, fallbackPageSize),
    [searchParams, fallbackPageSize]
  );
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

  const [categories, setCategories] = useState<Category[]>([]);
  const [genres, setGenres] = useState<Genere[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Name of an artist picked in the filter (the URL only has the slug).
  const [pickedArtist, setPickedArtist] = useState<Artist | null>(null);

  // Facet options, once.
  useEffect(() => {
    recordService.getCategories().then(setCategories).catch(() => {});
    recordService.getGenres().then(setGenres).catch(() => {});
  }, [recordService]);

  // Pages already seen this visit (Back/Forward and chip toggles are instant).
  // Keyed by the whole query string, so every filter combination is distinct.
  const cacheRef = useRef(new Map<string, RecordPage>());
  const queryKey = searchParams.toString();

  const fetchRecords = useCallback(async () => {
    const cached = cacheRef.current.get(queryKey);
    if (cached) return cached;
    try {
      const filters = toRecordFilters(params);
      const response = params.search
        ? await recordService.search({ query: params.search, ...filters })
        : await recordService.list(filters);
      const page = response ?? EMPTY_PAGE;
      cacheRef.current.set(queryKey, page);
      return page;
    } catch {
      return EMPTY_PAGE;
    }
  }, [recordService, queryKey, params]);

  const { data, isLoading } = useServiceQuery<RecordPage>([recordService, queryKey], fetchRecords);

  const artistName = params.artist
    ? (pickedArtist?.slug === params.artist && pickedArtist.name) ||
      data?.results.find((r) => r.artist?.slug === params.artist)?.artist.name ||
      nameFromSlug(params.artist)
    : "";

  useSeo({
    title: params.artist ? `${artistName} — discos` : "Catálogo",
    description: params.artist
      ? `Discos de ${artistName} en Moctezuma Records: vinilos, CDs y más, nuevos y usados, con envíos a todo México.`
      : "Todo el inventario de Moctezuma Records: LPs, CDs, sencillos y box sets de vinilo nuevos y usados, con gradación honesta. Busca por género, artista o formato."
  });

  const applyFilters = (patch: FilterPatch) => {
    if (patch.page_size) rememberPageSize(patch.page_size);
    setSearchParams(withFilters(searchParams, patch), { replace: true });
  };
  const clearAll = () => setSearchParams(clearedFilters(searchParams), { replace: true });
  const setPage = (page: number) => {
    const next = new URLSearchParams(searchParams);
    if (page > 1) next.set("page", String(page));
    else next.delete("page");
    setSearchParams(next); // push: Back returns to the previous page
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const filterCount = activeFilterCount(params);
  const panel = (
    <CatalogFilterPanel
      params={params}
      categories={categories}
      genres={genres}
      artistName={artistName}
      recordService={recordService}
      onChange={applyFilters}
      onArtistPicked={setPickedArtist}
    />
  );
  const results = data?.results ?? [];
  const firstLoad = isLoading && !data;

  return (
    <section className="space-y-4">
      {params.artist ? (
        <header>
          <p className="text-xs uppercase tracking-[0.16em] text-orange">Artista</p>
          <h1 className="font-display text-2xl text-denim sm:text-3xl">{artistName}</h1>
        </header>
      ) : (
        <h1 className="font-display text-2xl text-denim">
          {params.search ? `Resultados para “${params.search}”` : "Catálogo"}
        </h1>
      )}

      <div className="lg:grid lg:grid-cols-[260px,1fr] lg:items-start lg:gap-6">
        {/* Desktop sidebar */}
        <aside
          aria-label="Filtros"
          className="hidden rounded-2xl border border-navy/10 bg-cream/80 p-4 shadow-card backdrop-blur lg:sticky lg:top-4 lg:block lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto"
        >
          <h2 className="mb-4 font-display text-lg text-denim">Filtros</h2>
          {panel}
        </aside>

        <div className="min-w-0 space-y-4">
          {/* Toolbar: filters button (mobile), availability switch, sort.
              Wraps on narrow phones: sort drops to its own full-width row. */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              className="flex min-h-[44px] items-center gap-2 rounded-pill border border-navy/10 bg-cream/80 px-4 text-sm font-semibold text-navy shadow-card lg:hidden"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-4 w-4 text-orange">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
              Filtros
              {filterCount > 0 && (
                <span className="rounded-full bg-orange px-2 text-xs text-charcoal">{filterCount}</span>
              )}
            </button>
            <AvailabilitySwitch checked={params.available} onChange={(available) => applyFilters({ available })} />
            <SortSelect
              value={params.ordering}
              onChange={(ordering) => applyFilters({ ordering })}
              className="w-full sm:ml-auto sm:w-60"
            />
          </div>

          <ActiveFilterChips
            params={params}
            categories={categories}
            genres={genres}
            artistName={artistName}
            count={data ? data.count : null}
            onChange={applyFilters}
            onClearAll={clearAll}
          />

          {firstLoad ? (
            <div className="flex min-h-[40vh] items-center justify-center">
              <Loader />
            </div>
          ) : (
            <div
              aria-busy={isLoading}
              className={`grid gap-4 sm:grid-cols-2 xl:grid-cols-3 transition-opacity ${isLoading ? "opacity-50" : ""}`}
            >
              {results.map((record, index) => (
                <Card
                  key={record.id}
                  record={record}
                  // First grid row is above the fold: load covers eagerly (LCP).
                  priority={index < 3}
                />
              ))}
            </div>
          )}

          {data && results.length === 0 && !isLoading ? (
            <div className="flex flex-col items-start gap-3 rounded-2xl border border-navy/10 bg-cream/80 px-4 py-3 shadow-card sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-display text-lg text-denim">
                  {params.search ? "Disco no encontrado" : "Sin resultados"}
                </p>
                <p className="text-sm text-navy/70">
                  {params.search
                    ? "No encontramos coincidencias para tu búsqueda."
                    : "No hay discos que coincidan con estos filtros. Intenta con otros criterios."}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {params.search ? (
                  <Button
                    tone="outline"
                    onClick={() => window.open("https://www.instagram.com/moctezuma_records/", "_blank")}
                    className="text-sm rounded-md"
                  >
                    Contáctame en Instagram para encargarlo
                  </Button>
                ) : null}
                <Button tone="navy" onClick={() => setSearchParams(new URLSearchParams(), { replace: true })} className="text-sm rounded-md">
                  Limpiar filtros
                </Button>
              </div>
            </div>
          ) : null}

          {data && data.count > 0 ? (
            <div className="flex flex-col gap-2 rounded-2xl border border-navy/10 bg-cream/80 px-4 py-3 shadow-card sm:flex-row sm:items-center sm:justify-end">
              <Pagination
                page={params.page}
                totalPages={Math.max(1, Math.ceil(data.count / params.page_size))}
                hasPrevious={!!data.previous}
                hasNext={!!data.next}
                onPageChange={setPage}
              />
            </div>
          ) : null}
        </div>
      </div>

      {/* Mobile: filters in a bottom sheet; results update live behind it */}
      <Modal open={filtersOpen} onClose={() => setFiltersOpen(false)} labelledBy="catalog-filters-title" variant="sheet">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="catalog-filters-title" className="font-display text-lg text-denim">
            Filtros
          </h2>
          {filterCount > 0 && (
            <button type="button" onClick={clearAll} className="min-h-[44px] px-2 text-sm font-semibold text-denim underline underline-offset-4">
              Limpiar todo
            </button>
          )}
        </div>
        {panel}
        <Button tone="orange" className="sticky bottom-0 mt-6 min-h-[48px] w-full" onClick={() => setFiltersOpen(false)}>
          {data ? `Ver ${data.count} ${data.count === 1 ? "disco" : "discos"}` : "Ver resultados"}
        </Button>
      </Modal>
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
    `h-10 min-w-[2.5rem] rounded-pill border px-2.5 text-xs font-semibold shadow-sm transition hover:-translate-y-0.5 ${
      p === page
        ? "border-orange bg-orange text-charcoal"
        : "border-navy/10 bg-white/80 text-navy hover:border-orange hover:text-orange"
    }`;

  return (
    <nav className="flex flex-wrap items-center gap-1" aria-label="Paginación">
      <Button
        tone="outline"
        className="h-10 px-3 text-xs"
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
        className="h-10 px-3 text-xs"
        onClick={() => onPageChange(page + 1)}
        disabled={!hasNext}
        aria-label="Página siguiente"
      >
        →
      </Button>
    </nav>
  );
}
