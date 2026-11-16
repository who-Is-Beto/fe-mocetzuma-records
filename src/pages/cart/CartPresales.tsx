import { Link } from "react-router-dom";
import { currency } from "../../app/lib/format";
import { presaleTotals, removePresale, type BagLine } from "../../app/lib/presaleBag";
import { Img } from "../../components/Img";

export type PresalePay = "min" | "full";

type Props = {
  lines: BagLine[];
  pay: PresalePay;
  onPay: (pay: PresalePay) => void;
};

const chip = (active: boolean) =>
  `min-h-[48px] flex-1 rounded-2xl border px-3 py-2 text-left text-sm transition duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange ${
    active ? "border-orange bg-orange/10 text-navy shadow-[inset_0_0_0_1px_theme(colors.orange)]" : "border-navy/15 bg-white/70 text-navy hover:border-orange/60"
  }`;

/**
 * Presales picked on their pages, paid in this same checkout: one row per presale
 * and how much of them to pay today (the deposit or everything, with its discount).
 */
export function CartPresales({ lines, pay, onPay }: Props) {
  const presales = [...new Map(lines.map((l) => [l.presale.slug, l.presale])).values()];
  const { price, full, minimum } = presaleTotals(lines);
  return (
    <section aria-labelledby="cart-presales" className="mt-6 overflow-hidden rounded-[24px] border border-orange/30 bg-cream shadow-card">
      <div className="flex items-center justify-between gap-3 bg-navy px-4 py-3 sm:px-5">
        <h2 id="cart-presales" className="font-display text-base text-cream">📀 Preventas en tu pedido</h2>
        <span className="rounded-pill bg-orange px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-charcoal">
          Llega después
        </span>
      </div>
      <ul className="divide-y divide-navy/10">
        {presales.map((p) => {
          const own = lines.filter((l) => l.presale.slug === p.slug);
          return (
            <li key={p.slug} className="flex items-center gap-3 px-4 py-3 sm:px-5">
              <span className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-sand ring-1 ring-navy/10">
                {p.cover ? <Img src={p.cover} alt="" width={56} className="h-full w-full object-cover" /> : null}
              </span>
              <Link to={`/preventas/${p.slug}`} className="min-w-0 flex-1 hover:text-orange">
                <span className="block truncate text-[11px] font-medium uppercase tracking-[0.14em] text-navy/75">{p.artist}</span>
                <span className="block truncate font-display text-[15px] text-denim">{p.title}</span>
                <span className="block truncate text-xs text-navy/70">
                  {own.map((l) => `${l.option.name} ×${l.quantity}`).join(", ")} ·{" "}
                  {currency(own.reduce((t, l) => t + Number(l.option.price) * l.quantity, 0))}
                </span>
              </Link>
              <button
                type="button"
                onClick={() => removePresale(p.slug)}
                className="min-h-[44px] shrink-0 px-2 text-xs font-semibold text-coral hover:underline"
                aria-label={`Quitar ${p.title} del pedido`}
              >
                Quitar
              </button>
            </li>
          );
        })}
      </ul>
      <fieldset className="border-t border-navy/10 px-4 py-4 sm:px-5">
        <legend className="sr-only">¿Cuánto pagas hoy de la preventa?</legend>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-orange">¿Cuánto pagas hoy de la preventa?</p>
        <div className="flex flex-col gap-2 min-[420px]:flex-row" role="radiogroup">
          <button type="button" role="radio" aria-checked={pay === "min"} onClick={() => onPay("min")} className={chip(pay === "min")}>
            <span className="block font-semibold">Apartar con {currency(minimum)}</span>
            <span className="block text-xs text-navy/70">Liquidas {currency(price - minimum)} en 120 días</span>
          </button>
          <button type="button" role="radio" aria-checked={pay === "full"} onClick={() => onPay("full")} className={chip(pay === "full")}>
            <span className="block font-semibold">Pagar completo {currency(full)}</span>
            <span className="block text-xs text-navy/70">{price > full ? `Ahorras ${currency(price - full)}` : "Ya no debes nada"}</span>
          </button>
        </div>
      </fieldset>
    </section>
  );
}
