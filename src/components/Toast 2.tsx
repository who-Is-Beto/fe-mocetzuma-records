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
  success: "border-amber/80 bg-sun/95 text-charcoal",
  warning: "border-amber/80 bg-amber/95 text-charcoal",
  error: "border-coral/70 bg-coral/95 text-cream"
};

const toneLabel: Record<ToastTone, string> = {
  success: "Listo",
  warning: "Aviso",
  error: "Error"
};

export function Toast({ message, tone = "success", onClose, action }: ToastProps) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-50 flex items-start justify-center px-4 pt-4 sm:px-6 sm:pt-6">
      <div
        className={`pointer-events-auto min-w-[320px] max-w-md rounded-2xl border px-4 py-3 text-sm shadow-panel backdrop-blur-md ${toneStyles[tone]}`}
      >
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <p className="font-semibold">{toneLabel[tone]}</p>
            <p className="text-sm text-inherit">{message}</p>
          </div>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-white/40 px-2 py-1 text-[11px] font-semibold text-inherit shadow-inner transition hover:-translate-y-0.5"
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
