import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../app/providers/AuthProvider";
import { Button } from "../../components/Button";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { extractErrorMessage } from "../../app/lib/httpClient";
import { createBazarService } from "../../app/services/bazarService";
import { formatAdminDate, isPastDate } from "../../app/lib/format";
import type { Bazar } from "../../app/domain/bazares";
import { BazarFormModal, type BazarFormValues } from "./bazares/BazarFormModal";

/**
 * Admin tab "Manejo de bazares": list every event (past included), create,
 * edit and delete. All API access goes through the bazar service repository;
 * UI concerns live in BazarFormModal / ConfirmDialog / BazarRow.
 */
export function ManageBazaresTab() {
  const { token } = useAuth();
  const bazarService = useMemo(
    () => createBazarService({ getToken: () => token }),
    [token]
  );

  const [bazares, setBazares] = useState<Bazar[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* ── Create / edit ── */
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  /* ── Delete confirmation ── */
  const [deleteTarget, setDeleteTarget] = useState<Bazar | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchBazares = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      setBazares(await bazarService.getAll());
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Error al cargar los bazares."));
    } finally {
      setLoading(false);
    }
  }, [token, bazarService]);

  useEffect(() => {
    void fetchBazares();
  }, [fetchBazares]);

  const editingBazar =
    editingId === null ? null : bazares.find((b) => b.id === editingId) ?? null;

  const openCreateModal = () => {
    setEditingId(null);
    setFormError(null);
    setFormOpen(true);
  };

  const openEditModal = (bazar: Bazar) => {
    setEditingId(bazar.id);
    setFormError(null);
    setFormOpen(true);
  };

  const handleSubmit = async (values: BazarFormValues) => {
    if (!token) return;
    setSaving(true);
    setFormError(null);
    try {
      const input = { ...values, image: values.imageFile };
      if (editingId === null) {
        await bazarService.create(input);
      } else {
        await bazarService.update(editingId, input);
      }
      setFormOpen(false);
      await fetchBazares();
    } catch (err: unknown) {
      setFormError(
        extractErrorMessage(
          err,
          editingId === null
            ? "Error al crear el bazar."
            : "Error al actualizar el bazar."
        )
      );
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await bazarService.remove(deleteTarget.id);
      setBazares((prev) => prev.filter((b) => b.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err: unknown) {
      setDeleteError(extractErrorMessage(err, "Error al eliminar el bazar."));
    } finally {
      setDeleting(false);
    }
  };

  const upcomingCount = bazares.filter((b) => !isPastDate(b.date)).length;

  return (
    <div>
      {/* ── Header row: count + add button ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-navy/70">
          {loading
            ? "Cargando bazares..."
            : `${bazares.length} bazar${bazares.length === 1 ? "" : "es"} · ${upcomingCount} próximo${upcomingCount === 1 ? "" : "s"}`}
        </p>
        <Button tone="orange" className="px-5 py-2.5 text-sm" onClick={openCreateModal}>
          ➕ Agregar bazar
        </Button>
      </div>

      {error && (
        <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && !error && bazares.length === 0 && (
        <div className="mt-4 rounded-2xl border border-dashed border-navy/20 bg-cream/60 px-6 py-12 text-center">
          <p className="text-3xl">🎪</p>
          <p className="mt-2 text-sm text-navy/70">
            Aún no hay bazares. Agrega el primero con el botón de arriba.
          </p>
        </div>
      )}

      <ul className="mt-4 space-y-3">
        {bazares.map((bazar) => (
          <BazarRow
            key={bazar.id}
            bazar={bazar}
            onEdit={() => openEditModal(bazar)}
            onAskDelete={() => {
              setDeleteTarget(bazar);
              setDeleteError(null);
            }}
          />
        ))}
      </ul>

      <BazarFormModal
        open={formOpen}
        editing={editingBazar}
        saving={saving}
        error={formError}
        onSubmit={(values) => void handleSubmit(values)}
        onClose={() => setFormOpen(false)}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Eliminar bazar"
        message={
          <>
            ¿Seguro que quieres eliminar{" "}
            <span className="font-semibold text-navy">{deleteTarget?.name}</span>?
            Esta acción no se puede deshacer.
          </>
        }
        confirmLabel="Eliminar"
        busyLabel="Eliminando..."
        busy={deleting}
        error={deleteError}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

/* ── List row ──────────────────────────────────────────────────────────── */

type BazarRowProps = {
  bazar: Bazar;
  onEdit: () => void;
  onAskDelete: () => void;
};

function BazarRow({ bazar, onEdit, onAskDelete }: BazarRowProps) {
  const past = isPastDate(bazar.date);
  return (
    <li
      className={`flex items-center gap-3 rounded-2xl border border-navy/10 bg-white/85 p-3 shadow-card backdrop-blur sm:gap-4 sm:p-4 ${
        past ? "opacity-60" : ""
      }`}
    >
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-navy/10 bg-sand sm:h-20 sm:w-20">
        {bazar.image_url ? (
          <img
            src={bazar.image_url}
            alt={`Flyer del bazar ${bazar.name}`}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xl">🎪</div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-sm text-denim">
          {bazar.name}
          {past && (
            <span className="ml-2 rounded-pill bg-navy/10 px-2 py-0.5 align-middle text-[10px] font-bold uppercase tracking-wide text-navy/60">
              Pasado
            </span>
          )}
        </p>
        <p className="truncate text-xs font-semibold capitalize text-orange">
          📅 {formatAdminDate(bazar.date)}
          {bazar.schedule ? ` · ${bazar.schedule}` : ""}
        </p>
        <p className="truncate text-xs text-navy/60">📍 {bazar.address}</p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Editar ${bazar.name}`}
          className="rounded-pill border border-navy/15 bg-white px-3 py-1.5 pt-2 text-xs font-semibold text-navy transition hover:border-orange hover:bg-orange hover:text-white"
        >
          ✏️ Editar
        </button>
        <button
          type="button"
          onClick={onAskDelete}
          aria-label={`Eliminar ${bazar.name}`}
          className="rounded-pill border border-red-200 bg-white px-3 py-1.5 pt-2 text-xs font-semibold text-red-600 transition hover:bg-red-600 hover:text-white"
        >
          🗑️ Eliminar
        </button>
      </div>
    </li>
  );
}
