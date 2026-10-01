import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { RECORD_CONDITIONS, type Artist, type Category, type Genere, type RecordRepository } from "../../app/domain/album";
import { useOnClickOutside } from "../../app/hooks/useOnClickOutside";
import { currency } from "../../app/lib/format";
import { ORDERING_LABELS, PAGE_SIZES, type CatalogParams, type FilterPatch } from "./catalogParams";
import type { RecordOrdering } from "../../app/domain/album";

// Little per-format icon for the filter chips (slug-based, resilient to
// future categories via sensible fallbacks).
const categoryIcon = (slug: string): string => {
  if (slug.includes("boxset")) return "📦";
  if (slug.includes("-") || slug.includes("dvd")) return "🎁";
  switch (slug) {
    case "lp":
    case "12":
      return "💿";
    case "cd":
      return "📀";
    case "7":
    case "10":
      return "🔘";
    default:
      return "🎵";
  }
};

const sectionTitle = "text-xs font-bold uppercase tracking-[0.16em] text-orange";
const chipClass = (active: boolean) =>
  `flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-pill border px-3.5 text-sm font-semibold transition ${
    active
      ? "border-transparent bg-gradient-to-r from-orange to-amber text-charcoal shadow-card"
      : "border-navy/10 bg-white/80 text-navy hover:border-orange/40 hover:text-orange"
  }`;
const inputClass =
  "min-h-[44px] w-full rounded-xl border border-navy/15 bg-white px-3 text-base text-navy outline-none transition focus:border-orange focus:ring-2 focus:ring-orange/30 sm:text-sm";

type PanelProps = {
  params: CatalogParams;
  categories: Category[];
  genres: Genere[];
  artistName: string;
  recordService: RecordRepository;
  onChange: (patch: FilterPatch) => void;
  onArtistPicked: (artist: Artist) => void;
};

