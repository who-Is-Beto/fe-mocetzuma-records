import { formatEventDate } from "../../app/lib/format";
import type { PickupBazar } from "../../app/domain/bazares";

// Only real URLs become clickable; plain tracking codes stay static text.
export const isHttpUrl = (value: string) => /^https?:\/\//i.test(value.trim());

type PickupBazarInfoProps = {
  bazar: PickupBazar;
};

/**
 * "Recoges en bazar" summary card shown inside an order when the order was
 * set up for pickup at one of our flea-market stands.
 */
export function PickupBazarInfo({ bazar }: PickupBazarInfoProps) {
  return (
    <div className="rounded-xl border border-navy/10 bg-cream/70 p-3 text-xs text-navy/80 shadow-inner">
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-orange">
        🎪 Recoges en bazar
      </p>
      <p className="font-semibold text-navy">{bazar.name}</p>
      <p className="mt-0.5">
        📅 {formatEventDate(bazar.date)}
        {bazar.schedule ? ` · 🕛 ${bazar.schedule}` : ""}
      </p>
      <p>📍 {bazar.address}</p>
      {isHttpUrl(bazar.google_maps_url) ? (
        <a
          href={bazar.google_maps_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-block font-semibold text-denim underline underline-offset-2 transition hover:text-orange"
        >
          🗺️ Ver en Google Maps
        </a>
      ) : null}
    </div>
  );
}
