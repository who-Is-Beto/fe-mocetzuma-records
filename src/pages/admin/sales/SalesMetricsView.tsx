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
import { Img } from "../../../components/Img";

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

/**
 * Single-hue magnitude bar. Exposed as a meter with a spoken label, so screen
 * readers get "Efectivo: 45 % del mayor" instead of an unlabeled shape.
 */
function ShareBar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max > 0 ? Math.max((value / max) * 100, value > 0 ? 2 : 0) : 0;
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      aria-valuetext={`${Math.round(max > 0 ? (value / max) * 100 : 0)} %`}
      className="h-2.5 w-full rounded-full bg-navy/10"
    >
      <div className="h-2.5 rounded-full bg-denim" style={{ width: `${pct}%` }} />
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
          className="mt-2 min-h-[44px] px-4 text-xs sm:ml-3 sm:mt-0"
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
        <p className="text-sm text-navy/70 animate-pulse" role="status">Cargando…</p>
      </div>
    );
  }
  if (data.summary.count === 0) {
    return (
      <div className="mt-12 text-center">
        <p className="text-lg text-navy/40">📊</p>
        <p className="mt-2 text-sm text-navy/70">No hay ventas en este periodo.</p>
      </div>
    );
  }

  const { summary } = data;
  const totalGross = Number(summary.gross);
  const maxMethodGross = Math.max(...data.payment_methods.map((m) => Number(m.gross)));
  const maxOwnerGross = Math.max(...data.owners.map((o) => Number(o.gross)));

  const loss = Number(summary.profit) < 0;
  const tiles = [
    { label: "Ingreso bruto", value: currency(summary.gross) },
    { label: "Ingreso neto", value: currency(summary.net), strong: true },
    { label: "Comisiones", value: currency(summary.commission) },
    { label: "Costo", value: currency(summary.cost) },
    { label: loss ? "Pérdida" : "Ganancia", value: currency(summary.profit), strong: true, negative: loss },
    { label: "Ventas", value: String(summary.count) },
    { label: "Ticket promedio", value: currency(summary.average_ticket) },
    { label: "Discos vendidos", value: String(summary.units) }
  ];

  const bucketRows = (bucket: MetricsBucket) => [
    ["Bruto", currency(bucket.gross)],
    ["Comisiones", currency(bucket.commission)],
    ["Neto", currency(bucket.net)],
    ["Costo", currency(bucket.cost)],
    ["Ganancia", currency(bucket.profit)],
    ["Ventas", String(bucket.count)],
    ["Ticket promedio", currency(bucket.average_ticket)]
  ];

  return (
    <div className="mt-4 space-y-4">
      {/* ── Headline numbers ── */}
      {/* 1 column on the narrowest phones, 2 from ~360 px, 4 on larger screens (2 rows of 4) */}
      <dl className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2 sm:grid-cols-4 [&>*]:min-w-0">
        {tiles.map((tile) => (
          <div
            key={tile.label}
            className="min-w-0 rounded-2xl border border-navy/10 bg-cream/80 px-4 py-3 shadow-card backdrop-blur"
          >
            <dt className="text-xs uppercase tracking-[0.12em] text-navy/70">{tile.label}</dt>
            <dd
              className={`mt-1 break-words text-lg font-semibold tabular-nums ${
                tile.negative ? "text-coral" : tile.strong ? "text-denim" : "text-navy"
              }`}
            >
              {tile.value}
            </dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-navy/70">
        Bruto = lo que se cobró por los discos (sin envíos: {currency(summary.shipping)} cobrados
        aparte en línea). La comisión en línea es una <strong>estimación</strong> de la tarifa de
        Stripe; Stripe no nos la reporta. Ganancia = neto − costo de los discos vendidos (el costo
        guardado al momento de cada venta).
      </p>
      {summary.units_without_cost > 0 && (
        <p role="status" className="rounded-xl border border-orange/40 bg-sun/30 px-4 py-2.5 text-xs text-navy">
          ⚠️ {summary.units_without_cost} de {summary.units} discos vendidos no tenían precio de costo
          registrado: cuentan como ganancia completa, así que la ganancia real es menor. Registra el
          costo en cada disco (Editar → Precio de costo) para que las próximas ventas lo guarden.
        </p>
      )}

      {/* ── By channel ── */}
      <section className={panelClass} aria-labelledby="metrics-channels">
        <h3 id="metrics-channels" className={eyebrowClass}>Por canal</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 [&>*]:min-w-0">
          {data.channels.map((channel) => (
            <div key={channel.channel} className="rounded-xl border border-navy/10 bg-white/60 p-3">
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-semibold text-navy">
                  {CHANNEL_LABELS[channel.channel]}
                  {channel.channel === "online" && (
                    <span className="ml-1 text-xs font-normal text-navy/70">(comisión estimada)</span>
                  )}
                </p>
                <p className="text-sm text-navy/70">
                  {pct(Number(channel.gross), totalGross)} del bruto
                </p>
              </div>
              <div className="mt-2">
                <ShareBar
                  value={Number(channel.gross)}
                  max={totalGross}
                  label={`${CHANNEL_LABELS[channel.channel]}: ${pct(Number(channel.gross), totalGross)} del ingreso bruto`}
                />
              </div>
              <dl className="mt-3 space-y-1.5 text-sm">
                {bucketRows(channel).map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-3">
                    <dt className="text-navy/70">{label}</dt>
                    <dd className="whitespace-nowrap tabular-nums text-navy">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </section>

      {/* ── By payment method ── */}
      <section className={panelClass} aria-labelledby="metrics-methods">
        <h3 id="metrics-methods" className={eyebrowClass}>Por forma de pago</h3>
        <ul className="mt-3 space-y-3">
          {data.payment_methods.map((method) => (
            <li key={method.method}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                <span className="font-medium text-navy">{METHOD_LABELS[method.method]}</span>
                <span className="tabular-nums text-navy/70">
                  <span className="font-semibold text-navy">{currency(method.gross)}</span> ·{" "}
                  {method.count} {method.count === 1 ? "venta" : "ventas"}
                  {Number(method.commission) > 0 && ` · comisión ${currency(method.commission)}`}
                </span>
              </div>
              <div className="mt-1.5">
                <ShareBar
                  value={Number(method.gross)}
                  max={maxMethodGross}
                  label={`${METHOD_LABELS[method.method]}: ${currency(method.gross)}, ${pct(Number(method.gross), totalGross)} del ingreso bruto`}
                />
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Stacked, full width: the admin column is ≤1024 px, too narrow for two
          tables side by side. min-w-0 lets long titles truncate instead of
          stretching the column past the screen (Layout clips overflow-x). */}
      <div className="grid gap-4 [&>*]:min-w-0">
        {/* ── Top records: ranked cards on phones, table from md ── */}
        <section className={panelClass} aria-labelledby="metrics-top">
          <h3 id="metrics-top" className={eyebrowClass}>Discos más vendidos</h3>
          <ol className="mt-3 divide-y divide-navy/5 md:hidden">
            {data.top_records.map((row, index) => (
              <li key={`${row.record ?? row.title}-${index}`} className="flex items-center gap-3 py-2.5">
                <span className="w-5 shrink-0 text-center text-sm font-semibold text-navy/70">{index + 1}</span>
                {row.cover_image_url ? (
                  <Img src={row.cover_image_url} alt="" width={44} className="h-11 w-11 shrink-0 rounded-md object-cover" />
                ) : (
                  <span aria-hidden="true" className="h-11 w-11 shrink-0 rounded-md bg-gradient-to-br from-denim/10 via-cream to-sand/80" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 break-words text-sm font-medium leading-snug text-navy">{row.title}</p>
                  {row.artist && <p className="truncate text-xs text-navy/70">{row.artist}</p>}
                </div>
                <div className="shrink-0 text-right text-sm tabular-nums">
                  <p className="font-semibold text-navy">{currency(row.gross)}</p>
                  <p className="text-xs text-navy/70">
                    {row.units} {row.units === 1 ? "unidad" : "unidades"}
                  </p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-3 hidden overflow-x-auto md:block">
            {/* table-fixed: a long title wraps in its column instead of pushing
                Unid./Bruto out of view */}
            <table className="w-full table-fixed text-left text-sm">
              <caption className="sr-only">Discos más vendidos en el periodo</caption>
              <thead>
                <tr className="border-b border-navy/10 text-xs uppercase tracking-wider text-navy/70">
                  <th scope="col" className={`${thClass} w-10`}>#</th>
                  <th scope="col" className={thClass}>Disco</th>
                  <th scope="col" className={`${thClass} w-20 text-right`}>Unid.</th>
                  <th scope="col" className={`${thClass} w-36 text-right`}>Bruto</th>
                </tr>
              </thead>
              <tbody>
                {data.top_records.map((row, index) => (
                  <tr key={`${row.record ?? row.title}-${index}`} className="border-b border-navy/5 last:border-0">
                    <td className="px-3 py-2 text-navy/70">{index + 1}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        {row.cover_image_url ? (
                          <Img src={row.cover_image_url} alt="" width={36} className="h-9 w-9 shrink-0 rounded-md object-cover" />
                        ) : (
                          <span aria-hidden="true" className="h-9 w-9 shrink-0 rounded-md bg-gradient-to-br from-denim/10 via-cream to-sand/80" />
                        )}
                        <div className="min-w-0">
                          <p className="line-clamp-2 break-words font-medium leading-snug text-navy">{row.title}</p>
                          {row.artist && <p className="truncate text-xs text-navy/70">{row.artist}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-navy">{row.units}</td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums text-navy">{currency(row.gross)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── By owner: cards on phones, table from md ── */}
        <section className={panelClass} aria-labelledby="metrics-owners">
          <h3 id="metrics-owners" className={eyebrowClass}>Ventas por dueño</h3>
          <ul className="mt-3 space-y-2 md:hidden">
            {data.owners.map((row) => (
              <li key={row.owner?.id ?? "none"} className="rounded-xl border border-navy/10 bg-white/60 p-3">
                <div className="flex items-start justify-between gap-3">
                  <p className={`min-w-0 line-clamp-2 break-words leading-snug ${row.owner ? "font-semibold text-navy" : "text-navy/70"}`}>
                    {row.owner?.name ?? "Sin dueño"}
                  </p>
                  <p className="shrink-0 text-right leading-snug">
                    <span className="block text-[11px] uppercase tracking-[0.12em] text-navy/70">Neto</span>
                    <span className="font-semibold tabular-nums text-denim">{currency(row.net)}</span>
                  </p>
                </div>
                <div className="mt-2">
                  <ShareBar
                    value={Number(row.gross)}
                    max={maxOwnerGross}
                    label={`${row.owner?.name ?? "Sin dueño"}: ${currency(row.gross)} bruto`}
                  />
                </div>
                {/* label ··· value rows: amounts never wrap mid-number */}
                <dl className="mt-2 space-y-1 text-sm">
                  {[
                    ["Unidades", String(row.units)],
                    ["Bruto", currency(row.gross)],
                    ["Comisión", currency(row.commission)],
                    ["Costo", currency(row.cost)],
                    ["Ganancia", currency(row.profit)],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-3">
                      <dt className="text-navy/70">{label}</dt>
                      <dd className="whitespace-nowrap tabular-nums text-navy">{value}</dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
          </ul>
          <div className="mt-3 hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Ventas por dueño en el periodo</caption>
              <thead>
                <tr className="border-b border-navy/10 text-xs uppercase tracking-wider text-navy/70">
                  <th scope="col" className={thClass}>Dueño</th>
                  <th scope="col" className={`${thClass} text-right`}>Unid.</th>
                  <th scope="col" className={`${thClass} text-right`}>Bruto</th>
                  <th scope="col" className={`${thClass} text-right`}>Comisión</th>
                  <th scope="col" className={`${thClass} text-right`}>Neto</th>
                  <th scope="col" className={`${thClass} text-right`}>Costo</th>
                  <th scope="col" className={`${thClass} text-right`}>Ganancia</th>
                </tr>
              </thead>
              <tbody>
                {data.owners.map((row) => (
                  <tr key={row.owner?.id ?? "none"} className="border-b border-navy/5 last:border-0">
                    <td className="px-3 py-2">
                      <p className={row.owner ? "font-medium text-navy" : "text-navy/70"}>
                        {row.owner?.name ?? "Sin dueño"}
                      </p>
                      <div className="mt-1 w-full max-w-[140px]">
                        <ShareBar
                          value={Number(row.gross)}
                          max={maxOwnerGross}
                          label={`${row.owner?.name ?? "Sin dueño"}: ${currency(row.gross)} bruto`}
                        />
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-navy">{row.units}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-navy">{currency(row.gross)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-navy/80">{currency(row.commission)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-navy">{currency(row.net)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-navy/80">{currency(row.cost)}</td>
                    <td
                      className={`px-3 py-2 text-right font-medium tabular-nums ${
                        Number(row.profit) < 0 ? "text-coral" : "text-navy"
                      }`}
                    >
                      {currency(row.profit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-navy/70">
            En línea se usa el dueño guardado en cada pedido; la comisión de tarjeta se reparte según lo
            que aportó cada disco al ticket.
          </p>
        </section>
      </div>
    </div>
  );
}