/** Every filter control; rendered in the desktop sidebar and the mobile sheet. */
export function CatalogFilterPanel({
  params,
  categories,
  genres,
  artistName,
  recordService,
  onChange,
  onArtistPicked,
}: PanelProps) {
  const genreId = useId();

  const toggleCondition = (code: string) =>
    onChange({
      condition: params.condition.includes(code)
        ? params.condition.filter((c) => c !== code)
        : [...params.condition, code],
    });

  return (
    <div className="space-y-6">
      {/* Format */}
      {categories.length > 0 && (
        <fieldset>
          <legend className={sectionTitle}>Formato</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={() => onChange({ category: "" })} className={chipClass(!params.category)} aria-pressed={!params.category}>
              🎶 Todos
            </button>
            {categories.map((cat) => (
              <button
                key={cat.slug}
                type="button"
                onClick={() => onChange({ category: params.category === cat.slug ? "" : cat.slug })}
                className={chipClass(params.category === cat.slug)}
                aria-pressed={params.category === cat.slug}
              >
                <span aria-hidden="true">{categoryIcon(cat.slug)}</span>
                {cat.name}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {/* Artist */}
      <div>
        <p className={sectionTitle}>Artista</p>
        <ArtistPicker
          value={params.artist}
          valueName={artistName}
          recordService={recordService}
          onPick={(artist) => {
            onArtistPicked(artist);
            onChange({ artist: artist.slug });
          }}
          onClear={() => onChange({ artist: "" })}
        />
      </div>

      {/* Genre */}
      {genres.length > 0 && (
        <div>
          <label htmlFor={genreId} className={sectionTitle}>
            Género
          </label>
          <select
            id={genreId}
            value={params.genere}
            onChange={(e) => onChange({ genere: e.target.value })}
            className={`mt-2 ${inputClass}`}
          >
            <option value="">Todos los géneros</option>
            {genres.map((g) => (
              <option key={g.slug} value={g.slug}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Price */}
      <PriceRange
        // Remount when the URL changes elsewhere (chip removed, clear all).
        key={`${params.price_min}-${params.price_max}`}
        min={params.price_min}
        max={params.price_max}
        onApply={(price_min, price_max) => onChange({ price_min, price_max })}
      />

      {/* Records per page (also changes how many pages there are) */}
      <fieldset>
        <legend className={sectionTitle}>Discos por página</legend>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {PAGE_SIZES.map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => onChange({ page_size: size })}
              aria-pressed={params.page_size === size}
              className={`${chipClass(params.page_size === size)} justify-center`}
            >
              {size}
            </button>
          ))}
        </div>
      </fieldset>

      {/* Condition */}
      <fieldset>
        <legend className={sectionTitle}>Condición</legend>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {RECORD_CONDITIONS.map(({ code, label }) => {
            const checked = params.condition.includes(code);
            return (
              <label
                key={code}
                className={`flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm transition ${
                  checked ? "border-orange bg-orange/10 text-navy" : "border-navy/10 bg-white/70 text-navy/80"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleCondition(code)}
                  className="h-4 w-4 accent-orange"
                />
                <span>
                  <span className="font-semibold">{code}</span>
                  <span className="sr-only"> — </span>
                  <span className="block text-[11px] leading-tight text-navy/60">{label}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
    </div>
  );
}

function PriceRange({
  min,
  max,
  onApply,
}: {
  min: string;
  max: string;
  onApply: (min: string, max: string) => void;
}) {
  const [draftMin, setDraftMin] = useState(min);
  const [draftMax, setDraftMax] = useState(max);
  const minId = useId();
  const maxId = useId();
  const dirty = draftMin !== min || draftMax !== max;
  const apply = () => dirty && onApply(draftMin.trim(), draftMax.trim());

  return (
    <fieldset>
      <legend className={sectionTitle}>Precio (MXN)</legend>
      <form
        className="mt-2 flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          apply();
        }}
      >
        <div className="min-w-0 flex-1">
          <label htmlFor={minId} className="text-xs text-navy/60">
            Mínimo
          </label>
          <input
            id={minId}
            type="number"
            inputMode="decimal"
            min={0}
            placeholder="$0"
            value={draftMin}
            onChange={(e) => setDraftMin(e.target.value)}
            onBlur={apply}
            className={inputClass}
          />
        </div>
        <div className="min-w-0 flex-1">
          <label htmlFor={maxId} className="text-xs text-navy/60">
            Máximo
          </label>
          <input
            id={maxId}
            type="number"
            inputMode="decimal"
            min={0}
            placeholder="Sin límite"
            value={draftMax}
            onChange={(e) => setDraftMax(e.target.value)}
            onBlur={apply}
            className={inputClass}
          />
        </div>
        {/* Enter submits; the button is for touch users. */}
        <button
          type="submit"
          disabled={!dirty}
          className="min-h-[44px] shrink-0 rounded-xl bg-navy px-3 text-sm font-semibold text-cream transition disabled:opacity-40"
        >
          OK
        </button>
      </form>
    </fieldset>
  );
}

function ArtistPicker({
  value,
  valueName,
  recordService,
  onPick,
  onClear,
}: {
  value: string;
  valueName: string;
  recordService: RecordRepository;
  onPick: (artist: Artist) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Artist[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const refs = useMemo(() => [rootRef], []);
  const close = useCallback(() => setOpen(false), []);
  useOnClickOutside(refs, close, open);

  // Debounced autocomplete (the endpoint already caps and orders results).
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const t = setTimeout(() => {
      recordService
        .searchArtists(q)
        .then((data) => {
          setResults(data.slice(0, 8));
          setActive(-1);
          setOpen(true);
        })
        .catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(t);
  }, [query, recordService]);

  if (value) {
    return (
      <div className="mt-2 flex min-h-[44px] items-center justify-between gap-2 rounded-xl border border-orange bg-orange/10 px-3">
        <span className="truncate text-sm font-semibold text-navy">{valueName}</span>
        <button
          type="button"
          onClick={onClear}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-coral hover:bg-coral/10"
          aria-label={`Quitar filtro de artista ${valueName}`}
        >
          ✕
        </button>
      </div>
    );
  }

  const pick = (artist: Artist) => {
    setQuery("");
    setResults([]);
    setOpen(false);
    onPick(artist);
  };
  const visible = open && query.trim().length >= 2;

  return (
    <div ref={rootRef} className="relative mt-2">
      <input
        type="search"
        role="combobox"
        aria-expanded={visible}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        aria-label="Buscar artista"
        placeholder="Buscar artista…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => Math.min(results.length - 1, i + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(-1, i - 1));
          } else if (e.key === "Enter" && active >= 0 && results[active]) {
            e.preventDefault();
            pick(results[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        className={inputClass}
      />
      {visible && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-navy/10 bg-cream py-1 shadow-panel"
        >
          {results.length === 0 ? (
            <li className="px-3 py-2.5 text-sm text-navy/60">Sin artistas con ese nombre</li>
          ) : (
            results.map((artist, i) => (
              <li
                key={artist.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => e.preventDefault()} // keep focus in the input
                onClick={() => pick(artist)}
                className={`flex min-h-[44px] cursor-pointer items-center px-3 text-sm text-navy ${
                  i === active ? "bg-sun/40" : "hover:bg-sun/20"
                }`}
              >
                {artist.name}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

type Chip = { key: string; label: string; patch: FilterPatch };

/** Active filters as removable chips + "Limpiar todo" + results count. */
export function ActiveFilterChips({
  params,
  categories,
  genres,
  artistName,
  count,
  onChange,
  onClearAll,
}: {
  params: CatalogParams;
  categories: Category[];
  genres: Genere[];
  artistName: string;
  count: number | null;
  onChange: (patch: FilterPatch) => void;
  onClearAll: () => void;
}) {
  const chips: Chip[] = [];
  if (params.category) {
    const name = categories.find((c) => c.slug === params.category)?.name ?? params.category;
    chips.push({ key: "category", label: name, patch: { category: "" } });
  }
  if (params.artist) chips.push({ key: "artist", label: artistName, patch: { artist: "" } });
  if (params.genere) {
    const name = genres.find((g) => g.slug === params.genere)?.name ?? params.genere;
    chips.push({ key: "genere", label: name, patch: { genere: "" } });
  }
  params.condition.forEach((code) =>
    chips.push({
      key: `condition-${code}`,
      label: `Condición ${code}`,
      patch: { condition: params.condition.filter((c) => c !== code) },
    })
  );
  if (params.price_min || params.price_max) {
    const label = params.price_min && params.price_max
      ? `${currency(params.price_min)} – ${currency(params.price_max)}`
      : params.price_min ? `Desde ${currency(params.price_min)}` : `Hasta ${currency(params.price_max)}`;
    chips.push({ key: "price", label, patch: { price_min: "", price_max: "" } });
  }

  return (
    <div className="flex flex-wrap items-center gap-2" aria-live="polite">
      {count !== null && (
        <p className="mr-1 text-sm text-navy/70">
          <span className="font-semibold text-denim">{count}</span> {count === 1 ? "disco" : "discos"}
        </p>
      )}
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={() => onChange(chip.patch)}
          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-pill border border-orange/30 bg-orange/10 px-3 text-sm font-semibold text-navy transition hover:bg-orange/20"
          aria-label={`Quitar filtro: ${chip.label}`}
        >
          {chip.label}
          <span aria-hidden="true" className="text-coral">✕</span>
        </button>
      ))}
      {chips.length > 0 && (
        <button
          type="button"
          onClick={onClearAll}
          className="min-h-[36px] px-2 text-sm font-semibold text-denim underline underline-offset-4 hover:text-orange"
        >
          Limpiar todo
        </button>
      )}
    </div>
  );
}

/** "Solo disponibles" switch; lives in the catalog toolbar, outside the filters. */
export function AvailabilitySwitch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-pill border border-navy/10 bg-cream/80 pl-3 pr-4 shadow-card">
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-navy/10 shadow-inner transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-orange ${
          checked ? "bg-orange" : "bg-navy/15"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-cream shadow-sm transition-transform ${
            checked ? "translate-x-[22px]" : "translate-x-[3px]"
          }`}
        />
      </span>
      <span className="whitespace-nowrap text-sm font-semibold text-navy">Solo disponibles</span>
    </label>
  );
}

/** Sort control: native select (native picker on phones) styled as a pill. */
export function SortSelect({
  value,
  onChange,
  className = "",
}: {
  value: RecordOrdering;
  onChange: (value: RecordOrdering) => void;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={`relative ${className}`}>
      <label htmlFor={id} className="sr-only">
        Ordenar resultados
      </label>
      {/* Sort icon */}
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-orange">
        <path d="M3 6h13M3 12h9M3 18h5M17 10v10m0 0-3-3m3 3 3-3" />
      </svg>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as RecordOrdering)}
        className="min-h-[44px] w-full cursor-pointer appearance-none rounded-pill border border-navy/10 bg-cream/80 pl-10 pr-10 text-base font-semibold text-navy shadow-card outline-none transition hover:border-orange/40 focus-visible:border-orange focus-visible:ring-2 focus-visible:ring-orange/30 sm:text-sm"
      >
        {Object.entries(ORDERING_LABELS).map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>
      {/* Chevron (appearance-none removes the native one) */}
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-navy/60">
        <path d="m6 9 6 6 6-6" />
      </svg>
    </div>
  );
}
