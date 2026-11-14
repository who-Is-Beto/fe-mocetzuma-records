import type { PresaleOption } from "../../app/domain/presales";
import { currency } from "../../app/lib/format";
import { Img } from "../../components/Img";

type Props = {
  options: PresaleOption[];
  selectedId: number | null;
  /** Shown for versions without their own photo. */
  fallbackImage: string | null;
  onPick: (option: PresaleOption) => void;
};

/** Every version as a photo card, so buyers see what each one looks like before picking. */
export function VersionPicker({ options, selectedId, fallbackImage, onPick }: Props) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-navy">Elige tu versión</legend>
      <div role="radiogroup" className="mt-3 grid gap-2 sm:grid-cols-3 sm:gap-3">
        {options.map((o) => {
          const out = o.copies_left <= 0;
          const active = o.id === selectedId;
          const image = o.image ?? fallbackImage;
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={out}
              onClick={() => onPick(o)}
              className={`group flex items-center gap-3 rounded-2xl bg-white/80 p-2 text-left sm:flex-col sm:items-stretch sm:gap-0 ring-1 transition duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange active:scale-[0.98] disabled:cursor-not-allowed ${
                active ? "ring-2 ring-orange" : "ring-navy/10 enabled:hover:-translate-y-0.5 enabled:hover:ring-orange/50"
              }`}
            >
              <span className="relative block aspect-square w-16 shrink-0 overflow-hidden rounded-xl bg-sand sm:w-auto">
                {image ? (
                  <Img
                    src={image}
                    alt=""
                    width={240}
                    sizes="(min-width: 640px) 160px, 64px"
                    className={`h-full w-full object-cover transition duration-500 group-enabled:group-hover:scale-[1.03] ${out ? "opacity-40 grayscale" : ""}`}
                  />
                ) : (
                  <span className="flex h-full items-center justify-center text-2xl sm:text-4xl" aria-hidden="true">💿</span>
                )}
                {active && (
                  <span className="absolute right-1 top-1 flex h-5 w-5 sm:right-2 sm:top-2 sm:h-6 sm:w-6 items-center justify-center rounded-full bg-orange text-xs font-bold text-charcoal" aria-hidden="true">
                    ✓
                  </span>
                )}
              </span>
              <span className="min-w-0 px-1 sm:mt-2 sm:pb-1">
                <span className="block text-sm font-semibold leading-snug text-navy">{o.name}</span>
                <span className={`block text-xs tabular-nums ${out ? "text-coral" : "text-navy/70"}`}>
                  {out ? "Agotado" : `${currency(o.price)} · quedan ${o.copies_left}`}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
