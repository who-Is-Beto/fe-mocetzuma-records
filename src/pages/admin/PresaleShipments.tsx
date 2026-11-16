import { useState } from "react";
import { presaleAsPedidoStatus, type AdminPresaleOrder } from "../../app/domain/presales";
import { ORDER_STATUSES, type OrderStatus } from "../../app/domain/orders";
import { currency } from "../../app/lib/format";
import { extractErrorMessage } from "../../app/lib/httpClient";
import { useAuth } from "../../app/providers/AuthProvider";
import type { PresaleService } from "../../app/services/presaleService";
import { Button } from "../../components/Button";

const STATUS_BADGE: Record<OrderStatus, string> = {
  pending: "bg-amber-100 text-amber-700",
  paid: "bg-green-100 text-green-700",
  shipped: "bg-blue-100 text-blue-700",
  delivered: "bg-emerald-100 text-emerald-700",
  canceled: "bg-red-100 text-red-700"
};

type Props = {
  order: AdminPresaleOrder;
  service: PresaleService;
  onUpdated: (order: AdminPresaleOrder) => void;
};

/**
 * Pedidos: a paid presale going by mail, as one more order in the list. Marking
 * it shipped saves the tracking link and emails it to the buyer.
 */
export function PresaleShipmentCard({ order: o, service, onUpdated }: Props) {
  const { hasPerm, role } = useAuth();
  const admin = role === "ADMIN";
  const canShip = admin || hasPerm("apiApp.change_order") || hasPerm("apiApp.change_presaleorder");
  const canCancel = admin || hasPerm("apiApp.change_presaleorder");
  const current = presaleAsPedidoStatus(o);
  const [status, setStatus] = useState<OrderStatus>(current);
  const [link, setLink] = useState(o.shipping_link ?? "");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const address = o.shipping_details ?? {};
  // Ready to go: everything arrived and paid, shipping included.
  const ready = o.status === "pagado" && o.all_arrived && Number(o.balance) === 0 && !o.shipping_pending;

  // Same states as any pedido; a presale only moves forward from where it is.
  const allowed: Record<OrderStatus, boolean> = {
    pending: false,
    paid: current === "paid",
    shipped: (current === "paid" && ready) || current === "shipped",
    delivered: current === "shipped" || current === "delivered",
    canceled: (current === "paid" && canCancel) || current === "canceled"
  };
  const linkChanged = link.trim() !== (o.shipping_link ?? "");
  const dirty = status !== current || (status === "shipped" && linkChanged);
  const missing =
    status === "shipped" && !link.trim() ? "Escribe la guía para marcarla enviada." : status === "canceled" && current !== "canceled" && !reason.trim() ? "Escribe por qué se cancela." : "";

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const updated =
        status === "shipped"
          ? await service.admin.ship(o.id, link.trim())
          : status === "delivered"
            ? await service.admin.received(o.id)
            : await service.admin.cancel(o.id, reason.trim());
      onUpdated(updated);
      setStatus(presaleAsPedidoStatus(updated));
      setReason("");
    } catch (err) {
      setError(extractErrorMessage(err, "No se pudo actualizar la preventa."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-orange/30 bg-white/70 p-3 backdrop-blur sm:p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-navy">
            <span className="mr-1.5 rounded-full bg-orange px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-charcoal">
              Preventa
            </span>
            <span className="font-mono">{o.code}</span> ·{" "}
            <span className="font-normal text-navy/60">{o.buyer_email || o.buyer_name}</span>
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-navy/50">
            {new Date(o.reserved_at).toLocaleDateString("es-mx", { day: "numeric", month: "long", year: "numeric" })} · Envío a
            domicilio
            {o.shipping_cost ? ` · Envío ${currency(o.shipping_cost)}${o.shipping_courier ? ` (${o.shipping_courier})` : ""}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:justify-end">
          <span className="whitespace-nowrap font-display text-lg text-denim">{currency(o.total)}</span>
          <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_BADGE[current]}`}>
            {current === "paid"
              ? ready
                ? "Pagado · listo para enviar"
                : o.all_arrived
                  ? "Pagado · falta cobrar envío"
                  : "Pagado · aún no llega todo"
              : ORDER_STATUSES.find((s) => s.value === current)?.label}
          </span>
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="min-w-0 rounded-xl bg-cream/60 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-navy/50">Discos</p>
          <ul className="mt-1 space-y-0.5">
            {o.items.map((item) => (
              <li key={item.id} className="truncate text-xs text-navy/80">
                {item.quantity}× {item.presale_title} · {item.option_name}
              </li>
            ))}
          </ul>
        </div>
        <div className="min-w-0 rounded-xl bg-cream/60 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-navy/50">Dirección</p>
          <p className="mt-1 break-words text-xs leading-relaxed text-navy/80">
            {address.street} {address.number}, {address.neighborhood}
            <br />
            {address.city}, {address.state} · CP {address.zip}
            <br />
            {address.fullName} · {address.phone || o.buyer_phone}
          </p>
        </div>
      </div>

      {error && <p role="alert" className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {canShip && current !== "canceled" && current !== "delivered" ? (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="sm:w-44">
            <label htmlFor={`presale-status-${o.id}`} className="text-[11px] font-semibold uppercase tracking-[0.1em] text-navy/50">
              Estado
            </label>
            <select
              id={`presale-status-${o.id}`}
              value={status}
              onChange={(e) => setStatus(e.target.value as OrderStatus)}
              disabled={saving}
              className={`mt-1 w-full cursor-pointer rounded-lg border border-navy/15 bg-white px-2 py-2 text-xs font-semibold outline-none transition focus:border-orange focus:ring-2 focus:ring-orange/30 ${
                status !== current ? "border-orange/60 ring-1 ring-orange/40" : ""
              }`}
            >
              {ORDER_STATUSES.filter((s) => s.value !== "pending").map((s) => (
                <option key={s.value} value={s.value} disabled={!allowed[s.value]}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label htmlFor={`presale-extra-${o.id}`} className="text-[11px] font-semibold uppercase tracking-[0.1em] text-navy/50">
              {status === "canceled" ? "Motivo de la cancelación" : "Link de rastreo"}
            </label>
            <div className="mt-1 flex gap-2">
              {status === "canceled" ? (
                <input
                  id={`presale-extra-${o.id}`}
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Ej. el cliente lo pidió"
                  maxLength={200}
                  className="w-full rounded-lg border border-navy/15 bg-white px-3 py-2 text-xs text-navy outline-none transition focus:border-orange focus:ring-2 focus:ring-orange/30"
                />
              ) : (
                <input
                  id={`presale-extra-${o.id}`}
                  type="text"
                  value={link}
                  onChange={(e) => {
                    setLink(e.target.value);
                    // Like any pedido: typing a guide pre-selects Enviado (nothing saves until Guardar).
                    if (e.target.value.trim() && current === "paid" && ready) setStatus("shipped");
                  }}
                  placeholder={current === "paid" && !ready ? "Disponible cuando esté listo para enviar" : "URL o código de rastreo"}
                  maxLength={255}
                  disabled={current === "paid" && !ready}
                  className="w-full rounded-lg border border-navy/15 bg-white px-3 py-2 text-xs text-navy outline-none transition focus:border-orange focus:ring-2 focus:ring-orange/30 disabled:bg-navy/5"
                />
              )}
              <Button tone="navy" className="shrink-0 px-4 py-2 text-xs" disabled={!dirty || Boolean(missing) || saving} onClick={() => void save()}>
                {saving ? "…" : "Guardar"}
              </Button>
            </div>
            {dirty && missing ? <p className="mt-1 text-[11px] text-coral">{missing}</p> : null}
          </div>
        </div>
      ) : o.shipping_link ? (
        <p className="mt-3 truncate text-xs text-navy/70">
          Guía:{" "}
          {/^https?:\/\//.test(o.shipping_link) ? (
            <a href={o.shipping_link} target="_blank" rel="noreferrer" className="font-semibold text-denim underline">
              {o.shipping_link}
            </a>
          ) : (
            <span className="font-semibold">{o.shipping_link}</span>
          )}
        </p>
      ) : null}
    </div>
  );
}
