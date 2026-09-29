import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode
} from "react";
import { createPortal } from "react-dom";
import { useOnClickOutside } from "../app/hooks/useOnClickOutside";

type DropdownProps = {
  /** Trigger content, e.g. the current selection as chips. */
  label: ReactNode;
  /** Accessible name of the trigger and the menu. */
  ariaLabel: string;
  /** Menu items (`DropdownCheckboxItem`) and optional helper text. */
  children: ReactNode;
  /** Which trigger edge the panel lines up with. */
  align?: "start" | "end";
};

const ITEM_SELECTOR = '[role^="menuitem"]';
/** Space between trigger and panel, and the minimum distance to the viewport edge (px). */
const GAP = 8;

/**
 * Popover menu in the design system. Closes on click outside, Escape
 * (focus back to the trigger) and Tab; ArrowUp/Down, Home and End move
 * between items. Stays open while items are toggled (multi-select).
 *
 * The panel is portaled to <body> with fixed positioning, so no ancestor can
 * clip it (overflow-hidden) or paint over it (a backdrop-blur card is its own
 * stacking context). It opens below the trigger, flips above when there's no
 * room, stays inside the viewport and follows the trigger on scroll/resize.
 */
export function Dropdown({ label, ariaLabel, children, align = "start" }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const close = useCallback(() => setOpen(false), []);
  // The panel lives in a portal, outside rootRef's DOM tree.
  const insideRefs = useMemo(() => [rootRef, panelRef], []);
  useOnClickOutside(insideRefs, close, open);

  // Written straight to the DOM (no state): runs before paint, so no flicker.
  const place = useCallback(() => {
    const trigger = triggerRef.current;
    const panel = panelRef.current;
    if (!trigger || !panel) return;
    const rect = trigger.getBoundingClientRect();
    const { offsetWidth: width, offsetHeight: height } = panel;
    const fitsBelow = rect.bottom + GAP + height <= window.innerHeight - GAP;
    const fitsAbove = rect.top - GAP - height >= GAP;
    const top = fitsBelow || !fitsAbove ? rect.bottom + GAP : rect.top - GAP - height;
    const preferredLeft = align === "end" ? rect.right - width : rect.left;
    const left = Math.min(Math.max(preferredLeft, GAP), window.innerWidth - width - GAP);
    panel.style.top = `${top}px`;
    panel.style.left = `${left}px`;
    panel.style.visibility = "visible";
  }, [align]);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true); // capture: any scrolling ancestor
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, place]);

  // Keyboard users land on the first item as soon as the menu opens.
  useEffect(() => {
    if (open) panelRef.current?.querySelector<HTMLElement>(ITEM_SELECTOR)?.focus();
  }, [open]);

  const focusItem = (index: number) => {
    const items = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(ITEM_SELECTOR) ?? []);
    if (items.length) items[(index + items.length) % items.length].focus();
  };

  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
    }
  };

  const onPanelKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(ITEM_SELECTOR) ?? []);
    const current = items.indexOf(document.activeElement as HTMLElement);
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        focusItem(current + 1);
        break;
      case "ArrowUp":
        event.preventDefault();
        focusItem(Math.max(current, 0) - 1);
        break;
      case "Home":
        event.preventDefault();
        focusItem(0);
        break;
      case "End":
        event.preventDefault();
        focusItem(-1);
        break;
      case "Escape":
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
        break;
      case "Tab":
        // The panel sits at the end of <body>: hand focus back to the trigger
        // so Tab order continues from where the menu was opened.
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
        break;
    }
  };

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onTriggerKeyDown}
        className="-mx-2 flex items-center gap-1.5 rounded-xl border border-transparent px-2 py-1 text-left transition hover:border-navy/10 hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange/40 aria-expanded:border-orange/40 aria-expanded:bg-white"
      >
        {label}
        <span
          aria-hidden="true"
          className={`text-[10px] transition ${open ? "rotate-180 text-orange" : "text-navy/40"}`}
        >
          ▾
        </span>
      </button>
      {open &&
        createPortal(
          <div
            ref={panelRef}
            id={menuId}
            role="menu"
            aria-label={ariaLabel}
            onKeyDown={onPanelKeyDown}
            // invisible until place() measures it; z-40 stays under modals (z-50).
            className="invisible fixed left-0 top-0 z-40 max-h-[60vh] min-w-[13rem] max-w-[calc(100vw-1rem)] overflow-y-auto rounded-2xl border border-navy/10 bg-cream p-1.5 shadow-card animate-modal-in"
          >
            {children}
          </div>,
          document.body
        )}
    </div>
  );
}

type DropdownCheckboxItemProps = {
  checked: boolean;
  onToggle: () => void;
  /** Stays focusable (aria-disabled) so keyboard focus survives a busy state. */
  disabled?: boolean;
  title?: string;
  children: ReactNode;
};

/** Multi-select menu item with a design-system check box. */
export function DropdownCheckboxItem({
  checked,
  onToggle,
  disabled = false,
  title,
  children
}: DropdownCheckboxItemProps) {
  return (
    <button
      type="button"
      role="menuitemcheckbox"
      aria-checked={checked}
      aria-disabled={disabled || undefined}
      title={title}
      onClick={() => !disabled && onToggle()}
      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm text-navy outline-none transition hover:bg-sun/20 focus-visible:bg-sun/20 focus-visible:ring-2 focus-visible:ring-orange/40 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:hover:bg-transparent"
    >
      <span
        aria-hidden="true"
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-md border text-[10px] font-bold leading-none transition ${
          checked ? "border-orange bg-orange text-charcoal" : "border-navy/25 bg-white"
        }`}
      >
        {checked && "✓"}
      </span>
      {children}
    </button>
  );
}
