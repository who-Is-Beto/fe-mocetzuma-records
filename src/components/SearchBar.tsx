import { useCallback, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Button } from "./Button";
import { Img } from "./Img";
import type { Record } from "../app/domain/album";
import { useAuth } from "../app/providers/AuthProvider";
import { useOnClickOutside } from "../app/hooks/useOnClickOutside";
import { useRecordSuggestions } from "../app/hooks/useRecordSuggestions";

type SearchBarProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  /** Enables the typeahead (≤5 records); called when one is chosen. */
  onPickSuggestion?: (record: Record) => void;
  /** Suggest sold-out records too ("Solo disponibles" turned off). */
  includeUnavailable?: boolean;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
};

export function SearchBar({
  value,
  onChange,
  onSubmit,
  onPickSuggestion,
  includeUnavailable = false,
  placeholder = "Buscar vinilo...",
  className = "",
  autoFocus = false,
}: SearchBarProps) {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const refs = useMemo(() => [rootRef], []);
  const close = useCallback(() => {
    setOpen(false);
    setActive(-1);
  }, []);
  useOnClickOutside(refs, close, open);

  // Only the instance being typed in queries (the navbar mounts a desktop and
  // a mobile bar sharing one value; the hidden one stays closed).
  const suggestions = useRecordSuggestions(
    onPickSuggestion && open ? value : "",
    token,
    includeUnavailable
  );
  const showPanel = Boolean(onPickSuggestion) && open && suggestions.enabled;
  const { results } = suggestions;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    close();
    onSubmit(value);
  };

  const pick = (record: Record) => {
    close();
    onPickSuggestion?.(record);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!showPanel) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => (results.length ? (i + 1) % results.length : -1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => (results.length ? (i <= 0 ? results.length - 1 : i - 1) : -1));
    } else if (event.key === "Enter" && active >= 0 && results[active]) {
      event.preventDefault(); // open the highlighted record instead of searching
      pick(results[active]);
    } else if (event.key === "Escape") {
      close();
    }
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <form
        role="search"
        className="flex items-center gap-3 rounded-xl border border-navy/10 bg-cream px-3 py-2 shadow-sm backdrop-blur focus-within:border-orange"
        onSubmit={handleSubmit}
      >
        <span className="text-lg" aria-hidden="true">🔎</span>
        <input
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          role={onPickSuggestion ? "combobox" : undefined}
          aria-label={placeholder}
          aria-expanded={onPickSuggestion ? showPanel : undefined}
          aria-controls={onPickSuggestion ? listId : undefined}
          aria-autocomplete={onPickSuggestion ? "list" : undefined}
          aria-activedescendant={showPanel && active >= 0 ? `${listId}-${active}` : undefined}
          className="min-h-[36px] w-full bg-transparent text-base text-navy placeholder:text-navy/50 focus:outline-none"
          placeholder={placeholder}
        />
        <Button type="submit" tone="navy" className="px-3 py-1 text-xs">
          Buscar
        </Button>
      </form>

      {showPanel && (
        <div className="absolute inset-x-0 top-full z-40 mt-2 overflow-hidden rounded-2xl border border-navy/10 bg-cream shadow-panel">
          {suggestions.loading && results.length === 0 ? (
            <p className="flex items-center gap-2 px-4 py-3 text-sm text-navy/60" role="status">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-navy/20 border-t-orange" aria-hidden="true" />
              Buscando…
            </p>
          ) : suggestions.error ? (
            <p className="px-4 py-3 text-sm text-coral" role="status">No se pudieron cargar sugerencias.</p>
          ) : results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-navy/60" role="status">Sin resultados para “{value.trim()}”.</p>
          ) : (
            <ul id={listId} role="listbox" aria-label="Sugerencias" className="py-1">
              {results.map((record, i) => (
                <li
                  key={record.id}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseDown={(e) => e.preventDefault()} // keep input focus
                  onClick={() => pick(record)}
                  onMouseEnter={() => setActive(i)}
                  className={`flex min-h-[52px] cursor-pointer items-center gap-3 px-3 py-1.5 ${
                    i === active ? "bg-sun/40" : ""
                  }`}
                >
                  {record.cover_image_url ? (
                    <Img src={record.cover_image_url} alt="" width={40} className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-navy/5">🎵</span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-navy">{record.title}</span>
                    <span className="block truncate text-xs text-navy/60">
                      {record.artist?.name ?? "Artista desconocido"}
                      {record.stock <= 0 ? " · Agotado" : ""}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {results.length > 0 && (
            <button
              type="button"
              onClick={() => {
                close();
                onSubmit(value);
              }}
              className="min-h-[44px] w-full border-t border-navy/10 px-4 text-left text-sm font-semibold text-denim hover:bg-sun/20"
            >
              Ver todos los resultados →
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default SearchBar;
