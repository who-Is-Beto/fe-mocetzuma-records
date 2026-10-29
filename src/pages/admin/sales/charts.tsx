import { useState, type CSSProperties } from "react";
import { currency } from "../../../app/lib/format";
import { useCountUp } from "../../../app/hooks/useCountUp";

/** Series fills in their fixed order (tailwind `chart` tokens). */
export const SERIES = ["bg-chart-1", "bg-chart-2", "bg-chart-3"] as const;
const SERIES_HEX = ["#2b74b0", "#f4903c", "#2a9d8f"] as const;

const share = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0);
const cascade = (i: number) => ({ "--i": i }) as CSSProperties;

/** $1,234 → "$1.2K" for axis ticks (values stay exact in labels and tooltips). */
const compactMoney = (value: number) =>
  Math.abs(value) >= 1000
    ? `$${(value / 1000).toLocaleString("es-MX", { maximumFractionDigits: 1 })}K`
    : `$${Math.round(value)}`;

/** Rounds an axis maximum up to 1, 2 or 5 × 10ⁿ so ticks land on clean numbers. */
const niceMax = (value: number) => {
  if (value <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(value)));
  const step = [1, 2, 5, 10].find((m) => m * exp >= value) ?? 10;
  return step * exp;
};

/* ── KPI card ─────────────────────────────────────────────────────────── */

type KpiProps = {
  label: string;
  value: number;
  previous?: number | null;
  /** Sparkline values over the range (oldest first). */
  trend?: number[];
  format?: "money" | "count";
  /** The headline card: larger figure, navy surface. */
  hero?: boolean;
  /** Small print under the figure. */
  hint?: string;
  index?: number;
};

/**
 * One headline figure: counts up on load, shows the change against the
 * previous period (arrow + sign + %, never color alone) and a sparkline.
 */
