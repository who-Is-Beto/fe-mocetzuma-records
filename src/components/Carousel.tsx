import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

type CarouselProps = {
  /** Accessible name of the carousel ("Recién llegados"). */
  label: string;
  /** While the slides are skeletons. */
  busy?: boolean;
  /** Names of the arrow buttons, in the section's own words. */
  prevLabel?: string;
  nextLabel?: string;
  /** The slides: `<li>` elements, each with its own width class and `snap-start`. */
  children: ReactNode;
};

const arrow =
  "flex h-11 w-11 items-center justify-center rounded-full border border-navy/15 bg-cream text-navy shadow-card transition duration-300 hover:-translate-y-0.5 hover:border-orange hover:text-orange active:translate-y-0 active:scale-95 disabled:pointer-events-none disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange motion-reduce:transition-none motion-reduce:hover:translate-y-0";

/**
 * Horizontal carousel on native scrolling: swipe, trackpad and arrow keys
 * just work, slides snap into place, no library and no autoplay. Arrow buttons
 * page by one screenful and a thin bar shows how far along you are.
 *
 * On phones and tablets the track bleeds to the screen edges (Layout's
 * px-6 / md:px-10) so slides glide out instead of being cut at the gutter;
 * from `lg` it sits on the content edges like every other block.
 */
export function Carousel({ label, busy = false, prevLabel = "Anteriores", nextLabel = "Siguientes", children }: CarouselProps) {
  const trackRef = useRef<HTMLUListElement>(null);
  const frame = useRef(0);
  const [position, setPosition] = useState({ start: true, end: false, progress: 0, visible: 1 });

  // At most one layout read per frame, however fast the scroll events come.
  const measure = useCallback(() => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const track = trackRef.current;
      if (!track) return;
      const max = track.scrollWidth - track.clientWidth;
      setPosition({
        start: track.scrollLeft <= 4,
        end: track.scrollLeft >= max - 4,
        progress: max > 0 ? track.scrollLeft / max : 0,
        visible: track.scrollWidth > 0 ? track.clientWidth / track.scrollWidth : 1
      });
    });
  }, []);

  // Re-measure when the track or its slides change size (resize, images, new slides).
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const observer = new ResizeObserver(measure);
    observer.observe(track);
    Array.from(track.children).forEach((slide) => observer.observe(slide));
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame.current);
    };
  }, [measure, children]);

  const page = (direction: 1 | -1) => {
    const track = trackRef.current;
    if (!track) return;
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    // One screenful minus a slide, so the last visible slide stays as context.
    track.scrollBy({ left: direction * track.clientWidth * 0.8, behavior: still ? "auto" : "smooth" });
  };

  const bar = Math.max(position.visible, 0.1);
  const scrollable = position.visible < 0.99;

  return (
    <div role="region" aria-roledescription="carrusel" aria-label={label} aria-busy={busy || undefined} className="mt-8">
      <ul
        ref={trackRef}
        onScroll={measure}
        tabIndex={0}
        className="no-scrollbar -mx-6 flex snap-x snap-mandatory scroll-px-6 gap-3 overflow-x-auto overscroll-x-contain px-6 pb-6 pt-1 outline-none focus-visible:ring-2 focus-visible:ring-orange/40 sm:gap-5 md:-mx-10 md:scroll-px-10 md:px-10 lg:mx-0 lg:scroll-px-0 lg:gap-6 lg:px-0"
      >
        {children}
      </ul>

      {/* Controls: progress bar (it doubles as a "there's more" hint); arrows from sm. Hidden when it all fits. */}
      {scrollable && (
        <div className="mt-1 flex items-center gap-4">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-navy/10" aria-hidden="true">
            <div
              className="h-full rounded-full bg-orange transition-[margin,width] duration-300 ease-out motion-reduce:transition-none"
              style={{ width: `${bar * 100}%`, marginLeft: `${position.progress * (1 - bar) * 100}%` }}
            />
          </div>
          <div className="hidden gap-2 sm:flex">
            <button type="button" className={arrow} onClick={() => page(-1)} disabled={position.start} aria-label={prevLabel}>
              <span aria-hidden="true">←</span>
            </button>
            <button type="button" className={arrow} onClick={() => page(1)} disabled={position.end} aria-label={nextLabel}>
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
