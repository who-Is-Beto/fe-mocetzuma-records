import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";

/** Sheet slide duration (enter, exit, snap back). */
const SHEET_MS = 280;
/** Pull further than this (px), or flick faster than SHEET_FLICK px/ms, to close. */
const SHEET_CLOSE_DISTANCE = 120;
const SHEET_FLICK = 0.5;

type ModalProps = {
  /** Controls rendering; the component renders nothing when closed. */
  open: boolean;
  /** Called on Escape or overlay click (only when `dismissible`). */
  onClose: () => void;
  /** False while a save/delete is in flight — close requests are ignored. */
  dismissible?: boolean;
  /** id of the visible heading, wired to aria-labelledby. */
  labelledBy: string;
  /** "sheet": bottom sheet on mobile (full width, slides up), centered from `sm`. */
  variant?: "center" | "sheet";
  children: ReactNode;
};

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessible modal dialog: role="dialog" + aria-modal, Escape/overlay
 * dismissal, focus moved into the panel on open, Tab cycled inside it and
 * focus returned to the trigger element on close.
 *
 * Overlay markup + animations live here so pages only compose content.
 */
export function Modal({
  open,
  onClose,
  dismissible = true,
  labelledBy,
  variant = "center",
  children
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocused = useRef<Element | null>(null);
  const isSheet = variant === "sheet";

  /* ── Sheet motion: stay mounted while sliding out; `shown` = at rest on screen ── */
  const [rendered, setRendered] = useState(open);
  const [shown, setShown] = useState(false);
  const [dragY, setDragY] = useState<number | null>(null);
  const dragRef = useRef<{ startY: number; lastY: number; lastT: number; velocity: number } | null>(null);
  // Render-time sync with `open` (no effect needed).
  if (open && !rendered) setRendered(true);
  if (!open && shown) setShown(false);

  useEffect(() => {
    if (!isSheet || !rendered) return;
    if (open) {
      // Two frames: paint off-screen first so the transition has a start point.
      let inner = 0;
      const outer = requestAnimationFrame(() => {
        inner = requestAnimationFrame(() => setShown(true));
      });
      return () => {
        cancelAnimationFrame(outer);
        cancelAnimationFrame(inner);
      };
    }
    const t = setTimeout(() => setRendered(false), SHEET_MS);
    return () => clearTimeout(t);
  }, [isSheet, open, rendered]);

  const onDragStart = (event: PointerEvent<HTMLDivElement>) => {
    dragRef.current = { startY: event.clientY, lastY: event.clientY, lastT: event.timeStamp, velocity: 0 };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragY(0);
  };
  const onDragMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dt = event.timeStamp - drag.lastT;
    if (dt > 0) drag.velocity = (event.clientY - drag.lastY) / dt;
    drag.lastY = event.clientY;
    drag.lastT = event.timeStamp;
    setDragY(Math.max(0, event.clientY - drag.startY)); // only downwards
  };
  const onDragEnd = () => {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    const distance = Math.max(0, drag.lastY - drag.startY);
    setDragY(null); // released: animates to 0 (snap back) or off-screen (close)
    if (dismissible && (distance > SHEET_CLOSE_DISTANCE || (distance > 30 && drag.velocity > SHEET_FLICK))) {
      onClose();
    }
  };

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement;
    panelRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (!dismissible) return;
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      // Cycle focus within the dialog while it is open.
      const focusables = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)
      ).filter((el) => el.offsetParent !== null);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      } else if (!panelRef.current.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (previouslyFocused.current instanceof HTMLElement) {
        previouslyFocused.current.focus();
      }
    };
  }, [open, dismissible, onClose]);

  if (isSheet ? !rendered : !open) return null;

  const panelStyle = isSheet
    ? dragY !== null
      ? { transform: `translateY(${dragY}px)`, transition: "none" }
      : {
          transform: shown ? "translateY(0)" : "translateY(100%)",
          transition: `transform ${SHEET_MS}ms cubic-bezier(0.16,1,0.3,1)`,
        }
    : undefined;

  return (
    <div
      className={`fixed inset-0 z-50 flex justify-center overflow-y-auto bg-black/40 backdrop-blur-sm ${
        isSheet ? "items-end sm:items-center sm:p-4" : "items-center p-4 animate-overlay-in"
      }`}
      style={isSheet ? { opacity: shown || dragY !== null ? 1 : 0, transition: `opacity ${SHEET_MS}ms ease-out` } : undefined}
      onClick={() => dismissible && onClose()}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className={
          isSheet
            ? "max-h-[85dvh] w-full overflow-y-auto rounded-t-[28px] border border-navy/10 bg-sand px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-panel outline-none sm:my-8 sm:max-w-md sm:rounded-2xl sm:p-6"
            : "my-8 w-full max-w-md rounded-2xl border border-navy/10 bg-sand p-5 shadow-panel outline-none animate-modal-in sm:p-6"
        }
        style={panelStyle}
        onClick={(event) => event.stopPropagation()}
      >
        {isSheet && (
          // Grab strip: pull down to close (phones; the sheet is a dialog from sm).
          <div
            className="-mx-5 flex h-8 cursor-grab touch-none items-center justify-center active:cursor-grabbing sm:hidden"
            onPointerDown={onDragStart}
            onPointerMove={onDragMove}
            onPointerUp={onDragEnd}
            onPointerCancel={onDragEnd}
            aria-hidden="true"
          >
            <span className="h-1.5 w-12 rounded-full bg-navy/25" />
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
