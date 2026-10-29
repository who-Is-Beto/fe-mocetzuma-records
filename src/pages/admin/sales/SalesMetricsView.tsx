import { useCallback, type CSSProperties } from "react";
import { Button } from "../../../components/Button";
import { extractErrorMessage } from "../../../app/lib/httpClient";
import { useServiceQuery } from "../../../app/hooks/useServiceQuery";
import type { createSalesService } from "../../../app/services/salesService";
import {
  PAYMENT_METHOD_LABELS,
  SALE_CHANNEL_LABELS,
  type MetricsPaymentMethod,
  type SaleChannel
} from "../../../app/domain/sales";
import { currency } from "../../../app/lib/format";
import { Img } from "../../../components/Img";
import { Skeleton } from "../../../components/Skeleton";
import { KpiCard, RankedBars, StackedShare, TimelineChart } from "./charts";

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

const PLACE_LABELS: { [channel in SaleChannel | "unknown"]: string } = {
  ...SALE_CHANNEL_LABELS,
  unknown: SALE_CHANNEL_LABELS[""]
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
      <div className="h-2.5 rounded-full bg-chart-1" style={{ width: `${pct}%` }} />
    </div>
  );
}

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
      <div role="status" aria-label="Cargando métricas" className="mt-4 space-y-4">
        <div className="grid gap-3 min-[480px]:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-36 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-80 rounded-2xl" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-44 rounded-2xl" />
          <Skeleton className="h-44 rounded-2xl" />
        </div>
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
  const maxOwnerGross = Math.max(...data.owners.map((o) => Number(o.gross)));
  const sales = (count: number) => `${count} ${count === 1 ? "venta" : "ventas"}`;

  const loss = Number(summary.profit) < 0;
  const previous = data.previous;
  const points = data.timeline.points.map((p) => ({
    period: p.period,
    pos: Number(p.pos),
    online: Number(p.online),
    profit: Number(p.profit),
    count: p.count
  }));
  const gross = points.map((p) => p.pos + p.online);

  return (
    <div className="mt-4 space-y-4">
      {/* ── Headline figures: count up, change vs. the previous period, trend ── */}
      <div className="grid gap-3 min-[480px]:grid-cols-2 lg:grid-cols-4 [&>*]:min-w-0">
        <KpiCard
          hero
          index={0}
          label="Ingreso neto"
          value={Number(summary.net)}
          previous={previous ? Number(previous.net) : null}
          hint="Después de comisiones"
          trend={gross}
        />
        <KpiCard
          index={1}
          label={loss ? "Pérdida" : "Ganancia"}
          value={Number(summary.profit)}
          previous={previous ? Number(previous.profit) : null}
          hint="Neto menos costo"
          trend={points.map((p) => p.profit)}
        />
        <KpiCard
          index={2}
          label="Ventas"
          format="count"
          value={summary.count}
          previous={previous?.count ?? null}
          hint={`${summary.units} discos vendidos`}
          trend={points.map((p) => p.count)}
        />
        <KpiCard
          index={3}
          label="Ticket promedio"
          value={Number(summary.average_ticket)}
          previous={previous ? Number(previous.average_ticket) : null}
          hint={`Bruto ${currency(summary.gross)}`}
        />
      </div>

      {/* ── Timeline ── */}
      {points.length > 1 && (
        <section className={panelClass} aria-labelledby="metrics-timeline">
          <h3 id="metrics-timeline" className={eyebrowClass}>
            Ingreso por {data.timeline.grain === "month" ? "mes" : "día"}
          </h3>
          <div className="mt-2">
            <TimelineChart points={points} grain={data.timeline.grain} />
          </div>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        {/* ── Where each peso of gross goes ── */}
        <section className={panelClass} aria-labelledby="metrics-split">
          <h3 id="metrics-split" className={eyebrowClass}>¿A dónde va cada peso?</h3>
          <p className="mt-1 text-xs text-navy/70">Ingreso bruto de {currency(summary.gross)}, repartido.</p>
          <div className="mt-3">
            {loss ? (
              <p role="status" className="rounded-xl border border-coral/40 bg-coral/10 px-4 py-2.5 text-sm text-navy">
                En este periodo el costo y las comisiones superan lo cobrado: hay una pérdida de{" "}
                <strong>{currency(-Number(summary.profit))}</strong>.
              </p>
            ) : (
              <StackedShare
                label={`Del ingreso bruto: ganancia ${currency(summary.profit)}, costo ${currency(summary.cost)}, comisiones ${currency(summary.commission)}`}
                segments={[
                  { label: "Ganancia", value: Number(summary.profit) },
                  { label: "Costo de los discos", value: Number(summary.cost) },
                  { label: "Comisiones", value: Number(summary.commission), detail: "Tarjeta y Stripe (estimada)" }
                ]}
              />
            )}
          </div>
        </section>
        {/* ── By channel: one share bar + the numbers of each side ── */}
        <section className={panelClass} aria-labelledby="metrics-channels">
          <h3 id="metrics-channels" className={eyebrowClass}>Punto de venta vs. en línea</h3>
          <div className="mt-3">
            <StackedShare
              label={data.channels
                .map((c) => `${CHANNEL_LABELS[c.channel]} ${currency(c.gross)}`)
                .join(", ")}
              segments={data.channels.map((c) => ({
                label: CHANNEL_LABELS[c.channel],
                value: Number(c.gross),
                detail: `${sales(c.count)} · neto ${currency(c.net)} · ganancia ${currency(c.profit)}${
                  c.channel === "online" ? " (comisión estimada)" : ""
                }`
              }))}
            />
          </div>
        </section>
      </div>

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

      <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        {/* ── Point of sale by place ── */}
        <section className={panelClass} aria-labelledby="metrics-places">
          <h3 id="metrics-places" className={eyebrowClass}>Punto de venta por lugar</h3>
          <div className="mt-3">
            {data.sale_channels.length === 0 ? (
              <p className="text-sm text-navy/60">Sin ventas en punto de venta en este periodo.</p>
            ) : (
              <RankedBars
                caption="Ventas de punto de venta por lugar"
                bars={data.sale_channels.map((place) => ({
                  key: place.channel,
                  label: PLACE_LABELS[place.channel],
                  value: Number(place.gross),
                  detail: `${sales(place.count)} · ganancia ${currency(place.profit)}`,
                  muted: place.channel === "unknown"
                }))}
              />
            )}
          </div>
        </section>

        {/* ── By payment method ── */}
        <section className={panelClass} aria-labelledby="metrics-methods">
          <h3 id="metrics-methods" className={eyebrowClass}>Por forma de pago</h3>
          <div className="mt-3">
            <RankedBars
              caption="Ingreso bruto por forma de pago"
              bars={data.payment_methods.map((method) => ({
                key: method.method,
                label: METHOD_LABELS[method.method],
                value: Number(method.gross),
                detail: `${sales(method.count)}${
                  Number(method.commission) > 0 ? ` · comisión ${currency(method.commission)}` : ""
                }`,
                muted: method.method === "unknown"
              }))}
            />
          </div>
        </section>
      </div>

      {/* Stacked, full width: the admin column is ≤1024 px, too narrow for two
          tables side by side. min-w-0 lets long titles truncate instead of
          stretching the column past the screen (Layout clips overflow-x). */}
      <div className="grid gap-4 [&>*]:min-w-0">
        {/* ── Top records: one ranked list at every size, units as a bar ── */}
        <section className={panelClass} aria-labelledby="metrics-top">
          <h3 id="metrics-top" className={eyebrowClass}>Discos más vendidos</h3>
          <ol className="mt-4 grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2">
            {data.top_records.map((row, index) => {
              const maxUnits = data.top_records[0]?.units || 1;
              return (
                <li
                  key={`${row.record ?? row.title}-${index}`}
                  style={{ "--i": index } as CSSProperties}
                  className="reveal flex min-w-0 items-center gap-3"
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      index === 0 ? "bg-sun text-navy" : index < 3 ? "bg-navy text-cream" : "bg-navy/10 text-navy"
                    }`}
                  >
                    {index + 1}
                  </span>
                  {row.cover_image_url ? (
                    <Img src={row.cover_image_url} alt="" width={48} className="h-12 w-12 shrink-0 rounded-lg object-cover shadow-card" />
                  ) : (
                    <span aria-hidden="true" className="h-12 w-12 shrink-0 rounded-lg bg-gradient-to-br from-denim/10 via-cream to-sand/80" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-sm font-medium text-navy">{row.title}</p>
                      <p className="shrink-0 text-sm font-semibold tabular-nums text-navy">{currency(row.gross)}</p>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="h-1.5 min-w-0 flex-1 rounded-full bg-navy/[0.06]">
                        <div
                          style={{ "--i": index, width: `${(row.units / maxUnits) * 100}%` } as CSSProperties}
                          className="grow-x h-full rounded-full bg-chart-1"
                        />
                      </div>
                      <span className="shrink-0 text-[11px] text-navy/70">
                        {row.units} {row.units === 1 ? "unidad" : "unidades"}
                      </span>
                    </div>
                    {row.artist && <p className="mt-0.5 truncate text-xs text-navy/70">{row.artist}</p>}
                  </div>
                </li>
              );
            })}
          </ol>
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