export function KpiCard({ label, value, previous, trend, format = "money", hero = false, hint, index = 0 }: KpiProps) {
  const animated = useCountUp(value);
  const shown = format === "money" ? currency(animated) : Math.round(animated).toLocaleString("es-MX");
  const delta = previous != null && previous !== 0 ? ((value - previous) / Math.abs(previous)) * 100 : null;
  const up = delta !== null && delta >= 0;

  return (
    <div
      style={cascade(index)}
      className={`reveal flex min-w-0 flex-col rounded-2xl border p-4 shadow-card transition duration-300 hover:-translate-y-0.5 hover:shadow-panel sm:p-5 ${
        hero ? "border-navy bg-navy text-cream" : "border-navy/10 bg-cream/90 text-navy"
      }`}
    >
      <p className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${hero ? "text-sun" : "text-navy/70"}`}>{label}</p>
      <p className={`mt-1.5 break-words font-semibold ${hero ? "text-3xl sm:text-[2rem]" : "text-2xl"}`}>{shown}</p>
      <div className="mt-1 flex min-h-[20px] flex-wrap items-center gap-x-2 text-xs">
        {delta !== null ? (
          <span
            className={`inline-flex items-center gap-0.5 rounded-pill px-1.5 py-0.5 font-semibold ${
              hero
                ? up ? "bg-green-400/20 text-green-200" : "bg-coral/25 text-orange"
                : up ? "bg-green-100 text-green-800" : "bg-coral/15 text-coral"
            }`}
          >
            <span aria-hidden="true">{up ? "▲" : "▼"}</span>
            {up ? "+" : "−"}
            {Math.abs(delta).toLocaleString("es-MX", { maximumFractionDigits: 0 })}%
          </span>
        ) : null}
        <span className={hero ? "text-cream/70" : "text-navy/60"}>
          {delta !== null ? "vs. periodo anterior" : hint}
        </span>
      </div>
      {trend && trend.length > 1 ? (
        <div className="mt-auto pt-3">
          <Sparkline values={trend} color={hero ? "#f8d15a" : SERIES_HEX[0]} />
        </div>
      ) : null}
    </div>
  );
}

/** A tiny trend line with a soft area and an end dot. Decorative: the card carries the number. */
export function Sparkline({ values, color }: { values: number[]; color: string }) {
  const w = 120;
  const h = 32;
  const min = Math.min(...values, 0);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = (i: number) => (i / (values.length - 1)) * w;
  const y = (v: number) => h - 3 - ((v - min) / span) * (h - 6);
  const line = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-8 w-full overflow-visible" aria-hidden="true">
      <path d={`${line} L${w},${h} L0,${h} Z`} fill={color} opacity="0.12" />
      <path d={line} pathLength={1} className="draw-line" fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/* ── Timeline ─────────────────────────────────────────────────────────── */

export type TimelinePoint = { period: string; pos: number; online: number; profit: number; count: number };

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** "2026-10-12" → "12 oct", "2026-10" → "oct 26". */
const periodLabel = (period: string) => {
  const [y, m, d] = period.split("-");
  return d ? `${Number(d)} ${MONTHS[Number(m) - 1]}` : `${MONTHS[Number(m) - 1]} ${y.slice(2)}`;
};

/**
 * Gross per day (or month) as columns stacked by channel, with the profit as
 * a line on the same money axis. Hover, focus or tap a column to read it in
 * the panel above the plot (works on touch, never clipped at the edges).
 */
export function TimelineChart({ points, grain }: { points: TimelinePoint[]; grain: "day" | "month" }) {
  const [active, setActive] = useState<number | null>(null);
  const totals = points.reduce(
    (acc, p) => ({ pos: acc.pos + p.pos, online: acc.online + p.online, profit: acc.profit + p.profit, count: acc.count + p.count }),
    { pos: 0, online: 0, profit: 0, count: 0 }
  );
  const top = niceMax(Math.max(...points.map((p) => Math.max(p.pos + p.online, p.profit)), 0));
  const bottom = Math.min(0, ...points.map((p) => p.profit));
  const range = top - bottom;
  const pct = (v: number) => ((v - bottom) / range) * 100; // % from the plot's bottom edge
  const ticks = [top, top / 2, 0];
  if (bottom < 0) ticks.push(bottom);
  // ~6 x labels whatever the range length.
  const labelEvery = Math.max(1, Math.ceil(points.length / 6));
  const shown = active !== null ? points[active] : null;

  const profitPath = points
    .map((p, i) => `${i ? "L" : "M"}${(((i + 0.5) / points.length) * 100).toFixed(2)},${(100 - pct(p.profit)).toFixed(2)}`)
    .join(" ");

  return (
    <div>
      {/* Readout: the hovered column, or the whole range */}
      <div className="flex min-h-[64px] flex-wrap items-end justify-between gap-x-6 gap-y-2" aria-live="polite">
        <div>
          <p className="text-xs text-navy/70">
            {shown ? (grain === "month" ? `Mes: ${periodLabel(shown.period)}` : periodLabel(shown.period)) : "Todo el periodo"}
          </p>
          <p className="text-2xl font-semibold text-navy">{currency((shown ?? totals).pos + (shown ?? totals).online)}</p>
        </div>
        <dl className="flex flex-wrap gap-x-5 gap-y-1 text-xs">
          {[
            { label: "Punto de venta", value: currency((shown ?? totals).pos), swatch: SERIES[0] },
            { label: "En línea", value: currency((shown ?? totals).online), swatch: SERIES[1] },
            { label: "Ganancia", value: currency((shown ?? totals).profit), swatch: "line" },
            { label: "Ventas", value: String((shown ?? totals).count) }
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-1.5">
              {item.swatch === "line" ? (
                <span aria-hidden="true" className="h-0.5 w-3 rounded bg-chart-3" />
              ) : item.swatch ? (
                <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-sm ${item.swatch}`} />
              ) : null}
              <dt className="text-navy/70">{item.label}</dt>
              <dd className="font-semibold text-navy">{item.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="mt-4 flex gap-2">
        {/* y axis */}
        <div className="relative h-56 w-11 shrink-0 text-right text-[10px] text-navy/60 sm:h-64">
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 -translate-y-1/2 tabular-nums" style={{ top: `${100 - pct(t)}%` }}>
              {compactMoney(t)}
            </span>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <div className="relative h-56 sm:h-64" onMouseLeave={() => setActive(null)}>
            {/* gridlines */}
            {ticks.map((t) => (
              <div
                key={t}
                aria-hidden="true"
                className={`absolute inset-x-0 border-t ${t === 0 ? "border-navy/25" : "border-navy/10"}`}
                style={{ top: `${100 - pct(t)}%` }}
              />
            ))}

            {/* columns: one hit area per period, the bar inside capped at 24px */}
            <div className="absolute inset-0 flex">
              {points.map((p, i) => {
                const zero = pct(0);
                const posH = (p.pos / range) * 100;
                const onlineH = (p.online / range) * 100;
                return (
                  <button
                    key={p.period}
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onFocus={() => setActive(i)}
                    onBlur={() => setActive(null)}
                    onClick={() => setActive(active === i ? null : i)}
                    aria-label={`${periodLabel(p.period)}: ${currency(p.pos + p.online)}, ${p.count} ventas`}
                    className="group relative h-full min-w-0 flex-1 outline-none"
                  >
                    <span
                      aria-hidden="true"
                      className={`absolute inset-y-0 left-0 right-0 rounded-md transition-colors ${active === i ? "bg-navy/[0.06]" : ""}`}
                    />
                    <span
                      className="grow-y absolute inset-x-0 mx-auto flex w-[70%] max-w-[24px] flex-col-reverse gap-[2px]"
                      style={{ ...cascade(i), bottom: `${zero}%`, height: `${posH + onlineH}%` }}
                    >
                      {p.pos > 0 && (
                        <span className={`${SERIES[0]} block w-full ${p.online > 0 ? "" : "rounded-t"}`} style={{ flexGrow: p.pos }} />
                      )}
                      {p.online > 0 && <span className={`${SERIES[1]} block w-full rounded-t`} style={{ flexGrow: p.online }} />}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* profit line on the same axis */}
            <svg
              aria-hidden="true"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
            >
              <path
                d={profitPath}
                pathLength={1}
                className="draw-line"
                fill="none"
                stroke={SERIES_HEX[2]}
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </div>

          {/* x labels */}
          <div className="mt-2 flex text-[10px] text-navy/60">
            {points.map((p, i) => (
              <span key={p.period} className="min-w-0 flex-1 overflow-visible whitespace-nowrap text-center">
                {i % labelEvery === 0 ? periodLabel(p.period) : ""}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Share of a whole ─────────────────────────────────────────────────── */

export type Segment = { label: string; value: number; detail?: string };

/**
 * One 100 % bar split into parts (e.g. where each peso of gross goes), with a
 * legend that carries every value and %, so identity is never color alone.
 * Hover/focus a segment or a legend row to highlight it.
 */
export function StackedShare({ segments, label }: { segments: Segment[]; label: string }) {
  const [active, setActive] = useState<number | null>(null);
  const total = segments.reduce((sum, s) => sum + Math.max(s.value, 0), 0);
  return (
    <div>
      <div role="img" aria-label={label} className="grow-x flex h-7 w-full gap-[2px] overflow-hidden rounded-lg bg-navy/5">
        {segments.map((segment, i) =>
          segment.value > 0 ? (
            <div
              key={segment.label}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              className={`${SERIES[i % SERIES.length]} h-full transition-opacity duration-300 ${
                active !== null && active !== i ? "opacity-30" : ""
              }`}
              style={{ width: `${(segment.value / total) * 100}%` }}
            />
          ) : null
        )}
      </div>
      {/* auto-fit: as many legend columns as fit (3 full width, fewer in a half-width card) */}
      <ul className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(10rem,1fr))] gap-x-6 gap-y-2">
        {segments.map((segment, i) => (
          <li
            key={segment.label}
            tabIndex={0}
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(null)}
            onFocus={() => setActive(i)}
            onBlur={() => setActive(null)}
            className={`flex items-start gap-2 rounded-lg p-1.5 outline-none transition duration-200 focus-visible:ring-2 focus-visible:ring-orange/40 ${
              active === i ? "bg-white/80" : ""
            }`}
          >
            <span aria-hidden="true" className={`mt-1 h-3 w-3 shrink-0 rounded-sm ${SERIES[i % SERIES.length]}`} />
            <span className="min-w-0">
              <span className="block text-xs text-navy/70">{segment.label}</span>
              <span className="block font-semibold text-navy">
                {currency(segment.value)}{" "}
                <span className="font-normal text-navy/70">· {share(Math.max(segment.value, 0), total)}%</span>
              </span>
              {segment.detail && <span className="block text-[11px] text-navy/70">{segment.detail}</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── Ranked bars ──────────────────────────────────────────────────────── */

export type Bar = { key: string; label: string; value: number; detail: string; muted?: boolean };

/**
 * Ranked horizontal bars, one hue (magnitude), value at the tip, growing in
 * one after another. Rows stack label-over-bar on phones and sit side by
 * side from `sm`. The detail line doubles as the spoken label.
 */
export function RankedBars({ bars, caption }: { bars: Bar[]; caption: string }) {
  const max = Math.max(...bars.map((b) => b.value), 0);
  const total = bars.reduce((sum, b) => sum + b.value, 0);
  return (
    <ul aria-label={caption} className="space-y-3.5">
      {bars.map((bar, i) => {
        const width = max > 0 ? Math.max((bar.value / max) * 100, bar.value > 0 ? 1.5 : 0) : 0;
        return (
          <li
            key={bar.key}
            tabIndex={0}
            aria-label={`${bar.label}: ${currency(bar.value)}, ${share(bar.value, total)}% · ${bar.detail}`}
            className="group grid items-center gap-x-3 gap-y-1 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-orange/40 sm:grid-cols-[minmax(7rem,11rem)_1fr]"
          >
            <span className={`truncate text-sm ${bar.muted ? "text-navy/70" : "font-medium text-navy"}`}>{bar.label}</span>
            <div className="flex min-w-0 items-center gap-2">
              <div className="h-4 min-w-0 flex-1 rounded-r bg-navy/[0.04]">
                <div
                  style={{ ...cascade(i), width: `${width}%` }}
                  className="grow-x h-full rounded-r bg-chart-1 transition-[filter] duration-300 group-hover:brightness-110"
                />
              </div>
              <span className="w-[7.5rem] shrink-0 text-right text-sm font-semibold tabular-nums text-navy">
                {currency(bar.value)}
              </span>
            </div>
            <span className="text-[11px] text-navy/70 sm:col-start-2">
              {share(bar.value, total)}% · {bar.detail}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
