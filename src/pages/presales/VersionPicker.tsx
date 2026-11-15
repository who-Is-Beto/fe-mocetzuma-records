import type { PresaleOption } from "../../app/domain/presales";
import { currency } from "../../app/lib/format";
import { Img } from "../../components/Img";

type Props = {
  options: PresaleOption[];
  /** Copies picked per version id. */
  quantities: Record<number, number>;
  /** Shown for versions without their own photo. */
  fallbackImage: string | null;
  onChange: (option: PresaleOption, quantity: number) => void;
  /** The version whose photo the page shows big. */
  onFocus: (option: PresaleOption) => void;
};

/** Most copies of a version this buyer can still take: stock, then their per-person limit. */
const maxFor = (o: PresaleOption) =>
  Math.max(0, Math.min(o.copies_left, o.max_per_buyer == null ? Infinity : o.max_per_buyer - o.bought));

const stepButton =
  "flex h-11 w-11 items-center justify-center rounded-full text-lg font-semibold text-navy ring-1 ring-navy/15 transition duration-150 hover:bg-orange/15 hover:ring-orange active:scale-90 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:ring-navy/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange motion-reduce:active:scale-100";

/**
 * Every version with its photo and a − / + for how many copies: rows on phones,
 * cards from tablet up. Several versions can go in one order.
 */
export function VersionPicker({ options, quantities, fallbackImage, onChange, onFocus }: Props) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-navy">{options.length > 1 ? "Elige tus versiones" : "¿Cuántas copias?"}</legend>
      <div className={`mt-3 grid gap-2 sm:gap-3 ${options.length > 1 ? "sm:grid-cols-3" : ""}`}>
        {options.map((o) => {
          const qty = quantities[o.id] ?? 0;
          const max = maxFor(o);
          const out = o.copies_left <= 0;
          const capped = o.max_per_buyer != null && max < o.copies_left;
          const image = o.image ?? fallbackImage;
          const set = (next: number) => {
            onChange(o, Math.max(0, Math.min(next, max)));
            onFocus(o);
          };
          return (
            <div
              key={o.id}
              className={`group flex items-center gap-3 rounded-2xl bg-white/80 p-2 ring-1 transition duration-200 ${
                options.length > 1 ? "sm:flex-col sm:items-stretch sm:gap-0" : ""
              } ${qty > 0 ? "ring-2 ring-orange" : "ring-navy/10 hover:ring-orange/50"} ${out ? "opacity-70" : ""}`}
            >
              <button
                type="button"
                onClick={() => (qty === 0 && max > 0 ? set(1) : onFocus(o))}
                disabled={out}
                aria-label={qty === 0 && max > 0 ? `Agregar ${o.name}` : `Ver ${o.name}`}
                className={`relative block aspect-square w-16 shrink-0 overflow-hidden rounded-xl bg-sand focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange disabled:cursor-not-allowed ${
                  options.length > 1 ? "sm:w-auto" : ""
                }`}
              >
                {image ? (
                  <Img
                    src={image}
                    alt=""
                    width={240}
                    sizes="(min-width: 640px) 160px, 64px"
                    className={`h-full w-full object-cover transition duration-500 group-hover:scale-[1.03] motion-reduce:group-hover:scale-100 ${out ? "grayscale" : ""}`}
                  />
                ) : (
                  <span className="flex h-full items-center justify-center text-2xl" aria-hidden="true">💿</span>
                )}
                {qty > 0 && (
                  <span
                    key={qty}
                    className="absolute right-1 top-1 flex h-6 min-w-6 animate-qty-pop items-center justify-center rounded-full bg-orange px-1.5 text-xs font-bold tabular-nums text-charcoal motion-reduce:animate-none sm:right-2 sm:top-2"
                    aria-hidden="true"
                  >
                    {qty}
                  </span>
                )}
              </button>

              <div className={`flex min-w-0 flex-1 flex-col items-start gap-1 min-[400px]:flex-row min-[400px]:items-center min-[400px]:gap-2 ${options.length > 1 ? "sm:mt-2 sm:flex-col sm:items-stretch sm:px-1 sm:pb-1" : ""}`}>
                <div className="min-w-0 max-w-full flex-1 px-1">
                  <p className="break-words text-sm font-semibold leading-snug text-navy">{o.name}</p>
                  <p className={`text-xs tabular-nums ${out ? "text-coral" : "text-navy/70"}`}>
                    {out ? "Agotado" : `${currency(o.price)} · quedan ${o.copies_left}`}
                  </p>
                  {capped && !out && (
                    <p className="text-[11px] text-navy/60">
                      Máximo {o.max_per_buyer} por persona{o.bought ? ` · ya tienes ${o.bought}` : ""}
                    </p>
                  )}
                </div>
                {!out && (
                  <div className="flex shrink-0 items-center gap-1.5 sm:justify-between">
                    <button type="button" onClick={() => set(qty - 1)} disabled={qty === 0} aria-label={`Quitar una de ${o.name}`} className={stepButton}>
                      −
                    </button>
                    <span key={qty} className="w-6 animate-qty-pop text-center text-base font-semibold tabular-nums text-navy motion-reduce:animate-none" aria-live="polite">
                      {qty}
                    </span>
                    <button type="button" onClick={() => set(qty + 1)} disabled={qty >= max} aria-label={`Agregar una de ${o.name}`} className={stepButton}>
                      +
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
