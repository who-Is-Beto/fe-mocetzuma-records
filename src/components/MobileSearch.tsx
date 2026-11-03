import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode, type RefObject, type TouchEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Img } from "./Img";
import { Skeleton } from "./Skeleton";
import type { Genere, Record } from "../app/domain/album";
import { getEffectivePrice } from "../app/domain/album";
import { canUseOptionalStorage } from "../app/lib/consent";
import { currency } from "../app/lib/format";
import { useAuth } from "../app/providers/AuthProvider";
import { SUGGESTION_MIN_CHARS, useRecordSuggestions } from "../app/hooks/useRecordSuggestions";
import { createRecordService } from "../app/services/recordService";

const RECENT_KEY = "moctezuma-recent-searches";
const RECENT_MAX = 6;
const GENRE_CHIPS = 10;

// Recent searches are a convenience: kept only with cookie consent.
function readRecent(): string[] {
  if (!canUseOptionalStorage()) return [];
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((t): t is string => typeof t === "string").slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

function writeRecent(terms: string[]) {
  if (!canUseOptionalStorage()) return;
  try {
    if (terms.length) localStorage.setItem(RECENT_KEY, JSON.stringify(terms));
    else localStorage.removeItem(RECENT_KEY);
  } catch {
    /* storage full or blocked: recents are optional */
  }
}

/** Bolds the part of `text` that matches the query (case-insensitive). */
function Highlight({ text, query }: { text: string; query: string }) {
  const at = text.toLowerCase().indexOf(query.trim().toLowerCase());
  if (!query.trim() || at < 0) return <>{text}</>;
  const end = at + query.trim().length;
  return (
    <>
      {text.slice(0, at)}
      <mark className="rounded-[3px] bg-sun/60 text-navy">{text.slice(at, end)}</mark>
      {text.slice(end)}
    </>
  );
}

function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2.5 flex items-center justify-between gap-3">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-navy/60">{children}</h3>
      {action}
    </div>
  );
}

type MobileSearchProps = {
  open: boolean;
  onClose: () => void;
  value: string;
  onChange: (value: string) => void;
  /** Runs the catalog search for `term`. */
  onSubmit: (term: string) => void;
  onPickSuggestion: (record: Record) => void;
  includeUnavailable: boolean;
  /** The navbar focuses it inside the tap, so phones open the keyboard. */
  inputRef: RefObject<HTMLInputElement | null>;
};

/**
 * Search for phones and tablets: a panel dropping from the top over the
 * blurred page. Recent searches and genre shortcuts before typing, then live
 * results with cover, price and stock. Tapping or swiping the page behind
 * closes it; scrolling the results tucks the keyboard away. Stays mounted
 * (inert while closed) so the navbar can focus the input in the same tap
 * that opens it.
 */
