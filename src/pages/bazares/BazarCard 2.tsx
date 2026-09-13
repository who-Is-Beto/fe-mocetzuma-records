import { useState } from "react";
import type { Bazar } from "../../app/domain/bazares";
import { getDateParts, formatEventDate } from "../../app/lib/format";

const canNativeShare =
  typeof navigator !== "undefined" && typeof navigator.share === "function";

const buildShareText = (bazar: Bazar) =>
  `🎪 ${bazar.name}\n📅 ${formatEventDate(bazar.date)}${
    bazar.schedule ? `\n🕛 ${bazar.schedule}` : ""
  }\n📍 ${bazar.address}`;

type BazarCardProps = {
  bazar: Bazar;
};

/**
 * One bazar event card for the public /bazares grid: poster, event-style
 * date badge, details and Cómo llegar/Compartir actions.
 */
export function BazarCard({ bazar }: BazarCardProps) {
  const dateParts = getDateParts(bazar.date);
  // Card whose link was just copied (fallback when the Share API is missing).
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const text = buildShareText(bazar);
    try {
      if (canNativeShare) {
        await navigator.share({
          title: bazar.name,
          text,
          url: bazar.google_maps_url
        });
        return;
      }
      // No Web Share API (most desktops): copy the details to the clipboard.
      await navigator.clipboard.writeText(`${text}\n🗺️ ${bazar.google_maps_url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // User closed the native share sheet — nothing to do.
    }
  };

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-3xl border border-navy/10 bg-white/85 shadow-card backdrop-blur transition hover:-translate-y-0.5 hover:border-orange/40 hover:shadow-panel">
      {/* serape ribbon on the top edge */}
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 z-10 h-1.5 bg-stripes opacity-90"
      />

      {/* ── Poster mat: portrait frame showing the FULL flyer ── */}
      <div className="p-3 pb-0 pt-4 sm:p-4 sm:pb-0">
        <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-navy/10 bg-sand shadow-card">
          {bazar.image_url ? (
            <img
              src={bazar.image_url}
              alt={`Flyer del bazar ${bazar.name}`}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-contain transition duration-300 group-hover:scale-[1.02]"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-navy/30">
              <span className="text-5xl">🎪</span>
              <span className="text-xs font-bold uppercase tracking-wide">
                Bazar
              </span>
            </div>
          )}

          {/* event-style date badge */}
          {dateParts ? (
            <div className="absolute right-2.5 top-2.5 rounded-xl border border-navy/10 bg-white/95 px-2.5 py-1 text-center shadow-card backdrop-blur">
              <p className="font-display text-base leading-none text-coral">
                {dateParts.day}
              </p>
              <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-navy">
                {dateParts.month}
              </p>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-5 sm:p-4">
        <h2 className="font-display text-base leading-snug text-denim">
          {bazar.name}
        </h2>

        <p className="flex items-start gap-1.5 text-xs font-semibold capitalize text-orange">
          <span aria-hidden="true">📅</span> {formatEventDate(bazar.date)}
        </p>

        {bazar.schedule && (
          <p className="flex items-start gap-1.5 text-sm text-navy/80">
            <span aria-hidden="true">🕛</span> {bazar.schedule}
          </p>
        )}

        <p className="flex items-start gap-1.5 text-sm leading-relaxed text-navy/70">
          <span aria-hidden="true">📍</span> {bazar.address}
        </p>

        <div className="mt-auto flex items-center gap-2">
          <a
            href={bazar.google_maps_url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Cómo llegar a ${bazar.name} (abre en Google Maps)`}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-pill border border-navy/15 bg-white px-4 py-2 pt-2.5 text-xs font-semibold text-navy transition hover:border-orange hover:bg-orange hover:text-white"
          >
            🗺️ Cómo llegar
          </a>
          <button
            type="button"
            onClick={() => void handleShare()}
            aria-label={
              copied
                ? "Detalles copiados al portapapeles"
                : `Compartir ${bazar.name}`
            }
            aria-live="polite"
            className={`inline-flex items-center justify-center gap-1.5 rounded-pill border px-4 py-2 pt-2.5 text-xs font-semibold transition ${
              copied
                ? "border-green-300 bg-green-50 text-green-700"
                : "border-navy/15 bg-white text-navy hover:border-navy/30 hover:bg-navy/5"
            }`}
          >
            {copied ? "✅ ¡Copiado!" : canNativeShare ? "📤 Compartir" : "📋 Compartir"}
          </button>
        </div>
      </div>
    </article>
  );
}
