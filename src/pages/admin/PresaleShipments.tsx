import { useState } from "react";
import type { AdminPresaleOrder } from "../../app/domain/presales";
import { currency } from "../../app/lib/format";
import { extractErrorMessage } from "../../app/lib/httpClient";
import { useAuth } from "../../app/providers/AuthProvider";
import type { PresaleService } from "../../app/services/presaleService";
import { Button } from "../../components/Button";

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
  const canShip = role === "ADMIN" || hasPerm("apiApp.change_order") || hasPerm("apiApp.change_presaleorder");
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const address = o.shipping_details ?? {};
  const shipped = o.status === "enviado";
  const ready = o.status === "pagado" && o.all_arrived && Number(o.balance) === 0 && !o.shipping_pending;

  const ship = async () => {
    setSaving(true);
    setError("");
    try {
      onUpdated(await service.admin.ship(o.id, draft.trim()));
    } catch (err) {
      setError(extractErrorMessage(err, "No se pudo marcar como enviado."));
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
          <span
            className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              shipped ? "bg-blue-100 text-blue-700" : ready ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
            }`}
          >
            {shipped ? "Enviado" : ready ? "Pagado · listo para enviar" : o.all_arrived ? "Falta cobrar envío" : "Aún no llega todo"}
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
      {shipped ? (
        o.shipping_link ? (
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
        ) : null
      ) : (
        canShip && (
          <div className="mt-3">
            <label htmlFor={`presale-track-${o.id}`} className="text-[11px] font-semibold uppercase tracking-[0.1em] text-navy/50">
              Link de rastreo
            </label>
            <div className="mt-1 flex gap-2">
              <input
                id={`presale-track-${o.id}`}
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={ready ? "URL o código de rastreo" : "Disponible cuando esté listo para enviar"}
                maxLength={255}
                disabled={!ready}
                className="w-full rounded-lg border border-navy/15 bg-white px-3 py-2 text-xs text-navy outline-none transition focus:border-orange focus:ring-2 focus:ring-orange/30 disabled:bg-navy/5"
              />
              <Button tone="navy" className="shrink-0 px-4 py-2 text-xs" disabled={!ready || !draft.trim() || saving} onClick={() => void ship()}>
                {saving ? "…" : "Marcar enviado"}
              </Button>
            </div>
          </div>
        )
      )}
    </div>
  );
}
