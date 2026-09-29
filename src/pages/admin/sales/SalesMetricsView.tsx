import { useCallback } from "react";
import { Button } from "../../../components/Button";
import { extractErrorMessage } from "../../../app/lib/httpClient";
import { useServiceQuery } from "../../../app/hooks/useServiceQuery";
import type { createSalesService } from "../../../app/services/salesService";
import {
  PAYMENT_METHOD_LABELS,
  type MetricsBucket,
  type MetricsPaymentMethod
} from "../../../app/domain/sales";
import { currency } from "../../../app/lib/format";

type Props = {
  salesService: ReturnType<typeof createSalesService>;
  dateFrom: string;
  dateTo: string;
};

const CHANNEL_LABELS = { pos: "Punto de venta", online: "En línea" } as const;

const METHOD_LABELS: { [method in MetricsPaymentMethod]: string } = {
  cash: PAYMENT_METHOD_LABELS.cash,
  card: PAYMENT_METHOD_LABELS.card,
  transfer: PAYMENT_METHOD_LABELS.transfer,
  stripe: "Tarjeta en línea (Stripe)",
  unknown: PAYMENT_METHOD_LABELS[""]
};

const panelClass = "rounded-2xl border border-navy/10 bg-cream/80 p-4 shadow-card backdrop-blur sm:p-5";
const eyebrowClass = "text-xs uppercase tracking-[0.16em] text-orange";
const thClass = "px-3 py-2 font-semibold";

/** Single-hue magnitude bar; the number beside it carries the value. */
function ShareBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.max((value / max) * 100, value > 0 ? 2 : 0) : 0;
  return (
    <div aria-hidden="true" className="h-2 w-full rounded-full bg-navy/5">
      <div className="h-2 rounded-full bg-denim" style={{ width: `${pct}%` }} />
    </div>
  );
}

const pct = (part: number, total: number) =>
  total > 0 ? `${Math.round((part / total) * 100)}%` : "0%";

