import type { ReactNode } from "react";
import { Modal } from "./Modal";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  /** Body of the confirmation. May include highlighted spans. */
  message: ReactNode;
  confirmLabel: string;
  /** Label shown on the confirm button while `busy` (e.g. "Eliminando..."). */
  busyLabel?: string;
  cancelLabel?: string;
  /** Danger styling for destructive confirmations (default). */
  tone?: "danger" | "primary";
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Reusable "¿seguro?" dialog for destructive or irreversible actions.
 * Built on the accessible Modal primitive.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  busyLabel = "...",
  cancelLabel = "Cancelar",
  tone = "danger",
  busy = false,
  error,
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
  const confirmClasses =
    tone === "danger"
      ? "rounded-pill bg-red-600 px-5 py-2 text-xs font-semibold text-white shadow-panel transition hover:bg-red-700 disabled:opacity-50"
      : "rounded-pill bg-orange px-5 py-2 text-xs font-semibold text-white shadow-panel transition hover:bg-orange/80 disabled:opacity-50";

  return (
    <Modal open={open} onClose={onCancel} dismissible={!busy} labelledBy="confirm-dialog-title">
      <h3 id="confirm-dialog-title" className="font-display text-lg text-denim">
        {title}
      </h3>
      <div className="mt-2 text-sm text-navy/70">{message}</div>

      {error ? (
        <div
          role="alert"
          className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700"
        >
          {error}
        </div>
      ) : null}

      <div className="mt-6 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="rounded-full border border-navy/15 bg-white px-4 py-2 text-xs font-semibold text-navy transition hover:bg-navy/5 disabled:opacity-50"
        >
          {cancelLabel}
        </button>
        <button type="button" onClick={onConfirm} disabled={busy} className={confirmClasses}>
          {busy ? busyLabel : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
