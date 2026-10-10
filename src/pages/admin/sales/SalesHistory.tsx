import { useCallback, useState } from "react";
import { Button } from "../../../components/Button";
import { extractErrorMessage } from "../../../app/lib/httpClient";
import { useServiceQuery } from "../../../app/hooks/useServiceQuery";
import type { createSalesService } from "../../../app/services/salesService";
import { PAYMENT_METHOD_LABELS, type Sale } from "../../../app/domain/sales";
import { currency, formatStoreDateTime } from "../../../app/lib/format";
import { ReceiptPrinter } from "./SaleReceipt";
import { Img } from "../../../components/Img";

type Props = {
  salesService: ReturnType<typeof createSalesService>;
  dateFrom: string;
  dateTo: string;
  /** "" = every owner. */
  ownerId: string;
};

const PAYMENT_BADGE: { [method in Sale["payment_method"]]: string } = {
  cash: "bg-green-100 text-green-700",
  card: "bg-denim/10 text-denim",
  transfer: "bg-sun/50 text-navy",
  "": "bg-navy/5 text-navy/50"
};

/** Ventas → Registro: one card per ticket, with its printable receipt. */
export function SalesHistory({ salesService, dateFrom, dateTo, ownerId }: Props) {
  // Stable fetcher: useServiceQuery refetches whenever the fetcher identity changes.
  const fetchSales = useCallback(
    () =>
      salesService.list({
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        owner: ownerId || undefined
      }),
    [salesService, dateFrom, dateTo, ownerId]
  );
  const report = useServiceQuery([salesService], fetchSales);
  const [printing, setPrinting] = useState<Sale | null>(null);
  const stopPrinting = useCallback(() => setPrinting(null), []);

  const sales = report.data?.results ?? [];
  const totals = report.data?.totals;
  const error = report.isError
    ? extractErrorMessage(report.error, "No se pudieron cargar las ventas.")
    : null;
  const ownerSuffix = ownerId ? " del dueño" : "";

  return (
    <>
      {/* ── Error ── */}
      {error && (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
          <Button
            tone="outline"
            className="ml-3 px-3 py-1 text-xs"
            onClick={() => void report.refetch().catch(() => {})}
          >
            Reintentar
          </Button>
        </div>
      )}

      {/* ── Loading ── */}
      {report.isLoading && (
        <div className="mt-8 flex justify-center">
          <p className="text-sm text-navy/50 animate-pulse">Cargando…</p>
        </div>
      )}

      {/* ── Empty state ── */}
      {report.isSuccess && sales.length === 0 && (
        <div className="mt-12 text-center">
          <p className="text-lg text-navy/40">🧾</p>
          <p className="mt-2 text-sm text-navy/50">No hay ventas con estos filtros.</p>
        </div>
      )}

      {report.isSuccess && sales.length > 0 && totals && (
        <>
          {/* ── Totals ── */}
          <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { label: "Ventas", value: String(sales.length) },
              { label: `Subtotal${ownerSuffix}`, value: currency(totals.subtotal) },
              { label: `Comisiones${ownerSuffix}`, value: currency(totals.commission) },
              { label: `Total neto${ownerSuffix}`, value: currency(totals.net), strong: true },
              { label: `Costo${ownerSuffix}`, value: currency(totals.cost) },
              {
                label: `${Number(totals.profit) < 0 ? "Pérdida" : "Ganancia"}${ownerSuffix}`,
                value: currency(totals.profit),
                strong: true,
                negative: Number(totals.profit) < 0
              }
            ].map((tile) => (
              <div
                key={tile.label}
                className="rounded-2xl border border-navy/10 bg-cream/80 px-4 py-3 shadow-card backdrop-blur"
              >
                <dt className="text-[11px] uppercase tracking-[0.16em] text-orange">{tile.label}</dt>
                <dd
                  className={`mt-1 font-semibold tabular-nums ${tile.strong ? "text-lg" : ""} ${
                    tile.negative ? "text-coral" : tile.strong ? "text-denim" : "text-navy"
                  }`}
                >
                  {tile.value}
                </dd>
              </div>
            ))}
          </dl>
          {totals.units_without_cost > 0 && (
            <p role="status" className="mt-2 rounded-xl border border-orange/40 bg-sun/30 px-4 py-2.5 text-xs text-navy">
              ⚠️ {totals.units_without_cost}{" "}
              {totals.units_without_cost === 1 ? "disco vendido no tenía" : "discos vendidos no tenían"} precio de
              costo registrado: cuentan como ganancia completa. Registra el costo en cada disco para que las
              próximas ventas lo guarden.
            </p>
          )}

          {/* ── Tickets ── */}
          <ul className="mt-4 space-y-3">
            {sales.map((sale) => (
              <li
                key={sale.id}
                className="rounded-2xl border border-navy/10 bg-cream/80 p-4 shadow-card backdrop-blur sm:p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-orange">Venta #{sale.id}</p>
                    <p className="mt-0.5 text-sm text-navy/60">{formatStoreDateTime(sale.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${PAYMENT_BADGE[sale.payment_method]}`}
                    >
                      {PAYMENT_METHOD_LABELS[sale.payment_method]}
                    </span>
                    <Button
                      tone="outline"
                      className="px-3 py-1.5 text-xs"
                      onClick={() => setPrinting(sale)}
                      aria-label={`Imprimir ticket de la venta ${sale.id}`}
                    >
                      🖨 Imprimir ticket
                    </Button>
                  </div>
                </div>

                <ul className="mt-3 divide-y divide-navy/5 rounded-xl border border-navy/10 bg-white/60">
                  {sale.items.map((item) => {
                    const otherOwner = Boolean(ownerId) && String(item.owner?.id ?? "") !== ownerId;
                    return (
                      <li
                        key={item.id}
                        className={`flex items-center gap-3 px-3 py-2.5 ${otherOwner ? "opacity-40" : ""}`}
                      >
                        {item.cover_image_url ? (
                          <Img
                            src={item.cover_image_url}
                            alt=""
                            width={48}
                            className="h-12 w-12 shrink-0 rounded-lg object-cover"
                          />
                        ) : (
                          <span
                            aria-hidden="true"
                            className="h-12 w-12 shrink-0 rounded-lg bg-gradient-to-br from-denim/10 via-cream to-sand/80"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-navy">
                            {item.title || "(disco eliminado)"}
                          </p>
                          <p className="truncate text-xs text-navy/50">
                            {[item.artist, item.owner ? `Dueño: ${item.owner.name}` : "Sin dueño"]
                              .filter(Boolean)
                              .join(" · ")}
                            {item.owner &&
                              (item.email_sent ? (
                                <span className="ml-1 font-bold text-green-700" title="Correo enviado" aria-label="Correo enviado">✓</span>
                              ) : (
                                <span className="ml-1 font-bold text-coral" title="El correo no se pudo enviar" aria-label="Correo no enviado">✗</span>
                              ))}
                          </p>
                        </div>
                        <div className="shrink-0 text-right text-sm">
                          <p className="font-medium text-navy">
                            {currency(Number(item.price) * item.quantity)}
                          </p>
                          <p className="text-xs text-navy/50">
                            {item.quantity} × {currency(item.price)}
                          </p>
                          {/* Line profit; "sin costo" says it's the full net because no cost was saved */}
                          {Number(item.cost_price) > 0 ? (
                            <p
                              className={`text-xs font-semibold ${
                                Number(item.profit) < 0 ? "text-coral" : "text-green-800"
                              }`}
                              title={`Costo: ${item.quantity} × ${currency(item.cost_price)}`}
                            >
                              {Number(item.profit) < 0 ? "Pérdida" : "Ganancia"} {currency(item.profit)}
                            </p>
                          ) : (
                            <p className="text-[11px] text-navy/40">Sin costo registrado</p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>

                <dl className="mt-3 flex flex-wrap justify-end gap-x-6 gap-y-1 text-sm">
                  <div className="flex gap-2">
                    <dt className="text-navy/60">Subtotal</dt>
                    <dd className="text-navy">{currency(sale.subtotal)}</dd>
                  </div>
                  {Number(sale.commission_amount) > 0 && (
                    <div className="flex gap-2">
                      <dt className="text-navy/60">Comisión ({Number(sale.commission_rate)}%)</dt>
                      <dd className="text-coral">−{currency(sale.commission_amount)}</dd>
                    </div>
                  )}
                  <div className="flex gap-2 font-semibold">
                    <dt className="text-navy">Total final</dt>
                    <dd className="text-denim">{currency(sale.final_sale_price)}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-navy/60">Costo</dt>
                    <dd className="text-navy">−{currency(sale.cost)}</dd>
                  </div>
                  <div className="flex gap-2 font-semibold">
                    <dt className="text-navy">{Number(sale.profit) < 0 ? "Pérdida" : "Ganancia"}</dt>
                    <dd className={Number(sale.profit) < 0 ? "text-coral" : "text-green-800"}>
                      {currency(sale.profit)}
                    </dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
        </>
      )}

      {printing && <ReceiptPrinter sale={printing} onDone={stopPrinting} />}
    </>
  );
}
