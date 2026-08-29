import { useEffect, useState } from "react";
import { Modal } from "../../../components/Modal";
import type { Bazar } from "../../../app/domain/bazares";

type FormState = {
  name: string;
  date: string;
  schedule: string;
  address: string;
  google_maps_url: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  date: "",
  schedule: "",
  address: "",
  google_maps_url: ""
};

const inputClass =
  "w-full rounded-xl border border-navy/15 bg-white px-4 py-2.5 text-sm text-navy outline-none transition focus:border-orange focus:ring-2 focus:ring-orange/30";

export type BazarFormValues = FormState & { imageFile: File | null };

type BazarFormModalProps = {
  open: boolean;
  /** null → create mode; a bazar → edit mode pre-filled with its values. */
  editing: Bazar | null;
  saving: boolean;
  error: string | null;
  onSubmit: (values: BazarFormValues) => void;
  onClose: () => void;
};

const REQUIRED_FIELDS: Array<{ key: keyof FormState; label: string }> = [
  { key: "name", label: "Nombre" },
  { key: "date", label: "Fecha" },
  { key: "address", label: "Dirección" },
  { key: "google_maps_url", label: "Link de Google Maps" }
];

/**
 * Create/edit form for bazares (admin). Owns its local draft state; submits
 * trimmed values plus an optional new image file via `onSubmit`.
 */
export function BazarFormModal({
  open,
  editing,
  saving,
  error,
  onSubmit,
  onClose
}: BazarFormModalProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Re-seed the draft each time the modal opens for a different target.
  useEffect(() => {
    if (!open) return;
    // Intentional form reset: the draft mirrors the `editing` prop the moment
    // the modal opens (or switches target without closing).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm(
      editing
        ? {
            name: editing.name,
            date: editing.date,
            schedule: editing.schedule ?? "",
            address: editing.address,
            google_maps_url: editing.google_maps_url
          }
        : EMPTY_FORM
    );
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setImageFile(null);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setImagePreview(editing?.image_url ?? null);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValidationError(null);
  }, [open, editing]);

  // Free object URLs when they are replaced or when the modal closes.
  useEffect(() => {
    return () => {
      if (imagePreview?.startsWith("blob:")) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  const handleImageChange = (file: File | null) => {
    if (imagePreview?.startsWith("blob:")) URL.revokeObjectURL(imagePreview);
    setImageFile(file);
    setImagePreview(file ? URL.createObjectURL(file) : null);
  };

  const handleSubmit = () => {
    const missing = REQUIRED_FIELDS.filter((field) => !form[field.key].trim());
    if (missing.length > 0 || !form.date) {
      setValidationError("Nombre, fecha, dirección y link de Google Maps son obligatorios.");
      return;
    }
    onSubmit({
      ...form,
      name: form.name.trim(),
      schedule: form.schedule.trim(),
      address: form.address.trim(),
      google_maps_url: form.google_maps_url.trim(),
      imageFile
    });
  };

  const titleId = "bazar-form-title";

  return (
    <Modal open={open} onClose={onClose} dismissible={!saving} labelledBy={titleId}>
      <h3 id={titleId} className="font-display text-lg text-denim">
        {editing ? "Editar bazar" : "Agregar bazar"}
      </h3>

      <div className="mt-5 space-y-4">
        <Field id="bazar-name" label="Nombre del bazar *" >
          <input
            id="bazar-name"
            type="text"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Bazar La Lagunilla"
            className={inputClass}
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="bazar-date" label="Fecha *">
            <input
              id="bazar-date"
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              className={inputClass}
            />
          </Field>
          <Field id="bazar-schedule" label="Horario">
            <input
              id="bazar-schedule"
              type="text"
              value={form.schedule}
              onChange={(e) => setForm((f) => ({ ...f, schedule: e.target.value }))}
              placeholder="10:00 am - 6:00 pm"
              className={inputClass}
            />
          </Field>
        </div>

        <Field id="bazar-address" label="Dirección *">
          <input
            id="bazar-address"
            type="text"
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            placeholder="Av. Oceanía 120, Col. Moctezuma, CDMX"
            className={inputClass}
          />
        </Field>

        <Field id="bazar-maps" label="Link de Google Maps *">
          <input
            id="bazar-maps"
            type="url"
            value={form.google_maps_url}
            onChange={(e) => setForm((f) => ({ ...f, google_maps_url: e.target.value }))}
            placeholder="https://maps.app.goo.gl/..."
            className={inputClass}
          />
        </Field>

        <Field
          id="bazar-image"
          label={`Imagen ${editing ? "(déjala vacía para conservar la actual)" : ""}`}
        >
          {imagePreview && (
            <img
              src={imagePreview}
              alt="Vista previa del flyer"
              className="mb-2 h-32 w-full rounded-xl object-cover"
            />
          )}
          <input
            id="bazar-image"
            type="file"
            accept="image/*"
            onChange={(e) => handleImageChange(e.target.files?.[0] ?? null)}
            className="block w-full text-xs text-navy/70 file:mr-3 file:rounded-pill file:border-0 file:bg-orange file:px-4 file:py-2 file:text-xs file:font-semibold file:text-white hover:file:bg-orange/80"
          />
        </Field>
      </div>

      {(validationError || error) && (
        <div
          role="alert"
          className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700"
        >
          {validationError ?? error}
        </div>
      )}

      <div className="mt-6 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          className="rounded-full border border-navy/15 bg-white px-4 py-2 text-xs font-semibold text-navy transition hover:bg-navy/5 disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className="rounded-pill bg-orange px-5 py-2 text-xs font-semibold text-white shadow-panel transition hover:bg-orange/80 disabled:opacity-50"
        >
          {saving ? "Guardando..." : editing ? "Guardar cambios" : "Crear bazar"}
        </button>
      </div>
    </Modal>
  );
}

function Field({
  id,
  label,
  children
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-semibold text-navy/60">
        {label}
      </label>
      {children}
    </div>
  );
}
