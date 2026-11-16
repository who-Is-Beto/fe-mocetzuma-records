import { useState } from "react";
import { Link } from "react-router-dom";
import type { PresaleOrder } from "../../app/domain/presales";
import { currency } from "../../app/lib/format";
import { extractErrorMessage } from "../../app/lib/httpClient";
import { isHttpUrl } from "../../app/lib/url";
import type { PresaleService } from "../../app/services/presaleService";
import { Img } from "../../components/Img";
import { shortDate } from "../../components/presales/presaleText";

const CLOSED = new Set(["vencido", "cancelado"]);

const TONE: Record<string, string> = {
  apartado: "bg-sun/60 text-navy",
  pagado: "bg-sky-100 text-denim",
  listo: "bg-green-100 text-green-900",
  enviado: "bg-green-100 text-green-900",
  entregado: "bg-navy text-cream",
  vencido: "bg-coral/15 text-coral",
  cancelado: "bg-navy/10 text-navy/70"
};

/** Apartado → Pagado → Esperando que llegue → Listo para recoger / Enviado. */
function steps(order: PresaleOrder) {
  const last = order.delivery === "shipping" ? "Enviado" : "Listo para recoger";
  const waiting = order.all_arrived
    ? order.delivery === "shipping"
      ? "Preparando envío"
      : "En tienda"
    : "Esperando que llegue a tienda";
  const labels = ["Apartado", "Pagado", waiting, last];
  const reached =
    order.status === "apartado"
      ? 0
      : order.status === "pagado"
        ? 2
        : order.status === "listo" || order.status === "enviado" || order.status === "entregado"
          ? 3
          : 0;
  return { labels, reached };
}

function statusLabel(order: PresaleOrder) {
  if (order.status === "pagado" && !order.all_arrived) return "Pagado · esperando que llegue";
  if (order.status === "pagado" && order.shipping_pending) return "Pagado · falta envío";
  return order.status_label;
}

type Props = { order: PresaleOrder; service: PresaleService; highlight?: boolean };

