import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { extractErrorMessage } from "../../app/lib/httpClient";
import { normName } from "../../app/lib/text";
import type { Category, RecordRepository } from "../../app/domain/album";
import { ConfirmDialog } from "../../components/ConfirmDialog";

/** A format or a genre, as the pickers show and edit them. */
export type CatalogTerm = { id: number | string; name: string; slug: string; records_count?: number };

const discos = (n = 0) => `${n} ${n === 1 ? "disco" : "discos"}`;

/* ── Picker: search, pick (one or several), create, rename, ask to delete ── */

type PickerProps = {
  label: string;
  /** "formato" / "género", for placeholders and button labels. */
  noun: string;
  options: CatalogTerm[];
  /** Selected ids; at most one unless `multiple`. */
  value: string[];
  multiple?: boolean;
  onChange: (ids: string[]) => void;
  /** Each action is offered only when given (i.e. the role allows it). */
  onCreate?: (name: string) => Promise<CatalogTerm>;
  onRename?: (term: CatalogTerm, name: string) => Promise<void>;
  onDelete?: (term: CatalogTerm) => void;
  /** Names worth creating in one tap (e.g. Discogs genres we don't have). */
  suggestions?: string[];
  hint?: string;
};

export function CatalogPicker({
  label,
  noun,
  options,
  value,
  multiple = false,
  onChange,
  onCreate,
  onRename,
  onDelete,
  suggestions = [],
  hint,
}: PickerProps) {
  const listId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [renaming, setRenaming] = useState<{ id: CatalogTerm["id"]; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = value
    .map((id) => options.find((o) => String(o.id) === id))
    .filter((o): o is CatalogTerm => Boolean(o));
  const q = normName(query);
  const matches = useMemo(
    () => options.filter((o) => normName(o.name).includes(q)),
    [options, q]
  );
  const canCreate = Boolean(onCreate) && q !== "" && !options.some((o) => normName(o.name) === q);
  // Keyboard rows: every match, then the "create" row.
  const rowCount = matches.length + (canCreate ? 1 : 0);

  // Close on outside click (also drops a half-typed rename).
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setRenaming(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const run = async (action: () => Promise<void>, fallback: string) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      // e.g. {"name": ["Ya existe un género con ese nombre."]}
      setError(extractErrorMessage(err, fallback));
    } finally {
      setBusy(false);
    }
  };

  const pick = (term: CatalogTerm) => {
    const id = String(term.id);
    if (multiple) {
      onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
      setQuery("");
      inputRef.current?.focus(); // keep adding genres without reaching for the mouse
    } else {
      onChange([id]);
      setQuery("");
      setOpen(false);
    }
  };

  const create = (name: string) =>
    run(async () => {
      if (!onCreate) return;
      const term = await onCreate(name.trim());
      pick(term);
    }, `No se pudo crear el ${noun}.`);

  const saveRename = (term: CatalogTerm) =>
    run(async () => {
      if (!onRename || !renaming?.name.trim()) return;
      if (renaming.name.trim() !== term.name) await onRename(term, renaming.name.trim());
      setRenaming(null);
    }, `No se pudo renombrar el ${noun}.`);

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      if (rowCount) setActive((i) => (i + (e.key === "ArrowDown" ? 1 : rowCount - 1)) % rowCount);
    } else if (e.key === "Enter") {
      e.preventDefault(); // never submit the record form from here
      if (!open) return setOpen(true);
      if (active < matches.length) pick(matches[active]);
      else if (canCreate) create(query);
    } else if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "Backspace" && query === "" && value.length > 0) {
      onChange(value.slice(0, -1)); // like any tag input
    }
  };

  const optionId = (i: number) => `${listId}-opt-${i}`;

  return (
    <div ref={containerRef} className="relative">
      <label htmlFor={`${listId}-input`} className="block text-sm font-semibold text-navy">
        {label}
        {multiple && selected.length > 0 && (
          <span className="ml-1 font-normal text-navy/50">({selected.length})</span>
        )}
      </label>

      {/* Chips + search input, styled as one field */}
      <div
        className="mt-1 flex min-h-[46px] w-full cursor-text flex-wrap items-center gap-1.5 rounded-xl border border-navy/15 bg-white px-2.5 py-1.5 transition focus-within:border-orange focus-within:ring-2 focus-within:ring-orange/30"
        onClick={() => {
          inputRef.current?.focus();
          setOpen(true);
        }}
      >
        {selected.map((term) => (
          <span
            key={term.id}
            className="inline-flex max-w-full items-center gap-1 rounded-full bg-orange/15 py-0.5 pl-3 pr-1 text-xs font-semibold text-navy"
          >
            <span className="truncate">{term.name}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange(value.filter((v) => v !== String(term.id)));
              }}
              aria-label={`Quitar ${term.name}`}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-navy/60 transition hover:bg-orange/30 hover:text-navy"
            >
              ×
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          id={`${listId}-input`}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && rowCount ? optionId(active) : undefined}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={
            selected.length === 0
              ? `Busca o crea un ${noun}...`
              : multiple
                ? `Agregar otro ${noun}...`
                : `Cambiar ${noun}...`
          }
          className="min-w-[8rem] flex-1 bg-transparent px-1 py-1.5 text-sm text-navy outline-none"
        />
      </div>

      {error && (
        <p role="alert" className="mt-1 text-xs font-semibold text-coral">
          {error}
        </p>
      )}
      {hint && !error && <p className="mt-1 text-[11px] text-navy/40">{hint}</p>}

      {/* Discogs genres we don't have yet: one tap creates and selects */}
      {onCreate && suggestions.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-navy/50">De Discogs:</span>
          {suggestions.map((name) => (
            <button
              key={name}
              type="button"
              disabled={busy}
              onClick={() => create(name)}
              className="rounded-full border border-dashed border-navy/25 px-2.5 py-0.5 text-[11px] font-semibold text-navy/70 transition hover:border-orange hover:text-navy disabled:opacity-50"
            >
              + {name}
            </button>
          ))}
        </div>
      )}

      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-multiselectable={multiple || undefined}
          className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-navy/10 bg-white py-1 shadow-lg"
        >
          {matches.length === 0 && !canCreate && (
            <li className="px-4 py-2.5 text-sm text-navy/50">
              {options.length === 0 ? `Todavía no hay ${noun}s.` : "Sin resultados."}
            </li>
          )}
          {matches.map((term, i) => {
            const isSelected = value.includes(String(term.id));
            if (renaming?.id === term.id) {
              return (
                <li key={term.id} className="flex items-center gap-1.5 px-2 py-1.5">
                  <input
                    autoFocus
                    value={renaming.name}
                    maxLength={100}
                    aria-label={`Nuevo nombre de ${term.name}`}
                    onChange={(e) => setRenaming({ id: term.id, name: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        saveRename(term);
                      } else if (e.key === "Escape") {
                        setRenaming(null);
                      }
                    }}
                    className="min-w-0 flex-1 rounded-lg border border-navy/15 px-2.5 py-1.5 text-sm text-navy outline-none focus:border-orange"
                  />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => saveRename(term)}
                    className="rounded-lg bg-navy px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    Guardar
                  </button>
                  <button
                    type="button"
                    onClick={() => setRenaming(null)}
                    aria-label="Cancelar"
                    className="rounded-lg px-2 py-1.5 text-xs text-navy/60 hover:bg-navy/5"
                  >
                    ✕
                  </button>
                </li>
              );
            }
            return (
              <li
                key={term.id}
                id={optionId(i)}
                role="option"
                aria-selected={isSelected}
                className={`flex items-center transition ${i === active ? "bg-sun/40" : "hover:bg-sun/20"}`}
                onMouseEnter={() => setActive(i)}
              >
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => pick(term)}
                  className="flex min-h-[44px] min-w-0 flex-1 items-center gap-2 px-4 text-left text-sm text-navy"
                >
                  <span
                    aria-hidden="true"
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded text-[10px] ${
                      isSelected ? "bg-orange text-charcoal" : multiple ? "border border-navy/25" : ""
                    }`}
                  >
                    {isSelected && "✓"}
                  </span>
                  <span className="truncate">{term.name}</span>
                  <span className="ml-auto shrink-0 text-[11px] text-navy/40">{discos(term.records_count)}</span>
                </button>
                {onRename && (
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => {
                      setError(null);
                      setRenaming({ id: term.id, name: term.name });
                    }}
                    aria-label={`Renombrar ${term.name}`}
                    title="Renombrar"
                    className="flex h-10 w-9 shrink-0 items-center justify-center rounded-lg text-navy/50 transition hover:bg-navy/5 hover:text-navy"
                  >
                    ✏️
                  </button>
                )}
                {onDelete && (
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => {
                      setOpen(false);
                      onDelete(term);
                    }}
                    aria-label={`Eliminar ${term.name}`}
                    title="Eliminar"
                    className="mr-1 flex h-10 w-9 shrink-0 items-center justify-center rounded-lg text-coral transition hover:bg-coral/10"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-4 w-4">
                      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                    </svg>
                  </button>
                )}
              </li>
            );
          })}
          {canCreate && (
            <li
              id={optionId(matches.length)}
              role="option"
              aria-selected={false}
              className={active === matches.length ? "bg-sun/40" : "hover:bg-sun/20"}
              onMouseEnter={() => setActive(matches.length)}
            >
              <button
                type="button"
                tabIndex={-1}
                disabled={busy}
                onClick={() => create(query)}
                className="min-h-[44px] w-full px-4 text-left text-sm font-semibold text-orange disabled:opacity-50"
              >
                {busy ? "Creando..." : `+ Crear ${noun} "${query.trim()}"`}
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

/* ── Delete confirmation: a genre just leaves its records; a format in use
   needs another format to move them to (the server refuses otherwise). ── */

type DeleteProps = {
  target: { kind: "format" | "genre"; term: CatalogTerm } | null;
  formats: Category[];
  recordService: RecordRepository;
  onClose: () => void;
  /** `movedTo`: the format the records went to, so the form can follow. */
  onDeleted: (deleted: { kind: "format" | "genre"; id: string; movedTo?: string }) => void;
};

export function DeleteCatalogTermDialog({ target, formats, recordService, onClose, onDeleted }: DeleteProps) {
  const [moveTo, setMoveTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const count = target?.term.records_count ?? 0;
  const needsTarget = target?.kind === "format" && count > 0;

  const close = () => {
    setMoveTo("");
    setError(null);
    onClose();
  };

  const confirm = async () => {
    if (!target) return;
    setBusy(true);
    setError(null);
    try {
      if (target.kind === "genre") await recordService.deleteGenre(target.term.id as number);
      else await recordService.deleteCategory(target.term.id, needsTarget ? moveTo : undefined);
      onDeleted({ kind: target.kind, id: String(target.term.id), movedTo: needsTarget ? moveTo : undefined });
      close();
    } catch (err) {
      setError(extractErrorMessage(err, "No se pudo eliminar."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ConfirmDialog
      open={target !== null}
      title={`¿Eliminar "${target?.term.name ?? ""}"?`}
      confirmLabel="Eliminar"
      busyLabel="Eliminando..."
      busy={busy}
      confirmDisabled={needsTarget && !moveTo}
      error={error}
      onCancel={close}
      onConfirm={confirm}
      message={
        target?.kind === "genre" ? (
          count > 0 ? (
            <>Se quitará de {discos(count)}. Los discos no se borran y conservan sus otros géneros.</>
          ) : (
            <>Ningún disco usa este género.</>
          )
        ) : needsTarget ? (
          <label className="block">
            {discos(count)} usan este formato. Elige a cuál moverlos antes de eliminarlo:
            <select
              value={moveTo}
              onChange={(e) => setMoveTo(e.target.value)}
              aria-label="Formato destino"
              className="mt-2 w-full rounded-xl border border-navy/15 bg-white px-3 py-2 text-sm text-navy outline-none focus:border-orange focus:ring-2 focus:ring-orange/30"
            >
              <option value="">Mover a…</option>
              {formats
                .filter((f) => String(f.id) !== String(target?.term.id))
                .map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
            </select>
          </label>
        ) : (
          <>Ningún disco usa este formato.</>
        )
      }
    />
  );
}