export function MobileSearch({
  open,
  onClose,
  value,
  onChange,
  onSubmit,
  onPickSuggestion,
  includeUnavailable,
  inputRef
}: MobileSearchProps) {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [recent, setRecent] = useState<string[]>([]);
  const [genres, setGenres] = useState<Genere[] | null>(null);
  const [wasOpen, setWasOpen] = useState(false);
  const recordService = useMemo(() => createRecordService({ getToken: () => token }), [token]);
  // Height left above the on-screen keyboard: the panel never hides under it.
  const [viewportHeight, setViewportHeight] = useState(() => (typeof window === "undefined" ? 800 : window.innerHeight));
  const touchStartY = useRef<number | null>(null);

  // Refresh recents each time the search opens (render-time sync, no effect).
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setRecent(readRecent());
  }

  const query = value.trim();
  const typing = query.length >= SUGGESTION_MIN_CHARS;
  const suggestions = useRecordSuggestions(open ? value : "", token, includeUnavailable);

  // Genre shortcuts: fetched once, on the first open.
  useEffect(() => {
    if (!open || genres !== null) return;
    let cancelled = false;
    recordService
      .getGenres()
      .then((list) => {
        if (cancelled) return;
        const withRecords = list.filter((g) => (g.records_count ?? 1) > 0);
        withRecords.sort((a, b) => (b.records_count ?? 0) - (a.records_count ?? 0));
        setGenres(withRecords.slice(0, GENRE_CHIPS));
      })
      .catch(() => !cancelled && setGenres([]));
    return () => {
      cancelled = true;
    };
  }, [open, genres, recordService]);

  // Lock the page behind it and close on Escape.
  useEffect(() => {
    if (!open) return;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const viewport = window.visualViewport;
    const fit = () => setViewportHeight(viewport?.height ?? window.innerHeight);
    fit();
    viewport?.addEventListener("resize", fit);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", onKey);
      viewport?.removeEventListener("resize", fit);
    };
  }, [open, onClose]);

  const remember = (term: string) => {
    const next = [term, ...recent.filter((t) => t.toLowerCase() !== term.toLowerCase())].slice(0, RECENT_MAX);
    setRecent(next);
    writeRecent(next);
  };

  const search = (term: string) => {
    const clean = term.trim();
    if (clean) remember(clean);
    onChange(clean);
    onSubmit(clean);
    onClose();
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    search(value);
  };

  const pick = (record: Record) => {
    if (query) remember(query);
    onPickSuggestion(record);
    onClose();
  };

  const forget = (term: string) => {
    const next = recent.filter((t) => t !== term);
    setRecent(next);
    writeRecent(next);
  };

  const rowClass =
    "flex min-h-[48px] w-full items-center gap-3 rounded-xl px-2 text-left text-sm font-semibold text-navy transition active:bg-sun/40 hover:bg-sun/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange";

  // A swipe on the blurred page reads as "I want the page back": close.
  const backdropGestures = {
    onClick: onClose,
    onTouchStart: (event: TouchEvent) => {
      touchStartY.current = event.touches[0]?.clientY ?? null;
    },
    onTouchMove: (event: TouchEvent) => {
      const start = touchStartY.current;
      if (start !== null && Math.abs((event.touches[0]?.clientY ?? start) - start) > 8) {
        touchStartY.current = null;
        onClose();
      }
    },
    onWheel: onClose
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Buscar en el catálogo"
      inert={!open}
      className={`fixed inset-0 z-40 lg:hidden ${open ? "" : "pointer-events-none"}`}
    >
      <div
        aria-hidden="true"
        {...backdropGestures}
        className={`absolute inset-0 touch-none bg-navy/25 backdrop-blur-md transition-opacity duration-300 ease-out ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />

      <div
        style={{ maxHeight: `calc(${viewportHeight}px - max(0.75rem, env(safe-area-inset-top)) - 0.75rem)` }}
        className={`relative mx-auto mt-[max(0.75rem,env(safe-area-inset-top))] flex w-[calc(100%-1.5rem)] max-w-2xl origin-top flex-col overflow-hidden rounded-[24px] border border-navy/10 bg-sand shadow-panel transition duration-300 ease-out ${
          open ? "translate-y-0 scale-100 opacity-100" : "-translate-y-3 scale-[0.98] opacity-0"
        }`}
      >
      {/* Search field */}
      <div className="border-b border-navy/10 px-3 py-3">
        <div className="flex items-center gap-2">
          <form role="search" onSubmit={handleSubmit} className="relative min-w-0 flex-1">
            <span aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-base">🔎</span>
            <input
              ref={inputRef}
              type="search"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              enterKeyHint="search"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              aria-label="Buscar disco o artista"
              placeholder="Disco, artista o género…"
              // text-base (16px): iOS zooms the page into smaller inputs.
              className="h-12 w-full rounded-2xl border border-navy/15 bg-cream pl-11 pr-11 text-base text-navy shadow-inner outline-none transition placeholder:text-navy/45 focus:border-orange focus:ring-4 focus:ring-orange/15 [&::-webkit-search-cancel-button]:hidden"
            />
            {value ? (
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  inputRef.current?.focus();
                }}
                aria-label="Borrar texto"
                className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-sm text-navy/60 transition hover:bg-navy/5 hover:text-navy active:scale-95"
              >
                <span aria-hidden="true" className="flex h-5 w-5 items-center justify-center rounded-full bg-navy/15 text-[10px] font-bold">✕</span>
              </button>
            ) : null}
          </form>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] shrink-0 rounded-pill px-2.5 text-sm font-semibold text-denim transition hover:text-orange active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange"
          >
            Cancelar
          </button>
        </div>
      </div>

      {/* Body */}
      <div
        // Scrolling the results means reading, not typing: tuck the keyboard away.
        onScroll={() => document.activeElement === inputRef.current && inputRef.current?.blur()}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-5 pt-5"
      >
        <div className="mx-auto max-w-2xl space-y-7">
          {!typing ? (
            <>
              {recent.length > 0 ? (
                <section>
                  <SectionTitle
                    action={
                      <button
                        type="button"
                        onClick={() => {
                          setRecent([]);
                          writeRecent([]);
                        }}
                        className="min-h-[32px] rounded-pill px-2 text-xs font-semibold text-denim hover:text-orange"
                      >
                        Borrar todo
                      </button>
                    }
                  >
                    Búsquedas recientes
                  </SectionTitle>
                  <ul className="-mx-2">
                    {recent.map((term) => (
                      <li key={term} className="flex items-center">
                        <button type="button" onClick={() => search(term)} className={`${rowClass} min-w-0 flex-1 font-medium`}>
                          <span aria-hidden="true" className="w-6 text-center text-navy/50">🕘</span>
                          <span className="truncate">{term}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => forget(term)}
                          aria-label={`Quitar «${term}» de recientes`}
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xs text-navy/50 transition hover:bg-navy/5 hover:text-navy"
                        >
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              <section>
                <SectionTitle>Explora por género</SectionTitle>
                {genres === null ? (
                  <div className="flex flex-wrap gap-2" aria-hidden="true">
                    {["w-20", "w-16", "w-28", "w-[4.5rem]", "w-24", "w-14"].map((w) => (
                      <Skeleton key={w} className={`h-10 rounded-pill ${w}`} />
                    ))}
                  </div>
                ) : genres.length ? (
                  <ul className="flex flex-wrap gap-2">
                    {genres.map((genre) => (
                      <li key={genre.id}>
                        <Link
                          to={`/catalogo?genere=${encodeURIComponent(genre.slug)}`}
                          onClick={onClose}
                          className="flex min-h-[40px] items-center gap-1.5 rounded-pill border border-navy/10 bg-cream px-4 text-sm font-semibold text-navy shadow-sm transition hover:border-orange/50 active:scale-95 active:bg-sun/40"
                        >
                          {genre.name}
                          {genre.records_count ? <span className="text-xs font-medium text-navy/50">{genre.records_count}</span> : null}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  navigate(includeUnavailable ? "/catalogo?available=false" : "/catalogo");
                }}
                className="flex min-h-[56px] w-full items-center gap-3 rounded-2xl border border-navy/10 bg-cream px-4 text-left shadow-sm transition hover:border-orange/50 active:scale-[0.99]"
              >
                <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-full bg-navy text-cream">💿</span>
                <span className="flex-1">
                  <span className="block text-sm font-semibold text-navy">Ver todo el catálogo</span>
                  <span className="block text-xs text-navy/60">Filtra por precio, condición y más</span>
                </span>
                <span aria-hidden="true" className="text-navy/40">›</span>
              </button>

              {query.length === 1 ? (
                <p className="text-center text-xs text-navy/55">Escribe al menos {SUGGESTION_MIN_CHARS} letras para ver resultados.</p>
              ) : null}
            </>
          ) : (
            <section aria-live="polite">
              {suggestions.loading ? (
                <ul className="space-y-2" aria-label="Buscando…">
                  {[0, 1, 2].map((i) => (
                    <li key={i} className="flex items-center gap-3 px-2 py-1.5">
                      <Skeleton className="h-14 w-14 shrink-0 rounded-xl" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-3.5 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : suggestions.error ? (
                <div className="rounded-2xl border border-coral/30 bg-coral/5 px-4 py-5 text-center">
                  <p className="text-sm font-semibold text-navy">No pudimos buscar en este momento.</p>
                  <button type="button" onClick={() => search(value)} className="mt-2 text-sm font-semibold text-denim underline underline-offset-4">
                    Buscar en el catálogo
                  </button>
                </div>
              ) : suggestions.results.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <p aria-hidden="true" className="text-4xl">🔍</p>
                  <p className="mt-3 font-display text-xl text-denim">Sin resultados para “{query}”</p>
                  <p className="mt-1.5 text-sm text-navy/65">
                    Revisa la ortografía o busca por artista.
                    {!includeUnavailable ? " Solo mostramos discos disponibles." : ""}
                  </p>
                  <Link
                    to={`/encargar?title=${encodeURIComponent(query)}`}
                    onClick={onClose}
                    className="mt-6 inline-flex min-h-[48px] items-center gap-2 rounded-pill bg-orange px-6 text-sm font-semibold text-charcoal shadow-panel transition active:scale-95"
                  >
                    Encárgalo y te lo buscamos <span aria-hidden="true">→</span>
                  </Link>
                </div>
              ) : (
                <>
                  <SectionTitle>Discos</SectionTitle>
                  <ul className="-mx-2 space-y-1">
                    {suggestions.results.map((record) => {
                      const soldOut = record.stock <= 0;
                      return (
                        <li key={record.id}>
                          <button type="button" onClick={() => pick(record)} className={`${rowClass} py-1.5`}>
                            {record.cover_image_url ? (
                              <Img
                                src={record.cover_image_url}
                                thumbs={record.cover_thumbs}
                                alt=""
                                width={56}
                                className={`h-14 w-14 shrink-0 rounded-xl object-cover shadow-sm ${soldOut ? "opacity-60 grayscale" : ""}`}
                              />
                            ) : (
                              <span aria-hidden="true" className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-navy/5 text-xl">🎵</span>
                            )}
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[15px] font-semibold text-navy">
                                <Highlight text={record.title} query={query} />
                              </span>
                              <span className="block truncate text-xs font-medium text-navy/60">
                                <Highlight text={record.artist?.name ?? "Artista desconocido"} query={query} />
                              </span>
                            </span>
                            <span className="shrink-0 text-right">
                              {soldOut ? (
                                <span className="rounded-pill bg-navy/10 px-2 py-0.5 text-[11px] font-semibold text-navy/70">Agotado</span>
                              ) : (
                                <span className="text-sm font-bold tabular-nums text-navy">{currency(getEffectivePrice(record).effective)}</span>
                              )}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  <button
                    type="button"
                    onClick={() => search(value)}
                    className="mt-4 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-pill bg-navy px-5 text-sm font-semibold text-cream shadow-card transition hover:bg-denim active:scale-[0.99]"
                  >
                    <span className="truncate">Ver todos los resultados</span>
                    <span aria-hidden="true">→</span>
                  </button>
                </>
              )}
            </section>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
