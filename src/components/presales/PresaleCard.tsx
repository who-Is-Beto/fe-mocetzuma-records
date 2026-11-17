import { Link } from "react-router-dom";
import type { Presale } from "../../app/domain/presales";
import { currency } from "../../app/lib/format";
import { Img } from "../Img";
import { activeOptions, closingLabel, copiesLabel, copiesSummary, daysUntil, minDeposit } from "./presaleText";

type Props = {
  presale: Presale;
  featured?: boolean;
  priority?: boolean;
  /** Lists (/preventas): a compact row on phones (cover left, facts right), the card from `sm`. */
  dense?: boolean;
};

/**
 * A presale on the home page: the cover big, then the facts a buyer needs to
 * decide (price, deposit, copies left, closing date) and one action.
 * `featured` lays it out wide when it's the only open presale; `dense` turns it
 * into a row on phones so a long list stays scannable.
 */
export function PresaleCard({ presale, featured = false, priority = false, dense = false }: Props) {
  // Phone-only classes of the dense row; from `sm` every card is the same card.
  const row = (rowClasses: string, cardClasses = "") => (dense ? rowClasses : cardClasses);
  const options = activeOptions(presale);
  const { total, left } = copiesSummary(presale);
  const prices = options.map((o) => Number(o.price));
  const samePrice = prices.every((p) => p === prices[0]);
  const discount = Number(presale.max_discount);
  const closesSoon = daysUntil(presale.purchase_deadline) <= 3;
  const soldOut = left <= 0;
  const share = total > 0 ? Math.round(((total - left) / total) * 100) : 0;

  return (
    <Link
      to={`/preventas/${presale.slug}`}
      className={`group grid h-full overflow-hidden ${row("grid-cols-[5.5rem_minmax(0,1fr)] min-[400px]:grid-cols-[8.5rem_minmax(0,1fr)] sm:grid-cols-1 sm:grid-rows-[auto_1fr]", "grid-rows-[auto_1fr]")} rounded-[22px] bg-white/80 shadow-card ring-1 ring-navy/10 transition duration-300 ease-out hover:-translate-y-0.5 hover:shadow-panel focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${
        featured ? "md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:grid-rows-1" : ""
      }`}
    >
      <div className={`relative aspect-square overflow-hidden bg-sand ${row("m-3 mr-0 self-start rounded-2xl sm:m-0 sm:rounded-none")}`}>
        {presale.cover ? (
          <Img
            src={presale.cover}
            alt={`${presale.title} — ${presale.artist}`}
            width={featured ? 560 : 420}
            sizes={
              featured
                ? "(min-width: 768px) 46vw, 92vw"
                : `(min-width: 1024px) 30vw, (min-width: 640px) 46vw, ${dense ? "136px" : "92vw"}`
            }
            priority={priority}
            className="h-full w-full object-cover transition duration-700 ease-out group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-5xl" aria-hidden="true">💿</div>
        )}
        <span className={`absolute left-3 top-3 rounded-pill bg-navy px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-cream ${row("hidden sm:inline")}`}>
          Preventa
        </span>
        {closesSoon && !soldOut ? (
          <span className={`absolute right-3 top-3 rounded-pill bg-coral px-3 py-1 text-[11px] font-bold text-white shadow ${row("hidden sm:inline")}`}>
            {closingLabel(presale.purchase_deadline)}
          </span>
        ) : null}
        {discount > 0 && !soldOut ? (
          <span className={`absolute bottom-3 left-3 rounded-pill bg-orange px-3 py-1 text-xs font-bold text-charcoal shadow ${row("hidden sm:inline")}`}>
            Paga completo y ahorra {currency(discount)}
          </span>
        ) : null}
      </div>

      <div className={`flex min-w-0 flex-col ${row("p-3 sm:p-5", "p-5")} ${featured ? "md:p-8 lg:p-10" : ""}`}>
        <p className="truncate text-[11px] font-semibold uppercase tracking-[0.16em] text-navy/70">{presale.artist}</p>
        <h3
          className={`mt-1.5 font-display leading-tight text-denim transition group-hover:text-orange ${
            featured ? "text-2xl sm:text-3xl" : row("line-clamp-2 text-base sm:text-lg", "text-lg")
          }`}
        >
          {presale.title}
        </h3>

        {options.length > 1 ? (
          // Each version's photo, fanned out on hover: buyers see the choices before opening it.
          <div className={`mt-3 flex items-center gap-3 ${row("hidden sm:flex")}`}>
            <ul className="flex -space-x-3 transition-all duration-300 group-hover:-space-x-1 motion-reduce:transition-none">
              {options.slice(0, 4).map((o) => {
                const image = o.image ?? presale.cover;
                return (
                  <li
                    key={o.id}
                    className={`h-11 w-11 overflow-hidden rounded-lg bg-sand ring-2 ring-white ${o.copies_left > 0 ? "" : "opacity-40 grayscale"}`}
                  >
                    {image ? <Img src={image} alt={o.name} width={44} className="h-full w-full object-cover" /> : null}
                  </li>
                );
              })}
            </ul>
            <span className="text-xs font-semibold text-navy/70">{options.length} versiones</span>
          </div>
        ) : null}

        <dl
          className={`${row("mt-2 grid grid-cols-1 gap-x-4 gap-y-1 sm:mt-4 sm:grid-cols-2 sm:gap-y-3", "mt-4 flex flex-wrap justify-between gap-x-6 gap-y-3")} ${
            featured ? "sm:mt-6" : ""
          }`}
        >
          {[
            { label: "Precio", value: `${samePrice ? "" : "Desde "}${currency(presale.price_from ?? 0)}` },
            { label: "Apártalo con", value: currency(minDeposit(presale)) }
          ].map(({ label, value }) => (
            // Dense row on phones: label and amount on one line; a stacked pair everywhere else.
            <div key={label} className={row("min-[400px]:flex min-[400px]:items-baseline min-[400px]:justify-between min-[400px]:gap-2 sm:block")}>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-navy/60">{label}</dt>
              <dd className={`whitespace-nowrap font-semibold tabular-nums text-navy ${row("text-sm sm:mt-0.5 sm:text-lg", "mt-0.5 text-lg")}`}>
                {value}
              </dd>
            </div>
          ))}
        </dl>

        <div className={row("mt-3 sm:mt-5", "mt-5")}>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-xs">
            <span className={`whitespace-nowrap font-semibold ${soldOut ? "text-coral" : "text-navy"}`}>{copiesLabel(left, total)}</span>
            <span className={`whitespace-nowrap font-semibold ${closesSoon && !soldOut ? "text-coral" : "text-navy/70"}`}>
              {closingLabel(presale.purchase_deadline)}
            </span>
          </div>
          <div
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-navy/10"
            role="progressbar"
            aria-label="Copias apartadas"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={total - left}
          >
            <div className="h-full rounded-full bg-orange" style={{ width: `${share}%` }} />
          </div>
        </div>

        {presale.estimated_arrival ? (
          <p className={`mt-4 text-sm text-navy/70 ${row("hidden sm:block")}`}>Llega aprox. {presale.estimated_arrival}</p>
        ) : null}

        <div className={`mt-auto ${featured ? "pt-7" : row("pt-3 sm:pt-5", "pt-5")}`}>
          <span
            className={`inline-flex w-full items-center ${row("min-h-[44px] sm:min-h-[48px]", "min-h-[48px]")} justify-center gap-2 rounded-pill px-6 text-sm font-semibold transition duration-300 ${
              featured ? "sm:w-auto" : ""
            } ${soldOut ? "bg-navy/10 text-navy/60" : "bg-orange text-charcoal group-hover:bg-amber"}`}
          >
            {soldOut ? "Ver preventa" : dense ? (
              <>
                Apartar<span className="hidden min-[400px]:inline"> mi copia</span>
              </>
            ) : (
              "Apartar mi copia"
            )}
            {!soldOut && (
              <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">
                →
              </span>
            )}
          </span>
        </div>
      </div>
    </Link>
  );
}
