import { useEffect, useId, useState, type ReactNode } from "react";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { extractErrorMessage } from "../../app/lib/httpClient";
import type {
  Artist,
  ArtistDeleteResult,
  ArtistReassign,
  ArtistUsage,
  RecordRepository,
} from "../../app/domain/album";

type Choice = "suggested" | "existing" | "new";

type Props = {
  /** The artist to delete; null = closed. */
  artist: Pick<Artist, "id" | "name"> | null;
  recordService: RecordRepository;
  onClose: () => void;
  onDeleted: (result: ArtistDeleteResult) => void;
};

const inputClass =
  "mt-1 min-h-[44px] w-full rounded-xl border border-navy/15 bg-white px-3 text-base text-navy outline-none focus:border-orange focus:ring-2 focus:ring-orange/30 sm:text-sm";

/**
 * Delete an artist from the Agregar disco artist field.
 * Unused → plain confirmation. Used by N records → the records must go
 * somewhere first: the most similar existing artist (preselected), another
 * existing one, or a new one. The backend reassigns + deletes in one
 * transaction, so no record is ever left without an artist.
 */
export function DeleteArtistDialog({ artist, recordService, onClose, onDeleted }: Props) {
  const [usage, setUsage] = useState<ArtistUsage | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [choice, setChoice] = useState<Choice>("suggested");
  const [existing, setExisting] = useState<Artist | null>(null);
  const [existingQuery, setExistingQuery] = useState("");
  const [existingResults, setExistingResults] = useState<Artist[]>([]);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const radioName = useId();

  // Load usage each time the dialog opens for an artist.
  useEffect(() => {
    if (!artist) return;
    let cancelled = false;
    recordService
      .getArtistUsage(artist.id)
      .then((data) => {
        if (cancelled) return;
        setUsage(data);
        setChoice(data.suggestion ? "suggested" : "existing");
      })
      .catch((err) => !cancelled && setLoadError(extractErrorMessage(err, "No se pudo revisar el artista.")));
    return () => {
      cancelled = true;
    };
  }, [artist, recordService]);

  // "Otro artista existente" autocomplete.
  useEffect(() => {
    const q = existingQuery.trim();
    if (q.length < 2) return;
    const t = setTimeout(() => {
      recordService
        .searchArtists(q)
        .then((list) => setExistingResults(list.filter((a) => a.id !== artist?.id).slice(0, 6)))
        .catch(() => setExistingResults([]));
    }, 250);
    return () => clearTimeout(t);
  }, [existingQuery, recordService, artist?.id]);

  if (!artist) return null;

  const close = () => {
    if (busy) return;
    setUsage(null);
    setLoadError(null);
    setError(null);
    setExisting(null);
    setExistingQuery("");
    setExistingResults([]);
    setNewName("");
    onClose();
  };

  const count = usage?.records_count ?? 0;
  const target: ArtistReassign | null =
    count === 0
      ? {}
      : choice === "suggested" && usage?.suggestion
        ? { reassign_to: usage.suggestion.id }
        : choice === "existing" && existing
          ? { reassign_to: existing.id }
          : choice === "new" && newName.trim()
            ? { new_artist_name: newName.trim() }
            : null;
  const targetName =
    choice === "suggested" ? usage?.suggestion?.name : choice === "existing" ? existing?.name : newName.trim();

  const confirm = async () => {
    if (!target || !usage) return;
    setBusy(true);
    setError(null);
    try {
      const result = await recordService.deleteArtist(artist.id, target);
      setBusy(false);
      close();
      onDeleted(result);
    } catch (err) {
      setError(extractErrorMessage(err, "No se pudo eliminar el artista."));
      setBusy(false);
    }
  };

  const radio = (value: Choice, label: string, disabled = false) => (
    <label className={`flex min-h-[44px] items-center gap-2 ${disabled ? "opacity-40" : "cursor-pointer"}`}>
      <input
        type="radio"
        name={radioName}
        value={value}
        checked={choice === value}
        disabled={disabled}
        onChange={() => setChoice(value)}
        className="h-4 w-4 accent-orange"
      />
      <span className="text-sm text-navy">{label}</span>
    </label>
  );

  let message: ReactNode;
  if (loadError) {
    message = <p className="text-red-700">{loadError}</p>;
  } else if (!usage) {
    message = <p className="animate-pulse">Revisando qué discos usan este artista…</p>;
  } else if (count === 0) {
    message = (
      <p>
        Ningún disco usa a <strong className="text-navy">{artist.name}</strong>. ¿Eliminarlo definitivamente?
      </p>
    );
  } else {
    message = (
      <div className="space-y-3">
        <p>
          <strong className="text-navy">
            {count} {count === 1 ? "disco usa" : "discos usan"}
          </strong>{" "}
          a <strong className="text-navy">{artist.name}</strong>. Antes de eliminarlo, elige a quién
          reasignar {count === 1 ? "ese disco" : "esos discos"}:
        </p>
        <fieldset className="space-y-1">
          <legend className="sr-only">Reasignar discos a</legend>
          {radio(
            "suggested",
            usage.suggestion ? `Artista más parecido: ${usage.suggestion.name}` : "Sin artistas parecidos",
            !usage.suggestion
          )}
          {radio("existing", "Otro artista existente")}
          {choice === "existing" && (
            <div className="pl-6">
              {existing ? (
                <p className="flex min-h-[44px] items-center justify-between gap-2 rounded-xl border border-orange bg-orange/10 px-3 text-sm font-semibold text-navy">
                  {existing.name}
                  <button type="button" onClick={() => setExisting(null)} className="px-2 text-coral" aria-label="Elegir otro artista">
                    ✕
                  </button>
                </p>
              ) : (
                <>
                  <input
                    type="search"
                    aria-label="Buscar artista destino"
                    placeholder="Buscar artista…"
                    value={existingQuery}
                    onChange={(e) => setExistingQuery(e.target.value)}
                    className={inputClass}
                  />
                  {existingQuery.trim().length >= 2 && (
                    <ul className="mt-1 max-h-40 overflow-y-auto rounded-xl border border-navy/10 bg-white">
                      {existingResults.length === 0 ? (
                        <li className="px-3 py-2 text-sm text-navy/60">Sin resultados</li>
                      ) : (
                        existingResults.map((a) => (
                          <li key={a.id}>
                            <button
                              type="button"
                              onClick={() => setExisting(a)}
                              className="min-h-[44px] w-full px-3 text-left text-sm text-navy hover:bg-sun/30"
                            >
                              {a.name}
                            </button>
                          </li>
                        ))
                      )}
                    </ul>
                  )}
                </>
              )}
            </div>
          )}
          {radio("new", "Crear un artista nuevo")}
          {choice === "new" && (
            <div className="pl-6">
              <input
                type="text"
                aria-label="Nombre del artista nuevo"
                placeholder="Nombre del artista"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className={inputClass}
              />
            </div>
          )}
        </fieldset>
        {target && targetName && (
          <p className="rounded-xl bg-sun/30 px-3 py-2 text-navy">
            {count === 1 ? "El disco pasará" : `Los ${count} discos pasarán`} a <strong>{targetName}</strong> y{" "}
            <strong>{artist.name}</strong> se eliminará. Esta acción no se puede deshacer.
          </p>
        )}
      </div>
    );
  }

  return (
    <ConfirmDialog
      open
      title="Eliminar artista"
      message={message}
      confirmLabel={count > 0 ? `Reasignar y eliminar` : "Eliminar artista"}
      busyLabel="Eliminando..."
      busy={busy}
      confirmDisabled={!usage || !target}
      error={error}
      onConfirm={confirm}
      onCancel={close}
    />
  );
}
