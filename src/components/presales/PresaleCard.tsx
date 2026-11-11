import { Link } from "react-router-dom";
import type { Presale } from "../../app/domain/presales";
import { currency } from "../../app/lib/format";
import { Img } from "../Img";
import { activeOptions, closingLabel, copiesLabel, copiesSummary, daysUntil, minDeposit } from "./presaleText";

type Props = { presale: Presale; featured?: boolean; priority?: boolean };

/**
 * A presale on the home page: the cover big, then the facts a buyer needs to
 * decide (price, deposit, copies left, closing date) and one action.
 * `featured` lays it out wide when it's the only open presale.
 */
export function PresaleCard({ presale, featured = false, priority = false }: Props) {
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
      className={`group grid h-full grid-rows-[auto_1fr] overflow-hidden rounded-[22px] bg-white/80 shadow-card ring-1 ring-navy/10 transition duration-300 ease-out hover:-translate-y-0.5 hover:shadow-panel focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${
        featured ? "md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:grid-rows-1" : ""
      }`}
    >
      <div className="relative aspect-square overflow-hidden bg-sand">
        {presale.cover ? (
          <Img
            src={presale.cover}
            alt={`${presale.title} — ${presale.artist}`}
            width={featured ? 560 : 420}
            sizes={featured ? "(min-width: 768px) 46vw, 92vw" : "(min-width: 1024px) 30vw, (min-width: 640px) 46vw, 92vw"}
            priority={priority}
            className="h-full w-full object-cover transition duration-700 ease-out group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-5xl" aria-hidden="true">💿</div>
        )}
        <span className="absolute left-3 top-3 rounded-pill bg-navy px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-cream">
          Preventa
        </span>
        {discount > 0 && !soldOut ? (
          <span className="absolute bottom-3 left-3 rounded-pill bg-orange px-3 py-1 text-xs font-bold text-charcoal shadow">
            Paga completo y ahorra {currency(discount)}
          </span>
        ) : null}
      </div>

      <div className={`flex min-w-0 flex-col p-5 ${featured ? "md:p-8 lg:p-10" : ""}`}>
        <p className="truncate text-[11px] font-semibold uppercase tracking-[0.16em] text-navy/70">{presale.artist}</p>
        <h3
          className={`mt-1.5 font-display leading-tight text-denim transition group-hover:text-orange ${
            featured ? "text-2xl sm:text-3xl" : "text-lg"
          }`}
        >
          {presale.title}
        </h3>

        {options.length > 1 ? (
          <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Versiones">
            {options.map((o) => (
              <li
                key={o.id}
                className={`rounded-pill border px-2.5 py-0.5 text-xs font-semibold ${
                  o.copies_left > 0 ? "border-navy/15 text-navy" : "border-navy/10 text-navy/40 line-through"
                }`}
              >
                {o.name}
              </li>
            ))}
          </ul>
        ) : null}

        <dl className={`mt-4 grid grid-cols-2 gap-x-4 gap-y-3 ${featured ? "sm:mt-6" : ""}`}>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-navy/60">Precio</dt>
            <dd className="mt-0.5 text-lg font-semibold tabular-nums text-navy">
              {samePrice ? "" : "Desde "}
              {currency(presale.price_from ?? 0)}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-navy/60">Apártalo con</dt>
            <dd className="mt-0.5 text-lg font-semibold tabular-nums text-navy">{currency(minDeposit(presale))}</dd>
          </div>
        </dl>

        <div className="mt-5">
          <div className="flex items-baseline justify-between gap-3 text-xs">
            <span className={`font-semibold ${soldOut ? "text-coral" : "text-navy"}`}>{copiesLabel(left, total)}</span>
            <span className={`font-semibold ${closesSoon && !soldOut ? "text-coral" : "text-navy/70"}`}>
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
          <p className="mt-4 text-sm text-navy/70">Llega aprox. {presale.estimated_arrival}</p>
        ) : null}

        <div className={`mt-auto ${featured ? "pt-7" : "pt-5"}`}>
          <span
            className={`inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-pill px-6 text-sm font-semibold transition duration-300 ${
              featured ? "sm:w-auto" : ""
            } ${soldOut ? "bg-navy/10 text-navy/60" : "bg-orange text-charcoal group-hover:bg-amber"}`}
          >
            {soldOut ? "Ver preventa" : "Apartar mi copia"}
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
