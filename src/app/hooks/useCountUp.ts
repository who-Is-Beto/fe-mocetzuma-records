import { useEffect, useRef, useState } from "react";

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Animates a number from what it shows now to `target` (ease-out, ~0.9 s),
 * for dashboard figures: first from 0, then between values when a filter
 * changes. Jumps straight to the value with reduced motion.
 */
export function useCountUp(target: number, duration = 900): number {
  const [value, setValue] = useState(() => (reducedMotion() ? target : 0));
  // What's on screen right now, read when a new animation starts.
  const shown = useRef(value);

  useEffect(() => {
    const from = shown.current;
    const instant = reducedMotion();
    let frame = 0;
    let start = 0;
    const tick = (now: number) => {
      if (!start) start = now;
      const t = instant ? 1 : Math.min((now - start) / duration, 1);
      const next = from + (target - from) * (1 - Math.pow(1 - t, 3));
      shown.current = next;
      setValue(next);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return value;
}
