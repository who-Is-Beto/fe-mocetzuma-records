import type { ReactNode } from "react";
import { createPortal } from "react-dom";

type ToastTone = "success" | "warning" | "error";

type ToastProps = {
  message: string;
  tone?: ToastTone;
  onClose?: () => void;
  action?: ReactNode;
};

const toneStyles: Record<ToastTone, string> = {
  success: "border-green-600/70 bg-green-100 text-navy shadow-panel",
  warning: "border-amber/80 bg-amber/90 text-charcoal shadow-panel",
  error: "border-coral/80 bg-coral/90 text-navy shadow-panel"
};

export function Toast({
  message,
  tone = "success",
  onClose,
  action
}: ToastProps) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-50 flex items-start justify-center px-4 pt-4 sm:px-6 sm:pt-6">
      <div
        className={`pointer-events-auto min-w-[320px] max-w-md rounded-2xl border px-4 py-3 text-sm shadow-panel/strong backdrop-blur-md ${toneStyles[tone]}`}
      >
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <p className="font-semibold">
              {tone === "error"
                ? "Error"
                : tone === "warning"
                ? "Aviso"
                : "Listo"}
            </p>
            <p className="text-sm text-inherit">{message}</p>
          </div>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-white/40 px-2 py-1 text-[11px] font-semibold text-navy shadow-inner transition hover:-translate-y-0.5"
            >
              Cerrar
            </button>
          ) : null}
        </div>
        {action ? <div className="mt-2">{action}</div> : null}
      </div>
    </div>,
    document.body
  );
}

export default Toast;
