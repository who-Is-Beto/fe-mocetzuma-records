import { useEffect, useId, useRef, useState } from "react";
import { Img } from "../../components/Img";
import { Skeleton } from "../../components/Skeleton";
import { HttpError } from "../../app/lib/httpClient";
import type { DiscogsAlbum, RecordRequestRepository } from "../../app/domain/recordRequest";

const MIN_CHARS = 3;
const DEBOUNCE_MS = 400;

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; query: string; results: DiscogsAlbum[] }
  | { status: "error"; message: string };

type DiscogsPickerProps = {
  service: RecordRequestRepository;
  /** Search shown on arrival (e.g. the record from a "not found" page). */
  initialQuery: string;
  selected: DiscogsAlbum | null;
  onSelect: (album: DiscogsAlbum | null) => void;
  /** "Escríbelo tú": hand focus to the manual fields. */
  onSkip: () => void;
};

function Cover({ album, size }: { album: DiscogsAlbum; size: "sm" | "lg" }) {
  const src = size === "lg" ? album.cover ?? album.thumb : album.thumb ?? album.cover;
  const box = size === "lg" ? "h-20 w-20 rounded-xl" : "h-12 w-12 rounded-lg";
  return src ? (
    <Img src={src} alt="" width={size === "lg" ? 80 : 48} className={`${box} shrink-0 object-cover shadow-sm`} />
  ) : (
    <span aria-hidden="true" className={`${box} flex shrink-0 items-center justify-center bg-navy/5 text-xl`}>🎵</span>
  );
}

/**
 * Optional helper on /encargar: find the record on Discogs (one result per
 * album) and the form fills itself, cover included. Discogs is only named
 * in the attribution line its API terms ask for (store's choice). Typing the record by
 * hand always works, so a Discogs outage never blocks a request.
 */
export function DiscogsPicker({ service, initialQuery, selected, onSelect, onSkip }: DiscogsPickerProps) {
  const [query, setQuery] = useState(initialQuery);
  const [state, setState] = useState<State>({ status: "idle" });
  const inputRef = useRef<HTMLInputElement>(null);
  const uid = useId();
  const term = query.trim();

  useEffect(() => {
    if (selected || term.length < MIN_CHARS) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setState({ status: "loading" });
      service
        .searchDiscogs(term, controller.signal)
        .then((results) => setState({ status: "done", query: term, results }))
        .catch((error) => {
          if (controller.signal.aborted) return;
          setState({
            status: "error",
            message:
              error instanceof HttpError && error.status === 429
                ? "Muchas búsquedas seguidas. Espera unos segundos y vuelve a intentar."
                : "La búsqueda no está disponible en este momento. Escribe los datos abajo, igual te lo buscamos."
          });
        });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [term, selected, service]);

  const choose = (album: DiscogsAlbum) => {
    onSelect(album);
    setQuery("");
    setState({ status: "idle" });
  };

  if (selected) {
    return (
      <div className="success-pop flex items-center gap-4 rounded-2xl border border-green-600/25 bg-green-50/70 p-3.5">
        <Cover album={selected} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-green-700">✓ Disco seleccionado</p>
          <p className="mt-1 truncate text-[15px] font-semibold text-navy">{selected.title}</p>
          <p className="truncate text-sm text-navy/70">
            {selected.artist}
            {selected.year ? ` · ${selected.year}` : ""}
          </p>
          <div className="mt-1.5">
            <button
              type="button"
              onClick={() => {
                onSelect(null);
                requestAnimationFrame(() => inputRef.current?.focus());
              }}
              className="min-h-[32px] text-sm font-semibold text-denim underline decoration-orange/60 underline-offset-4 hover:text-orange"
            >
              Cambiar
            </button>
          </div>
        </div>
      </div>
    );
  }

  const showPanel = term.length >= MIN_CHARS && state.status !== "idle";
  const results = state.status === "done" ? state.results : [];

  return (
    <div className="rounded-2xl border border-navy/10 bg-sand/60 p-3 sm:p-4">
      <label htmlFor={`${uid}-q`} className="block text-sm font-semibold text-navy">
        Busca el disco <span className="font-medium text-navy/50">· opcional</span>
      </label>
      <p className="mt-0.5 text-xs text-navy/60">Elige el disco y llenamos los datos por ti, con todo y portada.</p>
      <div className="relative mt-2.5">
        <span aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2">🔎</span>
        <input
          ref={inputRef}
          id={`${uid}-q`}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && e.preventDefault()} // never submits the form
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="Artista y disco, ej. Caifanes Avientame"
          aria-controls={`${uid}-results`}
          className="h-12 w-full rounded-xl border border-navy/15 bg-cream pl-11 pr-3 text-base text-navy shadow-inner outline-none transition placeholder:text-navy/40 focus:border-orange focus:ring-4 focus:ring-orange/15 sm:text-sm [&::-webkit-search-cancel-button]:hidden"
        />
      </div>

      <div id={`${uid}-results`} aria-live="polite">
        {showPanel ? (
          <div className="mt-3">
            {state.status === "loading" ? (
              <ul className="space-y-2" aria-label="Buscando…">
                {[0, 1, 2].map((i) => (
                  <li key={i} className="flex items-center gap-3 p-1.5">
                    <Skeleton className="h-12 w-12 shrink-0 rounded-lg" />
                    <span className="flex-1 space-y-2">
                      <Skeleton className="h-3.5 w-2/3" />
                      <Skeleton className="h-3 w-1/3" />
                    </span>
                  </li>
                ))}
              </ul>
            ) : state.status === "error" ? (
              <p className="rounded-xl bg-coral/10 px-3.5 py-3 text-sm text-navy">{state.message}</p>
            ) : results.length === 0 ? (
              <p className="rounded-xl bg-white/70 px-3.5 py-3 text-sm text-navy/75">
                No encontramos ese disco. Escríbelo abajo, igual te lo buscamos.
              </p>
            ) : (
              <ul className="-mx-1.5 max-h-[22rem] space-y-0.5 overflow-y-auto overscroll-contain">
                {results.map((album) => (
                  <li key={`${album.kind}-${album.id}`}>
                    <button
                      type="button"
                      onClick={() => choose(album)}
                      className="flex min-h-[60px] w-full items-center gap-3 rounded-xl p-1.5 text-left transition hover:bg-white active:scale-[0.99] active:bg-sun/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange"
                    >
                      <Cover album={album} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-navy">{album.title}</span>
                        <span className="block truncate text-xs text-navy/65">
                          {album.artist}
                          {album.year ? ` · ${album.year}` : ""}
                        </span>
                      </span>
                      <span className="hidden shrink-0 rounded-pill border border-navy/15 px-3 py-1 text-xs font-semibold text-navy min-[400px]:inline">Elegir</span>
                      <span aria-hidden="true" className="shrink-0 pr-1 text-lg text-navy/40 min-[400px]:hidden">›</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-navy/10 pt-2.5 text-xs">
              <button type="button" onClick={onSkip} className="min-h-[32px] font-semibold text-denim hover:text-orange">
                ¿No aparece? Escríbelo tú ↓
              </button>
              {/* Attribution the Discogs API terms ask for. */}
              <a href="https://www.discogs.com" target="_blank" rel="noreferrer" className="text-navy/50 hover:text-navy">
                Datos de Discogs
              </a>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
