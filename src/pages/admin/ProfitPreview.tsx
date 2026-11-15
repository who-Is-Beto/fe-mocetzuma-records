type Props = {
  /** List price. */
  price: number;
  cost: number;
  /** Record discount, in percent (Agregar disco). */
  discountPercent?: number;
  /** Fixed MXN off when a presale is paid in full at reservation. */
  fullPaymentDiscount?: number;
  className?: string;
};

const money = (n: number) => `$${n.toFixed(2)}`;

function ProfitLine({ profit }: { profit: number }) {
  return (
    <span className="flex items-center gap-2">
      <span className="text-sm font-semibold text-green-800">Ganancia:</span>
      <span className={`text-sm font-bold ${profit >= 0 ? "text-green-900" : "text-coral"}`}>
        {profit >= 0 ? "+" : ""}
        {money(profit)}
      </span>
    </span>
  );
}

/**
 * Live sell price and profit while pricing a record or a presale version.
 * A presale with a full-payment discount also shows what the store earns when
 * the buyer pays everything up front.
 */
export function ProfitPreview({ price, cost, discountPercent = 0, fullPaymentDiscount = 0, className = "" }: Props) {
  const sell = discountPercent > 0 ? price * (1 - discountPercent / 100) : price;
  const hasDiscount = discountPercent > 0 && price > 0;
  const paidInFull = price - fullPaymentDiscount;

  return (
    <div className={`rounded-xl border border-navy/10 bg-white/60 p-4 backdrop-blur ${className}`}>
      <div className="flex items-center gap-3">
        <span className="text-sm text-navy/60">Precio de venta:</span>
        {hasDiscount ? (
          <>
            <span className="text-sm text-navy/40 line-through">{money(price)}</span>
            <span className="rounded-full bg-orange/10 px-2.5 py-0.5 text-sm font-bold text-orange">{money(sell)}</span>
            <span className="rounded-full bg-coral/10 px-2 py-0.5 text-[11px] font-bold text-coral">-{discountPercent}%</span>
          </>
        ) : (
          <span className="text-sm font-bold text-navy">{money(price)}</span>
        )}
      </div>
      <div className="mt-2">
        <ProfitLine profit={sell - cost} />
      </div>

      {fullPaymentDiscount > 0 && price > 0 && (
        <div className="mt-3 border-t border-navy/10 pt-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-sm text-navy/60">Si paga completo:</span>
            <span className="text-sm text-navy/40 line-through">{money(price)}</span>
            <span className="rounded-full bg-orange/10 px-2.5 py-0.5 text-sm font-bold text-orange">{money(paidInFull)}</span>
            <span className="rounded-full bg-coral/10 px-2 py-0.5 text-[11px] font-bold text-coral">-{money(fullPaymentDiscount)}</span>
          </div>
          <div className="mt-2">
            <ProfitLine profit={paidInFull - cost} />
          </div>
        </div>
      )}
    </div>
  );
}
