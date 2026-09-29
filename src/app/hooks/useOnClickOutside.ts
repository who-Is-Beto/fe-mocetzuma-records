import { useEffect, type RefObject } from "react";

type OutsideEvent = MouseEvent | TouchEvent;

/**
 * Calls `handler` when a mousedown/touchstart lands outside `ref`'s element.
 * Adapted from who-Is-Beto/nextjs-postgres-task-crud (hooks/useOnClickOutside).
 *
 * Pass several refs when one widget spans separate DOM trees (e.g. a trigger
 * plus a portal-rendered panel): a click inside any of them isn't "outside".
 * Pass a stable `handler` (useCallback) and a stable refs array (useMemo): a
 * new identity re-subscribes the listeners. `enabled: false` detaches them
 * (e.g. while a dropdown is closed).
 */
export function useOnClickOutside<T extends HTMLElement = HTMLElement>(
  ref: RefObject<T | null> | RefObject<T | null>[],
  handler: (event: OutsideEvent) => void,
  enabled = true
) {
  useEffect(() => {
    if (!enabled) return;
    const refs = Array.isArray(ref) ? ref : [ref];
    const listener = (event: OutsideEvent) => {
      const target = event.target as Node;
      const elements = refs.map((r) => r.current).filter((el): el is T => el !== null);
      if (elements.length === 0 || elements.some((el) => el.contains(target))) return;
      handler(event);
    };

    document.addEventListener("mousedown", listener);
    document.addEventListener("touchstart", listener);
    return () => {
      document.removeEventListener("mousedown", listener);
      document.removeEventListener("touchstart", listener);
    };
  }, [ref, handler, enabled]);
}
