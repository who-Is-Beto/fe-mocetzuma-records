import { type ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";

type ToastTone = "success" | "warning" | "error";

type ToastProps = {
  message: string;
  tone?: ToastTone;
  onClose?: () => void;
  action?: ReactNode;
  /** Auto-dismiss in ms (default 5000, set 0 to disable) */
  duration?: number;
};

const toneConfig: Record<
  ToastTone,
  { icon: string; label: string; border: string; bg: string; accent: string }
> = {
  success: {
    icon: "✓",
    label: "Listo",
    border: "border-amber/60",
    bg: "bg-gradient-to-r from-sun/95 to-amber/90",
    accent: "bg-amber"
  },
  warning: {
    icon: "⚠",
    label: "Aviso",
    border: "border-orange/50",
    bg: "bg-gradient-to-r from-orange/20 to-amber/15",
    accent: "bg-orange"
  },
  error: {
    icon: "✗",
    label: "Error",
    border: "border-coral/60",
    bg: "bg-gradient-to-r from-coral/15 to-coral/10",
    accent: "bg-coral"
  }
};

export function Toast({
  message,
  tone = "success",
  onClose,
  action,
  duration = 5000
}: ToastProps) {
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    // Trigger enter animation on next frame
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (duration <= 0 || !onClose) return;
    const timer = setTimeout(() => {
      setClosing(true);
      setTimeout(() => onClose(), 280);
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setClosing(true);
    setTimeout(() => onClose?.(), 280);
  };

  if (typeof document === "undefined") return null;

  const config = toneConfig[tone];

  return createPortal(
    <div
      className="pointer-events-none fixed inset-0 z-50 flex items-end justify-start px-4 pb-4 sm:items-end sm:justify-start sm:px-6 sm:pb-6 md:px-8 md:pb-8 lg:items-end lg:justify-start"
      onClick={handleClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`pointer-events-auto w-full max-w-sm overflow-hidden rounded-2xl border shadow-panel backdrop-blur-md ${
          config.border
        } ${
          closing
            ? "animate-toast-out"
            : visible
            ? "animate-toast-in"
            : "opacity-0"
        }`}
      >
        <div className={`${config.bg} px-4 py-3`}>
          <div className="flex items-start gap-3">
            {/* Icon badge */}
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-cream shadow-sm ${config.accent}`}
            >
              {config.icon}
            </div>

            <div className="flex-1 min-w-0 pt-0.5">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-navy/80">
                {config.label}
              </p>
              <p className="mt-0.5 text-sm leading-snug text-navy">
                {message}
              </p>
            </div>

            {onClose ? (
              <button
                type="button"
                onClick={handleClose}
                className="shrink-0 rounded-full bg-white/50 p-1 text-navy/60 transition hover:bg-white/80 hover:text-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange"
                aria-label="Cerrar"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            ) : null}
          </div>
          {action ? <div className="mt-2.5">{action}</div> : null}
        </div>

        {/* Auto-dismiss progress bar */}
        {duration > 0 && onClose ? (
          <div className="h-1 w-full bg-navy/5">
            <div
              className={`h-full rounded-full ${config.accent} opacity-60 animate-progress-shrink`}
              style={{ animationDuration: `${duration}ms` }}
            />
          </div>
        ) : null}
      </div>
    </div>,
    document.body
  );
}

export default Toast;
