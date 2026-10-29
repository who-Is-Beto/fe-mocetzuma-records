import { useEffect, useRef, useState, type ReactNode } from "react";

type RevealProps = {
  children: ReactNode;
  className?: string;
  /** Extra delay (ms) so siblings in a row cascade. */
  delay?: number;
  as?: "div" | "section" | "li";
};

/**
 * Fades and lifts its content in the first time it scrolls into view. Content
 * already on screen at mount shows immediately (no hidden-then-shown flash for
 * above-the-fold blocks), and without IntersectionObserver it just renders.
 */
export function Reveal({ children, className = "", delay = 0, as: Tag = "div" }: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [state, setState] = useState<"idle" | "hidden" | "shown">("idle");

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    let first = true;
    const observer = new IntersectionObserver(
      ([entry]) => {
        // The first report says where it starts: on screen → leave it alone;
        // below the fold → hide it (off screen, so no flash) until it arrives.
        if (first) {
          first = false;
          // Real viewport, not the -10% margin: a block peeking at the bottom stays visible.
          if (entry.boundingClientRect.top < window.innerHeight) return observer.disconnect();
          return setState("hidden");
        }
        // Scrolled past it (a fast fling, an anchor jump): show it anyway.
        if (!entry.isIntersecting && entry.boundingClientRect.top > 0) return;
        setState("shown");
        observer.disconnect();
      },
      { rootMargin: "0px 0px -10% 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const motion =
    state === "idle"
      ? ""
      : `transition duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          state === "hidden" ? "translate-y-6 opacity-0" : "translate-y-0 opacity-100"
        }`;

  return (
    <Tag
      ref={ref as never}
      className={`${motion} ${className}`}
      style={state === "shown" && delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