/** Ventas → Métricas: point of sale + online orders for the date range. */
export function SalesMetricsView({ salesService, dateFrom, dateTo }: Props) {
  const fetchMetrics = useCallback(
    () =>
      salesService.metrics({
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined
      }),
    [salesService, dateFrom, dateTo]
  );
  const query = useServiceQuery([salesService], fetchMetrics);
  const data = query.data;
  const error = query.isError
    ? extractErrorMessage(query.error, "No se pudieron cargar las métricas.")
    : null;

  if (error) {
    return (
      <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}
        <Button
          tone="outline"
          className="ml-3 px-3 py-1 text-xs"
          onClick={() => void query.refetch().catch(() => {})}
        >
          Reintentar
        </Button>
      </div>
    );
  }
  if (query.isLoading || !data) {
    return (
      <div className="mt-8 flex justify-center">
        <p className="text-sm text-navy/50 animate-pulse">Cargando…</p>
      </div>
    );
  }
  if (data.summary.count === 0) {
    return (
      <div className="mt-12 text-center">
        <p className="text-lg text-navy/40">📊</p>
        <p className="mt-2 text-sm text-navy/50">No hay ventas en este periodo.</p>
      </div>
    );
  }

  const { summary } = data;
  const totalGross = Number(summary.gross);
  const maxMethodGross = Math.max(...data.payment_methods.map((m) => Number(m.gross)));
  const maxOwnerGross = Math.max(...data.owners.map((o) => Number(o.gross)));

  const tiles = [
    { label: "Ingreso bruto", value: currency(summary.gross) },
    { label: "Ingreso neto", value: currency(summary.net), strong: true },
    { label: "Comisiones", value: currency(summary.commission) },
    { label: "Ventas", value: String(summary.count) },
    { label: "Ticket promedio", value: currency(summary.average_ticket) },
    { label: "Discos vendidos", value: String(summary.units) }
  ];

  const bucketRows = (bucket: MetricsBucket) => [
    ["Bruto", currency(bucket.gross)],
    ["Comisiones", currency(bucket.commission)],
    ["Neto", currency(bucket.net)],
    ["Ventas", String(bucket.count)],
    ["Ticket promedio", currency(bucket.average_ticket)]
  ];

  return (
    <div className="mt-4 space-y-4">
      {/* ── Headline numbers ── */}
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {tiles.map((tile) => (
          <div
            key={tile.label}
            className="rounded-2xl border border-navy/10 bg-cream/80 px-4 py-3 shadow-card backdrop-blur"
          >
            <dt className="text-[11px] uppercase tracking-[0.16em] text-orange">{tile.label}</dt>
            <dd className={`mt-1 font-semibold ${tile.strong ? "text-lg text-denim" : "text-navy"}`}>
              {tile.value}
            </dd>
          </div>
        ))}
      </dl>
      <p className="text-[11px] text-navy/50">
        Bruto = lo que se cobró por los discos (sin envíos: {currency(summary.shipping)} cobrados
        aparte en línea). La comisión en línea es una <strong>estimación</strong> de la tarifa de
        Stripe; Stripe no nos la reporta.
      </p>

      {/* ── By channel ── */}
      <section className={panelClass}>
        <h3 className={eyebrowClass}>Por canal</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {data.channels.map((channel) => (
            <div key={channel.channel} className="rounded-xl border border-navy/10 bg-white/60 p-3">
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-semibold text-navy">
                  {CHANNEL_LABELS[channel.channel]}
                  {channel.channel === "online" && (
                    <span className="ml-1 text-[11px] font-normal text-navy/50">(comisión estimada)</span>
                  )}
                </p>
                <p className="text-sm text-navy/60">
                  {pct(Number(channel.gross), totalGross)} del bruto
                </p>
              </div>
              <div className="mt-2">
                <ShareBar value={Number(channel.gross)} max={totalGross} />
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                {bucketRows(channel).map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-2">
                    <dt className="text-navy/60">{label}</dt>
                    <dd className="text-navy">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </section>

      {/* ── By payment method ── */}
      <section className={panelClass}>
        <h3 className={eyebrowClass}>Por forma de pago</h3>
        <ul className="mt-3 space-y-3">
          {data.payment_methods.map((method) => (
            <li
              key={method.method}
              title={`${METHOD_LABELS[method.method]}: ${currency(method.gross)} bruto · ${currency(method.commission)} comisión · ${method.count} ventas`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                <span className="font-medium text-navy">{METHOD_LABELS[method.method]}</span>
                <span className="text-navy/60">
                  <span className="font-semibold text-navy">{currency(method.gross)}</span> ·{" "}
                  {method.count} {method.count === 1 ? "venta" : "ventas"}
                  {Number(method.commission) > 0 && ` · comisión ${currency(method.commission)}`}
                </span>
              </div>
              <div className="mt-1.5">
                <ShareBar value={Number(method.gross)} max={maxMethodGross} />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ── Top records ── */}
        <section className={panelClass}>
          <h3 className={eyebrowClass}>Discos más vendidos</h3>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[320px] text-left text-sm">
              <thead>
                <tr className="border-b border-navy/10 text-[11px] uppercase tracking-wider text-navy/50">
                  <th className={thClass}>#</th>
                  <th className={thClass}>Disco</th>
                  <th className={`${thClass} text-right`}>Unid.</th>
                  <th className={`${thClass} text-right`}>Bruto</th>
                </tr>
              </thead>
              <tbody>
                {data.top_records.map((row, index) => (
                  <tr key={`${row.record ?? row.title}-${index}`} className="border-b border-navy/5 last:border-0">
                    <td className="px-3 py-2 text-navy/50">{index + 1}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        {row.cover_image_url ? (
                          <img src={row.cover_image_url} alt="" loading="lazy" className="h-9 w-9 shrink-0 rounded-md object-cover" />
                        ) : (
                          <span aria-hidden="true" className="h-9 w-9 shrink-0 rounded-md bg-gradient-to-br from-denim/10 via-cream to-sand/80" />
                        )}
                        <div className="min-w-0">
                          <p className="truncate font-medium text-navy">{row.title}</p>
                          {row.artist && <p className="truncate text-xs text-navy/50">{row.artist}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right text-navy">{row.units}</td>
                    <td className="px-3 py-2 text-right font-medium text-navy">{currency(row.gross)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── By owner ── */}
        <section className={panelClass}>
          <h3 className={eyebrowClass}>Ventas por dueño</h3>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[360px] text-left text-sm">
              <thead>
                <tr className="border-b border-navy/10 text-[11px] uppercase tracking-wider text-navy/50">
                  <th className={thClass}>Dueño</th>
                  <th className={`${thClass} text-right`}>Unid.</th>
                  <th className={`${thClass} text-right`}>Bruto</th>
                  <th className={`${thClass} text-right`}>Comisión</th>
                  <th className={`${thClass} text-right`}>Neto</th>
                </tr>
              </thead>
              <tbody>
                {data.owners.map((row) => (
                  <tr key={row.owner?.id ?? "none"} className="border-b border-navy/5 last:border-0">
                    <td className="px-3 py-2">
                      <p className={row.owner ? "font-medium text-navy" : "text-navy/50"}>
                        {row.owner?.name ?? "Sin dueño"}
                      </p>
                      <div className="mt-1 w-full max-w-[140px]">
                        <ShareBar value={Number(row.gross)} max={maxOwnerGross} />
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right text-navy">{row.units}</td>
                    <td className="px-3 py-2 text-right text-navy">{currency(row.gross)}</td>
                    <td className="px-3 py-2 text-right text-navy/70">{currency(row.commission)}</td>
                    <td className="px-3 py-2 text-right font-medium text-navy">{currency(row.net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-navy/50">
            En línea se usa el dueño actual del disco; la comisión de tarjeta se reparte según lo que
            aportó cada disco al ticket.
          </p>
        </section>
      </div>
    </div>
  );
}
