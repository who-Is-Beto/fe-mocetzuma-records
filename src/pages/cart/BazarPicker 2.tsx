import { formatShortDate } from "../../app/lib/format";
import type { Bazar } from "../../app/domain/bazares";

type BazarPickerProps = {
  bazares: Bazar[];
  selectedId: number | null;
  onSelect: (id: number) => void;
};

/**
 * Radio list of upcoming bazares for checkout pickup selection. Rendered as
 * a radiogroup so screen readers announce selection changes correctly.
 */
export function BazarPicker({ bazares, selectedId, onSelect }: BazarPickerProps) {
  return (
    <div className="max-h-64 space-y-2 overflow-y-auto pr-1 [scrollbar-width:thin]">
      <div
        role="radiogroup"
        aria-label="Selecciona el bazar donde recogerás tu pedido"
        className="space-y-2"
      >
        {bazares.map((bazar) => {
          const selected = selectedId === bazar.id;
          return (
            <button
              key={bazar.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onSelect(bazar.id)}
              className={`flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange ${
                selected
                  ? "border-orange bg-sun/20"
                  : "border-navy/10 bg-white hover:border-navy/25"
              }`}
            >
              {/* custom radio dot */}
              <span
                aria-hidden="true"
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                  selected ? "border-orange" : "border-navy/30"
                }`}
              >
                {selected && (
                  <span className="h-2 w-2 rounded-full bg-orange" />
                )}
              </span>
              {bazar.image_url ? (
                <img
                  src={bazar.image_url}
                  alt=""
                  loading="lazy"
                  className="h-12 w-12 shrink-0 rounded-lg border border-navy/10 object-cover object-top"
                />
              ) : (
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-navy/10 bg-sand text-lg">
                  🎪
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate font-display text-xs text-denim">
                  {bazar.name}
                </span>
                <span className="mt-0.5 block truncate text-[11px] font-semibold capitalize text-orange">
                  📅 {formatShortDate(bazar.date)}
                  {bazar.schedule ? ` · ${bazar.schedule}` : ""}
                </span>
                <span className="block truncate text-[11px] text-navy/70">
                  📍 {bazar.address}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
