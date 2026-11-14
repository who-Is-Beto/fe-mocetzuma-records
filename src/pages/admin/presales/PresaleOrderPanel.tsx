import { useId, useState, type ReactNode } from "react";
import type { AdminPresaleOrder } from "../../../app/domain/presales";
import { currency } from "../../../app/lib/format";
import { extractErrorMessage } from "../../../app/lib/httpClient";
import type { PresaleService } from "../../../app/services/presaleService";
import { Modal } from "../../../components/Modal";
import { btnGhost, btnNavy, btnPrimary, input, label, METHOD_LABEL, STATUS_TONE } from "./ui";

type Props = {
  service: PresaleService;
  order: AdminPresaleOrder;
  can: (perm: string) => boolean;
  onClose: () => void;
  onChanged: (order: AdminPresaleOrder) => void;
};

type Step = null | "pay" | "void" | "ship" | "cancel" | "deadline";

const when = (iso: string) =>
  new Date(iso).toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Everything about one buyer's presale: money ledger, delivery, and the actions on it. */
export function PresaleOrderPanel({ service, order, can, onClose, onChanged }: Props) {
  const ids = useId();
  const [step, setStep] = useState<Step>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<keyof typeof METHOD_LABEL>("cash");
  const [note, setNote] = useState("");
  const [voidId, setVoidId] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [tracking, setTracking] = useState("");
  const [deadline, setDeadline] = useState(order.deadline_override ?? order.deadline);
  // Lines the counter is NOT handing over now (everything arrived is ticked by default).
  const [held, setHeld] = useState<Set<number>>(new Set());

  const balance = Number(order.balance);
  const closed = ["cancelado", "vencido", "entregado", "enviado"].includes(order.status);
  const canPay = can("add_presalepayment") && !closed && balance > 0;
  const canOrders = can("change_presaleorder");
  const readyPickup = order.status === "listo";
  // Pickup hands over what arrived; the server checks it's paid for.
  const deliverable =
    order.delivery === "pickup" && !closed && order.status !== "pending_payment"
      ? order.items.filter((i) => i.arrived && !i.delivered_at)
      : [];
  const chosen = deliverable.filter((i) => !held.has(i.id));
  const copies = chosen.reduce((n, i) => n + i.quantity, 0);
  const readyShip = order.delivery === "shipping" && order.status === "pagado" && order.all_arrived && balance === 0 && !order.shipping_pending;

  const act = async (fn: () => Promise<AdminPresaleOrder>) => {
    setBusy(true);
    setError("");
    try {
      const updated = await fn();
      onChanged(updated);
      setStep(null);
      setAmount("");
      setNote("");
      setReason("");
    } catch (err) {
      setError(extractErrorMessage(err, "No se pudo completar la acción."));
    } finally {
      setBusy(false);
    }
  };

  const amountValid = /^\d+([.,]\d{1,2})?$/.test(amount) && Number(amount.replace(",", ".")) > 0 && Number(amount.replace(",", ".")) <= balance;

  const Row = ({ k, children }: { k: string; children: ReactNode }) => (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <dt className="text-navy/70">{k}</dt>
      <dd className="text-right font-semibold text-navy">{children}</dd>
    </div>
  );

  return (
    <Modal open onClose={onClose} dismissible={!busy} labelledBy={`${ids}-title`} variant="sheet">
      <div className="max-h-[80vh] overflow-y-auto pr-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-mono text-sm font-bold tracking-wider text-orange">{order.code}</p>
            <h3 id={`${ids}-title`} className="font-display text-lg text-denim">
              {order.buyer_name}
            </h3>
            <p className="text-xs text-navy/70">
              {[order.buyer_email, order.buyer_phone, order.source_label, order.has_account ? "con cuenta" : "sin cuenta"].filter(Boolean).join(" · ")}
            </p>
          </div>
          <span className={`rounded-pill px-2.5 py-1 text-[11px] font-semibold ${STATUS_TONE[order.status]}`}>{order.status_label}</span>
        </div>

        {order.oversold && (
          <p className="mt-3 rounded-xl bg-coral/15 px-3 py-2 text-sm text-coral">
            Sobreventa: pagó después de que su apartado temporal expiró y ya no quedaban copias. Consigue otra copia o cancela y reembolsa.
          </p>
        )}

        {/* Hand-over state: the one thing to read at the counter */}
        {order.delivery === "pickup" && !closed && (
          <div className={`mt-4 rounded-2xl p-4 text-center ${balance === 0 ? "bg-green-100 text-green-900" : "bg-coral/15 text-coral"}`}>
            <p className="text-lg font-bold">
              {balance === 0 ? (order.all_arrived ? "Pagado completo · Entregar" : "Pagado completo · aún no llega") : `Falta ${currency(balance)}`}
            </p>
          </div>
        )}
        {order.status === "entregado" && (
          <p className="mt-4 rounded-2xl bg-navy p-4 text-center font-semibold text-cream">
            Ya entregado{order.delivered_at ? ` el ${when(order.delivered_at)}` : ""}
            {order.delivered_by ? ` por ${order.delivered_by}` : ""}
          </p>
        )}

        <h4 className={`${label} mt-5`}>Versiones</h4>
        <ul className="mt-1 divide-y divide-navy/10">
          {order.items.map((item) => {
            const canTick = deliverable.some((i) => i.id === item.id) && canOrders;
            const body = (
              <>
                {item.image ? (
                  <img src={item.image} alt="" width={40} height={40} className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                ) : (
                  <span className="h-10 w-10 shrink-0 rounded-lg bg-sand" aria-hidden="true" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-navy">
                    {item.option_name} ×{item.quantity}
                  </span>
                  <span className={`block text-xs ${item.delivered_at ? "text-denim" : item.arrived ? "text-orange" : "text-navy/60"}`}>
                    {item.delivered_at ? `✓ Entregado ${when(item.delivered_at)}` : item.arrived ? "Ya llegó" : "En camino"}
                  </span>
                </span>
                <span className="text-sm font-semibold tabular-nums text-navy">{currency(item.line_total)}</span>
              </>
            );
            return (
              <li key={item.id}>
                {canTick ? (
                  <label className="flex min-h-[52px] cursor-pointer items-center gap-3 py-1.5">
                    <input
                      type="checkbox"
                      checked={!held.has(item.id)}
                      onChange={(e) =>
                        setHeld((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.delete(item.id);
                          else next.add(item.id);
                          return next;
                        })
                      }
                      className="h-5 w-5 shrink-0 accent-orange"
                      aria-label={`Entregar ${item.option_name}`}
                    />
                    {body}
                  </label>
                ) : (
                  <div className="flex min-h-[52px] items-center gap-3 py-1.5 pl-8">{body}</div>
                )}
              </li>
            );
          })}
        </ul>

        <dl className="mt-4 divide-y divide-navy/10">
          <Row k="Precio">
            {currency(order.item_price)}
            {Number(order.discount_applied) > 0 && <span className="ml-1 text-xs font-normal text-orange">(−{currency(order.discount_applied)})</span>}
          </Row>
          <Row k="Entrega">{order.delivery_label}</Row>
          {order.delivery === "shipping" && (
            <Row k="Envío">
              {order.shipping_cost ? currency(order.shipping_cost) : order.shipping_estimate ? `≈ ${currency(order.shipping_estimate)} (por cotizar)` : "Por cotizar"}
            </Row>
          )}
          <Row k="Pagado">
            {currency(order.paid)} de {currency(order.total)}
          </Row>
          {(balance > 0 || order.shipping_pending) && !closed && (
            <Row k="Plazo para liquidar">
              {order.deadline}
              {order.all_arrived ? ` (${order.days_left} días)` : " · aún no llega"}
            </Row>
          )}
        </dl>

        {order.delivery === "shipping" && Object.keys(order.shipping_details ?? {}).length > 0 && (
          <p className="mt-2 rounded-xl bg-cream px-3 py-2 text-xs leading-relaxed text-navy/80">
            {[
              order.shipping_details.fullName,
              `${order.shipping_details.street ?? ""} ${order.shipping_details.number ?? ""}`.trim(),
              order.shipping_details.neighborhood,
              `${order.shipping_details.city ?? ""}, ${order.shipping_details.state ?? ""}`,
              `CP ${order.shipping_details.zip ?? ""}`,
              order.shipping_details.phone
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}

        <h4 className={`${label} mt-5`}>Pagos</h4>
        {order.payments.length === 0 ? (
          <p className="mt-1 text-sm text-navy/60">Sin pagos registrados.</p>
        ) : (
          <ul className="mt-1 divide-y divide-navy/10 text-sm">
            {order.payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-2">
                <span className={p.voided ? "text-navy/50 line-through" : "text-navy"}>
                  {when(p.created_at)} · {p.method_label}
                  {p.note ? ` · ${p.note}` : ""}
                  {p.registered_by ? ` · ${p.registered_by}` : ""}
                </span>
                <span className="flex items-center gap-3">
                  <span className={`tabular-nums font-semibold ${p.voided ? "text-navy/50 line-through" : "text-navy"}`}>{currency(p.amount)}</span>
                  {!p.voided && can("add_presalepayment") && !closed && (
                    <button
                      type="button"
                      className="min-h-[36px] text-xs font-semibold text-coral hover:underline"
                      onClick={() => {
                        setVoidId(p.id);
                        setStep("void");
                      }}
                    >
                      Anular
                    </button>
                  )}
                </span>
                {p.voided && <span className="w-full text-xs text-navy/60">Anulado{p.voided_by ? ` por ${p.voided_by}` : ""}: {p.void_reason}</span>}
              </li>
            ))}
          </ul>
        )}

        {/* Action forms */}
        {step === "pay" && (
          <div className="mt-4 space-y-3 rounded-2xl bg-cream p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className={label}>Cantidad (falta {currency(balance)})</span>
                <input autoFocus inputMode="decimal" className={input} value={amount} onChange={(e) => setAmount(e.target.value)} />
              </label>
              <label className="block">
                <span className={label}>Forma de pago</span>
                <select className={input} value={method} onChange={(e) => setMethod(e.target.value as keyof typeof METHOD_LABEL)}>
                  {Object.entries(METHOD_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </label>
              <label className="block sm:col-span-2">
                <span className={label}>Nota (referencia de transferencia, etc.)</span>
                <input className={input} value={note} maxLength={120} onChange={(e) => setNote(e.target.value)} />
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={btnGhost} onClick={() => setAmount(order.balance)}>
                Todo lo que falta
              </button>
              <button
                type="button"
                className={btnPrimary}
                disabled={!amountValid || busy}
                onClick={() => act(() => service.admin.addPayment(order.id, { amount: amount.replace(",", "."), method, note }))}
              >
                Registrar {amountValid ? currency(amount.replace(",", ".")) : "pago"}
              </button>
            </div>
          </div>
        )}
        {step === "void" && (
          <div className="mt-4 space-y-3 rounded-2xl bg-coral/10 p-4">
            <label className="block">
              <span className={label}>¿Por qué se anula? (queda registrado)</span>
              <input autoFocus className={input} value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} />
            </label>
            <button
              type="button"
              className={btnNavy}
              disabled={!reason.trim() || busy || voidId === null}
              onClick={() => voidId !== null && act(() => service.admin.voidPayment(voidId, reason))}
            >
              Anular pago
            </button>
          </div>
        )}
        {step === "ship" && (
          <div className="mt-4 space-y-3 rounded-2xl bg-cream p-4">
            <label className="block">
              <span className={label}>Guía o enlace de rastreo</span>
              <input autoFocus className={input} value={tracking} onChange={(e) => setTracking(e.target.value)} />
            </label>
            <button type="button" className={btnPrimary} disabled={!tracking.trim() || busy} onClick={() => act(() => service.admin.ship(order.id, tracking))}>
              Marcar enviado
            </button>
          </div>
        )}
        {step === "cancel" && (
          <div className="mt-4 space-y-3 rounded-2xl bg-coral/10 p-4">
            <label className="block">
              <span className={label}>Motivo de la cancelación</span>
              <input autoFocus className={input} value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} />
            </label>
            <p className="text-xs text-navy/70">La copia se libera. Si hay que devolver dinero, hazlo por fuera (Stripe o en tienda).</p>
            <button type="button" className={btnNavy} disabled={!reason.trim() || busy} onClick={() => act(() => service.admin.cancel(order.id, reason))}>
              Cancelar preventa
            </button>
          </div>
        )}
        {step === "deadline" && (
          <div className="mt-4 space-y-3 rounded-2xl bg-cream p-4">
            <label className="block">
              <span className={label}>Nueva fecha límite para este comprador</span>
              <input type="date" className={input} value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </label>
            <button type="button" className={btnPrimary} disabled={!deadline || busy} onClick={() => act(() => service.admin.updateOrder(order.id, { deadline_override: deadline }))}>
              Guardar plazo
            </button>
          </div>
        )}

        {error && <p role="alert" className="mt-3 text-sm text-coral">{error}</p>}

        <div className="mt-5 flex flex-wrap gap-2 border-t border-navy/10 pt-4">
          {deliverable.length > 0 && canOrders && (
            <button
              type="button"
              className={btnPrimary}
              disabled={busy || chosen.length === 0}
              onClick={() => act(() => service.admin.deliver(order.id, chosen.map((i) => i.id)))}
            >
              {copies === 1 ? "Entregar 1 disco" : `Entregar ${copies} discos`}
            </button>
          )}
          {readyShip && canOrders && step !== "ship" && (
            <button type="button" className={btnPrimary} onClick={() => setStep("ship")}>
              Marcar enviado
            </button>
          )}
          {canPay && step !== "pay" && (
            <button type="button" className={readyPickup ? btnGhost : btnPrimary} onClick={() => setStep("pay")}>
              Registrar pago
            </button>
          )}
          {canOrders && order.delivery === "shipping" && !closed && order.all_arrived && (
            <button type="button" className={btnGhost} disabled={busy} onClick={() => act(() => service.admin.requote(order.id))}>
              Cotizar envío
            </button>
          )}
          {canOrders && !closed && balance > 0 && step !== "deadline" && (
            <button type="button" className={btnGhost} onClick={() => setStep("deadline")}>
              Cambiar plazo
            </button>
          )}
          {canOrders && order.is_expirable && (
            <button type="button" className={btnGhost} disabled={busy} onClick={() => act(() => service.admin.expire(order.id))}>
              Marcar apartado vencido
            </button>
          )}
          {canOrders && (order.status === "cancelado" || order.status === "vencido") && (
            <button type="button" className={btnGhost} disabled={busy} onClick={() => act(() => service.admin.reopen(order.id))}>
              Reabrir
            </button>
          )}
          {canOrders && !closed && step !== "cancel" && (
            <button type="button" className="min-h-[44px] px-3 text-sm font-semibold text-coral hover:underline" onClick={() => setStep("cancel")}>
              Cancelar
            </button>
          )}
          <button type="button" className={`${btnGhost} ml-auto`} onClick={onClose}>
            Cerrar
          </button>
        </div>

        {order.events.length > 0 && (
          <details className="mt-4 text-xs text-navy/70">
            <summary className="min-h-[36px] cursor-pointer font-semibold text-navy">Historial</summary>
            <ul className="mt-1 space-y-1">
              {order.events.map((e, i) => (
                <li key={i}>
                  {when(e.created_at)} · {e.note || e.kind}
                  {e.actor ? ` · ${e.actor}` : ""}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </Modal>
  );
}