/** One presale in Mis órdenes: where it is, what's paid and owed, and the pickup code. */
export function PresaleOrderCard({ order, service, highlight = false }: Props) {
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");
  const [showPayments, setShowPayments] = useState(false);
  const balance = Number(order.balance);
  const owes = balance > 0 && !CLOSED.has(order.status) && order.status !== "entregado";
  const closed = CLOSED.has(order.status);
  const { labels, reached } = steps(order);
  const progress = (reached / (labels.length - 1)) * 100;
  const urgent = owes && order.all_arrived && order.days_left <= 7;
  // The QR is for picking up at the store; shipped orders never use it.
  const showCode = !closed && order.delivery === "pickup" && order.status !== "entregado";
  const multi = order.presales.length > 1;
  const lineName = (item: PresaleOrder["items"][number]) => (multi ? `${item.presale_title} · ${item.option_name}` : item.option_name);

  // Abono: from $100 in steps of $50, records only (shipping goes with the last payment).
  const maxAbono = Math.floor((balance - Number(order.shipping_due)) / 50) * 50;
  const canAbonar = owes && maxAbono >= 100;
  const [abono, setAbono] = useState("");
  const abonoValue = Number(abono);
  const abonoOk = abonoValue >= 100 && abonoValue <= maxAbono && abonoValue % 50 === 0;

  const settle = async (amount?: number) => {
    setPaying(true);
    setError("");
    try {
      const { checkout_url } = await service.settle(order.code, amount);
      window.location.assign(checkout_url);
    } catch (err) {
      setPaying(false);
      setError(extractErrorMessage(err, "No pudimos abrir el pago. Intenta de nuevo."));
    }
  };

  return (
    <article
      className={`overflow-hidden rounded-[24px] border bg-cream shadow-card ${
        highlight ? "border-orange shadow-panel" : "border-navy/10"
      }`}
      aria-labelledby={`presale-${order.code}`}
    >
      <div className="grid gap-5 p-4 sm:p-6 md:grid-cols-[minmax(0,1fr)_14rem]">
        <div className="min-w-0">
          <div className="flex gap-4">
            <Link
              to={`/preventas/${order.presale.slug}`}
              className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-sand shadow-card ring-1 ring-navy/10 sm:h-24 sm:w-24"
            >
              {order.presale.cover ? (
                <Img src={order.presale.cover} alt={order.presale.title} width={96} className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full items-center justify-center text-3xl" aria-hidden="true">💿</span>
              )}
            </Link>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="rounded-pill bg-navy px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-cream">
                  Preventa
                </span>
                <span className={`rounded-pill px-2.5 py-0.5 text-[11px] font-semibold ${TONE[order.status] ?? TONE.apartado}`}>
                  {statusLabel(order)}
                </span>
              </div>
              <h2 id={`presale-${order.code}`} className="mt-1.5 line-clamp-2 font-display text-[15px] leading-snug text-denim sm:text-base">
                {order.presales.map((p) => p.title).join(" + ")}
              </h2>
              <p className="mt-0.5 line-clamp-2 text-xs text-navy/75">
                {[...new Set(order.presales.map((p) => p.artist))].join(" · ")} · {order.delivery_label}
              </p>
              <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Versiones">
                {order.items.map((item) => (
                  <li key={item.id} title={`${lineName(item)} ×${item.quantity}`} className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-pill bg-white/80 py-0.5 pl-0.5 pr-2.5 text-xs font-semibold text-navy ring-1 ring-navy/10">
                    {item.image && <Img src={item.image} alt="" width={20} className="h-5 w-5 shrink-0 rounded-full object-cover" />}
                    <span className="min-w-0 truncate">{lineName(item)} ×{item.quantity}</span>
                    <span className={`shrink-0 ${item.delivered_at ? "text-denim" : item.arrived ? "text-orange" : "text-navy/50"}`}>
                      {item.delivered_at ? "✓ entregado" : item.arrived ? "ya llegó" : "en camino"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {!closed && (
            <div role="img" aria-label={`Estado: ${labels[reached]}`} className="relative mt-6 h-14 max-w-lg">
              <div className="absolute left-3.5 right-3.5 top-3 h-1 rounded-full bg-navy/10" aria-hidden="true">
                <div className="grow-x h-full rounded-full bg-gradient-to-r from-orange to-amber" style={{ width: `${progress}%` }} />
              </div>
              <ol aria-hidden="true">
                {labels.map((label, i) => {
                  const done = i < reached || order.status === "entregado" || (i === reached && i !== 2);
                  const edge = i === 0 ? "items-start text-left" : i === labels.length - 1 ? "items-end text-right" : "items-center text-center";
                  // Dots sit exactly on the bar's quarters; the end labels hug the edges.
                  const shift = i === 0 ? "0%" : i === labels.length - 1 ? "-100%" : "-50%";
                  return (
                    <li
                      key={label}
                      title={label}
                      className={`absolute top-0 flex w-[min(5.5rem,25%)] flex-col gap-1.5 ${edge}`}
                      style={{ left: `calc(0.875rem + (100% - 1.75rem) * ${i / (labels.length - 1)})`, transform: `translateX(calc(${shift} ${i === 0 ? "- 0.875rem" : i === labels.length - 1 ? "+ 0.875rem" : ""}))` }}
                    >
                      <span
                        className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ring-4 ring-cream ${
                          done ? "bg-orange text-charcoal" : i === reached ? "bg-white text-navy shadow-[0_0_0_6px_rgba(244,144,60,0.25)]" : "bg-white text-navy/60"
                        }`}
                      >
                        {done ? "✓" : i + 1}
                      </span>
                      <span className={`max-w-full truncate text-[10px] font-semibold leading-tight sm:text-[11px] ${i <= reached ? "text-navy" : "text-navy/60"}`}>
                        {label}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}

          <dl className="mt-6 grid grid-cols-3 gap-3 rounded-2xl bg-white/70 p-4 text-sm">
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-navy/60">Total</dt>
              <dd className="mt-0.5 font-semibold tabular-nums text-navy">
                {currency(order.total)}
                {order.shipping_pending ? <span className="block text-[11px] font-normal text-navy/60">+ envío</span> : null}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-navy/60">Pagado</dt>
              <dd className="mt-0.5 font-semibold tabular-nums text-navy">{currency(order.paid)}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-navy/60">Falta</dt>
              <dd className={`mt-0.5 font-semibold tabular-nums ${owes ? "text-coral" : "text-green-800"}`}>
                {owes ? currency(balance) : "Nada"}
              </dd>
            </div>
          </dl>

          {owes && (
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className={`text-sm ${urgent ? "font-semibold text-coral" : "text-navy/75"}`}>
                {order.all_arrived
                  ? `Liquida antes del ${shortDate(order.deadline)} (${order.days_left === 1 ? "queda 1 día" : `quedan ${order.days_left} días`}).`
                  : `Tienes hasta el ${shortDate(order.deadline)} para liquidar (120 días desde tu apartado).`}
              </p>
              <button
                type="button"
                onClick={() => settle()}
                disabled={paying}
                className="min-h-[48px] shrink-0 rounded-pill bg-orange px-6 text-sm font-semibold text-charcoal transition duration-300 hover:-translate-y-0.5 hover:bg-amber active:translate-y-0 disabled:opacity-60"
              >
                {paying ? "Abriendo el pago…" : `Liquidar ${currency(balance)}`}
              </button>
            </div>
          )}
          {canAbonar && (
            <form
              className="mt-3 flex flex-wrap items-end gap-2 rounded-2xl bg-white/70 p-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (abonoOk) void settle(abonoValue);
              }}
            >
              <label className="min-w-0 flex-1">
                <span className="block text-xs font-semibold text-navy/70">¿Prefieres abonar? Desde $100, en múltiplos de $50</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={100}
                  max={maxAbono}
                  step={50}
                  placeholder="100"
                  value={abono}
                  onChange={(e) => setAbono(e.target.value)}
                  className="mt-1 min-h-[44px] w-full rounded-xl border border-navy/15 bg-white px-3 text-sm tabular-nums text-navy focus:border-orange focus:outline-none"
                />
              </label>
              <button
                type="submit"
                disabled={paying || !abonoOk}
                className="min-h-[44px] shrink-0 rounded-pill px-5 text-sm font-semibold text-navy ring-1 ring-navy/20 transition hover:bg-orange/15 hover:ring-orange disabled:opacity-50"
              >
                {abonoOk ? `Abonar ${currency(abonoValue)}` : "Abonar"}
              </button>
              {abono !== "" && !abonoOk && (
                <p className="w-full text-xs text-coral">
                  Elige entre $100 y {currency(maxAbono)}, en múltiplos de $50.
                </p>
              )}
            </form>
          )}
          {order.status === "pagado" && order.shipping_pending && (
            <p className="mt-4 text-sm text-navy/75">El envío se cotiza cuando llegue el disco; te avisamos por correo.</p>
          )}
          {order.status === "enviado" && order.shipping_link && (
            <p className="mt-4 text-sm text-navy/80">
              Guía:{" "}
              {isHttpUrl(order.shipping_link) ? (
                <a href={order.shipping_link} target="_blank" rel="noopener noreferrer" className="font-semibold text-orange underline">
                  Rastrear paquete
                </a>
              ) : (
                <span className="font-semibold">{order.shipping_link}</span>
              )}
            </p>
          )}
          {order.status === "vencido" && (
            <p className="mt-4 text-sm text-coral">El plazo para liquidar terminó y el apartado se perdió.</p>
          )}
          {error && (
            <p role="alert" className="mt-3 text-sm text-coral">
              {error}
            </p>
          )}

          {order.payments.length > 0 && (
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setShowPayments((v) => !v)}
                aria-expanded={showPayments}
                className="min-h-[44px] text-sm font-semibold text-navy underline-offset-4 hover:text-orange hover:underline"
              >
                {showPayments ? "Ocultar pagos" : `Ver pagos (${order.payments.filter((p) => !p.voided).length})`}
              </button>
              {showPayments && (
                <ul className="mt-1 divide-y divide-navy/10 text-sm">
                  {order.payments.map((p) => (
                    <li key={p.id} className={`flex justify-between gap-3 py-2 ${p.voided ? "text-navy/50 line-through" : "text-navy"}`}>
                      <span>
                        {new Date(p.created_at).toLocaleDateString("es-MX", { day: "numeric", month: "short" })} · {p.method_label}
                      </span>
                      <span className="tabular-nums">{currency(p.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {showCode && (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-orange/60 bg-white/80 p-4 text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-orange">Tu código</p>
            <p className="mt-1 font-mono text-2xl font-bold tracking-[0.12em] text-denim">{order.code}</p>
            <img
              src={service.qrUrl(order.code)}
              alt={`Código QR de ${order.code}`}
              width={132}
              height={132}
              loading="lazy"
              onError={(e) => (e.currentTarget.hidden = true)}
              className="mt-2 h-[132px] w-[132px] rounded-lg bg-white"
            />
            <p className="mt-2 text-[11px] leading-snug text-navy/70">Muéstralo en la tienda: sin él no podemos entregar el disco.</p>
          </div>
        )}
      </div>
    </article>
  );
}
